"use client";
import { useEffect, useMemo, useRef, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import type { Character } from "@/lib/types";
import { numberLocale, useLang, useT, type T } from "@/lib/i18n";
import { craftIcon } from "@/lib/crafting/craft-icons";
import { GEAR_GROUPS, GROUP_COLOR, MATERIAL_GROUPS, entriesFor, type GearGroup, type MaterialGroup, type PriceArea, type PriceGroup } from "@/lib/crafting/catalog-groups";
import { charKey } from "../store";
import { useCraft } from "../craft-store";
import { Card, CardArt, Filler, SHOW_ITEM_ICONS } from "../deck/Card";
import {
  SLOT_PRIORITY, activeAttempts, attemptCost, attemptEffects, buildCatalog, canCraft, craftSlotOf, craftsItself, ctxOf, findPrice, importFile,
  itemKey, nextStep, nextSteps, normName, openCost, pathSimInput, producerOf, progress, projectTarget, remainingPath, savePrice, sortProjects,
  spent, stageLevel, stepBudget, uid, validatePrice,
  type CatalogEntry, type CraftSlot, type CraftState, type ImportError, type ItemRef, type NextStep, type Outcome, type Project, type Scenario,
} from "@/lib/crafting/model";
import { effectiveChance, simulateBudget, type ChanceGoal } from "@/lib/crafting/prob";

const BTN = "rounded-lg border border-[#d9c58f]/20 bg-white/[0.04] px-2.5 py-1.5 text-xs text-[#efe6cc] hover:border-[#d9c58f]/45 disabled:opacity-40";
const INPUT = "min-w-0 rounded-lg border border-[#d9c58f]/20 bg-white/[0.03] px-2.5 py-1.5 text-sm text-[#f4eed7] outline-none focus:border-[#d9c58f]/50";
const LABEL = "text-[10px] uppercase tracking-[0.22em] text-zinc-500";
const MISSING = "text-[#ffa31a]";

/** What the crafting page shows; kept by the parent so it survives switching to Equipment / Arcana and back. */
export interface CraftUi { sub: "projects" | "next" | "prices"; open?: string; adding?: boolean }

const slotName = (s: CraftSlot, t: T) => ({
  weapon: t("Waffe", "Weapon"), ring: t("Ring", "Ring"), guard: t("Schützer / Nebenhand", "Guard / off-hand"),
  gloves: t("Handschuhe", "Gloves"), jewelry: t("Schmuck", "Jewellery"), armor: t("Rüstung", "Armour"),
})[s];

const outcomeName = (o: Outcome, t: T) => ({
  base_fail: t("Fehlgeschlagen", "Failed"), success: t("Erfolg", "Success"), combo_success: t("Combo erfolgreich", "Combo success"),
  combo_fail: t("Combo fehlgeschlagen", "Combo failed"), guaranteed_success: t("Garantiert erfolgreich", "Guaranteed success"),
})[o];

const statusName = (s: Project["status"], t: T) => (s === "active" ? t("aktiv", "active") : s === "paused" ? t("pausiert", "paused") : t("abgeschlossen", "done"));

const pct = (p: number | null) => (p === null ? null : `${(p * 100).toFixed(p < 0.1 ? 2 : 1).replace(/\.0+$/, "")} %`);

function useKinah() {
  const lang = useLang();
  return (n: number | null) => (n === null ? null : `${Math.round(n).toLocaleString(numberLocale(lang))} Kinah`);
}
/** "10.000 – 12.000 Kinah" or one value when both are the same. */
function useRange() {
  const kinah = useKinah();
  return (low: number | null, high: number | null) => (low === null && high === null ? null : low === high || high === null ? kinah(low) : low === null ? kinah(high) : `${kinah(low)!.replace(" Kinah", "")} – ${kinah(high)}`);
}

type Update = (fn: (s: CraftState) => CraftState) => void;

/** What the price dialog is open for. */
interface PriceTarget { item: ItemRef & { catalogKey?: string; bound?: boolean | null }; server: string; project?: Project; stepKey?: string }

/** Crafting page of one character: projects as cards, next steps, market prices. */
export function CraftingView({ char, ui, setUi }: { char: Character; ui: CraftUi; setUi: Dispatch<SetStateAction<CraftUi>> }) {
  const t = useT();
  const { state, update, exportJson, importJson } = useCraft();
  const [report, setReport] = useState<{ file: string; rows: number; errors: ImportError[]; kind: string }[]>();
  const [priceFor, setPriceFor] = useState<PriceTarget>();
  const fileRef = useRef<HTMLInputElement>(null);
  const backupRef = useRef<HTMLInputElement>(null);
  const key = charKey(char);
  const open = state.projects.find((p) => p.id === ui.open && p.charKey === key);

  const onFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    let s = state;
    const out: NonNullable<typeof report> = [];
    for (const f of Array.from(files)) {
      const r = importFile(s, f.name, await f.text());
      s = r.state;
      out.push({ file: f.name, rows: r.rows, errors: r.errors, kind: r.kind });
    }
    update(() => s);
    setReport(out);
  };
  const download = () => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([exportJson()], { type: "application/json" }));
    a.download = `buildmaster-crafting-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  const gaps = state.recipes.filter((r) => !r.ingredients.length).length;
  const complete = state.recipes.filter((r) => r.ingredientsStatus === "complete").length;
  const unconfirmed = state.recipes.filter((r) => r.ingredients.length && r.ingredientsStatus !== "complete").length;
  const subs = [["projects", t("Crafting-Projekte", "Crafting projects")], ["next", "Crafting Next Steps"]] as const;
  const onPrices = ui.sub === "prices";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div role="tablist" aria-label="Crafting" className="relative grid w-full grid-cols-2 rounded-xl border border-[#d9c58f]/25 bg-white/[0.03] p-1 text-xs sm:text-sm lg:w-auto lg:flex-1">
          {subs.map(([k, l]) => (
            <button key={k} role="tab" aria-selected={ui.sub === k} onClick={() => setUi((u) => ({ ...u, sub: k, open: k === "projects" ? u.open : undefined }))}
              className={`rounded-lg px-2 py-1.5 transition-colors sm:px-3 ${ui.sub === k ? "bg-white/[0.09] text-[#f4eed7] ring-1 ring-[#d9c58f]/40" : "text-zinc-500 hover:text-zinc-300"}`}>{l}</button>
          ))}
        </div>
        <div className="flex min-w-0 flex-wrap gap-1.5">
          <button className={`${BTN} ${onPrices ? "bg-white/[0.09] text-[#f4eed7] ring-1 ring-[#d9c58f]/40" : ""}`} aria-pressed={onPrices}
            onClick={() => setUi((u) => ({ ...u, sub: u.sub === "prices" ? "projects" : "prices", open: undefined }))}>{t("Materialien & Preise", "Materials & prices")}</button>
          <button className={BTN} onClick={() => fileRef.current?.click()}>{t("Daten importieren (CSV)", "Import data (CSV)")}</button>
          <button className={BTN} onClick={download}>{t("Export", "Export")}</button>
          <button className={BTN} onClick={() => backupRef.current?.click()}>{t("Sicherung laden", "Load backup")}</button>
          <input ref={fileRef} type="file" accept=".csv,text/csv" multiple hidden onChange={(e) => { onFiles(e.target.files); e.target.value = ""; }} />
          <input ref={backupRef} type="file" accept=".json,application/json" hidden onChange={async (e) => {
            const f = e.target.files?.[0]; e.target.value = "";
            if (!f) return;
            try { importJson(await f.text()); setReport([{ file: f.name, rows: 0, errors: [], kind: "backup" }]); }
            catch (err) { setReport([{ file: f.name, rows: 0, errors: [{ row: 0, message: String((err as Error).message) }], kind: "backup" }]); }
          }} />
        </div>
      </div>

      <p className="text-[11px] text-zinc-500">
        <span className="text-[#ffa31a]/85">Beta</span> · {state.recipes.length} {t("Rezepte (EU/Global-Clientdaten)", "recipes (EU/Global client data)")}
        {" · "}{complete} {t("mit geprüfter Zutatenliste", "with checked ingredient list")}
        {unconfirmed > 0 && <> · <span className={MISSING}>{unconfirmed} {t("Zutaten unbestätigt", "ingredients unconfirmed")}</span></>}
        {gaps > 0 && <> · <span className={MISSING}>{gaps} {t("noch ohne Zutatenliste", "still without ingredient list")}</span></>}
        {" · "}{t("Preise trägst nur du ein.", "Only you enter prices.")}
      </p>

      {report && <ImportReport report={report} onClose={() => setReport(undefined)} />}

      {ui.sub === "projects" && (open
        ? <ProjectDetail p={open} state={state} update={update} onBack={() => setUi((u) => ({ ...u, open: undefined }))} onPrice={setPriceFor} />
        : <ProjectsTab state={state} update={update} char={char} charKey={key} ui={ui} setUi={setUi} />)}
      {ui.sub === "next" && <NextStepsTab state={state} update={update} charKey={key} onPrice={setPriceFor} />}
      {ui.sub === "prices" && <PricesTab state={state} update={update} char={char} onPrice={setPriceFor} />}

      {priceFor && <PriceDialog target={priceFor} state={state} onClose={() => setPriceFor(undefined)} onSave={(fn) => { update(fn); setPriceFor(undefined); }} />}
    </div>
  );
}

function ImportReport({ report, onClose }: { report: { file: string; rows: number; errors: ImportError[]; kind: string }[]; onClose: () => void }) {
  const t = useT();
  return (
    <div className="card-face relative space-y-2 rounded-2xl px-4 py-3 text-sm">
      <div className="flex items-center justify-between"><span className={LABEL}>{t("Import", "Import")}</span><button className={BTN} onClick={onClose}>{t("Schließen", "Close")}</button></div>
      {report.map((r) => (
        <div key={r.file}>
          <div className="text-[#f4eed7]">{r.file} <span className="text-zinc-500">· {r.kind} · {r.rows} {t("Zeilen", "rows")} · </span>
            <span className={r.errors.length ? "text-[#ff3344]" : "text-[#5fbf8a]"}>{r.errors.length ? `${r.errors.length} ${t("Fehler", "errors")}` : t("ok", "ok")}</span></div>
          {r.errors.length > 0 && (
            <ul className="mt-1 max-h-40 overflow-y-auto text-xs text-zinc-400">
              {r.errors.map((e, i) => <li key={i}>{e.row ? `${t("Zeile", "Row")} ${e.row}: ` : ""}{e.message}</li>)}
            </ul>
          )}
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ projects ------------------------------------------------------------------ */

function ProjectsTab({ state, update, char, charKey: key, ui, setUi }: {
  state: CraftState; update: Update; char: Character; charKey: string; ui: CraftUi; setUi: Dispatch<SetStateAction<CraftUi>>;
}) {
  const t = useT();
  const mine = sortProjects(state.projects.filter((p) => p.charKey === key));
  const current = mine.filter((p) => p.status !== "done");
  const done = mine.filter((p) => p.status === "done");
  const grid = "grid grid-cols-1 gap-x-5 gap-y-8 sm:grid-cols-2 sm:gap-x-6 sm:gap-y-10 lg:grid-cols-3";
  return (
    <div className="space-y-5">
      <button className={BTN} onClick={() => setUi((u) => ({ ...u, adding: !u.adding }))} disabled={!state.recipes.length}>{ui.adding ? t("Abbrechen", "Cancel") : t("+ Neues Projekt", "+ New project")}</button>
      {ui.adding && <NewProject state={state} char={char} charKey={key} onDone={(p) => { if (p) update((s) => ({ ...s, projects: [...s.projects, p] })); setUi((u) => ({ ...u, adding: false, open: p?.id ?? u.open })); }} />}
      {!mine.length && !ui.adding && <p className="text-sm text-zinc-500">{t("Noch keine Projekte für diesen Charakter.", "No projects for this character yet.")}</p>}
      {current.length > 0 && <ul className={grid}>{current.map((p) => <li key={p.id}><ProjectCard p={p} state={state} onOpen={() => setUi((u) => ({ ...u, open: p.id }))} /></li>)}</ul>}
      {done.length > 0 && (
        <section className="space-y-3">
          <h2 className={LABEL}>{t("Abgeschlossen (Historie)", "Finished (history)")}</h2>
          <ul className={grid}>{done.map((p) => <li key={p.id}><ProjectCard p={p} state={state} onOpen={() => setUi((u) => ({ ...u, open: p.id }))} /></li>)}</ul>
        </section>
      )}
    </div>
  );
}

/** Progress bar under a card text, in the card's own colours. */
function Progress({ percent, done, total }: { percent: number | null; done: number; total: number }) {
  const t = useT();
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between text-[11px]">
        <span className="text-zinc-500">{total ? `${done} ${t("von", "of")} ${total} ${t("Rezeptstufen", "recipe stages")}` : t("Pfad unbekannt", "Path unknown")}</span>
        <span className="font-semibold text-[#f4eed7]">{percent === null ? "–" : `${percent} %`}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.06] ring-1 ring-white/5" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent ?? undefined}>
        <div className="h-full rounded-full bg-gradient-to-r from-[#beac80] to-[#f4eed7] transition-[width] duration-500 motion-reduce:transition-none" style={{ width: `${percent ?? 0}%` }} />
      </div>
    </div>
  );
}

function ProjectCard({ p, state, onOpen }: { p: Project; state: CraftState; onOpen: () => void }) {
  const t = useT();
  const range = useRange();
  const target = projectTarget(p, state.recipes);
  const pr = progress(p, state);
  const step = p.status === "done" ? null : nextStep(p, state);
  const cost = { low: openCost(p, state, "low"), high: openCost(p, state, "high") };
  const last = [...pr.milestones].reverse().find((m) => m.done);
  const from = last ? stageLevel(last) : null;
  const to = pr.milestones.length ? stageLevel(pr.milestones[pr.milestones.length - 1]) : null;
  const icon = SHOW_ITEM_ICONS && target ? craftIcon({ ...target, faction: target.faction ?? p.faction }) : undefined;
  return (
    <Card as="button" onClick={onOpen} label={`${target?.name ?? "?"}: ${pr.percent ?? "–"} %`} className={`flex h-full w-full flex-col gap-3 p-3 ${p.status !== "active" ? "opacity-70" : ""}`}>
      <div className="relative flex w-full items-center gap-3">
        <div className="relative w-16 shrink-0">{icon ? <CardArt src={icon} alt={target!.name} /> : <Filler className="aspect-square w-full" />}</div>
        <div className="relative min-w-0">
          <div className="truncate text-sm font-semibold text-[#f4eed7]">{target?.name ?? t("Rezept fehlt", "Recipe missing")}</div>
          <div className="truncate text-xs text-zinc-400">{slotName(p.slot, t)}{p.className ? ` · ${p.className}` : ""} · {statusName(p.status, t)}</div>
          <div className="truncate text-[11px] text-zinc-500">
            {from !== null ? `Lv ${from}` : t("Start", "Start")} → {to !== null ? `Lv ${to}` : t("Ziel", "Goal")}
          </div>
        </div>
      </div>
      <div className="relative w-full space-y-1 text-[11px]">
        <div className="truncate text-zinc-400">{t("Nächster Schritt", "Next step")}: <span className="text-[#efe6cc]/85">
          {p.status === "done" ? t("keiner (abgeschlossen)", "none (done)") : step ? (step.goal === "combo" && step.recipe.comboOutput ? step.recipe.comboOutput.name : step.recipe.output.name) : pr.percent === 100 ? t("fertig", "done") : t("unbekannt", "unknown")}
        </span></div>
        {p.status !== "done" && (
          <div className="truncate text-zinc-500">{t("Offene Materialkosten", "Open material cost")}: {cost.low.cost !== null
            ? <span className="text-[#efe6cc]/85">{range(cost.low.cost, cost.high.cost)}{cost.low.unconfirmed.length > 0 && <span className={MISSING}> · {t("vorläufig", "provisional")}</span>}</span>
            : <span className={MISSING}>{t("Daten fehlen", "Data missing")}{cost.low.partial > 0 ? ` (${t("bekannt", "known")} ${range(cost.low.partial, cost.high.partial)})` : ""}</span>}</div>
        )}
      </div>
      <div className="relative w-full"><Progress percent={pr.percent} done={pr.done} total={pr.total} /></div>
    </Card>
  );
}

function NewProject({ state, char, charKey: key, onDone }: { state: CraftState; char: Character; charKey: string; onDone: (p?: Project) => void }) {
  const t = useT();
  const faction = char.race ?? "";
  const recipes = useMemo(() => state.recipes.filter((r) => r.ingredients.length && craftSlotOf(r.slot) !== null && (!r.faction || !faction || ["beide", "both", "all"].includes(r.faction.toLowerCase()) || r.faction.toLowerCase().startsWith(faction.toLowerCase().slice(0, 4)))), [state.recipes, faction]);
  const [slot, setSlot] = useState<CraftSlot>("weapon");
  const inSlot = recipes.filter((r) => craftSlotOf(r.slot) === slot).sort((a, b) => (a.level ?? 0) - (b.level ?? 0) || a.name.localeCompare(b.name));
  const [recipeKey, setRecipeKey] = useState("");
  const recipe = inSlot.find((r) => r.recipeKey === recipeKey) ?? inSlot[inSlot.length - 1];
  const [goal, setGoal] = useState<ChanceGoal>("normal");
  const [mastery, setMastery] = useState("");
  const [profession, setProfession] = useState("");
  const [owned, setOwned] = useState<Set<string>>(new Set());
  const draft: Project | undefined = recipe && {
    id: "draft", charKey: key, character: char.name, faction, server: char.server, className: char.className, slot, mastery: null,
    targetRecipeKey: recipe.recipeKey, goal: recipe.comboOutput ? goal : "normal", status: "active", createdAt: "", owned: [],
  };
  const steps = draft ? remainingPath(draft, state) : [];
  // each intermediate once, in path order
  const offer = steps.slice(0, -1).filter((s, i, a) => a.findIndex((x) => itemKey(x.item) === itemKey(s.item)) === i);
  const m = mastery.trim() === "" ? null : Number(mastery);
  const hidden = state.recipes.filter((r) => !r.ingredients.length && craftSlotOf(r.slot) === slot).length;
  return (
    <div className="card-face relative grid gap-3 rounded-2xl px-4 py-3 text-sm sm:grid-cols-2">
      <label className="grid gap-1"><span className={LABEL}>{t("Gear-Slot", "Gear slot")}</span>
        <select className={INPUT} value={slot} onChange={(e) => { setSlot(e.target.value as CraftSlot); setRecipeKey(""); setOwned(new Set()); }}>{SLOT_PRIORITY.map((s) => <option key={s} value={s}>{slotName(s, t)}</option>)}</select></label>
      <label className="grid gap-1"><span className={LABEL}>{t("Zielgegenstand (Rezept)", "Target item (recipe)")}</span>
        <select className={INPUT} value={recipe?.recipeKey ?? ""} onChange={(e) => { setRecipeKey(e.target.value); setOwned(new Set()); }}>
          {inSlot.map((r) => <option key={r.recipeKey} value={r.recipeKey}>{r.output.name}{r.level ? ` · Lv ${r.level}` : ""}{r.comboOutput ? ` / Combo Lv ${r.comboLevel ?? "?"}` : ""}</option>)}
        </select>
        {!inSlot.length && <span className={`text-xs ${MISSING}`}>{t("Für diesen Slot gibt es noch kein Rezept mit Zutatenliste.", "No recipe with an ingredient list for this slot yet.")}</span>}
        {hidden > 0 && <span className="text-xs text-zinc-500">{hidden} {t("weitere Rezepte ohne Zutatenliste ausgeblendet (Datenlücke).", "more recipes without ingredient list hidden (data gap).")}</span>}
      </label>
      {recipe?.comboOutput && (
        <label className="grid gap-1"><span className={LABEL}>{t("Ziel", "Goal")}</span>
          <select className={INPUT} value={goal} onChange={(e) => setGoal(e.target.value as ChanceGoal)}>
            <option value="normal">{recipe.output.name}{recipe.level ? ` · Lv ${recipe.level}` : ""}</option>
            <option value="combo">{recipe.comboOutput.name} (Combo{recipe.comboLevel ? ` · Lv ${recipe.comboLevel}` : ""})</option>
          </select></label>
      )}
      <label className="grid gap-1"><span className={LABEL}>{t("Handwerksberuf", "Profession")}</span>
        <input className={INPUT} value={profession} onChange={(e) => setProfession(e.target.value)} placeholder={recipe?.profession ?? ""} /></label>
      <label className="grid gap-1"><span className={LABEL}>{t("Deine Handwerksstufe", "Your crafting level")}</span>
        <input className={INPUT} inputMode="numeric" value={mastery} onChange={(e) => setMastery(e.target.value)} placeholder={t("unbekannt", "unknown")} /></label>
      <div className="text-xs text-zinc-500 sm:col-span-2">{[char.race, char.server, char.className].filter(Boolean).join(" · ")}</div>
      {offer.length > 0 && (
        <fieldset className="grid gap-1 sm:col-span-2"><legend className={LABEL}>{t("Einstieg: schon vorhanden", "Starting point: already owned")}</legend>
          {offer.map((s) => {
            const k = itemKey(s.item);
            const lv = stageLevel(s);
            return (
              <label key={k} className="flex items-center gap-2 text-[#efe6cc]/85">
                <input type="checkbox" checked={owned.has(k)} onChange={(e) => setOwned((o) => { const n = new Set(o); if (e.target.checked) n.add(k); else n.delete(k); return n; })} />
                {s.item.name}{lv ? <span className="text-zinc-500"> · Lv {lv}</span> : ""}
              </label>
            );
          })}
          <span className="text-xs text-zinc-500">{t("Ein vorhandenes Zwischenitem überspringt nur seinen eigenen Craft. Weitere Basisitems, die spätere Rezepte brauchen (z. B. die zusätzliche Lv44-Basis), bleiben auf der Liste.",
            "An owned intermediate only skips its own craft. Other base items later recipes need (e.g. the extra Lv44 base) stay on the list.")}</span>
        </fieldset>
      )}
      <div className="flex gap-2 sm:col-span-2">
        <button className={BTN} disabled={!recipe || (m !== null && !Number.isFinite(m))} onClick={() => recipe && onDone({
          ...draft!, id: uid(), mastery: m, profession: profession || recipe.profession, createdAt: new Date().toISOString(),
          owned: offer.map((s) => s.item).filter((o) => owned.has(itemKey(o))),
        })}>{t("Projekt anlegen", "Create project")}</button>
      </div>
    </div>
  );
}

function ProjectDetail({ p, state, update, onBack, onPrice }: { p: Project; state: CraftState; update: Update; onBack: () => void; onPrice: (x: PriceTarget) => void }) {
  const t = useT();
  const kinah = useKinah();
  const range = useRange();
  const target = projectTarget(p, state.recipes);
  const pr = progress(p, state);
  const money = spent(p, state.events);
  const step = p.status === "active" ? nextStep(p, state) : null;
  const history = activeAttempts(state.events).filter((e) => e.projectId === p.id).reverse();
  const set = (patch: Partial<Project>) => update((s) => ({ ...s, projects: s.projects.map((x) => (x.id === p.id ? { ...x, ...patch } : x)) }));
  // materials still to get for the whole open path, with their price for this project
  const mats = useMemo(() => {
    const out = new Map<string, { item: ItemRef & { bound?: boolean | null }; qty: number | null; craftable: boolean; crafted: boolean; transfer: boolean }>();
    for (const { recipe } of remainingPath(p, state)) for (const i of recipe.ingredients) {
      const crafted = !!craftsItself(p, i, state.recipes);
      if (crafted && !canCraft(p, i, state.recipes)) continue;
      const k = itemKey(i);
      const hit = out.get(k);
      if (hit) hit.qty = hit.qty === null || i.qty === null ? null : hit.qty + i.qty;
      else out.set(k, { item: i, qty: i.qty, craftable: canCraft(p, i, state.recipes), crafted, transfer: i.kind === "transfer" });
    }
    return [...out.values()];
  }, [p, state]);
  const toggleBuy = (item: ItemRef, craft: boolean) => {
    const k = itemKey(item);
    set({ buy: (p.buy ?? []).filter((x) => x !== k).concat(craft ? [] : [k]), craft: (p.craft ?? []).filter((x) => x !== k).concat(craft ? [k] : []) });
  };
  const ownedHas = (i: ItemRef) => p.owned.some((o) => itemKey(o) === itemKey(i));
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="shrink-0 rounded-full border border-[#d9c58f]/20 bg-white/[0.03] px-3.5 py-1.5 text-sm text-[#efe6cc]/85 hover:border-[#d9c58f]/40">‹ {t("Projekte", "Projects")}</button>
        <h2 className="truncate text-lg font-semibold tracking-tight text-[#f4eed7] sm:text-xl">{target?.name ?? t("Rezept fehlt", "Recipe missing")}</h2>
      </div>

      <Card className="space-y-3 p-4 text-sm">
        <div className="relative flex flex-wrap items-center gap-2">
          <span className="rounded-md border border-[#d9c58f]/25 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-[#beac80]">{slotName(p.slot, t)}</span>
          <span className="text-xs text-zinc-400">{statusName(p.status, t)} · {p.server}{p.faction ? ` · ${p.faction}` : ""}</span>
          <div className="ml-auto flex flex-wrap gap-1.5">
            <input className={`${INPUT} w-16 text-xs`} inputMode="numeric" title={t("Reihenfolge im Slot", "Order within slot")} placeholder="#" value={p.order ?? ""}
              onChange={(e) => set({ order: e.target.value === "" ? undefined : Number(e.target.value) })} />
            <input className={`${INPUT} w-24 text-xs`} inputMode="numeric" title={t("Handwerksstufe", "Crafting level")} placeholder={t("Stufe ?", "Level ?")} value={p.mastery ?? ""}
              onChange={(e) => set({ mastery: e.target.value === "" ? null : Number(e.target.value) })} />
            {p.status === "active" && <button className={BTN} onClick={() => set({ status: "paused" })}>{t("Pausieren", "Pause")}</button>}
            {p.status !== "active" && <button className={BTN} onClick={() => set({ status: "active" })}>{p.status === "done" ? t("Wieder öffnen", "Reopen") : t("Fortsetzen", "Resume")}</button>}
            {p.status !== "done" && <button className={BTN} onClick={() => set({ status: "done" })}>{t("Abschließen", "Finish")}</button>}
          </div>
        </div>
        <div className="relative"><Progress percent={pr.percent} done={pr.done} total={pr.total} /></div>
        <div className="relative text-xs text-zinc-400">
          {t("Bisher ausgegeben", "Spent so far")}: {range(money.low, money.high) ?? kinah(0)}
          {money.unknown > 0 && <span className={MISSING}> · {money.unknown} {t("Versuche ohne Preis", "attempts without price")}</span>}
          <span className="text-zinc-500"> · {t("Historie bleibt bei Preisänderungen unverändert.", "History stays as it was when prices change.")}</span>
        </div>
      </Card>

      {/* milestones of the chosen path */}
      <section className="card-face relative space-y-2 rounded-2xl px-4 py-3 text-sm">
        <div className={LABEL}>{t("Rezeptstufen", "Recipe stages")}</div>
        <ol className="space-y-1 text-xs">
          {pr.milestones.map((m, i) => {
            const lv = stageLevel(m);
            const isOwned = ownedHas(m.item);
            return (
              <li key={i} className="flex items-center gap-2 rounded-lg bg-white/[0.03] px-2 py-1">
                <span className={m.done ? "text-[#5fbf8a]" : "text-zinc-600"}>{m.done ? "✓" : "○"}</span>
                <span className="text-[#efe6cc]/85">{m.item.name}</span>
                {lv !== null && <span className="text-zinc-500">Lv {lv}</span>}
                {m.goal === "combo" && <span className="text-zinc-500">Combo</span>}
                {m.recipe.ingredientsStatus !== undefined && m.recipe.ingredientsStatus !== "complete" && <span className={MISSING}>{m.recipe.ingredients.length ? t("Zutaten unbestätigt", "ingredients unconfirmed") : t("Zutaten fehlen", "ingredients missing")}</span>}
                {!m.done && p.status !== "done" && <button className="ml-auto text-zinc-500 underline hover:text-zinc-300" onClick={() => set({ owned: [...p.owned, m.item] })}>{t("als vorhanden markieren", "mark as owned")}</button>}
                {m.done && isOwned && <button className="ml-auto text-zinc-500 underline hover:text-zinc-300" onClick={() => set({ owned: p.owned.filter((o) => itemKey(o) !== itemKey(m.item)) })}>{t("Markierung entfernen", "unmark")}</button>}
              </li>
            );
          })}
          {!pr.milestones.length && <li className={MISSING}>{t("Pfad unbekannt: Rezeptdaten fehlen.", "Path unknown: recipe data missing.")}</li>}
        </ol>
      </section>

      {step && <StepCard s={step} state={state} onLog={(o) => update((st) => logAttempt(st, step, o))} onPrice={onPrice} />}

      {/* whole open material list with prices */}
      {p.status !== "done" && mats.length > 0 && (
        <section className="card-face relative space-y-2 rounded-2xl px-4 py-3 text-sm">
          <div className={LABEL}>{t("Materialien für alle offenen Stufen", "Materials for all open stages")}</div>
          <ul className="grid gap-1 text-xs lg:grid-cols-2">
            {mats.map((m) => (
              <li key={itemKey(m.item)} className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg bg-white/[0.03] px-2 py-1">
                <span className="text-[#efe6cc]/85">{m.item.name}</span>
                <span className="text-zinc-500">× {m.qty ?? "?"}</span>
                {m.transfer && <span className="text-zinc-500">· Transfer</span>}
                {m.craftable && !m.transfer && (
                  <span className="text-zinc-500">· {m.crafted ? t("selbst craften", "craft myself") : t("kaufen", "buy")}{" "}
                    <button className="underline hover:text-zinc-300" onClick={() => toggleBuy(m.item, !m.crafted)}>({m.crafted ? t("stattdessen kaufen", "buy instead") : t("selbst craften", "craft myself")})</button></span>
                )}
                <span className="ml-auto"><PriceCell item={m.item} ctxProject={p} state={state} onEdit={() => onPrice({ item: m.item, server: p.server, project: p })} hide={m.crafted || m.transfer} /></span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {p.status !== "done" && <ProjectBudget p={p} state={state} />}

      <section className="card-face relative space-y-2 rounded-2xl px-4 py-3 text-sm">
        <div className={LABEL}>{t("Craft-Ergebnisprotokoll", "Craft result log")}</div>
        {!history.length && <p className="text-xs text-zinc-500">{t("Noch keine Versuche eingetragen.", "No attempts logged yet.")}</p>}
        <ul className="space-y-1 text-xs text-zinc-400">
          {history.map((e) => (
            <li key={e.id} className="flex flex-wrap items-center gap-2">
              <span className="text-zinc-500">{new Date(e.at).toLocaleString()}</span>
              <span className="text-[#efe6cc]/85">{state.recipes.find((r) => r.recipeKey === e.recipeKey)?.name ?? e.recipeKey}</span>
              <span>{outcomeName(e.outcome, t)}</span>
              <span className="text-zinc-500">{e.costLow === null ? t("Kosten unbekannt", "cost unknown") : range(e.costLow, e.costHigh)}</span>
              <button className="ml-auto text-zinc-500 underline hover:text-zinc-300" onClick={() => update((s) => undoAttempt(s, e.id))}>{t("Rückgängig", "Undo")}</button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

/** Price of an item as used in a project (or for a server), with the edit button. */
function PriceCell({ item, ctxProject, server, stepKey, state, onEdit, hide }: {
  item: ItemRef & { bound?: boolean | null }; ctxProject?: Project; server?: string; stepKey?: string; state: CraftState; onEdit: () => void; hide?: boolean;
}) {
  const t = useT();
  const range = useRange();
  if (hide) return null;
  const ctx = ctxProject ? ctxOf(state, ctxProject, stepKey) : { prices: state.prices.filter((x) => !server || (x.server ?? "").toLowerCase() === server.toLowerCase()), server };
  const p = findPrice(ctx, item);
  const scope = p?.scope === "step" ? t("nur dieser Schritt", "this step only") : p?.scope === "project" ? t("nur dieses Projekt", "this project only") : null;
  return (
    <span className="inline-flex items-center gap-2">
      {p ? <span className="text-[#efe6cc]/90">{range(p.low, p.high) ?? range(p.ref, p.ref)}{scope && <span className="text-zinc-500"> · {scope}</span>}</span>
        : <span className={MISSING}>{t("Kein Preis hinterlegt", "No price saved")}</span>}
      {item.bound === true && <span className="text-zinc-500">· {t("gebunden", "bound")}</span>}
      <button className={BTN} onClick={onEdit}>{p ? t("Bearbeiten", "Edit") : t("Preis eingeben", "Enter price")}</button>
    </span>
  );
}

/** Whole-project 80 % budget, simulated on request (not while rendering), cached per input. */
function ProjectBudget({ p, state }: { p: Project; state: CraftState }) {
  const t = useT();
  const kinah = useKinah();
  const [s, setS] = useState<Scenario>("low");
  const input = useMemo(() => pathSimInput(p, state, s), [p, state, s]);
  const [result, setResult] = useState<{ key: string; r: ReturnType<typeof simulateBudget> }>();
  const key = JSON.stringify([input.steps, s]);
  const [busy, setBusy] = useState(false);
  const run = () => {
    if (!input.steps) return;
    setBusy(true);
    setTimeout(() => { setResult({ key, r: simulateBudget(input.steps!, { runs: 20000, seed: 80 }) }); setBusy(false); }, 0);
  };
  const r = result?.key === key ? result.r : undefined;
  if (!input.path.length) return null;
  return (
    <div className="card-face relative rounded-2xl px-4 py-3 text-xs">
      <div className="flex flex-wrap items-center gap-2">
        <span className={LABEL}>{t("Gesamtziel · 80 %-Planungswert", "Whole goal · 80 % planning value")}</span>
        <select className={`${INPUT} text-xs`} value={s} onChange={(e) => setS(e.target.value as Scenario)}>
          <option value="low">{t("Mindestpreis", "Minimum price")}</option><option value="high">{t("Höchstpreis", "Maximum price")}</option><option value="ref">{t("Referenzpreis", "Reference price")}</option>
        </select>
        <button className={BTN} disabled={!input.steps || busy} onClick={run}>{busy ? t("Rechnet …", "Running …") : t("Berechnen", "Calculate")}</button>
      </div>
      {!input.steps && (
        <div className={`mt-1 ${MISSING}`}>
          {t("Daten fehlen, deshalb keine vollständige Kostenangabe", "Data missing, so no complete cost")}{input.partial > 0 ? ` (${t("bekannte Teilsumme je 1 Versuch", "known part, 1 attempt each")}: ${kinah(input.partial)})` : ""}:
          <ul className="list-inside list-disc text-zinc-400">{[...new Set(input.missing.map((m) => `${m.step}: ${m.what}${m.item ? ` (${m.item})` : ""}`))].slice(0, 8).map((m) => <li key={m}>{m}</li>)}</ul>
        </div>
      )}
      {input.unconfirmed.length > 0 && (
        <div className={`mt-1 ${MISSING}`}>{t("Vorläufig: Zutatenliste nicht bestätigt bei", "Provisional: ingredient list not confirmed for")} {input.unconfirmed.join(", ")}</div>
      )}
      {r && (
        <div className="mt-1 space-y-0.5 text-zinc-300">
          <div>{t("80 %-Budget", "80 % budget")}: <b className="text-[#f4eed7]">{kinah(r.budget80)}</b> <span className="text-zinc-500">({t("95 %-Intervall", "95 % interval")} {kinah(r.ci95[0])} – {kinah(r.ci95[1])})</span></div>
          <div>{t("Erwarteter Rohkostenwert", "Expected raw cost")}: {kinah(r.expectedCost)} · {t("Versuche bei 80 %", "Attempts at 80 %")}: {r.attempts80}</div>
          <div className="text-zinc-500">{t("Statistische Schätzung", "Statistical estimate")} · {r.runs.toLocaleString()} {t("Durchläufe", "runs")} · Seed {r.seed}. {t("Keine garantierte Kostenobergrenze.", "Not a guaranteed cost ceiling.")}</div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ next steps ------------------------------------------------------------------ */

function undoAttempt(s: CraftState, id: string): CraftState {
  const e = activeAttempts(s.events).find((x) => x.id === id);
  if (!e) return s;
  // give back plain materials that this attempt took from the inventory
  const inv = { ...s.inventory };
  for (const c of e.consumed) if (!producerOf(c, s.recipes)) inv[itemKey(c)] = (inv[itemKey(c)] ?? 0) + c.qty;
  return { ...s, inventory: inv, events: [...s.events, { id: uid(), kind: "undo", at: new Date().toISOString(), target: id }] };
}

/** Logs one attempt with what it used and what it cost at today's prices (a snapshot that later price edits do not change). */
function logAttempt(s: CraftState, step: NextStep, outcome: Outcome): CraftState {
  const fx = attemptEffects(step.recipe, outcome);
  const p = s.projects.find((x) => x.id === step.project.id) ?? step.project;
  const free = (i: ItemRef) => !!producerOf(i, s.recipes, p.faction);
  const ctx = ctxOf(s, p, step.recipe.recipeKey);
  const cost = (sc: Scenario) => {
    const used = outcome === "base_fail" ? { ...step.recipe, ingredients: step.recipe.ingredients.filter((i) => fx.consumed.some((c) => itemKey(c) === itemKey(i))) } : step.recipe;
    return attemptCost(used, ctx, sc, free).cost;
  };
  const inv = { ...s.inventory };
  for (const c of fx.consumed) if (!free(c)) inv[itemKey(c)] = Math.max(0, (inv[itemKey(c)] ?? 0) - c.qty);
  return {
    ...s, inventory: inv,
    events: [...s.events, { id: uid(), kind: "attempt", projectId: p.id, at: new Date().toISOString(), recipeKey: step.recipe.recipeKey, outcome, ...fx, costLow: cost("low"), costHigh: cost("high") }],
  };
}

function NextStepsTab({ state, update, charKey: key, onPrice }: { state: CraftState; update: Update; charKey: string; onPrice: (x: PriceTarget) => void }) {
  const t = useT();
  const steps = nextSteps(state, key);
  if (!steps.length) return <p className="text-sm text-zinc-500">{t("Keine offenen Schritte. Lege unter „Crafting-Projekte“ ein Projekt an.", "No open steps. Create a project under “Crafting projects”.")}</p>;
  return <div className="space-y-4">{steps.map((s) => <StepCard key={s.project.id} s={s} state={state} onLog={(o) => update((st) => logAttempt(st, s, o))} onPrice={onPrice} showProject />)}</div>;
}

function StepCard({ s, state, onLog, onPrice, showProject }: { s: NextStep; state: CraftState; onLog: (o: Outcome) => void; onPrice: (x: PriceTarget) => void; showProject?: boolean }) {
  const t = useT();
  const range = useRange();
  const target = projectTarget(s.project, state.recipes);
  const want = s.goal === "combo" && s.recipe.comboOutput ? s.recipe.comboOutput.name : s.recipe.output.name;
  const free = (i: ItemRef) => !!craftsItself(s.project, i, state.recipes) || (i as { kind?: string }).kind === "transfer" && !!producerOf(i, state.recipes, s.project.faction);
  const ctx = ctxOf(state, s.project, s.recipe.recipeKey);
  const next = { low: attemptCost(s.recipe, ctx, "low", free), high: attemptCost(s.recipe, ctx, "high", free) };
  const pActual = s.chance.actual ? effectiveChance(s.chance.actual, s.goal) : null;
  const budget = { low: stepBudget(s.recipe, pActual, ctx, "low", free), high: stepBudget(s.recipe, pActual, ctx, "high", free) };
  const dataMissing = (partial?: number, partialHigh?: number): ReactNode => <span className={MISSING}>{t("Daten fehlen", "Data missing")}{partial ? ` (${t("bekannt", "known")} ${range(partial, partialHigh ?? partial)})` : ""}</span>;
  const lv = stageLevel(s);
  return (
    <Card className="space-y-3 p-4 text-sm">
      <div className="relative flex flex-wrap items-baseline gap-2">
        <span className="rounded-md border border-[#d9c58f]/25 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-[#beac80]">{slotName(s.project.slot, t)}</span>
        {showProject && <span className="font-semibold text-[#f4eed7]">{target?.name}</span>}
        <span className="text-xs text-zinc-400">{t("Nächster Schritt", "Next step")}: <span className="text-[#efe6cc]/90">{want}</span>{lv ? ` · Lv ${lv}` : ""}{s.goal === "combo" ? " · Combo" : ""}</span>
      </div>
      <ul className="relative grid gap-1 text-xs lg:grid-cols-2">
        {s.ingredients.map((i) => {
          const ok = i.qty !== null && i.have >= i.qty;
          const own = i.crafted || (i.kind === "transfer" && canCraft(s.project, i, state.recipes));
          return (
            <li key={`${i.kind}:${itemKey(i)}`} className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg bg-white/[0.03] px-2 py-1">
              <span className="text-[#efe6cc]/85">{i.name}{i.crafted ? <span className="text-zinc-500"> · {t("Zwischenitem", "intermediate")}</span> : i.kind === "transfer" ? <span className="text-zinc-500"> · Transfer</span> : ""}
                {i.alternatives?.map((a) => <span key={a.itemId ?? a.name} className="text-zinc-500"> · {t("oder", "or")} {a.name}{a.unverified ? ` (${t("unbestätigt", "unconfirmed")})` : ""}</span>)}</span>
              <span className={ok ? "text-[#5fbf8a]" : "text-[#ff3344]"}>{i.have} / {i.qty ?? "?"}</span>
              <span className="ml-auto"><PriceCell item={i} ctxProject={s.project} stepKey={s.recipe.recipeKey} state={state} hide={own}
                onEdit={() => onPrice({ item: i, server: s.project.server, project: s.project, stepKey: s.recipe.recipeKey })} /></span>
            </li>
          );
        })}
        {!s.ingredients.length && <li className={MISSING}>{t("Zutaten nicht dokumentiert (Datenlücke)", "Ingredients not documented (data gap)")}</li>}
      </ul>
      {(s.ingredients.length > 0 && s.recipe.ingredientsStatus !== undefined && s.recipe.ingredientsStatus !== "complete" || s.recipe.liveUnconfirmed) && (
        <p className="relative text-[11px] text-zinc-500">
          {s.ingredients.length > 0 && s.recipe.ingredientsStatus !== undefined && s.recipe.ingredientsStatus !== "complete" && <span className={MISSING}>{t("Zutatenliste nicht auf der Rezeptseite bestätigt, Kosten vorläufig. ", "Ingredient list not confirmed on the recipe page, cost provisional. ")}</span>}
          {s.recipe.liveUnconfirmed && t("Global-Clientdaten, nicht live bestätigt.", "Global client data, not confirmed live.")}
          {s.recipe.source && <> · <a className="underline hover:text-zinc-300" href={s.recipe.source} target="_blank" rel="noreferrer">{t("Quelle", "Source")}</a></>}
        </p>
      )}
      <div className="relative grid gap-1 text-xs text-zinc-300 sm:grid-cols-2">
        <div>{t("Chance bei deiner Stufe", "Chance at your level")} {s.project.mastery ?? "?"}: {pct(pActual) ?? <span className={MISSING}>{t("unbekannt", "unknown")}</span>}
          {s.chance.basis === "character" && s.chance.override?.source && <span className="text-zinc-500"> · {s.chance.override.source}{s.chance.override.date ? `, ${s.chance.override.date}` : ""}</span>}
          {s.chance.basis === "fixed" && <span className="text-zinc-500"> · {t("garantiert", "guaranteed")}</span>}</div>
        <div className="text-zinc-500">{t("Dokumentiert bei Stufe", "Documented at level")} {s.chance.documentedMastery ?? "?"}: {pct(s.documentedPlan.p) ?? t("unbekannt", "unknown")}
          {s.documentedPlan.n80 !== null && Number.isFinite(s.documentedPlan.n80) ? ` · ${s.documentedPlan.n80} ${t("Versuche (80 %)", "attempts (80 %)")}` : ""}
          {s.bestPlan.p !== null && <> · {t("beste dok. Stufe", "best documented level")}: {pct(s.bestPlan.p)}{s.bestPlan.n80 !== null && Number.isFinite(s.bestPlan.n80) ? ` · ${s.bestPlan.n80}` : ""}</>}</div>
        <div>{t("80 %-Planungswert", "80 % planning value")}: {s.plan.n80 === null ? <span className={MISSING}>{t("unbekannt", "unknown")}</span> : !Number.isFinite(s.plan.n80) ? t("nie (0 %)", "never (0 %)") : <b className="text-[#f4eed7]">{s.plan.n80} {t("Versuche", "attempts")}</b>}
          {s.plan.reached !== null && <span className="text-zinc-500"> ({pct(s.plan.reached)})</span>}</div>
        <div className="text-zinc-500">{t("Erwartungswert", "Expected value")}: {s.plan.expected === null ? "?" : Number.isFinite(s.plan.expected) ? s.plan.expected.toFixed(1) : "∞"}</div>
        <div>{t("Nächster Versuch", "Next attempt")}: {next.low.cost === null ? dataMissing(next.low.partial, next.high.partial) : range(next.low.cost, next.high.cost)}</div>
        <div>{t("Diese Stufe bis 80 %", "This stage up to 80 %")}: {budget.low.budget === null ? dataMissing() : range(budget.low.budget, budget.high.budget)}</div>
      </div>
      <div className="relative flex flex-wrap gap-1.5 pt-1">
        <span className={`${LABEL} self-center`}>{t("Ergebnis eintragen", "Log result")}:</span>
        {s.outcomes.map((o) => <button key={o} className={BTN} onClick={() => onLog(o)}>{outcomeName(o, t)}</button>)}
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ market prices ------------------------------------------------------------------ */

const MATERIAL_NAMES = (t: T): Record<MaterialGroup, string> => ({
  ore: t("Erz", "Ore"), gem: t("Edelsteine", "Gemstones"), wood: t("Holz", "Wood"), herb: t("Kräuter", "Herbs"), cooking: t("Kochzutaten", "Cooking"),
  odyle: "Odyle", balaur: t("Balaur-Material", "Balaur material"), refine: t("Veredelung & Hilfsmittel", "Refining & tools"), other: t("Sonstiges", "Other"),
});
const GEAR_NAMES = (t: T): Record<GearGroup, string> => ({
  weapon: t("Waffen", "Weapons"), guard: t("Schützer", "Guards"), jewelry: t("Ringe & Schmuck", "Rings & jewellery"), armor: t("Rüstung & Handschuhe", "Armour & gloves"),
});

/** Market prices of the character's server: raw materials and gear in two areas, grouped, with icons. */
function PricesTab({ state, update, char, onPrice }: { state: CraftState; update: Update; char: Character; onPrice: (x: PriceTarget) => void }) {
  const t = useT();
  const server = char.server;
  const all = useMemo(() => entriesFor(buildCatalog(state), char.race), [state, char.race]);
  const [area, setArea] = useState<PriceArea>("materials");
  const [group, setGroup] = useState<PriceGroup | "">("");
  const [q, setQ] = useState("");
  const [onlyPriced, setOnlyPriced] = useState(false);
  const names: Record<string, string> = { ...MATERIAL_NAMES(t), ...GEAR_NAMES(t) };
  const groups: readonly PriceGroup[] = area === "materials" ? MATERIAL_GROUPS : GEAR_GROUPS;
  const onServer = useMemo(() => state.prices.filter((x) => (x.server ?? "").toLowerCase() === server.toLowerCase()), [state.prices, server]);
  const priceOfEntry = (e: ItemRef) => findPrice({ prices: onServer, server }, e);
  const inArea = all.filter((e) => e.area === area);
  const s = normName(q);
  const list = inArea.filter((e) => (!group || e.group === group) && (!onlyPriced || priceOfEntry(e)) && (!s || normName(e.name).includes(s) || (e.itemId ?? "").includes(q.trim())))
    .sort((a, b) => groups.indexOf(a.group) - groups.indexOf(b.group) || a.name.localeCompare(b.name));
  const [newName, setNewName] = useState("");
  const [newId, setNewId] = useState("");
  const [newGroup, setNewGroup] = useState<PriceGroup>("other");
  const chip = (k: PriceGroup | "", label: string, n: number) => (
    <button key={k || "all"} onClick={() => setGroup(k)} aria-pressed={group === k} disabled={!n && k !== ""}
      className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs transition-colors disabled:opacity-35 ${group === k ? "border-[#d9c58f]/50 bg-white/[0.09] text-[#f4eed7]" : "border-white/10 text-zinc-400 hover:text-zinc-200"}`}>
      {k && <span className="h-2 w-2 rounded-full" style={{ background: GROUP_COLOR[k] }} />}{label} <span className="text-zinc-500">{n}</span>
    </button>
  );
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div role="tablist" className="grid grid-cols-2 rounded-xl border border-[#d9c58f]/25 bg-white/[0.03] p-1 text-sm">
          {([["materials", t("Rohmaterialien", "Raw materials")], ["gear", t("Waffen & Ausrüstung", "Weapons & gear")]] as const).map(([k, l]) => (
            <button key={k} role="tab" aria-selected={area === k} onClick={() => { setArea(k); setGroup(""); }}
              className={`rounded-lg px-3 py-1.5 transition-colors ${area === k ? "bg-white/[0.09] text-[#f4eed7] ring-1 ring-[#d9c58f]/40" : "text-zinc-500 hover:text-zinc-300"}`}>
              {l} <span className="text-xs text-zinc-500">{all.filter((e) => e.area === k).length}</span>
            </button>
          ))}
        </div>
        <input className={`${INPUT} min-w-[12rem] flex-1`} value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("Suche: Name oder Item-ID …", "Search: name or item ID …")} aria-label={t("Suche", "Search")} />
        <span className="text-xs text-zinc-500">{t("Preise für", "Prices for")} {server}: {onServer.length}</span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {chip("", t("Alle", "All"), inArea.length)}
        {groups.map((g) => chip(g, names[g], inArea.filter((e) => e.group === g).length))}
        <label className="ml-auto flex items-center gap-2 text-xs text-zinc-400"><input type="checkbox" checked={onlyPriced} onChange={(e) => setOnlyPriced(e.target.checked)} /> {t("nur mit Preis", "only with price")}</label>
      </div>

      <ul className="space-y-1.5">
        {list.map((e, i) => {
          const head = !group && (i === 0 || list[i - 1].group !== e.group) ? e.group : undefined;
          return [
            head && <li key={`h-${head}`} className={`${LABEL} flex items-center gap-2 pt-2`}><span className="h-2 w-2 rounded-full" style={{ background: GROUP_COLOR[e.group] }} />{names[head]}</li>,
            <CatalogRow key={e.key} e={e} state={state} server={server} update={update} onPrice={onPrice} />,
          ];
        })}
        {!list.length && <li className="text-sm text-zinc-500">{t("Nichts gefunden.", "Nothing found.")}</li>}
      </ul>

      <div className="card-face relative grid gap-2 rounded-2xl px-4 py-3 text-sm sm:grid-cols-[1fr_10rem_14rem_auto]">
        <input className={INPUT} value={newName} onChange={(e) => setNewName(e.target.value)} placeholder={t("Eigenes Material / Item …", "Own material / item …")} />
        <input className={INPUT} value={newId} onChange={(e) => setNewId(e.target.value.replace(/\D/g, ""))} placeholder={t("Item-ID (optional)", "Item ID (optional)")} inputMode="numeric" />
        <select className={INPUT} value={newGroup} onChange={(e) => setNewGroup(e.target.value as PriceGroup)}>
          <optgroup label={t("Rohmaterialien", "Raw materials")}>{MATERIAL_GROUPS.map((g) => <option key={g} value={g}>{names[g]}</option>)}</optgroup>
          <optgroup label={t("Waffen & Ausrüstung", "Weapons & gear")}>{GEAR_GROUPS.map((g) => <option key={g} value={g}>{names[g]}</option>)}</optgroup>
        </select>
        <button className={BTN} disabled={!newName.trim() || all.some((c) => normName(c.name) === normName(newName) && (!newId || c.itemId === newId))} onClick={() => {
          const gear = (GEAR_GROUPS as readonly string[]).includes(newGroup);
          const e: CatalogEntry = { key: `custom:${uid()}`, name: newName.trim(), itemId: newId || undefined, category: gear ? "other" : "raw", group: newGroup, recipeKeys: [], bound: null, custom: true };
          update((st) => ({ ...st, catalogExtra: [...st.catalogExtra, e] }));
          setArea(gear ? "gear" : "materials"); setGroup(""); setNewName(""); setNewId(""); setQ(e.name);
        }}>{t("Zum Katalog hinzufügen", "Add to catalogue")}</button>
      </div>
      <p className="text-xs text-zinc-500">{t("Der Katalog wird aus allen Rezepten, Zutaten und Transfer-Gegenständen gebaut und wächst mit jedem Import. Ein Preis entsteht nur, wenn du „Preis hinzufügen“ klickst. Preise gelten für deinen Server. Bestand ist getrennt von den Preisen.",
        "The catalogue is built from all recipes, ingredients and transfer items and grows with every import. A price is only created when you click “Add price”. Prices apply to your server. Stock is kept apart from prices.")}</p>
    </div>
  );
}

