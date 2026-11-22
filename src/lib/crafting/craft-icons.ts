import { iconFor, localIcon } from "@/lib/knowledge/item-catalog";
import files from "../../../data/craft-icon-files.json";

/**
 * Original icons for crafting items (materials, intermediates, crafted gear), by item ID.
 * Filled from the icon files the player sends (public/item-icons/craft/<item_id>.png|webp); nothing is drawn or guessed.
 */
const CRAFT_ICONS = files as Record<string, string>;

/** Icon for a catalogue entry: the known gear icon first, then the crafting icon of the same item ID. */
export function craftIcon(e: { name: string; itemId?: string }): string | undefined {
  return iconFor(e) ?? (e.itemId && CRAFT_ICONS[e.itemId] ? localIcon(CRAFT_ICONS[e.itemId]) : undefined);
}
