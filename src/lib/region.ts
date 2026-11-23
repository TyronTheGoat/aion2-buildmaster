import { ALL_ITEMS, type CatalogItem } from "./knowledge/item-catalog";

/**
 * Central EU / Global release filter. Every public list (catalog, search, item picker,
 * Ist/Soll comparison) must go through publicItems() / isPublic(), so they all show the
 * same released selection.
 *
 *  - "eu":      confirmed for EU / Global by at least one source → visible and selectable
 *  - "tw":      only confirmed for Taiwan → kept internally, hidden everywhere
 *  - "unclear": no region evidence yet → kept internally as "EU / Global unbestätigt", hidden
 * A name, an icon or a general database entry alone is not evidence.
 */
export type RegionStatus = "eu" | "tw" | "unclear";

export const REGION_LABEL: Record<RegionStatus, string> = {
  eu: "EU / Global bestätigt",
  tw: "Nur Taiwan bestätigt",
  unclear: "EU / Global unbestätigt",
};

export function regionStatus(item: Pick<CatalogItem, "regions">): RegionStatus {
  if (item.regions.some((r) => r.region === "EU")) return "eu";
  if (item.regions.some((r) => r.region === "TW")) return "tw";
  return "unclear";
}

export const isPublic = (item: Pick<CatalogItem, "regions">) => regionStatus(item) === "eu";

/** The released EU / Global selection, shared by all public views. */
export const PUBLIC_ITEMS: CatalogItem[] = ALL_ITEMS.filter(isPublic);

export function regionCounts(filter: (i: CatalogItem) => boolean = () => true) {
  const c = { eu: 0, tw: 0, unclear: 0 };
  for (const i of ALL_ITEMS) if (filter(i)) c[regionStatus(i)]++;
  return c;
}
