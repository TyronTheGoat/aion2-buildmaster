/**
 * Own BiS builds (Tyron 2026-11-24, offline preview): a skill planner state saved under a name ("PvP", "Main Build 2")
 * becomes the target of the Arcana and gear comparison instead of kisk's BiS.
 * - Arcana: the planned abilities with their plus; the card's other lines are "Any".
 * - Gear: the planned +1 abilities, the rest of the piece's lines taken from kisk's BiS (the player picks which once);
 *   a piece without planned abilities keeps kisk's BiS as it is.
 * The rank (BiS, S+, S, A …) is our own score on kisk's thresholds: per target line how far the current line is
 * (missing 0, otherwise current / target up to 1), the average in % → grade.
 */
import type { Character, Grade, IdealLine, Item } from "./types";
import { gradeFromScore } from "./grades";
import { toNum } from "./compare";
import { refSkills } from "./reference/rolls-v3";
import {
  ARCANA_CARD_LINES, DAEVANION_MAX, STORY_MAX, currentItems, currentLines, placeOf, refSkillKey, type Goal, type HaveMap, type Line, type PlaceId, type PlaceRule,
} from "./skill-plan";

export const ANY = "Any";

export interface OwnBuild {
  id: string;
  name: string;
  /** every ability of the class was placed when saved (only such builds can be the target; checked again with allPlaced) */
  bis: boolean;
  savedAt: string;
  goals: Goal[];
  order: PlaceRule[];
  have: HaveMap;
  /** the plan of the build: ability lines per place */
  places: { id: PlaceId; lines: Line[] }[];
  /** per gear piece: the kisk BiS lines the player keeps beside the planned abilities */
  picks: Partial<Record<PlaceId, string[]>>;
}

const isSkill = (v: string) => /^\+\d+$/.test(v.trim());
const key = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/** How many lines the piece's target has: kisk's BiS count (4 for an Arcana card). */
export const targetSize = (item: Item, arcana: boolean) => (arcana ? ARCANA_CARD_LINES : item.ideal?.length ?? 0);

/** kisk BiS lines that can stay beside the planned abilities of a gear piece, with the default choice. */
export function pickOptions(item: Item, planned: Line[]): { lines: IdealLine[]; room: number; preset: string[] } {
  const lines = (item.ideal ?? []).filter((l) => !planned.some((p) => key(p.skill) === key(l.name)));
  const room = Math.max(0, (item.ideal?.length ?? 0) - planned.length);
  // default: kisk's stats first (in kisk's order), its abilities only when room is left
  const preset = [...lines.filter((l) => !isSkill(l.value)), ...lines.filter((l) => isSkill(l.value))].slice(0, room).map((l) => l.name);
  return { lines, room, preset };
}

/** Does the piece need the player's choice of kisk lines (planned abilities that kisk's BiS does not have)? */
export function needsPick(item: Item, planned: Line[]): boolean {
  if (item.slot === "arcana" || !planned.length || !item.ideal?.length) return false;
  return planned.some((p) => !item.ideal!.some((l) => key(l.name) === key(p.skill)));
}

/** The own target lines of one piece. */
export function ownIdeal(item: Item, place: PlaceId, build: OwnBuild): IdealLine[] | undefined {
  const planned = build.places.find((p) => p.id === place)?.lines ?? [];
  const arcana = placeOf(place).kind === "arcana";
  const named = planned.map((l) => ({ name: l.skill, value: `+${l.levels}` }));
  if (arcana) return [...named, ...Array.from({ length: Math.max(0, ARCANA_CARD_LINES - named.length) }, () => ({ name: ANY, value: "+1" }))];
  if (!planned.length) return item.ideal;
  const { lines, room, preset } = pickOptions(item, planned);
  const kept = build.picks[place] ?? preset;
  const keep = lines.filter((l) => kept.includes(l.name)).slice(0, room);
  const size = Math.max(item.ideal?.length ?? 0, named.length);
  const out = [...keep, ...named];
  while (out.length < size) out.push({ name: ANY, value: "" });
  return out;
}

