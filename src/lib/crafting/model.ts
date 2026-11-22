import { col, parseCsv, readBool, readNumber, readProb } from "./csv";
import { attemptsFor, effectiveChance, planFor, type ChanceGoal, type Prob, type RecipeChances } from "./prob";

/* ------------------------------------------------------------------ data model ------------------------------------------------------------------ */

export interface ItemRef { itemId?: string; name: string }
export const itemKey = (m: ItemRef) => (m.itemId ? `id:${m.itemId}` : `n:${m.name.trim().toLowerCase()}`);
const sameItem = (a: ItemRef, b: ItemRef) =>
  (a.itemId && b.itemId ? a.itemId === b.itemId : a.name.trim().toLowerCase() === b.name.trim().toLowerCase());

export interface Ingredient extends ItemRef {
  qty: number | null;
  bound: boolean | null;
  /** lost when the craft fails (null = not documented) */
  consumedOnFail: boolean | null;
}

/** One named recipe per faction (not per gear type). */
export interface Recipe extends RecipeChances {
  recipeKey: string;
  recipeId?: string;
  name: string;
  faction: string;
  profession?: string;
  requiredMastery: number | null;
  /** mastery level the chances in this row were read at */
  documentedMastery: number | null;
  slot?: string;
  level: number | null;
  output: ItemRef & { qty: number };
  comboOutput?: ItemRef;
  /** after a failed combo the normal result is kept (null = not documented) */
  comboFailKeepsNormal: boolean | null;
  transfer: boolean | null;
  consumesOnFail: boolean | null;
  patch?: string;
  source?: string;
  ingredients: Ingredient[];
}

/** Chance read in game at a character's real mastery; wins over the table value without deleting it. */
export interface ChanceOverride {
  recipeKey: string;
  character: string;
  mastery: number | null;
  pBase: Prob; pComboActivation: Prob; pComboSuccess: Prob; pFinal: Prob;
  date?: string; source?: string;
}

export interface Price extends ItemRef {
  quality?: string;
  region?: string;
  server?: string;
  low: number | null;
  high: number | null;
  ref: number | null;
  owned: number | null;
  tradeable: boolean | null;
  updated?: string;
}

/** Fixed project order (not a smart gear ranking). */
export type CraftSlot = "weapon" | "ring" | "guard" | "gloves" | "jewelry" | "armor";
export const SLOT_PRIORITY: CraftSlot[] = ["weapon", "ring", "guard", "gloves", "jewelry", "armor"];

export interface Project {
  id: string;
  charKey: string;
  character: string;
  faction: string;
  server: string;
  className?: string;
  slot: CraftSlot;
  /** manual order within the same slot (lower first); creation time breaks ties */
  order?: number;
  profession?: string;
  mastery: number | null;
  targetRecipeKey: string;
  /** what the project is after: the normal result or the combo result of the target recipe */
  goal: ChanceGoal;
  status: "active" | "paused" | "done";
  createdAt: string;
  /** intermediate items the player already owns (skips their crafts only) */
  owned: ItemRef[];
}

export type Outcome = "base_fail" | "success" | "combo_success" | "combo_fail" | "guaranteed_success";

export interface AttemptEvent {
  id: string;
  kind: "attempt";
  projectId: string;
  at: string;
  recipeKey: string;
  outcome: Outcome;
  consumed: (ItemRef & { qty: number })[];
  produced: (ItemRef & { qty: number })[];
  /** cost of this attempt at the prices of that moment (null = prices missing) */
  costLow: number | null;
  costHigh: number | null;
}
export interface UndoEvent { id: string; kind: "undo"; at: string; target: string; reason?: string }
export type CraftEvent = AttemptEvent | UndoEvent;

export interface CraftData {
  recipes: Recipe[];
  overrides: ChanceOverride[];
  prices: Price[];
  /** rows of the gap lists (02B, 04, 06, coverage), shown as they are */
  gaps: { file: string; rows: Record<string, string>[] }[];
  /** imported file names with time, for versioning */
  imports: { file: string; at: string; rows: number; errors: number }[];
}

export interface CraftState extends CraftData {
  version: 1;
  /** player's materials: itemKey → amount */
  inventory: Record<string, number>;
  projects: Project[];
  events: CraftEvent[];
}

export const emptyState = (): CraftState => ({ version: 1, recipes: [], overrides: [], prices: [], gaps: [], imports: [], inventory: {}, projects: [], events: [] });

