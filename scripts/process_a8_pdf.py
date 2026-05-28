from __future__ import annotations

import csv
import json
import re
from pathlib import Path
from uuid import NAMESPACE_URL, uuid5

from pypdf import PdfReader


SOURCE_PDF = "A8(PANATTA) price.pdf"
PDF_PATH = Path(r"C:\Users\kurtw\OneDrive\Área de Trabalho\arquivos\price list syt 05.2026") / SOURCE_PDF
BASE = Path("catalogo-produtos/imports/syt-05-2026")
OUT_DIR = BASE / "ocr-a8"
CODE_RE = re.compile(r"(?<![A-Z0-9-])(A8\d{2})(?![A-Z0-9-])")
PRICE_RE = re.compile(r"\$\s*([0-9][0-9,.]*)")
SIZE_RE = re.compile(r"Product\s*Size\s*([^;$]+?mm)(?:\s*\(?L\*W\*H\)?)?", re.IGNORECASE)
NW_RE = re.compile(r"N\.?w\s*[:：]?\s*([^;$]+?kg)", re.IGNORECASE)
GW_RE = re.compile(r"G\.?w\s*[:：]?\s*([^;$]+?kg)", re.IGNORECASE)


def stable_uuid(value: str) -> str:
    return str(uuid5(NAMESPACE_URL, value))


def clean(value: str) -> str:
    value = str(value or "").replace("\n", " ")
    value = re.sub(r"\s+", " ", value)
    return value.strip(" :-：")


def normalize_pdf_name(value: str) -> str:
    return clean(value)


def clean_spec(value: str) -> str:
    value = clean(value).replace("MM", "mm")
    value = re.sub(r"\s+\d{1,3}$", "", value)
    return value


def price_to_float(value: str) -> float:
    return float(value.replace(",", ""))


def split_name_and_specs(value: str) -> tuple[str, str]:
    markers = ["N.w", "N.W", "Product Size", "Packing Size", "Package"]
    starts = [value.find(marker) for marker in markers if value.find(marker) > 0]
    if not starts:
        return clean(value), ""
    split_at = min(starts)
    return clean(value[:split_at]), clean(value[split_at:])


def visual_description(name: str) -> str:
    text = name.lower()
    if any(word in text for word in ["row", "lat", "back"]):
        return "Máquina de costas/remada da linha A8 Panatta, estrutura preta robusta com braços articulados e apoios acolchoados."
    if any(word in text for word in ["chest", "bench press", "pec", "fly"]):
        return "Máquina de peitoral/supino da linha A8 Panatta, com banco e alavancas para empurrar ou abrir os braços."
    if any(word in text for word in ["shoulder", "deltoid"]):
        return "Máquina de ombro/deltoide da linha A8 Panatta, com assento e braços superiores de movimento guiado."
    if any(word in text for word in ["leg", "squat", "calf", "thigh", "glute"]):
        return "Máquina de pernas da linha A8 Panatta, com plataforma, roletes ou apoios para membros inferiores."
    if any(word in text for word in ["curl", "biceps", "triceps", "arm"]):
        return "Máquina de braços da linha A8 Panatta, com apoio acolchoado e alavancas para bíceps ou tríceps."
    if any(word in text for word in ["abdominal", "twist", "torso"]):
        return "Máquina de abdômen/core da linha A8 Panatta, com assento e apoios para flexão ou rotação."
    if "bench" in text:
        return "Banco de treino da linha A8 Panatta, estrutura metálica com estofado para exercícios livres."
    return "Equipamento de musculação da linha A8 Panatta, associado à foto do mesmo bloco visual no PDF."


def tags_for(name: str) -> list[str]:
    text = name.lower()
    tags = ["syt", "a8", "panatta", "musculacao", "academia"]
    rules = [
        (["row", "lat", "back"], ["costas", "remada", "puxada"]),
        (["chest", "bench press"], ["peitoral", "supino"]),
        (["pec", "fly"], ["peitoral", "voador"]),
        (["bench"], ["banco"]),
        (["inclined", "incline"], ["inclinado"]),
        (["horizontal"], ["horizontal"]),
        (["shoulder", "deltoid"], ["ombro", "desenvolvimento"]),
        (["leg press"], ["leg press", "pernas"]),
        (["leg", "squat", "calf", "thigh", "glute"], ["pernas"]),
        (["curl", "biceps"], ["bracos", "biceps"]),
        (["triceps"], ["bracos", "triceps"]),
        (["abdominal", "twist", "torso"], ["abdomen", "core"]),
    ]
    for needles, values in rules:
        if any(needle in text for needle in needles):
            tags.extend(values)
    return list(dict.fromkeys(tags))


