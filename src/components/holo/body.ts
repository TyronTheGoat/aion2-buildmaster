import * as THREE from "three";
import type { Gender } from "@/lib/hologram";
import { HUMAN } from "./human-data";

/**
 * Smooth human base body from the MakeHuman base mesh (CC0, see scripts/build-human-mesh.mjs),
 * skinned at runtime to a small skeleton placed on MakeHuman's own joint markers.
 *
 * Bind pose: MakeHuman's standard A-pose, facing +z, feet at y = 0.
 */

type V = [number, number, number];

/** Body regions that map to an equipment slot on the skin mesh (index = aSlot attribute). */
export const SKIN_SLOTS = ["helmet:0", "necklace:0", "torso:0", "shoulders:0", "gloves:0", "pants:0", "boots:0"] as const;
export const S = { helmet: 0, necklace: 1, torso: 2, shoulders: 3, gloves: 4, pants: 5, boots: 6 };

export type BoneName =
  | "hips" | "spine" | "chest" | "neck" | "head"
  | "upperArm.L" | "foreArm.L" | "hand.L" | "upperArm.R" | "foreArm.R" | "hand.R"
  | "thigh.L" | "shin.L" | "foot.L" | "thigh.R" | "shin.R" | "foot.R";

export interface BoneDef {
  name: BoneName; parent?: BoneName; pos: V; slot: number;
  /** segment used for skin weights, its radius and an x-squash for the wide torso */
  seg: [V, V]; rad: number; sx?: number;
}

export interface BodyData {
  bones: BoneDef[];
  joint: Record<string, V>;
  armDir: Record<"L" | "R", V>;
  position: Float32Array;
  index: Uint16Array;
  skinIndex: Uint16Array;
  skinWeight: Float32Array;
  slot: Float32Array;
}

const sub = (a: V, b: V): V => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a: V, b: V): V => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a: V, s: number): V => [a[0] * s, a[1] * s, a[2] * s];
const norm = (a: V): V => mul(a, 1 / (Math.hypot(...a) || 1));

function b64(s: string) {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out.buffer;
}

