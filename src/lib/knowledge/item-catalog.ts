import catalog from "./item-catalog.json";

export type Region = "EU" | "TW";

/** Why an item counts for a region: which source showed it there. */
export interface RegionEvidence {
  region: Region;
  source: string;
  url?: string;
  date?: string;
}

/** One gear item from all sources we have, with region evidence and (only verified) original icon. */
export interface CatalogItem {
  key: string;
  name: string;
  itemId: string;
  source: string;
  category: string;
  slot: string;
  level: number | null;
  rarity: string;
  faction: string;
  /** Original icon: local file under /item-icons or NCSOFT CDN URL; empty if not verified */
  icon: string;
  iconSource: string;
  itemPage: string;
  regions: RegionEvidence[];
  /** highest crafted tier in Global (best in slot) */
  crafted?: boolean;
}

/** Every item, including internal Taiwan-only and unclear ones. Use the region helpers for public views. */
export const ALL_ITEMS = catalog as CatalogItem[];

const norm = (s: string) => s.toLowerCase().replace(/[’']/g, "'").replace(/[^a-z0-9']+/g, " ").trim();
const BY_NAME = new Map<string, CatalogItem>();
const BY_ID = new Map<string, CatalogItem>();
for (const it of ALL_ITEMS) {
  if (!BY_NAME.has(norm(it.name))) BY_NAME.set(norm(it.name), it);
  if (it.itemId) BY_ID.set(it.itemId, it);
}
// names that belong to more than one item ID (e.g. the same name in several rarities) are ambiguous
const NAME_IDS = new Map<string, Set<string>>();
for (const it of ALL_ITEMS) if (it.itemId) NAME_IDS.set(norm(it.name), (NAME_IDS.get(norm(it.name)) ?? new Set()).add(it.itemId));

export function findById(itemId: string): CatalogItem | undefined {
  return BY_ID.get(itemId);
}

/** Lookup by name; only returns an item when the name is unambiguous. */
export function findCatalogItem(name: string): CatalogItem | undefined {
  const ids = NAME_IDS.get(norm(name));
  if (ids && ids.size > 1) return undefined;
  return BY_NAME.get(norm(name));
}

declare global {
  // offline file: original icons embedded by file name (see offline/build.mjs)
  var __BM_ICONS__: Record<string, string> | undefined;
}

/** Swap an icon URL for the embedded copy of the same original file, when the offline file carries one. */
export function localIcon(url: string | undefined): string | undefined {
  if (!url) return undefined;
  return globalThis.__BM_ICONS__?.[url.split("/").pop() ?? ""] ?? url;
}

/** Original icon for an item: by item ID first, then the icon kisk.app delivered, then an unambiguous name match. */
export function iconFor(item: { name: string; icon?: string; itemId?: string }): string | undefined {
  return localIcon((item.itemId && findById(item.itemId)?.icon) || item.icon || findCatalogItem(item.name)?.icon || undefined);
}
