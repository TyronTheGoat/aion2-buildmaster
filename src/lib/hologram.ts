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

/** Aura color per grade (same hues as the grade badges). Unrated items get no aura. */
export const GRADE_HEX: Record<Grade, number | null> = {
  BiS: 0xffc53d, "S+": 0xe64bff, S: 0x9b6bff, A: 0x3ad0ff,
  B: 0x34e39a, C: 0xb8c0cc, D: 0xff3b3b, "?": null,
};

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
