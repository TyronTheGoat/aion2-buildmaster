/**
 * Skill planner (Tyron 2026-11-24): how the bonus levels must fall so the wanted abilities reach their goal.
 * Rules: story / normal levelling up to 10, Daevanion up to +4; every gear piece (weapon, guard, rings, armour,
 * jewellery) gives +1 per ability line; a Unique Arcana card has 4 ability lines that start at +1 each and 5 more levels
 * from enhancing on top (9 in all), at most +4 on one ability (V3: card_effect_initial_level 1, max 4, max_enhancement 5).
 * Which ability may stand where comes from the reference database V3 (Arcana pools per card, active skills on
 * weapon / guard / rings, passives on armour / necklace / earrings). Stigmas are not part of this.
 */
import { arcanaSlotsOf, refSkills, type ArcanaSlot, type GearSlot } from "./reference/rolls-v3";
import type { Item, SlotKind } from "./types";

export const STORY_MAX = 10;
export const DAEVANION_MAX = 4;
export const ARCANA_CARD_LINES = 4;
export const ARCANA_ENHANCE = 5;
/** 4 lines × +1 to start, plus 5 from enhancing. */
export const ARCANA_CARD_LEVELS = ARCANA_CARD_LINES + ARCANA_ENHANCE;
export const ARCANA_SKILL_MAX = 4;

export type PlaceId =
  | "Chalice" | "Parchment" | "Compass" | "Bell" | "Mirror"
  | "weapon" | "guard" | "ring1" | "ring2" | "helm" | "pauldrons" | "top" | "legs" | "gloves" | "shoes" | "cloak" | "necklace" | "earring1" | "earring2";

export interface Place { id: PlaceId; de: string; kind: "arcana" | "gear"; refSlot: ArcanaSlot | GearSlot }

export const PLACES: Place[] = [
  { id: "Chalice", de: "Heiliger Gral", kind: "arcana", refSlot: "Chalice" },
  { id: "Parchment", de: "Pergament", kind: "arcana", refSlot: "Parchment" },
  { id: "Compass", de: "Kompass", kind: "arcana", refSlot: "Compass" },
  { id: "Bell", de: "Glocke", kind: "arcana", refSlot: "Bell" },
  { id: "Mirror", de: "Spiegel", kind: "arcana", refSlot: "Mirror" },
  { id: "ring1", de: "Ring 1", kind: "gear", refSlot: "ring" },
  { id: "ring2", de: "Ring 2", kind: "gear", refSlot: "ring" },
  { id: "weapon", de: "Waffe", kind: "gear", refSlot: "weapon" },
  { id: "guard", de: "Schützer", kind: "gear", refSlot: "guard" },
  { id: "helm", de: "Helm", kind: "gear", refSlot: "helm" },
  { id: "pauldrons", de: "Schultern", kind: "gear", refSlot: "pauldrons" },
  { id: "top", de: "Brust", kind: "gear", refSlot: "top" },
  { id: "legs", de: "Hose", kind: "gear", refSlot: "legs" },
  { id: "gloves", de: "Handschuhe", kind: "gear", refSlot: "gloves" },
  { id: "shoes", de: "Schuhe", kind: "gear", refSlot: "shoes" },
  { id: "cloak", de: "Umhang", kind: "gear", refSlot: "cloak" },
  { id: "necklace", de: "Halskette", kind: "gear", refSlot: "necklace" },
  { id: "earring1", de: "Ohrring 1", kind: "gear", refSlot: "earring" },
  { id: "earring2", de: "Ohrring 2", kind: "gear", refSlot: "earring" },
];
export const placeOf = (id: PlaceId) => PLACES.find((p) => p.id === id)!;

const ACTIVE_GEAR: GearSlot[] = ["weapon", "guard", "ring"];

/** Can this ability stand on this place at all? */
export function allowed(className: string, skillEn: string, place: Place): boolean {
  const skill = refSkills(className).find((s) => s.skill_en === skillEn);
  if (!skill) return false;
  if (place.kind === "arcana") return arcanaSlotsOf(className, skillEn).includes(place.refSlot as ArcanaSlot);
  return (skill.skill_type === "active") === ACTIVE_GEAR.includes(place.refSlot as GearSlot);
}

export interface Goal { skill: string; target: number; story: number; daevanion: number }
/** A place in the player's order, with the most abilities they allow on it. */
export interface PlaceRule { id: PlaceId; max: number }