/* ------------------------------------------------------------------ import ------------------------------------------------------------------ */

export interface ImportError { row: number; message: string }
export type FileKind = "recipes" | "chances" | "materials" | "prices" | "gaps" | "template" | "unknown";

/** Which input a file is, by its number prefix (01, 01B, 02, 02B …). */
export function fileKind(name: string): FileKind {
  const n = name.split(/[\\/]/).pop()!.toLowerCase();
  if (/^01b[_-]/.test(n)) return "chances";
  if (/^01[_-]/.test(n)) return "recipes";
  if (/^02b[_-]/.test(n)) return "gaps";
  if (/^02[_-]/.test(n)) return "materials";
  if (/^03[_-]/.test(n)) return "prices";
  if (/^0[46][_-]/.test(n) || /^abdeckung/.test(n)) return "gaps";
  if (/^05[_-]/.test(n)) return "template";
  return "unknown";
}

const FACTIONS = new Set(["elyos", "asmodian", "asmodier", "beide", "both", "all"]);

function chancesOf(r: Record<string, string>, errs: string[]) {
  const p = (...names: string[]) => { const x = readProb(col(r, ...names)); if (x.error) errs.push(x.error); return x.value; };
  return {
    pBase: p("p_base_success"),
    pComboActivation: p("p_combo_activation_given_base_success", "p_combo_activation"),
    pComboSuccess: p("p_combo_success_given_activation", "p_combo_success"),
    pFinal: p("p_final_item_per_attempt", "p_final"),
  };
}

function num(r: Record<string, string>, errs: string[], ...names: string[]) {
  const x = readNumber(col(r, ...names)); if (x.error) errs.push(x.error); return x.value;
}
function bool(r: Record<string, string>, errs: string[], ...names: string[]) {
  const x = readBool(col(r, ...names)); if (x.error) errs.push(x.error); return x.value;
}
const str = (r: Record<string, string>, ...names: string[]) => col(r, ...names) || undefined;

/** Recipes (01). Duplicate recipe_key → error on the later row, the first one stays. */
export function importRecipes(text: string, existing: Recipe[] = []) {
  const { rows } = parseCsv(text);
  const errors: ImportError[] = [];
  const out = new Map(existing.map((r) => [r.recipeKey, r] as const));
  const seen = new Set<string>();
  rows.forEach((r, i) => {
    const row = i + 2;
    const errs: string[] = [];
    const key = str(r, "recipe_key");
    if (!key) { errors.push({ row, message: "recipe_key fehlt" }); return; }
    if (seen.has(key)) { errors.push({ row, message: `doppelter recipe_key "${key}"` }); return; }
    seen.add(key);
    const faction = str(r, "faction", "fraktion") ?? "";
    if (faction && !FACTIONS.has(faction.toLowerCase())) errs.push(`unbekannte Fraktion "${faction}"`);
    const outName = str(r, "output_name", "output_item_name", "item_name", "target_item", "name");
    if (!outName) errs.push("Ausgabe-Item fehlt");
    const comboName = str(r, "combo_output_name", "combo_item_name");
    const recipe: Recipe = {
      recipeKey: key,
      recipeId: str(r, "recipe_id"),
      name: str(r, "recipe_name", "name") ?? key,
      faction,
      profession: str(r, "profession", "beruf"),
      requiredMastery: num(r, errs, "required_mastery", "required_craft_level"),
      documentedMastery: num(r, errs, "documented_mastery", "mastery_documented", "best_documented_mastery"),
      slot: str(r, "gear_type", "slot"),
      level: num(r, errs, "item_level", "level"),
      output: { name: outName ?? "", itemId: str(r, "output_item_id", "item_id"), qty: num(r, errs, "output_qty") ?? 1 },
      comboOutput: comboName ? { name: comboName, itemId: str(r, "combo_output_item_id", "combo_item_id") } : undefined,
      comboFailKeepsNormal: bool(r, errs, "combo_fail_keeps_normal"),
      guaranteed: bool(r, errs, "guaranteed_success"),
      transfer: bool(r, errs, "transfer_gear", "transfers_gear"),
      consumesOnFail: bool(r, errs, "consumes_on_fail", "materials_lost_on_fail"),
      patch: str(r, "patch"),
      source: str(r, "source", "quelle"),
      ...chancesOf(r, errs),
      ingredients: out.get(key)?.ingredients ?? [],
    };
    if (errs.length) { errors.push({ row, message: errs.join("; ") }); return; }
    out.set(key, recipe);
  });
  return { recipes: [...out.values()], errors, rows: rows.length };
}

