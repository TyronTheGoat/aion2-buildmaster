import type { SlotKind } from "../types";

/**
 * Lines top players carry per slot (share in %), from kisk.app/scoring
 * (cielui count of Korean ranked PvE players, 2026-10-19).
 * Only Spiritmaster is filled in for now; other classes fall back to "unknown".
 */
export type IdealTable = Partial<Record<SlotKind, Record<string, number>>>;

export const IDEAL_LINES: Record<string, IdealTable> = {
  spiritmaster: {
    weapon: { "Weapon Damage Boost": 100, "Combat Speed": 100, Might: 100, "Damage Boost": 100, Precision: 99, "Multi-hit Chance": 97, Attack: 76, "Status Effect Accuracy": 18 },
    offhand: { "Weapon Damage Boost": 100, "Combat Speed": 100, Might: 100, "Damage Boost": 100, Precision: 99, "Multi-hit Chance": 97, Attack: 85, "Status Effect Accuracy": 4 },
    torso: { "Damage Boost": 100, "Perfect Chance": 97, Attack: 96, Accuracy: 36, "Critical Hit": 31, "Defense increase": 24, "Status Effect Resist": 7, Constitution: 7 },
    pants: { "Attack increase": 99, "Damage Tolerance": 98, "Perfect Chance": 96, Attack: 85, Accuracy: 8, "Critical Hit": 7, "Status Effect Resist": 5, Endurance: 4 },
    helmet: { "Attack increase": 100, "Double Chance": 100, Attack: 90, "Incoming Heal": 38, Accuracy: 10, "Critical Hit": 9, "Weapon Damage Tolerance": 5, Endurance: 4 },
    shoulders: { "Critical Damage Boost": 100, "Double Chance": 99, Attack: 97, Accuracy: 33, "Critical Hit": 30, "Defense increase": 20, Constitution: 3, Endurance: 3 },
    gloves: { "Combat Speed": 100, "Perfect Chance": 97, Attack: 94, "Critical Hit": 17, "Defense increase": 15, Accuracy: 14, "Endurance Penetration": 1, "Status Effect Resist": 1 },
    boots: { "Move Speed": 100, "Perfect Chance": 96, Attack: 93, Accuracy: 16, "Critical Hit": 15, "Defense increase": 15, Regeneration: 1 },
    cape: { "Attack increase": 99, "Double Chance": 99, "Perfect Chance": 97, Attack: 76, "Critical Damage Tolerance": 12, Accuracy: 5, "Weapon Damage Tolerance": 5, "Critical Hit": 3 },
    necklace: { "Combat Speed": 100, Might: 100, Attack: 100, Precision: 99, Accuracy: 87, "Critical Hit": 83 },
    earring: { "Move Speed": 100, Might: 100, Attack: 100, Precision: 99, Accuracy: 89, "Critical Hit": 89, HP: 1 },
    ring: { Might: 100, Precision: 99, Attack: 97, "Critical Hit": 34, Accuracy: 25 },
    bracelet: { "Destruction [Zikel]": 100, "Illusion [Kaisinel]": 100, "Time [Siel]": 100, "Wisdom [Lumiel]": 98, "Justice [Nezekan]": 90, "Freedom [Vaizel]": 59, "Death [Triniel]": 51, "Space [Israphel]": 20 },
  },
};

export function classKey(className?: string): string | undefined {
  if (!className) return undefined;
  const k = className.toLowerCase().replace(/[^a-z]/g, "");
  return IDEAL_LINES[k] ? k : undefined;
}

/** Share (0-100) of a line on a slot, or undefined if the class/slot is unknown. */
export function lineShare(className: string | undefined, slot: SlotKind, line: string): number | undefined {
  const k = classKey(className);
  if (!k) return undefined;
  const table = IDEAL_LINES[k][slot];
  if (!table) return undefined;
  const hit = Object.entries(table).find(([n]) => n.toLowerCase() === line.toLowerCase());
  return hit ? hit[1] : 0;
}

/** Best target lines for a slot that the item does not yet have. */
export function missingIdealLines(className: string | undefined, slot: SlotKind, have: string[], n = 3): string[] {
  const k = classKey(className);
  if (!k) return [];
  const table = IDEAL_LINES[k][slot];
  if (!table) return [];
  const haveLc = new Set(have.map((h) => h.toLowerCase()));
  return Object.entries(table)
    .filter(([name, share]) => share >= 50 && !haveLc.has(name.toLowerCase()))
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([name]) => name);
}
