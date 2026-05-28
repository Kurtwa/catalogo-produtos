import csv
import json
import os
import re
from pathlib import Path

import openpyxl


PROJECT_ROOT = Path(__file__).resolve().parents[1]
IMPORT_ROOT = PROJECT_ROOT / "imports" / "syt-05-2026"
SEED_PATH = IMPORT_ROOT / "syt_seed_data.js"
PRICE_FOLDER = Path(os.environ.get("PRICE_FOLDER", r"C:\Users\kurtw\OneDrive\Área de Trabalho\arquivos\price list syt 05.2026"))
OUT_DIR = IMPORT_ROOT / "excel-check"


CONFIGS = [
    {"file": "2026 SYT Cardio price list .xlsx", "line": "Cardio", "header": 6, "code": 1, "name": 2, "price": 5, "spec": 4},
    {"file": "A7 SERIES PRICE LIST.xlsx", "line": "A7 Series", "header": 2, "code": 2, "name": 3, "price": 6, "spec": 5},
    {"file": "SYT A9 series price list.xlsx", "line": "A9 Series", "header": 2, "code": 1, "name": 3, "price": 7, "spec": 5},
    {"file": "K1 series price list .xlsx", "line": "K1 Series", "header": 2, "code": 1, "name": 3, "price": 7, "spec": 5},
    {"file": "K3 series price list.xlsx", "line": "K3 Series", "header": 2, "code": 1, "name": 3, "price": 7, "spec": 5},
    {"file": "K5 Series price list.xlsx", "line": "K5 Series", "header": 2, "code": 1, "name": 3, "price": 7, "spec": 5},
    {"file": "K6 Series price list.xlsx", "line": "K6 Series", "header": 2, "code": 2, "name": 3, "price": 8, "spec": 5},
    {"file": "L series price list.xlsx", "line": "L Series", "header": 4, "code": 2, "name": 3, "price": 6, "spec": 5},
    {"file": "P8 series price list_副本.xlsx", "line": "P8 Series", "header": 2, "code": 1, "name": 3, "price": 7, "spec": 5},
    {"file": "SQ series price list.xlsx", "line": "SQ Series", "header": 2, "code": 1, "name": 3, "price": 7, "spec": 5},
    {"file": "Gym Accessories Price List-SYT FITNESS.xlsx", "line": "Gym Accessories", "header": 5, "code": 1, "name": 2, "price": 7, "spec": 3},
]

SKIPPED = [
    {"file": "K8 Series price list.xls", "reason": "arquivo .xls antigo; precisa converter para .xlsx para leitura automatica"},
    {"file": "MTS Series Price(2).xls", "reason": "arquivo .xls antigo; precisa converter para .xlsx para leitura automatica"},
]


def load_seed():
    text = SEED_PATH.read_text(encoding="utf-8")
    payload = text.split("=", 1)[1].strip()
    if payload.endswith(";"):
        payload = payload[:-1]
    return json.loads(payload)


def clean_code(value):
    if value is None:
        return ""
    return re.sub(r"\s+", "", str(value).strip()).upper()


def parse_price(value):
    if value is None or value == "":
        return None
    if isinstance(value, (int, float)):
        return float(value)
    text = str(value).strip()
    match = re.search(r"\d+(?:[.,]\d+)?", text)
    if not match:
        return None
    return float(match.group(0).replace(",", "."))


