import { describe, expect, it } from "vitest";
import { attemptsFor, chanceAfter, effectiveChance, expectedAttempts, simulateBudget } from "../crafting/prob";
import { parseCsv, readProb } from "../crafting/csv";
import {
  attemptEffects, emptyState, importFile, nextStep, nextSteps, sortProjects, spent, stepBudget,
  buyOrCraft, type AttemptEvent, type CraftState, type Project, type Recipe,
} from "../crafting/model";

/* Test fixtures are made-up shapes for the logic only; they are not game data. */
const recipe = (key: string, out: string, ing: [string, number][], extra: Partial<Recipe> = {}): Recipe => ({
  recipeKey: key, name: key, faction: "Asmodian", requiredMastery: null, documentedMastery: null, level: null,
  output: { name: out, qty: 1 }, comboFailKeepsNormal: null, transfer: null, consumesOnFail: true,
  pBase: null, pComboActivation: null, pComboSuccess: null, pFinal: null, guaranteed: null,
  ingredients: ing.map(([name, qty]) => ({ name, qty, bound: null, consumedOnFail: null, kind: "material" as const })), ...extra,
});
const project = (id: string, target: string, extra: Partial<Project> = {}): Project => ({
  id, charKey: "eu/odar/test", character: "Test", faction: "Asmodian", server: "odar", slot: "weapon", mastery: null,
  targetRecipeKey: target, goal: "normal", status: "active", createdAt: "2026-11-22T10:00:00Z", owned: [], ...extra,
});
const attempt = (projectId: string, r: Recipe, outcome: AttemptEvent["outcome"], id = Math.random().toString()): AttemptEvent =>
  ({ id, kind: "attempt", projectId, at: "2026-11-22T11:00:00Z", recipeKey: r.recipeKey, outcome, ...attemptEffects(r, outcome), costLow: null, costHigh: null });

describe("80 % planning value", () => {
  it("1: p = 0.25 needs 6 attempts (82.2 %), expected value 4", () => {
    expect(attemptsFor(0.25)).toBe(6);
    expect(chanceAfter(0.25, 6)!).toBeCloseTo(0.822, 3);
    expect(chanceAfter(0.25, 5)!).toBeLessThan(0.8);
    expect(expectedAttempts(0.25)).toBe(4);
  });
  it("2: edge values and unknown", () => {
    expect(attemptsFor(0.01)).toBe(161);
    expect(attemptsFor(0.137)).toBe(11);
    expect(attemptsFor(0.217)).toBe(7);
    expect(attemptsFor(0.8)).toBe(1);
    expect(attemptsFor(1)).toBe(1);
    expect(attemptsFor(null)).toBeNull();
    expect(attemptsFor(0)).toBe(Infinity);
    for (const p of [0.01, 0.137, 0.217]) {
      const n = attemptsFor(p)!;
      expect(chanceAfter(p, n)!).toBeGreaterThanOrEqual(0.8);
      expect(chanceAfter(p, n - 1)!).toBeLessThan(0.8);
    }
  });
  it("3: activation known but combo check unknown → combo chance unknown, not 25 %", () => {
    expect(effectiveChance({ pBase: 0.74, pComboActivation: 0.25, pComboSuccess: null, pFinal: null, guaranteed: false }, "combo")).toBeNull();
  });
  it("4: a documented final chance of 13.69 % is used as it is", () => {
    const p = effectiveChance({ pBase: 0.74, pComboActivation: 0.25, pComboSuccess: null, pFinal: 0.1369, guaranteed: false }, "combo");
    expect(p).toBe(0.1369);
    expect(attemptsFor(p)).toBe(11);
    expect(attemptsFor(p)).not.toBe(attemptsFor(0.25));
  });
  it("5: guaranteed transfer with a 25 % final combo: normal 1 attempt, combo 6", () => {
    const c = { pBase: null, pComboActivation: null, pComboSuccess: null, pFinal: 0.25, guaranteed: true };
    expect(attemptsFor(effectiveChance(c, "normal"))).toBe(1);
    expect(attemptsFor(effectiveChance(c, "combo"))).toBe(6);
  });
  it("product of three known steps", () => {
    expect(effectiveChance({ pBase: 0.8, pComboActivation: 0.25, pComboSuccess: 0.5, pFinal: null, guaranteed: false }, "combo")).toBeCloseTo(0.1);
  });
  it("whole-path budget by seeded simulation is reproducible and not the sum of step 80 % values", () => {
    const steps = [{ p: 0.5, cost: 10 }, { p: 0.25, cost: 100 }];
    const a = simulateBudget(steps, { runs: 20000, seed: 7 })!;
    const b = simulateBudget(steps, { runs: 20000, seed: 7 })!;
    expect(a.budget80).toBe(b.budget80);
    const sumOfSteps = attemptsFor(0.5)! * 10 + attemptsFor(0.25)! * 100; // 3*10 + 6*100
    expect(a.budget80).toBeLessThanOrEqual(sumOfSteps);
    expect(a.ci95[0]).toBeLessThanOrEqual(a.budget80);
    expect(simulateBudget([{ p: 0, cost: 1 }])).toBeNull();
  });
});

