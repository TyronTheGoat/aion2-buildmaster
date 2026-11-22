// Imports downloaded original icons into the app.
// Usage: node scripts/import-icons.mjs <folder of the unpacked download result>
// Supports both downloader formats:
//  - collect_and_download.py: output/catalog.json (items with item_id + icon_file) → data/gear-catalog.json
//  - download_icons.py:       output/manifest.json                                 → data/icon-manifest.json
// Copies icons/ to public/item-icons/ (git-ignored, the icons belong to NCSOFT) and rebuilds the catalog.
// An icon is only used when the catalog names its file for an item ID; filenames alone are never matched.
import { cpSync, existsSync, mkdirSync, copyFileSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const pack = process.argv[2];
if (!pack) { console.error("Bitte Ordner angeben: node scripts/import-icons.mjs <ordner>"); process.exit(1); }
const icons = path.join(pack, "icons");
const catalog = path.join(pack, "output/catalog.json"), manifest = path.join(pack, "output/manifest.json");
let mapped = 0;
if (existsSync(catalog)) {
  const data = JSON.parse(readFileSync(catalog, "utf8"));
  const items = Array.isArray(data) ? data : data.items ?? [];
  mapped = items.filter((i) => i.item_id && i.icon_file && existsSync(path.join(pack, i.icon_file))).length;
  console.log(`catalog.json: ${items.length} Items, davon ${mapped} mit zugeordnetem Icon`);
  if (mapped) copyFileSync(catalog, path.join(root, "data/gear-catalog.json"));
} else if (existsSync(manifest)) {
  copyFileSync(manifest, path.join(root, "data/icon-manifest.json"));
  mapped = 1;
}
if (!mapped) {
  console.error("Keine Zuordnung Item-ID → Icon gefunden. Es fehlt output/catalog.json aus dem Download-Lauf (mit icon_file pro Item).");
  process.exit(1);
}
mkdirSync(path.join(root, "public/item-icons"), { recursive: true });
if (existsSync(icons)) cpSync(icons, path.join(root, "public/item-icons"), { recursive: true });
execFileSync(process.execPath, [path.join(root, "scripts/build-item-catalog.mjs")], { stdio: "inherit" });
