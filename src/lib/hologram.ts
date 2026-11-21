import type { Character, Grade, Item, SlotKind } from "./types";

export type Gender = "f" | "m";

export type WeaponKind =
  | "orb" | "spellbook" | "sword" | "greatsword" | "staff" | "bow" | "mace" | "dagger" | "polearm";

const WEAPON_RULES: [RegExp, WeaponKind][] = [
  [/\bgreatsword\b/i, "greatsword"],
  [/\borb\b/i, "orb"],
  [/\b(spellbook|tome|grimoire)\b/i, "spellbook"],
  [/\bstaff\b/i, "staff"],
  [/\bbow\b/i, "bow"],
  [/\bmace\b/i, "mace"],
  [/\bdagger\b/i, "dagger"],
  [/\bpolearm\b/i, "polearm"],
  [/\b(longsword|sword)\b/i, "sword"],
];

/** Main weapon of each class, used when the weapon name does not say it. */
const CLASS_WEAPON: Record<string, WeaponKind> = {
  gladiator: "greatsword", templar: "sword", assassin: "dagger", ranger: "bow",
  sorcerer: "spellbook", spiritmaster: "orb", cleric: "mace", chanter: "staff",
};

/** Which generic base weapon the hologram holds: from the weapon's name, else from the class. */
export function weaponKindFor(char: Pick<Character, "className" | "gear">): WeaponKind {
  const weapon = char.gear.find((i) => i.slot === "weapon");
  if (weapon) for (const [re, kind] of WEAPON_RULES) if (re.test(weapon.name)) return kind;
  return CLASS_WEAPON[(char.className ?? "").toLowerCase().replace(/[^a-z]/g, "")] ?? "sword";
}

/** Slots that are shown on the hologram body. Runes, amulet and arcana have no place on the model. */
export const BODY_SLOTS: SlotKind[] = [
  "weapon", "offhand", "helmet", "shoulders", "torso", "gloves", "pants", "boots", "cape",
  "necklace", "earring", "ring", "bracelet", "belt",
];

/**
 * Aura per grade: a clearly different hue per tier, and a strength level that drives
 * brightness, rim width, shell thickness and energy flow (BiS strongest, D faint).
 * Unrated items get no aura.
 */
export const GRADE_HEX: Record<Grade, number | null> = {
  BiS: 0xffc23a, "S+": 0xff3ccf, S: 0x9d5cff, A: 0x3cff6e,
  B: 0xd8f23a, C: 0xa7b0bd, D: 0xff3a24, "?": null,
};
export const GRADE_LEVEL: Record<Grade, number> = {
  BiS: 1, "S+": 0.84, S: 0.7, A: 0.5, B: 0.36, C: 0.24, D: 0.14, "?": 0,
};
export const LEGEND_GRADES: Grade[] = ["BiS", "S+", "S", "A", "B", "C", "D"];
export const hexCss = (g: Grade) => `#${(GRADE_HEX[g] ?? 0x5b6b80).toString(16).padStart(6, "0")}`;

export interface SlotRef { slot: SlotKind; index: number }

export const slotId = (r: SlotRef) => `${r.slot}:${r.index}`;

/** Items on the body, by slot and position (rings, earrings and bracelets come in pairs). */
export function bodyItems(char: Pick<Character, "gear">): Map<string, Item> {
  const seen: Partial<Record<SlotKind, number>> = {};
  const map = new Map<string, Item>();
  for (const item of char.gear) {
    if (!BODY_SLOTS.includes(item.slot)) continue;
    const index = seen[item.slot] ?? 0;
    seen[item.slot] = index + 1;
    map.set(slotId({ slot: item.slot, index }), item);
  }
  return map;
}
