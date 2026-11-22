// Builds the Spiritmaster orb as a solid weapon model (GLB, same conventions as the weapon pack:
// origin = grip, +Y up, front = +Z, metres; one mesh per material group, emissive = hologram brightness).
//   node scripts/make-orb.mjs   →  public/weapons/bildmaster_orb_solid_v3.glb
//
// Design: a faceted crystal sphere held by a cast cradle with four curved claws, a tilted equator band
// with set gems, and a short drop finial under the cradle. Original design, no game assets.
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { Document, NodeIO, VertexLayout } from "@gltf-transform/core";
import path from "node:path";

const R = 0.078; // crystal radius
const CY = 0.105; // crystal centre above the grip

const groups = { frame: [], band: [], crystal: [], gems: [] };

// crystal: faceted, flat normals so it reads as a cut stone
{
  const g = new THREE.IcosahedronGeometry(R, 1).toNonIndexed();
  g.computeVertexNormals();
  g.translate(0, CY, 0);
  groups.crystal.push(g);
}
// cradle: a lathed cup under the crystal, with a ridge and a drop finial
{
  const pts = [
    [0.0, -0.045], [0.006, -0.04], [0.01, -0.028], [0.008, -0.016], [0.014, -0.006], [0.03, 0.004],
    [0.036, 0.012], [0.03, 0.018], [0.042, 0.03], [0.05, 0.042], [0.046, 0.046], [0.034, 0.036], [0.02, 0.026], [0.0, 0.022],
  ].map(([r, y]) => new THREE.Vector2(r, y));
  const g = new THREE.LatheGeometry(pts, 32);
  groups.frame.push(g);
}
// four claws: from the cup rim up and around the crystal, ending in points above its equator
for (let i = 0; i < 4; i++) {
  const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
  const dir = new THREE.Vector3(Math.cos(a), 0, Math.sin(a));
  const pts = [];
  for (let k = 0; k <= 10; k++) {
    const t = k / 10;
    const ang = -1.15 + t * 1.75; // from below the crystal to above its equator
    const r = R + 0.008 + 0.012 * Math.sin(t * Math.PI);
    pts.push(new THREE.Vector3(dir.x * Math.cos(ang) * r, CY + Math.sin(ang) * r, dir.z * Math.cos(ang) * r));
  }
  const curve = new THREE.CatmullRomCurve3(pts);
  const tube = new THREE.TubeGeometry(curve, 24, 0.0065, 8, false);
  // taper the claw towards its tip
  const p = tube.getAttribute("position");
  const v = new THREE.Vector3(), c = new THREE.Vector3();
  for (let j = 0; j < p.count; j++) {
    const seg = Math.floor(j / 9) / 24;
    curve.getPointAt(Math.min(1, seg), c);
    v.fromBufferAttribute(p, j).sub(c).multiplyScalar(1 - 0.75 * seg * seg).add(c);
    p.setXYZ(j, v.x, v.y, v.z);
  }
  tube.computeVertexNormals();
  groups.frame.push(tube);
  // claw tip
  const tip = new THREE.ConeGeometry(0.006, 0.02, 8);
  const end = pts[pts.length - 1], prev = pts[pts.length - 2];
  tip.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), end.clone().sub(prev).normalize()));
  tip.translate(end.x, end.y, end.z);
  groups.frame.push(tip);
}
// equator band, tilted, with four gems
{
  const tilt = new THREE.Euler(0.38, 0, 0.18);
  const q = new THREE.Quaternion().setFromEuler(tilt);
  const band = new THREE.TorusGeometry(R + 0.02, 0.005, 10, 72);
  band.rotateX(Math.PI / 2);
  band.applyQuaternion(q);
  band.translate(0, CY, 0);
  groups.band.push(band);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    const gem = new THREE.OctahedronGeometry(0.011, 0).toNonIndexed();
    gem.scale(1, 1.4, 1);
    gem.computeVertexNormals();
    const p = new THREE.Vector3(Math.cos(a) * (R + 0.02), 0, Math.sin(a) * (R + 0.02)).applyQuaternion(q);
    gem.translate(p.x, p.y + CY, p.z);
    groups.gems.push(gem);
  }
  // crown gem on top
  const top = new THREE.OctahedronGeometry(0.012, 0).toNonIndexed();
  top.scale(1, 1.6, 1);
  top.computeVertexNormals();
  top.translate(0, CY + R + 0.016, 0);
  groups.gems.push(top);
}

// emissive brightness per group (the app maps luminance to hologram strength)
const EMISSIVE = { frame: [0.14, 0.3, 0.4], band: [0.25, 0.48, 0.6], crystal: [0.12, 0.26, 0.36], gems: [0.6, 0.75, 0.85] };

const doc = new Document();
const buffer = doc.createBuffer();
const mesh = doc.createMesh("orb");
for (const [name, list] of Object.entries(groups)) {
  const g = mergeGeometries(list.map((x) => (x.index ? x.toNonIndexed() : x)), false);
  const pos = g.getAttribute("position").array, nor = g.getAttribute("normal").array;
  const mat = doc.createMaterial(name).setBaseColorFactor([0.1, 0.2, 0.3, 1]).setEmissiveFactor(EMISSIVE[name]).setMetallicFactor(0).setRoughnessFactor(1);
  const prim = doc.createPrimitive()
    .setAttribute("POSITION", doc.createAccessor().setType("VEC3").setArray(new Float32Array(pos)).setBuffer(buffer))
    .setAttribute("NORMAL", doc.createAccessor().setType("VEC3").setArray(new Float32Array(nor)).setBuffer(buffer))
    .setMaterial(mat);
  mesh.addPrimitive(prim);
}
doc.createScene("orb").addChild(doc.createNode("orb").setMesh(mesh));
const out = path.resolve(import.meta.dirname, "..", "public/weapons/bildmaster_orb_solid_v3.glb");
await new NodeIO().setVertexLayout(VertexLayout.SEPARATE).write(out, doc);
console.log(out);
