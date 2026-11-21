import type { SlotKind } from "../types";

export const SLOT_LABEL_DE: Record<SlotKind, string> = {
  weapon: "Waffe", offhand: "Nebenhand", torso: "Brust", pants: "Hose", helmet: "Helm",
  shoulders: "Schultern", gloves: "Handschuhe", boots: "Stiefel", cape: "Umhang",
  necklace: "Halskette", earring: "Ohrring", ring: "Ring", bracelet: "Armband",
  belt: "Gürtel", rune: "Rune", amulet: "Amulett", arcana: "Arcana", unknown: "Unbekannt",
};

/** How much a slot matters when ordering upgrades (rough DPS impact). */
export const SLOT_WEIGHT: Record<SlotKind, number> = {
  weapon: 1.4, offhand: 1.15, necklace: 1.1, earring: 1.05, ring: 1.05, arcana: 1.1,
  torso: 1, pants: 1, helmet: 1, shoulders: 1, gloves: 1, boots: 1, cape: 1,
  bracelet: 0.9, belt: 0.5, rune: 0.5, amulet: 0.5, unknown: 0.5,
};

const RULES: [RegExp, SlotKind][] = [
  [/\b(chalice|parchment|compass|bell|mirror)\s+of\b/i, "arcana"],
  [/\b(orb|sword|greatsword|staff|spellbook|tome|bow|mace|dagger|polearm|cannon|harp|cipher|gun|jewel)\b/i, "weapon"],
  [/\b(guard|shield)\b/i, "offhand"],
  [/\b(breastplate|chest|jerkin|robe|hauberk|tunic|armor)\b/i, "torso"],
  [/\b(greaves|pants|leggings|chausses|breeches)\b/i, "pants"],
  [/\b(helm|helmet|hat|hood|headgear)\b/i, "helmet"],
  [/\b(pauldrons|shoulders|spaulders|shoulderguards)\b/i, "shoulders"],
  [/\b(gloves|gauntlets|handguards)\b/i, "gloves"],
  [/\b(boots|shoes|sabatons)\b/i, "boots"],
  [/\b(cloak|cape|mantle)\b/i, "cape"],
  [/\bnecklace\b/i, "necklace"],
  [/\bearrings?\b/i, "earring"],
  [/\brings?\b/i, "ring"],
  [/\bbracelets?\b/i, "bracelet"],
  [/\bbelt\b/i, "belt"],
  [/\brunes?\b/i, "rune"],
  [/\bamulet\b/i, "amulet"],
];

export function slotFromName(name: string): SlotKind {
  for (const [re, slot] of RULES) if (re.test(name)) return slot;
  return "unknown";
}

/** Slots kisk scores; others (belt, runes, amulet) are listed as "unscored". */
export const SCORED_SLOTS: SlotKind[] = [
  "weapon", "offhand", "torso", "pants", "helmet", "shoulders", "gloves", "boots",
  "cape", "necklace", "earring", "ring", "bracelet", "arcana",
];