/** Direct materials (02), one material per row; replaces the ingredient list of each recipe named in the file. */
export function importMaterials(text: string, recipes: Recipe[]) {
  const { rows } = parseCsv(text);
  const errors: ImportError[] = [];
  const byKey = new Map(recipes.map((r) => [r.recipeKey, { ...r, ingredients: [] as Ingredient[] }] as const));
  const touched = new Set<string>();
  rows.forEach((r, i) => {
    const row = i + 2, errs: string[] = [];
    const key = str(r, "recipe_key");
    const rec = key ? byKey.get(key) : undefined;
    if (!rec) { errors.push({ row, message: key ? `Rezept "${key}" unbekannt (erst 01 importieren)` : "recipe_key fehlt" }); return; }
    const name = str(r, "material_name", "item_name", "name");
    if (!name) { errors.push({ row, message: "Materialname fehlt" }); return; }
    const ing: Ingredient = {
      name, itemId: str(r, "material_item_id", "item_id"),
      qty: num(r, errs, "qty", "quantity", "menge"),
      bound: bool(r, errs, "bound", "gebunden"),
      consumedOnFail: bool(r, errs, "consumed_on_fail", "lost_on_fail"),
    };
    if (errs.length) { errors.push({ row, message: errs.join("; ") }); return; }
    touched.add(rec.recipeKey);
    rec.ingredients.push(ing);
  });
  const merged = recipes.map((r) => (touched.has(r.recipeKey) ? byKey.get(r.recipeKey)! : r));
  return { recipes: merged, errors, rows: rows.length };
}

/** Per-character chances (01B). */
export function importChances(text: string, existing: ChanceOverride[] = []) {
  const { rows } = parseCsv(text);
  const errors: ImportError[] = [];
  const out = [...existing];
  rows.forEach((r, i) => {
    const row = i + 2, errs: string[] = [];
    const recipeKey = str(r, "recipe_key"), character = str(r, "character", "charakter", "char_name");
    if (!recipeKey || !character) { errors.push({ row, message: "recipe_key oder Charakter fehlt" }); return; }
    const o: ChanceOverride = { recipeKey, character, mastery: num(r, errs, "mastery", "craft_level", "handwerksstufe"), ...chancesOf(r, errs), date: str(r, "date", "datum"), source: str(r, "source", "quelle") };
    if (errs.length) { errors.push({ row, message: errs.join("; ") }); return; }
    const at = out.findIndex((x) => x.recipeKey === recipeKey && x.character.toLowerCase() === character.toLowerCase() && x.mastery === o.mastery);
    if (at >= 0) out[at] = o; else out.push(o);
  });
  return { overrides: out, errors, rows: rows.length };
}

/** Market prices (03). Empty price stays null, never 0. */
export function importPrices(text: string, existing: Price[] = []) {
  const { rows } = parseCsv(text);
  const errors: ImportError[] = [];
  const out = [...existing];
  rows.forEach((r, i) => {
    const row = i + 2, errs: string[] = [];
    const name = str(r, "name", "item_name", "material_name");
    if (!name) { errors.push({ row, message: "Name fehlt" }); return; }
    const p: Price = {
      name, itemId: str(r, "item_id"), quality: str(r, "quality", "qualitaet"), region: str(r, "region", "market_region"), server: str(r, "server"),
      low: num(r, errs, "price_low", "preis_niedrig", "low"), high: num(r, errs, "price_high", "preis_hoch", "high"),
      ref: num(r, errs, "price_ref", "reference_price", "referenzpreis"), owned: num(r, errs, "owned", "vorhanden", "own_stock"),
      tradeable: bool(r, errs, "tradeable", "handelbar"), updated: str(r, "updated", "last_update", "zeitpunkt"),
    };
    if (p.low !== null && p.high !== null && p.low > p.high) errs.push("Niedrigpreis über Hochpreis");
    if (errs.length) { errors.push({ row, message: errs.join("; ") }); return; }
    const at = out.findIndex((x) => sameItem(x, p) && (x.server ?? "") === (p.server ?? ""));
    if (at >= 0) out[at] = p; else out.push(p);
  });
  return { prices: out, errors, rows: rows.length };
}

