const fs = require("node:fs");
const path = require("node:path");
const { createWorker, PSM } = require("tesseract.js");

const sourceDir = process.argv[2];
const outDir = process.argv[3] || path.join("imports", "syt-05-2026", "ocr-cardio");

if (!sourceDir) {
  console.error("Uso: node ocr_smallpdf_cardio.js <pasta-imagens> <saida>");
  process.exit(1);
}

function pageNumber(fileName) {
  const match = fileName.match(/imagens-(\d+)\.jpg$/i);
  return match ? Number(match[1]) : 0;
}

async function main() {
  fs.mkdirSync(outDir, { recursive: true });
  const files = fs
    .readdirSync(sourceDir)
    .filter((name) => name.toLowerCase().endsWith(".jpg"))
    .sort((a, b) => pageNumber(a) - pageNumber(b));

  const worker = await createWorker("eng");
  await worker.setParameters({
    tessedit_pageseg_mode: PSM.AUTO,
    preserve_interword_spaces: "1",
  });

  const rows = [];
  let fullText = "";

  for (const file of files) {
    const imagePath = path.join(sourceDir, file);
    const { data } = await worker.recognize(imagePath);
    const page = pageNumber(file) + 1;
    const text = data.text.replace(/\r/g, "");
    fullText += `\n\n===== PAGE ${page}: ${file} =====\n\n${text}`;
    rows.push({
      page,
      file,
      confidence: Number(data.confidence || 0).toFixed(2),
      chars: text.length,
      sample: text.replace(/\s+/g, " ").slice(0, 220),
    });
    console.log(`OCR page ${page}/${files.length}: ${file} (${rows.at(-1).confidence}%)`);
  }

  await worker.terminate();

  fs.writeFileSync(path.join(outDir, "cardio_ocr.txt"), fullText.trim() + "\n", "utf8");
  fs.writeFileSync(
    path.join(outDir, "cardio_ocr_summary.csv"),
    ["page,file,confidence,chars,sample", ...rows.map((row) => [
      row.page,
      `"${row.file.replaceAll('"', '""')}"`,
      row.confidence,
      row.chars,
      `"${row.sample.replaceAll('"', '""')}"`,
    ].join(","))].join("\n") + "\n",
    "utf8",
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
