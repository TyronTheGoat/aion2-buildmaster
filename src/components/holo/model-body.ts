import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import type { Gender } from "@/lib/hologram";
import { distSeg, S, type BoneDef, type BoneName } from "./body";
import { fetchAsset, loadImage } from "./assets";

/**
 * The supplied Bildmaster character models (GLB, not rigged, texture embedded).
 *
 * The meshes are used exactly as delivered. At runtime they only get smooth normals and a per-vertex
 * equipment-slot attribute, and invisible "bones" are placed on landmarks measured from the mesh
 * (head, shoulders, elbows, wrists, knees, ankles) so gear, auras and camera markers line up.
 * Nothing moves those bones: the idle animation is breathing and floating of the whole figure.
 */

type V = [number, number, number];

/**
 * Newest first: v4 = rigged (Mixamo skeleton, scripts/rig-character.mjs), v3 = detailed static Meshy models
 * with a natural colour texture, v2 = the earlier hologram-textured models.
 * natural: the texture has natural colours (v4 decides by whether it has a texture at all).
 */
const FILES: Record<Gender, { file: string; natural: boolean }[]> = {
  m: [{ file: "bildmaster_male_v4_RIG.glb", natural: true }, { file: "bildmaster_male_v3_WEB.glb", natural: true }, { file: "bildmaster_male_v2_WEB.glb", natural: false }],
  f: [{ file: "bildmaster_female_v4_RIG.glb", natural: true }, { file: "bildmaster_female_v3_WEB.glb", natural: true }, { file: "bildmaster_female_v2_WEB.glb", natural: false }],
};

/** Mixamo bones that drive the app's bones (gear, auras and poses are defined on those). */
export const RIG_MAP: Partial<Record<BoneName, string>> = {
  hips: "Hips", spine: "Spine", chest: "Spine2", neck: "Neck", head: "Head",
  "upperArm.L": "LeftArm", "foreArm.L": "LeftForeArm", "hand.L": "LeftHand",
  "upperArm.R": "RightArm", "foreArm.R": "RightForeArm", "hand.R": "RightHand",
  "thigh.L": "LeftUpLeg", "shin.L": "LeftLeg", "foot.L": "LeftFoot",
  "thigh.R": "RightUpLeg", "shin.R": "RightLeg", "foot.R": "RightFoot",
};
/** strips the "mixamorig" prefix (GLTFLoader turns "mixamorig:Hips" into "mixamorigHips") */
export const rigName = (n: string) => n.replace(/^mixamorig[:_]?/, "");
const REF: Record<Gender, string> = { m: "hologram_male_detailed_ref.webp", f: "hologram_female_detailed_ref.webp" };