/** Imports one file into the state (never touches projects or history). */
export function importFile(state: CraftState, fileName: string, text: string): { state: CraftState; kind: FileKind; errors: ImportError[]; rows: number } {
  const kind = fileKind(fileName);
  const at = new Date().toISOString();
  let next = state, errors: ImportError[] = [], rows = 0;
  if (kind === "recipes") { const r = importRecipes(text, state.recipes); next = { ...state, recipes: r.recipes }; errors = r.errors; rows = r.rows; }
  else if (kind === "materials") { const r = importMaterials(text, state.recipes); next = { ...state, recipes: r.recipes }; errors = r.errors; rows = r.rows; }
  else if (kind === "chances") { const r = importChances(text, state.overrides); next = { ...state, overrides: r.overrides }; errors = r.errors; rows = r.rows; }
  else if (kind === "prices") { const r = importPrices(text, state.prices); next = { ...state, prices: r.prices }; errors = r.errors; rows = r.rows; }
  else if (kind === "gaps") { const p = parseCsv(text); rows = p.rows.length; next = { ...state, gaps: [...state.gaps.filter((g) => g.file !== fileName), { file: fileName, rows: p.rows }] }; }
  else return { state, kind, errors: [{ row: 0, message: `Datei "${fileName}" nicht erkannt` }], rows: 0 };
  next = { ...next, imports: [...next.imports.filter((x) => x.file !== fileName), { file: fileName, at, rows, errors: errors.length }] };
  return { state: next, kind, errors, rows };
}

/* ------------------------------------------------------------------ chances per mastery ------------------------------------------------------------------ */

/**
 * Chances for a recipe, kept apart by where they come from:
 * - documented: the table value, read at `documentedMastery`
 * - actual: read in game at the character's real mastery (override), or the table value only when the levels are equal
 * Nothing is interpolated between mastery levels.
 */
export function chancesFor(recipe: Recipe, overrides: ChanceOverride[], character: string, mastery: number | null) {
  const documented: RecipeChances = recipe;
  const own = overrides.filter((o) => o.recipeKey === recipe.recipeKey && o.character.toLowerCase() === character.toLowerCase());
  const match = own.find((o) => o.mastery === mastery) ?? (mastery === null ? own[own.length - 1] : undefined);
  let actual: RecipeChances | null = null, basis: "character" | "documented" | "none" = "none";
  if (match) { actual = { ...match, guaranteed: recipe.guaranteed }; basis = "character"; }
  else if (mastery !== null && recipe.documentedMastery !== null && mastery === recipe.documentedMastery) { actual = documented; basis = "documented"; }
  return { documented, documentedMastery: recipe.documentedMastery, actual, basis, override: match };
}

/** Outcomes a player can log for this recipe. */
export function outcomesFor(recipe: Recipe): Outcome[] {
  const list: Outcome[] = recipe.guaranteed === true ? ["guaranteed_success"] : ["base_fail", "success"];
  if (recipe.comboOutput) list.push("combo_success", "combo_fail");
  return list;
}

/* ------------------------------------------------------------------ history ------------------------------------------------------------------ */

/** Attempts that count (undo events cancel their target). */
export function activeAttempts(events: CraftEvent[]): AttemptEvent[] {
  const undone = new Set(events.filter((e): e is UndoEvent => e.kind === "undo").map((e) => e.target));
  return events.filter((e): e is AttemptEvent => e.kind === "attempt" && !undone.has(e.id));
}

/** What an attempt uses up and gives, from the recipe and the result. */
export function attemptEffects(recipe: Recipe, outcome: Outcome) {
  const failed = outcome === "base_fail";
  const consumed = recipe.ingredients
    .filter((i) => !failed || (i.consumedOnFail ?? recipe.consumesOnFail) !== false)
    .map((i) => ({ name: i.name, itemId: i.itemId, qty: i.qty ?? 0 }));
  const normal = { name: recipe.output.name, itemId: recipe.output.itemId, qty: recipe.output.qty };
  const produced =
    outcome === "success" || outcome === "guaranteed_success" ? [normal]
      : outcome === "combo_success" && recipe.comboOutput ? [{ ...recipe.comboOutput, qty: 1 }]
        : outcome === "combo_fail" && recipe.comboFailKeepsNormal === true ? [normal]
          : [];
  return { consumed, produced };
}

