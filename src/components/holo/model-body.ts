import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import type { Gender } from "@/lib/hologram";
import { distSeg, S, type BoneDef, type BoneName } from "./body";

/**
 * The supplied Bildmaster character models (GLB, not rigged, texture embedded).
 *
 * The meshes are used exactly as delivered. At runtime they only get smooth normals and a per-vertex
 * equipment-slot attribute, and invisible "bones" are placed on landmarks measured from the mesh
 * (head, shoulders, elbows, wrists, knees, ankles) so gear, auras and camera markers line up.
 * Nothing moves those bones: the idle animation is breathing and floating of the whole figure.
 */

type V = [number, number, number];

declare global {
  // offline build: data URIs of the models, injected before the app script
  var __BM_MODELS__: Partial<Record<Gender, string>> | undefined;
}

const FILE: Record<Gender, string> = { m: "bildmaster_male_v2_WEB.glb", f: "bildmaster_female_v2_WEB.glb" };

export interface ModelBody {
  geometry: THREE.BufferGeometry;
  texture: THREE.Texture | null;
  bones: BoneDef[];
  joint: Record<string, V>;
  armDir: Record<"L" | "R", V>;
  height: number;
  /** measured sizes for fitting accessories */
  fit: {
    earX: number; earY: number; neckR: number; neckFront: number; wristR: Record<"L" | "R", number>;
    waist: { y: number; rx: number; rz: number; cz: number };
    backZ: number; chest: [number, number];
  };
}

const cache = new Map<Gender, Promise<ModelBody | null>>();

/** Loads the GLB for a gender; resolves to null when the model files are not installed. */
export function loadModelBody(g: Gender): Promise<ModelBody | null> {
  let p = cache.get(g);
  if (!p) {
    p = load(g).catch((e) => { console.warn("Charaktermodell nicht geladen:", e); return null; });
    cache.set(g, p);
  }
  return p;
}

async function load(g: Gender): Promise<ModelBody | null> {
  // the offline file carries the models inline (or none at all); the web app serves them from /models
  const inline = globalThis.__BM_MODELS__;
  const url = inline ? inline[g] : `/models/${FILE[g]}`;
  if (!url) return null;
  const res = await fetch(url);
  if (!res.ok) return null;
  const buf = await res.arrayBuffer();
  const gltf = await new GLTFLoader().parseAsync(buf, "");
  let mesh: THREE.Mesh | undefined;
  gltf.scene.updateMatrixWorld(true);
  gltf.scene.traverse((o) => { if (!mesh && (o as THREE.Mesh).isMesh) mesh = o as THREE.Mesh; });
  if (!mesh) return null;
  const geo = mesh.geometry.clone();
  geo.applyMatrix4(mesh.matrixWorld);
  const mat = mesh.material as THREE.MeshStandardMaterial;
  const texture = mat.map ?? null;
  return analyse(geo, texture);
}

function smoothNormals(geo: THREE.BufferGeometry) {
  // UV seams duplicate vertices; average the normals over equal positions so the rim light has no seams
  const pos = geo.getAttribute("position") as THREE.BufferAttribute;
  const n = pos.count;
  const idx = geo.index ? (geo.index.array as ArrayLike<number>) : Array.from({ length: n }, (_, i) => i);
  const key = new Int32Array(n);
  const map = new Map<string, number>();
  for (let i = 0; i < n; i++) {
    const k = `${Math.round(pos.getX(i) * 1e4)},${Math.round(pos.getY(i) * 1e4)},${Math.round(pos.getZ(i) * 1e4)}`;
    let id = map.get(k);
    if (id === undefined) { id = map.size; map.set(k, id); }
    key[i] = id;
  }
  const acc = new Float32Array(map.size * 3);
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  for (let f = 0; f + 2 < idx.length; f += 3) {
    const i0 = idx[f], i1 = idx[f + 1], i2 = idx[f + 2];
    a.fromBufferAttribute(pos, i0); b.fromBufferAttribute(pos, i1); c.fromBufferAttribute(pos, i2);
    c.sub(b); a.sub(b); c.cross(a); // area-weighted face normal
    for (const i of [i0, i1, i2]) { const o = key[i] * 3; acc[o] += c.x; acc[o + 1] += c.y; acc[o + 2] += c.z; }
  }
  const normal = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const o = key[i] * 3;
    const l = Math.hypot(acc[o], acc[o + 1], acc[o + 2]) || 1;
    normal[i * 3] = acc[o] / l; normal[i * 3 + 1] = acc[o + 1] / l; normal[i * 3 + 2] = acc[o + 2] / l;
  }
  geo.setAttribute("normal", new THREE.BufferAttribute(normal, 3));
}

