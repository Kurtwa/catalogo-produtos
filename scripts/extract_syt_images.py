from __future__ import annotations

import argparse
import csv
import json
import re
from pathlib import Path

from PIL import Image
from pypdf import PdfReader


def safe_slug(value: str) -> str:
    value = re.sub(r"[^\w.-]+", "-", value, flags=re.UNICODE)
    return value.strip("-").lower()


def load_seed(seed_file: Path) -> dict:
    text = seed_file.read_text(encoding="utf-8")
    prefix = "window.CATALOGO_SEED_DATA = "
    if not text.startswith(prefix):
        raise ValueError(f"Arquivo nao parece ser seed JS: {seed_file}")
    return json.loads(text[len(prefix) :].strip().removesuffix(";"))


def write_seed(seed_file: Path, data: dict) -> None:
    seed_file.write_text(
        "window.CATALOGO_SEED_DATA = "
        + json.dumps(data, ensure_ascii=False, indent=2)
        + ";\n",
        encoding="utf-8",
    )


def extract_images(pdf_path: Path, out_dir: Path, rel_root: str) -> list[dict]:
    reader = PdfReader(str(pdf_path))
    pdf_slug = safe_slug(pdf_path.stem)
    pdf_out = out_dir / pdf_slug
    pdf_out.mkdir(parents=True, exist_ok=True)
    images = []

    for page_index, page in enumerate(reader.pages, start=1):
        for image_index, image_file in enumerate(page.images, start=1):
            try:
                image = image_file.image.convert("RGB")
            except Exception:
                continue

            width, height = image.size
            if width < 120 or height < 120:
                continue

            image.thumbnail((900, 900), Image.Resampling.LANCZOS)
            file_name = f"p{page_index:03d}_img{image_index:03d}.jpg"
            out_path = pdf_out / file_name
            image.save(out_path, "JPEG", quality=86, optimize=True)
            images.append(
                {
                    "pdf_name": pdf_path.name,
                    "page": page_index,
                    "image_index": image_index,
                    "width": width,
                    "height": height,
                    "file_path": str(out_path),
                    "image_url": f"{rel_root}/{pdf_slug}/{file_name}",
                }
            )
    return images


def main() -> None:
    parser = argparse.ArgumentParser(description="Extrai fotos dos PDFs da SYT e vincula aos produtos da carga local.")
    parser.add_argument("source_folder", type=Path)
    parser.add_argument("--import-dir", type=Path, default=Path("imports/syt-05-2026"))
    args = parser.parse_args()

    seed_file = args.import_dir / "syt_seed_data.js"
    products_csv = args.import_dir / "syt_products_pending.csv"
    images_dir = args.import_dir / "product-images"
    rel_root = "./imports/syt-05-2026/product-images"

    seed = load_seed(seed_file)
    images_by_pdf: dict[str, list[dict]] = {}
    all_images = []

    for pdf_path in sorted(args.source_folder.glob("*.pdf")):
        pdf_images = extract_images(pdf_path, images_dir, rel_root)
        images_by_pdf[pdf_path.name] = pdf_images
        all_images.extend(pdf_images)

    products_by_pdf: dict[str, list[dict]] = {}
    with products_csv.open(encoding="utf-8") as file:
        for row in csv.DictReader(file):
            products_by_pdf.setdefault(row["source_file_name"], []).append(row)

    product_by_id = {product["id"]: product for product in seed["products"]}
    mapping_rows = []

    for pdf_name, rows in products_by_pdf.items():
        images = images_by_pdf.get(pdf_name, [])
        if not images:
            continue

        ratio = len(images) / max(len(rows), 1)
        used_indexes = set()
        for product_index, product_row in enumerate(rows):
            image_index = min(int(round(product_index * ratio)), len(images) - 1)
            while image_index in used_indexes and image_index + 1 < len(images):
                image_index += 1
            used_indexes.add(image_index)
            image = images[image_index]
            product = product_by_id.get(product_row["id"])
            if product:
                product["image_url"] = image["image_url"]
            mapping_rows.append(
                {
                    "product_id": product_row["id"],
                    "code": product_row["code"],
                    "name": product_row["name"],
                    "pdf_name": pdf_name,
                    "pdf_page": image["page"],
                    "image_url": image["image_url"],
                    "mapping_method": "sequential-distributed",
                }
            )

    mapping_csv = args.import_dir / "syt_product_image_links_review.csv"
    with mapping_csv.open("w", newline="", encoding="utf-8") as file:
        writer = csv.DictWriter(file, fieldnames=["product_id", "code", "name", "pdf_name", "pdf_page", "image_url", "mapping_method"])
        writer.writeheader()
        writer.writerows(mapping_rows)

    write_seed(seed_file, seed)
    print(f"Imagens extraidas: {len(all_images)}")
    print(f"Produtos com imagem vinculada: {len(mapping_rows)}")
    print(f"Pasta: {images_dir}")
    print(f"CSV revisao: {mapping_csv}")
    print(f"Seed atualizado: {seed_file}")


if __name__ == "__main__":
    main()