export function distSeg(p: V, a: V, b: V, sx: number) {
  const ax = (p[0] - a[0]) * sx, ay = p[1] - a[1], az = p[2] - a[2];
  const bx = (b[0] - a[0]) * sx, by = b[1] - a[1], bz = b[2] - a[2];
  const l2 = bx * bx + by * by + bz * bz;
  const t = l2 > 0 ? Math.max(0, Math.min(1, (ax * bx + ay * by + az * bz) / l2)) : 0;
  const dx = ax - bx * t, dy = ay - by * t, dz = az - bz * t;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

const cache = new Map<Gender, BodyData>();

export function buildBody(g: Gender): BodyData {
  const hit = cache.get(g);
  if (hit) return hit;
  const src = g === "f" ? HUMAN.female : HUMAN.male;
  const j = src.joints as unknown as Record<string, V>;
  const n = HUMAN.vertexCount;
  const q = new Uint16Array(b64(src.pos));
  const position = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) for (let k = 0; k < 3; k++) {
    position[i * 3 + k] = src.min[k] + (q[i * 3 + k] / 65535) * (src.max[k] - src.min[k]);
  }
  const index = new Uint16Array(b64(HUMAN.index));

  const joint: Record<string, V> = {
    hips: j.pelvis, spine: j.spine3, chest: j.spine2, neck: j.neck, head: j.head,
  };
  const armDir = {} as Record<"L" | "R", V>;
  for (const s of ["L", "R"] as const) {
    joint[`shoulder.${s}`] = j[`shoulder.${s}`];
    joint[`elbow.${s}`] = j[`elbow.${s}`];
    joint[`wrist.${s}`] = j[`hand.${s}`];
    joint[`hip.${s}`] = j[`upperLeg.${s}`];
    joint[`knee.${s}`] = j[`knee.${s}`];
    joint[`ankle.${s}`] = j[`ankle.${s}`];
    armDir[s] = norm(sub(j[`hand.${s}`], j[`elbow.${s}`]));
  }
  const torsoSx = 0.72;
  const bones: BoneDef[] = [
    { name: "hips", pos: j.pelvis, slot: S.pants, seg: [add(j.pelvis, [0, -0.06, 0]), j.spine3], rad: 0.12, sx: torsoSx },
    { name: "spine", parent: "hips", pos: j.spine3, slot: S.torso, seg: [j.spine3, j.spine2], rad: 0.12, sx: torsoSx },
    { name: "chest", parent: "spine", pos: j.spine2, slot: S.torso, seg: [j.spine2, add(j.neck, [0, -0.06, 0])], rad: 0.13, sx: torsoSx },
    { name: "neck", parent: "chest", pos: j.neck, slot: S.necklace, seg: [j.neck, j.head], rad: 0.05 },
    { name: "head", parent: "neck", pos: j.head, slot: S.helmet, seg: [add(j.head, [0, 0.03, 0]), j.head2], rad: 0.085 },
  ];
  for (const s of ["L", "R"] as const) {
    const fingers = add(j[`hand3.${s}`], mul(armDir[s], 0.09));
    const toe = add(j[`toe.${s}`], [0, 0, 0.05]);
    bones.push(
      { name: `upperArm.${s}`, parent: "chest", pos: j[`shoulder.${s}`], slot: S.shoulders, seg: [j[`shoulder.${s}`], j[`elbow.${s}`]], rad: 0.045 },
      { name: `foreArm.${s}`, parent: `upperArm.${s}`, pos: j[`elbow.${s}`], slot: S.gloves, seg: [j[`elbow.${s}`], j[`hand.${s}`]], rad: 0.035 },
      { name: `hand.${s}`, parent: `foreArm.${s}`, pos: j[`hand.${s}`], slot: S.gloves, seg: [j[`hand.${s}`], fingers], rad: 0.03 },
      { name: `thigh.${s}`, parent: "hips", pos: j[`upperLeg.${s}`], slot: S.pants, seg: [j[`upperLeg.${s}`], j[`knee.${s}`]], rad: 0.07 },
      { name: `shin.${s}`, parent: `thigh.${s}`, pos: j[`knee.${s}`], slot: S.boots, seg: [j[`knee.${s}`], j[`ankle.${s}`]], rad: 0.045 },
      { name: `foot.${s}`, parent: `shin.${s}`, pos: j[`ankle.${s}`], slot: S.boots, seg: [j[`ankle.${s}`], toe], rad: 0.035 },
    );
  }

  // envelope skinning: weight falls off with the distance outside each bone's capsule
  const skinIndex = new Uint16Array(n * 4), skinWeight = new Float32Array(n * 4), slot = new Float32Array(n);
  const w = new Float32Array(bones.length);
  const p: V = [0, 0, 0];
  for (let i = 0; i < n; i++) {
    p[0] = position[i * 3]; p[1] = position[i * 3 + 1]; p[2] = position[i * 3 + 2];
    for (let b = 0; b < bones.length; b++) {
      const bd = bones[b];
      const d = Math.max(0, distSeg(p, bd.seg[0], bd.seg[1], bd.sx ?? 1) - bd.rad);
      const e = d + 0.012;
      w[b] = 1 / (e * e * e * e);
    }
    const order: number[] = [];
    for (let k = 0; k < 4; k++) {
      let best = -1;
      for (let b = 0; b < bones.length; b++) if (!order.includes(b) && (best < 0 || w[b] > w[best])) best = b;
      order.push(best);
    }
    const sum = order.reduce((s, b) => s + w[b], 0) || 1;
    order.forEach((b, k) => { skinIndex[i * 4 + k] = b; skinWeight[i * 4 + k] = w[b] / sum; });
    slot[i] = bones[order[0]].slot;
  }

  const data: BodyData = { bones, joint, armDir, position, index, skinIndex, skinWeight, slot };
  cache.set(g, data);
  return data;
}

export function bodyGeometry(d: BodyData) {
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(d.position, 3));
  g.setIndex(new THREE.BufferAttribute(d.index, 1));
  g.computeVertexNormals();
  g.setAttribute("skinIndex", new THREE.Uint16BufferAttribute(d.skinIndex, 4));
  g.setAttribute("skinWeight", new THREE.BufferAttribute(d.skinWeight, 4));
  g.setAttribute("aSlot", new THREE.BufferAttribute(d.slot, 1));
  g.computeBoundingSphere();
  return g;
}

/** Bones in bind pose (local offsets from their parents). */
export function bodySkeleton(d: { bones: BoneDef[] }) {
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
