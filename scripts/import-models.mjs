// Imports the hologram character models (GLB) into the app.
// Usage: node scripts/import-models.mjs <folder of the unpacked Bildmaster model pack>
// Copies models/bildmaster_{male,female}_v2_WEB.glb to public/models/.
// The models are derived from a reference image whose rights are not cleared for a public repo,
// so public/models/ is git-ignored: the app falls back to the built-in MakeHuman body without them,
// and `npm run offline` embeds them into the offline file when they are present.
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const pack = process.argv[2];
if (!pack) { console.error("Bitte Ordner angeben: node scripts/import-models.mjs <modellpaket-ordner>"); process.exit(1); }
mkdirSync(path.join(root, "public/models"), { recursive: true });
for (const g of ["male", "female"]) {
  const name = `bildmaster_${g}_v2_WEB.glb`;
  const src = [path.join(pack, "models", name), path.join(pack, name)].find((p) => existsSync(p));
  if (!src) { console.error(`Nicht gefunden: models/${name}`); process.exit(1); }
  copyFileSync(src, path.join(root, "public/models", name));
  console.log(`public/models/${name}`);
}