describe("CSV import", () => {
  it("reads BOM, quotes and semicolons", () => {
    const { header, rows } = parseCsv('﻿a;b\n"x;1";"say ""hi"""\n');
    expect(header).toEqual(["a", "b"]);
    expect(rows[0]).toEqual({ a: "x;1", b: 'say "hi"' });
  });
  it("probabilities stay 0..1, unknown is null, percent is an error", () => {
    expect(readProb("0.25").value).toBe(0.25);
    expect(readProb("").value).toBeNull();
    expect(readProb("unbekannt").value).toBeNull();
    expect(readProb("25").error).toBeTruthy();
    expect(readProb("25%").error).toBeTruthy();
  });
  it("reports errors per row and skips duplicate recipe keys", () => {
    const csv = "recipe_key,output_name,faction,p_base_success,guaranteed_success\n" +
      "a,Item A,Asmodian,0.5,false\n" +
      "a,Item A2,Asmodian,0.5,false\n" +
      "b,Item B,Asmodian,74,false\n" +
      "c,Item C,Asmodian,,vielleicht\n" +
      "d,Item D,Asmodian,,\n";
    const r = importFile(emptyState(), "01_Crafting_Chancen_Input.csv", csv);
    expect(r.state.recipes.map((x) => x.recipeKey)).toEqual(["a", "d"]);
    expect(r.errors.map((e) => e.row)).toEqual([3, 4, 5]);
    expect(r.state.recipes[1].pBase).toBeNull();
    expect(r.state.recipes[1].guaranteed).toBeNull();
  });
  it("materials attach to recipes; an import never touches projects or history", () => {
    let s: CraftState = { ...emptyState(), projects: [project("p", "a")], events: [{ id: "u", kind: "undo", at: "x", target: "y" }] };
    s = importFile(s, "01_x.csv", "recipe_key,output_name\na,Item A\n").state;
    const m = importFile(s, "02_Crafting_Materialien_Input.csv", "recipe_key,material_name,qty\na,Wood,3\nzz,Ore,1\n");
    expect(m.state.recipes[0].ingredients).toEqual([{ name: "Wood", itemId: undefined, qty: 3, bound: null, consumedOnFail: null, kind: "material" }]);
    expect(m.errors).toHaveLength(1);
    expect(m.state.projects).toBe(s.projects);
    expect(m.state.events).toBe(s.events);
  });
});

