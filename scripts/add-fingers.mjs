// Gives a rigged character without finger bones the finger skeleton of another rig of the same character.
//   node scripts/add-fingers.mjs <target.glb> <donor.glb> <out.glb>
//
// target: the rig to complete (e.g. a Meshy export with 24 Mixamo bones, no fingers)
// donor:  a rig of the same character with Mixamo finger bones (…HandThumb1-4, Index1-4, Middle, Ring, Pinky)
//
// Per hand, the donor's hand is laid onto the target's hand: rigid hand frame → hand frame, scaled by the
// forearm length ratio. The donor's finger bones are placed through that mapping under the target's Hand
// bone, and every target vertex that belongs to the hand takes the skin weights of the nearest donor vertices
// (joint names remapped). The script reports how closely the two hands match.
import { NodeIO, VertexLayout } from "@gltf-transform/core";
import * as THREE from "three";

const [targetFile, donorFile, outFile] = process.argv.slice(2);
if (!targetFile || !donorFile || !outFile) {
  console.error("Aufruf: node scripts/add-fingers.mjs <ziel.glb> <spender.glb> <ausgabe.glb>");
  process.exit(1);
}
const io = new NodeIO().setVertexLayout(VertexLayout.SEPARATE);
const [tdoc, ddoc] = await Promise.all([io.read(targetFile), io.read(donorFile)]);
const short = (n) => n.replace(/^mixamorig[:_]?/, "");
const FINGER = /^(Left|Right)Hand(Thumb|Index|Middle|Ring|Pinky)\d$/;

const tskin = tdoc.getRoot().listSkins()[0], dskin = ddoc.getRoot().listSkins()[0];
const tj = tskin.listJoints(), dj = dskin.listJoints();
if (tj.some((n) => FINGER.test(short(n.getName())))) { console.error("Das Ziel hat schon Finger-Knochen."); process.exit(1); }
const tByName = new Map(tj.map((n, i) => [short(n.getName()), i]));
const world = (node) => new THREE.Matrix4().fromArray(node.getWorldMatrix());
const rigid = (m) => {
  const p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3();
  m.decompose(p, q, s);
  return { p, q, s, m: new THREE.Matrix4().compose(p, q, new THREE.Vector3(1, 1, 1)) };
};
const node = (joints, name) => joints.find((n) => short(n.getName()) === name);

const tprim = tdoc.getRoot().listMeshes()[0].listPrimitives()[0];
const dprim = ddoc.getRoot().listMeshes()[0].listPrimitives()[0];
const TP = tprim.getAttribute("POSITION").getArray(), DP = dprim.getAttribute("POSITION").getArray();
const DJ = dprim.getAttribute("JOINTS_0").getArray(), DW = dprim.getAttribute("WEIGHTS_0").getArray();
const TJ0 = tprim.getAttribute("JOINTS_0").getArray(), TW0 = tprim.getAttribute("WEIGHTS_0").getArray();
const nT = TP.length / 3;
const TJ = new Uint16Array(nT * 4), TW = new Float32Array(nT * 4);
TJ.set(TJ0); TW.set(TW0);

// donor joint index → target joint index (fingers get new joints below; tips/ends fall back to their parent)
const ibm = Array.from(tskin.getInverseBindMatrices().getArray());
const remap = new Map();
const parentInTarget = (dnode) => {
  for (let n = dnode; n; n = n.getParentNode()) { const i = tByName.get(short(n.getName())); if (i !== undefined) return i; }
  return 0;
};

