// Imports Bildmaster asset packs (unpacked ZIPs) into the app. Pass one or more pack folders:
//   node scripts/import-assets.mjs <pack> [<pack> …]
//
// Recognised content (searched anywhere below each folder):
//   bildmaster_{male,female}_v{2,3}_WEB.glb   → public/models/   character models     (git-ignored)
//   (raw Meshy exports go through scripts/optimize-character.mjs first)
//   forest_dungeon_{primary,mobile}.webp     → public/hero/     hero backgrounds     (git-ignored)
//   hologram_{male,female}_detailed_ref.webp  → public/hero/     texture references   (git-ignored)
//   bildmaster_*_hologram_v2.glb              → public/weapons/  class weapon models  (committed: original procedural designs)
//
// The character models, backgrounds and references are derived from or are images whose rights are not
// cleared for a public repo, so they stay local; `npm run offline` embeds whatever is installed.
// Without them the app falls back to its built-in body and plain background.
import { copyFileSync, mkdirSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const packs = process.argv.slice(2);
if (!packs.length) { console.error("Bitte Ordner angeben: node scripts/import-assets.mjs <paket-ordner> [...]"); process.exit(1); }

const RULES = [
  [/^bildmaster_(male|female)_v[23]_WEB\.glb$/, "public/models"],
  [/^forest_dungeon_(primary|mobile)\.webp$/, "public/hero"],
  [/^hologram_(male|female)_detailed_ref\.webp$/, "public/hero"],
  [/^bildmaster_[a-z_]+_hologram_v2\.glb$/, "public/weapons"],
];
const walk = (dir) => readdirSync(dir).flatMap((f) => {
  const p = path.join(dir, f);
  return statSync(p).isDirectory() ? walk(p) : [p];
});
let n = 0;
for (const pack of packs) {
  for (const file of walk(pack)) {
    const name = path.basename(file);
    const rule = RULES.find(([re]) => re.test(name));
    if (!rule) continue;
    mkdirSync(path.join(root, rule[1]), { recursive: true });
    copyFileSync(file, path.join(root, rule[1], name));
    console.log(`${rule[1]}/${name}`);
    n++;
  }
}
if (!n) { console.error("Keine bekannten Bildmaster-Dateien gefunden."); process.exit(1); }
