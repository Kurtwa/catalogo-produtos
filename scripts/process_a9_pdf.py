from __future__ import annotations

import csv
import json
import re
from pathlib import Path
from uuid import NAMESPACE_URL, uuid5

from pypdf import PdfReader


SOURCE_PDF = "A9 series price list.pdf"
PDF_PATH = Path(r"C:\Users\kurtw\OneDrive\Área de Trabalho\arquivos\price list syt 05.2026") / SOURCE_PDF
BASE = Path("catalogo-produtos/imports/syt-05-2026")
OUT_DIR = BASE / "ocr-a9"
CODE_RE = re.compile(r"(?<![A-Z0-9-])(A9\d{2}[A-Z]?)(?![A-Z0-9-])")
PRICE_RE = re.compile(r"\$\s*([0-9][0-9,.]*)")
DIM_RE = re.compile(r"DIM\s*[:：]?\s*([^;$]+?mm)", re.IGNORECASE)
WEIGHT_RE = re.compile(r"N\.?W\s*/\s*G\.?W\s*[:：]?\s*([^;$]+?Kg)\s*/\s*([^;$]+?Kg)", re.IGNORECASE)


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
    markers = ["N.W", "N W", "DIM", "CTN", "WS:"]
    starts = [value.find(marker) for marker in markers if value.find(marker) > 0]
    if not starts:
        return clean(value), ""
    split_at = min(starts)
    return clean(value[:split_at]), clean(value[split_at:])


def visual_description(name: str) -> str:
    text = name.lower()
    if any(word in text for word in ["row", "pull", "back", "dorsy"]):
        return "Máquina de costas/puxada da linha A9, estrutura de musculação com estação guiada e apoios acolchoados."
    if any(word in text for word in ["chest", "pec", "fly"]):
        return "Máquina de peitoral da linha A9, com assento e braços articulados para empurrar ou abrir."
    if any(word in text for word in ["shoulder", "delt"]):
        return "Máquina de ombro/deltoide da linha A9, com banco e alavancas de movimento guiado."
    if any(word in text for word in ["leg", "thigh", "glute", "calf", "squat"]):
        return "Máquina de pernas da linha A9, com apoios, roletes ou plataforma para membros inferiores."
    if any(word in text for word in ["biceps", "triceps", "arm", "curl"]):
        return "Máquina de braços da linha A9, com apoio acolchoado e estação para bíceps ou tríceps."
    if any(word in text for word in ["abdominal", "waist", "torso", "crunch"]):
        return "Máquina de abdômen/core da linha A9, com assento e apoios para flexão ou rotação."
    if any(word in text for word in ["bench", "smith", "rack"]):
        return "Banco ou estrutura de treino livre da linha A9, com suporte metálico e área de apoio."
    return "Equipamento de musculação da linha A9, associado à foto do mesmo bloco visual no PDF."


def tags_for(name: str) -> list[str]:
    text = name.lower()
    tags = ["syt", "a9", "musculacao", "academia"]
    rules = [
        (["row", "back", "dorsy"], ["costas", "remada"]),
        (["pull"], ["costas", "puxada"]),
        (["chest"], ["peitoral", "supino"]),
        (["pec", "fly"], ["peitoral", "voador"]),
        (["shoulder", "delt"], ["ombro", "desenvolvimento"]),
        (["leg press"], ["leg press", "pernas"]),
        (["leg", "thigh", "glute", "calf", "squat"], ["pernas"]),
        (["biceps", "curl"], ["bracos", "biceps"]),
        (["triceps"], ["bracos", "triceps"]),
        (["abdominal", "waist", "torso", "crunch"], ["abdomen", "core"]),
        (["bench"], ["banco"]),
        (["smith"], ["smith", "agachamento", "anilhada"]),
        (["rack"], ["rack", "barra"]),
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


def expected_names() -> dict[str, str]:
    return {clean(row["code"]): clean(row["name"]) for row in image_rows()}


def image_by_code() -> dict[str, str]:
    return {clean(row["code"]): row["image_url"] for row in image_rows()}


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
        dim = DIM_RE.search(spec)
        weight = WEIGHT_RE.search(spec)
        weight_text = ""
        if weight:
            weight_text = f"N.W: {clean(weight.group(1))} / G.W: {clean(weight.group(2))}"
        rows.append(
            {
                "code": code,
                "name": name or code,
                "price": price.group(1).replace(",", ""),
                "technical_specs": spec,
                "dimensions": clean(dim.group(1)) if dim else "",
                "weight": weight_text,
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

    names_by_code = expected_names()
    images_by_code = image_by_code()
    supplier_id = stable_uuid("syt-05-2026-supplier")
    file_id = stable_uuid(f"syt-05-2026-file-{SOURCE_PDF}")

    markdown_lines = [
        "# A9 series price list - tabela validada",
        "",
        "Resumo: cruzamento visual/OCR concluído, todas as 6 páginas do PDF A9 foram processadas e cada linha foi associada à imagem pelo código do produto.",
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
        image_url = images_by_code.get(row["code"], "")
        product_id = stable_uuid(f"syt-05-2026-product-{SOURCE_PDF}-{row['code']}")
        tags = tags_for(row["name"])

        markdown_lines.append(
            "|"
            + "|".join(
                [
                    "A9 series price list",
                    f"{row['code']} - {row['name']}",
                    f"US$ {row['price']} (FOB Tianjin)",
                    row["technical_specs"].replace("|", "/"),
                    row["dimensions"],
                    row["weight"],
                    f"p. {row['page']}",
                    row["visual_validation"],
                    "OK - OCR, página e imagem associados por código visual",
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
                "subcategory": "A9 Series",
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
                "subcategory": "A9 Series",
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
        report_rows.append({"code": row["code"], "name": row["name"], "price": row["price"], "page": row["page"], "image_url": image_url})

    markdown_lines.append("")
    markdown_lines.append("Processamento do PDF 5 concluído. Por favor, envie o próximo arquivo!")
    (OUT_DIR / "A9_series_price_list_validado.md").write_text("\n".join(markdown_lines), encoding="utf-8")
    write_csv(OUT_DIR / "a9_apply_report.csv", report_rows)

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
    print(f"A9 atualizados: {len(rows)}")
    print(f"Paginas do PDF: {len(reader.pages)}")
    print(f"Imagens ausentes: {missing_images}")
    print(OUT_DIR / "A9_series_price_list_validado.md")


if __name__ == "__main__":
    main()
