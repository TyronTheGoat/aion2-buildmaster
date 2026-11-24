/**
 * kisk.app API for apps (https://kisk.app/api, Tyron 2026-11-24): the live server refreshes the shared characters with
 * GET /api/v1/c/{region}/{server}/{name}/gear every 30 minutes. That answer is the gear kisk last fetched from the
 * official armory; it has no BiS lines and no kisk rank. So the BiS lines (ideal) of the last gear-page import stay,
 * and a piece whose lines changed gets our own rank against them (kisk's thresholds), like an own BiS.
 * Relative imports only: the worker bundles this file.
 */
import type { Character, Item, StatLine } from "../types";
import { slotFromName } from "../knowledge/slots";
import { ownScore } from "../score";
import { gradeFromScore } from "../grades";
import { toNum } from "../compare";

export interface KiskGearItem {
  slot?: string;
  id?: number;
  name?: string;
  grade?: string;
  icon?: string;
  level?: number;
  enchantLevel?: number;
  exceedLevel?: number;
  subStats?: { id?: string; name?: string; value?: string | number }[];
  subSkills?: { name?: string; level?: number }[];
}
export interface KiskGear {
  name?: string;
  region?: string;
  server?: string;
  fetched?: number;
  combatPower?: number;
  items?: KiskGearItem[];
  missing?: string[];
}

export const kiskGearUrl = (region: string, server: string, name: string) =>
  `https://kisk.app/api/v1/c/${encodeURIComponent(region)}/${encodeURIComponent(server)}/${encodeURIComponent(name)}/gear`;

const key = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
const sameLines = (a: StatLine[], b: StatLine[]) =>
  a.length === b.length && a.every((l, i) => key(l.name) === key(b[i].name) && sameValue(l.value, b[i].value));
// "13%" (API) and "13.0%" (gear page) are the same roll
const sameValue = (a: string, b: string) => {
  const x = toNum(a), y = toNum(b);
  return Number.isNaN(x) || Number.isNaN(y) ? a.trim() === b.trim() : x === y && a.trim().endsWith("%") === b.trim().endsWith("%");
};

/** The armory's slot names where the item name does not tell the slot. */
const SLOT_BY_API: Record<string, Item["slot"]> = {
  mainhand: "weapon", subhand: "offhand", offhand: "offhand", helmet: "helmet", head: "helmet", shoulder: "shoulders", shoulders: "shoulders",
  torso: "torso", chest: "torso", pants: "pants", legs: "pants", gloves: "gloves", hand: "gloves", boots: "boots", foot: "boots", shoes: "boots",
  cape: "cape", cloak: "cape", back: "cape", necklace: "necklace", neck: "necklace", bracelet: "bracelet", belt: "belt",
};
function slotOf(it: KiskGearItem): Item["slot"] {
  const byName = slotFromName(it.name ?? "");
  if (byName !== "unknown") return byName;
  const s = key(it.slot ?? "");
  if (/^earring/.test(s)) return "earring";
  if (/^ring/.test(s)) return "ring";
  if (/arcana/.test(s)) return "arcana";
  return SLOT_BY_API[s] ?? "unknown";
}

/** One piece of the API answer as our item; max, share and BiS lines come from the same piece of the last import. */
function toItem(it: KiskGearItem, old: Item | undefined): Item {
  const lines: StatLine[] = [
    ...(it.subStats ?? []).filter((s) => s.name && s.value !== undefined).map((s) => ({ name: s.name!, value: String(s.value) })),
    ...(it.subSkills ?? []).filter((s) => s.name && s.level).map((s) => ({ name: s.name!, value: `+${s.level}` })),
  ].map((l) => {
    const was = old?.lines.find((o) => key(o.name) === key(l.name));
    return { ...l, ...(was?.max ? { max: was.max } : {}), ...(was?.share !== undefined ? { share: was.share } : {}) };
  });
  const item: Item = {
    slot: slotOf(it), name: it.name ?? old?.name ?? "?", icon: it.icon ?? old?.icon, level: it.level ?? old?.level, rarity: it.grade ?? old?.rarity,
    enhance: it.enchantLevel ?? old?.enhance, exceed: it.exceedLevel ?? old?.exceed,
    grade: old?.grade ?? "?", score: old?.score, lines, scored: old?.scored ?? true,
    ...(old?.fixedLines ? { fixedLines: true } : {}), ...(old?.ideal ? { ideal: old.ideal } : {}),
  };
  const unchanged = old && key(old.name) === key(item.name) && sameLines(old.lines, lines);
  if (!unchanged && item.ideal?.length) {
    const s = ownScore(item, item.ideal);
    item.score = Math.round(s);
    item.grade = gradeFromScore(s);
  }
  return item;
}

/**
 * The character with the API's gear. Undefined when the answer is not newer than what we have or has no items.
 * Pieces the API leaves out (e.g. the armory would not give them) stay as they were.
 */
export function mergeKiskGear(old: Character, api: KiskGear): Character | undefined {
  if (!api.fetched || !api.items?.length) return undefined;
  const fetchedAt = new Date(api.fetched).toISOString();
  if (fetchedAt <= old.source.fetchedAt) return undefined;
  const pool = [...old.gear, ...old.arcana];
  const used = new Set<Item>();
  // the same piece of the last import: same slot, then the same name and the most lines alike (two equal earrings), then in order
  const match = (it: KiskGearItem) => {
    const names = [...(it.subStats ?? []), ...(it.subSkills ?? [])].map((l) => key(l.name ?? ""));
    const rank = (o: Item) => (key(o.name) === key(it.name ?? "") ? 100 : 0) + o.lines.filter((l) => names.includes(key(l.name))).length;
    const same = pool.filter((o) => !used.has(o) && o.slot === slotOf(it)).sort((a, b) => rank(b) - rank(a));
    const hit = same[0];
    if (hit) used.add(hit);
    return hit;
  };
  const fresh = api.items.map((it) => toItem(it, match(it)));
  const known = fresh.filter((i) => i.slot !== "unknown");
  const kept = pool.filter((o) => !used.has(o) && !known.some((n) => n.slot === o.slot && (o.slot !== "ring" && o.slot !== "earring" && o.slot !== "arcana")));
  const all = [...known, ...kept];
  return {
    ...old,
    combatPower: api.combatPower ?? old.combatPower,
    gear: all.filter((i) => i.slot !== "arcana"),
    arcana: all.filter((i) => i.slot === "arcana"),
    source: { url: `https://kisk.app/c/${old.region}/${old.server}/${encodeURIComponent(old.name)}/gear`, fetchedAt, mode: "live" },
  };
}
