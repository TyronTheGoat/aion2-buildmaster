import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import type { WeaponKind } from "@/lib/hologram";
import { fetchAsset } from "./assets";
import type { IntroId } from "./intro";

/**
 * Class weapons from the "Hologram Waffen V2" pack: ten original GLB archetypes
 * (origin = grip, +Y = towards the tip, front = +Z, metres).
 *
 * Each class gets its loadout (class_loadouts.json). How a weapon sits in the hand is a "hold": the socket
 * on the body plus an orientation. These holds are calibrated for the current static A-pose models; a rigged
 * model only needs its own holds (socket = hand bone), the rest of the pipeline stays the same.
 */

export type WeaponModelId =
  | "greatsword" | "longsword" | "dagger" | "bow" | "spellbook" | "orb" | "mace" | "staff" | "guard" | "cleric_shield";

type V = [number, number, number];

export interface Hold {
  /** palm of the hand, the forearm (shields) or floating beside the palm (orb, book) */
  socket: "hand" | "forearm" | "float";
  side: "L" | "R";
  /** direction of the weapon's +Y axis in the A-pose, for the character's left side (x is mirrored for the right) */
  dir: V;
  /** direction the weapon's front (+Z) should roughly face */
  face: V;
  scale: number;
  /** offset from the socket in metres (x mirrored for the right side) */
  offset?: V;
}

export interface Loadout {
  main: WeaponModelId;
  hold: Hold;
  /** second instance: left dagger, or the orb that only appears during the intro */
  second?: { hold: Hold; introOnly?: boolean };
  /** shown only when an offhand item is equipped */
  offhand?: { model: WeaponModelId; hold: Hold };
  intro: IntroId;
}

const DOWN_FWD: V = [0.42, -0.84, 0.34];
const SHIELD: Hold = { socket: "forearm", side: "L", dir: [0.25, 0.95, 0.1], face: [0.85, 0, 0.55], scale: 0.62, offset: [0.07, 0, 0.02] };

export const LOADOUTS: Record<WeaponKind, Loadout> = {
  greatsword: { main: "greatsword", hold: { socket: "hand", side: "R", dir: [0.12, 1, 0.12], face: [0, 0, 1], scale: 0.9 }, intro: "heavy_twohand_draw" },
  sword: {
    main: "longsword", hold: { socket: "hand", side: "R", dir: DOWN_FWD, face: [0, 0, 1], scale: 1 },
    offhand: { model: "guard", hold: SHIELD }, intro: "guardian_draw_and_brace",
  },
  dagger: {
    main: "dagger", hold: { socket: "hand", side: "R", dir: [0.2, -0.9, 0.38], face: [0, 0, 1], scale: 1 },
    second: { hold: { socket: "hand", side: "L", dir: [0.2, -0.9, 0.38], face: [0, 0, 1], scale: 1 } }, intro: "twin_dagger_cross",
  },
  bow: { main: "bow", hold: { socket: "hand", side: "L", dir: [0.05, 1, 0.04], face: [0, 0, 1], scale: 1 }, intro: "bow_aim_focus" },
  spellbook: { main: "spellbook", hold: { socket: "float", side: "L", dir: [0, 0.82, 0.57], face: [0, 0.57, 0.82], scale: 0.7, offset: [0.06, 0.16, 0.12] }, intro: "spellbook_awakening" },
  orb: {
    main: "orb", hold: { socket: "float", side: "R", dir: [0, 1, 0], face: [0, 0, 1], scale: 0.6, offset: [0.1, 0.13, 0.09] },
    second: { hold: { socket: "float", side: "L", dir: [0, 1, 0], face: [0, 0, 1], scale: 0.6, offset: [0.1, 0.13, 0.09] }, introOnly: true },
    intro: "orb_dual_summon",
  },
  mace: {
    main: "mace", hold: { socket: "hand", side: "R", dir: DOWN_FWD, face: [0, 0, 1], scale: 1 },
    offhand: { model: "cleric_shield", hold: SHIELD }, intro: "healer_bless_and_guard",
  },
  staff: { main: "staff", hold: { socket: "hand", side: "R", dir: [0.04, 1, 0.03], face: [0, 0, 1], scale: 1 }, intro: "chanter_circular_staff_guard" },
  polearm: { main: "staff", hold: { socket: "hand", side: "R", dir: [0.04, 1, 0.03], face: [0, 0, 1], scale: 1 }, intro: "chanter_circular_staff_guard" },
};

/** Orientation of a hold: the weapon's +Y along dir, its front towards face (both mirrored for the right side). */
export function holdQuaternion(h: Hold) {
  const sx = h.side === "L" ? 1 : -1;
  const y = new THREE.Vector3(h.dir[0] * sx, h.dir[1], h.dir[2]).normalize();
  const f = new THREE.Vector3(h.face[0] * sx, h.face[1], h.face[2]);
  const x = new THREE.Vector3().crossVectors(y, f).normalize();
  const z = new THREE.Vector3().crossVectors(x, y).normalize();
  return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
}
export const holdOffset = (h: Hold) => new THREE.Vector3((h.offset?.[0] ?? 0) * (h.side === "L" ? 1 : -1), h.offset?.[1] ?? 0, h.offset?.[2] ?? 0);

export interface WeaponPart { geometry: THREE.BufferGeometry; strength: number }
export interface WeaponModel { id: WeaponModelId; parts: WeaponPart[]; box: THREE.Box3 }

const cache = new Map<WeaponModelId, Promise<WeaponModel | null>>();

/** Loads one weapon GLB as plain geometry per material group; null when it is not installed. */
export function loadWeapon(id: WeaponModelId): Promise<WeaponModel | null> {
  let p = cache.get(id);
  if (!p) {
    p = load(id).catch((e) => { console.warn("Waffenmodell nicht geladen:", id, e); return null; });
    cache.set(id, p);
  }
  return p;
}

async function load(id: WeaponModelId): Promise<WeaponModel | null> {
  const buf = await fetchAsset(`weapons/bildmaster_${id}_hologram_v2.glb`);
  if (!buf) return null;
  const gltf = await new GLTFLoader().parseAsync(buf, "");
  gltf.scene.updateMatrixWorld(true);
  const parts: WeaponPart[] = [];
  const box = new THREE.Box3();
  gltf.scene.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const g = m.geometry.clone();
    g.applyMatrix4(m.matrixWorld);
    if (!g.getAttribute("normal")) g.computeVertexNormals();
    g.computeBoundingBox();
    box.union(g.boundingBox!);
    // the pack's material groups go from dark core to white highlights: keep that as hologram brightness
    const mat = m.material as THREE.MeshStandardMaterial;
    const e = mat.emissive ?? new THREE.Color(0.3, 0.6, 0.8);
    const lum = 0.2126 * e.r + 0.7152 * e.g + 0.0722 * e.b;
    parts.push({ geometry: g, strength: 0.3 + 1.1 * Math.min(1, lum * 1.15) });
  });
  return parts.length ? { id, parts, box } : null;
}

/** All models a class needs (main, offhand); missing files resolve to null. */
export async function loadLoadout(kind: WeaponKind, offhand: boolean) {
  const lo = LOADOUTS[kind];
  const [main, off] = await Promise.all([
    loadWeapon(lo.main),
    offhand && lo.offhand ? loadWeapon(lo.offhand.model) : Promise.resolve(null),
  ]);
  return { loadout: lo, main, offhand: off };
}
export type LoadedLoadout = Awaited<ReturnType<typeof loadLoadout>>;