/* ------------------------------------------------------------------ prices & costs ------------------------------------------------------------------ */

export type Scenario = "low" | "high" | "ref";
export const priceOf = (prices: Price[], item: ItemRef, s: Scenario): number | null => {
  const p = prices.find((x) => sameItem(x, item));
  return p ? p[s] : null;
};

export interface Missing { what: string; item?: string }

/** Cost of one attempt from its direct ingredients; crafted ingredients the project holds cost nothing more. */
export function attemptCost(recipe: Recipe, prices: Price[], s: Scenario, free: (i: Ingredient) => boolean = () => false) {
  const missing: Missing[] = [];
  if (!recipe.ingredients.length) missing.push({ what: "Zutaten des Rezepts fehlen" });
  let sum = 0;
  for (const i of recipe.ingredients) {
    if (i.qty === null) { missing.push({ what: "Menge fehlt", item: i.name }); continue; }
    if (free(i)) continue;
    const p = priceOf(prices, i, s);
    if (p === null) missing.push({ what: "Preis fehlt", item: i.name });
    else sum += p * i.qty;
  }
  return missing.length ? { cost: null, missing } : { cost: sum, missing };
}

/** Cost of one failed attempt (what is lost). Unknown loss rule blocks the number. */
export function failCost(recipe: Recipe, prices: Price[], s: Scenario) {
  const missing: Missing[] = [];
  let sum = 0;
  for (const i of recipe.ingredients) {
    const lost = i.consumedOnFail ?? recipe.consumesOnFail;
    if (lost === null) { missing.push({ what: "Verbrauch bei Fehlschlag unbekannt", item: i.name }); continue; }
    if (!lost) continue;
    const p = priceOf(prices, i, s);
    if (p === null || i.qty === null) missing.push({ what: p === null ? "Preis fehlt" : "Menge fehlt", item: i.name });
    else sum += p * i.qty;
  }
  return missing.length ? { cost: null, missing } : { cost: sum, missing };
}

/**
 * 80 % budget for repeating one recipe until the goal comes out: n80 attempts, all but the last one are failures.
 * Blocked (null + reasons) when the chance, a price, a quantity or the loss rule is unknown.
 */
export function stepBudget(recipe: Recipe, p: Prob, prices: Price[], s: Scenario) {
  const n80 = attemptsFor(p);
  const ok = attemptCost(recipe, prices, s);
  const fail = failCost(recipe, prices, s);
  const missing = [...(n80 === null ? [{ what: "Chance unbekannt" }] : []), ...ok.missing, ...fail.missing];
  if (missing.length || n80 === null || !Number.isFinite(n80) || ok.cost === null || fail.cost === null) return { n80, budget: null, expected: null, missing };
  const e = 1 / (p as number);
  return { n80, budget: ok.cost + (n80 - 1) * fail.cost, expected: ok.cost + (e - 1) * fail.cost, missing };
}

/** Buy vs craft only for items that are really tradeable and have a price. */
export function buyOrCraft(item: ItemRef, prices: Price[], craftBudget: number | null, s: Scenario): "buy" | "craft" | null {
  const p = prices.find((x) => sameItem(x, item));
  if (!p || p.tradeable !== true || p[s] === null || craftBudget === null) return null;
  return p[s]! <= craftBudget ? "buy" : "craft";
}

/* ------------------------------------------------------------------ projects & next steps ------------------------------------------------------------------ */

export const projectTarget = (p: Project, recipes: Recipe[]): ItemRef | undefined => {
  const r = recipes.find((x) => x.recipeKey === p.targetRecipeKey);
  return r ? (p.goal === "combo" && r.comboOutput ? r.comboOutput : r.output) : undefined;
};

/** Items a project holds: owned intermediates plus what its attempts produced, minus what they used up. */
export function holdings(p: Project, events: CraftEvent[]): Map<string, number> {
  const m = new Map<string, number>();
  const add = (i: ItemRef, n: number) => m.set(itemKey(i), (m.get(itemKey(i)) ?? 0) + n);
  for (const o of p.owned) add(o, 1);
  for (const e of activeAttempts(events)) if (e.projectId === p.id) {
    for (const c of e.consumed) if (m.has(itemKey(c))) add(c, -c.qty);
    for (const x of e.produced) add(x, x.qty);
  }
  return m;
}

