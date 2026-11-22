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
for (const dir of ["models", "hero", "weapons", "class-icons"]) {
  let files = [];
  try { files = readdirSync(path.join(root, "public", dir)); } catch { /* not installed */ }
  for (const f of files) {
    const mime = MIME[path.extname(f).slice(1)];
    if (mime) assets[`${dir}/${f}`] = `data:${mime};base64,${readFileSync(path.join(root, "public", dir, f)).toString("base64")}`;
  }
}
console.log(`Eingebettet: ${Object.keys(assets).length} Dateien (${Object.keys(assets).join(", ") || "keine"})`);
const html = `<!DOCTYPE html><html lang="de" class="h-full antialiased"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="theme-color" content="#03070f">
<title>Aion 2 BuildMaster (offline)</title><link rel="icon" href="data:image/svg+xml,${encodeURIComponent(icon)}">
<style>${css}</style></head><body class="min-h-full"><div id="root" class="min-h-full"></div>
<script>window.__BM_ASSETS__=${JSON.stringify(assets)};window.__BM_ICONS__=${JSON.stringify(icons)}</script>
<script>${js.outputFiles[0].text.replace(/<\/script/g, "<\\/script")}</script></body></html>`;
mkdirSync(path.join(root, "dist"), { recursive: true });
writeFileSync(path.join(root, "dist/aion2-buildmaster-offline.html"), html);
console.log(`dist/aion2-buildmaster-offline.html ${(html.length / 1024).toFixed(0)} KB`);
