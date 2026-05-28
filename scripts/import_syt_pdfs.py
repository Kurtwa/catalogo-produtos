from __future__ import annotations

import argparse
import csv
import json
import re
from pathlib import Path
from uuid import uuid5, NAMESPACE_URL

from pypdf import PdfReader


MODEL_RE = re.compile(
    r"(?<![A-Z0-9-])("
    r"SYT-[A-Z]{1,3}\d{3,4}(?:-\d)?|"
    r"ZF-?\d{3,4}(?:-[^\s$]+)?|"
    r"SQ\d{4}|"
    r"(?:A|F|HY|HM|K|P|Q|T|L|SL)\d{1,4}[A-Z]?(?:-\d)?|"
    r"360P|PL\d{2}"
    r")(?![A-Z0-9-])"
)
SPEC_MARKERS = re.compile(
    r"\b(N\.W|N\.w|G\.W|G\.w|DIM|CTN|Main tube|Main Tube|Main Frame|Product Size|Assembly Size|Package|Packing Size|Weight Stack|WS)\b|[$]\s*\d",
    re.IGNORECASE,
)
PRICE_RE = re.compile(r"[$]\s*([0-9][0-9,.]*)")
WEIGHT_RE = re.compile(r"N\.W\s*(?:/ G\.W)?\s*[:：]?\s*([0-9,.]+)\s*Kg", re.IGNORECASE)
DIM_RE = re.compile(r"(?:DIM|Product Size|Assembly Size)\s*[:：]?\s*([0-9* xX（）()LWH.\-]+mm)", re.IGNORECASE)
CJK_RE = re.compile(r"[\u3400-\u9fff]+")


def stable_uuid(value: str) -> str:
    return str(uuid5(NAMESPACE_URL, value))


def clean_text(value: str) -> str:
    value = value.replace("\n", " ")
    value = re.sub(r"\s+", " ", value)
    return value.strip()


def clean_name(value: str) -> str:
    value = CJK_RE.sub(" ", value)
    value = re.sub(r"\b(Photo|Photos|Image|Picture|Pictures|Specification|Specifications)\b", " ", value, flags=re.IGNORECASE)
    value = re.sub(r"\s+", " ", value)
    return value.strip(" -:：*")


def series_from_name(pdf_name: str) -> str:
    name = pdf_name.removesuffix(".pdf")
    name = re.sub(r"(?i)\b(price|list|syt|2026|series|pdf|更新)\b", " ", name)
    name = re.sub(r"[^A-Za-z0-9&()]+", " ", name)
    return re.sub(r"\s+", " ", name).strip() or pdf_name.removesuffix(".pdf")


def extract_pdf_text(pdf_path: Path) -> tuple[str, int]:
    reader = PdfReader(str(pdf_path))
    pages = []
    for page in reader.pages:
        pages.append(page.extract_text() or "")
    return clean_text(" ".join(pages)), len(reader.pages)


def extract_products(pdf_path: Path) -> tuple[list[dict], int]:
    text, page_count = extract_pdf_text(pdf_path)
    matches = list(MODEL_RE.finditer(text))
    products = []
    seen = set()
    series = series_from_name(pdf_path.name)

    for index, match in enumerate(matches):
        code = match.group(1)
        if code in seen:
            continue
        seen.add(code)
        start = match.end()
        end = matches[index + 1].start() if index + 1 < len(matches) else min(len(text), start + 1000)
        block = clean_text(text[start:end])
        price_match = PRICE_RE.search(block)
        if not price_match:
            continue

        marker = SPEC_MARKERS.search(block)
        raw_name = block[: marker.start()] if marker else block[:80]
        name = clean_name(raw_name)
        if len(name) < 2:
            name = f"{series} {code}"

        price = price_match.group(1).replace(",", "")
        weight_match = WEIGHT_RE.search(block)
        dim_match = DIM_RE.search(block)
        tags = ["syt", series.lower().replace(" ", "-")]
        if "cardio" in pdf_path.name.lower():
            tags.append("cardio")
        if "pilates" in pdf_path.name.lower():
            tags.append("pilates")
        tags = list(dict.fromkeys(tags))

        products.append(
            {
                "id": stable_uuid(f"syt-05-2026-product-{pdf_path.name}-{code}"),
                "supplier_name": "SYT Fitness",
                "source_file_name": pdf_path.name,
                "source_file_id": stable_uuid(f"syt-05-2026-file-{pdf_path.name}"),
                "code": code,
                "name": name[:180],
                "category": series,
                "subcategory": "",
                "description": name,
                "technical_specs": block[:1200],
                "original_price": price,
                "currency": "USD",
                "exchange_rate": "5.25",
                "multiplier_factor": "1.60",
                "markup": "2.00",
                "weight": weight_match.group(1).replace(",", ".") if weight_match else "",
                "dimensions": dim_match.group(1) if dim_match else "",
                "material": "",
                "tags": ",".join(tags),
                "status": "pendente",
            }
        )

    return products, page_count


def sql_literal(value: str | None) -> str:
    if value is None or value == "":
        return "null"
    return "'" + str(value).replace("'", "''") + "'"


