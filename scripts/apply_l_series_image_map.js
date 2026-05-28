const fs = require("fs");
const path = require("path");

const seedPath = path.resolve(__dirname, "..", "imports", "syt-05-2026", "syt_seed_data.js");
const basePath = "./imports/syt-05-2026/product-images/l-line-extracted";

const imageByCode = {
  L1001: "l-candidate-056.jpg",
  L1002: "l-candidate-073.jpg",
  L1003: "l-candidate-017.jpg",
  L1004: "l-candidate-042.jpg",
  L1005: "l-candidate-052.jpg",
  L1006: "l-candidate-066.jpg",
  L1007: "l-candidate-087.jpg",
  L1008: "l-candidate-007.jpg",
  L1009A: "l-candidate-014.jpg",
  L1016: "l-candidate-009.jpg",
  L1017: "l-candidate-055.jpg",
  L1017E: "l-candidate-002.jpg",
  L1017F: "l-candidate-004.jpg",
  L1018: "l-candidate-024.jpg",
  L1019: "l-candidate-058.jpg",
  L1021: "l-candidate-003.jpg",
  L1022: "l-candidate-070.jpg",
  L1023: "l-candidate-079.jpg",
  L1024: "l-candidate-035.jpg",
  L1025: "l-candidate-081.jpg",
  L1026: "l-candidate-027.jpg",
  L1027: "l-candidate-039.jpg",
  L1030: "l-candidate-028.jpg",
  L1031: "l-candidate-080.jpg",
  L1034: "l-candidate-064.jpg",
  L1035: "l-candidate-074.jpg",
  L1036: "l-candidate-023.jpg",
  L1037: "l-candidate-062.jpg",
  L1038: "l-candidate-031.jpg",
  L1039: "l-candidate-030.jpg",
  L1040: "l-candidate-029.jpg",
  L1041: "l-candidate-026.jpg",
  L1041A: "l-candidate-071.jpg",
  L1041B: "l-candidate-025.jpg",
  L1042: "l-candidate-043.jpg",
  L1042A: "l-candidate-067.jpg",
  L1042B: "l-candidate-001.jpg",
  L1043: "l-candidate-085.jpg",
  L1043B: "l-candidate-005.jpg",
  L1044: "l-candidate-065.jpg",
  L1044A: "l-candidate-038.jpg",
  L1045: "l-candidate-086.jpg",
  L1047: "l-candidate-011.jpg",
  L1048: "l-candidate-040.jpg",
  L1049: "l-candidate-018.jpg",
  L1050: "l-candidate-063.jpg",
  L1051: "l-candidate-078.jpg",
  L1052: "l-candidate-037.jpg",
  L1053: "l-candidate-076.jpg",
  L1054: "l-candidate-077.jpg",
  L1055: "l-candidate-061.jpg",
  L1055A: "l-candidate-057.jpg",
  L1056: "l-candidate-050.jpg",
  L1057: "l-candidate-012.jpg",
  L1061: "l-candidate-069.jpg",
  L1063: "l-candidate-048.jpg",
  L1065: "l-candidate-049.jpg",
  L1066: "l-candidate-082.jpg",
  L1067: "l-candidate-075.jpg",
  L1068: "l-candidate-022.jpg",
  L1069: "l-candidate-068.jpg",
  L1070: "l-candidate-054.jpg",
  L1070A: "l-candidate-021.jpg",
  L1071: "l-candidate-036.jpg",
  L1072: "l-candidate-016.jpg",
  L1073: "l-candidate-008.jpg",
  L1074: "l-candidate-010.jpg",
  L1075: "l-candidate-013.jpg",
  L1076: "l-candidate-033.jpg",
  L1077: "l-candidate-047.jpg",
  L1078: "l-candidate-041.jpg",
  L1079: "l-candidate-019.jpg",
  L1080: "l-candidate-045.jpg",
  L1081: "l-candidate-084.jpg",
  L1082: "l-candidate-032.jpg",
  L1083: "l-candidate-034.jpg",
  L1084A: "l-candidate-059.jpg",
  L1090: "l-candidate-083.jpg",
  L1090A: "l-candidate-015.jpg",
  L1090B: "l-candidate-072.jpg",
  L1090C: "l-candidate-060.jpg",
  L1091: "l-candidate-020.jpg",
  L1091A: "l-candidate-006.jpg",
  L1091C: "l-candidate-053.jpg",
  L1092: "l-candidate-046.jpg",
  L1092A: "l-candidate-044.jpg",
  L1093: "l-candidate-051.jpg",
};

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

let source = fs.readFileSync(seedPath, "utf8");
const applied = [];
const missing = [];

Object.entries(imageByCode).forEach(([code, file]) => {
  const nextImage = `${basePath}/${file}`;
  const pattern = new RegExp(`("code": "${escapeRegExp(code)}"[\\s\\S]*?"image_url": ")([^"]+)(",\\s*"gallery": \\[\\s*")([^"]+)(")`);
  const updated = source.replace(pattern, `$1${nextImage}$3${nextImage}$5`);
  if (updated === source) {
    missing.push(code);
  } else {
    source = updated;
    applied.push({ code, image_url: nextImage });
  }
});

fs.writeFileSync(seedPath, source, "utf8");

console.log(JSON.stringify({ applied: applied.length, missing, seedPath }, null, 2));
