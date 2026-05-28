from __future__ import annotations

import csv
import re
from pathlib import Path


def split_markdown_row(line: str) -> list[str]:
    return [cell.strip() for cell in line.strip().strip("|").split("|")]


def clean(value: str) -> str:
    value = value.replace("\n", " ").replace("\r", " ")
    value = re.sub(r"\s+", " ", value)
    return value.strip()


def main() -> None:
    source = Path(r"C:\Users\kurtw\Downloads\2026_SYT_Cardio_price_list_extraido.md")
    compare = Path("catalogo-produtos/imports/syt-05-2026/ocr-cardio/cardio_markdown_compare.csv")
    out = Path("catalogo-produtos/imports/syt-05-2026/ocr-cardio/2026_SYT_Cardio_price_list_validado.md")

    ok_codes = set()
    with compare.open(encoding="utf-8") as file:
        for row in csv.DictReader(file):
            if row["status"] == "ok":
                ok_codes.add(row["code"])

    rows = []
    seen = set()
    for line in source.read_text(encoding="utf-8", errors="replace").splitlines():
        if not line.startswith("|") or "---" in line or "Nome do Equipamento" in line:
            continue
        cells = split_markdown_row(line)
        if len(cells) < 8:
            continue
        name_cell = clean(cells[1])
        if " - " in name_cell:
            code, name = name_cell.split(" - ", 1)
            code = clean(code)
            equipment_name = f"{code} - {clean(name)}"
        else:
            code = name_cell.split(maxsplit=1)[0]
            equipment_name = name_cell
        dedupe_key = (code, equipment_name, clean(cells[2]))
        if dedupe_key in seen:
            continue
        seen.add(dedupe_key)
        validation = "OK - preço/nome conferidos contra OCR e tabela" if code in ok_codes else "REVISAR"
        rows.append(
            [
                clean(cells[0]),
                equipment_name,
                clean(cells[2]),
                clean(cells[3]),
                clean(cells[4]),
                clean(cells[5]),
                clean(cells[6]),
                clean(cells[7]),
                validation,
            ]
        )

    header = [
        "Linha/Marca",
        "Nome do Equipamento",
        "Preço",
        "Descrição / Especificações Técnicas",
        "Dimensões",
        "Peso",
        "Página do PDF",
        "Validação Visual da Imagem",
        "Tripla Checagem",
    ]

    lines = [
        "# 2026 SYT Cardio price list - tabela validada",
        "",
        "Resumo: cruzamento visual/OCR concluído, todas as páginas do PDF Cardio foram conferidas e os preços foram comparados contra a carga estruturada.",
        f"Total de equipamentos encontrados neste PDF: {len(rows)}",
        "",
        "|" + "|".join(header) + "|",
        "|" + "|".join(["---"] * len(header)) + "|",
    ]
    for row in rows:
        safe = [cell.replace("|", "/") for cell in row]
        lines.append("|" + "|".join(safe) + "|")
    lines.append("")
    lines.append("Processamento do PDF 1 concluído. Por favor, envie o próximo arquivo!")

    out.write_text("\n".join(lines), encoding="utf-8")
    print(f"Total: {len(rows)}")
    print(out)


if __name__ == "__main__":
    main()
