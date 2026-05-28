from __future__ import annotations

import csv
import json
import re
import shutil
from pathlib import Path

from PIL import Image


PROJECT_DIR = Path(r"C:\Users\kurtw\OneDrive\Documentos\New project\catalogo-produtos")
SEED_FILE = PROJECT_DIR / "imports" / "syt-05-2026" / "syt_seed_data.js"
NEW_IMAGES_DIR = PROJECT_DIR / "imports" / "syt-05-2026" / "excel-images" / "a7"
TARGET_DIR = PROJECT_DIR / "imports" / "syt-05-2026" / "product-images" / "a7-excel"
REPORT_FILE = PROJECT_DIR / "imports" / "syt-05-2026" / "excel-images" / "a7" / "_replace_if_larger_report.csv"


def load_seed() -> dict:
    text = SEED_FILE.read_text(encoding="utf-8")
    match = re.search(r"window\.CATALOGO_SEED_DATA\s*=\s*(\{.*\})\s*;?\s*$", text, re.S)
    if not match:
        raise RuntimeError("Nao consegui ler window.CATALOGO_SEED_DATA.")
    return json.loads(match.group(1))


def save_seed(data: dict) -> None:
    SEED_FILE.write_text(
        "window.CATALOGO_SEED_DATA = "
        + json.dumps(data, ensure_ascii=False, indent=2)
        + ";\n",
        encoding="utf-8",
    )


def dimensions(path: Path) -> tuple[int, int]:
    with Image.open(path) as image:
        return image.size


def rel_to_path(url: str) -> Path:
    clean = url.replace("\\", "/")
    if clean.startswith("./"):
        clean = clean[2:]
    return PROJECT_DIR / clean


def rel_from_project(path: Path) -> str:
    return "./" + path.relative_to(PROJECT_DIR).as_posix()


def product_line(product: dict, catalogs_by_id: dict[str, dict]) -> str:
    return catalogs_by_id.get(product.get("source_file_id"), {}).get("line_name", "")


def main() -> None:
    data = load_seed()
    catalogs_by_id = {catalog["id"]: catalog for catalog in data.get("catalogs", [])}

    TARGET_DIR.mkdir(parents=True, exist_ok=True)
    rows = []
    changed = 0

    for product in data.get("products", []):
        code = str(product.get("code") or "").strip().upper()
        if product_line(product, catalogs_by_id) != "A7":
            continue

        candidates = sorted(NEW_IMAGES_DIR.glob(f"{code}.*"))
        if not candidates:
            rows.append({"code": code, "status": "SEM_IMAGEM_NOVA"})
            continue

        new_path = candidates[0]
        old_url = product.get("image_url") or ""
        if not old_url:
            rows.append({"code": code, "status": "SEM_IMAGEM_ANTIGA", "new_file": new_path.name})
            continue

        old_path = rel_to_path(old_url)
        if not old_path.exists():
            rows.append(
                {
                    "code": code,
                    "status": "IMAGEM_ANTIGA_NAO_EXISTE",
                    "old_url": old_url,
                    "new_file": new_path.name,
                }
            )
            continue

        old_w, old_h = dimensions(old_path)
        new_w, new_h = dimensions(new_path)
        old_area = old_w * old_h
        new_area = new_w * new_h

        if new_area <= old_area:
            rows.append(
                {
                    "code": code,
                    "status": "MANTIDA_ANTIGA",
                    "old_url": old_url,
                    "old_size": f"{old_w}x{old_h}",
                    "new_file": new_path.name,
                    "new_size": f"{new_w}x{new_h}",
                }
            )
            continue

        target_path = TARGET_DIR / new_path.name
        shutil.copy2(new_path, target_path)
        new_url = rel_from_project(target_path)
        product["image_url"] = new_url
        product["gallery"] = [new_url]
        changed += 1

        rows.append(
            {
                "code": code,
                "status": "SUBSTITUIDA",
                "old_url": old_url,
                "old_size": f"{old_w}x{old_h}",
                "new_url": new_url,
                "new_size": f"{new_w}x{new_h}",
            }
        )

    with REPORT_FILE.open("w", newline="", encoding="utf-8") as handle:
        fieldnames = [
            "code",
            "status",
            "old_url",
            "old_size",
            "new_file",
            "new_url",
            "new_size",
        ]
        writer = csv.DictWriter(handle, fieldnames=fieldnames, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(rows)

    if changed:
        save_seed(data)

    print(f"Produtos A7 avaliados: {len(rows)}")
    print(f"Imagens substituidas: {changed}")
    print(f"Relatorio: {REPORT_FILE}")


if __name__ == "__main__":
    main()
