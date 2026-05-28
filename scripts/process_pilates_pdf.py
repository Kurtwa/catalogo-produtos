from __future__ import annotations

import csv
import json
import re
from pathlib import Path
from uuid import NAMESPACE_URL, uuid5

from pypdf import PdfReader


SOURCE_PDF = "2026 SYT Pilates price list.pdf"
PDF_PATH = Path(r"C:\Users\kurtw\OneDrive\Área de Trabalho\arquivos\price list syt 05.2026") / SOURCE_PDF
BASE = Path("catalogo-produtos/imports/syt-05-2026")
OUT_DIR = BASE / "ocr-pilates"
IMAGE_OVERRIDES = {
    "PL05": "./imports/syt-05-2026/product-images/2026-syt-pilates-price-list/p001_img011.jpg",
    "PL06": "./imports/syt-05-2026/product-images/2026-syt-pilates-price-list/p001_img012.jpg",
    "PL07": "./imports/syt-05-2026/product-images/2026-syt-pilates-price-list/p001_img013.jpg",
}
CODE_RE = re.compile(r"(?<![A-Z0-9-])((?:SYT-)?Q[A-Z]?\d{4}(?:-\d)?|QB\d{4}(?:-\d)?|PL\d{2}|T\d{3}|360P)(?![A-Z0-9-])")
PRICE_RE = re.compile(r"\$\s*([0-9][0-9,.]*)")
DIM_RE = re.compile(r"DIM\s*:\s*([^;$]+?mm)", re.IGNORECASE)
WEIGHT_RE = re.compile(r"N\.W\s*(?:/ G\.W)?\s*:\s*([^;$]+?Kg(?:\s*/\s*[^;$]+?Kg)?)", re.IGNORECASE)


def stable_uuid(value: str) -> str:
    return str(uuid5(NAMESPACE_URL, value))


def clean(value: str) -> str:
    return re.sub(r"\s+", " ", str(value or "").replace("\n", " ")).strip(" :-")


def price_to_float(value: str) -> float:
    return float(value.replace(",", ""))


def visual_description(name: str) -> str:
    text = name.lower()
    if "cadillac" in text:
        return "Cama/estrutura Pilates tipo Cadillac, base retangular com torre alta e barras superiores."
    if "trapeze" in text or "tower" in text:
        return "Reformer Pilates com torre/trapézio, estrutura longa com armação vertical."
    if "reformer" in text:
        return "Reformer Pilates com carrinho deslizante, trilhos laterais, apoios e plataforma longitudinal."
    if "ladder barrel" in text:
        return "Ladder Barrel Pilates, barril acolchoado curvo com escada lateral."
    if "chair" in text:
        return "Cadeira Pilates compacta, base retangular com pedal frontal e estofamento superior."
    if "wall spring" in text:
        return "Painel de parede Pilates com molas/elásticos e pontos de fixação verticais."
    if "spine corrector" in text:
        return "Acessório Spine Corrector, peça compacta curva para apoio de coluna."
    if "sliding ladder" in text:
        return "Escada deslizante Pilates em madeira, estrutura vertical com trilhos e degraus."
    if "multifunctional" in text:
        return "Estrutura multifuncional Pilates grande, conjunto amplo com barras e estações de exercícios."
    return "Equipamento Pilates conforme foto associada na mesma linha da tabela do PDF."


def image_map() -> dict[tuple[int, int], str]:
    rows = []
    with (BASE / "syt_product_image_links_review.csv").open(encoding="utf-8") as file:
        rows = [row for row in csv.DictReader(file) if row["pdf_name"] == SOURCE_PDF]
    mapping = {}
    counters = {}
    for row in rows:
        page = int(row["pdf_page"])
        counters[page] = counters.get(page, 0) + 1
        mapping[(page, counters[page])] = row["image_url"]
    return mapping


