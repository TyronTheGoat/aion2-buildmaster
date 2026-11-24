/**
 * Skill planner (Tyron 2026-11-24): how the bonus levels must fall so the wanted abilities reach their goal.
 * Rules: story / normal levelling up to 10, Daevanion up to +4; every gear piece (weapon, guard, rings, armour,
 * jewellery) gives +1 per ability line; an Arcana card hands out 5 levels in total, at most +4 on one ability.
 * Which ability may stand where comes from the reference database V3 (Arcana pools per card, active skills on
 * weapon / guard / rings, passives on armour / necklace / earrings). Stigmas are not part of this.
 */
import { arcanaSlotsOf, refSkills, type ArcanaSlot, type GearSlot } from "./reference/rolls-v3";

export const STORY_MAX = 10;
export const DAEVANION_MAX = 4;
export const ARCANA_CARD_LEVELS = 5;
export const ARCANA_SKILL_MAX = 4;
export const ARCANA_CARD_LINES = 4;

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
      const give = p.place.kind === "arcana" ? Math.min(ARCANA_SKILL_MAX, left, p.levelsLeft ?? 0) : 1;
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
