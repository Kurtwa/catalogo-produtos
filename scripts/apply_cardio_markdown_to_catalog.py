from __future__ import annotations

import csv
import json
import re
from pathlib import Path
from uuid import NAMESPACE_URL, uuid5

from compare_cardio_markdown import parse_markdown


SOURCE_PDF = "2026 SYT Cardio price list.pdf"


def stable_uuid(value: str) -> str:
    return str(uuid5(NAMESPACE_URL, value))


def clean(value: str) -> str:
    return re.sub(r"\s+", " ", str(value or "").replace("\n", " ")).strip()


def load_seed(path: Path) -> dict:
    prefix = "window.CATALOGO_SEED_DATA = "
    text = path.read_text(encoding="utf-8")
    return json.loads(text[len(prefix) :].strip().removesuffix(";"))


def write_seed(path: Path, seed: dict) -> None:
    path.write_text("window.CATALOGO_SEED_DATA = " + json.dumps(seed, ensure_ascii=False, indent=2) + ";\n", encoding="utf-8")


def read_csv(path: Path) -> list[dict]:
    with path.open(encoding="utf-8") as file:
        return list(csv.DictReader(file))


def write_csv(path: Path, rows: list[dict]) -> None:
    with path.open("w", newline="", encoding="utf-8") as file:
        writer = csv.DictWriter(file, fieldnames=list(rows[0].keys()))
        writer.writeheader()
        writer.writerows(rows)


def image_map(base: Path) -> dict[tuple[int, int], str]:
    rows = read_csv(base / "syt_product_image_links_review.csv")
    by_pdf = [row for row in rows if row["pdf_name"] == SOURCE_PDF]
    mapping = {}
    counters = {}
    for row in by_pdf:
        page = int(row["pdf_page"])
        counters[page] = counters.get(page, 0) + 1
        mapping[(page, counters[page])] = row["image_url"]
    return mapping


def parse_validated_table(path: Path) -> list[dict]:
    rows = []
    for line in path.read_text(encoding="utf-8").splitlines():
        if not line.startswith("|") or "---" in line or "Nome do Equipamento" in line:
            continue
        cells = [cell.strip() for cell in line.strip().strip("|").split("|")]
        if len(cells) < 9:
            continue
        name_cell = cells[1]
        code, name = name_cell.split(" - ", 1) if " - " in name_cell else (name_cell.split()[0], name_cell)
        price = re.search(r"US\$\s*([0-9][0-9,.]*)", cells[2])
        page = re.search(r"(\d+)", cells[6])
        rows.append(
            {
                "code": clean(code),
                "name": clean(name),
                "price": price.group(1).replace(",", "") if price else "0",
                "description": clean(cells[7]),
                "technical_specs": clean("; ".join([cells[3], cells[4], cells[5]])),
                "dimensions": clean(cells[4].replace("DIM: ", "").split(";")[0]),
                "weight": clean(cells[5]),
                "page": int(page.group(1)) if page else 0,
                "visual_validation": clean(cells[7]),
            }
        )
    return rows


def main() -> None:
    base = Path("catalogo-produtos/imports/syt-05-2026")
    validated = base / "ocr-cardio/2026_SYT_Cardio_price_list_validado.md"
    products_csv = base / "syt_products_pending.csv"
    seed_file = base / "syt_seed_data.js"
    report = base / "ocr-cardio/cardio_apply_report.csv"

    md_rows = parse_validated_table(validated)
    img_by_page_order = image_map(base)
    supplier_id = stable_uuid("syt-05-2026-supplier")
    file_id = stable_uuid(f"syt-05-2026-file-{SOURCE_PDF}")

    csv_rows = read_csv(products_csv)
    non_cardio = [row for row in csv_rows if not (row["category"] == "Cardio" and row["source_file_name"] == SOURCE_PDF)]
    seed = load_seed(seed_file)
    seed["products"] = [row for row in seed["products"] if not (row.get("category") == "Cardio" and row.get("source_file_id") == file_id)]

    page_counts = {}
    new_csv_rows = []
    new_seed_rows = []
    report_rows = []
    for row in md_rows:
        page_counts[row["page"]] = page_counts.get(row["page"], 0) + 1
        image_url = img_by_page_order.get((row["page"], page_counts[row["page"]]), "")
        product_id = stable_uuid(f"syt-05-2026-product-{SOURCE_PDF}-{row['code']}")
        tags = ["syt", "cardio"]
        text = f"{row['name']} {row['description']}".lower()
        if "treadmill" in text:
            tags.append("esteira")
        if "curved" in text:
            tags.append("esteira curva")
        if "elliptical" in text:
            tags.append("eliptico")
        if "bike" in text:
            tags.extend(["bike", "bicicleta"])
        if "stair" in text:
            tags.extend(["escada", "simulador de escada"])

        csv_row = {
            "id": product_id,
            "supplier_name": "SYT Fitness",
            "source_file_name": SOURCE_PDF,
            "source_file_id": file_id,
            "code": row["code"],
            "name": row["name"],
            "category": "Cardio",
            "subcategory": "",
            "description": row["description"],
            "technical_specs": row["technical_specs"],
            "original_price": row["price"],
            "currency": "USD",
            "exchange_rate": "5.25",
            "multiplier_factor": "1.60",
            "markup": "2.00",
            "weight": "",
            "dimensions": row["dimensions"],
            "material": "",
            "tags": ",".join(dict.fromkeys(tags)),
            "status": "pendente",
        }
        new_csv_rows.append(csv_row)
        new_seed_rows.append(
            {
                "id": product_id,
                "supplier_id": supplier_id,
                "name": row["name"],
                "code": row["code"],
                "category": "Cardio",
                "subcategory": "",
                "description": row["description"],
                "technical_specs": row["technical_specs"],
                "original_price": float(row["price"]),
                "currency": "USD",
                "exchange_rate": 5.25,
                "multiplier_factor": 1.6,
                "markup": 2.0,
                "weight": None,
                "dimensions": row["dimensions"],
                "material": "",
                "tags": list(dict.fromkeys(tags)),
                "source_file_id": file_id,
                "status": "pendente",
                "image_url": image_url,
                "gallery": [image_url] if image_url else [],
                "source_page": row["page"],
                "visual_validation": row["visual_validation"],
            }
        )
        report_rows.append(
            {
                "code": row["code"],
                "name": row["name"],
                "price": row["price"],
                "page": row["page"],
                "image_url": image_url,
                "status": "updated_from_validated_md",
            }
        )

    write_csv(products_csv, non_cardio + new_csv_rows)
    seed["products"].extend(new_seed_rows)
    write_seed(seed_file, seed)
    write_csv(report, report_rows)
    print(f"Cardio atualizados: {len(new_seed_rows)}")
    print(report)


if __name__ == "__main__":
    main()
