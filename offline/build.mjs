// Builds a single self-contained HTML file (no server needed): dist/aion2-buildmaster-offline.html
import { build } from "esbuild";
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
// Inline local original icons (public/item-icons) so the offline file shows them without a server.
const inlineIcons = {
  name: "inline-item-icons",
  setup(b) {
    b.onLoad({ filter: /item-catalog\.json$/ }, (args) => {
      const items = JSON.parse(readFileSync(args.path, "utf8"));
      for (const it of items) {
        if (!it.icon?.startsWith("/item-icons/")) continue;
        const file = path.join(root, "public", decodeURIComponent(it.icon));
        try {
          const ext = path.extname(file).slice(1).replace("jpg", "jpeg");
          it.icon = `data:image/${ext};base64,${readFileSync(file).toString("base64")}`;
        } catch { it.icon = ""; }
      }
      return { contents: JSON.stringify(items), loader: "json" };
    });
  },
};
const js = await build({
  plugins: [inlineIcons],
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
const html = `<!DOCTYPE html><html lang="de" class="h-full antialiased"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="theme-color" content="#03070f">
<title>Aion 2 BuildMaster (offline)</title><link rel="icon" href="data:image/svg+xml,${encodeURIComponent(icon)}">
<style>${css}</style></head><body class="min-h-full"><div id="root" class="min-h-full"></div>
<script>${js.outputFiles[0].text.replace(/<\/script/g, "<\\/script")}</script></body></html>`;
mkdirSync(path.join(root, "dist"), { recursive: true });
writeFileSync(path.join(root, "dist/aion2-buildmaster-offline.html"), html);
console.log(`dist/aion2-buildmaster-offline.html ${(html.length / 1024).toFixed(0)} KB`);
