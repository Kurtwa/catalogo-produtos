from __future__ import annotations

import csv
import json
import re
from pathlib import Path


RULES = [
    (["bench press rack", "olympic bench"], ["banco", "supino", "anilhada"]),
    (["bench press", "chest press"], ["supino", "peito"]),
    (["bench"], ["banco"]),
    (["flat bench"], ["banco reto"]),
    (["incline"], ["inclinado"]),
    (["decline"], ["declinado"]),
    (["plate loaded", "leverage", "free weight"], ["anilhada", "peso livre"]),
    (["smith"], ["smith", "agachamento", "anilhada"]),
    (["rack"], ["rack", "suporte"]),
    (["treadmill"], ["esteira"]),
    (["curved treadmill"], ["esteira curva"]),
    (["elliptical"], ["eliptico"]),
    (["upright bike", "recumbent bike", "spinning bike", "spin bike", "air bike"], ["bicicleta", "bike"]),
    (["stair climber"], ["escada", "simulador de escada"]),
    (["row", "rowing"], ["remada", "costas"]),
    (["lat pull", "pulldown", "pull down"], ["puxada", "costas"]),
    (["shoulder press"], ["ombro", "desenvolvimento"]),
    (["leg press"], ["leg press", "pernas"]),
    (["leg curl"], ["flexora", "posterior"]),
    (["leg extension"], ["extensora", "quadriceps"]),
    (["bicep"], ["biceps"]),
    (["tricep"], ["triceps"]),
    (["hip", "glute"], ["gluteo", "quadril"]),
    (["calf"], ["panturrilha"]),
    (["ab ", "abdominal", "crunch"], ["abdominal"]),
    (["squat"], ["agachamento"]),
    (["fly", "pec deck", "pectoral"], ["voador", "peitoral"]),
    (["crossover"], ["crossover", "polia"]),
    (["pulley"], ["polia"]),
    (["pilates"], ["pilates"]),
    (["pet"], ["pet"]),
]


def normalize(value: str) -> str:
    return re.sub(r"\s+", " ", value.lower()).strip()


def tags_for_product(product: dict) -> list[str]:
    text = normalize(" ".join(str(product.get(key, "")) for key in ["name", "category", "subcategory", "description", "technical_specs"]))
    tags = list(product.get("tags") or [])
    for needles, new_tags in RULES:
        if any(needle in text for needle in needles):
            tags.extend(new_tags)
    return list(dict.fromkeys(tag.strip().lower() for tag in tags if tag and tag.strip()))


def load_seed(path: Path) -> dict:
    prefix = "window.CATALOGO_SEED_DATA = "
    text = path.read_text(encoding="utf-8")
    return json.loads(text[len(prefix) :].strip().removesuffix(";"))


def write_seed(path: Path, seed: dict) -> None:
    path.write_text("window.CATALOGO_SEED_DATA = " + json.dumps(seed, ensure_ascii=False, indent=2) + ";\n", encoding="utf-8")


def sql_literal(value: str) -> str:
    return "'" + value.replace("'", "''") + "'"


def main() -> None:
    base = Path("catalogo-produtos/imports/syt-05-2026")
    seed_file = base / "syt_seed_data.js"
    products_csv = base / "syt_products_pending.csv"
    tag_sql = base / "syt_tag_enrichment.sql"

    seed = load_seed(seed_file)
    tag_by_id = {}
    for product in seed["products"]:
        product["tags"] = tags_for_product(product)
        tag_by_id[product["id"]] = product["tags"]
    write_seed(seed_file, seed)

    with products_csv.open(encoding="utf-8") as file:
        rows = list(csv.DictReader(file))
    for row in rows:
        current = row.get("tags", "").split(",")
        row["tags"] = ",".join(tag_by_id.get(row["id"], current))
    with products_csv.open("w", newline="", encoding="utf-8") as file:
        writer = csv.DictWriter(file, fieldnames=list(rows[0].keys()))
        writer.writeheader()
        writer.writerows(rows)

    lines = ["-- Tags auxiliares em portugues para busca."]
    for product in seed["products"]:
        tags = "array[" + ",".join(sql_literal(tag) for tag in product["tags"]) + "]"
        lines.append(f"update public.products set tags = {tags}, updated_at = now() where id = {sql_literal(product['id'])};")
    tag_sql.write_text("\n".join(lines) + "\n", encoding="utf-8")

    examples = []
    for product in seed["products"]:
        if any(tag in product["tags"] for tag in ["banco", "supino", "anilhada"]):
            examples.append((product["code"], product["name"], ", ".join(product["tags"])))
            if len(examples) >= 10:
                break
    print(f"Produtos enriquecidos: {len(seed['products'])}")
    for code, name, tags in examples:
        print(f"{code} | {name} | {tags}")


if __name__ == "__main__":
    main()
