// Builds a single self-contained HTML file (no server needed): dist/aion2-buildmaster-offline.html
import { build } from "esbuild";
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
// Original icons: every downloaded icon (public/item-icons, see scripts/import-icons.mjs) is embedded once,
// shrunk to 96 px WebP, under its original NCSOFT file name and its local file name. The app resolves any
// icon URL (equipped gear from kisk.app, catalog, BiS) by file name, so icons show without network.
import sharp from "sharp";
let iconFiles = {};
try { iconFiles = JSON.parse(readFileSync(path.join(root, "data/icon-files.json"), "utf8")); } catch { /* no download imported */ }
// crafting icons (item ID → /item-icons/craft/<file>), embedded under their file name
try { for (const local of Object.values(JSON.parse(readFileSync(path.join(root, "data/craft-icon-files.json"), "utf8")))) iconFiles[local.split("/").pop()] = local; } catch { /* none yet */ }
const shrunk = new Map();
const icons = {};
async function shrink(local) {
  if (!shrunk.has(local)) {
    try {
      const buf = await sharp(path.join(root, "public", local)).resize(96, 96, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).webp({ quality: 82 }).toBuffer();
      shrunk.set(local, `data:image/webp;base64,${buf.toString("base64")}`);
    } catch { shrunk.set(local, ""); }
  }
  return shrunk.get(local);
}
for (const [name, local] of Object.entries(iconFiles)) {
  const data = await shrink(local);
  if (data) { icons[name] = data; icons[local.split("/").pop()] = data; }
}
console.log(`Original-Icons eingebettet: ${shrunk.size} Dateien, ${Object.keys(iconFiles).length} Namen`);
const js = await build({
  entryPoints: [path.join(root, "offline/main.tsx")],
  bundle: true, minify: true, write: false, format: "iife", jsx: "automatic",
  alias: { "@": path.join(root, "src") },
  define: { "process.env.NODE_ENV": '"production"', __BM_OFFLINE__: "true" },
});
// Reuse the Tailwind CSS from the Next build (run `next build` first).
const cssDir = path.join(root, ".next/static/chunks");
const css = readdirSync(cssDir, { recursive: true }).filter((f) => String(f).endsWith(".css"))
  .map((f) => readFileSync(path.join(cssDir, String(f)), "utf8")).join("\n");
const icon = readFileSync(path.join(root, "public/icon.svg"), "utf8");
// Embed the optional hologram assets (see scripts/import-assets.mjs) that are installed.
const MIME = { glb: "model/gltf-binary", webp: "image/webp", png: "image/png" };
const assets = {};
const installed = (dir, f) => { try { return readdirSync(path.join(root, "public", dir)).includes(f); } catch { return false; } };
// files the app never loads once their successor is installed (keeps the offline file smaller)
const superseded = (dir, f) => {
  // newer character versions replace older ones: v4 (rigged) > v3 (static, textured) > v2 (+ painted reference)
  const newer = (g, v) => (v < 4 && installed("models", `bildmaster_${g}_v4_RIG.glb`)) || (v < 3 && installed("models", `bildmaster_${g}_v3_WEB.glb`));
  const m = f.match(/^bildmaster_(male|female)_v([23])_WEB\.glb$/);
  if (dir === "models" && m) return newer(m[1], +m[2]);
  const r = f.match(/^hologram_(male|female)_detailed_ref\.webp$/);
  if (dir === "hero" && r) return newer(r[1], 2);
  if (dir === "weapons" && f === "bildmaster_orb_hologram_v2.glb") return installed("weapons", "bildmaster_orb_solid_v3.glb");
  return false;
};
for (const dir of ["class-icons"]) {
  let files = [];
  try { files = readdirSync(path.join(root, "public", dir)); } catch { /* not installed */ }
  for (const f of files.filter((x) => !superseded(dir, x))) {
    const mime = MIME[path.extname(f).slice(1)];
    if (mime) assets[`${dir}/${f}`] = `data:${mime};base64,${readFileSync(path.join(root, "public", dir, f)).toString("base64")}`;
  }
}
console.log(`Eingebettet: ${Object.keys(assets).length} Dateien (${Object.keys(assets).join(", ") || "keine"})`);
const html = `<!DOCTYPE html><html lang="de" class="h-full antialiased"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="theme-color" content="#0b0c10">
<title>Aion 2 BuildMaster</title><meta name="apple-mobile-web-app-title" content="Aion 2 BuildMaster"><meta name="application-name" content="Aion 2 BuildMaster"><link rel="icon" href="data:image/svg+xml,${encodeURIComponent(icon)}">
<style>${css}</style></head><body class="min-h-full"><div id="root" class="min-h-full"></div>
<script>window.__BM_ASSETS__=${JSON.stringify(assets)};window.__BM_ICONS__=${JSON.stringify(icons)}</script>
<script>${js.outputFiles[0].text.replace(/<\/script/g, "<\\/script")}</script></body></html>`;
mkdirSync(path.join(root, "dist"), { recursive: true });
writeFileSync(path.join(root, "dist/aion2-buildmaster-offline.html"), html);
console.log(`dist/aion2-buildmaster-offline.html ${(html.length / 1024).toFixed(0)} KB`);
