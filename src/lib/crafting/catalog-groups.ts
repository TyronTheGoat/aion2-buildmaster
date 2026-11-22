import { normName, type CatalogEntry } from "./model";

/** The two areas of the market price page. */
export type PriceArea = "materials" | "gear";

/** Material groups, in display order. Assigned from the item name; anything not clearly named goes to "other". */
export const MATERIAL_GROUPS = ["ore", "gem", "wood", "herb", "cooking", "odyle", "balaur", "refine", "other"] as const;
export type MaterialGroup = (typeof MATERIAL_GROUPS)[number];
/** Gear groups, in display order. */
export const GEAR_GROUPS = ["weapon", "guard", "jewelry", "armor"] as const;
export type GearGroup = (typeof GEAR_GROUPS)[number];
export type PriceGroup = MaterialGroup | GearGroup;

const MATERIAL_WORDS: [MaterialGroup, RegExp][] = [
  ["ore", /\bore\b|\bingot\b/],
  ["gem", /\bgemstone\b|\bgem\b|\bjewel\b|\bcrystal shard\b/],
  ["wood", /\blog\b|\bwood\b|\bplank\b|\btimber\b/],
  ["herb", /\bherb\b|\bleaf\b|\bflower\b|\broot\b|\bpetal\b|\bmoss\b/],
  ["cooking", /\bmeat\b|\begg\b|\bmilk\b|\bflour\b|\bfish\b|\bspice\b|\bvegetable\b|\bfruit\b|\bsalt\b|\bsugar\b/],
  ["odyle", /\bodyle\b/],
  ["refine", /refining stone|spiritstone|hardener|sandpaper|catalyst|magic crystal|\bflux\b/],
  ["balaur", /\bbalaur\b|\bhorn\b|\bleather\b|\bhide\b|\bscale\b/],
];

const GEAR_WORDS: [GearGroup, RegExp][] = [
  ["guard", /\bguard\b|\bshield\b/],
  ["jewelry", /\bring\b|\bnecklace\b|\bearrings?\b|\bbracelet\b|\bbelt\b|\bamulet\b/],
  ["armor", /\bgloves\b|\bchest\b|\btorso\b|\bpants\b|\bhelm(et)?\b|\bshoulders?\b|\bboots\b|\bcape\b|\bcloak\b|\barmor\b/],
  ["weapon", /\bsword\b|\blongsword\b|\bgreatsword\b|\bdagger\b|\bmace\b|\borb\b|\bspellbook\b|\bbow\b|\bstaff\b|\bpolearm\b|\bcannon\b|\bharp\b/],
];

const GEAR_CATEGORIES = new Set(["weapon", "guard", "gloves", "ring", "jewelry", "armor", "transfer"]);

/** Which area and group an entry belongs to. Item IDs starting with 6 are materials in the data; gear names decide the gear group. */
export function groupOf(e: Pick<CatalogEntry, "name" | "itemId" | "category"> & { group?: string }): { area: PriceArea; group: PriceGroup } {
  if (e.group && (MATERIAL_GROUPS as readonly string[]).includes(e.group)) return { area: "materials", group: e.group as MaterialGroup };
  if (e.group && (GEAR_GROUPS as readonly string[]).includes(e.group)) return { area: "gear", group: e.group as GearGroup };
  const n = normName(e.name).replace(/\(bound\)/, "");
  const gearWord = GEAR_WORDS.find(([, re]) => re.test(n))?.[0];
  const isMaterialId = !!e.itemId && e.itemId.startsWith("6");
  const isGear = !isMaterialId && (GEAR_CATEGORIES.has(e.category) || (!!gearWord && e.category !== "processed"));
  if (isGear) {
    const byCat: Partial<Record<string, GearGroup>> = { weapon: "weapon", guard: "guard", gloves: "armor", ring: "jewelry", jewelry: "jewelry", armor: "armor" };
    return { area: "gear", group: gearWord ?? byCat[e.category] ?? "weapon" };
  }
  return { area: "materials", group: MATERIAL_WORDS.find(([, re]) => re.test(n))?.[0] ?? "other" };
}

/** Colour of a group (dot and left edge in the list). */
export const GROUP_COLOR: Record<PriceGroup, string> = {
  ore: "#c59a6a", gem: "#5aa9e6", wood: "#8fbf6a", herb: "#5fbf8a", cooking: "#e0a95a", odyle: "#b48cff", balaur: "#d07a5a", refine: "#9fb3c8", other: "#8a8f98",
  weapon: "#e0c27a", guard: "#7fb0d8", jewelry: "#c890e0", armor: "#9ec7a0",
};

/**
 * Entries of the price page for one character: only its faction (or no faction) and every item once by name,
 * preferring the entry that carries the item ID.
 */
export function entriesFor(catalog: CatalogEntry[], faction?: string) {
  const f = (faction ?? "").toLowerCase().replace("asmodier", "asmodian");
  const seen = new Map<string, CatalogEntry>();
  for (const raw of catalog) {
    // a guaranteed alternative recipe makes the same item as the normal one
    const e = { ...raw, name: raw.name.replace(/\s*\(guaranteed alternative\)\s*$/i, "") };
    if (f && e.faction && e.faction.toLowerCase() !== f) continue;
    const k = normName(e.name);
    const hit = seen.get(k);
    if (!hit) { seen.set(k, { ...e }); continue; }
    if (hit.itemId && e.itemId && hit.itemId !== e.itemId) { seen.set(`${k}#${e.itemId}`, { ...e }); continue; }
    hit.recipeKeys = [...new Set([...hit.recipeKeys, ...e.recipeKeys])];
    hit.itemId ??= e.itemId;
    hit.bound ??= e.bound;
  }
  return [...seen.values()].map((e) => ({ ...e, ...groupOf(e) }));
}
