import catalog from "./item-catalog.json";

/** Researched AION 2 gear list (Feuertempel, Grimmhornhöhle, Ludra, Crafted Gear) with verified icons only. */
export interface CatalogItem {
  key: string;
  name: string;
  itemId: string;
  source: string;
  category: string;
  slot: string;
  level: number;
  rarity: string;
  faction: string;
  /** Original icon: local file under /item-icons or NCSOFT CDN URL; empty if not verified */
  icon: string;
  iconSource: string;
}

export const ITEM_CATALOG = catalog as CatalogItem[];

const norm = (s: string) => s.toLowerCase().replace(/[’']/g, "'").replace(/[^a-z0-9']+/g, " ").trim();
const BY_NAME = new Map<string, CatalogItem>();
for (const it of ITEM_CATALOG) if (!BY_NAME.has(norm(it.name))) BY_NAME.set(norm(it.name), it);

export function findCatalogItem(name: string): CatalogItem | undefined {
  return BY_NAME.get(norm(name));
}

/** Best available original icon: the one kisk.app delivered for this item, else the catalog's verified icon. */
export function iconFor(item: { name: string; icon?: string }): string | undefined {
  return item.icon || findCatalogItem(item.name)?.icon || undefined;
}
