import type { Character, Item } from "./types";
import { ALL_ITEMS, type CatalogItem } from "./knowledge/item-catalog";
import { isPublic } from "./region";

/** Main weapon of each class (the off-hand Guard is handled by slot). */
const CLASS_WEAPON: Record<string, string> = {
  Gladiator: "Greatsword", Templar: "Longsword", Assassin: "Dagger", Ranger: "Bow", Sorcerer: "Spellbook",
  Spiritmaster: "Orb", Cleric: "Mace", Chanter: "Staff",
};
const SLOT_PIECE: Partial<Record<Item["slot"], string>> = {
  offhand: "Guard", helmet: "Helm", torso: "Top", pants: "Legs", shoulders: "Pauldrons", gloves: "Gloves",
  boots: "Shoes", cape: "Cloak", necklace: "Necklace", earring: "Earrings", ring: "Ring",
};

/**
 * Best in slot = the highest crafted piece released in AION 2 Global (Splendent Wise / Ebony Dragon Lord, IL 102).
 * Wise is the light (Elyos) line, Ebony the dark (Asmodian) line. Slots without a crafting recipe
 * (belt, rune, amulet, bracelet, Arcana) return undefined.
 */
export function craftedBis(char: Pick<Character, "className" | "race">, slot: Item["slot"]): CatalogItem | undefined {
  const piece = slot === "weapon" ? CLASS_WEAPON[char.className ?? ""] : SLOT_PIECE[slot];
  if (!piece) return undefined;
  const faction = /asmod/i.test(char.race ?? "") ? "Asmodier" : /elyos/i.test(char.race ?? "") ? "Elyos" : undefined;
  const all = ALL_ITEMS.filter((i) => i.crafted && i.slot === piece && isPublic(i));
  return all.find((i) => i.faction === faction) ?? (faction ? undefined : all[0]);
}
