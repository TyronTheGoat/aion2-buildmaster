import type { BoneName } from "./body";

/**
 * Class intros on character select, after config/animation_blueprints_v2.json of the weapon pack.
 *
 * A blueprint is pure data on one timeline (seconds):
 *  - weapon / second / offhand: tracks for the weapon objects relative to their rest hold
 *    (s = scale, glow = brightness, c = move towards the chest, x = sideways towards the other hand, y = lift,
 *     r = rotation in the hold frame, rad)
 *  - effects: light flashes, rune rings and spark bursts
 *  - pose: bone rotations for bodies that can move. The current Bildmaster models have no rig, so only the
 *    weapon and light tracks play; a rigged model gets the arm choreography from the same blueprint.
 * Blueprint rule kept: no fake limb motion without a rig.
 */

export type IntroId =
  | "heavy_twohand_draw" | "guardian_draw_and_brace" | "twin_dagger_cross" | "bow_aim_focus"
  | "spellbook_awakening" | "orb_dual_summon" | "healer_bless_and_guard" | "chanter_circular_staff_guard";

type V = [number, number, number];
export interface Key { t: number; s?: number; glow?: number; c?: number; x?: number; y?: number; r?: V }
export interface Effect { t: number; kind: "flash" | "ring" | "burst" | "groundRing"; at: "weapon" | "tip" | "second" | "offhand" | "chest" | "ground"; size?: number }
export interface Blueprint {
  duration: number;
  /** fade from the last intro frame into the idle */
  crossfade: number;
  weapon: Key[];
  second?: Key[];
  offhand?: Key[];
  effects: Effect[];
  pose?: { t: number; bones: Partial<Record<BoneName, V>> }[];
}

const appear = (t: number): Key[] => [{ t: 0, s: 0, glow: 0 }, { t, s: 1, glow: 2.2 }];

export const INTROS: Record<IntroId, Blueprint> = {
  orb_dual_summon: {
    duration: 1.85, crossfade: 0.28,
    // one orb above each palm, both glide in and cross in front of the chest, hold, part again; the second dissolves
    weapon: [{ t: 0, s: 0, glow: 0 }, { t: 0.32, s: 1, glow: 2, c: 0 }, { t: 0.73, c: 1, x: 0.09 }, { t: 1.06, c: 1, x: 0.09, glow: 2.6 }, { t: 1.35, c: 0.35, x: 0, glow: 1.6 }, { t: 1.85, c: 0, glow: 1 }],
    second: [{ t: 0, s: 0, glow: 0 }, { t: 0.32, s: 1, glow: 2, c: 0 }, { t: 0.73, c: 1, x: 0.09 }, { t: 1.06, c: 1, x: 0.09, glow: 2.6 }, { t: 1.35, c: 0.35, x: 0, s: 0.9 }, { t: 1.7, s: 0, glow: 0 }],
    effects: [
      { t: 0.32, kind: "flash", at: "weapon" }, { t: 0.32, kind: "flash", at: "second" },
      { t: 1.06, kind: "ring", at: "chest", size: 0.9 }, { t: 1.06, kind: "flash", at: "chest", size: 1.4 },
      { t: 1.6, kind: "burst", at: "second" },
    ],
    pose: [
      { t: 0, bones: {} },
      { t: 0.32, bones: { "upperArm.R": [-0.3, 0, 0.1], "foreArm.R": [-0.6, 0, 0], "upperArm.L": [-0.3, 0, -0.1], "foreArm.L": [-0.6, 0, 0] } },
      { t: 0.73, bones: { "upperArm.R": [-0.9, 0.5, 0.6], "foreArm.R": [-1.3, 0.3, 0], "upperArm.L": [-0.9, -0.5, -0.6], "foreArm.L": [-1.3, -0.3, 0] } },
      { t: 1.06, bones: { "upperArm.R": [-0.95, 0.55, 0.62], "foreArm.R": [-1.35, 0.3, 0], "upperArm.L": [-0.95, -0.55, -0.62], "foreArm.L": [-1.35, -0.3, 0] } },
      { t: 1.35, bones: { "upperArm.R": [-0.4, 0, 0.25], "foreArm.R": [-0.9, 0.2, 0], "upperArm.L": [-0.2, 0, -0.2], "foreArm.L": [-0.5, 0, 0] } },
    ],
  },
  spellbook_awakening: {
    duration: 1.85, crossfade: 0.28,
    weapon: [{ t: 0, s: 0, glow: 0, y: -0.12, r: [-1.2, 0, 0] }, { t: 0.32, s: 1, glow: 0.8, y: -0.05, r: [-1.2, 0, 0] }, { t: 0.74, y: 0.04, r: [0, 0, 0], glow: 2.2 }, { t: 1.25, glow: 2.8 }, { t: 1.85, y: 0, glow: 1 }],
    effects: [{ t: 0.74, kind: "flash", at: "weapon" }, { t: 1.25, kind: "ring", at: "weapon", size: 0.8 }],
  },
  heavy_twohand_draw: {
    duration: 1.85, crossfade: 0.28,
    weapon: [{ t: 0, s: 0, glow: 0, r: [0.55, 0, 0] }, { t: 0.35, s: 1, glow: 1.4, r: [0.55, 0, 0] }, { t: 0.85, r: [0.2, 0, -0.15], glow: 2.4 }, { t: 1.32, r: [0, 0, 0], glow: 1.8 }, { t: 1.85, glow: 1 }],
    effects: [{ t: 0.35, kind: "flash", at: "weapon" }, { t: 1.32, kind: "flash", at: "tip", size: 1.2 }, { t: 1.32, kind: "groundRing", at: "ground", size: 1.2 }],
  },
  guardian_draw_and_brace: {
    duration: 1.85, crossfade: 0.28,
    weapon: [{ t: 0, s: 0, glow: 0, r: [0.25, 0, 0] }, { t: 0.32, s: 1, glow: 1.6 }, { t: 0.67, r: [0, 0, 0] }, { t: 1.18, glow: 2 }, { t: 1.85, glow: 1 }],
    offhand: [{ t: 0, s: 0, glow: 0, r: [0, 0.9, 0] }, { t: 0.45, s: 1, glow: 1.2, r: [0, 0.9, 0] }, { t: 1.18, r: [0, 0, 0], glow: 2.6 }, { t: 1.85, glow: 1 }],
    effects: [{ t: 0.32, kind: "flash", at: "weapon" }, { t: 1.18, kind: "ring", at: "offhand", size: 1.1 }],
  },
  twin_dagger_cross: {
    duration: 1.75, crossfade: 0.28,
    weapon: [...appear(0.37), { t: 0.81, glow: 2.6 }, { t: 1.21, glow: 1.4 }, { t: 1.75, glow: 1 }],
    second: [...appear(0.37), { t: 0.81, glow: 2.6 }, { t: 1.21, glow: 1.4 }, { t: 1.75, glow: 1 }],
    effects: [{ t: 0.1, kind: "flash", at: "weapon" }, { t: 0.1, kind: "flash", at: "second" }, { t: 0.81, kind: "flash", at: "chest", size: 1.2 }, { t: 0.81, kind: "burst", at: "chest" }],
  },
  bow_aim_focus: {
    duration: 1.85, crossfade: 0.28,
    weapon: [{ t: 0, s: 0, glow: 0 }, { t: 0.42, s: 1, glow: 1.4 }, { t: 0.83, glow: 2.8 }, { t: 1.29, glow: 1.6 }, { t: 1.85, glow: 1 }],
    effects: [{ t: 0.42, kind: "flash", at: "weapon" }, { t: 0.83, kind: "ring", at: "weapon", size: 0.7 }],
  },
  healer_bless_and_guard: {
    duration: 1.85, crossfade: 0.28,
    weapon: [{ t: 0, s: 0, glow: 0 }, { t: 0.38, s: 1, glow: 1.4, r: [-0.25, 0, 0] }, { t: 0.86, glow: 2.6 }, { t: 1.21, r: [0, 0, 0] }, { t: 1.85, glow: 1 }],
    offhand: [{ t: 0, s: 0, glow: 0, r: [0, 0.7, 0] }, { t: 0.5, s: 1, glow: 1.2, r: [0, 0.7, 0] }, { t: 1.21, r: [0, 0, 0], glow: 1.8 }, { t: 1.85, glow: 1 }],
    effects: [{ t: 0.38, kind: "flash", at: "weapon" }, { t: 0.86, kind: "ring", at: "tip", size: 1.2 }, { t: 0.86, kind: "groundRing", at: "ground", size: 1.4 }],
  },
  chanter_circular_staff_guard: {
    duration: 1.85, crossfade: 0.28,
    weapon: [{ t: 0, s: 0, glow: 0, r: [0, 0, 0] }, { t: 0.33, s: 1, glow: 1.4, r: [0, 0, 0] }, { t: 0.76, r: [0, Math.PI, 0], glow: 2 }, { t: 1.23, r: [0, Math.PI * 2, 0], glow: 2.6 }, { t: 1.85, glow: 1 }],
    effects: [{ t: 0.33, kind: "flash", at: "weapon" }, { t: 1.23, kind: "groundRing", at: "ground", size: 1.5 }, { t: 1.23, kind: "flash", at: "tip", size: 1.1 }],
  },
};

