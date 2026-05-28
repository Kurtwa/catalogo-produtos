from __future__ import annotations

import csv
import json
from pathlib import Path
from uuid import NAMESPACE_URL, uuid5

from compare_cardio_markdown import parse_markdown


def stable_uuid(value: str) -> str:
    return str(uuid5(NAMESPACE_URL, value))


def read_csv(path: Path) -> list[dict]:
    with path.open(encoding="utf-8") as file:
        return list(csv.DictReader(file))


def write_csv(path: Path, rows: list[dict]) -> None:
    with path.open("w", newline="", encoding="utf-8") as file:
        writer = csv.DictWriter(file, fieldnames=list(rows[0].keys()))
        writer.writeheader()
        writer.writerows(rows)


def load_seed(path: Path) -> dict:
    prefix = "window.CATALOGO_SEED_DATA = "
    text = path.read_text(encoding="utf-8")
    return json.loads(text[len(prefix) :].strip().removesuffix(";"))


def write_seed(path: Path, seed: dict) -> None:
    path.write_text("window.CATALOGO_SEED_DATA = " + json.dumps(seed, ensure_ascii=False, indent=2) + ";\n", encoding="utf-8")


def sql_literal(value: str | None) -> str:
    if value is None or value == "":
        return "null"
    return "'" + str(value).replace("'", "''") + "'"


def main() -> None:
    base = Path("catalogo-produtos/imports/syt-05-2026")
    markdown_file = Path(r"C:\Users\kurtw\Downloads\2026_SYT_Cardio_price_list_extraido.md")
    products_csv = base / "syt_products_pending.csv"
    seed_file = base / "syt_seed_data.js"
    supplement_sql = base / "ocr-cardio/cardio_markdown_supplement.sql"

    md_rows = parse_markdown(markdown_file)
    rows = read_csv(products_csv)
    existing = {row["code"] for row in rows if row["category"] == "Cardio"}
    supplier_id = stable_uuid("syt-05-2026-supplier")
    source_file_id = stable_uuid("syt-05-2026-file-2026 SYT Cardio price list.pdf")
    source_file_name = "2026 SYT Cardio price list.pdf"

    added = []
    for code, md in md_rows.items():
        if code in existing:
            continue
        product_id = stable_uuid(f"syt-05-2026-product-{source_file_name}-{code}")
        specs = "; ".join(part for part in [md["md_dimensions"], md["md_weight"], f"Pagina da foto: {md['md_page']}"] if part)
        row = {
            "id": product_id,
            "supplier_name": "SYT Fitness",
            "source_file_name": source_file_name,
            "source_file_id": source_file_id,
            "code": code,
            "name": md["md_name"],
            "category": "Cardio",
            "subcategory": "",
            "description": md["md_name"],
            "technical_specs": specs,
            "original_price": md["md_price"],
            "currency": "USD",
            "exchange_rate": "5.25",
            "multiplier_factor": "1.60",
            "markup": "2.00",
            "weight": "",
            "dimensions": md["md_dimensions"].replace("DIM: ", "").split(";")[0],
            "material": "",
            "tags": "syt,cardio",
            "status": "pendente",
        }
        rows.append(row)
        added.append(row)

    if added:
        write_csv(products_csv, rows)
        seed = load_seed(seed_file)
        for row in added:
            seed["products"].append(
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
                    "weight": None,
                    "dimensions": row["dimensions"],
                    "material": "",
                    "tags": row["tags"].split(","),
                    "source_file_id": source_file_id,
                    "status": "pendente",
                    "image_url": "",
                }
            )
        write_seed(seed_file, seed)

        supplement_sql.parent.mkdir(parents=True, exist_ok=True)
        lines = ["-- Itens Cardio complementares vindos do Markdown validado."]
        for row in added:
            tags = "array[" + ",".join(sql_literal(tag) for tag in row["tags"].split(",")) + "]"
            lines.append(
                "insert into public.products "
                "(id, supplier_id, name, code, category, description, technical_specs, original_price, currency, exchange_rate, multiplier_factor, markup, dimensions, tags, source_file_id, status) values "
                f"({sql_literal(row['id'])}, {sql_literal(supplier_id)}, {sql_literal(row['name'])}, {sql_literal(row['code'])}, 'Cardio', "
                f"{sql_literal(row['description'])}, {sql_literal(row['technical_specs'])}, {row['original_price']}, 'USD', 5.25, 1.60, 2.00, "
                f"{sql_literal(row['dimensions'])}, {tags}, {sql_literal(source_file_id)}, 'pendente') "
                "on conflict (id) do update set name = excluded.name, original_price = excluded.original_price, updated_at = now();"
            )
        supplement_sql.write_text("\n".join(lines) + "\n", encoding="utf-8")

    print(f"Adicionados: {len(added)}")
    for row in added:
        print(f"{row['code']} | {row['name']} | {row['original_price']}")


if __name__ == "__main__":
    main()
