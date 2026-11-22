// Prepares a rigged character (Meshy / Mixamo skeleton with skin weights) for the app.
//   node scripts/rig-character.mjs <male|female> <rigged.glb> [<textured.glb>]
//
// - scales mesh, skeleton and bind matrices together to the character height (feet stay on y = 0)
// - drops the animation clips (the app poses the skeleton itself) and simplifies to ~60k triangles
// - optional <textured.glb>: a static, textured export of the SAME character in the same pose (e.g. the
//   v3 model from optimize-character.mjs). Its detailed mesh and texture replace the rigged mesh, and the
//   skin weights are transferred from the nearest rigged vertices. The pose must match closely: the script
//   refuses when the two surfaces are more than a few centimetres apart.
// - a rig that already carries a colour texture keeps it (1024 px WebP); normal / PBR maps and tangents are dropped
// - a rig without finger bones first goes through scripts/add-fingers.mjs
// Output: public/models/bildmaster_<gender>_v4_RIG.glb (git-ignored like the other character files).
import { NodeIO, VertexLayout } from "@gltf-transform/core";
import { weld, simplify, dedup, prune, textureCompress } from "@gltf-transform/functions";
import { MeshoptSimplifier } from "meshoptimizer";
import sharp from "sharp";
import path from "node:path";

const [gender, rigFile, texFile] = process.argv.slice(2);
if (!["male", "female"].includes(gender) || !rigFile) {
  console.error("Aufruf: node scripts/rig-character.mjs <male|female> <rigged.glb> [<textured.glb>]");
  process.exit(1);
}
const HEIGHT = { male: 1.84, female: 1.73 }[gender];
const TARGET_TRIS = 60000;

const io = new NodeIO().setVertexLayout(VertexLayout.SEPARATE);
const doc = await io.read(rigFile);
const root = doc.getRoot();
const skin = root.listSkins()[0];
if (!skin) { console.error("Die Datei hat kein Skelett (keine Skin-Daten)."); process.exit(1); }
for (const a of root.listAnimations()) a.dispose();
const prim = root.listMeshes()[0].listPrimitives()[0];
if (prim.getAttribute("TANGENT")) prim.setAttribute("TANGENT", null);
for (const mat of root.listMaterials()) {
  mat.setNormalTexture(null); mat.setMetallicRoughnessTexture(null); mat.setOcclusionTexture(null); mat.setEmissiveTexture(null);
  mat.setMetallicFactor(0); mat.setRoughnessFactor(1);
}

// ---- scale everything to the character height ---------------------------------------
// the skinned vertices live in mesh space (the node transforms above them do not apply), so measure those
const pacc = prim.getAttribute("POSITION");
const k = HEIGHT / (pacc.getMax([0, 0, 0])[1] - pacc.getMin([0, 0, 0])[1]);
const scaleAttr = (acc) => { const a = acc.getArray(); for (let i = 0; i < a.length; i++) a[i] *= k; acc.setArray(a); };
for (const m of root.listMeshes()) for (const p of m.listPrimitives()) scaleAttr(p.getAttribute("POSITION"));
for (const n of root.listNodes()) n.setTranslation(n.getTranslation().map((x) => x * k));
{
  // inverse bind = inverse of the joint's world matrix; a uniform scale only scales its translation
  const ibm = skin.getInverseBindMatrices();
  const a = ibm.getArray();
  for (let i = 0; i < a.length; i += 16) { a[i + 12] *= k; a[i + 13] *= k; a[i + 14] *= k; }
  ibm.setArray(a);
}