export interface Line { skill: string; levels: number }
/** What already stands on a piece. Locked: the player keeps the piece as it is, the plan counts it and adds nothing there. */
export interface Have { locked: boolean; lines: Line[] }
export type HaveMap = Partial<Record<PlaceId, Have>>;

export interface PlanResult {
  goals: { goal: Goal; base: number; need: number; got: { place: PlaceId; levels: number; fixed?: true }[]; missing: number }[];
  places: { id: PlaceId; lines: Line[]; levelsLeft: number | null; locked?: true }[];
}

/**
 * Goals in priority order, places in priority order: every goal takes what it still needs from the first place that
 * allows it and has room (Arcana: up to +4 per ability, 5 levels and 4 lines per card; gear: +1, at most `max` abilities).
 */
export function planSkills(className: string, goals: Goal[], order: PlaceRule[], have: HaveMap = {}): PlanResult {
  const state = order.map((r) => {
    const h = have[r.id];
    const locked = !!h?.locked;
    const lines: Line[] = locked ? h!.lines.map((l) => ({ ...l })) : [];
    const arcana = placeOf(r.id).kind === "arcana";
    const levelsLeft = arcana ? Math.max(0, ARCANA_CARD_LEVELS - lines.reduce((a, l) => a + l.levels, 0)) : null;
    return { rule: r, place: placeOf(r.id), lines, levelsLeft, locked };
  });
  const out: PlanResult["goals"] = [];
  for (const goal of goals) {
    const base = Math.min(goal.story, STORY_MAX) + Math.min(goal.daevanion, DAEVANION_MAX);
    const need = Math.max(0, goal.target - base);
    let left = need;
    const got: PlanResult["goals"][number]["got"] = [];
    // locked pieces count first, whatever their place in the order
    for (const p of state) {
      if (!p.locked) continue;
      const l = p.lines.find((x) => x.skill === goal.skill);
      if (l) { got.push({ place: p.rule.id, levels: l.levels, fixed: true }); left -= l.levels; }
    }
    left = Math.max(0, left);
    for (const p of state) {
      if (left <= 0) break;
      if (p.locked) continue;
      if (p.rule.max <= 0 || p.lines.length >= p.rule.max || !allowed(className, goal.skill, p.place)) continue;
      if (p.lines.some((l) => l.skill === goal.skill)) continue;
      // Arcana: the card's other lines still carry at least +1 each
      const reserve = ARCANA_CARD_LINES - p.lines.length - 1;
      const give = p.place.kind === "arcana" ? Math.min(ARCANA_SKILL_MAX, left, (p.levelsLeft ?? 0) - reserve) : 1;
      if (give <= 0) continue;
      p.lines.push({ skill: goal.skill, levels: give });
      if (p.levelsLeft !== null) p.levelsLeft -= give;
      got.push({ place: p.rule.id, levels: give });
      left -= give;
    }
    out.push({ goal, base, need, got, missing: left });
  }
  return { goals: out, places: state.map((p) => ({ id: p.rule.id, lines: p.lines, levelsLeft: p.levelsLeft, ...(p.locked ? { locked: true as const } : {}) })) };
}

/** Default order: Arcana first, then rings, then the rest; Arcana up to 4 abilities, every gear piece up to 2. */
export const DEFAULT_ORDER: PlaceRule[] = PLACES.map((p) => ({ id: p.id, max: p.kind === "arcana" ? ARCANA_CARD_LINES : 2 }));

// ---- current gear (kisk) against the plan ----

