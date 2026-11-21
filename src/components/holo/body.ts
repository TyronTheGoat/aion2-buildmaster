import * as THREE from "three";
import { MarchingCubes } from "three/addons/objects/MarchingCubes.js";
import type { Gender } from "@/lib/hologram";

/**
 * Smooth, one-piece base body built from a signed distance field (round cones and
 * ellipsoids blended with smooth-min), polygonised with marching cubes and skinned
 * to a small skeleton. Original geometry, no game assets.
 *
 * Bind pose: standing, facing +z, feet at y = 0, arms angled down and out.
 */

type V = [number, number, number];

/** Body regions that map to an equipment slot on the skin mesh (index = aSlot attribute). */
export const SKIN_SLOTS = ["helmet:0", "necklace:0", "torso:0", "shoulders:0", "gloves:0", "pants:0", "boots:0"] as const;
const S = { helmet: 0, necklace: 1, torso: 2, shoulders: 3, gloves: 4, pants: 5, boots: 6 };

export type BoneName =
  | "hips" | "spine" | "chest" | "neck" | "head"
  | "upperArm.L" | "foreArm.L" | "hand.L" | "upperArm.R" | "foreArm.R" | "hand.R"
  | "thigh.L" | "shin.L" | "foot.L" | "thigh.R" | "shin.R" | "foot.R";

interface BoneDef { name: BoneName; parent?: BoneName; pos: V; slot: number }

interface Prim {
  bone: number;
  kind: "cone" | "ell";
  a: V; b: V; r1: number; r2: number; // cone
  c: V; r: V; rotZ: number; rotX: number; // ellipsoid
  k: number; // smooth-min blend radius with the rest of the body
  bound: [number, number, number, number]; // bounding sphere
}

export interface BodyRig {
  bones: BoneDef[];
  /** bind-pose joint positions, handy for attaching gear */
  joint: Record<string, V>;
  armDir: Record<"L" | "R", V>;
}

export interface BodyData extends BodyRig {
  position: Float32Array;
  normal: Float32Array;
  skinIndex: Uint16Array;
  skinWeight: Float32Array;
  slot: Float32Array;
}

const add = (a: V, b: V): V => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a: V, s: number): V => [a[0] * s, a[1] * s, a[2] * s];

function rig(g: Gender) {
  const f = g === "f";
  const sh = f ? 0.165 : 0.19, shY = f ? 1.36 : 1.43;
  const hipX = f ? 0.088 : 0.092, hipY = f ? 0.88 : 0.92;
  const armAng = 0.42;
  const upper = f ? 0.27 : 0.29, fore = f ? 0.24 : 0.265;
  const joint: Record<string, V> = {};
  const armDir: Record<"L" | "R", V> = { L: [Math.sin(armAng), -Math.cos(armAng), 0], R: [-Math.sin(armAng), -Math.cos(armAng), 0] };
  for (const side of ["L", "R"] as const) {
    const sx = side === "L" ? 1 : -1;
    const d = armDir[side];
    joint[`shoulder.${side}`] = [sx * sh, shY, -0.005];
    joint[`elbow.${side}`] = add(joint[`shoulder.${side}`], mul(d, upper));
    joint[`wrist.${side}`] = add(joint[`elbow.${side}`], mul(d, fore));
    joint[`hip.${side}`] = [sx * hipX, hipY, 0];
    joint[`knee.${side}`] = [sx * (hipX + 0.012), f ? 0.48 : 0.5, 0.012];
    joint[`ankle.${side}`] = [sx * (hipX + 0.02), 0.085, -0.012];
  }
  joint.hips = [0, hipY + 0.03, 0];
  joint.spine = [0, f ? 1.06 : 1.1, 0];
  joint.chest = [0, f ? 1.2 : 1.25, 0];
  joint.neck = [0, f ? 1.41 : 1.48, -0.005];
  joint.head = [0, f ? 1.53 : 1.6, 0.0];
  const bones: BoneDef[] = [
    { name: "hips", pos: joint.hips, slot: S.pants },
    { name: "spine", parent: "hips", pos: joint.spine, slot: S.torso },
    { name: "chest", parent: "spine", pos: joint.chest, slot: S.torso },
    { name: "neck", parent: "chest", pos: joint.neck, slot: S.necklace },
    { name: "head", parent: "neck", pos: joint.head, slot: S.helmet },
  ];
  for (const side of ["L", "R"] as const) {
    bones.push(
      { name: `upperArm.${side}`, parent: "chest", pos: joint[`shoulder.${side}`], slot: S.shoulders },
      { name: `foreArm.${side}`, parent: `upperArm.${side}`, pos: joint[`elbow.${side}`], slot: S.gloves },
      { name: `hand.${side}`, parent: `foreArm.${side}`, pos: joint[`wrist.${side}`], slot: S.gloves },
      { name: `thigh.${side}`, parent: "hips", pos: joint[`hip.${side}`], slot: S.pants },
      { name: `shin.${side}`, parent: `thigh.${side}`, pos: joint[`knee.${side}`], slot: S.boots },
      { name: `foot.${side}`, parent: `shin.${side}`, pos: joint[`ankle.${side}`], slot: S.boots },
    );
  }
  return { bones, joint, armDir, f };
}

