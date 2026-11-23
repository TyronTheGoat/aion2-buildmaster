import { describe, expect, it } from "vitest";
import { attemptsFor, effectiveChance, expectedAttempts } from "../crafting/prob";
import { parseCsv } from "../crafting/csv";
import {
  attemptCost, attemptEffects, buildCatalog, emptyState, findPrice, importFile, nextStep, nextSteps, priceOf, progress, remainingPath,
  ctxOf, type AttemptEvent, type CraftState, type Project, type Recipe,
} from "../crafting/model";
import { BUILTIN_FILES } from "../crafting/builtin-data";

/* Tests on the real V4/V5 data package (data/crafting/v5), imported in the same order as the app does. */
const load = () => {
  let s: CraftState = emptyState();
  const log: { file: string; kind: string; errors: number }[] = [];
  for (const [f, t] of BUILTIN_FILES) { const r = importFile(s, f, t); s = r.state; log.push({ file: f, kind: r.kind, errors: r.errors.length }); }
  return { s, log };
};
const { s: data, log } = load();
const R = (key: string) => data.recipes.find((r) => r.recipeKey === key)!;
const proj = (target: string, extra: Partial<Project> = {}): Project => ({
  id: "p1", charKey: "eu/odar/test", character: "Test", faction: "Elyos", server: "odar", slot: "weapon", mastery: null,
  targetRecipeKey: target, goal: "normal", status: "active", createdAt: "2026-11-22T10:00:00Z", owned: [], ...extra,
});
const attempt = (projectId: string, r: Recipe, outcome: AttemptEvent["outcome"]): AttemptEvent =>
  ({ id: Math.random().toString(36), kind: "attempt", projectId, at: "2026-11-22T11:00:00Z", recipeKey: r.recipeKey, outcome, ...attemptEffects(r, outcome), costLow: 1, costHigh: 2 });

describe("V4/V5 + V7 import", () => {
  it("every file is recognised and imports without errors", () => {
    expect(log.map((l) => l.kind)).toEqual(["recipes", "materials", "transfers", "keymap", "chain", "gaps", "catalog",
      "recipes", "keymap", "materials", "transfers", "chain", "coverage", "coverage", "gaps", "sources", "catalog", "suggestions"]);
    expect(log.every((l) => l.errors === 0)).toBe(true);
  });
  it("409 V7 rows give 391 recipes: the 18 placeholder spellbook keys merge into their real recipe", () => {
    expect(data.recipes).toHaveLength(391);
    expect(new Set(data.recipes.map((r) => r.recipeKey)).size).toBe(391);
    expect(data.recipes.every((r) => r.recipeKey.startsWith("recipe:"))).toBe(true);
    const { rows } = parseCsv(BUILTIN_FILES.find(([f]) => f === "v7/01_EU_GLOBAL_REZEPTE_409.csv")![1]);
    expect(rows).toHaveLength(409);
  });
  it("ingredient coverage: 18 checked complete, the rest unconfirmed or missing — never shown as complete", () => {
    const by = (s: string) => data.recipes.filter((r) => r.ingredientsStatus === s).length;
    expect(by("complete")).toBe(18);
    expect(data.recipes.filter((r) => r.ingredients.length).length).toBe(74);
    expect(by("none")).toBe(data.recipes.filter((r) => !r.ingredients.length).length);
    const longsword = R("recipe:111013001");
    expect(longsword.ingredientsStatus).toBe("complete");
    expect(longsword.ingredients.filter((i) => i.kind === "material")).toHaveLength(6);
  });
  it("no ingredient or transfer is attached twice, transfers stay apart from materials", () => {
    for (const r of data.recipes) {
      const keys = r.ingredients.map((i) => `${i.kind}:${i.itemId ?? i.name}`);
      expect(new Set(keys).size).toBe(keys.length);
    }
    expect(data.recipes.flatMap((r) => r.ingredients).filter((i) => i.kind === "transfer")).toHaveLength(10);
  });
  it("importing the same files again does not double anything", () => {
    let s = data;
    for (const [f, t] of BUILTIN_FILES) s = importFile(s, f, t).state;
    expect(s.recipes).toHaveLength(391);
    expect(s.recipes.flatMap((r) => r.ingredients)).toHaveLength(data.recipes.flatMap((r) => r.ingredients).length);
    expect(s.chains).toHaveLength(data.chains.length);
  });
  it("old V3 keys are moved to the new keys (V5 04, V7 09)", () => {
    for (const f of ["v5/04_V3_Orb_ID_Korrekturen.csv", "v7/09_BESTEHENDE_REZEPT_MAPPING.csv"]) {
      const { rows } = parseCsv(BUILTIN_FILES.find(([n]) => n === f)![1]);
      for (const r of rows) expect(data.keyMap[r.v3_recipe_key]).toBe(r.new_recipe_key);
    }
  });
  it("V7 80 % table agrees with the recipe data and the 80 % rule", () => {
    const { rows } = parseCsv(BUILTIN_FILES.find(([f]) => f === "v7/03_REZEPT_CHANCEN_80_PROZENT.csv")![1]);
    let combos = 0;
    for (const row of rows) {
      const r = R(data.keyMap[row.recipe_key] ?? row.recipe_key);
      expect(r, row.recipe_key).toBeTruthy();
      if (row.n80_normal_at_required) expect(attemptsFor(effectiveChance(r, "normal")), row.recipe_key).toBe(Number(row.n80_normal_at_required));
      if (row.n80_combo_best) { combos++; expect(r.best, row.recipe_key).toBeTruthy(); expect(attemptsFor(effectiveChance(r.best!, "combo")), row.recipe_key).toBe(Number(row.n80_combo_best)); }
    }
    expect(combos).toBe(188);
  });
  it("transfer alternatives are kept apart and marked unconfirmed", () => {
    const t = R("recipe:311093011").ingredients.find((i) => i.kind === "transfer")!;
    expect(t.alternatives?.[0]).toMatchObject({ name: "True Dragon Lord Orb", unverified: true });
  });
});