def main() -> None:
    parser = argparse.ArgumentParser(description="Importa PDFs de price list da SYT para CSV/SQL de carga.")
    parser.add_argument("source_folder", type=Path)
    parser.add_argument("--out", type=Path, default=Path("imports/syt-05-2026"))
    args = parser.parse_args()

    args.out.mkdir(parents=True, exist_ok=True)
    pdfs = sorted(args.source_folder.glob("*.pdf"))
    supplier_id = stable_uuid("syt-05-2026-supplier")

    catalog_rows = []
    product_rows = []
    for pdf in pdfs:
      products, page_count = extract_products(pdf)
      catalog_rows.append(
          {
              "id": stable_uuid(f"syt-05-2026-file-{pdf.name}"),
              "supplier_id": supplier_id,
              "supplier_name": "SYT Fitness",
              "file_name": pdf.name,
              "file_path": str(pdf),
              "file_size": pdf.stat().st_size,
              "page_count": page_count,
              "status": "uploaded",
              "line_name": series_from_name(pdf.name),
          }
      )
      product_rows.extend(products)

    catalog_csv = args.out / "syt_catalog_files.csv"
    products_csv = args.out / "syt_products_pending.csv"
    sql_file = args.out / "syt_seed.sql"
    js_file = args.out / "syt_seed_data.js"

    with catalog_csv.open("w", newline="", encoding="utf-8") as file:
        writer = csv.DictWriter(file, fieldnames=list(catalog_rows[0].keys()))
        writer.writeheader()
        writer.writerows(catalog_rows)

    with products_csv.open("w", newline="", encoding="utf-8") as file:
        writer = csv.DictWriter(file, fieldnames=list(product_rows[0].keys()))
        writer.writeheader()
        writer.writerows(product_rows)

    sql_lines = [
        "-- Carga inicial SYT 05/2026. Rode depois de supabase-schema.sql.",
        "insert into public.suppliers (id, name, country, contact_name, email, website, notes)",
        f"values ({sql_literal(supplier_id)}, 'SYT Fitness', 'China', 'Jack', 'zffitness1@zffitness.cn', 'www.sytfitness.com', 'Price lists SYT 05/2026')",
        "on conflict (id) do update set name = excluded.name, updated_at = now();",
        "",
    ]
    for row in catalog_rows:
        sql_lines.append(
            "insert into public.catalog_files (id, supplier_id, file_name, file_path, file_size, status, extraction_status) values "
            f"({sql_literal(row['id'])}, {sql_literal(row['supplier_id'])}, {sql_literal(row['file_name'])}, {sql_literal(row['file_path'])}, {row['file_size']}, 'uploaded', 'pending') "
            "on conflict (id) do update set file_name = excluded.file_name, file_path = excluded.file_path, updated_at = now();"
        )
    sql_lines.append("")
    for row in product_rows:
        tags = "array[" + ",".join(sql_literal(tag) for tag in row["tags"].split(",")) + "]"
        sql_lines.append(
            "insert into public.products "
            "(id, supplier_id, name, code, category, subcategory, description, technical_specs, original_price, currency, exchange_rate, multiplier_factor, markup, weight, dimensions, material, tags, source_file_id, status) values "
            f"({sql_literal(row['id'])}, {sql_literal(supplier_id)}, {sql_literal(row['name'])}, {sql_literal(row['code'])}, {sql_literal(row['category'])}, "
            f"{sql_literal(row['subcategory'])}, {sql_literal(row['description'])}, {sql_literal(row['technical_specs'])}, {row['original_price']}, "
            f"{sql_literal(row['currency'])}, {row['exchange_rate']}, {row['multiplier_factor']}, {row['markup']}, "
            f"{row['weight'] if row['weight'] else 'null'}, {sql_literal(row['dimensions'])}, {sql_literal(row['material'])}, {tags}, {sql_literal(row['source_file_id'])}, 'pendente') "
            "on conflict (id) do update set name = excluded.name, original_price = excluded.original_price, technical_specs = excluded.technical_specs, updated_at = now();"
        )
    sql_file.write_text("\n".join(sql_lines) + "\n", encoding="utf-8")

    app_products = []
    for row in product_rows:
        app_products.append(
            {
                "id": row["id"],
                "supplier_id": supplier_id,
                "name": row["name"],
                "code": row["code"],
                "category": row["category"],
                "subcategory": row["subcategory"],
                "description": row["description"],
                "technical_specs": row["technical_specs"],
                "original_price": float(row["original_price"]),
                "currency": row["currency"],
                "exchange_rate": float(row["exchange_rate"]),
                "multiplier_factor": float(row["multiplier_factor"]),
                "markup": float(row["markup"]),
                "weight": float(row["weight"]) if row["weight"] else None,
                "dimensions": row["dimensions"],
                "material": row["material"],
                "tags": row["tags"].split(","),
                "source_file_id": row["source_file_id"],
                "status": row["status"],
                "image_url": "",
            }
        )

    app_catalogs = [
        {
            "id": row["id"],
            "supplier_id": row["supplier_id"],
            "file_name": row["file_name"],
            "file_path": row["file_path"],
            "file_size": int(row["file_size"]),
            "page_count": int(row["page_count"]),
            "status": row["status"],
            "line_name": row["line_name"],
        }
        for row in catalog_rows
    ]

    app_seed = {
        "suppliers": [
            {
                "id": supplier_id,
                "name": "SYT Fitness",
                "country": "China",
                "contact_name": "Jack",
                "email": "zffitness1@zffitness.cn",
                "website": "www.sytfitness.com",
                "notes": "Price lists SYT 05/2026",
            }
        ],
        "catalogs": app_catalogs,
        "products": app_products,
    }
    js_file.write_text(
        "window.CATALOGO_SEED_DATA = "
        + json.dumps(app_seed, ensure_ascii=False, indent=2)
        + ";\n",
        encoding="utf-8",
    )

    print(f"PDFs: {len(catalog_rows)}")
    print(f"Produtos extraidos: {len(product_rows)}")
    print(f"Catalogos CSV: {catalog_csv}")
    print(f"Produtos CSV: {products_csv}")
    print(f"SQL: {sql_file}")
    print(f"JS demo: {js_file}")


if __name__ == "__main__":
    main()