def normalize_name(value):
    text = str(value or "").lower()
    text = re.sub(r"[\u3400-\u9fff]+", " ", text)
    text = text.replace("&", " and ").replace("+", " and ")
    text = re.sub(r"[^a-z0-9]+", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def line_of(product):
    return product.get("subcategory") or product.get("category") or ""


def read_excel_rows(config):
    path = PRICE_FOLDER / config["file"]
    if not path.exists():
        return [], [{"file": config["file"], "issue": "arquivo nao encontrado"}]
    wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
    ws = wb.worksheets[0]
    rows = []
    warnings = []
    last_code = ""
    for row_number, row in enumerate(ws.iter_rows(min_row=config["header"] + 1, values_only=True), start=config["header"] + 1):
        code = clean_code(row[config["code"] - 1] if len(row) >= config["code"] else "")
        name = row[config["name"] - 1] if len(row) >= config["name"] else ""
        price = parse_price(row[config["price"] - 1] if len(row) >= config["price"] else "")
        spec = row[config["spec"] - 1] if len(row) >= config["spec"] else ""
        if not code and not name and price is None:
            continue
        if not code and config["line"] == "Gym Accessories" and last_code:
            # Accessory rows often continue variants without repeating the model code.
            code = f"{last_code}__VAR{row_number}"
        if not code:
            continue
        last_code = code if "__VAR" not in code else last_code
        if price is None:
            warnings.append({"file": config["file"], "row": row_number, "issue": "preco vazio/invalido", "code": code})
        rows.append({
            "source_file": config["file"],
            "line": config["line"],
            "row": row_number,
            "code": code,
            "name": str(name or "").strip(),
            "price": price,
            "spec": str(spec or "").strip(),
        })
    wb.close()
    return rows, warnings


def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    seed = load_seed()
    catalog_products = seed["products"]
    catalog_by_code = {clean_code(p.get("code")): p for p in catalog_products if clean_code(p.get("code"))}

    excel_rows = []
    warnings = []
    for config in CONFIGS:
        rows, row_warnings = read_excel_rows(config)
        excel_rows.extend(rows)
        warnings.extend(row_warnings)

    compared = []
    for row in excel_rows:
        product = catalog_by_code.get(row["code"])
        if not product:
            compared.append({
                **row,
                "catalog_name": "",
                "catalog_line": "",
                "catalog_price": "",
                "status": "EXCEL_ONLY",
                "price_diff": "",
                "name_check": "",
            })
            continue
        catalog_price = parse_price(product.get("original_price"))
        price_diff = None if row["price"] is None or catalog_price is None else round(row["price"] - catalog_price, 2)
        excel_name = normalize_name(row["name"])
        catalog_name = normalize_name(product.get("name"))
        name_ok = bool(catalog_name and (catalog_name in excel_name or excel_name in catalog_name))
        line_ok = row["line"] == line_of(product) or (row["line"] == "Cardio" and product.get("category") == "Cardio")
        status_parts = []
        if not line_ok:
            status_parts.append("LINHA_DIFERENTE")
        if price_diff not in (None, 0):
            status_parts.append("PRECO_DIFERENTE")
        if not name_ok:
            status_parts.append("NOME_DIFERENTE")
        compared.append({
            **row,
            "catalog_name": product.get("name", ""),
            "catalog_line": line_of(product),
            "catalog_price": catalog_price,
            "status": "OK" if not status_parts else "|".join(status_parts),
            "price_diff": "" if price_diff is None else price_diff,
            "name_check": "OK" if name_ok else "REVISAR",
        })

    excel_codes = {row["code"] for row in excel_rows if "__VAR" not in row["code"]}
    checked_lines = {config["line"] for config in CONFIGS if config["line"] != "Gym Accessories"}
    catalog_missing = []
    for product in catalog_products:
        code = clean_code(product.get("code"))
        line = line_of(product) or product.get("category")
        if line in checked_lines and code not in excel_codes:
            catalog_missing.append({
                "code": code,
                "name": product.get("name", ""),
                "line": line,
                "catalog_price": product.get("original_price", ""),
                "status": "CATALOG_ONLY",
            })

    def write_csv(filename, rows, headers):
        path = OUT_DIR / filename
        with path.open("w", newline="", encoding="utf-8-sig") as handle:
            writer = csv.DictWriter(handle, fieldnames=headers)
            writer.writeheader()
            writer.writerows(rows)
        return path

    compared_headers = [
        "status", "line", "code", "name", "price", "catalog_name", "catalog_line",
        "catalog_price", "price_diff", "name_check", "source_file", "row", "spec",
    ]
    write_csv("excel_vs_catalog_comparacao.csv", compared, compared_headers)
    write_csv("catalogo_sem_linha_na_planilha.csv", catalog_missing, ["status", "line", "code", "name", "catalog_price"])
    write_csv("avisos_extracao_planilhas.csv", warnings, ["file", "row", "code", "issue"])

    summary_by_line = {}
    for item in compared:
        bucket = summary_by_line.setdefault(item["line"], {"excel": 0, "ok": 0, "price": 0, "name": 0, "excel_only": 0, "line_diff": 0})
        bucket["excel"] += 1
        if item["status"] == "OK":
            bucket["ok"] += 1
        if "PRECO_DIFERENTE" in item["status"]:
            bucket["price"] += 1
        if "NOME_DIFERENTE" in item["status"]:
            bucket["name"] += 1
        if item["status"] == "EXCEL_ONLY":
            bucket["excel_only"] += 1
        if "LINHA_DIFERENTE" in item["status"]:
            bucket["line_diff"] += 1

    report_lines = [
        "# Conferencia Excel x Catalogo",
        "",
        f"- Planilhas .xlsx processadas: {len(CONFIGS)}",
        f"- Linhas comparadas: {len(summary_by_line)}",
        f"- Registros extraidos das planilhas: {len(excel_rows)}",
        f"- Produtos do catalogo ausentes nas planilhas conferidas: {len(catalog_missing)}",
        f"- Arquivos .xls pulados: {len(SKIPPED)}",
        "",
        "## Resumo por linha",
        "",
        "| Linha | Excel | OK | Preco diferente | Nome diferente | So no Excel | Linha diferente |",
        "|---|---:|---:|---:|---:|---:|---:|",
    ]
    for line, bucket in sorted(summary_by_line.items()):
        report_lines.append(f"| {line} | {bucket['excel']} | {bucket['ok']} | {bucket['price']} | {bucket['name']} | {bucket['excel_only']} | {bucket['line_diff']} |")

    report_lines += [
        "",
        "## Arquivos pulados",
        "",
    ]
    for item in SKIPPED:
        report_lines.append(f"- {item['file']}: {item['reason']}")
    report_lines += [
        "",
        "## Arquivos gerados",
        "",
        "- excel_vs_catalog_comparacao.csv",
        "- catalogo_sem_linha_na_planilha.csv",
        "- avisos_extracao_planilhas.csv",
    ]
    (OUT_DIR / "relatorio_conferencia_excel.md").write_text("\n".join(report_lines), encoding="utf-8")
    print("\n".join(report_lines))


if __name__ == "__main__":
    main()