describe("Orb chain Lv18 → 102 (09)", () => {
  for (const [faction, last, names] of [
    ["Elyos", "recipe:311093015", ["Truth Orb", "Expert's Truth Orb", "Artisan's Truth Orb", "True Dragon Lord Orb", "Splendent True Dragon Lord Orb", "White Dragon Lord Orb", "Splendent White Dragon Lord Orb", "Wise Dragon Lord Orb", "Splendent Wise Dragon Lord Orb"]],
    ["Asmodian", "recipe:321093015", ["Truth Orb", "Expert's Truth Orb", "Artisan's Truth Orb", "Star Dragon Lord Orb", "Splendent Star Dragon Lord Orb", "Dark Dragon Lord Orb", "Splendent Dark Dragon Lord Orb", "Ebony Dragon Lord Orb", "Splendent Ebony Dragon Lord Orb"]],
  ] as const) {
    it(`${faction}: 9 stages in order, levels 18 → 102`, () => {
      const chain = data.chains.filter((c) => c.faction === faction && c.slot === "orb").sort((a, b) => a.position - b.position);
      expect(chain.map((c) => R(c.recipeKey).name)).toEqual(names);
      expect(chain.map((c) => c.normalLevel)).toEqual([18, 28, 39, 62, 70, 78, 86, 94, 102]);
      expect(chain.filter((c) => c.extraLv44Base).map((c) => c.normalLevel)).toEqual([78, 94]);
    });
    it(`${faction}: full path to 102 uses three Lv44 bases and the safe upgrades`, () => {
      const p = proj(last, { faction });
      const path = remainingPath(p, data);
      const names44 = path.filter((m) => m.recipe.name === "Artisan's Truth Orb");
      expect(names44).toHaveLength(3);
      expect(names44.every((m) => m.goal === "combo")).toBe(true);
      expect(path[path.length - 1].recipe.recipeKey).toBe(last);
      // every stage of the confirmed chain appears in the path
      for (const c of data.chains.filter((c) => c.faction === faction && c.slot === "orb")) expect(path.some((m) => m.recipe.recipeKey === c.recipeKey)).toBe(true);
      // no recipe of the other faction
      expect(path.every((m) => m.recipe.faction === faction)).toBe(true);
    });
    it(`${faction}: start at any stage — owning the 86 item skips everything below it except the extra Lv44 base`, () => {
      const r86 = data.chains.find((c) => c.faction === faction && c.normalLevel === 86)!;
      const p = proj(last, { faction, owned: [R(r86.recipeKey).output] });
      const path = remainingPath(p, data).map((m) => m.recipe.name);
      expect(path.slice(-2)).toEqual([names[7], names[8]]);
      expect(path.filter((n) => n === "Artisan's Truth Orb")).toHaveLength(1);
      expect(nextStep(p, data)!.recipe.name).toBe("Truth Orb");
    });
  }
  it("Lv62 / 78 / 94 combos lead to the Splendent version, Lv18 combo to the Splendent Truth Orb", () => {
    expect(R("recipe:311096001").comboOutput!.name).toBe("Splendent Truth Orb (Elyos)");
    expect(R("recipe:311093001").comboOutput!.name).toBe("Splendent True Dragon Lord Orb");
    expect(R("recipe:311093012").comboOutput!.name).toBe("Splendent White Dragon Lord Orb");
    expect(R("recipe:321093014").comboOutput!.name).toBe("Splendent Ebony Dragon Lord Orb");
  });
});

