import data from "../../data/item-names-de.json";
import { currentLang } from "./i18n";

/**
 * German item names as the German client shows them, looked up (never translated by us):
 * from the gamewith.ai AION2 database in German and English side by side (see data/item-names-de.json).
 * Unknown names stay English.
 */
const IDS = data.ids as Record<string, string>;
const NAMES = data.names as Record<string, string>;
const FACTION = /\s*\((elyos|asmodian|asmodier)\)\s*$/i;
const norm = (s: string) => s.replace(/[’‘`´]/g, "'").replace(FACTION, "").replace(/\s+/g, " ").trim().toLowerCase();

/** Item name for the UI language; the faction tag of a name is kept. */
export function itemLabel(name: string, lang: "en" | "de", itemId?: string): string {
  if (lang === "en") return name;
  const de = NAMES[norm(name)] ?? (itemId ? IDS[itemId] : undefined);
  if (!de) return name;
  const tag = name.match(FACTION)?.[0];
  return tag ? de + tag : de;
}
export const hasGermanItem = (name: string) => norm(name) in NAMES;
/** Item name in the current UI language. */
export const itemName = (name: string, itemId?: string) => itemLabel(name, currentLang(), itemId);