describe("projects, history and next steps", () => {
  // base → mid (needs base + extra) → top; extra is itself crafted
  const base = recipe("base", "Base Sword", [["Wood", 3]], { pBase: 0.5 });
  const extra = recipe("extra", "Hilt", [["Ore", 2]], { pBase: 1, guaranteed: true });
  const mid = recipe("mid", "Sword 86", [["Base Sword", 1], ["Hilt", 1]], { pBase: 0.74, comboOutput: { name: "Splendent Sword" }, pFinal: 0.1369 });
  const top = recipe("top", "Sword 94", [["Sword 86", 1], ["Hilt", 1]], { pBase: 0.5 });
  const state = (extraState: Partial<CraftState> = {}): CraftState => ({ ...emptyState(), recipes: [base, extra, mid, top], ...extraState });

  it("6: owning level 86 skips its craft, but the extra base item of the later recipe still counts", () => {
    const p = project("p", "top", { owned: [{ name: "Sword 86" }] });
    const s = nextStep(p, state({ projects: [p] }))!;
    expect(s.recipe.recipeKey).toBe("extra");
  });
  it("7: a failed craft uses up materials; a successful combo skips the safe upgrade", () => {
    const fx = attemptEffects(base, "base_fail");
    expect(fx.consumed).toEqual([{ name: "Wood", itemId: undefined, qty: 3 }]);
    expect(fx.produced).toEqual([]);
    // the project wants the Splendent sword; the safe path would be another recipe that turns Sword 86 into it
    const safe = recipe("safe", "Splendent Sword", [["Sword 86", 1]], { guaranteed: true });
    const p = project("p", "safe", { owned: [{ name: "Base Sword" }, { name: "Hilt" }] });
    const before = nextStep(p, { ...state(), recipes: [base, extra, mid, safe], projects: [p] })!;
    expect(before.recipe.recipeKey).toBe("mid");
    const ev = attempt("p", mid, "combo_success");
    expect(nextStep(p, { ...state(), recipes: [base, extra, mid, safe], projects: [p], events: [ev] })).toBeNull();
  });
  it("undo removes an attempt from the counted history", () => {
    const p = project("p", "base");
    const ev = attempt("p", base, "success", "e1");
    expect(nextStep(p, state({ projects: [p], events: [ev] }))).toBeNull();
    expect(nextStep(p, state({ projects: [p], events: [ev, { id: "u1", kind: "undo", at: "x", target: "e1" }] }))!.recipe.recipeKey).toBe("base");
  });
  it("8: one stack of materials is not counted for two projects", () => {
    const a = project("a", "base", { slot: "weapon" });
    const b = project("b", "base", { slot: "ring", createdAt: "2026-11-22T09:00:00Z" });
    const steps = nextSteps(state({ projects: [b, a], inventory: { "n:wood": 4 } }), "eu/odar/test");
    expect(steps.map((s) => s.project.id)).toEqual(["a", "b"]);
    expect(steps[0].ingredients[0].have).toBe(3);
    expect(steps[1].ingredients[0].have).toBe(1);
  });
  it("fixed order; paused and done projects are left out of next steps", () => {
    const list = [project("g", "base", { slot: "gloves" }), project("w", "base", { slot: "weapon" }), project("r", "base", { slot: "ring" }), project("x", "base", { slot: "weapon", status: "paused" })];
    expect(sortProjects(list).map((p) => p.id)).toEqual(["w", "x", "r", "g"]);
    expect(nextSteps(state({ projects: list }), "eu/odar/test").map((s) => s.project.id)).toEqual(["w", "r", "g"]);
  });
  it("9: buy vs craft only for tradeable items with a price", () => {
    const prices = [{ name: "Hilt", low: 50, high: 80, ref: null, owned: null, tradeable: true }, { name: "Base Sword", low: 10, high: 10, ref: null, owned: null, tradeable: null }];
    expect(buyOrCraft({ name: "Hilt" }, prices, 100, "low")).toBe("buy");
    expect(buyOrCraft({ name: "Base Sword" }, prices, 100, "low")).toBeNull();
    expect(buyOrCraft({ name: "Hilt" }, prices, null, "low")).toBeNull();
  });
  it("10: missing prices or materials give 'data missing', never 0 Kinah", () => {
    const b = stepBudget(base, 0.5, [], "low");
    expect(b.budget).toBeNull();
    expect(b.missing.map((m) => m.what)).toContain("Preis fehlt");
    const noIng = stepBudget(recipe("n", "N", []), 0.5, [], "low");
    expect(noIng.budget).toBeNull();
    const priced = stepBudget(base, 0.5, [{ name: "Wood", low: 10, high: 20, ref: null, owned: null, tradeable: true }], "low");
    expect(priced.n80).toBe(3);
    expect(priced.budget).toBe(90); // 3 attempts × 3 wood × 10
    expect(stepBudget(base, null, [{ name: "Wood", low: 10, high: 20, ref: null, owned: null, tradeable: true }], "low").budget).toBeNull();
  });
  it("11: changed prices change the forecast, not the cost already logged", () => {
    const p = project("p", "base");
    const ev: AttemptEvent = { ...attempt("p", base, "base_fail"), costLow: 30, costHigh: 60 };
    const prices = [{ name: "Wood", low: 99, high: 99, ref: null, owned: null, tradeable: true }];
    expect(spent(p, [ev])).toEqual({ low: 30, high: 60, unknown: 0 });
    expect(stepBudget(base, 0.5, prices, "low").budget).toBe(3 * 3 * 99);
  });
  it("chances: a character's in-game value wins; other mastery levels are not mixed in", () => {
    const r = { ...base, documentedMastery: 10, pBase: 0.5 };
    const p = project("p", "r", { mastery: 12 });
    const s1 = nextStep(p, { ...state(), recipes: [{ ...r, recipeKey: "r" }], projects: [p] })!;
    expect(s1.plan.n80).toBeNull(); // documented at 10, character is 12 → unknown at actual mastery
    expect(s1.documentedPlan.n80).toBe(3);
    const s2 = nextStep(p, { ...state(), recipes: [{ ...r, recipeKey: "r" }], projects: [p], overrides: [{ recipeKey: "r", character: "Test", mastery: 12, pBase: 0.25, pComboActivation: null, pComboSuccess: null, pFinal: null }] })!;
    expect(s2.plan.n80).toBe(6);
  });
});
