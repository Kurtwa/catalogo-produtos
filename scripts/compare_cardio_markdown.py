from __future__ import annotations

import argparse
import csv
import re
from pathlib import Path


PRICE_RE = re.compile(r"US\$\s*([0-9][0-9,.]*)", re.IGNORECASE)


def split_markdown_row(line: str) -> list[str]:
    return [cell.strip() for cell in line.strip().strip("|").split("|")]


def parse_markdown(md_file: Path) -> dict[str, dict]:
    rows = {}
    for line in md_file.read_text(encoding="utf-8", errors="replace").splitlines():
        if not line.startswith("|") or "---" in line or "Nome do Equipamento" in line:
            continue
        cells = split_markdown_row(line)
        if len(cells) < 4:
            continue
        name_cell = cells[1]
        price_cell = cells[2]
        if " - " in name_cell:
            code, name = name_cell.split(" - ", 1)
        else:
            parts = name_cell.split(maxsplit=1)
            code = parts[0]
            name = parts[1] if len(parts) > 1 else ""
        price = PRICE_RE.search(price_cell)
        if not price:
            continue
        rows[code.strip()] = {
            "code": code.strip(),
            "md_name": name.strip(),
            "md_price": price.group(1).replace(",", ""),
            "md_dimensions": cells[4] if len(cells) > 4 else "",
            "md_weight": cells[5] if len(cells) > 5 else "",
            "md_page": cells[6] if len(cells) > 6 else "",
        }
    return rows


def sort_code(code: str) -> tuple[str, int, str]:
    prefix = re.sub(r"\d.*", "", code)
    number = re.search(r"\d+", code)
    return prefix, int(number.group(0)) if number else 0, code


def main() -> None:
    parser = argparse.ArgumentParser(description="Compara Markdown extraido do Cardio com CSV importado.")
    parser.add_argument("markdown_file", type=Path)
    parser.add_argument("--base", type=Path, default=Path("catalogo-produtos/imports/syt-05-2026"))
    args = parser.parse_args()

    md_rows = parse_markdown(args.markdown_file)
    imported = {}
    with (args.base / "syt_products_pending.csv").open(encoding="utf-8") as file:
        for row in csv.DictReader(file):
            if row["category"] == "Cardio":
                imported[row["code"]] = row

    compare_rows = []
    for code in sorted(set(md_rows) | set(imported), key=sort_code):
        md = md_rows.get(code)
        product = imported.get(code)
        if md and product and md["md_price"] == product["original_price"]:
            status = "ok"
        elif md and product:
            status = "price_mismatch"
        elif md:
            status = "missing_in_import"
        else:
            status = "missing_in_markdown"
        compare_rows.append(
            {
                "status": status,
                "code": code,
                "markdown_name": md["md_name"] if md else "",
                "imported_name": product["name"] if product else "",
                "markdown_price": md["md_price"] if md else "",
                "imported_price": product["original_price"] if product else "",
                "markdown_page": md["md_page"] if md else "",
            }
        )

    out_file = args.base / "ocr-cardio/cardio_markdown_compare.csv"
    out_file.parent.mkdir(parents=True, exist_ok=True)
    with out_file.open("w", newline="", encoding="utf-8") as file:
        writer = csv.DictWriter(file, fieldnames=list(compare_rows[0].keys()))
        writer.writeheader()
        writer.writerows(compare_rows)

    summary = {}
    for row in compare_rows:
        summary[row["status"]] = summary.get(row["status"], 0) + 1
    print(summary)
    print(out_file)


if __name__ == "__main__":
    main()
