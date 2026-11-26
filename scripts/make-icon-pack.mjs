// Builds the icon pack for the live site (not committed: NCSOFT icons stay out of the repo).
// Same icons as the offline file: every imported icon (public/item-icons), shrunk to 96 px WebP.
// Output: { files: { "<file>.webp-or-png": dataURL }, alias: { "<any name the app asks for>": "<file>" } }
// Usage: node scripts/make-icon-pack.mjs <out.json>   → upload it on the live site ("Icon-Paket hochladen").
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";

const root = path.resolve(import.meta.dirname, "..");
const out = process.argv[2] ?? path.join(root, "dist/buildmaster-icons.json");
let map = {};
try { map = JSON.parse(readFileSync(path.join(root, "data/icon-files.json"), "utf8")); } catch { /* none */ }
const files = {}, alias = {};
for (const [name, local] of Object.entries(map)) {
  const base = local.split("/").pop();
  if (!files[base]) {
    try {
      const buf = await sharp(path.join(root, "public", local)).resize(96, 96, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).webp({ quality: 82 }).toBuffer();
      files[base] = `data:image/webp;base64,${buf.toString("base64")}`;
    } catch { continue; }
  }
  if (name !== base) alias[name] = base;
}
writeFileSync(out, JSON.stringify({ kind: "buildmaster-icons", files, alias }));
console.log(`${out}: ${Object.keys(files).length} Icons, ${Object.keys(alias).length} Namen, ${(readFileSync(out).length / 1024 / 1024).toFixed(1)} MB`);