function CatalogRow({ e, state, server, update, onPrice }: { e: CatalogEntry & { area: PriceArea; group: PriceGroup }; state: CraftState; server: string; update: Update; onPrice: (x: PriceTarget) => void }) {
  const t = useT();
  const range = useRange();
  const mine = state.prices.find((x) => (x.server ?? "").toLowerCase() === server.toLowerCase() && findPrice({ prices: [x] }, e));
  const stock = state.inventory[itemKey(e)];
  const icon = SHOW_ITEM_ICONS ? craftIcon(e) : undefined;
  const isTarget = e.key.startsWith("recipe:") || e.key.startsWith("combo:");
  return (
    <li className="card-face relative flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl py-1.5 pl-2 pr-3 text-xs" style={{ boxShadow: `inset 3px 0 0 ${GROUP_COLOR[e.group]}` }}>
      <ItemIcon src={icon} color={GROUP_COLOR[e.group]} />
      <span className="min-w-0 text-sm text-[#efe6cc]/90">{e.name}</span>
      <span className="text-zinc-500">{e.itemId ? `#${e.itemId}` : t("ohne Item-ID", "no item ID")}{e.bound === true ? ` · ${t("gebunden", "bound")}` : ""}
        {e.area === "gear" ? ` · ${isTarget ? t("Rezeptziel", "recipe target") : t("Zwischenstufe", "intermediate")}` : ""}{e.custom ? ` · ${t("eigener Eintrag", "own entry")}` : ""}</span>
      <span className="ml-auto flex flex-wrap items-center gap-2">
        {e.area === "materials" && (
          <label className="flex items-center gap-1 text-zinc-500">{t("Bestand", "Stock")}
            <input className={`${INPUT} w-16 text-right text-xs`} inputMode="numeric" value={stock ?? ""} placeholder="–"
              onChange={(ev) => { const v = ev.target.value.replace(/\D/g, ""); update((s) => { const inv = { ...s.inventory }; if (v === "") delete inv[itemKey(e)]; else inv[itemKey(e)] = Number(v); return { ...s, inventory: inv }; }); }} />
          </label>
        )}
        {mine ? <>
          <span className="text-[#efe6cc]/90">{range(mine.low, mine.high) ?? range(mine.ref, mine.ref)}</span>
          {mine.updated && <span className="text-zinc-500">{new Date(mine.updated).toLocaleDateString()}</span>}
          <button className={BTN} onClick={() => onPrice({ item: { ...e, catalogKey: e.key }, server })}>{t("Bearbeiten", "Edit")}</button>
          <button className={BTN} onClick={() => update((s) => ({ ...s, prices: s.prices.filter((x) => x !== mine && (!mine.id || x.id !== mine.id)) }))}>{t("Löschen", "Delete")}</button>
        </> : <>
          <span className={MISSING}>{t("Kein Preis hinterlegt", "No price saved")}</span>
          <button className={BTN} onClick={() => onPrice({ item: { ...e, catalogKey: e.key }, server })}>{t("Preis hinzufügen", "Add price")}</button>
        </>}
      </span>
    </li>
  );
}

