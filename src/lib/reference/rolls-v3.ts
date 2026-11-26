/**
 * Read-only reference database of the possible Arcana and equipment rolls, AION 2 EU/Global (Tyron's input V3,
 * 2026-11-24, data/reference/eu-global-rolls-v3-2026-11-24). Only a reference for later planners: nothing here
 * changes characters, gear, Arcana or notes, and no calculator is built on it yet.
 *
 * Rules kept from the input:
 * - regular (mastery) skills: trained up to 10, Daevanion up to +4, more only from equipped Arcana and gear;
 *   20 is a planning goal, not a hard cap
 * - stigmas are a separate system (Stigma shards): never on Arcana, gear or Daevanion, never in the 12 active / 10 passive pools
 * - stat ranges belong to their reference item level (mostly 102, bracelets 86) and are never transferred to other tiers
 * - gear chances are per single new line (before duplicate exclusion), Arcana chances are within the card's skill pool
 * - English names are the technical keys; German names may still need checking in the client, missing ones stay missing
 */
import raw from "../../../data/reference/eu-global-rolls-v3-2026-11-24/import.json";
import { hasGerman, statLabel } from "../stat-names";

export const ROLLS_VERSION = "eu-global-rolls-v3-2026-11-24";

export type SkillType = "active" | "passive";
export type ArcanaSlot = "Chalice" | "Parchment" | "Compass" | "Bell" | "Mirror";
export type GearSlot = "weapon" | "guard" | "helm" | "pauldrons" | "top" | "legs" | "gloves" | "shoes" | "cloak" | "necklace" | "earring" | "ring" | "bracelet";

export interface RefSkill { class_en: string; class_de: string; skill_en: string; skill_de: string; skill_type: SkillType; stigma: string; unique_key: string; name_de_verification?: string }
export interface RefArcanaSkill extends Omit<RefSkill, "unique_key"> {
  arcana_slot_en: ArcanaSlot; arcana_slot_de: string; skill_pool_size: number;
  probability_one_skill_line_pct: number; probability_unique_card_4_distinct_lines_pct: number;
  card_effect_initial_level: number; card_effect_max_level: number; probability_scope?: string;
}
export interface RefStat {
  slot_group: GearSlot; slot_de: string; stat_en: string; stat_de: string; stat_de_verification?: string;
  range_min: number | null; range_max: number | null; range_unit: string; range_reference_item_level: number;
  chance_single_line_pct: number; chance_kind: string; no_duplicate_within_item: string; range_note?: string; notes?: string;
}
export interface RefGearSkill extends Omit<RefSkill, "unique_key"> {
  slot_group: GearSlot; slot_de: string; skill_bonus_levels: number; skill_pool_size: number;
  probability_skill_category_single_line_pct: number; probability_given_skill_category_pct: number;
  probability_target_skill_single_line_pct: number; chance_status?: string; chance_scope?: string;
}
export interface RefSlot {
  slot_group: GearSlot; slot_de: string; skill_type_allowed: string; can_roll_stigma: string; general_stats_possible: number;
  possible_skill_count_per_class: number; skill_group_chance_single_line_pct: number; allowed_class_skill_bonus_per_line: number;
  distinct_physical_equipped_slots: number; notes?: string;
}
export interface RefCard {
  slot_en: ArcanaSlot; slot_de: string; variant_en: string; variant_de: string; card_en: string; card_de: string; grade_en: string; grade_de: string;
  base_skill_lines: number; max_enhancement: number; max_bonus_of_one_skill_on_card: number; main_pantheon_stat: string;
  main_pantheon_stat_points: number; item_level_base: number;
}
interface RefClass { class_de: string; skills: RefSkill[]; arcana: Record<ArcanaSlot, RefArcanaSkill[]>; gear_slots: Record<GearSlot, { stats: RefStat[]; skill_rolls: RefGearSkill[] }> }

const DB = raw as unknown as { rules: typeof raw.rules; arcana_cards: RefCard[]; slots: RefSlot[]; classes: Record<string, RefClass> };

export const ROLL_RULES = DB.rules;
export const ARCANA_CARDS: readonly RefCard[] = DB.arcana_cards;
export const GEAR_SLOT_RULES: readonly RefSlot[] = DB.slots;
export const REF_CLASSES = Object.keys(DB.classes);

/** Class key of the database for a class name as kisk / the class guide spells it. */
const ALIAS: Record<string, string> = { elementalist: "Spiritmaster", beschwörer: "Spiritmaster", templer: "Templar", assassine: "Assassin", jäger: "Ranger", zauberer: "Sorcerer", kleriker: "Cleric", kantor: "Chanter" };
export function refClass(name?: string): string | undefined {
  if (!name) return undefined;
  const n = name.trim().toLowerCase();
  return REF_CLASSES.find((c) => c.toLowerCase() === n) ?? ALIAS[n];
}

const cls = (name: string) => { const k = refClass(name); return k ? DB.classes[k] : undefined; };

/** The 22 regular skills (12 active, 10 passive) of a class; stigmas are not part of this list. */
export const refSkills = (className: string, type?: SkillType) => (cls(className)?.skills ?? []).filter((s) => !type || s.skill_type === type);
/** Skills that may stand on an Arcana card of this slot for the class (Chalice 22, Parchment / Compass 6, Bell / Mirror 5). */
export const arcanaPool = (className: string, slot: ArcanaSlot) => cls(className)?.arcana[slot] ?? [];
/** Arcana slots on which a skill can appear for the class. */
export const arcanaSlotsOf = (className: string, skillEn: string) =>
  (Object.entries(cls(className)?.arcana ?? {}) as [ArcanaSlot, RefArcanaSkill[]][]).filter(([, l]) => l.some((s) => s.skill_en === skillEn)).map(([k]) => k);
/** Normal stats a gear slot can roll, with the range at its reference item level and the base chance per single line. */
export const gearStats = (slot: GearSlot) => DB.classes[REF_CLASSES[0]].gear_slots[slot]?.stats ?? [];
/** +1 class skill rolls a gear slot can have for the class (active on weapon / guard / rings, passive on armour / earrings / necklace, none on bracelets). */
export const gearSkillRolls = (className: string, slot: GearSlot) => cls(className)?.gear_slots[slot]?.skill_rolls ?? [];

/**
 * German name of a stat: the input's own name, else the client name from our stat list (gamewith.ai item pages in
 * English and German side by side, see stat-names.ts). Never a made-up translation: unknown stays English.
 */
export function refStatDe(stat: Pick<RefStat, "stat_en" | "stat_de">): { de: string; source: "v3" | "client-list" | "none" } {
  if (stat.stat_de) return { de: stat.stat_de, source: "v3" };
  const key = hasGerman(stat.stat_en) ? stat.stat_en : stat.stat_en.replace(/ Increase$/, " increase");
  return hasGerman(key) ? { de: statLabel(key, "de"), source: "client-list" } : { de: stat.stat_en, source: "none" };
}