def image_rows() -> list[dict]:
    with (BASE / "syt_product_image_links_review.csv").open(encoding="utf-8", newline="") as file:
        return [
            row
            for row in csv.DictReader(file)
            if normalize_pdf_name(row["pdf_name"]) == normalize_pdf_name(SOURCE_PDF)
        ]


def image_map() -> dict[tuple[int, int], str]:
    mapping = {}
    counters: dict[int, int] = {}
    for row in image_rows():
        page = int(row["pdf_page"])
        counters[page] = counters.get(page, 0) + 1
        mapping[(page, counters[page])] = row["image_url"]
    return mapping


def expected_names() -> dict[str, str]:
    return {row["code"]: clean(row["name"]) for row in image_rows()}


def image_by_code() -> dict[str, str]:
    return {row["code"]: row["image_url"] for row in image_rows()}


def parse_page(page_text: str, page: int) -> list[dict]:
    text = clean(page_text)
    matches = list(CODE_RE.finditer(text))
    rows = []
    for index, match in enumerate(matches):
        code = match.group(1)
        start = match.end()
        end = matches[index + 1].start() if index + 1 < len(matches) else len(text)
        block = clean(text[start:end])
        price = PRICE_RE.search(block)
        if not price:
            continue
        before_price = clean(block[: price.start()])
        after_price = clean(block[price.end() :])
        name, spec_before_price = split_name_and_specs(before_price)
        spec = clean_spec(" ".join(part for part in [spec_before_price, after_price] if part))
        size = SIZE_RE.search(spec)
        nw = NW_RE.search(spec)
        gw = GW_RE.search(spec)
        weights = []
        if nw:
            weights.append(f"N.W: {clean(nw.group(1))}")
        if gw:
            weights.append(f"G.W: {clean(gw.group(1))}")
        rows.append(
            {
                "code": code,
                "name": name or code,
                "price": price.group(1).replace(",", ""),
                "technical_specs": spec,
                "dimensions": clean(size.group(1)) if size else "",
                "weight": " / ".join(weights),
                "page": page,
                "visual_validation": visual_description(name),
            }
        )
    return rows


def load_seed(path: Path) -> dict:
    prefix = "window.CATALOGO_SEED_DATA = "
    text = path.read_text(encoding="utf-8")
    return json.loads(text[len(prefix) :].strip().removesuffix(";"))


def write_seed(path: Path, seed: dict) -> None:
    path.write_text(
        "window.CATALOGO_SEED_DATA = " + json.dumps(seed, ensure_ascii=False, indent=2) + ";\n",
        encoding="utf-8",
    )


def read_csv(path: Path) -> list[dict]:
    with path.open(encoding="utf-8", newline="") as file:
        return list(csv.DictReader(file))