export interface ModelBody {
  geometry: THREE.BufferGeometry;
  texture: THREE.Texture | null;
  /** the texture has natural colours (skin, cloth); the shader turns its light and shade into hologram light */
  natural: boolean;
  /** detailed front reference projected onto the mesh (uvRef attribute), if installed */
  reference: THREE.Texture | null;
  /** rigged model: the loaded scene (skinned mesh + skeleton), cloned per figure */
  rig: THREE.Object3D | null;
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
  measure: { H: number; bones: BoneDef[] };
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
  let buf: ArrayBuffer | null = null, natural = false;
  for (const f of FILES[g]) {
    buf = await fetchAsset(`models/${f.file}`);
    if (buf) { natural = f.natural; break; }
  }
  if (!buf) return null;
  const gltf = await new GLTFLoader().parseAsync(buf, "");
  let mesh: THREE.Mesh | undefined;
  gltf.scene.updateMatrixWorld(true);
  gltf.scene.traverse((o) => { if (!mesh && (o as THREE.Mesh).isMesh) mesh = o as THREE.Mesh; });
  if (!mesh) return null;
  const skinned = (mesh as THREE.SkinnedMesh).isSkinnedMesh === true;
  const geo = mesh.geometry.clone();
  // a skinned mesh stays in its bind space (the skeleton places it)
  if (!skinned) geo.applyMatrix4(mesh.matrixWorld);
  const mat = mesh.material as THREE.MeshStandardMaterial;
  const texture = mat.map ?? null;
  // limb joints of a rig come from its bones, so gear rotates around the same pivots as the mesh
  let pins: Record<string, V> | undefined;
  if (skinned) {
    pins = {};
    const at = (n: string): V | undefined => {
      let p: V | undefined;
      gltf.scene.traverse((o) => { if (!p && (o as THREE.Bone).isBone && rigName(o.name) === n) p = o.getWorldPosition(new THREE.Vector3()).toArray() as V; });
      return p;
    };
    for (const [side, mx] of [["L", "Left"], ["R", "Right"]] as const) {
      const pairs: [string, string][] = [["shoulder", "Arm"], ["elbow", "ForeArm"], ["wrist", "Hand"], ["hip", "UpLeg"], ["knee", "Leg"], ["ankle", "Foot"]];
      for (const [j, b] of pairs) { const p = at(mx + b); if (p) pins[`${j}.${side}`] = p; }
    }
  }
  const body = analyse(geo, texture, pins);
  body.natural = natural && !!texture;
  body.rig = skinned ? gltf.scene : null;
  if (skinned) return body;
  // the painted reference only adds detail to the simpler v2 meshes; the v3 models carry their own
  if (natural) return body;
  const img = await loadImage(`hero/${REF[g]}`);
  if (img && projectReference(body, img)) {
    const tex = new THREE.Texture(img);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    tex.needsUpdate = true;
    body.reference = tex;
  }
  return body;
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

/**
 * Measures joints on a standing figure in A-pose (feet on y = 0, facing +z): either the mesh vertices,
 * or the opaque pixels of a front image (flat: z = 0). Both give the same bone layout, which is what
 * lets a reference image be projected onto the mesh.
 */
export function measure(P: Float32Array, flat = false, pins?: Record<string, V>) {
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
    let toeZ = flat ? Infinity : -Infinity;
    for (let i = 0; i < n && !flat; i++) {
      const x = P[i * 3], y = P[i * 3 + 1], z = P[i * 3 + 2];
      if (y < 0.05 * H && s * (x - cx) > 0 && z > toeZ) { toeZ = z; toe = [x, y, z]; }
    }
    joint[`hip.${side}`] = hip; joint[`knee.${side}`] = knee; joint[`ankle.${side}`] = ankle; joint[`toe.${side}`] = toe;
  }

  if (pins) {
    Object.assign(joint, pins);
    for (const side of ["L", "R"] as const) {
      const W = joint[`wrist.${side}`], E = joint[`elbow.${side}`];
      const d = new THREE.Vector3(W[0] - E[0], W[1] - E[1], W[2] - E[2]).normalize();
      armDir[side] = [d.x, d.y, d.z];
    }
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

  const waistY = spine[1] - 0.03 * H;
  const waist = at(waistY, 0.2 * H);
  const back = at(shoulderY - 0.03 * H, 0.15 * H);
  const fit: ModelBody["fit"] = {
    earX: (earS.x1 - earS.x0) / 2, earY: neckY + 0.06 * H, neckR: (neckS.x1 - neckS.x0) / 2, neckFront: neckS.z1 - neck[2], wristR,
    waist: { y: waistY, rx: (waist.x1 - waist.x0) / 2, rz: (waist.z1 - waist.z0) / 2, cz: waist.mz },
    backZ: back.z0, chest: [0.6 * H, 0.8 * H],
  };
  return { H, cx, bones, joint, armDir, fit };
}


function analyse(geo: THREE.BufferGeometry, texture: THREE.Texture | null, pins?: Record<string, V>): ModelBody {
  smoothNormals(geo);
  const P = geo.getAttribute("position").array as Float32Array;
  const n = P.length / 3;
  const m = measure(P, false, pins);
  const { bones } = m;

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
  return { geometry: geo, texture, natural: false, reference: null, rig: null, bones, joint: m.joint, armDir: m.armDir, height: m.H, fit: m.fit, measure: m };
}

// ---- reference projection ----------------------------------------------------------

/** Width of the part of a point set across the segment a→b, measured in the front plane at its middle. */
function crossWidth(P: Float32Array, a: V, b: V, maxR: number) {
  const ux = b[0] - a[0], uy = b[1] - a[1];
  const L = Math.hypot(ux, uy) || 1;
  const dx = ux / L, dy = uy / L;
  const qs: number[] = [];
  for (let i = 0; i < P.length; i += 3) {
    const px = P[i] - a[0], py = P[i + 1] - a[1];
    const t = (px * dx + py * dy) / L;
    if (t < 0.4 || t > 0.6) continue;
    const q = -px * dy + py * dx;
    if (Math.abs(q) < maxR) qs.push(q);
  }
  if (qs.length < 4) return 0;
  qs.sort((x, y) => x - y);
  // connected run around the axis
  let lo = qs[0], hi = qs[qs.length - 1];
  for (let k = 1; k < qs.length; k++) {
    if (qs[k] - qs[k - 1] < maxR * 0.08) continue;
    if (qs[k] <= 0) lo = qs[k]; else if (qs[k - 1] >= 0) { hi = qs[k - 1]; break; }
  }
  return hi - lo;
}

/**
 * Projects a front reference image onto the mesh: every vertex is carried from its body part in the
 * mesh to the same body part in the image (blend of per-bone mappings, so joints stay smooth).
 * Adds the "uvRef" attribute. The reference only needs a transparent background and the same A-pose idea.
 */
export function projectReference(body: ModelBody, img: HTMLImageElement) {
  const scale = Math.min(1, 640 / img.naturalHeight);
  const w = Math.round(img.naturalWidth * scale), h = Math.round(img.naturalHeight * scale);
  const cv = document.createElement("canvas");
  cv.width = w; cv.height = h;
  const ctx = cv.getContext("2d", { willReadFrequently: true });
  if (!ctx) return false;
  ctx.drawImage(img, 0, 0, w, h);
  const px = ctx.getImageData(0, 0, w, h).data;
  let top = h, bottom = 0, left = w, right = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (px[(y * w + x) * 4 + 3] > 200) { top = Math.min(top, y); bottom = Math.max(bottom, y); left = Math.min(left, x); right = Math.max(right, x); }
  }
  const xc = (left + right) / 2;
  if (bottom - top < 50) return false;
  // image pixels → metres with feet on y = 0, same height as the mesh
  const k = body.height / (bottom - top);
  const pts: number[] = [];
  for (let y = top; y <= bottom; y++) for (let x = 0; x < w; x++) {
    if (px[(y * w + x) * 4 + 3] > 200) pts.push((x - xc) * k, (bottom - y) * k, 0);
  }
  const R = measure(new Float32Array(pts), true);
  const G = body.measure;
  const P = body.geometry.getAttribute("position").array as Float32Array;
  const RP = new Float32Array(pts);