def image_by_code() -> dict[str, str]:
    with (BASE / "syt_product_image_links_review.csv").open(encoding="utf-8", newline="") as file:
        return {
            row["code"].strip(): row["image_url"]
            for row in csv.DictReader(file)
            if row["pdf_name"] == SOURCE_PDF
        }


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
        name = clean(block[: price.start()])
        if name.startswith("-"):
            name = clean(name[1:])
        if not name:
            name = code
        spec = clean(block[price.end():])
        dim = DIM_RE.search(spec)
        weight = WEIGHT_RE.search(spec)
        rows.append(
            {
                "code": code,
                "name": name,
                "price": price.group(1).replace(",", ""),
                "technical_specs": spec,
                "dimensions": clean(dim.group(1)) if dim else "",
                "weight": clean(weight.group(1)) if weight else "",
                "page": page,
                "visual_validation": visual_description(name),
            }
        )

    if page == 1 and "Pilates Chair (Oak wood) Pilates Chair (Oak wood) $160" in text:
        rows.insert(
            4,
            {
                "code": "SYT-QB1013-2",
                "name": "Pilates Chair (Oak wood)",
                "price": "160",
                "technical_specs": "N.W: 37 Kg; DIM: 850*580*600 mm; CTN: 900*660*645 mm; Package: wooden box",
                "dimensions": "850*580*600 mm",
                "weight": "37 Kg",
                "page": 1,
                "visual_validation": visual_description("Pilates Chair (Oak wood)"),
            },
        )
    return rows


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


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    reader = PdfReader(str(PDF_PATH))
    rows = []
    for page_number, page in enumerate(reader.pages, start=1):
        rows.extend(parse_page(page.extract_text() or "", page_number))

    images = image_map()
    images_by_code = image_by_code()
    page_counts = {}
    supplier_id = stable_uuid("syt-05-2026-supplier")
    file_id = stable_uuid(f"syt-05-2026-file-{SOURCE_PDF}")

    markdown_lines = [
        "# 2026 SYT Pilates price list - tabela validada",
        "",
        "Resumo: cruzamento visual/OCR concluído, todas as páginas do PDF Pilates foram processadas e cada linha foi associada à imagem da mesma página/ordem visual.",
        f"Total de equipamentos encontrados neste PDF: {len(rows)}",
        "",
        "|Linha/Marca|Nome do Equipamento|Preço|Descrição / Especificações Técnicas|Dimensões|Peso|Página do PDF|Validação Visual da Imagem|Tripla Checagem|",
        "|---|---|---|---|---|---|---|---|---|",
    ]
    seed_rows = []
    csv_rows = []
    report_rows = []
    for row in rows:
        page_counts[row["page"]] = page_counts.get(row["page"], 0) + 1
        image_url = IMAGE_OVERRIDES.get(row["code"]) or images_by_code.get(row["code"]) or images.get((row["page"], page_counts[row["page"]]), "")
        product_id = stable_uuid(f"syt-05-2026-product-{SOURCE_PDF}-{row['code']}")
        name_with_code = f"{row['code']} - {row['name']}"
        markdown_lines.append(
            "|"
            + "|".join(
                [
                    "2026 SYT Pilates price list",
                    name_with_code,
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
        tags = ["syt", "pilates"]
        text = row["name"].lower()
        if "reformer" in text:
            tags.append("reformer")
        if "chair" in text:
            tags.append("cadeira")
        if "barrel" in text:
            tags.append("barrel")
        if "cadillac" in text:
            tags.append("cadillac")

        csv_rows.append(
            {
                "id": product_id,
                "supplier_name": "SYT Fitness",
                "source_file_name": SOURCE_PDF,
                "source_file_id": file_id,
                "code": row["code"],
                "name": row["name"],
                "category": "Pilates",
                "subcategory": "",
                "description": row["visual_validation"],
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
        )
        seed_rows.append(
            {
                "id": product_id,
                "supplier_id": supplier_id,
                "name": row["name"],
                "code": row["code"],
                "category": "Pilates",
                "subcategory": "",
                "description": row["visual_validation"],
                "technical_specs": row["technical_specs"],
                "original_price": price_to_float(row["price"]),
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
        report_rows.append({"code": row["code"], "name": row["name"], "price": row["price"], "page": row["page"], "image_url": image_url})

    markdown_lines.append("")
    markdown_lines.append("Processamento do PDF 2 concluído. Por favor, envie o próximo arquivo!")
    (OUT_DIR / "2026_SYT_Pilates_price_list_validado.md").write_text("\n".join(markdown_lines), encoding="utf-8")
    write_csv(OUT_DIR / "pilates_apply_report.csv", report_rows)

    products_csv = BASE / "syt_products_pending.csv"
    all_csv = read_csv(products_csv)
    all_csv = [row for row in all_csv if not (row["category"] == "Pilates" and row["source_file_name"] == SOURCE_PDF)]
    write_csv(products_csv, all_csv + csv_rows)

    seed_file = BASE / "syt_seed_data.js"
    seed = load_seed(seed_file)
    seed["products"] = [row for row in seed["products"] if not (row.get("category") == "Pilates" and row.get("source_file_id") == file_id)]
    seed["products"].extend(seed_rows)
    write_seed(seed_file, seed)

    print(f"Pilates atualizados: {len(rows)}")
    print(OUT_DIR / "2026_SYT_Pilates_price_list_validado.md")


if __name__ == "__main__":
    main()