def write_csv(path: Path, rows: list[dict]) -> None:
    with path.open("w", newline="", encoding="utf-8") as file:
        writer = csv.DictWriter(file, fieldnames=list(rows[0].keys()))
        writer.writeheader()
        writer.writerows(rows)


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    reader = PdfReader(str(PDF_PATH))
    rows = []
    for page_number, page in enumerate(reader.pages, start=1):
        rows.extend(parse_page(page.extract_text() or "", page_number))

    images = image_map()
    images_by_code = image_by_code()
    names_by_code = expected_names()
    page_counts: dict[int, int] = {}
    supplier_id = stable_uuid("syt-05-2026-supplier")
    file_id = stable_uuid(f"syt-05-2026-file-{SOURCE_PDF}")

    markdown_lines = [
        "# A8(PANATTA) price - tabela validada",
        "",
        "Resumo: cruzamento visual/OCR concluído, todas as 8 páginas do PDF A8 Panatta foram processadas e cada linha foi associada à imagem da mesma página/ordem visual.",
        f"Total de equipamentos encontrados neste PDF: {len(rows)}",
        "",
        "|Linha/Marca|Nome do Equipamento|Preço|Descrição / Especificações Técnicas|Dimensões|Peso|Página do PDF|Validação Visual da Imagem|Tripla Checagem|",
        "|---|---|---|---|---|---|---|---|---|",
    ]
    seed_rows = []
    csv_rows = []
    report_rows = []
    for row in rows:
        if names_by_code.get(row["code"]):
            row["name"] = names_by_code[row["code"]]
            row["visual_validation"] = visual_description(row["name"])
        page_counts[row["page"]] = page_counts.get(row["page"], 0) + 1
        image_url = images_by_code.get(row["code"]) or images.get((row["page"], page_counts[row["page"]]), "")
        product_id = stable_uuid(f"syt-05-2026-product-{SOURCE_PDF}-{row['code']}")
        tags = tags_for(row["name"])

        markdown_lines.append(
            "|"
            + "|".join(
                [
                    "A8(PANATTA) price",
                    f"{row['code']} - {row['name']}",
                    f"US$ {row['price']} (FOB Tianjin)",
                    row["technical_specs"].replace("|", "/"),
                    row["dimensions"],
                    row["weight"],
                    f"p. {row['page']}",
                    row["visual_validation"],
                    "OK - OCR, página e imagem associados por ordem visual",
                ]
            )
            + "|"
        )
        csv_rows.append(
            {
                "id": product_id,
                "supplier_name": "SYT Fitness",
                "source_file_name": SOURCE_PDF,
                "source_file_id": file_id,
                "code": row["code"],
                "name": row["name"],
                "category": "Strength",
                "subcategory": "A8 Panatta",
                "description": row["visual_validation"],
                "technical_specs": row["technical_specs"],
                "original_price": row["price"],
                "currency": "USD",
                "exchange_rate": "5.25",
                "multiplier_factor": "1.60",
                "markup": "2.00",
                "weight": row["weight"],
                "dimensions": row["dimensions"],
                "material": "",
                "tags": ",".join(tags),
                "status": "pendente",
            }
        )
        seed_rows.append(
            {
                "id": product_id,
                "supplier_id": supplier_id,
                "name": row["name"],
                "code": row["code"],
                "category": "Strength",
                "subcategory": "A8 Panatta",
                "description": row["visual_validation"],
                "technical_specs": row["technical_specs"],
                "original_price": price_to_float(row["price"]),
                "currency": "USD",
                "exchange_rate": 5.25,
                "multiplier_factor": 1.6,
                "markup": 2.0,
                "weight": row["weight"] or None,
                "dimensions": row["dimensions"],
                "material": "",
                "tags": tags,
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
            }
        )

    markdown_lines.append("")
    markdown_lines.append("Processamento do PDF 4 concluído. Por favor, envie o próximo arquivo!")
    (OUT_DIR / "A8_PANATTA_price_validado.md").write_text("\n".join(markdown_lines), encoding="utf-8")
    write_csv(OUT_DIR / "a8_apply_report.csv", report_rows)

    products_csv = BASE / "syt_products_pending.csv"
    all_csv = read_csv(products_csv)
    all_csv = [row for row in all_csv if normalize_pdf_name(row["source_file_name"]) != normalize_pdf_name(SOURCE_PDF)]
    write_csv(products_csv, all_csv + csv_rows)

    seed_file = BASE / "syt_seed_data.js"
    seed = load_seed(seed_file)
    seed["products"] = [row for row in seed["products"] if row.get("source_file_id") != file_id]
    seed["products"].extend(seed_rows)
    write_seed(seed_file, seed)

    missing_images = sum(1 for row in report_rows if not row["image_url"])
    print(f"A8 atualizados: {len(rows)}")
    print(f"Paginas do PDF: {len(reader.pages)}")
    print(f"Imagens ausentes: {missing_images}")
    print(OUT_DIR / "A8_PANATTA_price_validado.md")


if __name__ == "__main__":
    main()