/** Recipe that makes an item (normal output first, then combo output). */
export function producerOf(item: ItemRef, recipes: Recipe[], faction?: string) {
  const ok = (r: Recipe) => !faction || !r.faction || ["beide", "both", "all"].includes(r.faction.toLowerCase()) || r.faction.toLowerCase() === faction.toLowerCase();
  return recipes.find((r) => ok(r) && sameItem(r.output, item)) ?? recipes.find((r) => ok(r) && r.comboOutput && sameItem(r.comboOutput, item));
}

export interface NextStep {
  project: Project;
  recipe: Recipe;
  /** the step aims at the combo result of this recipe */
  goal: ChanceGoal;
  /** direct ingredients and whether they are there */
  ingredients: (Ingredient & { have: number; crafted: boolean })[];
  chance: ReturnType<typeof chancesFor>;
  plan: ReturnType<typeof planFor>;
  documentedPlan: ReturnType<typeof planFor>;
  outcomes: Outcome[];
}

/**
 * The next real open action of a project: walks the dependency graph from the target down and returns the
 * first craft whose crafted inputs are all there. Owned intermediates skip only their own craft; base items a
 * later recipe needs on top are still asked for.
 */
export function nextStep(p: Project, state: CraftState, inventory: Map<string, number> = new Map(Object.entries(state.inventory))): NextStep | null {
  const target = projectTarget(p, state.recipes);
  if (!target) return null;
  const held = holdings(p, state.events);
  const take = (i: ItemRef, n: number) => { const k = itemKey(i); const h = held.get(k) ?? 0; if (h >= n) { held.set(k, h - n); return true; } return false; };
  const visiting = new Set<string>();
  const walk = (item: ItemRef, qty: number, forced?: { recipe: Recipe; goal: ChanceGoal }): NextStep | null | "ok" => {
    if (take(item, qty)) return "ok";
    const recipe = forced?.recipe ?? producerOf(item, state.recipes, p.faction);
    if (!recipe) return "ok"; // a plain material: bought or gathered, listed with the craft that needs it
    if (visiting.has(recipe.recipeKey)) return null;
    visiting.add(recipe.recipeKey);
    const goal: ChanceGoal = forced?.goal ?? (recipe.comboOutput && sameItem(recipe.comboOutput, item) && !sameItem(recipe.output, item) ? "combo" : "normal");
    for (const ing of recipe.ingredients) {
      if (!producerOf(ing, state.recipes, p.faction)) continue;
      const r = walk(ing, ing.qty ?? 1);
      if (r !== "ok") { visiting.delete(recipe.recipeKey); return r; }
    }
    visiting.delete(recipe.recipeKey);
    const chance = chancesFor(recipe, state.overrides, p.character, p.mastery);
    const heldNow = holdings(p, state.events);
    return {
      project: p, recipe, goal,
      ingredients: recipe.ingredients.map((i) => {
        const crafted = !!producerOf(i, state.recipes, p.faction);
        return { ...i, crafted, have: crafted ? heldNow.get(itemKey(i)) ?? 0 : inventory.get(itemKey(i)) ?? 0 };
      }),
      chance,
      plan: planFor(chance.actual ? effectiveChance(chance.actual, goal) : null),
      documentedPlan: planFor(effectiveChance(chance.documented, goal)),
      outcomes: outcomesFor(recipe),
    };
  };
  const root = state.recipes.find((r) => r.recipeKey === p.targetRecipeKey)!;
  const r = walk(target, 1, { recipe: root, goal: p.goal });
  return r === "ok" ? null : r;
}

const slotRank = (p: Project) => SLOT_PRIORITY.indexOf(p.slot);

/** Projects in the fixed order: weapon, rings, guard, gloves, other jewellery, armour; then manual order, then age. */
export function sortProjects(list: Project[]): Project[] {
  return [...list].sort((a, b) => slotRank(a) - slotRank(b) || (a.order ?? Infinity) - (b.order ?? Infinity) || a.createdAt.localeCompare(b.createdAt));
}

/**
 * Next steps of all active projects of a character, derived (never stored). Materials from the shared
 * inventory are handed out in project order, so the same stack is not counted for two projects.
 */