describe("80 % values against 05", () => {
  it("n80(25 %) = 6 with expected value 4; n80(0.2304) = 7", () => {
    expect(attemptsFor(0.25)).toBe(6);
    expect(expectedAttempts(0.25)).toBe(4);
    expect(attemptsFor(0.2304)).toBe(7);
  });
  it("every row of 05 matches the recipe data", () => {
    const { rows } = parseCsv(BUILTIN_FILES.find(([f]) => f === "v5/05_Ergaenzte_80pct_Chancen.csv")![1]);
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      const r = R(data.keyMap[row.recipe_key] ?? row.recipe_key);
      expect(r, row.recipe_key).toBeTruthy();
      expect(attemptsFor(effectiveChance(r, "normal"))).toBe(Number(row.n80_normal_at_required));
      if (row.n80_combo_at_best) expect(attemptsFor(effectiveChance(r.best!, "combo"))).toBe(Number(row.n80_combo_at_best));
    }
  });
});

describe("progress in %", () => {
  const last = "recipe:311093015";
  it("is based on recipe stages, three failures do not raise it, a success does", () => {
    const p = proj(last);
    const base = progress(p, data);
    expect(base.percent).toBe(0);
    expect(base.total).toBe(remainingPath(p, data, { fromScratch: true }).length);
    const truth = R("recipe:311096001");
    const fails = [attempt(p.id, truth, "base_fail"), attempt(p.id, truth, "base_fail"), attempt(p.id, truth, "combo_fail")];
    expect(progress(p, { ...data, events: fails }).done).toBe(truth.comboFailKeepsNormal === true ? 0 : 0);
    expect(progress(p, { ...data, events: fails.slice(0, 2) }).percent).toBe(0);
    const ok = progress(p, { ...data, events: [...fails.slice(0, 2), attempt(p.id, truth, "combo_success")] });
    expect(ok.done).toBe(1);
    expect(ok.percent).toBeGreaterThan(0);
  });
  it("70 → 86 → 102 with 86 owned is not 100 %", () => {
    const p = proj(last, { owned: [R("recipe:311093013").output] });
    const pr = progress(p, data);
    expect(pr.percent).toBeLessThan(100);
    expect(pr.done).toBeGreaterThan(0);
    expect(pr.milestones[pr.milestones.length - 1].done).toBe(false);
  });
  it("100 % only once the final item is there", () => {
    const p = proj(last, { owned: [R(last).output] });
    expect(progress(p, data).percent).toBe(100);
  });
});