function primitives(g: Gender) {
  const { bones, joint, armDir, f } = rig(g);
  const bi = (n: BoneName) => bones.findIndex((b) => b.name === n);
  const prims: Prim[] = [];
  const cone = (bone: BoneName, a: V, b: V, r1: number, r2: number, k: number) => {
    const c: V = mul(add(a, b), 0.5);
    const len = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    prims.push({ bone: bi(bone), kind: "cone", a, b, r1, r2, c, r: [0, 0, 0], rotZ: 0, rotX: 0, k, bound: [...c, len / 2 + Math.max(r1, r2) + k] });
  };
  const ell = (bone: BoneName, c: V, r: V, k: number, rotZ = 0, rotX = 0) => {
    prims.push({ bone: bi(bone), kind: "ell", a: c, b: c, r1: 0, r2: 0, c, r, rotZ, rotX, k, bound: [...c, Math.max(...r) + k] });
  };

  // torso
  const hy = joint.hips[1];
  ell("hips", [0, hy - 0.02, -0.005], f ? [0.165, 0.115, 0.115] : [0.152, 0.11, 0.105], 0.05);
  ell("hips", [0.072, hy - 0.05, -0.05], f ? [0.09, 0.095, 0.085] : [0.078, 0.085, 0.072], 0.05);
  ell("hips", [-0.072, hy - 0.05, -0.05], f ? [0.09, 0.095, 0.085] : [0.078, 0.085, 0.072], 0.05);
  ell("spine", [0, joint.spine[1] + 0.02, 0.0], f ? [0.118, 0.12, 0.088] : [0.138, 0.12, 0.094], 0.07);
  ell("chest", [0, joint.chest[1] + 0.07, 0.008], f ? [0.138, 0.13, 0.092] : [0.172, 0.15, 0.108], 0.07);
  ell("chest", [0, joint.chest[1] + 0.15, -0.012], f ? [0.15, 0.07, 0.08] : [0.19, 0.075, 0.09], 0.06);
  if (f) {
    ell("chest", [0.062, joint.chest[1] + 0.07, 0.075], [0.058, 0.056, 0.052], 0.03);
    ell("chest", [-0.062, joint.chest[1] + 0.07, 0.075], [0.058, 0.056, 0.052], 0.03);
  } else {
    ell("chest", [0.075, joint.chest[1] + 0.09, 0.06], [0.075, 0.055, 0.045], 0.04); // pecs
    ell("chest", [-0.075, joint.chest[1] + 0.09, 0.06], [0.075, 0.055, 0.045], 0.04);
  }
  // neck + head
  const ny = joint.neck[1], hd = joint.head[1];
  cone("neck", [0, ny - 0.03, -0.01], [0, hd + 0.02, 0.005], f ? 0.05 : 0.058, f ? 0.043 : 0.05, 0.04);
  const hs = f ? 0.93 : 1;
  ell("head", [0, hd + 0.115 * hs, -0.005], [0.086 * hs, 0.108 * hs, 0.1 * hs], 0.03);
  ell("head", [0, hd + 0.06 * hs, 0.028], [0.066 * hs, 0.062 * hs, 0.074 * hs], 0.035); // jaw
  cone("head", [0, hd + 0.105 * hs, 0.088 * hs], [0, hd + 0.075 * hs, 0.108 * hs], 0.011, 0.013, 0.012); // nose
  ell("head", [0.084 * hs, hd + 0.1 * hs, -0.005], [0.012, 0.028, 0.02], 0.012);
  ell("head", [-0.084 * hs, hd + 0.1 * hs, -0.005], [0.012, 0.028, 0.02], 0.012);

  for (const side of ["L", "R"] as const) {
    const sx = side === "L" ? 1 : -1;
    const S0 = joint[`shoulder.${side}`], E = joint[`elbow.${side}`], W = joint[`wrist.${side}`], d = armDir[side];
    const ang = sx * 0.42;
    const big = f ? 0.85 : 1;
    ell(`upperArm.${side}`, add(S0, [sx * 0.005, 0.0, 0]), [0.062 * big, 0.068 * big, 0.064 * big], 0.05, ang); // deltoid
    cone(`upperArm.${side}`, add(S0, mul(d, 0.04)), E, 0.05 * big, 0.04 * big, 0.03);
    ell(`upperArm.${side}`, add(add(S0, mul(d, 0.15)), [0, 0, 0.012]), [0.04 * big, 0.085, 0.045 * big], 0.03, ang); // biceps
    cone(`foreArm.${side}`, E, W, 0.042 * big, 0.028 * big, 0.025);
    ell(`foreArm.${side}`, add(E, mul(d, 0.07)), [0.045 * big, 0.08, 0.043 * big], 0.03, ang);
    // hand: flat palm + thumb
    ell(`hand.${side}`, add(W, mul(d, 0.075)), [0.024 * big, 0.072 * big, 0.044 * big], 0.025, ang);
    cone(`hand.${side}`, add(add(W, mul(d, 0.03)), [0, 0, 0.03]), add(add(W, mul(d, 0.08)), [0, 0, 0.05]), 0.014 * big, 0.011 * big, 0.015);
    // legs
    const H = joint[`hip.${side}`], K = joint[`knee.${side}`], A = joint[`ankle.${side}`];
    cone(`thigh.${side}`, add(H, [0, 0.02, 0]), K, f ? 0.088 : 0.082, f ? 0.05 : 0.053, 0.06);
    ell(`thigh.${side}`, add(mul(add(H, K), 0.5), [sx * 0.008, 0.04, 0.022]), f ? [0.072, 0.15, 0.07] : [0.07, 0.15, 0.068], 0.05);
    cone(`shin.${side}`, K, A, f ? 0.048 : 0.052, f ? 0.028 : 0.032, 0.03);
    ell(`shin.${side}`, add(K, [0, -0.13, -0.028]), f ? [0.044, 0.09, 0.045] : [0.05, 0.095, 0.05], 0.035); // calf
    ell(`shin.${side}`, add(K, [0, 0.0, 0.03]), [0.04, 0.04, 0.03], 0.03); // knee cap
    // foot
    cone(`foot.${side}`, [A[0], 0.045, -0.03], [A[0] + sx * 0.008, 0.028, 0.14], 0.042, 0.026, 0.025);
    cone(`foot.${side}`, A, [A[0], 0.05, -0.01], 0.034, 0.04, 0.03);
  }
  return { prims, bones, joint, armDir };
}

