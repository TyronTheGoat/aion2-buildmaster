// Imports the result of download_icons.py into the app.
// Usage: node scripts/import-icons.mjs <folder of the asset pack after the download>
// Copies icons/ to public/item-icons/ and output/manifest.json to data/icon-manifest.json,
// then rebuilds the item catalog. Only entries the downloader marked as saved are used.
import { cpSync, existsSync, mkdirSync, copyFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const pack = process.argv[2];
if (!pack) { console.error("Bitte Ordner angeben: node scripts/import-icons.mjs <assetpack-ordner>"); process.exit(1); }
const icons = path.join(pack, "icons"), manifest = path.join(pack, "output/manifest.json");
if (!existsSync(manifest)) { console.error(`Nicht gefunden: ${manifest} (wurde download_icons.py schon ausgeführt?)`); process.exit(1); }
mkdirSync(path.join(root, "public/item-icons"), { recursive: true });
if (existsSync(icons)) cpSync(icons, path.join(root, "public/item-icons"), { recursive: true });
copyFileSync(manifest, path.join(root, "data/icon-manifest.json"));
execFileSync(process.execPath, [path.join(root, "scripts/build-item-catalog.mjs")], { stdio: "inherit" });