describe("prices (manual only)", () => {
  const bow = "recipe:211046001";
  const wood = R(bow).ingredients.find((i) => i.name === "Yggdrasil Wood")!;
  it("the data package brings only marked reference prices (Tyron's Odar list), no others", () => {
    expect(data.prices.length).toBeGreaterThan(0);
    expect(data.prices.every((p) => p.suggested && p.itemId && p.server === "odar")).toBe(true);
    const noRef = { ...data, prices: [] };
    expect(priceOf(ctxOf(noRef, proj(bow)), wood, "low")).toBeNull();
  });
  it("wood 10k–12k is used right away; a project-only 15k–18k wins only in that project", () => {
    const s: CraftState = { ...data, prices: [{ ...wood, id: "w", server: "odar", low: 10000, high: 12000, ref: null, tradeable: true }] };
    const p = proj(bow);
    const c = attemptCost(R(bow), ctxOf(s, p), "low");
    expect(c.partial).toBeGreaterThanOrEqual(3 * 10000);
    expect(priceOf(ctxOf(s, p), wood, "high")).toBe(12000);
    const p2 = { ...p, id: "p2", priceOverrides: [{ ...wood, server: "odar", low: 15000, high: 18000, ref: null, tradeable: true }] };
    expect(priceOf(ctxOf(s, p2), wood, "low")).toBe(15000);
    expect(findPrice(ctxOf(s, p2), wood)!.scope).toBe("project");
    expect(priceOf(ctxOf(s, p), wood, "low")).toBe(10000);
    const step = { ...p, id: "p3", priceOverrides: [{ ...wood, stepKey: bow, low: 15000, high: 18000, ref: null, tradeable: true }] };
    expect(priceOf(ctxOf(s, step, bow), wood, "low")).toBe(15000);
    expect(priceOf(ctxOf(s, step, "recipe:other"), wood, "low")).toBe(10000);
  });
  it("a price saved for one server is not used on another", () => {
    const s: CraftState = { ...data, prices: [{ ...wood, server: "odar", low: 10000, high: 12000, ref: null, tradeable: true }] };
    expect(priceOf(ctxOf(s, proj(bow, { server: "other" })), wood, "low")).toBeNull();
  });
  it("logged attempts keep their cost after a price change", () => {
    const p = proj(bow);
    const e = attempt(p.id, R(bow), "success");
    const s: CraftState = { ...data, projects: [p], events: [e], prices: [{ ...wood, server: "odar", low: 99999, high: 99999, ref: null, tradeable: true }] };
    expect((s.events[0] as AttemptEvent).costLow).toBe(1);
  });
  it("missing prices never give 0 Kinah", () => {
    const c = attemptCost(R(bow), ctxOf(data, proj(bow)), "low");
    expect(c.cost).toBeNull();
    expect(c.missing.length).toBeGreaterThan(0);
  });
});

describe("price catalogue", () => {
  it("covers the start catalogue and every recipe result and ingredient", () => {
    const cat = buildCatalog(data);
    expect(cat.length).toBeGreaterThanOrEqual(214);
    for (const r of data.recipes) expect(cat.some((c) => c.recipeKeys.includes(r.recipeKey))).toBe(true);
    expect(cat.some((c) => c.name === "Yggdrasil Wood")).toBe(true);
  });
  it("grows with a new recipe import", () => {
    const before = buildCatalog(data).length;
    const s = importFile(data, "neu.csv", "recipe_key,recipe_name,faction,gear_slot\nrecipe:test1,Testring Neu,Elyos,ring\n").state;
    const cat = buildCatalog(s);
    expect(cat.length).toBe(before + 1);
    expect(cat.find((c) => c.name === "Testring Neu")!.category).toBe("ring");
  });
});

describe("next steps across projects", () => {
  it("done projects leave the next steps but keep their history", () => {
    const p = proj("recipe:311093015");
    const e = attempt(p.id, R("recipe:311096001"), "combo_success");
    const s = { ...data, projects: [{ ...p, status: "done" as const }], events: [e] };
    expect(nextSteps(s, p.charKey)).toHaveLength(0);
    expect(s.events).toHaveLength(1);
  });
});