// --- distance functions ---------------------------------------------------------
function sdRoundCone(px: number, py: number, pz: number, p: Prim) {
  const [ax, ay, az] = p.a, [bx, by, bz] = p.b;
  const bax = bx - ax, bay = by - ay, baz = bz - az;
  const l2 = bax * bax + bay * bay + baz * baz;
  const rr = p.r1 - p.r2, a2 = l2 - rr * rr, il2 = 1 / l2;
  const pax = px - ax, pay = py - ay, paz = pz - az;
  const y = pax * bax + pay * bay + paz * baz, z = y - l2;
  const qx = pax * l2 - bax * y, qy = pay * l2 - bay * y, qz = paz * l2 - baz * y;
  const x2 = qx * qx + qy * qy + qz * qz, y2 = y * y * l2, z2 = z * z * l2;
  const k = Math.sign(rr) * rr * rr * x2;
  if (Math.sign(z) * a2 * z2 > k) return Math.sqrt(x2 + z2) * il2 - p.r2;
  if (Math.sign(y) * a2 * y2 < k) return Math.sqrt(x2 + y2) * il2 - p.r1;
  return (Math.sqrt(x2 * a2 * il2) + y * rr) * il2 - p.r1;
}
function sdEllipsoid(px: number, py: number, pz: number, p: Prim) {
  let x = px - p.c[0], y = py - p.c[1], z = pz - p.c[2];
  if (p.rotZ) { const c = Math.cos(-p.rotZ), s = Math.sin(-p.rotZ); const nx = x * c - y * s; y = x * s + y * c; x = nx; }
  if (p.rotX) { const c = Math.cos(-p.rotX), s = Math.sin(-p.rotX); const ny = y * c - z * s; z = y * s + z * c; y = ny; }
  const [rx, ry, rz] = p.r;
  const ax = x / rx, ay = y / ry, az = z / rz, bx = ax / rx, by = ay / ry, bz = az / rz;
  const k0 = Math.sqrt(ax * ax + ay * ay + az * az), k1 = Math.sqrt(bx * bx + by * by + bz * bz);
  return k1 === 0 ? -Math.min(rx, ry, rz) : (k0 * (k0 - 1)) / k1;
}
const sdPrim = (x: number, y: number, z: number, p: Prim) => (p.kind === "cone" ? sdRoundCone(x, y, z, p) : sdEllipsoid(x, y, z, p));
function smin(a: number, b: number, k: number) {
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - h * h * k * 0.25;
}