const ARCANA_BY_WORD: [RegExp, PlaceId][] = [[/grail|chalice/i, "Chalice"], [/parchment/i, "Parchment"], [/compass/i, "Compass"], [/bell/i, "Bell"], [/mirror/i, "Mirror"]];
const GEAR_BY_SLOT: Partial<Record<SlotKind, PlaceId[]>> = {
  weapon: ["weapon"], offhand: ["guard"], helmet: ["helm"], shoulders: ["pauldrons"], torso: ["top"], pants: ["legs"], gloves: ["gloves"],
  boots: ["shoes"], cape: ["cloak"], necklace: ["necklace"], earring: ["earring1", "earring2"], ring: ["ring1", "ring2"],
};
const key = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/** The ability lines the character wears now, per place (from the kisk gear and Arcana; other stats are left out). */
export function currentLines(className: string, char: { gear: Item[]; arcana: Item[] }): Partial<Record<PlaceId, Line[]>> {
  const skills = refSkills(className);
  const lines = (it: Item): Line[] => it.lines.flatMap((l) => {
    const m = /^\+(\d+)$/.exec(l.value.trim());
    const s = m && skills.find((x) => key(x.skill_en) === key(l.name));
    return s ? [{ skill: s.skill_en, levels: Number(m![1]) }] : [];
  });
  const out: Partial<Record<PlaceId, Line[]>> = {};
  for (const it of char.arcana) {
    const id = ARCANA_BY_WORD.find(([re]) => re.test(`${it.icon ?? ""} ${it.name}`))?.[1];
    if (id && !out[id]) out[id] = lines(it);
  }
  const used: Partial<Record<SlotKind, number>> = {};
  for (const it of char.gear) {
    const ids = GEAR_BY_SLOT[it.slot];
    const n = used[it.slot] ?? 0;
    if (!ids || n >= ids.length) continue;
    used[it.slot] = n + 1;
    out[ids[n]] = lines(it);
  }
  return out;
}

/** Rings and earrings are interchangeable: put the planned lines on the one that already carries more of them. */
export function alignToCurrent(plan: PlanResult, now: Partial<Record<PlaceId, Line[]>>): PlanResult {
  const swap = new Map<PlaceId, PlaceId>();
  const overlap = (want: Line[], have: Line[] = []) => want.filter((w) => have.some((h) => h.skill === w.skill)).length;
  for (const [a, b] of [["ring1", "ring2"], ["earring1", "earring2"]] as [PlaceId, PlaceId][]) {
    const pa = plan.places.find((p) => p.id === a), pb = plan.places.find((p) => p.id === b);
    if (!pa || !pb || pa.locked || pb.locked) continue;
    if (overlap(pa.lines, now[b]) + overlap(pb.lines, now[a]) > overlap(pa.lines, now[a]) + overlap(pb.lines, now[b])) { swap.set(a, b); swap.set(b, a); }
  }
  if (!swap.size) return plan;
  const to = (id: PlaceId) => swap.get(id) ?? id;
  const places = plan.places.map((p) => ({ ...p, id: to(p.id) }));
  // keep the order of the list as it was
  const order = plan.places.map((p) => p.id);
  places.sort((x, y) => order.indexOf(x.id) - order.indexOf(y.id));
  return { goals: plan.goals.map((g) => ({ ...g, got: g.got.map((x) => ({ ...x, place: to(x.place) })) })), places };
}

export type NowState = "ok" | "low" | "drop" | "free";
export type WantState = "ok" | "low" | "missing";
export interface PieceDiff { id: PlaceId; now: (Line & { state: NowState })[]; want: (Line & { state: WantState; has: number })[]; change: boolean; locked?: true }

/**
 * Per planned piece: what is on it now and what the plan wants. Now: ok (stays), low (level too low), drop (has to go),
 * free (does not matter: an Arcana card's other lines, or a piece that already has all it needs).
 */
export function diffPlan(plan: PlanResult, now: Partial<Record<PlaceId, Line[]>>): PieceDiff[] {
  return plan.places.filter((p) => p.lines.length).map((p) => {
    const have = now[p.id] ?? [];
    const want = p.lines.map((w) => {
      const h = have.find((x) => x.skill === w.skill)?.levels ?? 0;
      return { ...w, has: h, state: (h >= w.levels ? "ok" : h > 0 ? "low" : "missing") as WantState };
    });
    const missing = want.filter((w) => w.state === "missing").length;
    let room = placeOf(p.id).kind === "arcana" ? ARCANA_CARD_LINES - p.lines.length : missing ? 0 : Infinity;
    const nowLines = have.map((h) => {
      const w = p.lines.find((x) => x.skill === h.skill);
      if (w) return { ...h, state: (h.levels >= w.levels ? "ok" : "low") as NowState };
      if (room > 0) { room--; return { ...h, state: "free" as NowState }; }
      return { ...h, state: "drop" as NowState };
    });
    return { id: p.id, now: nowLines, want, change: want.some((w) => w.state !== "ok") || nowLines.some((n) => n.state === "drop"), ...(p.locked ? { locked: true as const } : {}) };
  });
}