describe("stored data from Phase 1 (version 1)", () => {
  it("keeps projects, prices and history and adds the built-in recipes", async () => {
    const { migrate } = await import("../../components/craft-store");
    const p = proj("recipe:311093015");
    const old = { version: 1, recipes: [], overrides: [], prices: [{ name: "Odyle", server: "odar", low: 5, high: 6, ref: null, tradeable: true }], gaps: [], imports: [], inventory: { "n:odyle": 3 }, projects: [p], events: [] };
    const s = migrate(old as never);
    expect(s.version).toBe(2);
    expect(s.recipes).toHaveLength(391);
    expect(s.projects).toEqual([p]);
    expect(s.prices.filter((x) => !x.suggested)).toEqual(old.prices);
    expect(s.inventory).toEqual(old.inventory);
    expect(migrate(s)).toEqual(s);
  });
});

describe("price page groups", () => {
  it("materials by kind, gear by slot, one entry per item for the character's faction", async () => {
    const { entriesFor } = await import("../crafting/catalog-groups");
    const e = entriesFor(buildCatalog(data), "Asmodian");
    const g = (n: string) => e.find((x) => x.name === n)!;
    expect(g("Pure Orichalcum Ore").group).toBe("ore");
    expect(g("Fine Sapphire Gemstone").group).toBe("gem");
    expect(g("Yggdrasil Log").group).toBe("wood");
    expect(g("Odyle").group).toBe("odyle");
    expect(g("Lesser Dragon Scale Hardener (Bound)").group).toBe("refine");
    expect(g("Enhanced Thick Balaur Scale").group).toBe("balaur");
    expect(g("Expert’s Splendent Orichalcum Guard")).toMatchObject({ area: "gear", group: "guard" });
    expect(g("Artisan's Splendent Sapphire Ring")).toMatchObject({ area: "gear", group: "jewelry" });
    expect(g("Star Dragon Lord Orb")).toMatchObject({ area: "gear", group: "weapon" });
    expect(e.filter((x) => x.name === "Magic Crystal")).toHaveLength(1);
    expect(e.some((x) => /white dragon lord/i.test(x.name))).toBe(false);
    expect(e.some((x) => /guaranteed alternative/i.test(x.name))).toBe(false);
  });
});

describe("gear lines and the bottom-up need list", () => {
  it("every crafted slot has a line with its top stage; guaranteed alternatives are not stages", async () => {
    const { ladderFor, topOf } = await import("../crafting/model");
    expect(topOf(data, "Asmodian", "orb")!.name).toBe("Splendent Ebony Dragon Lord Orb");
    expect(topOf(data, "Elyos", "sword")!.name).toBe("Splendent Wise Dragon Lord Longsword");
    expect(topOf(data, "Elyos", "ring")!.name).toBe("Splendent Wise Dragon Lord Ring");
    expect(ladderFor(data, "Elyos", "ring")).toHaveLength(9);
    for (const slot of ["sword", "greatsword", "dagger", "mace", "orb", "spellbook", "bow", "staff", "guard", "ring", "earrings", "necklace", "gloves", "chest", "legs", "helm", "shoulders", "boots", "cape"])
      for (const f of ["Elyos", "Asmodian"]) expect(ladderFor(data, f, slot).length, `${f} ${slot}`).toBeGreaterThanOrEqual(9);
  });
  it("k successes with 80 %: one success is the usual value, more successes need more attempts", async () => {
    const { attemptsForK } = await import("../crafting/prob");
    expect(attemptsForK(0.25, 1)).toBe(6);
    expect(attemptsForK(1, 3)).toBe(3);
    expect(attemptsForK(0.5, 2)).toBe(5);
    expect(attemptsForK(null, 2)).toBeNull();
  });
  it("Orb to 102 needs three Lv44 combo bases, counted on one line", async () => {
    const { needList } = await import("../crafting/model");
    const l = needList(proj("recipe:321093015", { faction: "Asmodian" }), data);
    const lv44 = l.find((x) => x.recipe.name === "Artisan's Truth Orb")!;
    expect(lv44.count).toBe(3);
    expect(lv44.basis).toBe("best");
    expect(lv44.expected).toBeCloseTo(3 / 0.2344, 5);
    expect(l.at(-1)!.recipe.name).toBe("Splendent Ebony Dragon Lord Orb");
  });
});

