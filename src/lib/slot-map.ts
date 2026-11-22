import type { SlotKind } from "./types";

/** Which catalog slots fit an in-game equipment slot. */
export const CATALOG_SLOTS: Partial<Record<SlotKind, string[]>> = {
  weapon: ["Greatsword", "Longsword", "Dagger", "Bow", "Spellbook", "Orb", "Mace", "Staff", "Gauntlet", "Fist"],
  offhand: ["Guard"],
  torso: ["Breastplate", "Top"],
  pants: ["Greaves", "Legs"],
  helmet: ["Helm"],
  shoulders: ["Pauldrons"],
  gloves: ["Gloves"],
  boots: ["Boots", "Shoes"],
  cape: ["Cloak"],
  necklace: ["Necklace"],
  earring: ["Earrings"],
  ring: ["Ring"],
  bracelet: ["Bracelet"],
  belt: ["Belt"],
  amulet: ["Amulet"],
  rune: ["Rune"],
};

/** Weapon type → classes that use it (armor and jewellery fit every class). */
export const WEAPON_CLASSES: Record<string, string[]> = {
  Greatsword: ["Gladiator"], Longsword: ["Templar"], Guard: ["Templar", "Cleric", "Spiritmaster"],
  Dagger: ["Assassin"], Bow: ["Ranger"], Spellbook: ["Sorcerer"], Orb: ["Spiritmaster"],
  Mace: ["Cleric"], Staff: ["Chanter"], Gauntlet: ["Fighter"], Fist: ["Fighter"],
};

export const CLASSES = ["Gladiator", "Templar", "Assassin", "Ranger", "Sorcerer", "Spiritmaster", "Cleric", "Chanter", "Fighter"];

export function fitsClass(slot: string, cls: string | undefined) {
  if (!cls) return true;
  const c = WEAPON_CLASSES[slot];
  return !c || c.includes(cls);
}