for (const side of ["Left", "Right"]) {
  const tHand = node(tj, `${side}Hand`), dHand = node(dj, `${side}Hand`);
  const tFore = node(tj, `${side}ForeArm`), dFore = node(dj, `${side}ForeArm`);
  const TH = rigid(world(tHand)), DH = rigid(world(dHand));
  const lenT = TH.p.distanceTo(rigid(world(tFore)).p), lenD = DH.p.distanceTo(rigid(world(dFore)).p);
  const sc = lenT / lenD;
  // donor space → target space around this hand
  const X = TH.m.clone().multiply(new THREE.Matrix4().makeScale(sc, sc, sc)).multiply(DH.m.clone().invert());
  const Xinv = X.clone().invert();
  const qX = TH.q.clone().multiply(DH.q.clone().invert());

  // finger bones, parents first (donor order is hierarchical)
  for (const [di, dn] of dj.entries()) {
    const name = short(dn.getName());
    if (!FINGER.test(name) || !name.startsWith(side)) continue;
    const D = rigid(world(dn));
    const pos = D.p.clone().applyMatrix4(X);
    const rot = qX.clone().multiply(D.q);
    const desired = new THREE.Matrix4().compose(pos, rot, TH.s.clone()); // same world scale as the hand
    const dParent = dn.getParentNode();
    const pName = short(dParent.getName());
    const parentNode = tByName.has(pName) ? tskin.listJoints()[tByName.get(pName)] : tdoc.getRoot().listNodes().find((n) => n.getName() === dParent.getName());
    const local = world(parentNode).invert().multiply(desired);
    const lp = new THREE.Vector3(), lq = new THREE.Quaternion(), ls = new THREE.Vector3();
    local.decompose(lp, lq, ls);
    const nn = tdoc.createNode(dn.getName()).setTranslation(lp.toArray()).setRotation(lq.toArray()).setScale(ls.toArray());
    parentNode.addChild(nn);
    tskin.addJoint(nn);
    const idx = tskin.listJoints().length - 1;
    tByName.set(name, idx);
    remap.set(di, idx);
    ibm.push(...desired.clone().invert().toArray());
  }

  // hand vertices take the donor's weights (nearest donor vertices in the mapped space)
  const handIdx = tByName.get(`${side}Hand`);
  const cell = 0.01 / Math.max(sc, 1e-3), grid = new Map();
  const key = (x, y, z) => `${Math.floor(x / cell)},${Math.floor(y / cell)},${Math.floor(z / cell)}`;
  const dHandIdx = dj.indexOf(dHand);
  for (let i = 0; i < DP.length / 3; i++) {
    let w = 0;
    for (let c = 0; c < 4; c++) { const j = DJ[i * 4 + c]; if (j === dHandIdx || FINGER.test(short(dj[j].getName()))) w += DW[i * 4 + c]; }
    if (w < 0.05) continue;
    const k = key(DP[i * 3], DP[i * 3 + 1], DP[i * 3 + 2]);
    (grid.get(k) ?? grid.set(k, []).get(k)).push(i);
  }
  const v = new THREE.Vector3();
  const dists = [];
  for (let i = 0; i < nT; i++) {
    let wh = 0;
    for (let c = 0; c < 4; c++) if (TJ0[i * 4 + c] === handIdx) wh += TW0[i * 4 + c];
    if (wh < 0.25) continue;
    v.set(TP[i * 3], TP[i * 3 + 1], TP[i * 3 + 2]).applyMatrix4(Xinv);
    const cx = Math.floor(v.x / cell), cy = Math.floor(v.y / cell), cz = Math.floor(v.z / cell);
    const near = [];
    for (let r = 1; r <= 3 && near.length < 3; r++) {
      near.length = 0;
      for (let dx = -r; dx <= r; dx++) for (let dy = -r; dy <= r; dy++) for (let dz = -r; dz <= r; dz++)
        for (const j of grid.get(`${cx + dx},${cy + dy},${cz + dz}`) ?? []) near.push([Math.hypot(DP[j * 3] - v.x, DP[j * 3 + 1] - v.y, DP[j * 3 + 2] - v.z), j]);
    }
    if (!near.length) continue;
    near.sort((a, b) => a[0] - b[0]);
    dists.push(near[0][0] * sc);
    const acc = new Map();
    for (const [d, j] of near.slice(0, 3)) {
      const w = 1 / (d + 0.002);
      for (let c = 0; c < 4; c++) {
        const dw = DW[j * 4 + c]; if (dw <= 0) continue;
        const djx = DJ[j * 4 + c];
        if (!remap.has(djx)) remap.set(djx, parentInTarget(dj[djx]));
        const t = remap.get(djx);
        acc.set(t, (acc.get(t) ?? 0) + dw * w);
      }
    }
    // keep the wrist blend of the target: the donor's weights only replace the hand's share
    const own = new Map();
    for (let c = 0; c < 4; c++) if (TJ0[i * 4 + c] !== handIdx && TW0[i * 4 + c] > 0) own.set(TJ0[i * 4 + c], TW0[i * 4 + c]);
    const sumAcc = [...acc.values()].reduce((a, b) => a + b, 0) || 1;
    for (const [j, w] of acc) own.set(j, (own.get(j) ?? 0) + (w / sumAcc) * wh);
    const top = [...own].sort((a, b) => b[1] - a[1]).slice(0, 4);
    const sum = top.reduce((a, t) => a + t[1], 0) || 1;
    for (let c = 0; c < 4; c++) { TJ[i * 4 + c] = top[c]?.[0] ?? 0; TW[i * 4 + c] = top[c] ? top[c][1] / sum : 0; }
  }
  dists.sort((a, b) => a - b);
  console.log(`${side === "Left" ? "linke" : "rechte"} Hand: ${dists.length} Punkte, Abstand Median ${(dists[dists.length >> 1] * 1000).toFixed(1)} mm, 90 % unter ${(dists[Math.floor(dists.length * 0.9)] * 1000).toFixed(1)} mm, Maßstab ${sc.toFixed(3)}`);
}

const buf = tdoc.getRoot().listBuffers()[0];
tskin.setInverseBindMatrices(tdoc.createAccessor().setType("MAT4").setArray(new Float32Array(ibm)).setBuffer(buf));
tprim.setAttribute("JOINTS_0", tdoc.createAccessor().setType("VEC4").setArray(TJ).setBuffer(buf));
tprim.setAttribute("WEIGHTS_0", tdoc.createAccessor().setType("VEC4").setArray(TW).setBuffer(buf));
await io.write(outFile, tdoc);
console.log(`${outFile}: ${tskin.listJoints().length} Knochen`);