describe("craft plan (top-down calculator) and routes", () => {
  it("hands attempts × qty down to the stage below, at 75 % by default", async () => {
    const { craftPlan, PLAN_CONFIDENCE, itemKey } = await import("../crafting/model");
    const { attemptsForK } = await import("../crafting/prob");
    expect(PLAN_CONFIDENCE).toBe(0.75);
    const plan = craftPlan(proj("recipe:321093015", { faction: "Asmodian" }), data);
    expect(plan.lines.at(-1)!.recipe.name).toBe("Splendent Ebony Dragon Lord Orb");
    for (const l of plan.lines) if (l.attempts !== null) expect(l.attempts).toBe(attemptsForK(l.p, l.missing, 0.75));
    // every crafted input line gets exactly the attempts × qty its consumers plan
    for (const low of plan.lines) {
      const fromAbove = plan.lines.reduce((n, up) => n + up.recipe.ingredients.filter((i) => itemKey(i) === itemKey(low.item)).reduce((m, i) => m + Math.ceil((up.attempts ?? 0) * (i.qty ?? 0)), 0), 0);
      if (low !== plan.lines.at(-1)) expect(low.need).toBe(fromAbove);
    }
  });
  it("uses stock first and plans less below", async () => {
    const { craftPlan, withOwnedCount } = await import("../crafting/model");
    const p = proj("recipe:321093015", { faction: "Asmodian" });
    const before = craftPlan(p, data);
    const art = before.lines.find((l) => /^Artisan/.test(l.item.name))!;
    const after = craftPlan(withOwnedCount(p, art.item, 2), data);
    const art2 = after.lines.find((l) => l.recipe.recipeKey === art.recipe.recipeKey)!;
    expect(art2.have).toBe(2);
    expect(art2.missing).toBe(art.missing - 2);
    expect(after.lines[0].need).toBeLessThan(before.lines[0].need);
  });
  it("routes: buying a start item drops its crafts, buying the final item drops all", async () => {
    const { craftPlan, routeItems, withRoute, routeOptions, itemKey, savePrice } = await import("../crafting/model");
    const p = proj("recipe:321093015", { faction: "Asmodian" });
    const items = routeItems(p, data);
    expect(items.length).toBeGreaterThan(3);
    const fin = craftPlan(withRoute(p, data, "final"), data);
    expect(fin.lines).toHaveLength(0);
    expect(fin.materials).toHaveLength(1);
    const top = items.at(-1)!;
    const v = withRoute(p, data, itemKey(top));
    expect(craftPlan(v, data).lines.some((l) => itemKey(l.item) === itemKey(top))).toBe(false);
    // with only the final price known, buying it is the only priced route and gets recommended
    const priced = savePrice(data, craftPlan(withRoute(p, data, "final"), data).materials[0].item, { low: 5, high: 5, ref: null, tradeable: true }, { kind: "global", server: "odar" });
    const opts = routeOptions(p, priced);
    expect(opts.find((o) => o.recommended)?.key).toBe("final");
    expect(opts.find((o) => o.key === "all")!.conf.cost).toBeNull();
  });
});

describe("start from the lowest stage", () => {
  it("a new orb project targets the top stage but starts at the lowest one; stock moves the start up", async () => {
    const { currentCraft, routeOptions, missingRoutePrices, topOf, routeOf, withOwnedCount, itemKey } = await import("../crafting/model");
    const top = topOf(data, "Asmodian", "orb")!;
    const p = proj(top.recipeKey, { faction: "Asmodian" });
    expect(top.name).toBe("Splendent Ebony Dragon Lord Orb");
    expect(routeOf(p, data)).toBe("all");
    const cur = currentCraft(p, data);
    expect(cur.line!.item.name).toBe("Splendent Truth Orb (Asmodian)");
    const opts = routeOptions(p, data);
    expect(opts.find((o) => o.key === "all")!.start!.name).toBe("Splendent Truth Orb (Asmodian)");
    // the Fine Sapphire Gemstone has no price in the Odar list: it is asked for, never made up
    expect(missingRoutePrices(opts).some((i) => i.name === "Fine Sapphire Gemstone")).toBe(true);
    // with enough Artisan's orbs in stock, the lower stages drop out and the start moves up
    const art = cur.plan.lines.find((l) => /^Artisan/.test(l.item.name))!;
    const withStock = withOwnedCount(p, art.item, art.need);
    const after = currentCraft(withStock, data);
    expect(itemKey(after.line!.item)).not.toBe(itemKey(cur.line!.item));
    expect(after.plan.lines.some((l) => /^Expert/.test(l.item.name) && l.missing > 0)).toBe(false);
  });
});