const smooth = (k: number) => k * k * (3 - 2 * k);

/** Value of one channel at time t (eased between keys; holds the last value). */
export function sample(keys: Key[], t: number, ch: "s" | "glow" | "c" | "x" | "y", fallback: number): number {
  let prev: Key | undefined, next: Key | undefined;
  for (const k of keys) {
    if (k[ch] === undefined) continue;
    if (k.t <= t) prev = k; else { next = k; break; }
  }
  if (!prev) return next ? (next[ch] as number) : fallback;
  if (!next) return prev[ch] as number;
  return (prev[ch] as number) + ((next[ch] as number) - (prev[ch] as number)) * smooth((t - prev.t) / (next.t - prev.t));
}
export function sampleRot(keys: { t: number; r?: V }[], t: number): V {
  let prev: { t: number; r?: V } | undefined, next: { t: number; r?: V } | undefined;
  for (const k of keys) {
    if (!k.r) continue;
    if (k.t <= t) prev = k; else { next = k; break; }
  }
  if (!prev) return next?.r ?? [0, 0, 0];
  if (!next) return prev.r!;
  const k = smooth((t - prev.t) / (next.t - prev.t));
  return [0, 1, 2].map((i) => prev!.r![i] + (next!.r![i] - prev!.r![i]) * k) as V;
}
/** Bone pose at time t, as rotation offsets (only bones the blueprint names). */
export function samplePose(bp: Blueprint, t: number): Partial<Record<BoneName, V>> {
  const out: Partial<Record<BoneName, V>> = {};
  if (!bp.pose?.length) return out;
  const names = new Set(bp.pose.flatMap((p) => Object.keys(p.bones))) as Set<BoneName>;
  // the pose returns to the idle (zero offset) at the end of the intro
  const keys = [...bp.pose, { t: bp.duration, bones: {} }];
  for (const name of names) {
    out[name] = sampleRot(keys.map((p) => ({ t: p.t, r: p.bones[name] ?? [0, 0, 0] })), t);
  }
  return out;
}