export function nextSteps(state: CraftState, charKey: string): NextStep[] {
  const pool = new Map(Object.entries(state.inventory));
  const out: NextStep[] = [];
  for (const p of sortProjects(state.projects.filter((x) => x.charKey === charKey && x.status === "active"))) {
    const s = nextStep(p, state, pool);
    if (!s) continue;
    s.ingredients = s.ingredients.map((i) => {
      if (i.crafted) return i;
      const k = itemKey(i), avail = pool.get(k) ?? 0, take = Math.min(avail, i.qty ?? 0);
      pool.set(k, avail - take);
      return { ...i, have: take };
    });
    out.push(s);
  }
  return out;
}

/** Kinah spent so far on a project (from the history, at the prices of each moment). */
export function spent(p: Project, events: CraftEvent[]) {
  let low = 0, high = 0, unknown = 0;
  for (const e of activeAttempts(events)) if (e.projectId === p.id) {
    if (e.costLow === null || e.costHigh === null) unknown++; else { low += e.costLow; high += e.costHigh; }
  }
  return { low, high, unknown };
}

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

/**
 * Every craft still open on the way to the project target, ingredients first. Owned and produced items are
 * taken into account; recipes appear as often as they are needed.
 */
export function remainingPath(p: Project, state: CraftState): { recipe: Recipe; goal: ChanceGoal }[] {
  const target = projectTarget(p, state.recipes);
  const root = state.recipes.find((r) => r.recipeKey === p.targetRecipeKey);
  if (!target || !root) return [];
  const held = holdings(p, state.events);
  const out: { recipe: Recipe; goal: ChanceGoal }[] = [];
  const stack = new Set<string>();
  const need = (item: ItemRef, qty: number, forced?: { recipe: Recipe; goal: ChanceGoal }) => {
    const k = itemKey(item), h = held.get(k) ?? 0;
    const take = Math.min(h, qty);
    held.set(k, h - take);
    for (let n = take; n < qty; n++) {
      const recipe = forced?.recipe ?? producerOf(item, state.recipes, p.faction);
      if (!recipe || stack.has(recipe.recipeKey)) return;
      stack.add(recipe.recipeKey);
      for (const ing of recipe.ingredients) if (producerOf(ing, state.recipes, p.faction)) need(ing, ing.qty ?? 1);
      stack.delete(recipe.recipeKey);
      const goal: ChanceGoal = forced?.goal ?? (recipe.comboOutput && sameItem(recipe.comboOutput, item) && !sameItem(recipe.output, item) ? "combo" : "normal");
      out.push({ recipe, goal });
    }
  };
  need(target, 1, { recipe: root, goal: p.goal });
  return out;
}

/**
 * Inputs for the whole-project 80 % simulation. Blocked (steps null + reasons) as soon as one chance,
 * quantity, price or loss rule on the path is unknown.
 */
export function pathSimInput(p: Project, state: CraftState, s: Scenario) {
  const path = remainingPath(p, state);
  const missing: (Missing & { step: string })[] = [];
  const steps = path.map(({ recipe, goal }) => {
    const c = chancesFor(recipe, state.overrides, p.character, p.mastery);
    const prob = c.actual ? effectiveChance(c.actual, goal) : null;
    if (prob === null) missing.push({ step: recipe.name, what: c.actual ? "Chance unbekannt" : "Chance bei deiner Handwerksstufe unbekannt" });
    const crafted = (i: Ingredient) => !!producerOf(i, state.recipes, p.faction);
    const ok = attemptCost(recipe, state.prices, s, crafted);
    const fail = failCost({ ...recipe, ingredients: recipe.ingredients.filter((i) => !crafted(i)) }, state.prices, s);
    for (const m of [...ok.missing, ...fail.missing]) missing.push({ step: recipe.name, ...m });
    // a failure that eats a crafted intermediate sends the path back; that branch is not simulated yet
    for (const i of recipe.ingredients.filter(crafted)) {
      const lost = i.consumedOnFail ?? recipe.consumesOnFail;
      if (lost !== false && (prob ?? 0) < 1) missing.push({ step: recipe.name, item: i.name, what: lost === null ? "Verbrauch bei Fehlschlag unbekannt" : "Fehlschlag verbraucht Zwischenitem (mehrstufige Prognose folgt)" });
    }
    return { p: prob ?? 0, cost: ok.cost ?? 0, failCost: fail.cost ?? 0 };
  });
  return { path, steps: missing.length ? null : steps, missing };
}