  // per bone: GLB segment → reference segment, stretched along and across the limb
  const maps = G.bones.map((gb, i) => {
    const rb = R.bones[i];
    const [a, b] = gb.seg, [ra, rbb] = rb.seg;
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, RL = Math.hypot(rbb[0] - ra[0], rbb[1] - ra[1]) || 1;
    const maxR = gb.name.startsWith("hips") || gb.name.startsWith("spine") || gb.name.startsWith("chest") ? 0.2 * G.H : 0.07 * G.H;
    const gw = crossWidth(P, a, b, maxR), rw = crossWidth(RP, ra, rbb, maxR);
    const across = gw > 0 && rw > 0 ? Math.min(1.6, Math.max(0.6, rw / gw)) : RL / L;
    return { a, u: [(b[0] - a[0]) / L, (b[1] - a[1]) / L], ra, ru: [(rbb[0] - ra[0]) / RL, (rbb[1] - ra[1]) / RL], along: RL / L, across };
  });

  const n = P.length / 3;
  const uv = new Float32Array(n * 2);
  const wts = new Float32Array(G.bones.length);
  const p: V = [0, 0, 0];
  for (let i = 0; i < n; i++) {
    p[0] = P[i * 3]; p[1] = P[i * 3 + 1]; p[2] = P[i * 3 + 2];
    let sum = 0;
    for (let b = 0; b < G.bones.length; b++) {
      const bd = G.bones[b];
      const d = Math.max(0, distSeg(p, bd.seg[0], bd.seg[1], bd.sx ?? 1) - bd.rad) + 0.012;
      wts[b] = 1 / (d * d * d * d);
      sum += wts[b];
    }
    let mx = 0, my = 0;
    for (let b = 0; b < G.bones.length; b++) {
      const wb = wts[b] / sum;
      if (wb < 1e-3) continue;
      const m = maps[b];
      const rx = p[0] - m.a[0], ry = p[1] - m.a[1];
      const t = (rx * m.u[0] + ry * m.u[1]) * m.along;
      const q = (-rx * m.u[1] + ry * m.u[0]) * m.across;
      mx += wb * (m.ra[0] + m.ru[0] * t - m.ru[1] * q);
      my += wb * (m.ra[1] + m.ru[1] * t + m.ru[0] * q);
    }
    // metres → image uv (three flips images, so v = 0 is the bottom)
    uv[i * 2] = (mx / k + xc) / w;
    uv[i * 2 + 1] = 1 - (bottom - my / k) / h;
  }
  body.geometry.setAttribute("uvRef", new THREE.BufferAttribute(uv, 2));
  return true;
}