/** Small item icon; a tinted empty frame in the group colour while the original icon is missing. */
function ItemIcon({ src, color }: { src?: string; color: string }) {
  const [failed, setFailed] = useState<string>();
  return (
    <span aria-hidden className="relative h-8 w-8 shrink-0 overflow-hidden rounded-md bg-[radial-gradient(circle_at_50%_40%,#1f3a66_0%,#111a2b_60%,#0a0d14_100%)] ring-1 ring-white/10">
      {src && failed !== src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" loading="lazy" referrerPolicy="no-referrer" className="h-full w-full object-contain p-[2px]" onError={() => setFailed(src)} />
      ) : <span className="absolute inset-[30%] rounded-full opacity-60" style={{ background: color }} />}
    </span>
  );
}

/* ------------------------------------------------------------------ price dialog ------------------------------------------------------------------ */

const numOrNull = (v: string) => (v.trim() === "" ? null : Number(v.replace(/[.\s]/g, "").replace(",", ".")));

/** One dialog for every price edit: in the catalogue (server price) and inside a project (server, project or step). Shows the effect before saving. */
function PriceDialog({ target, state, onClose, onSave }: { target: PriceTarget; state: CraftState; onClose: () => void; onSave: (fn: (s: CraftState) => CraftState) => void }) {
  const t = useT();
  const range = useRange();
  const { item, server, project, stepKey } = target;
  const current = project ? findPrice(ctxOf(state, project, stepKey), item) : findPrice({ prices: state.prices.filter((x) => (x.server ?? "").toLowerCase() === server.toLowerCase()), server }, item);
  const [low, setLow] = useState(current?.low?.toString() ?? "");
  const [high, setHigh] = useState(current?.high?.toString() ?? "");
  const [ref, setRef] = useState(current?.ref?.toString() ?? "");
  const [note, setNote] = useState(current?.note ?? "");
  const [tradeable, setTradeable] = useState<boolean | null>(current?.tradeable ?? (item.bound === true ? false : null));
  const [scope, setScope] = useState<"global" | "project" | "step">(current?.scope === "step" ? "step" : current?.scope === "project" ? "project" : "global");
  const v = { low: numOrNull(low), high: numOrNull(high), ref: numOrNull(ref), tradeable, note: note.trim() || undefined };
  const bad = [v.low, v.high, v.ref].some((x) => x !== null && Number.isNaN(x)) ? t("Nur Zahlen eintragen", "Numbers only") : validatePrice(v);
  const apply = (s: CraftState) => savePrice(s, item, v, scope === "global" ? { kind: "global", server } : { kind: scope, projectId: project!.id, stepKey });
  const preview = useMemo(() => {
    if (bad) return [];
    const after = apply(state);
    // every open project on this server whose open path uses the item
    return state.projects.filter((p) => p.status !== "done" && p.server.toLowerCase() === server.toLowerCase() && remainingPath(p, state).some(({ recipe }) => recipe.ingredients.some((i) => findPrice({ prices: [{ ...item, low: 0, high: 0, ref: 0, tradeable: null }] }, i))))
      .map((p) => {
        const pa = after.projects.find((x) => x.id === p.id)!;
        return { p, before: [openCost(p, state, "low"), openCost(p, state, "high")] as const, after: [openCost(pa, after, "low"), openCost(pa, after, "high")] as const };
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [low, high, ref, tradeable, scope, state]);
  const show = (c: readonly [ReturnType<typeof openCost>, ReturnType<typeof openCost>]) => c[0].cost !== null ? range(c[0].cost, c[1].cost) : <span className={MISSING}>{t("Daten fehlen", "Data missing")}{c[0].partial ? ` (${t("bekannt", "known")} ${range(c[0].partial, c[1].partial)})` : ""}</span>;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  const target2 = (p: Project) => projectTarget(p, state.recipes)?.name ?? p.targetRecipeKey;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-3 sm:items-center" role="dialog" aria-modal="true" aria-label={t("Marktpreis", "Market price")} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-lg">
        <Card className="max-h-[90vh] space-y-3 overflow-y-auto p-4 text-sm">
          <div className="relative">
            <div className={LABEL}>{t("Marktpreis", "Market price")} · {server}</div>
            <div className="text-base font-semibold text-[#f4eed7]">{item.name}</div>
            {item.itemId && <div className="text-xs text-zinc-500">Item-ID {item.itemId}</div>}
          </div>
          <div className="relative grid grid-cols-2 gap-2">
            <label className="grid gap-1"><span className={LABEL}>{t("Mindestpreis (Kinah)", "Minimum price (Kinah)")}</span><input autoFocus className={INPUT} inputMode="numeric" value={low} onChange={(e) => setLow(e.target.value)} placeholder="?" /></label>
            <label className="grid gap-1"><span className={LABEL}>{t("Höchstpreis (Kinah)", "Maximum price (Kinah)")}</span><input className={INPUT} inputMode="numeric" value={high} onChange={(e) => setHigh(e.target.value)} placeholder="?" /></label>
            <label className="grid gap-1"><span className={LABEL}>{t("Referenz (optional)", "Reference (optional)")}</span><input className={INPUT} inputMode="numeric" value={ref} onChange={(e) => setRef(e.target.value)} placeholder="–" /></label>
            <label className="grid gap-1"><span className={LABEL}>{t("Handelbar", "Tradeable")}</span>
              <select className={INPUT} value={tradeable === null ? "" : String(tradeable)} onChange={(e) => setTradeable(e.target.value === "" ? null : e.target.value === "true")}>
                <option value="">{t("unbekannt", "unknown")}</option><option value="true">{t("ja", "yes")}</option><option value="false">{t("nein", "no")}</option>
              </select></label>
            <label className="col-span-2 grid gap-1"><span className={LABEL}>{t("Notiz", "Note")}</span><input className={INPUT} value={note} onChange={(e) => setNote(e.target.value)} /></label>
          </div>
          {project && (
            <fieldset className="relative grid gap-1 text-xs text-[#efe6cc]/85">
              <legend className={LABEL}>{t("Gültig für", "Applies to")}</legend>
              <label className="flex items-center gap-2"><input type="radio" checked={scope === "global"} onChange={() => setScope("global")} />{t(`Für alle Projekte auf ${server} aktualisieren`, `Update for all projects on ${server}`)}</label>
              <label className="flex items-center gap-2"><input type="radio" checked={scope === "project"} onChange={() => setScope("project")} />{t("Nur in diesem Projekt verwenden", "Use in this project only")}</label>
              {stepKey && <label className="flex items-center gap-2"><input type="radio" checked={scope === "step"} onChange={() => setScope("step")} />{t("Nur in diesem Schritt verwenden", "Use in this step only")}</label>}
            </fieldset>
          )}
          {bad && (v.low !== null || v.high !== null || v.ref !== null) && <p className="relative text-xs text-[#ff3344]">{bad}</p>}
          <div className="relative space-y-1">
            <div className={LABEL}>{t("Vorschau: offene Materialkosten", "Preview: open material cost")}</div>
            {!bad && !preview.length && <p className="text-xs text-zinc-500">{t("Kein offenes Projekt auf diesem Server nutzt diesen Artikel gerade.", "No open project on this server uses this item right now.")}</p>}
            <ul className="space-y-1 text-xs">
              {preview.map(({ p, before, after }) => (
                <li key={p.id} className="rounded-lg bg-white/[0.03] px-2 py-1">
                  <div className="text-[#efe6cc]/85">{p.character} · {target2(p)}</div>
                  <div className="text-zinc-400">{show(before)} → <b className="text-[#f4eed7]">{show(after)}</b></div>
                </li>
              ))}
            </ul>
            <p className="text-[11px] text-zinc-500">{t("Bereits eingetragene Crafts behalten ihre Kosten.", "Crafts already logged keep their cost.")}</p>
          </div>
          <div className="relative flex justify-end gap-2">
            <button className={BTN} onClick={onClose}>{t("Abbrechen", "Cancel")}</button>
            <button className={BTN} disabled={!!bad} onClick={() => onSave(apply)}>{t("Speichern", "Save")}</button>
          </div>
        </Card>
      </div>
    </div>
  );
}