// ---- optional: detailed textured mesh with transferred weights -------------------------
if (texFile) {
  const tdoc = await io.read(texFile);
  const tprim = tdoc.getRoot().listMeshes()[0].listPrimitives()[0];
  const TP = tprim.getAttribute("POSITION").getArray();
  const RP = prim.getAttribute("POSITION").getArray();
  const RJ = prim.getAttribute("JOINTS_0").getArray(), RW = prim.getAttribute("WEIGHTS_0").getArray();
  // place the textured mesh on the rigged one (same feet, same height, same centre)
  const bb = (X) => { const mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9]; for (let i = 0; i < X.length; i += 3) for (let j = 0; j < 3; j++) { mn[j] = Math.min(mn[j], X[i + j]); mx[j] = Math.max(mx[j], X[i + j]); } return [mn, mx]; };
  const [tn, tx] = bb(TP), [rn, rx] = bb(RP);
  const s = (rx[1] - rn[1]) / (tx[1] - tn[1]);
  const P = new Float32Array(TP.length);
  for (let i = 0; i < TP.length; i += 3) {
    P[i] = (TP[i] - (tn[0] + tx[0]) / 2) * s + (rn[0] + rx[0]) / 2;
    P[i + 1] = (TP[i + 1] - tn[1]) * s + rn[1];
    P[i + 2] = (TP[i + 2] - (tn[2] + tx[2]) / 2) * s + (rn[2] + rx[2]) / 2;
  }
  // nearest rigged vertices (grid hash), inverse-distance blend of their weights, keep the 4 strongest joints
  const cell = 0.025, grid = new Map();
  const key = (x, y, z) => `${Math.floor(x / cell)},${Math.floor(y / cell)},${Math.floor(z / cell)}`;
  for (let i = 0; i < RP.length; i += 3) { const kk = key(RP[i], RP[i + 1], RP[i + 2]); (grid.get(kk) ?? grid.set(kk, []).get(kk)).push(i / 3); }
  const n = P.length / 3, J = new Uint16Array(n * 4), W = new Float32Array(n * 4);
  const dists = [];
  for (let v = 0; v < n; v++) {
    const x = P[v * 3], y = P[v * 3 + 1], z = P[v * 3 + 2];
    const near = [];
    for (let r = 1; r <= 4 && near.length < 4; r++) {
      near.length = 0;
      const cx = Math.floor(x / cell), cy = Math.floor(y / cell), cz = Math.floor(z / cell);
      for (let dx = -r; dx <= r; dx++) for (let dy = -r; dy <= r; dy++) for (let dz = -r; dz <= r; dz++) {
        for (const j of grid.get(`${cx + dx},${cy + dy},${cz + dz}`) ?? []) near.push([Math.hypot(RP[j * 3] - x, RP[j * 3 + 1] - y, RP[j * 3 + 2] - z), j]);
      }
    }
    near.sort((a, b) => a[0] - b[0]);
    const use = near.slice(0, 4);
    dists.push(use[0]?.[0] ?? 1);
    const acc = new Map();
    for (const [d, j] of use) {
      const w = 1 / (d + 0.004);
      for (let c = 0; c < 4; c++) { const wj = RW[j * 4 + c]; if (wj > 0) acc.set(RJ[j * 4 + c], (acc.get(RJ[j * 4 + c]) ?? 0) + wj * w); }
    }
    const top = [...acc].sort((a, b) => b[1] - a[1]).slice(0, 4);
    const sum = top.reduce((m, t) => m + t[1], 0) || 1;
    top.forEach(([j, w], c) => { J[v * 4 + c] = j; W[v * 4 + c] = w / sum; });
  }
  dists.sort((a, b) => a - b);
  const p99 = dists[Math.floor(dists.length * 0.99)];
  console.log(`Gewichte übertragen: Abstand Median ${(dists[dists.length >> 1] * 100).toFixed(1)} cm, 99 % unter ${(p99 * 100).toFixed(1)} cm`);
  if (p99 > 0.06) { console.error("Die Modelle passen nicht aufeinander (andere Pose?). Abbruch."); process.exit(1); }
  const acc = (type, arr) => doc.createAccessor().setType(type).setArray(arr).setBuffer(root.listBuffers()[0]);
  prim.setAttribute("POSITION", acc("VEC3", P));
  prim.setAttribute("NORMAL", acc("VEC3", new Float32Array(tprim.getAttribute("NORMAL").getArray())));
  prim.setAttribute("TEXCOORD_0", acc("VEC2", new Float32Array(tprim.getAttribute("TEXCOORD_0").getArray())));
  prim.setAttribute("JOINTS_0", acc("VEC4", J));
  prim.setAttribute("WEIGHTS_0", acc("VEC4", W));
  prim.setIndices(acc("SCALAR", new Uint32Array(tprim.getIndices().getArray())));
  const timg = tprim.getMaterial()?.getBaseColorTexture();
  if (timg) {
    const tex = doc.createTexture("base").setImage(timg.getImage()).setMimeType(timg.getMimeType());
    const mat = prim.getMaterial() ?? doc.createMaterial("body");
    mat.setBaseColorTexture(tex).setMetallicFactor(0).setRoughnessFactor(1);
    prim.setMaterial(mat);
  }
}

const tris = () => (prim.getIndices()?.getCount() ?? 0) / 3;
const before = tris();
await MeshoptSimplifier.ready;
await doc.transform(
  weld(),
  simplify({ simplifier: MeshoptSimplifier, ratio: Math.min(1, TARGET_TRIS / before), error: 0.002, lockBorder: false }),
  dedup(),
  prune(),
  textureCompress({ encoder: sharp, targetFormat: "webp", resize: [1024, 1024], quality: 85 }),
);
const out = path.resolve(import.meta.dirname, "..", "public/models", `bildmaster_${gender}_v4_RIG.glb`);
await io.write(out, doc);
console.log(`${path.basename(out)}: ${Math.round(before)} → ${Math.round(tris())} Dreiecke, ${skin.listJoints().length} Knochen, Höhe ${HEIGHT} m${texFile ? ", mit Textur" : ""}`);