function analyse(geo: THREE.BufferGeometry, texture: THREE.Texture | null): ModelBody {
  smoothNormals(geo);
  const P = geo.getAttribute("position").array as Float32Array;
  const n = P.length / 3;
  let H = 0;
  for (let i = 0; i < n; i++) H = Math.max(H, P[i * 3 + 1]);

  /** vertices in a height band, optionally filtered */
  const band = (y: number, h: number, keep?: (x: number, z: number) => boolean) => {
    const out: number[] = [];
    for (let i = 0; i < n; i++) {
      const py = P[i * 3 + 1];
      if (Math.abs(py - y) <= h && (!keep || keep(P[i * 3], P[i * 3 + 2]))) out.push(i);
    }
    return out;
  };
  const stats = (ids: number[]) => {
    let sx = 0, sy = 0, sz = 0, x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    for (const i of ids) {
      const x = P[i * 3], y = P[i * 3 + 1], z = P[i * 3 + 2];
      sx += x; sy += y; sz += z;
      x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z);
    }
    const k = ids.length || 1;
    return { c: [sx / k, sy / k, sz / k] as V, x0, x1, z0, z1, mx: (x0 + x1) / 2, mz: (z0 + z1) / 2 };
  };
  const central = (half: number) => (x: number) => Math.abs(x) < half;
  /** only the connected part of a slice around x = c (drops arms and hands beside the torso) */
  const around = (ids: number[], c: number) => {
    const xs = ids.map((i) => P[i * 3]).sort((a, b) => a - b);
    let lo = -Infinity, hi = Infinity;
    for (let k = 1; k < xs.length; k++) {
      if (xs[k] - xs[k - 1] < 0.015 * H) continue;
      if (xs[k] <= c) lo = xs[k] - 1e-6; else if (xs[k - 1] >= c) { hi = xs[k - 1] + 1e-6; break; }
    }
    return ids.filter((i) => P[i * 3] >= lo && P[i * 3] <= hi);
  };

  // neck: narrowest slice between the shoulders and the head
  let neckY = 0.87 * H, best = Infinity;
  for (let y = 0.8 * H; y <= 0.92 * H; y += 0.004 * H) {
    const s = stats(band(y, 0.006 * H, central(0.2 * H)));
    if (s.x1 - s.x0 < best) { best = s.x1 - s.x0; neckY = y; }
  }
  const neckS = stats(band(neckY, 0.01 * H, central(0.2 * H)));
  const cx = neckS.mx;
  const at = (y: number, half = 0.2 * H) => stats(around(band(y, 0.008 * H, (x) => Math.abs(x - cx) < half), cx));
  const mid = (y: number, half?: number): V => { const s = at(y, half); return [s.mx, y, s.mz]; };

  const neck = mid(neckY - 0.012 * H, 0.1 * H);
  const head: V = mid(neckY + 0.045 * H, 0.12 * H);
  const headTop: V = [head[0], H, head[2]];
  const earS = at(neckY + 0.06 * H, 0.12 * H);
  const shoulderY = neckY - 0.07 * H;
  const shS = at(shoulderY, 0.3 * H);
  const chest = mid(0.66 * H, 0.17 * H), spine = mid(0.625 * H, 0.17 * H), pelvis = mid(0.534 * H, 0.17 * H);

  const joint: Record<string, V> = { hips: pelvis, spine, chest, neck, head };
  const armDir = {} as Record<"L" | "R", V>;
  const wristR = {} as Record<"L" | "R", number>;
  const sides = { L: 1, R: -1 } as const; // character's left is +x (it faces +z)

  for (const side of ["L", "R"] as const) {
    const s = sides[side];
    const edge = s > 0 ? shS.x1 : shS.x0;
    const shoulder: V = [edge - s * 0.045 * H, shoulderY, shS.mz];
    // fingertip: lowest point clearly outside the torso on this side
    let tip = -1;
    for (let i = 0; i < n; i++) {
      const x = P[i * 3], y = P[i * 3 + 1];
      if (s * (x - shoulder[0]) > 0.1 * H && y < shoulderY && (tip < 0 || y < P[tip * 3 + 1])) tip = i;
    }
    const T: V = tip >= 0 ? [P[tip * 3], P[tip * 3 + 1], P[tip * 3 + 2]] : [shoulder[0] + s * 0.15 * H, 0.45 * H, 0];
    const axis = new THREE.Vector3(T[0] - shoulder[0], T[1] - shoulder[1], T[2] - shoulder[2]);
    const L = axis.length(); axis.normalize();
    // centre of the arm cross-section at a fraction of its length
    const onArm = (f: number) => {
      let sx = 0, sy = 0, sz = 0, k = 0;
      const pts: V[] = [];
      for (let i = 0; i < n; i++) {
        const dx = P[i * 3] - shoulder[0], dy = P[i * 3 + 1] - shoulder[1], dz = P[i * 3 + 2] - shoulder[2];
        const t = dx * axis.x + dy * axis.y + dz * axis.z;
        if (Math.abs(t - f * L) > 0.015 * L) continue;
        const px = dx - axis.x * t, py = dy - axis.y * t, pz = dz - axis.z * t;
        if (px * px + py * py + pz * pz > (0.05 * H) ** 2) continue;
        sx += P[i * 3]; sy += P[i * 3 + 1]; sz += P[i * 3 + 2]; k++;
        pts.push([P[i * 3], P[i * 3 + 1], P[i * 3 + 2]]);
      }
      const c: V = k ? [sx / k, sy / k, sz / k] : [shoulder[0] + axis.x * f * L, shoulder[1] + axis.y * f * L, shoulder[2] + axis.z * f * L];
      const r = pts.length ? pts.reduce((m, p) => m + Math.hypot(p[0] - c[0], p[1] - c[1], p[2] - c[2]), 0) / pts.length : 0.03;
      return { c, r };
    };
    const elbow = onArm(0.42).c, wrist = onArm(0.75), hand = onArm(0.86).c;
    wristR[side] = wrist.r;
    joint[`shoulder.${side}`] = shoulder;
    joint[`elbow.${side}`] = elbow;
    joint[`wrist.${side}`] = wrist.c;
    joint[`hand.${side}`] = hand;
    joint[`tip.${side}`] = T;
    const d = new THREE.Vector3(wrist.c[0] - elbow[0], wrist.c[1] - elbow[1], wrist.c[2] - elbow[2]).normalize();
    armDir[side] = [d.x, d.y, d.z];

    // legs: centre of this side's leg at knee and ankle height
    const leg = (y: number): V => {
      const st = stats(band(y, 0.01 * H, (x) => s * (x - cx) > 0.005 * H && Math.abs(x - cx) < 0.2 * H));
      return [st.mx, y, st.mz];
    };
    const hip: V = [cx + s * 0.058 * H, 0.505 * H, pelvis[2]];
    const knee = leg(0.285 * H), ankle = leg(0.05 * H);
    let toe: V = [ankle[0], 0.01 * H, ankle[2] + 0.08 * H];
    let toeZ = -Infinity;
    for (let i = 0; i < n; i++) {
      const x = P[i * 3], y = P[i * 3 + 1], z = P[i * 3 + 2];
      if (y < 0.05 * H && s * (x - cx) > 0 && z > toeZ) { toeZ = z; toe = [x, y, z]; }
    }
    joint[`hip.${side}`] = hip; joint[`knee.${side}`] = knee; joint[`ankle.${side}`] = ankle; joint[`toe.${side}`] = toe;
  }

  const torsoSx = 0.72;
  const j = joint;
  const bones: BoneDef[] = [
    { name: "hips", pos: pelvis, slot: S.pants, seg: [[pelvis[0], pelvis[1] - 0.035 * H, pelvis[2]], spine], rad: 0.12, sx: torsoSx },
    { name: "spine", parent: "hips", pos: spine, slot: S.torso, seg: [spine, chest], rad: 0.12, sx: torsoSx },
    { name: "chest", parent: "spine", pos: chest, slot: S.torso, seg: [chest, [neck[0], neck[1] - 0.035 * H, neck[2]]], rad: 0.13, sx: torsoSx },
    { name: "neck", parent: "chest", pos: neck, slot: S.necklace, seg: [neck, [neck[0], neckY + 0.01 * H, neck[2]]], rad: 0.05 },
    { name: "head", parent: "neck", pos: head, slot: S.helmet, seg: [[head[0], neckY + 0.025 * H, head[2]], [headTop[0], H - 0.05 * H, headTop[2]]], rad: 0.085 },
  ];
  for (const s of ["L", "R"] as const) {
    bones.push(
      { name: `upperArm.${s}` as BoneName, parent: "chest", pos: j[`shoulder.${s}`], slot: S.shoulders, seg: [j[`shoulder.${s}`], j[`elbow.${s}`]], rad: 0.045 },
      { name: `foreArm.${s}` as BoneName, parent: `upperArm.${s}` as BoneName, pos: j[`elbow.${s}`], slot: S.gloves, seg: [j[`elbow.${s}`], j[`wrist.${s}`]], rad: 0.035 },
      { name: `hand.${s}` as BoneName, parent: `foreArm.${s}` as BoneName, pos: j[`wrist.${s}`], slot: S.gloves, seg: [j[`wrist.${s}`], j[`tip.${s}`]], rad: 0.03 },
      { name: `thigh.${s}` as BoneName, parent: "hips", pos: j[`hip.${s}`], slot: S.pants, seg: [j[`hip.${s}`], j[`knee.${s}`]], rad: 0.07 },
      { name: `shin.${s}` as BoneName, parent: `thigh.${s}` as BoneName, pos: j[`knee.${s}`], slot: S.boots, seg: [j[`knee.${s}`], j[`ankle.${s}`]], rad: 0.045 },
      { name: `foot.${s}` as BoneName, parent: `shin.${s}` as BoneName, pos: j[`ankle.${s}`], slot: S.boots, seg: [j[`ankle.${s}`], j[`toe.${s}`]], rad: 0.035 },
    );
  }

  // slot of each vertex = nearest body part
  const slot = new Float32Array(n);
  const p: V = [0, 0, 0];
  for (let i = 0; i < n; i++) {
    p[0] = P[i * 3]; p[1] = P[i * 3 + 1]; p[2] = P[i * 3 + 2];
    let bi = 0, bd = Infinity;
    for (let b = 0; b < bones.length; b++) {
      const d = distSeg(p, bones[b].seg[0], bones[b].seg[1], bones[b].sx ?? 1) - bones[b].rad;
      if (d < bd) { bd = d; bi = b; }
    }
    slot[i] = bones[bi].slot;
  }
  geo.setAttribute("aSlot", new THREE.BufferAttribute(slot, 1));
  geo.computeBoundingSphere();

  const waistY = spine[1] - 0.03 * H;
  const waist = at(waistY, 0.2 * H);
  const back = at(shoulderY - 0.03 * H, 0.15 * H);
  return {
    geometry: geo, texture, bones, joint, armDir, height: H,
    fit: {
      earX: (earS.x1 - earS.x0) / 2, earY: neckY + 0.06 * H, neckR: (neckS.x1 - neckS.x0) / 2, neckFront: neckS.z1 - neck[2], wristR,
      waist: { y: waistY, rx: (waist.x1 - waist.x0) / 2, rz: (waist.z1 - waist.z0) / 2, cz: waist.mz },
      backZ: back.z0, chest: [0.6 * H, 0.8 * H],
    },
  };
}
