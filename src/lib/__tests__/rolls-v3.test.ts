import { describe, expect, test } from "vitest";
import data from "../../../data/class-skills.json";
import {
  ARCANA_CARDS, GEAR_SLOT_RULES, REF_CLASSES, ROLL_RULES, ROLLS_VERSION, arcanaPool, arcanaSlotsOf, gearSkillRolls, gearStats, refClass, refSkills,
  type ArcanaSlot, type GearSlot,
} from "../reference/rolls-v3";

// acceptance tests from Tyron's import V3 (CLAUDE_IMPORT_PROMPT.md)
describe("reference database EU/Global rolls V3", () => {
  test("version and scope", () => {
    expect(ROLLS_VERSION).toBe("eu-global-rolls-v3-2026-11-24");
    expect(REF_CLASSES.sort()).toEqual(["Assassin", "Chanter", "Cleric", "Gladiator", "Ranger", "Sorcerer", "Spiritmaster", "Templar"]);
    expect(ARCANA_CARDS).toHaveLength(40);
    expect(GEAR_SLOT_RULES).toHaveLength(13);
  });
  test("1-3: Spiritmaster card pools", () => {
    expect(arcanaSlotsOf("Spiritmaster", "Elemental Fusion").sort()).toEqual(["Chalice", "Parchment"]);
    expect(arcanaSlotsOf("Spiritmaster", "Spirit Strike").sort()).toEqual(["Bell", "Chalice"]);
    expect(arcanaSlotsOf("Spiritmaster", "Mental Focus").sort()).toEqual(["Chalice", "Mirror"]);
  });
  test("4: a ring has the 12 active skills, no passives, no stigmas", () => {
    const r = gearSkillRolls("Spiritmaster", "ring");
    expect(r).toHaveLength(12);
    expect(r.every((s) => s.skill_type === "active" && s.stigma === "false")).toBe(true);
  });
  test("5: helm has the 10 passives of the class and its own stats", () => {
    for (const c of REF_CLASSES) {
      const r = gearSkillRolls(c, "helm");
      expect(r).toHaveLength(10);
      expect(new Set(r.map((s) => s.skill_en))).toEqual(new Set(refSkills(c, "passive").map((s) => s.skill_en)));
    }
    expect(gearStats("helm").every((s) => s.slot_group === "helm")).toBe(true);
    expect(gearStats("helm").length).toBe(24);
  });
  test("6: bracelet only 8 Pantheon values, no skills", () => {
    expect(gearStats("bracelet")).toHaveLength(8);
    for (const c of REF_CLASSES) expect(gearSkillRolls(c, "bracelet")).toHaveLength(0);
    expect(gearStats("bracelet").every((s) => s.range_reference_item_level === 86)).toBe(true);
  });
  test("7: 10 trained + 4 Daevanion + 6 bonus = 20; stigmas separate", () => {
    const r = ROLL_RULES.regular_skill_rules;
    expect(r.trained_max_level + r.daevanion_extra_max_levels + 6).toBe(r.planning_goal_level);
    expect(ROLL_RULES.stigma_rules).toMatchObject({ separate: true, eligible_on_arcana: false, eligible_on_gear: false, eligible_on_devanion_nodes: false });
    for (const c of REF_CLASSES) expect(refSkills(c).every((s) => s.stigma === "false")).toBe(true);
  });
  test("8: Damage Boost on weapons is 6.29-7.30 % at item level 102 only", () => {
    const d = gearStats("weapon").find((s) => s.stat_en === "Damage Boost")!;
    expect([d.range_min, d.range_max, d.range_unit, d.range_reference_item_level]).toEqual([6.29, 7.3, "%", 102]);
  });
  test("9: every class has 22 skills (12 / 10) and pools 22 / 6 / 6 / 5 / 5", () => {
    const sizes: Record<ArcanaSlot, number> = { Chalice: 22, Parchment: 6, Compass: 6, Bell: 5, Mirror: 5 };
    for (const c of REF_CLASSES) {
      expect(refSkills(c, "active")).toHaveLength(12);
      expect(refSkills(c, "passive")).toHaveLength(10);
      for (const [slot, n] of Object.entries(sizes)) expect(arcanaPool(c, slot as ArcanaSlot)).toHaveLength(n);
      // Parchment + Compass = all actives, Bell + Mirror = all passives, without overlap
      const a = [...arcanaPool(c, "Parchment"), ...arcanaPool(c, "Compass")].map((s) => s.skill_en);
      expect(new Set(a)).toEqual(new Set(refSkills(c, "active").map((s) => s.skill_en)));
      const p = [...arcanaPool(c, "Bell"), ...arcanaPool(c, "Mirror")].map((s) => s.skill_en);
      expect(new Set(p)).toEqual(new Set(refSkills(c, "passive").map((s) => s.skill_en)));
    }
  });
  test("gear slots: active skills on weapon / guard / ring, passives on armour and jewellery", () => {
    const active: GearSlot[] = ["weapon", "guard", "ring"];
    const passive: GearSlot[] = ["helm", "pauldrons", "top", "legs", "gloves", "shoes", "cloak", "earring", "necklace"];
    let n = 0;
    for (const c of REF_CLASSES) {
      for (const s of active) { const r = gearSkillRolls(c, s); n += r.length; expect(r.every((x) => x.skill_type === "active")).toBe(true); }
      for (const s of passive) { const r = gearSkillRolls(c, s); n += r.length; expect(r.every((x) => x.skill_type === "passive")).toBe(true); }
    }
    expect(n).toBe(1008);
    expect((["weapon", "guard", "helm", "pauldrons", "top", "legs", "gloves", "shoes", "cloak", "necklace", "earring", "ring", "bracelet"] as GearSlot[]).reduce((a, s) => a + gearStats(s).length, 0)).toBe(255);
  });
  test("10 / consistency: the skills match the class guide data (names EN / DE, active / passive)", () => {
    const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
    for (const g of data as { nameEn: string; skills: { nameEn: string; name: string; kind: string }[] }[]) {
      const c = refClass(g.nameEn)!;
      const ref = new Map(refSkills(c).map((s) => [norm(s.skill_en), s]));
      const mine = g.skills.filter((s) => s.kind !== "stigma");
      expect(mine).toHaveLength(22);
      for (const s of mine) {
        const r = ref.get(norm(s.nameEn));
        expect(r, `${c} ${s.nameEn}`).toBeDefined();
        expect(r!.skill_de).toBe(s.name);
        expect(r!.skill_type).toBe(s.kind === "mastery" ? "active" : "passive");
      }
    }
  });
});