/** Our score of a piece against its target lines (0-100) on kisk's thresholds. */
export function ownScore(item: Item, ideal: IdealLine[]): number {
  if (!ideal.length) return NaN;
  const used = new Set<number>();
  const named = ideal.filter((t) => t.name !== ANY);
  let sum = 0;
  for (const t of named) {
    const i = item.lines.findIndex((l, j) => !used.has(j) && key(l.name) === key(t.name));
    if (i < 0) continue;
    used.add(i);
    const h = toNum(item.lines[i].value), g = toNum(t.value);
    sum += Number.isNaN(h) || Number.isNaN(g) || g <= 0 ? 1 : Math.min(1, h / g);
  }
  // "Any": every other line of the piece fills one
  const free = item.lines.length - used.size;
  sum += Math.min(free, ideal.length - named.length);
  return (sum / ideal.length) * 100;
}

export const ownGrade = (item: Item, ideal: IdealLine[]): Grade => gradeFromScore(ownScore(item, ideal));

/** The character as the comparison should see it with an own build as target (ideal lines and rank per piece). */
export function applyBuild(char: Character, build: OwnBuild | undefined): Character {
  if (!build) return char;
  const items = currentItems(char);
  const placeOfItem = new Map<Item, PlaceId>((Object.entries(items) as [PlaceId, Item][]).map(([id, it]) => [it, id]));
  const map = (it: Item): Item => {
    const place = placeOfItem.get(it);
    if (!place) return it;
    const ideal = ownIdeal(it, place, build);
    if (!ideal?.length) return it;
    return { ...it, ideal, grade: ownGrade(it, ideal), score: Math.round(ownScore(it, ideal)) };
  };
  return { ...char, gear: char.gear.map(map), arcana: char.arcana.map(map) };
}

/** Is every regular ability of the class placed in the plan's goals? */
export const allPlaced = (className: string, goals: Goal[]) => {
  const all = refSkillKey(className);
  return all.length > 0 && all.every((k) => goals.some((g) => g.skill === k));
};

export interface AbilityLevel {
  skill: string;
  active: boolean;
  /** story + Daevanion (from the planner's goals; 10 + 4 when the ability has no goal there) */
  base: number;
  /** base + the ability lines the character wears now (kisk) */
  now: number;
  /** base + the ability lines of the target (own build or kisk's BiS) */
  target: number;
}

const sumLines = (m: Partial<Record<PlaceId, Line[]>>, skill: string) =>
  Object.values(m).flat().filter((l) => l!.skill === skill).reduce((a, l) => a + l!.levels, 0);

/**
 * Every ability of the class with its level now and with the target: base (story + Daevanion) plus the +N lines of
 * gear and Arcana. Target = the own build's plan, or kisk's BiS lines (only the abilities kisk lists).
 */
export function abilityLevels(className: string, char: Character, build: OwnBuild | undefined, plannerGoals: Goal[] = []): AbilityLevel[] {
  const goals = build?.goals ?? plannerGoals;
  const now = currentLines(className, char);
  // kisk's BiS: read its target lines as if they were worn
  const ideal = currentLines(className, {
    gear: char.gear.map((it) => ({ ...it, lines: (it.ideal ?? []).map((l) => ({ name: l.name, value: l.value })) })),
    arcana: char.arcana.map((it) => ({ ...it, lines: (it.ideal ?? []).map((l) => ({ name: l.name, value: l.value })) })),
  });
  const planned: Partial<Record<PlaceId, Line[]>> = build ? Object.fromEntries(build.places.map((p) => [p.id, p.lines])) : ideal;
  return refSkills(className).map((s) => {
    const g = goals.find((x) => x.skill === s.skill_en);
    const base = Math.min(g?.story ?? STORY_MAX, STORY_MAX) + Math.min(g?.daevanion ?? DAEVANION_MAX, DAEVANION_MAX);
    return { skill: s.skill_en, active: s.skill_type === "active", base, now: base + sumLines(now, s.skill_en), target: base + sumLines(planned, s.skill_en) };
  });
}
