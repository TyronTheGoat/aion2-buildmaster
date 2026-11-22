import { iconFor, localIcon } from "@/lib/knowledge/item-catalog";
import files from "../../../data/craft-icon-files.json";
import { normName } from "./model";

/**
 * Original icons for crafting items (materials, intermediates, crafted gear), by item ID.
 * Filled from the icon files the player sends (public/item-icons/craft/<item_id>.png|webp, original NCSOFT CDN files); nothing is drawn or guessed.
 */
const CRAFT_ICONS = files as Record<string, string>;

/** Icon for a catalogue entry: the known gear icon first, then the crafting icon of the same item ID. */
export function craftIcon(e: { name: string; itemId?: string; faction?: string }): string | undefined {
  const known = iconFor(e);
  if (known) return known;
  // by item ID; recipe results without an ID in the recipe data by name + faction (ID found with the icon)
  const local = (e.itemId && CRAFT_ICONS[e.itemId]) || CRAFT_ICONS[`n:${normName(e.name)}@${(e.faction ?? "").toLowerCase()}`];
  return local ? localIcon(local) : undefined;
}