describe("Odar reference prices (V2 list)", () => {
  it("imports only marked rows with an item ID and never replaces the player's own price", async () => {
    const { findPrice, importPriceSuggestions, savePrice } = await import("../crafting/model");
    const radiant = findPrice({ prices: data.prices, server: "odar" }, { name: "Radiant Odyle", itemId: "610610016" });
    expect(radiant?.suggested).toBe("observed");
    expect(radiant?.low).toBeGreaterThan(0);
    expect(findPrice({ prices: data.prices, server: "odar" }, { name: "Sandpaper (Bound)", itemId: "630542005" })).toBeUndefined();
    const own = savePrice(data, { name: "Radiant Odyle", itemId: "610610016" }, { low: 1, high: 2, ref: null, tradeable: true }, { kind: "global", server: "odar" });
    const text = BUILTIN_FILES.find(([f]) => f.startsWith("odar/"))![1];
    const again = importPriceSuggestions(text, own.prices);
    const p = findPrice({ prices: again.prices, server: "odar" }, { name: "Radiant Odyle", itemId: "610610016" })!;
    expect([p.low, p.high, p.suggested]).toEqual([1, 2, undefined]);
  });
});

describe("Tyron's chain rules (2026-11-23)", () => {
  const setup = async () => {
    const m = await import("../crafting/model");
    const top = m.topOf(data, "Asmodian", "orb")!;
    return { m, p: proj(top.recipeKey, { faction: "Asmodian" }) };
  };
  it("safe Sterndrachenkönig: one guaranteed craft, so the Master orb is needed exactly 3 times", async () => {
    const { m, p } = await setup();
    const plan = m.craftPlan({ ...p, starSafe: true }, data);
    const star = plan.lines.find((l) => l.recipe.recipeKey === "recipe:321093001")!;
    expect([star.p, star.attempts]).toEqual([1, 1]);
    expect(plan.lines.find((l) => /^Artisan’s Splendent/.test(l.item.name))!.need).toBe(3);
  });
  it("risky: a failed combo loses the item, so the keep-chance drops with the combo success", async () => {
    const { m, p } = await setup();
    const r = data.recipes.find((x) => x.recipeKey === "recipe:321093001")!;
    const star = (cs: number | null) => m.craftPlan({ ...p, starSafe: false, comboSuccess: cs }, data).lines.find((l) => l.recipe.recipeKey === r.recipeKey)!.p!;
    expect(star(null)).toBeCloseTo(r.pBase!, 6); // unknown: minimum (combo never fails)
    expect(star(0.5)).toBeCloseTo(r.pBase! * (1 - 0.25 * 0.5), 6);
  });
  it("combo items up to Lv 44: chance = base × activation × combo success; unknown success is flagged", async () => {
    const { m, p } = await setup();
    const grey = data.recipes.find((x) => x.recipeKey === "recipe:321096001")!;
    const line = (cs: number | null) => m.craftPlan({ ...p, starSafe: true, comboSuccess: cs }, data).lines[0];
    expect(line(null).p).toBeCloseTo(grey.pBase! * 0.25, 6);
    expect(line(0.8).p).toBeCloseTo(grey.pBase! * 0.25 * 0.8, 6);
    expect(m.comboAssumed({ ...p, comboSuccess: null })).toBe(true);
  });
  it("the Asmodian orb recipes match the in-game screenshots and count as confirmed", async () => {
    const { m } = await setup();
    const s = m.applyConfirmations(data);
    for (const k of m.SCREENSHOT_CONFIRMED) expect(s.recipes.find((r) => r.recipeKey === k)!.ingredientsStatus).toBe("complete");
    const dark = s.recipes.find((r) => r.recipeKey === "recipe:321093012")!;
    expect(dark.ingredients.map((i) => `${i.qty}x ${i.name}`)).toContain("29x Enhanced Hard Balaur Scale");
  });
});
