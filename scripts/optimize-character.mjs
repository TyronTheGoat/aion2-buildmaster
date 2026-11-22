// Turns a raw character GLB from Meshy (or a similar generator) into the web model the app loads.
//   node scripts/optimize-character.mjs <male|female> <input.glb>
//
// - puts the feet on y = 0, centres x/z and scales to the character height (metres)
// - welds and simplifies the mesh to roughly 60k triangles (silhouette and face stay readable)
// - keeps only the colour texture, downscaled to 1024 px WebP (the hologram shader only needs its luminance)
// Output: public/models/bildmaster_<gender>_v3_WEB.glb (git-ignored like the other character files).
import { NodeIO, VertexLayout } from "@gltf-transform/core";
import { weld, simplify, dedup, prune, textureCompress, getBounds } from "@gltf-transform/functions";
import { MeshoptSimplifier } from "meshoptimizer";
import sharp from "sharp";
import path from "node:path";

const [gender, input] = process.argv.slice(2);
if (!["male", "female"].includes(gender) || !input) {
  console.error("Aufruf: node scripts/optimize-character.mjs <male|female> <eingabe.glb>");
  process.exit(1);
}
const HEIGHT = { male: 1.84, female: 1.73 }[gender];
const TARGET_TRIS = 60000;

// separate attribute buffers: the app reads positions as one flat array
const io = new NodeIO().setVertexLayout(VertexLayout.SEPARATE);
const doc = await io.read(input);
const root = doc.getRoot();
const scene = root.listScenes()[0];

// bake node transforms into the vertices and normalise placement
const b = getBounds(scene);
const h = b.max[1] - b.min[1];
const s = HEIGHT / h;
const cx = (b.min[0] + b.max[0]) / 2, cz = (b.min[2] + b.max[2]) / 2;
for (const mesh of root.listMeshes()) {
  for (const prim of mesh.listPrimitives()) {
    const pos = prim.getAttribute("POSITION");
    const v = [0, 0, 0];
    for (let i = 0; i < pos.getCount(); i++) {
      pos.getElement(i, v);
      pos.setElement(i, [(v[0] - cx) * s, (v[1] - b.min[1]) * s, (v[2] - cz) * s]);
    }
    // the app computes its own smooth normals; normal maps and PBR maps are not used by the hologram
    for (const sem of ["TANGENT", "COLOR_0"]) if (prim.getAttribute(sem)) prim.setAttribute(sem, null);
  }
}
for (const node of root.listNodes()) { node.setTranslation([0, 0, 0]); node.setRotation([0, 0, 0, 1]); node.setScale([1, 1, 1]); }
for (const mat of root.listMaterials()) {
  mat.setNormalTexture(null); mat.setMetallicRoughnessTexture(null); mat.setOcclusionTexture(null); mat.setEmissiveTexture(null);
  mat.setMetallicFactor(0); mat.setRoughnessFactor(1);
}

const tris = () => root.listMeshes().flatMap((m) => m.listPrimitives()).reduce((n, p) => n + (p.getIndices()?.getCount() ?? 0) / 3, 0);
const before = tris();
await MeshoptSimplifier.ready;
await doc.transform(
  weld(),
  simplify({ simplifier: MeshoptSimplifier, ratio: Math.min(1, TARGET_TRIS / before), error: 0.002, lockBorder: false }),
  dedup(),
  prune(),
  textureCompress({ encoder: sharp, targetFormat: "webp", resize: [1024, 1024], quality: 82 }),
);
const out = path.resolve(import.meta.dirname, "..", "public/models", `bildmaster_${gender}_v3_WEB.glb`);
await io.write(out, doc);
console.log(`${path.basename(out)}: ${Math.round(before)} → ${Math.round(tris())} Dreiecke, Höhe ${HEIGHT} m`);
