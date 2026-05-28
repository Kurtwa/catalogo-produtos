from __future__ import annotations

import csv
import re
from pathlib import Path


CODE_RE = re.compile(r"(?<![A-Z0-9-])((?:ZF|SL|P|Q|T)\d{1,4}(?:-\d)?)(?![A-Z0-9-])")
PRICE_RE = re.compile(r"\$\s*([0-9][0-9,.]*)")


def clean_text(value: str) -> str:
    return re.sub(r"\s+", " ", value.replace("\n", " ")).strip()


def parse_ocr(text: str) -> dict[str, dict]:
    text = clean_text(text)
    matches = list(CODE_RE.finditer(text))
    rows = {}
    for index, match in enumerate(matches):
        code = match.group(1)
        start = match.end()
        end = matches[index + 1].start() if index + 1 < len(matches) else min(len(text), start + 900)
        block = text[start:end]
        price = PRICE_RE.search(block)
        if not price:
            continue
        name = re.split(r"\bN\.W\b|\bDIM\b|\$", block, maxsplit=1)[0].strip(" :-")
        rows[code] = {
            "code": code,
            "ocr_name": name[:120],
            "ocr_price": price.group(1).replace(",", ""),
            "ocr_block": block[:500],
        }
    return rows


def main() -> None:
    base = Path("catalogo-produtos/imports/syt-05-2026")
    ocr_file = base / "ocr-cardio/cardio_ocr.txt"
    products_file = base / "syt_products_pending.csv"
    out_file = base / "ocr-cardio/cardio_ocr_compare.csv"

    ocr_rows = parse_ocr(ocr_file.read_text(encoding="utf-8", errors="replace"))
    imported = {}
    with products_file.open(encoding="utf-8") as file:
        for row in csv.DictReader(file):
            if row["category"] == "Cardio":
                imported[row["code"]] = row

    codes = sorted(set(ocr_rows) | set(imported), key=lambda code: (re.sub(r"\d.*", "", code), int(re.search(r"\d+", code).group(0)), code))
    rows = []
    for code in codes:
        ocr = ocr_rows.get(code)
        product = imported.get(code)
        imported_price = product["original_price"] if product else ""
        ocr_price = ocr["ocr_price"] if ocr else ""
        if product and ocr and imported_price == ocr_price:
            status = "ok"
        elif product and ocr:
            status = "price_mismatch"
        elif product:
            status = "missing_in_ocr"
        else:
            status = "missing_in_import"
        rows.append(
            {
                "status": status,
                "code": code,
                "imported_name": product["name"] if product else "",
                "ocr_name": ocr["ocr_name"] if ocr else "",
                "imported_price": imported_price,
                "ocr_price": ocr_price,
            }
        )

    with out_file.open("w", newline="", encoding="utf-8") as file:
        writer = csv.DictWriter(file, fieldnames=["status", "code", "imported_name", "ocr_name", "imported_price", "ocr_price"])
        writer.writeheader()
        writer.writerows(rows)

    summary = {}
    for row in rows:
        summary[row["status"]] = summary.get(row["status"], 0) + 1
    print(summary)
    print(out_file)


if __name__ == "__main__":
    main()