const cache = new Map<Gender, BodyData>();

export function buildBody(g: Gender): BodyData {
  const hit = cache.get(g);
  if (hit) return hit;
  const { prims, bones, joint, armDir } = primitives(g);
  const sdf = (x: number, y: number, z: number) => {
    let d = 1e9;
    for (const p of prims) {
      const [cx, cy, cz, r] = p.bound;
      const dx = x - cx, dy = y - cy, dz = z - cz;
      const bound = Math.sqrt(dx * dx + dy * dy + dz * dz) - r;
      if (bound > d + p.k && bound > 0) continue;
      d = d === 1e9 ? sdPrim(x, y, z, p) : smin(d, sdPrim(x, y, z, p), p.k);
    }
    return d;
  };

  // marching cubes over a 2 m cube: x,z in [-1,1], y in [0,2]
  const res = 150;
  const mc = new MarchingCubes(res, new THREE.MeshBasicMaterial(), false, false, 120000);
  mc.isolation = 0;
  const field = mc.field as Float32Array;
  field.fill(-1);
  const half = res / 2;
  const inBox = (x: number, y: number, z: number) => x >= -0.62 && x <= 0.62 && y >= -0.02 && y <= 1.92 && z >= -0.3 && z <= 0.32;
  // coarse pass every 4th sample, then exact values only near the surface
  const st = 4, cn = Math.ceil(res / st) + 1;
  const coarse = new Float32Array(cn * cn * cn).fill(1);
  for (let zc = 0; zc < cn; zc++) for (let yc = 0; yc < cn; yc++) for (let xc = 0; xc < cn; xc++) {
    const x = (xc * st - half) / half, y = (yc * st - half) / half + 1, z = (zc * st - half) / half;
    if (inBox(x, y, z)) coarse[zc * cn * cn + yc * cn + xc] = sdf(x, y, z);
  }
  const near = (st * 1.8) / half;
  for (let zi = 0; zi < res; zi++) {
    const z = (zi - half) / half;
    for (let yi = 0; yi < res; yi++) {
      const y = (yi - half) / half + 1;
      for (let xi = 0; xi < res; xi++) {
        const x = (xi - half) / half;
        if (!inBox(x, y, z)) continue;
        const c = coarse[Math.round(zi / st) * cn * cn + Math.round(yi / st) * cn + Math.round(xi / st)];
        field[zi * res * res + yi * res + xi] = -(Math.abs(c) > near ? c : sdf(x, y, z));
      }
    }
  }
  mc.update();
  const n = mc.count;
  const position = new Float32Array(n * 3), normal = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    position[i * 3] = mc.positionArray[i * 3];
    position[i * 3 + 1] = mc.positionArray[i * 3 + 1] + 1;
    position[i * 3 + 2] = mc.positionArray[i * 3 + 2];
    const nx = mc.normalArray[i * 3], ny = mc.normalArray[i * 3 + 1], nz = mc.normalArray[i * 3 + 2];
    const l = Math.hypot(nx, ny, nz) || 1;
    normal.set([nx / l, ny / l, nz / l], i * 3);
  }
  mc.geometry.dispose();
  (mc.material as THREE.Material).dispose();

  // skin weights from the primitives themselves: the closer a vertex is to a bone's shapes, the more it follows that bone
  const skinIndex = new Uint16Array(n * 4), skinWeight = new Float32Array(n * 4), slot = new Float32Array(n);
  const boneW = new Float32Array(bones.length);
  for (let i = 0; i < n; i++) {
    const x = position[i * 3], y = position[i * 3 + 1], z = position[i * 3 + 2];
    boneW.fill(0);
    for (const p of prims) {
      const [cx, cy, cz, r] = p.bound;
      const dx = x - cx, dy = y - cy, dz = z - cz;
      if (dx * dx + dy * dy + dz * dz > (r + 0.12) * (r + 0.12)) continue;
      const d = Math.max(0, sdPrim(x, y, z, p));
      const e = d + 0.012, w = 1 / (e * e * e * e);
      if (w > boneW[p.bone]) boneW[p.bone] = w;
    }
    const order: number[] = [];
    for (let j = 0; j < 4; j++) {
      let best = -1;
      for (let b = 0; b < boneW.length; b++) if (!order.includes(b) && (best < 0 || boneW[b] > boneW[best])) best = b;
      order.push(best);
    }
    const sum = order.reduce((s, b) => s + boneW[b], 0) || 1;
    order.forEach((b, j) => { skinIndex[i * 4 + j] = b; skinWeight[i * 4 + j] = boneW[b] / sum; });
    slot[i] = bones[order[0]].slot;
  }

  const data: BodyData = { position, normal, skinIndex, skinWeight, slot, bones, joint, armDir };
  cache.set(g, data);
  return data;
}

export function bodyGeometry(d: BodyData) {
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(d.position, 3));
  g.setAttribute("normal", new THREE.BufferAttribute(d.normal, 3));
  g.setAttribute("skinIndex", new THREE.Uint16BufferAttribute(d.skinIndex, 4));
  g.setAttribute("skinWeight", new THREE.BufferAttribute(d.skinWeight, 4));
  g.setAttribute("aSlot", new THREE.BufferAttribute(d.slot, 1));
  g.computeBoundingSphere();
  return g;
}

/** Bones in bind pose (local offsets from their parents). */
export function bodySkeleton(d: BodyData) {
  const map = {} as Record<BoneName, THREE.Bone>;
  const list: THREE.Bone[] = [];
  for (const b of d.bones) {
    const bone = new THREE.Bone();
    bone.name = b.name;
    const parent = b.parent ? d.bones.find((x) => x.name === b.parent)! : undefined;
    const pp = parent ? parent.pos : [0, 0, 0];
    bone.position.set(b.pos[0] - pp[0], b.pos[1] - pp[1], b.pos[2] - pp[2]);
    if (b.parent) map[b.parent].add(bone);
    map[b.name] = bone;
    list.push(bone);
  }
  return { map, list, skeleton: new THREE.Skeleton(list) };
}
