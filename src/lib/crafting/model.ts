import { col, parseCsv, readBool, readNumber, readProb } from "./csv";
import { attemptsFor, attemptsForK, effectiveChance, planFor, type ChanceGoal, type Prob, type RecipeChances } from "./prob";

/* ------------------------------------------------------------------ items ------------------------------------------------------------------ */

export interface ItemRef { itemId?: string; name: string; faction?: string }

const FACTION_SUFFIX = /\s*\((elyos|asmodian|asmodier)\)\s*$/i;
/** Name for matching: case, curly apostrophes and a trailing "(Elyos)"/"(Asmodian)" do not matter. */
export const normName = (s: string) => s.replace(/[’‘`´]/g, "'").replace(FACTION_SUFFIX, "").replace(/\s+/g, " ").trim().toLowerCase();
/** Faction named in an item name, e.g. "True Dragon Lord Orb (Elyos)". */
export const factionInName = (s: string) => s.match(FACTION_SUFFIX)?.[1].toLowerCase().replace("asmodier", "asmodian");
const factionOf = (i: ItemRef) => (i.faction ? i.faction.toLowerCase().replace("asmodier", "asmodian") : factionInName(i.name));
const BOTH = new Set(["beide", "both", "all", ""]);

/** Same item: by item ID when both have one, otherwise by name; never across two different factions. */
export function sameItem(a: ItemRef, b: ItemRef): boolean {
  if (a.itemId && b.itemId) return a.itemId === b.itemId;
  if (normName(a.name) !== normName(b.name)) return false;
  const fa = factionOf(a), fb = factionOf(b);
  return !fa || !fb || BOTH.has(fa) || BOTH.has(fb) || fa === fb;
}
/** Key for inventory and lists: item ID if known, else name + faction. */
export const itemKey = (m: ItemRef) => (m.itemId ? `id:${m.itemId}` : `n:${normName(m.name)}${factionOf(m) ? `@${factionOf(m)}` : ""}`);

/** Item amounts where an entry with ID and one with only a name can be the same item. */
export class Holdings {
  private list: { ref: ItemRef; n: number }[] = [];
  private find(i: ItemRef) { return this.list.find((x) => sameItem(x.ref, i)); }
  get(i: ItemRef) { return this.find(i)?.n ?? 0; }
  add(i: ItemRef, n: number) { const hit = this.find(i); if (hit) { hit.n += n; if (!hit.ref.itemId && i.itemId) hit.ref = i; } else this.list.push({ ref: i, n }); }
  /** takes n if there are n, returns whether it did */
  take(i: ItemRef, n: number) { const h = this.get(i); if (h >= n && n > 0) { this.add(i, -n); return true; } return n <= 0; }
  clone() { const h = new Holdings(); h.list = this.list.map((x) => ({ ...x })); return h; }
}

/* ------------------------------------------------------------------ data model ------------------------------------------------------------------ */

export interface Ingredient extends ItemRef {
  qty: number | null;
  bound: boolean | null;
  /** lost when the craft fails (null = not documented) */
  consumedOnFail: boolean | null;
  /** "transfer": the item that is carried over into the new one (03), kept apart from normal materials */
  kind: "material" | "transfer";
  optional?: boolean;
  /** other items the source names for the same transfer slot (not confirmed while `unverified`) */
  alternatives?: (ItemRef & { unverified?: boolean })[];
}

/** One named recipe per faction (not per gear type). Chances on the recipe itself are the ones at the required mastery. */
export interface Recipe extends RecipeChances {
  recipeKey: string;
  recipeId?: string;
  name: string;
  faction: string;
  profession?: string;
  recipeType?: string;
  requiredMastery: number | null;
  /** mastery level the chances on the recipe were read at (the required mastery) */
  documentedMastery: number | null;
  /** chances at the best documented mastery (level not stated in the data) */
  best?: RecipeChances;
  slot?: string;
  level: number | null;
  comboLevel?: number | null;
  output: ItemRef & { qty: number };
  /** result of a successful combo; `unverified` when its name is not in the data */
  comboOutput?: ItemRef & { unverified?: boolean };
  /** after a failed combo the normal result is kept (null = not documented) */
  comboFailKeepsNormal: boolean | null;
  transfer: boolean | null;
  consumesOnFail: boolean | null;
  patch?: string;
  source?: string;
  notes?: string;
  /** whether the direct ingredient list is known to be complete: "complete" (checked on the recipe page), "unconfirmed" (some known, not checked), "none" */
  ingredientsStatus?: "complete" | "unconfirmed" | "none";
  /** data from the Global game client that nobody has seen live on EU yet */
  liveUnconfirmed?: boolean;
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

/** A market price the player saved by hand. Never created automatically. */
export interface Price extends ItemRef {
  id?: string;
  catalogKey?: string;
  quality?: string;
  region?: string;
  server?: string;
  low: number | null;
  high: number | null;
  ref: number | null;
  /** legacy field; amounts on hand live in the inventory */
  owned?: number | null;
  tradeable: boolean | null;
  note?: string;
  updated?: string;
  /** a reference price from a price list (not entered by the player): "observed" = lowest listing + markup, "rough" = rough tier estimate */
  suggested?: "observed" | "rough";
  /** where the reference price comes from */
  sourceUrl?: string;
}

/** Something a price can be entered for: built from recipes, ingredients, transfers and the start catalogue. */
export interface CatalogEntry extends ItemRef {
  key: string;
  category: CatalogCategory;
  slot?: string;
  profession?: string;
  recipeKeys: string[];
  bound: boolean | null;
  custom?: boolean;
  /** group on the price page chosen by the player for an own entry */
  group?: string;
}
export type CatalogCategory = "raw" | "processed" | "intermediate" | "weapon" | "guard" | "gloves" | "ring" | "jewelry" | "armor" | "transfer" | "other";

/** Fixed project order (not a smart gear ranking). */
export type CraftSlot = "weapon" | "ring" | "guard" | "gloves" | "jewelry" | "armor";
export const SLOT_PRIORITY: CraftSlot[] = ["weapon", "ring", "guard", "gloves", "jewelry", "armor"];

const WEAPON_SLOTS = new Set(["sword", "greatsword", "dagger", "mace", "orb", "spellbook", "bow", "staff", "polearm", "cannon", "harp", "longsword"]);
/** Project slot of a recipe's gear slot (null when the data does not say). */
export function craftSlotOf(gearSlot?: string): CraftSlot | null {
  const s = (gearSlot ?? "").toLowerCase();
  if (WEAPON_SLOTS.has(s)) return "weapon";
  if (s === "ring") return "ring";
  if (s === "guard" || s === "shield") return "guard";
  if (s === "gloves") return "gloves";
  if (["necklace", "earring", "earrings", "bracelet", "belt", "amulet"].includes(s)) return "jewelry";
  if (["chest", "torso", "pants", "legs", "helmet", "helm", "shoulders", "boots", "cape", "cloak"].includes(s)) return "armor";
  return null;
}

export interface Project {
  id: string;
  charKey: string;
  character: string;
  faction: string;
  server: string;
  className?: string;
  slot: CraftSlot;
  /** gear slot of the recipe data the project is for (weapon type, "ring", "helm" …) */
  gearSlot?: string;
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
  /** items the player buys instead of crafting (itemKey); craftable materials default to buy */
  buy?: string[];
  /** craftable materials the player crafts himself (itemKey) */
  craft?: string[];
  /** prices used only in this project, or only in one step (stepKey = recipeKey) */
  priceOverrides?: (Price & { stepKey?: string })[];
  /** guided setup still open at this step (new projects start at "stock"); undefined = set up */
  setup?: "stock" | "prices" | "route";
  /** planning confidence per stage (0.75 = 75 %); default PLAN_CONFIDENCE */
  confidence?: number;
  /** the route is to buy the final item instead of crafting it */
  buyFinal?: boolean;
  /**
   * Sterndrachenkönig stage (Lv 62/70): true = safe craft (always 62, then the safe upgrade to 70),
   * false = risky craft (can fail; combo gives 70 directly). undefined = not asked yet.
   */
  starSafe?: boolean;
  /** chance that a triggered combo also succeeds (0..1), entered by the player; null / undefined = unknown */
  comboSuccess?: number | null;
}

/** Default planning confidence per stage: with this many attempts the needed hits come in 3 of 4 cases. */
export const PLAN_CONFIDENCE = 0.75;

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
  /** cost of this attempt at the prices of that moment (null = prices missing); never changed later */
  costLow: number | null;
  costHigh: number | null;
}
export interface UndoEvent { id: string; kind: "undo"; at: string; target: string; reason?: string }
export type CraftEvent = AttemptEvent | UndoEvent;

export interface ChainRow { faction: string; slot: string; position: number; recipeKey: string; normalLevel: number | null; comboLevel: number | null; guaranteed: boolean | null; extraLv44Base: boolean | null }

export interface CraftData {
  recipes: Recipe[];
  overrides: ChanceOverride[];
  prices: Price[];
  chains: ChainRow[];
  /** start entries of the price catalogue (13) and items the player added */
  catalogExtra: CatalogEntry[];
  /** rows of the gap lists (07, 08, 05 …), shown as they are */
  gaps: { file: string; rows: Record<string, string>[] }[];
  /** imported file names with time, for versioning */
  imports: { file: string; at: string; rows: number; errors: number }[];
  /** old recipe key → new key (04) */
  keyMap: Record<string, string>;
}

export interface CraftState extends CraftData {
  version: 2;
  /** version of the data package built into the app that was last merged in */
  dataVersion?: string;
  /** player's materials: itemKey → amount */
  inventory: Record<string, number>;
  projects: Project[];
  events: CraftEvent[];
}

export const emptyState = (): CraftState => ({
  version: 2, recipes: [], overrides: [], prices: [], chains: [], catalogExtra: [], gaps: [], imports: [], keyMap: {},
  inventory: {}, projects: [], events: [],
});

/* ------------------------------------------------------------------ import ------------------------------------------------------------------ */

export interface ImportError { row: number; message: string }
export type FileKind = "recipes" | "chances" | "materials" | "transfers" | "keymap" | "chain" | "catalog" | "prices" | "gaps" | "coverage" | "sources" | "suggestions" | "unknown";

/** Which input a file is, from its columns (file names change between packages). */
export function detectKind(header: string[]): FileKind {
  const h = new Set(header);
  if (h.has("v3_recipe_key") && h.has("new_recipe_key")) return "keymap";
  if (h.has("ingredient_coverage") || h.has("full_ingredient_set_confirmed")) return "coverage";
  if (h.has("url_status")) return "sources";
  if (h.has("price_min_manual") && h.has("import_advice")) return "suggestions";
  if (h.has("item_or_material_id")) return "catalog";
  if (h.has("sequence_position")) return "chain";
  if (h.has("catalog_key")) return "catalog";
  if (h.has("required_item_name")) return "transfers";
  if (h.has("recipe_key") && (h.has("material_name") || h.has("material_item_id"))) return "materials";
  if (h.has("recipe_key") && (h.has("character") || h.has("charakter") || h.has("char_name"))) return "chances";
  if (h.has("n80_normal_at_required") || h.has("todo") || h.has("old_recipe_key")) return "gaps";
  if (h.has("recipe_key") && (h.has("recipe_name") || h.has("output_name"))) return "recipes";
  if (!h.has("recipe_key") && (h.has("price_low") || h.has("price_low_kinah") || h.has("preis_niedrig"))) return "prices";
  return "unknown";
}

const FACTIONS = new Set(["elyos", "asmodian", "asmodier", "beide", "both", "all"]);

const num = (r: Record<string, string>, errs: string[], ...names: string[]) => { const x = readNumber(col(r, ...names)); if (x.error) errs.push(x.error); return x.value; };
const bool = (r: Record<string, string>, errs: string[], ...names: string[]) => { const x = readBool(col(r, ...names)); if (x.error) errs.push(x.error); return x.value; };
const prob = (r: Record<string, string>, errs: string[], ...names: string[]) => { const x = readProb(col(r, ...names)); if (x.error) errs.push(x.error); return x.value; };
const str = (r: Record<string, string>, ...names: string[]) => col(r, ...names) || undefined;

/** Recipes (01 / 10). Duplicate recipe_key inside one file → error on the later row; a new file replaces older rows. */
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
    const outName = str(r, "output_name", "output_item_name", "recipe_name", "item_name", "target_item", "name");
    if (!outName) errs.push("Ausgabe-Item fehlt");
    const comboName = str(r, "combo_output_name", "combo_item_name");
    const type = str(r, "recipe_type")?.toLowerCase();
    const guaranteed = bool(r, errs, "guaranteed_success");
    const pBase = prob(r, errs, "success_p_at_required_mastery", "p_base_success");
    const pAct = prob(r, errs, "combo_activation_p", "p_combo_activation_given_base_success", "p_combo_activation");
    const bestBase = prob(r, errs, "success_p_best_documented");
    const bestFinal = prob(r, errs, "combo_result_p_per_attempt_best", "combo_result_p_at_best");
    const hasCombo = !!type?.includes("combo") || pAct !== null || !!comboName;
    const prev = out.get(key);
    const recipe: Recipe = {
      recipeKey: key,
      recipeId: str(r, "recipe_id"),
      name: str(r, "recipe_name", "name") ?? key,
      faction,
      profession: str(r, "profession", "beruf"),
      recipeType: type,
      requiredMastery: num(r, errs, "required_mastery", "required_craft_level"),
      documentedMastery: null,
      slot: str(r, "gear_slot", "gear_type", "slot"),
      level: num(r, errs, "target_item_level", "item_level", "level") ?? prev?.level ?? null,
      output: { name: outName ?? "", itemId: str(r, "output_item_id"), faction: faction || undefined, qty: num(r, errs, "output_qty") ?? 1 },
      comboOutput: comboName ? { name: comboName, itemId: str(r, "combo_output_item_id", "combo_item_id"), faction: faction || undefined } : prev?.comboOutput,
      comboLevel: prev?.comboLevel ?? null,
      // a combo is a bonus on a successful craft: when it does not come, the normal result stays
      comboFailKeepsNormal: hasCombo ? true : null,
      guaranteed,
      transfer: type ? type.includes("transfer") : bool(r, errs, "transfer_gear", "transfers_gear"),
      consumesOnFail: bool(r, errs, "consumes_on_fail", "materials_lost_on_fail"),
      patch: str(r, "patch", "source_client_version"),
      source: str(r, "source_url", "source", "quelle"),
      notes: str(r, "notes"),
      pBase: guaranteed === true && pBase === null ? 1 : pBase,
      pComboActivation: pAct,
      pComboSuccess: prob(r, errs, "p_combo_success_given_activation", "p_combo_success"),
      pFinal: prob(r, errs, "p_final_item_per_attempt", "p_final"),
      best: bestBase !== null || bestFinal !== null ? { pBase: guaranteed === true && bestBase === null ? 1 : bestBase, pComboActivation: pAct, pComboSuccess: null, pFinal: bestFinal, guaranteed } : undefined,
      ingredients: prev?.ingredients ?? [],
      ingredientsStatus: prev?.ingredientsStatus,
      liveUnconfirmed: prev?.liveUnconfirmed,
    };
    recipe.documentedMastery = recipe.requiredMastery;
    if (hasCombo && !recipe.comboOutput) recipe.comboOutput = { name: `${recipe.name} (Combo)`, faction: faction || undefined, unverified: true };
    if (errs.length) { errors.push({ row, message: errs.join("; ") }); return; }
    out.set(key, recipe);
  });
  return { recipes: [...out.values()], errors, rows: rows.length };
}

/** Direct materials (02 / 11) or transfer items (03); replaces that kind of input of each recipe named in the file. */
export function importIngredients(text: string, recipes: Recipe[], kind: Ingredient["kind"], keyMap: Record<string, string> = {}) {
  const { rows } = parseCsv(text);
  const errors: ImportError[] = [];
  const byKey = new Map(recipes.map((r) => [r.recipeKey, r] as const));
  const fresh = new Map<string, Ingredient[]>();
  rows.forEach((r, i) => {
    const row = i + 2, errs: string[] = [];
    const raw = str(r, "recipe_key");
    const key = raw && (keyMap[raw] ?? raw);
    const rec = key ? byKey.get(key) : undefined;
    if (!rec) { errors.push({ row, message: raw ? `Rezept "${raw}" unbekannt (erst Rezepte importieren)` : "recipe_key fehlt" }); return; }
    const name = str(r, "material_name", "required_item_name", "item_name", "name");
    if (!name) { errors.push({ row, message: "Name fehlt" }); return; }
    const ing: Ingredient = {
      name, itemId: str(r, "material_item_id", "required_item_id", "item_id"),
      qty: num(r, errs, "qty_per_attempt", "qty", "quantity", "menge"),
      bound: /\(bound\)/i.test(name) ? true : bool(r, errs, "bound", "gebunden"),
      consumedOnFail: bool(r, errs, "consumed_on_fail", "lost_on_fail"),
      kind,
    };
    if (bool(r, errs, "is_optional") === true) ing.optional = true;
    const altName = str(r, "alternate_item_name");
    if (altName) ing.alternatives = [{ name: altName, itemId: str(r, "alternate_item_id"), unverified: (str(r, "alternate_transfer_options_verified") ?? "").toLowerCase() !== "yes" }];
    if (errs.length) { errors.push({ row, message: errs.join("; ") }); return; }
    const list = fresh.get(rec.recipeKey) ?? [];
    if (list.some((x) => sameItem(x, ing))) { errors.push({ row, message: `doppelte Zutat "${name}" in ${rec.recipeKey}` }); return; }
    list.push(ing);
    fresh.set(rec.recipeKey, list);
  });
  const merged = recipes.map((r) => (fresh.has(r.recipeKey) ? { ...r, ingredients: [...r.ingredients.filter((x) => x.kind !== kind), ...fresh.get(r.recipeKey)!] } : r));
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
    const o: ChanceOverride = {
      recipeKey, character, mastery: num(r, errs, "mastery", "craft_level", "handwerksstufe"),
      pBase: prob(r, errs, "p_base_success", "success_p"), pComboActivation: prob(r, errs, "p_combo_activation_given_base_success", "combo_activation_p"),
      pComboSuccess: prob(r, errs, "p_combo_success_given_activation"), pFinal: prob(r, errs, "p_final_item_per_attempt", "combo_result_p"),
      date: str(r, "date", "datum"), source: str(r, "source", "quelle"),
    };
    if (errs.length) { errors.push({ row, message: errs.join("; ") }); return; }
    const at = out.findIndex((x) => x.recipeKey === recipeKey && x.character.toLowerCase() === character.toLowerCase() && x.mastery === o.mastery);
    if (at >= 0) out[at] = o; else out.push(o);
  });
  return { overrides: out, errors, rows: rows.length };
}

/** Old placeholder keys → real recipe keys (04): projects, history and chances follow; no recipe is duplicated. */
export function importKeyMap(text: string, state: CraftState) {
  const { rows } = parseCsv(text);
  const errors: ImportError[] = [];
  const map: Record<string, string> = { ...state.keyMap };
  rows.forEach((r, i) => {
    const from = str(r, "v3_recipe_key"), to = str(r, "new_recipe_key");
    if (!from || !to) errors.push({ row: i + 2, message: "alter oder neuer Schlüssel fehlt" }); else map[from] = to;
  });
  const m = (k: string) => map[k] ?? k;
  // an old placeholder row merges into the real recipe: it only fills fields the real row leaves empty
  const fill = (real: Recipe, old: Recipe): Recipe => {
    const out: Record<string, unknown> = { ...real };
    for (const [k, v] of Object.entries(old)) if ((out[k] === null || out[k] === undefined) && v !== null && v !== undefined) out[k] = v;
    if (!real.ingredients.length && old.ingredients.length) out.ingredients = old.ingredients;
    return out as unknown as Recipe;
  };
  const olds = new Map(state.recipes.filter((r) => r.recipeKey in map).map((r) => [map[r.recipeKey], r] as const));
  const recipes = state.recipes.filter((r) => !(r.recipeKey in map) || !state.recipes.some((x) => x.recipeKey === map[r.recipeKey]))
    .map((r) => (r.recipeKey in map ? { ...r, recipeKey: map[r.recipeKey] } : olds.has(r.recipeKey) ? fill(r, olds.get(r.recipeKey)!) : r));
  return {
    state: {
      ...state, keyMap: map, recipes,
      projects: state.projects.map((p) => ({ ...p, targetRecipeKey: m(p.targetRecipeKey), priceOverrides: p.priceOverrides?.map((o) => (o.stepKey ? { ...o, stepKey: m(o.stepKey) } : o)) })),
      events: state.events.map((e) => (e.kind === "attempt" ? { ...e, recipeKey: m(e.recipeKey) } : e)),
      overrides: state.overrides.map((o) => ({ ...o, recipeKey: m(o.recipeKey) })),
      chains: state.chains.map((c) => ({ ...c, recipeKey: m(c.recipeKey) })),
    },
    errors, rows: rows.length,
  };
}

/**
 * Confirmed chain (09): levels per step, and the combo result of a step, taken from the data:
 * the next step's normal result when that step is a safe transfer, otherwise the gear input of the next step.
 */
export function importChain(text: string, state: CraftState) {
  const { rows } = parseCsv(text);
  const errors: ImportError[] = [];
  const chains: ChainRow[] = [];
  rows.forEach((r, i) => {
    const errs: string[] = [];
    const key = str(r, "recipe_key");
    if (!key) { errors.push({ row: i + 2, message: "recipe_key fehlt" }); return; }
    const c: ChainRow = {
      faction: str(r, "faction") ?? "", slot: str(r, "gear_slot") ?? "", position: num(r, errs, "sequence_position") ?? i,
      recipeKey: state.keyMap[key] ?? key, normalLevel: num(r, errs, "normal_item_level"), comboLevel: num(r, errs, "combo_target_level"),
      guaranteed: bool(r, errs, "guaranteed"), extraLv44Base: bool(r, errs, "requires_extra_lv44_base"),
    };
    if (errs.length) { errors.push({ row: i + 2, message: errs.join("; ") }); return; }
    if (!state.recipes.some((x) => x.recipeKey === c.recipeKey)) errors.push({ row: i + 2, message: `Rezept "${c.recipeKey}" unbekannt` });
    chains.push(c);
  });
  type Mut<T> = { -readonly [K in keyof T]: T[K] };
  const byKey = new Map(state.recipes.map((r) => [r.recipeKey, { ...r } as Mut<Recipe>] as const));
  const groups = new Map<string, ChainRow[]>();
  for (const c of chains) groups.set(`${c.faction}/${c.slot}`, [...(groups.get(`${c.faction}/${c.slot}`) ?? []), c]);
  for (const list of groups.values()) {
    list.sort((a, b) => a.position - b.position);
    list.forEach((c, i) => {
      const r = byKey.get(c.recipeKey);
      if (!r) return;
      r.level = c.normalLevel ?? r.level;
      r.comboLevel = c.comboLevel ?? r.comboLevel ?? null;
      const next = byKey.get(list[i + 1]?.recipeKey ?? "");
      // derive the combo result only for a confirmed combo level and when the recipe file does not name it
      if (c.comboLevel === null || !next || (r.comboOutput && !r.comboOutput.unverified)) return;
      if (next.transfer && next.guaranteed === true && next.pComboActivation === null) {
        // the safe transfer of the next step makes exactly the combo item of this step
        r.comboOutput = { name: next.output.name, itemId: next.output.itemId, faction: next.output.faction };
      } else {
        // otherwise: the one gear input of the next step that no recipe makes as its normal result
        const made = (g: Ingredient) => state.recipes.some((x) => sameItem(x.output, { ...g, faction: factionInName(g.name) ?? next.faction }));
        const base = normName(r.name).replace(/^(expert's|artisan's)\s+/, "");
        const cand = next.ingredients.filter((g) => !made(g) && /splendent/i.test(g.name) && normName(g.name).includes(base));
        if (cand.length === 1) r.comboOutput = { name: cand[0].name, itemId: cand[0].itemId, faction: r.faction || undefined };
      }
    });
  }
  return { state: { ...state, chains: [...state.chains.filter((x) => !chains.some((c) => c.recipeKey === x.recipeKey)), ...chains], recipes: state.recipes.map((r) => byKey.get(r.recipeKey) ?? r) }, errors, rows: rows.length };
}

/** Coverage of the direct ingredient lists (V7 07 / 08): which recipes are checked complete on their recipe page. */
export function importCoverage(text: string, state: CraftState) {
  const { rows } = parseCsv(text);
  const errors: ImportError[] = [];
  const status = new Map<string, Recipe["ingredientsStatus"]>();
  rows.forEach((r, i) => {
    const raw = str(r, "recipe_key");
    if (!raw) { errors.push({ row: i + 2, message: "recipe_key fehlt" }); return; }
    const key = state.keyMap[raw] ?? raw;
    const cov = (str(r, "ingredient_coverage") ?? "").toLowerCase();
    const confirmed = (str(r, "full_ingredient_set_confirmed") ?? "").toLowerCase();
    const s: Recipe["ingredientsStatus"] = cov.startsWith("verified_complete") || confirmed === "yes" ? "complete" : cov === "no_ingredients" ? "none" : cov || confirmed ? "unconfirmed" : undefined;
    // a recipe once checked complete stays complete
    if (s && status.get(key) !== "complete") status.set(key, s);
  });
  const recipes = state.recipes.map((r) => {
    const s = status.get(r.recipeKey);
    if (!s || r.ingredientsStatus === "complete") return r;
    return { ...r, ingredientsStatus: s === "none" && r.ingredients.length ? "unconfirmed" as const : s };
  });
  return { state: { ...state, recipes }, errors, rows: rows.length };
}

/** Recipe sources (V7 04): marks recipes that come from Global client data and were not tested live on EU. */
export function importSources(text: string, state: CraftState) {
  const { rows } = parseCsv(text);
  const live = new Map<string, boolean>();
  for (const r of rows) {
    const raw = str(r, "recipe_key");
    if (!raw) continue;
    const v = (str(r, "current_live_eu_verified") ?? "").toLowerCase();
    live.set(state.keyMap[raw] ?? raw, !(v.startsWith("yes") || v === "verified"));
  }
  return { state: { ...state, recipes: state.recipes.map((r) => (live.has(r.recipeKey) ? { ...r, liveUnconfirmed: live.get(r.recipeKey) } : r)) }, rows: rows.length };
}

/** Start entries of the price catalogue (13): selection only, its empty price columns are ignored. */
export function importCatalog(text: string, existing: CatalogEntry[] = []) {
  const { rows } = parseCsv(text);
  const out = new Map(existing.map((e) => [e.key, e] as const));
  for (const r of rows) {
    // 13: catalog_key/item_name; 06 (V7): item_or_material_id/label — only rows with a real item ID, recipe targets come from the recipes
    const id06 = str(r, "item_or_material_id");
    if (!str(r, "catalog_key") && !id06) continue;
    const key = str(r, "catalog_key") ?? `id:${id06}`, name = str(r, "item_name", "label");
    if (!key || !name) continue;
    const cat = (str(r, "catalog_category") ?? "").toLowerCase();
    const slot = str(r, "gear_slot");
    out.set(key, {
      key, name, itemId: str(r, "item_id") ?? id06, faction: str(r, "faction"), slot,
      category: cat.includes("transfer") ? "transfer" : cat.includes("zutat") ? "intermediate" : categoryOfSlot(slot),
      recipeKeys: (str(r, "source_recipe_key") ?? "").split(";").filter(Boolean), bound: /\(bound\)/i.test(name) ? true : null,
    });
  }
  return { catalog: [...out.values()], rows: rows.length };
}

/** Market prices from a file the player made himself (never part of the data package). Empty price stays null. */
export function importPrices(text: string, existing: Price[] = []) {
  const { rows } = parseCsv(text);
  const errors: ImportError[] = [];
  const out = [...existing];
  rows.forEach((r, i) => {
    const row = i + 2, errs: string[] = [];
    const name = str(r, "name", "item_name", "material_name", "display_name");
    if (!name) { errors.push({ row, message: "Name fehlt" }); return; }
    const p: Price = {
      name, itemId: str(r, "item_id"), catalogKey: str(r, "catalog_key"), quality: str(r, "quality"), region: str(r, "region", "market_region"), server: str(r, "server"),
      low: num(r, errs, "price_low_kinah", "price_low", "preis_niedrig"), high: num(r, errs, "price_high_kinah", "price_high", "preis_hoch"),
      ref: num(r, errs, "reference_price_kinah", "price_ref", "referenzpreis"), tradeable: bool(r, errs, "tradeable", "handelbar"),
      note: str(r, "note", "notiz"), updated: str(r, "updated_at", "updated", "last_update"),
    };
    const v = validatePrice(p);
    if (v) errs.push(v);
    if (errs.length) { errors.push({ row, message: errs.join("; ") }); return; }
    const at = out.findIndex((x) => sameItem(x, p) && (x.server ?? "") === (p.server ?? ""));
    if (at >= 0) out[at] = { ...p, id: out[at].id }; else out.push({ ...p, id: uid() });
  });
  return { prices: out, errors, rows: rows.length };
}

/**
 * Reference price list (Odar V2): only rows the list itself marks as importable and that carry an item ID
 * ("suggested_prefill_with_review" = observed lowest listing, "review_only" = rough tier estimate). Rows to skip, unknown
 * rows and rows without an ID (name only) are left out. A price the player entered himself is never replaced.
 */
export function importPriceSuggestions(text: string, existing: Price[] = []) {
  const { rows } = parseCsv(text);
  const errors: ImportError[] = [];
  const out = [...existing];
  let used = 0;
  rows.forEach((r, i) => {
    const row = i + 2, errs: string[] = [];
    const advice = str(r, "import_advice") ?? "";
    const id = str(r, "item_or_material_id") ?? "";
    if (!/^\d+$/.test(id) || (advice !== "suggested_prefill_with_review" && advice !== "review_only")) return;
    const low = num(r, errs, "price_min_manual"), high = num(r, errs, "price_max_manual"), ref = num(r, errs, "market_price_observed_kinah");
    if (errs.length) { errors.push({ row, message: errs.join("; ") }); return; }
    if (low === null && high === null) return;
    const server = (str(r, "server") ?? "").split("/")[1]?.trim().toLowerCase() || undefined;
    const rough = (str(r, "estimate_type") ?? "") !== "odar_observed";
    const p: Price = {
      name: str(r, "label") ?? id, itemId: id, server, low, high, ref, tradeable: true,
      note: rough ? "Grobe Schätzung (Preisliste V2)" : `Referenz: niedrigstes Inserat ${str(r, "snapshot_date") ?? ""}, Spanne +15/+20 %`.trim(),
      updated: str(r, "snapshot_date"), suggested: rough ? "rough" : "observed", sourceUrl: str(r, "market_source_url"),
    };
    const v = validatePrice(p);
    if (v) { errors.push({ row, message: v }); return; }
    const at = out.findIndex((x) => sameItem(x, p) && (x.server ?? "").toLowerCase() === (server ?? ""));
    if (at >= 0 && !out[at].suggested) return; // the player's own price stays
    if (at >= 0) out[at] = { ...p, id: out[at].id }; else out.push({ ...p, id: uid() });
    used++;
  });
  return { prices: out, errors, rows: used };
}

/** Problem with a price entry, or undefined when it is fine. */
export function validatePrice(p: Pick<Price, "low" | "high" | "ref">): string | undefined {
  for (const v of [p.low, p.high, p.ref]) if (v !== null && (!Number.isFinite(v) || v < 0)) return "Preise müssen 0 oder größer sein";
  if (p.low !== null && p.high !== null && p.low > p.high) return "Mindestpreis über Höchstpreis";
  if (p.low === null && p.high === null && p.ref === null) return "kein Preis eingetragen";
  return undefined;
}

/** Imports one file into the state (never touches prices, projects or history; key corrections move references along). */
export function importFile(state: CraftState, fileName: string, text: string): { state: CraftState; kind: FileKind; errors: ImportError[]; rows: number } {
  const { header, rows: parsed } = parseCsv(text);
  const kind = detectKind(header);
  const at = new Date().toISOString();
  let next = state, errors: ImportError[] = [], rows = 0;
  if (kind === "recipes") { const r = importRecipes(text, state.recipes); next = { ...state, recipes: r.recipes }; errors = r.errors; rows = r.rows; }
  else if (kind === "materials") { const r = importIngredients(text, state.recipes, "material", state.keyMap); next = { ...state, recipes: r.recipes }; errors = r.errors; rows = r.rows; }
  else if (kind === "transfers") { const r = importIngredients(text, state.recipes, "transfer", state.keyMap); next = { ...state, recipes: r.recipes }; errors = r.errors; rows = r.rows; }
  else if (kind === "chances") { const r = importChances(text, state.overrides); next = { ...state, overrides: r.overrides }; errors = r.errors; rows = r.rows; }
  else if (kind === "keymap") { const r = importKeyMap(text, state); next = r.state; errors = r.errors; rows = r.rows; }
  else if (kind === "chain") { const r = importChain(text, state); next = r.state; errors = r.errors; rows = r.rows; }
  else if (kind === "catalog") { const r = importCatalog(text, state.catalogExtra); next = { ...state, catalogExtra: r.catalog }; rows = r.rows; }
  else if (kind === "suggestions") { const r = importPriceSuggestions(text, state.prices); next = { ...state, prices: r.prices }; errors = r.errors; rows = r.rows; }
  else if (kind === "prices") { const r = importPrices(text, state.prices); next = { ...state, prices: r.prices }; errors = r.errors; rows = r.rows; }
  else if (kind === "coverage") { const r = importCoverage(text, state); next = r.state; errors = r.errors; rows = r.rows; }
  else if (kind === "sources") { const r = importSources(text, state); next = r.state; rows = r.rows; }
  else if (kind === "gaps") { rows = parsed.length; next = { ...state, gaps: [...state.gaps.filter((g) => g.file !== fileName), { file: fileName, rows: parsed }] }; }
  else return { state, kind, errors: [{ row: 0, message: `Datei "${fileName}" nicht erkannt (Spalten: ${header.slice(0, 6).join(", ")} …)` }], rows: 0 };
  next = { ...next, imports: [...next.imports.filter((x) => x.file !== fileName), { file: fileName, at, rows, errors: errors.length }] };
  return { state: next, kind, errors, rows };
}

/* ------------------------------------------------------------------ chances per mastery ------------------------------------------------------------------ */

/**
 * Chances for a recipe, kept apart by where they come from:
 * - documented: the table value at the required mastery
 * - best: the table value at the best documented mastery
 * - actual: read in game at the character's real mastery (override), or the required-mastery value only when the
 *   character is exactly at that level; guaranteed recipes without a mastery requirement are the same for everybody.
 * Nothing is interpolated between mastery levels.
 */
export function chancesFor(recipe: Recipe, overrides: ChanceOverride[], character: string, mastery: number | null) {
  const documented: RecipeChances = recipe;
  const own = overrides.filter((o) => o.recipeKey === recipe.recipeKey && o.character.toLowerCase() === character.toLowerCase());
  const match = own.find((o) => o.mastery === mastery) ?? (mastery === null ? own[own.length - 1] : undefined);
  let actual: RecipeChances | null = null, basis: "character" | "required" | "fixed" | "none" = "none";
  if (match) { actual = { ...match, guaranteed: recipe.guaranteed }; basis = "character"; }
  else if (recipe.guaranteed === true && recipe.requiredMastery === null) { actual = recipe.best ?? documented; basis = "fixed"; }
  else if (mastery !== null && recipe.documentedMastery !== null && mastery === recipe.documentedMastery) { actual = documented; basis = "required"; }
  return { documented, documentedMastery: recipe.documentedMastery, best: recipe.best ?? null, actual, basis, override: match };
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
    .map((i) => ({ name: i.name, itemId: i.itemId, faction: i.faction, qty: i.qty ?? 0 }));
  const normal = { name: recipe.output.name, itemId: recipe.output.itemId, faction: recipe.output.faction, qty: recipe.output.qty };
  const produced =
    outcome === "success" || outcome === "guaranteed_success" ? [normal]
      : outcome === "combo_success" && recipe.comboOutput ? [{ name: recipe.comboOutput.name, itemId: recipe.comboOutput.itemId, faction: recipe.comboOutput.faction, qty: 1 }]
        : outcome === "combo_fail" && recipe.comboFailKeepsNormal === true ? [normal]
          : [];
  return { consumed, produced };
}

/* ------------------------------------------------------------------ prices & costs ------------------------------------------------------------------ */

export type Scenario = "low" | "high" | "ref";

/** Where prices come from: step override, project override, then the saved price for the project's server. */
export interface PriceCtx { prices: Price[]; server?: string; project?: Project; stepKey?: string }
export const ctxOf = (state: Pick<CraftState, "prices">, project?: Project, stepKey?: string): PriceCtx => ({ prices: state.prices, server: project?.server, project, stepKey });

const serverOk = (p: Price, server?: string) => !p.server || !server || p.server.toLowerCase() === server.toLowerCase();
export function findPrice(ctx: PriceCtx, item: ItemRef): (Price & { scope: "step" | "project" | "global" }) | undefined {
  const o = ctx.project?.priceOverrides ?? [];
  const step = ctx.stepKey ? o.find((x) => x.stepKey === ctx.stepKey && sameItem(x, item)) : undefined;
  if (step) return { ...step, scope: "step" };
  const proj = o.find((x) => !x.stepKey && sameItem(x, item));
  if (proj) return { ...proj, scope: "project" };
  const g = ctx.prices.find((x) => serverOk(x, ctx.server) && sameItem(x, item));
  return g ? { ...g, scope: "global" } : undefined;
}
/** Price for a scenario; null when nothing is saved. Bound items have no market price. */
export const priceOf = (ctx: PriceCtx | Price[], item: ItemRef & { bound?: boolean | null }, s: Scenario): number | null => {
  const c = Array.isArray(ctx) ? { prices: ctx } : ctx;
  const p = findPrice(c, item);
  if (!p) return null;
  return p[s] ?? (s === "ref" ? null : p.ref);
};

export interface Missing { what: string; item?: string }

/** Cost of one attempt from its direct ingredients; ingredients the project crafts itself are covered by their own step. */
export function attemptCost(recipe: Recipe, ctx: PriceCtx | Price[], s: Scenario, free: (i: Ingredient) => boolean = () => false) {
  const missing: Missing[] = [];
  if (!recipe.ingredients.length) missing.push({ what: "Zutaten des Rezepts fehlen" });
  const unconfirmed = recipe.ingredients.length > 0 && recipe.ingredientsStatus !== undefined && recipe.ingredientsStatus !== "complete";
  let sum = 0;
  for (const i of recipe.ingredients) {
    if (i.qty === null) { missing.push({ what: "Menge fehlt", item: i.name }); continue; }
    if (free(i)) continue;
    const p = priceOf(ctx, i, s);
    if (p === null) missing.push({ what: "Preis fehlt", item: i.name });
    else sum += p * i.qty;
  }
  return { cost: missing.length ? null : sum, partial: sum, missing, unconfirmed };
}

/** Cost of one failed attempt (what is lost). Unknown loss rule blocks the number. */
export function failCost(recipe: Recipe, ctx: PriceCtx | Price[], s: Scenario, free: (i: Ingredient) => boolean = () => false) {
  const missing: Missing[] = [];
  let sum = 0;
  for (const i of recipe.ingredients) {
    if (free(i)) continue;
    const lost = i.consumedOnFail ?? recipe.consumesOnFail;
    if (lost === null) { missing.push({ what: "Verbrauch bei Fehlschlag unbekannt", item: i.name }); continue; }
    if (!lost) continue;
    const p = priceOf(ctx, i, s);
    if (p === null || i.qty === null) missing.push({ what: p === null ? "Preis fehlt" : "Menge fehlt", item: i.name });
    else sum += p * i.qty;
  }
  return { cost: missing.length ? null : sum, missing };
}

/**
 * 80 % budget for repeating one recipe until the goal comes out: n80 attempts, all but the last one are failures.
 * Blocked (null + reasons) when the chance, a price, a quantity or the loss rule is unknown.
 */
export function stepBudget(recipe: Recipe, p: Prob, ctx: PriceCtx | Price[], s: Scenario, free: (i: Ingredient) => boolean = () => false) {
  const n80 = attemptsFor(p);
  const ok = attemptCost(recipe, ctx, s, free);
  const fail = p === 1 ? { cost: 0, missing: [] } : failCost(recipe, ctx, s, free);
  const missing = [...(n80 === null ? [{ what: "Chance unbekannt" }] : []), ...ok.missing, ...fail.missing];
  if (missing.length || n80 === null || !Number.isFinite(n80) || ok.cost === null || fail.cost === null) return { n80, budget: null, expected: null, missing };
  const e = 1 / (p as number);
  return { n80, budget: ok.cost + (n80 - 1) * fail.cost, expected: ok.cost + (e - 1) * fail.cost, missing };
}

/** Buy vs craft only for items that are really tradeable and have a price, and only with a complete craft budget. */
export function buyOrCraft(item: ItemRef, ctx: PriceCtx | Price[], craftBudget: number | null, s: Scenario): "buy" | "craft" | null {
  const c = Array.isArray(ctx) ? { prices: ctx } : ctx;
  const p = findPrice(c, item);
  if (!p || p.tradeable !== true || craftBudget === null) return null;
  const v = p[s];
  if (v === null) return null;
  return v <= craftBudget ? "buy" : "craft";
}

/* ------------------------------------------------------------------ projects & next steps ------------------------------------------------------------------ */

export const projectTarget = (p: Project, recipes: Recipe[]): ItemRef | undefined => {
  const r = recipes.find((x) => x.recipeKey === p.targetRecipeKey);
  return r ? (p.goal === "combo" && r.comboOutput ? r.comboOutput : r.output) : undefined;
};

/** Items a project holds: owned intermediates plus what its attempts produced, minus what they used up. */
export function holdings(p: Project, events: CraftEvent[]): Holdings {
  const h = new Holdings();
  for (const o of p.owned) h.add(o, 1);
  for (const e of activeAttempts(events)) if (e.projectId === p.id) {
    for (const c of e.consumed) if (h.get(c) > 0) h.add(c, -Math.min(c.qty, h.get(c)));
    for (const x of e.produced) h.add(x, x.qty);
  }
  return h;
}

const factionOk = (r: Recipe, faction?: string) => !faction || !r.faction || BOTH.has(r.faction.toLowerCase()) || r.faction.toLowerCase().slice(0, 4) === faction.toLowerCase().slice(0, 4);

/** Recipe that makes an item (normal output first, then a confirmed combo output). */
export function producerOf(item: ItemRef, recipes: Recipe[], faction?: string) {
  const it = { ...item, faction: item.faction ?? factionInName(item.name) ?? faction };
  return recipes.find((r) => factionOk(r, faction) && sameItem(r.output, it)) ?? recipes.find((r) => factionOk(r, faction) && r.comboOutput && !r.comboOutput.unverified && sameItem(r.comboOutput, it));
}

/** Crafting materials (processing recipes) are bought by default; the player can switch each one. */
const isMaterialRecipe = (r: Recipe) => r.recipeType === "processing" || /material/i.test(r.slot ?? "");
/** The recipe the project uses to make this item itself (undefined: bought / gathered). */
export function craftsItself(p: Project, item: ItemRef, recipes: Recipe[]): Recipe | undefined {
  const r = producerOf(item, recipes, p.faction);
  if (!r) return undefined;
  const k = itemKey(item);
  if (p.buy?.includes(k)) return undefined;
  if (p.craft?.includes(k)) return r;
  return isMaterialRecipe(r) ? undefined : r;
}
/** Item can be crafted from the data (whatever the player chose). */
export const canCraft = (p: Project, item: ItemRef, recipes: Recipe[]) => !!producerOf(item, recipes, p.faction);

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
  bestPlan: ReturnType<typeof planFor>;
  outcomes: Outcome[];
}

/** Combo goal only when the target recipe has a combo result in the data. */
const rootGoal = (p: Project, root: Recipe): ChanceGoal => (p.goal === "combo" && root.comboOutput ? "combo" : "normal");
const goalFor = (recipe: Recipe, item: ItemRef): ChanceGoal => (recipe.comboOutput && sameItem(recipe.comboOutput, item) && !sameItem(recipe.output, item) ? "combo" : "normal");

/**
 * The next real open action of a project: walks the dependency graph from the target down and returns the
 * first craft whose crafted inputs are all there. Owned intermediates skip only their own craft; base items a
 * later recipe needs on top are still asked for.
 */
export function nextStep(p: Project, state: CraftState, inventory: Map<string, number> = new Map(Object.entries(state.inventory))): NextStep | null {
  const target = projectTarget(p, state.recipes);
  const root = state.recipes.find((r) => r.recipeKey === p.targetRecipeKey);
  if (!target || !root) return null;
  const held = holdings(p, state.events);
  const visiting = new Set<string>();
  const walk = (item: ItemRef, qty: number, forced?: { recipe: Recipe; goal: ChanceGoal }): NextStep | null | "ok" => {
    if (held.take(item, qty)) return "ok";
    const recipe = forced?.recipe ?? craftsItself(p, item, state.recipes);
    if (!recipe) return "ok"; // bought or gathered: listed with the craft that needs it
    if (visiting.has(recipe.recipeKey)) return null;
    visiting.add(recipe.recipeKey);
    const goal: ChanceGoal = forced?.goal ?? goalFor(recipe, item);
    for (const ing of recipe.ingredients) {
      if (!craftsItself(p, ing, state.recipes)) continue;
      const r = walk(ing, ing.qty ?? 1);
      if (r !== "ok") { visiting.delete(recipe.recipeKey); return r; }
    }
    visiting.delete(recipe.recipeKey);
    return stepFor(p, state, recipe, goal, inventory);
  };
  const r = walk(target, 1, { recipe: root, goal: rootGoal(p, root) });
  return r === "ok" ? null : r;
}

/** The step card data for one recipe of a project (ingredients with what is there, chances, outcomes). */
export function stepFor(p: Project, state: CraftState, recipe: Recipe, goal: ChanceGoal, inventory: Map<string, number> = new Map(Object.entries(state.inventory))): NextStep {
  const chance = chancesFor(recipe, state.overrides, p.character, p.mastery);
  const heldNow = holdings(p, state.events);
  return {
    project: p, recipe, goal,
    ingredients: recipe.ingredients.map((i) => {
      const crafted = !!craftsItself(p, i, state.recipes);
      return { ...i, crafted, have: crafted || i.kind === "transfer" ? heldNow.get(i) + (crafted ? 0 : inventory.get(itemKey(i)) ?? 0) : inventory.get(itemKey(i)) ?? 0 };
    }),
    chance,
    plan: planFor(chance.actual ? effectiveChance(chance.actual, goal) : null),
    documentedPlan: planFor(effectiveChance(chance.documented, goal)),
    bestPlan: planFor(chance.best ? effectiveChance(chance.best, goal) : null),
    outcomes: outcomesFor(recipe),
  };
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
      return i.kind === "transfer" ? i : { ...i, have: take };
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

/** Every craft still open on the way to the project target, ingredients first (fromScratch: as if nothing were owned). */
export function remainingPath(p: Project, state: CraftState, opts: { fromScratch?: boolean } = {}): { recipe: Recipe; goal: ChanceGoal; item: ItemRef }[] {
  const target = projectTarget(p, state.recipes);
  const root = state.recipes.find((r) => r.recipeKey === p.targetRecipeKey);
  if (!target || !root) return [];
  const held = opts.fromScratch ? new Holdings() : holdings(p, state.events);
  const out: { recipe: Recipe; goal: ChanceGoal; item: ItemRef }[] = [];
  const stack = new Set<string>();
  const need = (item: ItemRef, qty: number, forced?: { recipe: Recipe; goal: ChanceGoal }) => {
    const take = Math.min(held.get(item), qty);
    if (take > 0) held.add(item, -take);
    for (let n = take; n < qty; n++) {
      const recipe = forced?.recipe ?? craftsItself(p, item, state.recipes);
      if (!recipe || stack.has(recipe.recipeKey)) return;
      stack.add(recipe.recipeKey);
      for (const ing of recipe.ingredients) if (craftsItself(p, ing, state.recipes)) need(ing, ing.qty ?? 1);
      stack.delete(recipe.recipeKey);
      out.push({ recipe, goal: forced?.goal ?? goalFor(recipe, item), item });
    }
  };
  need(target, 1, { recipe: root, goal: rootGoal(p, root) });
  return out;
}

/**
 * Progress = confirmed milestones / all milestones of the chosen path × 100. The path is the full chain from scratch,
 * owned stages included. A milestone counts when its item is held (owned or crafted), or when a later done milestone
 * used it up. Failed attempts never count; 100 % only when the final item is confirmed.
 */
export function progress(p: Project, state: CraftState) {
  const path = remainingPath(p, state, { fromScratch: true });
  const held = holdings(p, state.events);
  const total = path.length;
  const milestones = path.map((m) => ({ recipe: m.recipe, item: m.item, goal: m.goal, done: false }));
  if (!total) return { done: 0, total: 0, percent: null as number | null, milestones };
  // hand the held items out to the milestones from the end, so one item is not counted twice
  const h = held.clone();
  for (let i = total - 1; i >= 0; i--) if (h.take(milestones[i].item, 1)) milestones[i].done = true;
  // whatever a done milestone used up was made before: mark it done too (walking back through the inputs)
  for (let i = total - 1; i >= 0; i--) {
    if (!milestones[i].done) continue;
    for (const u of milestones[i].recipe.ingredients) {
      for (let j = i - 1; j >= 0; j--) if (!milestones[j].done && sameItem(u, milestones[j].item)) { milestones[j].done = true; break; }
    }
  }
  const finalDone = milestones[total - 1].done;
  const done = milestones.filter((m) => m.done).length;
  const percent = finalDone ? 100 : Math.min(99, Math.floor((done / total) * 100));
  return { done, total, percent, milestones };
}

/**
 * Inputs for the whole-project 80 % simulation. Blocked (steps null + reasons) as soon as one chance,
 * quantity, price or loss rule on the path is unknown. `partial` is the sum of the prices that are known.
 */
export function pathSimInput(p: Project, state: CraftState, s: Scenario) {
  const path = remainingPath(p, state);
  const missing: (Missing & { step: string })[] = [];
  let partial = 0;
  const unconfirmed = new Set<string>();
  const crafted = (i: Ingredient) => !!craftsItself(p, i, state.recipes);
  const steps = path.map(({ recipe, goal }) => {
    const c = chancesFor(recipe, state.overrides, p.character, p.mastery);
    const prob = c.actual ? effectiveChance(c.actual, goal) : null;
    if (prob === null) missing.push({ step: recipe.name, what: c.actual ? "Chance unbekannt" : "Chance bei deiner Handwerksstufe unbekannt" });
    const ctx = ctxOf(state, p, recipe.recipeKey);
    const free = (i: Ingredient) => crafted(i) || (i.kind === "transfer" && !!producerOf(i, state.recipes, p.faction));
    const ok = attemptCost(recipe, ctx, s, free);
    partial += ok.partial;
    if (ok.unconfirmed) unconfirmed.add(recipe.name);
    const fail = prob === 1 ? { cost: 0, missing: [] } : failCost(recipe, ctx, s, free);
    for (const m of [...ok.missing, ...fail.missing]) missing.push({ step: recipe.name, ...m });
    // a failure that eats a crafted intermediate sends the path back; that branch is not simulated yet
    if ((prob ?? 0) < 1) for (const i of recipe.ingredients.filter(free)) {
      const lost = i.consumedOnFail ?? recipe.consumesOnFail;
      if (lost !== false) missing.push({ step: recipe.name, item: i.name, what: lost === null ? "Verbrauch bei Fehlschlag unbekannt" : "Fehlschlag verbraucht Zwischenitem (mehrstufige Prognose folgt)" });
    }
    return { p: prob ?? 0, cost: ok.cost ?? 0, failCost: fail.cost ?? 0 };
  });
  return { path, steps: missing.length ? null : steps, missing, partial, unconfirmed: [...unconfirmed] };
}

/* ------------------------------------------------------------------ price catalogue ------------------------------------------------------------------ */

function categoryOfSlot(slot?: string): CatalogCategory {
  const c = craftSlotOf(slot);
  if (c) return c === "jewelry" ? "jewelry" : c;
  if (/material/i.test(slot ?? "")) return "processed";
  return "other";
}

/**
 * Everything a price can be entered for, built from the data that is there: recipe results, confirmed combo results,
 * direct ingredients, transfer items, the start catalogue and items the player added. Grows with every import.
 */
export function buildCatalog(state: Pick<CraftState, "recipes" | "catalogExtra">): CatalogEntry[] {
  const out: CatalogEntry[] = [];
  const add = (e: CatalogEntry) => {
    const f = e.faction ?? factionInName(e.name);
    // same name and compatible IDs; an entry without faction joins a factioned one only when that is the only candidate
    const cands = out.filter((x) => normName(x.name) === normName(e.name) && (!x.itemId || !e.itemId || x.itemId === e.itemId) && (!x.faction || !f || x.faction === f));
    const exact = cands.filter((x) => (x.faction ?? "") === (f ?? ""));
    const hit = exact.length === 1 ? exact[0] : cands.length === 1 ? cands[0] : undefined;
    if (hit) {
      hit.recipeKeys = [...new Set([...hit.recipeKeys, ...e.recipeKeys])];
      hit.itemId ??= e.itemId;
      hit.faction ??= f;
      if (hit.category === "other" || hit.category === "intermediate") hit.category = e.category === "other" ? hit.category : e.category;
      hit.bound ??= e.bound;
      return;
    }
    out.push({ ...e, faction: f });
  };
  const produced = (i: ItemRef) => state.recipes.find((r) => sameItem(r.output, i));
  for (const r of state.recipes) {
    add({ key: `recipe:${r.recipeKey}`, name: r.output.name, itemId: r.output.itemId, faction: r.faction || undefined, slot: r.slot, profession: r.profession, category: categoryOfSlot(r.slot), recipeKeys: [r.recipeKey], bound: null });
    if (r.comboOutput && !r.comboOutput.unverified) add({ key: `combo:${r.recipeKey}`, name: r.comboOutput.name, itemId: r.comboOutput.itemId, faction: r.faction || undefined, slot: r.slot, profession: r.profession, category: categoryOfSlot(r.slot), recipeKeys: [r.recipeKey], bound: null });
  }
  for (const r of state.recipes) for (const i of r.ingredients) {
    const maker = produced({ ...i, faction: factionInName(i.name) ?? r.faction });
    const category: CatalogCategory = i.kind === "transfer" ? "transfer" : maker ? (isMaterialRecipe(maker) ? "processed" : "intermediate") : "raw";
    add({ key: i.itemId ? `id:${i.itemId}` : `n:${normName(i.name)}`, name: i.name, itemId: i.itemId, faction: factionInName(i.name), category, recipeKeys: [r.recipeKey], bound: i.bound });
  }
  for (const e of state.catalogExtra) add(e);
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Material cost of everything still open on the project, one attempt per stage (no failures counted).
 * Ingredients the project crafts itself are covered by their own stage. null + reasons as soon as anything is unknown.
 */
export function openCost(p: Project, state: CraftState, s: Scenario) {
  const missing: (Missing & { step: string })[] = [];
  const unconfirmed: string[] = [];
  let sum = 0;
  const free = (i: Ingredient) => !!craftsItself(p, i, state.recipes) || (i.kind === "transfer" && !!producerOf(i, state.recipes, p.faction));
  for (const { recipe } of remainingPath(p, state)) {
    const c = attemptCost(recipe, ctxOf(state, p, recipe.recipeKey), s, free);
    sum += c.partial;
    if (c.unconfirmed) unconfirmed.push(recipe.name);
    for (const m of c.missing) missing.push({ step: recipe.name, ...m });
  }
  return { cost: missing.length ? null : sum, partial: sum, missing, unconfirmed: [...new Set(unconfirmed)] };
}

/** Item level of a milestone (combo level when the step aims at the combo result). */
export const stageLevel = (m: { recipe: Recipe; goal: ChanceGoal }) => (m.goal === "combo" ? m.recipe.comboLevel ?? null : m.recipe.level);

/** Saves a price by hand: for the server (all projects there), for one project, or for one step of it. */
export function savePrice(state: CraftState, item: ItemRef & { catalogKey?: string }, v: Pick<Price, "low" | "high" | "ref" | "tradeable" | "note">,
  scope: { kind: "global"; server: string } | { kind: "project" | "step"; projectId: string; stepKey?: string }): CraftState {
  const now = new Date().toISOString();
  const rec: Price = { name: item.name, itemId: item.itemId, faction: item.faction, catalogKey: item.catalogKey, ...v, updated: now };
  if (scope.kind === "global") {
    const same = (x: Price) => sameItem(x, item) && (x.server ?? "").toLowerCase() === scope.server.toLowerCase();
    const old = state.prices.find(same);
    const next = { ...rec, id: old?.id ?? uid(), server: scope.server };
    return { ...state, prices: old ? state.prices.map((x) => (x === old ? next : x)) : [...state.prices, next] };
  }
  const stepKey = scope.kind === "step" ? scope.stepKey : undefined;
  return {
    ...state, projects: state.projects.map((p) => {
      if (p.id !== scope.projectId) return p;
      const list = p.priceOverrides ?? [];
      const same = (x: Price & { stepKey?: string }) => sameItem(x, item) && x.stepKey === stepKey;
      const old = list.find(same);
      const next = { ...rec, id: old?.id ?? uid(), server: p.server, stepKey };
      return { ...p, priceOverrides: old ? list.map((x) => (x === old ? next : x)) : [...list, next] };
    }),
  };
}

/* ------------------------------------------------------------------ gear ladders (V6 design) ------------------------------------------------------------------ */

/** Crafted gear slots a project can be made for, in priority order (gear_slot values of the recipe data). */
export const GEAR_SLOTS = ["weapon", "offhand", "ring", "earrings", "necklace", "gloves", "chest", "legs", "helm", "shoulders", "boots", "cape"] as const;
export type GearSlotChoice = (typeof GEAR_SLOTS)[number];

const WEAPON_WORDS: [string, RegExp][] = [
  ["greatsword", /greatsword/i], ["bow", /\bbow\b|longbow/i], ["spellbook", /spellbook/i], ["orb", /\borb\b/i],
  ["dagger", /dagger/i], ["mace", /\bmace\b/i], ["staff", /\bstaff\b/i], ["sword", /sword/i], ["guard", /\bguard\b|shield/i],
];
/** Weapon type of an equipped item, read from its name (null when the name does not say). */
export function weaponTypeOf(name?: string): string | null {
  if (!name) return null;
  return WEAPON_WORDS.find(([, re]) => re.test(name))?.[0] ?? null;
}

/** Project slot (priority group) of a recipe gear slot. */
export const prioritySlot = (gearSlot: string): CraftSlot => craftSlotOf(gearSlot) ?? "armor";

/** Tier words of the crafted gear lines, lowest first, as in every confirmed chain (09, V7 05). */
const TIERS = [/^(?!expert|artisan|true|star|splendent|white|dark|wise|ebony)/, /^expert's /, /^artisan's /, /^(true|star) dragon lord /, /^splendent (true|star) dragon lord /,
  /^(white|dark) dragon lord /, /^splendent (white|dark) dragon lord /, /^(wise|ebony) dragon lord /, /^splendent (wise|ebony) dragon lord /];

/** A guaranteed alternative recipe makes the same item as the normal recipe of that stage; it is an alternative, not a stage. */
const isAlternative = (r: Recipe) => r.recipeType === "guaranteed" && r.transfer !== true;

/**
 * Stages of one gear line, lowest first: the confirmed chain when there is one, otherwise the recipes of that gear slot by item level.
 * Guaranteed alternatives are left out (they make the same item as their stage).
 */
export function ladderFor(state: Pick<CraftState, "recipes" | "chains">, faction: string, gearSlot: string): Recipe[] {
  const f = (r: { faction: string }) => factionOk(r as Recipe, faction);
  const chain = state.chains.filter((c) => c.slot === gearSlot && f(c)).sort((a, b) => a.position - b.position);
  const byKey = new Map(state.recipes.map((r) => [r.recipeKey, r] as const));
  if (chain.length) {
    const out: Recipe[] = [];
    for (const c of chain) { const r = byKey.get(c.recipeKey); if (r && !isAlternative(r) && !out.includes(r)) out.push(r); }
    return out;
  }
  const list = state.recipes.filter((r) => r.slot === gearSlot && f(r) && !isAlternative(r) && !/\(guaranteed alternative\)/i.test(r.name));
  // without a chain: the tier word of the name gives the order (it is the same in every confirmed chain); only for ordering, no level is made up
  const rank = list.map((r) => TIERS.findIndex((re) => re.test(normName(r.name))));
  if (rank.some((x) => x < 0) || new Set(rank).size !== rank.length) return [];
  return list.map((r, i) => [r, rank[i]] as const).sort((a, b) => a[1] - b[1]).map(([r]) => r);
}

/** The project target of a gear line: always its highest stage. */
export const topOf = (state: Pick<CraftState, "recipes" | "chains">, faction: string, gearSlot: string) => ladderFor(state, faction, gearSlot).at(-1);

/** Level of a stage: from the recipe data or the chain. */
export function levelOf(state: Pick<CraftState, "chains">, r: Recipe): number | null {
  return r.level ?? state.chains.find((c) => c.recipeKey === r.recipeKey)?.normalLevel ?? null;
}

/** Items of a gear line the player can hold: every stage result and its confirmed combo result, lowest first. */
export function ladderItems(state: Pick<CraftState, "recipes" | "chains">, faction: string, gearSlot: string) {
  const out: { item: ItemRef; recipe: Recipe; combo: boolean; level: number | null }[] = [];
  for (const r of ladderFor(state, faction, gearSlot)) {
    out.push({ item: { ...r.output, faction: r.output.faction ?? r.faction }, recipe: r, combo: false, level: levelOf(state, r) });
    if (r.comboOutput && !r.comboOutput.unverified && !out.some((x) => sameItem(x.item, r.comboOutput!)))
      out.push({ item: { ...r.comboOutput, faction: r.comboOutput.faction ?? r.faction }, recipe: r, combo: true, level: r.comboLevel ?? null });
  }
  // a combo result that is also the normal result of a later stage is listed once, at that stage
  return out.filter((x, i) => out.findIndex((y) => sameItem(y.item, x.item)) === i);
}

/** How many of an item the project holds as starting stock (owned). */
export const ownedCount = (p: Project, item: ItemRef) => p.owned.filter((o) => sameItem(o, item)).length;
/** Sets the starting stock of one item. */
export const withOwnedCount = (p: Project, item: ItemRef, n: number): Project =>
  ({ ...p, owned: [...p.owned.filter((o) => !sameItem(o, item)), ...Array.from({ length: Math.max(0, Math.floor(n)) }, () => item)] });

/** One line of the bottom-up need list: how many of an item still have to be crafted and what that takes. */
export interface NeedLine {
  item: ItemRef;
  recipe: Recipe;
  goal: ChanceGoal;
  /** successful crafts still needed */
  count: number;
  /** chance per attempt and where it comes from */
  p: Prob;
  basis: "character" | "required" | "fixed" | "best" | "none";
  expected: number | null;
  n80: number | null;
  /** materials per attempt are known and confirmed */
  ingredientsKnown: boolean;
}

/**
 * Everything still to craft for a project, lowest stage first, grouped by item: count, chance, Ø attempts (count / p)
 * and the attempts that reach all `count` successes with 80 % (binomial). Uses the character's chance when known,
 * otherwise the documented chance (combo results: best documented level, marked as such).
 */
export function needList(p: Project, state: CraftState): NeedLine[] {
  const out: NeedLine[] = [];
  for (const m of remainingPath(p, state)) {
    const hit = out.find((x) => x.recipe.recipeKey === m.recipe.recipeKey && x.goal === m.goal);
    if (hit) { hit.count++; continue; }
    const { p: prob, basis } = chanceFor(p, state, m.recipe, m.goal);
    out.push({ item: m.item, recipe: m.recipe, goal: m.goal, count: 1, p: prob, basis, expected: null, n80: null, ingredientsKnown: ingredientsKnown(m.recipe) });
  }
  for (const l of out) {
    l.expected = l.p === null || l.p === 0 ? null : l.count / l.p;
    l.n80 = attemptsForK(l.p, l.count);
  }
  return out;
}

const ingredientsKnown = (r: Recipe) => r.ingredients.length > 0 && (r.ingredientsStatus === undefined || r.ingredientsStatus === "complete");

/** Chance per attempt used for planning: the character's chance, else the documented one, else the best documented one. */
export function chanceFor(p: Project, state: CraftState, recipe: Recipe, goal: ChanceGoal): { p: Prob; basis: NeedLine["basis"] } {
  const c = chancesFor(recipe, state.overrides, p.character, p.mastery);
  let prob: Prob = c.actual ? effectiveChance(c.actual, goal) : null;
  let basis: NeedLine["basis"] = c.actual ? (c.basis === "none" ? "required" : c.basis) : "none";
  if (prob === null) { prob = effectiveChance(c.documented, goal); basis = prob === null ? "none" : "required"; }
  if (prob === null && c.best) { prob = effectiveChance(c.best, goal); basis = prob === null ? "none" : "best"; }
  return { p: prob, basis };
}

/* ------------------------------------------------------------------ craft plan (top-down calculator) ------------------------------------------------------------------ */

/** One stage of the plan: how many of its item are needed, how many are there, and how many attempts that takes. */
export interface PlanLine {
  item: ItemRef;
  recipe: Recipe;
  goal: ChanceGoal;
  need: number;
  have: number;
  missing: number;
  p: Prob;
  basis: NeedLine["basis"];
  /** attempts planned for the missing ones (at the confidence, or the mean); null = chance unknown */
  attempts: number | null;
  ingredientsKnown: boolean;
}
/** A bought or gathered item of the plan: total needed (after own crafted stock), in stock, still missing. */
export interface PlanMaterial { item: ItemRef & { bound?: boolean | null }; total: number; have: number; missing: number; chainItem: boolean }

/**
 * Top-down calculator: to get the target, the missing hits of each stage need this many attempts (binomial, at the
 * project confidence, or the mean in mode "mean"); every attempt uses its inputs, so the stage below must deliver
 * attempts × qty items. Stock (owned / crafted items, then the inventory) is used first. Lines come lowest stage first.
 */
export function craftPlan(p: Project, state0: CraftState, mode: "conf" | "mean" = "conf") {
  const state = planState(p, state0);
  const conf = p.confidence ?? PLAN_CONFIDENCE;
  const held = holdings(p, state.events);
  const unknown: string[] = [];
  const root = state.recipes.find((r) => r.recipeKey === p.targetRecipeKey);
  const target = projectTarget(p, state.recipes);
  const gearItem = (i: ItemRef) => { const r = producerOf(i, state.recipes, p.faction); return !!r && !isMaterialRecipe(r); };
  // the crafted items of the path as a graph, then demand handed down from the target (consumers before producers)
  type Node = { item: ItemRef; recipe: Recipe; goal: ChanceGoal; inputs: Ingredient[] };
  const nodes = new Map<string, Node>();
  const order: string[] = [];
  const seen = new Set<string>();
  const visit = (item: ItemRef, forced?: { recipe: Recipe; goal: ChanceGoal }) => {
    const k = itemKey(item);
    if (seen.has(k)) return;
    seen.add(k);
    const recipe = forced?.recipe ?? craftsItself(p, item, state.recipes);
    if (!recipe) return;
    const node: Node = { item, recipe, goal: forced?.goal ?? goalFor(recipe, item), inputs: recipe.ingredients };
    nodes.set(k, node);
    for (const ing of recipe.ingredients) if (craftsItself(p, ing, state.recipes)) visit(ing);
    order.push(k); // post-order: inputs first
  };
  const mats = new Map<string, PlanMaterial>();
  const material = (item: ItemRef, n: number) => {
    const k = itemKey(item);
    const m = mats.get(k) ?? { item, total: 0, have: 0, missing: 0, chainItem: gearItem(item) };
    m.total += n;
    mats.set(k, m);
  };
  const lines: PlanLine[] = [];
  if (root && target) {
    if (p.buyFinal) material(target, Math.max(0, 1 - held.get(target)));
    else {
      visit(target, { recipe: root, goal: rootGoal(p, root) });
      const demand = new Map<string, number>([[itemKey(target), 1]]);
      for (const k of [...order].reverse()) {
        const n = nodes.get(k)!;
        const need = demand.get(k) ?? 0;
        if (need <= 0) continue;
        const have = Math.min(held.get(n.item), need);
        const missing = need - have;
        const c = chanceFor(p, state, n.recipe, n.goal);
        const raw = missing <= 0 ? 0 : mode === "mean" ? (c.p ? missing / c.p : null) : attemptsForK(c.p, missing, conf);
        const attempts = raw !== null && Number.isFinite(raw) ? raw : null;
        lines.push({ item: n.item, recipe: n.recipe, goal: n.goal, need, have, missing, p: c.p, basis: c.basis, attempts, ingredientsKnown: ingredientsKnown(n.recipe) });
        if (missing <= 0) continue;
        if (attempts === null) { unknown.push(`${n.recipe.name}: ${c.p === null ? "Chance unbekannt" : "Chance 0"}`); continue; }
        if (!n.inputs.length) { unknown.push(`${n.recipe.name}: Zutaten fehlen`); continue; }
        for (const ing of n.inputs) {
          if (ing.qty === null) { unknown.push(`${n.recipe.name}: Menge von ${ing.name} unbekannt`); continue; }
          const q = attempts * ing.qty;
          const ik = itemKey(ing);
          if (nodes.has(ik)) demand.set(ik, (demand.get(ik) ?? 0) + (mode === "mean" ? q : Math.ceil(q)));
          else if (gearItem(ing)) material(ing, Math.max(0, q - takeHeld(held, ing, q)));
          else material(ing, q);
        }
      }
      lines.reverse(); // lowest stage first
    }
  }
  const materials = [...mats.values()].map((m) => {
    const have = m.chainItem ? 0 : Math.min(m.total, state.inventory[itemKey(m.item)] ?? 0);
    return { ...m, have, missing: Math.max(0, m.total - have) };
  });
  return { lines, materials, unknown: [...new Set(unknown)], confidence: conf };
}
const takeHeld = (h: Holdings, i: ItemRef, n: number) => { const t = Math.min(h.get(i), n); if (t > 0) h.add(i, -t); return t; };

/**
 * Ingredient lists checked against in-game screenshots (Tyron, 2026-11-23, "Rezepte test.zip", Asmodian orb line):
 * every material and amount matched the data, so these count as complete.
 */
export const SCREENSHOT_CONFIRMED = ["recipe:321096001", "recipe:321095001", "recipe:321094001", "recipe:321093001", "recipe:321093011",
  "recipe:321093012", "recipe:321093013", "recipe:321093014", "recipe:321093015"];
export function applyConfirmations(state: CraftState): CraftState {
  const set = new Set(SCREENSHOT_CONFIRMED);
  return { ...state, recipes: state.recipes.map((r) => (set.has(r.recipeKey) && r.ingredients.length ? { ...r, ingredientsStatus: "complete" as const, liveUnconfirmed: false } : r)) };
}

/** The Sterndrachenkönig stage of a line: the risky craft from Lv 60 on whose 62 result is upgraded to 70 (Tyron's chain, all weapons). */
export const isStarStage = (r: Recipe) => r.recipeType === "chance_with_combo" && (r.level ?? 0) >= 60;
/** The project's line has a Sterndrachenkönig stage (risky or safe choice). */
export function hasStarStage(p: Project, state: Pick<CraftState, "recipes" | "chains">) {
  const slot = p.gearSlot ?? state.recipes.find((r) => r.recipeKey === p.targetRecipeKey)?.slot ?? "";
  return ladderFor(state, p.faction, slot).some(isStarStage);
}

/**
 * The recipes as the plan uses them (Tyron's crafting rules, 2026-11-23):
 * - up to Lv 44 every craft can fail; a triggered combo must succeed as well, else item and materials are lost.
 *   Chance of the combo item per attempt = base × combo activation × combo success.
 * - Sterndrachenkönig: safe = guaranteed 62 (no combo), then the safe upgrade to 70; risky = 62 on success, but a failed
 *   combo destroys it, so the chance to keep at least the 62 is base × (1 − activation × (1 − combo success)).
 * - from there on all crafts are safe (guaranteed); the plan counts the upgrade craft, a combo hit saves it.
 * Combo success unknown: the plan uses 100 % and says it is a minimum (comboAssumed).
 */
export function planState(p: Project, state: CraftState): CraftState {
  const cs = p.comboSuccess ?? null;
  const assumed = cs === null ? 1 : cs;
  let changed = false;
  const recipes = state.recipes.map((r) => {
    if (r.faction && p.faction && !factionOk(r, p.faction)) return r;
    let x = r;
    if (x.pComboActivation != null && x.pComboSuccess == null && x.pFinal == null) x = { ...x, pComboSuccess: assumed };
    if (isStarStage(x)) {
      if (p.starSafe === true) x = { ...x, guaranteed: true, pBase: 1, pComboActivation: null, pComboSuccess: null, pFinal: null, comboOutput: undefined };
      else if (x.pBase != null && x.pComboActivation != null) x = { ...x, pBase: x.pBase * (1 - x.pComboActivation * (1 - assumed)) };
    }
    if (x !== r) changed = true;
    return x;
  });
  return changed ? { ...state, recipes } : state;
}
/** The plan still uses 100 % for the unknown combo success (results are a minimum). */
export const comboAssumed = (p: Project) => p.comboSuccess === null || p.comboSuccess === undefined;

/** Kinah for what the plan still has to buy (missing materials × price); null while a price is missing. */
export function planCost(plan: ReturnType<typeof craftPlan>, ctx: PriceCtx, s: Scenario) {
  let cost = 0, known = 0;
  const missingPrices: ItemRef[] = [];
  for (const m of plan.materials) {
    if (m.missing <= 0) continue;
    const pr = findPrice(ctx, m.item);
    const v = pr ? pr[s] ?? pr.low ?? pr.ref : null;
    if (v === null || v === undefined) { missingPrices.push(m.item); continue; }
    cost += v * m.missing; known += v * m.missing;
  }
  return { cost: missingPrices.length || plan.unknown.length ? null : cost, known, missingPrices };
}

/** Items of the line that can be bought instead of crafted below them (crafted inputs of the path), lowest first. */
export function routeItems(p: Project, state: CraftState) {
  const out: ItemRef[] = [];
  const free = { ...p, buy: (p.buy ?? []).filter((k) => !state.recipes.some((r) => itemKey(r.output) === k || (r.comboOutput && itemKey(r.comboOutput) === k))), buyFinal: false };
  for (const { recipe } of remainingPath(free, state, { fromScratch: true }))
    for (const i of recipe.ingredients) if (craftsItself(free, i, state.recipes) && !isMaterialRecipe(craftsItself(free, i, state.recipes)!) && !out.some((x) => sameItem(x, i))) out.push(i);
  return out;
}

/** Route key of a project: "final" (buy the end item), the itemKey of the bought start item, or "all" (craft everything). */
export function routeOf(p: Project, state: CraftState): string {
  if (p.buyFinal) return "final";
  const keys = new Set(routeItems(p, state).map(itemKey));
  return (p.buy ?? []).find((k) => keys.has(k)) ?? "all";
}

/** The project with a route applied (start item bought, everything above crafted). */
export function withRoute(p: Project, state: CraftState, route: string): Project {
  const keys = new Set(routeItems(p, state).map(itemKey));
  const buy = (p.buy ?? []).filter((k) => !keys.has(k));
  return { ...p, buyFinal: route === "final", buy: route === "final" || route === "all" ? buy : [...buy, route], craft: (p.craft ?? []).filter((k) => k !== route) };
}

/** Every route with its remaining cost (at the confidence and as mean), cheapest known first marked as recommended. */
export function routeOptions(p: Project, state: CraftState, s: Scenario = "low") {
  const target = projectTarget(p, state.recipes);
  const routes: { key: string; item?: ItemRef }[] = [{ key: "all" }, ...routeItems(p, state).map((item) => ({ key: itemKey(item), item })), { key: "final", item: target }];
  const opts = routes.map((r) => {
    const v = withRoute(p, state, r.key);
    const ctx = ctxOf(state, v);
    const plan = craftPlan(v, state);
    const conf = planCost(plan, ctx, s);
    const mean = planCost(craftPlan(v, state, "mean"), ctx, s);
    // where this route starts: the lowest stage that still misses items, after the stock
    const start = plan.lines.find((l) => l.missing > 0)?.item ?? null;
    return { ...r, conf, mean, unknown: plan.unknown, start, recommended: false };
  });
  const best = opts.filter((o) => o.conf.cost !== null).sort((a, b) => a.conf.cost! - b.conf.cost!)[0];
  if (best) best.recommended = true;
  return opts;
}

/** Prices the route comparison still lacks, over every route, each item once (stages first, then materials). */
export function missingRoutePrices(opts: ReturnType<typeof routeOptions>): ItemRef[] {
  const out: ItemRef[] = [];
  for (const o of opts) for (const i of o.conf.missingPrices) if (!out.some((x) => sameItem(x, i))) out.push(i);
  return out;
}

/** The craft to do now: the lowest stage of the plan that still misses items (null when nothing is left or the path is unknown). */
export function currentCraft(p: Project, state0: CraftState) {
  const plan = craftPlan(p, state0);
  const state = planState(p, state0);
  const line = plan.lines.find((l) => l.missing > 0);
  return { plan, line, step: line ? stepFor(p, state, line.recipe, line.goal) : null };
}
