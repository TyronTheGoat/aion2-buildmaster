"use client";
import { useMemo, useRef, useState } from "react";
import type { Character } from "@/lib/types";
import { numberLocale, useLang, useT, type T } from "@/lib/i18n";
import { charKey } from "../store";
import { useCraft } from "../craft-store";
import {
  SLOT_PRIORITY, activeAttempts, attemptCost, attemptEffects, importFile, itemKey, nextSteps, pathSimInput, producerOf,
  projectTarget, remainingPath, sortProjects, spent, stepBudget, uid,
  type CraftSlot, type CraftState, type ImportError, type NextStep, type Outcome, type Price, type Project, type Recipe, type Scenario,
} from "@/lib/crafting/model";
import { effectiveChance, simulateBudget, type ChanceGoal } from "@/lib/crafting/prob";

const BTN = "rounded-lg border border-[#d9c58f]/20 bg-white/[0.04] px-2.5 py-1.5 text-xs text-[#efe6cc] hover:border-[#d9c58f]/45 disabled:opacity-40";
const INPUT = "min-w-0 rounded-lg border border-[#d9c58f]/20 bg-white/[0.03] px-2.5 py-1.5 text-sm text-[#f4eed7] outline-none focus:border-[#d9c58f]/50";
const LABEL = "text-[10px] uppercase tracking-[0.22em] text-zinc-500";

const slotName = (s: CraftSlot, t: T) => ({
  weapon: t("Waffe", "Weapon"), ring: t("Ring", "Ring"), guard: t("Schützer / Nebenhand", "Guard / off-hand"),
  gloves: t("Handschuhe", "Gloves"), jewelry: t("Schmuck", "Jewellery"), armor: t("Rüstung", "Armour"),
})[s];

const outcomeName = (o: Outcome, t: T) => ({
  base_fail: t("Fehlgeschlagen", "Failed"), success: t("Erfolg", "Success"), combo_success: t("Combo erfolgreich", "Combo success"),
  combo_fail: t("Combo fehlgeschlagen", "Combo failed"), guaranteed_success: t("Garantiert erfolgreich", "Guaranteed success"),
})[o];

const pct = (p: number | null) => (p === null ? null : `${(p * 100).toFixed(p < 0.1 ? 2 : 1).replace(/\.0+$/, "")} %`);

function useKinah() {
  const lang = useLang();
  return (n: number | null) => (n === null ? null : `${Math.round(n).toLocaleString(numberLocale(lang))} Kinah`);
}

/** Crafting area of one character: projects, next steps, market prices. Beta while the recipe data is incomplete. */
export function CraftingView({ char, onBack }: { char: Character; onBack: () => void }) {
  const t = useT();
  const { state, update, exportJson, importJson } = useCraft();
  const [tab, setTab] = useState<"projects" | "next" | "prices">("next");
  const [report, setReport] = useState<{ file: string; rows: number; errors: ImportError[]; kind: string }[]>();
  const fileRef = useRef<HTMLInputElement>(null);
  const backupRef = useRef<HTMLInputElement>(null);
  const key = charKey(char);

  const onFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    let s = state;
    const out: NonNullable<typeof report> = [];
    for (const f of Array.from(files)) {
      const text = await f.text();
      const r = importFile(s, f.name, text);
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

  return (
    <div className="space-y-4">
      <div className="card-face relative flex flex-wrap items-center gap-x-3 gap-y-2 overflow-hidden rounded-2xl px-3 py-2.5">
        <button onClick={onBack} className="relative shrink-0 rounded-full border border-[#d9c58f]/20 bg-white/[0.03] px-3 py-1 text-sm text-[#efe6cc]/85 hover:border-[#d9c58f]/40">‹ {t("Zurück", "Back")}</button>
        <div className="relative min-w-0 flex-1">
          <div className="truncate text-base font-semibold leading-tight text-[#f4eed7]">Crafting · {char.name}</div>
          <div className="text-[11px] text-[#ffa31a]/85">{t("Beta · Daten unvollständig", "Beta · data incomplete")}</div>
        </div>
        <div className="relative flex shrink-0 flex-wrap gap-1.5">
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

      {report && <ImportReport report={report} onClose={() => setReport(undefined)} />}

      <div className="relative grid grid-cols-3 rounded-xl border border-[#d9c58f]/25 bg-white/[0.03] p-1 text-sm">
        {([["projects", t("Projekte", "Projects")], ["next", "Next Steps"], ["prices", t("Marktpreise", "Market prices")]] as const).map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} aria-pressed={tab === k}
            className={`rounded-lg px-3 py-1.5 transition-colors ${tab === k ? "bg-white/[0.09] text-[#f4eed7] ring-1 ring-[#d9c58f]/40" : "text-zinc-500 hover:text-zinc-300"}`}>{l}</button>
        ))}
      </div>

      {!state.recipes.length && (
        <p className="rounded-xl border border-[#ffa31a]/25 bg-[#ffa31a]/[0.05] px-3 py-2 text-sm text-[#efe6cc]/85">
          {t("Noch keine Rezeptdaten. Importiere die CSV-Dateien (01 Rezepte, 01B eigene Chancen, 02 Materialien, 03 Preise). Ohne Daten zeigt der Planer keine Kosten oder Chancen an.",
            "No recipe data yet. Import the CSV files (01 recipes, 01B own chances, 02 materials, 03 prices). Without data the planner shows no costs or chances.")}
        </p>
      )}

      {tab === "projects" && <ProjectsTab state={state} update={update} char={char} charKey={key} />}
      {tab === "next" && <NextStepsTab state={state} update={update} charKey={key} />}
      {tab === "prices" && <PricesTab state={state} update={update} />}
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

type Update = (fn: (s: CraftState) => CraftState) => void;

function ProjectsTab({ state, update, char, charKey: key }: { state: CraftState; update: Update; char: Character; charKey: string }) {
  const t = useT();
  const mine = sortProjects(state.projects.filter((p) => p.charKey === key));
  const [adding, setAdding] = useState(false);
  return (
    <div className="space-y-3">
      <button className={BTN} onClick={() => setAdding((a) => !a)} disabled={!state.recipes.length}>{adding ? t("Abbrechen", "Cancel") : t("+ Neues Projekt", "+ New project")}</button>
      {adding && <NewProject state={state} char={char} charKey={key} onDone={(p) => { if (p) update((s) => ({ ...s, projects: [...s.projects, p] })); setAdding(false); }} />}
      {!mine.length && !adding && <p className="text-sm text-zinc-500">{t("Noch keine Projekte für diesen Charakter.", "No projects for this character yet.")}</p>}
      {mine.map((p) => <ProjectCard key={p.id} p={p} state={state} update={update} />)}
    </div>
  );
}

function NewProject({ state, char, charKey: key, onDone }: { state: CraftState; char: Character; charKey: string; onDone: (p?: Project) => void }) {
  const t = useT();
  const faction = char.race ?? "";
  const recipes = state.recipes.filter((r) => !r.faction || !faction || ["beide", "both", "all"].includes(r.faction.toLowerCase()) || r.faction.toLowerCase().startsWith(faction.toLowerCase().slice(0, 4)));
  const [slot, setSlot] = useState<CraftSlot>("weapon");
  const [recipeKey, setRecipeKey] = useState(recipes[0]?.recipeKey ?? "");
  const [goal, setGoal] = useState<ChanceGoal>("normal");
  const [mastery, setMastery] = useState("");
  const [profession, setProfession] = useState("");
  const [owned, setOwned] = useState<Set<string>>(new Set());
  const recipe = recipes.find((r) => r.recipeKey === recipeKey);
  // intermediates on the way to the target, offered as "already owned"
  const draft: Project | undefined = recipe && {
    id: "draft", charKey: key, character: char.name, faction, server: char.server, className: char.className, slot, mastery: null,
    targetRecipeKey: recipe.recipeKey, goal: recipe.comboOutput ? goal : "normal", status: "active", createdAt: "", owned: [],
  };
  const steps = draft ? remainingPath(draft, state) : [];
  const m = mastery.trim() === "" ? null : Number(mastery);
  return (
    <div className="card-face relative grid gap-3 rounded-2xl px-4 py-3 text-sm sm:grid-cols-2">
      <label className="grid gap-1"><span className={LABEL}>{t("Gear-Slot", "Gear slot")}</span>
        <select className={INPUT} value={slot} onChange={(e) => setSlot(e.target.value as CraftSlot)}>{SLOT_PRIORITY.map((s) => <option key={s} value={s}>{slotName(s, t)}</option>)}</select></label>
      <label className="grid gap-1"><span className={LABEL}>{t("Zielgegenstand (Rezept)", "Target item (recipe)")}</span>
        <select className={INPUT} value={recipeKey} onChange={(e) => { setRecipeKey(e.target.value); setOwned(new Set()); }}>
          {recipes.map((r) => <option key={r.recipeKey} value={r.recipeKey}>{r.output.name}{r.comboOutput ? ` / ${r.comboOutput.name}` : ""} · {r.name}</option>)}
        </select></label>
      {recipe?.comboOutput && (
        <label className="grid gap-1"><span className={LABEL}>{t("Ziel", "Goal")}</span>
          <select className={INPUT} value={goal} onChange={(e) => setGoal(e.target.value as ChanceGoal)}>
            <option value="normal">{recipe.output.name}</option><option value="combo">{recipe.comboOutput.name} (Combo)</option>
          </select></label>
      )}
      <label className="grid gap-1"><span className={LABEL}>{t("Handwerksberuf", "Profession")}</span>
        <input className={INPUT} value={profession} onChange={(e) => setProfession(e.target.value)} placeholder={recipe?.profession ?? ""} /></label>
      <label className="grid gap-1"><span className={LABEL}>{t("Deine Handwerksstufe", "Your crafting level")}</span>
        <input className={INPUT} inputMode="numeric" value={mastery} onChange={(e) => setMastery(e.target.value)} placeholder={t("unbekannt", "unknown")} /></label>
      <div className="text-xs text-zinc-500 sm:col-span-2">{[char.race, char.server, char.className].filter(Boolean).join(" · ")}</div>
      {steps.length > 1 && (
        <fieldset className="grid gap-1 sm:col-span-2"><legend className={LABEL}>{t("Zwischenstand: schon vorhanden", "Progress: already owned")}</legend>
          {steps.slice(0, -1).map(({ recipe: r }, i) => {
            const k = itemKey(r.output);
            return (
              <label key={`${r.recipeKey}:${i}`} className="flex items-center gap-2 text-[#efe6cc]/85">
                <input type="checkbox" checked={owned.has(k)} onChange={(e) => setOwned((o) => { const n = new Set(o); if (e.target.checked) n.add(k); else n.delete(k); return n; })} />
                {r.output.name}
              </label>
            );
          })}
          <span className="text-xs text-zinc-500">{t("Ein vorhandenes Zwischenitem überspringt nur seinen eigenen Craft. Weitere Basisitems, die spätere Rezepte brauchen, bleiben auf der Liste.",
            "An owned intermediate only skips its own craft. Other base items later recipes need stay on the list.")}</span>
        </fieldset>
      )}
      <div className="flex gap-2 sm:col-span-2">
        <button className={BTN} disabled={!recipe || (m !== null && !Number.isFinite(m))} onClick={() => recipe && onDone({
          ...draft!, id: uid(), mastery: m, profession: profession || recipe.profession, createdAt: new Date().toISOString(),
          owned: steps.slice(0, -1).map((s) => s.recipe.output).filter((o) => owned.has(itemKey(o))),
        })}>{t("Projekt anlegen", "Create project")}</button>
      </div>
    </div>
  );
}

function ProjectCard({ p, state, update }: { p: Project; state: CraftState; update: Update }) {
  const t = useT();
  const kinah = useKinah();
  const target = projectTarget(p, state.recipes);
  const path = remainingPath(p, state);
  const money = spent(p, state.events);
  const history = activeAttempts(state.events).filter((e) => e.projectId === p.id).slice(-8).reverse();
  const set = (patch: Partial<Project>) => update((s) => ({ ...s, projects: s.projects.map((x) => (x.id === p.id ? { ...x, ...patch } : x)) }));
  return (
    <div className={`card-face relative space-y-2 rounded-2xl px-4 py-3 text-sm ${p.status !== "active" ? "opacity-60" : ""}`}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-md border border-[#d9c58f]/25 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-[#beac80]">{slotName(p.slot, t)}</span>
        <span className="font-semibold text-[#f4eed7]">{target?.name ?? t("Rezept fehlt", "Recipe missing")}</span>
        <span className="text-xs text-zinc-500">{p.status === "active" ? t("aktiv", "active") : p.status === "paused" ? t("pausiert", "paused") : t("abgeschlossen", "done")}</span>
        <div className="ml-auto flex gap-1.5">
          <input className={`${INPUT} w-16 text-xs`} inputMode="numeric" title={t("Reihenfolge im Slot", "Order within slot")} placeholder="#" value={p.order ?? ""}
            onChange={(e) => set({ order: e.target.value === "" ? undefined : Number(e.target.value) })} />
          <input className={`${INPUT} w-24 text-xs`} inputMode="numeric" title={t("Handwerksstufe", "Crafting level")} placeholder={t("Stufe ?", "Level ?")} value={p.mastery ?? ""}
            onChange={(e) => set({ mastery: e.target.value === "" ? null : Number(e.target.value) })} />
          {p.status === "active"
            ? <button className={BTN} onClick={() => set({ status: "paused" })}>{t("Pausieren", "Pause")}</button>
            : <button className={BTN} onClick={() => set({ status: "active" })}>{t("Fortsetzen", "Resume")}</button>}
          {p.status !== "done" && <button className={BTN} onClick={() => set({ status: "done" })}>{t("Abschließen", "Finish")}</button>}
        </div>
      </div>
      <div className="text-xs text-zinc-400">
        {t("Offene Crafts", "Open crafts")}: {path.length ? path.map((s) => (s.goal === "combo" ? s.recipe.comboOutput?.name : s.recipe.output.name)).join(" → ") : t("keine", "none")}
      </div>
      <div className="text-xs text-zinc-400">
        {t("Bisher ausgegeben", "Spent so far")}: {kinah(money.low)}{money.high !== money.low ? ` – ${kinah(money.high)}` : ""}
        {money.unknown > 0 && <span className="text-[#ffa31a]"> · {money.unknown} {t("Versuche ohne Preis", "attempts without price")}</span>}
      </div>
      <ProjectBudget p={p} state={state} />
      {history.length > 0 && (
        <div>
          <div className={LABEL}>{t("Verlauf", "History")}</div>
          <ul className="mt-1 space-y-1 text-xs text-zinc-400">
            {history.map((e) => (
              <li key={e.id} className="flex items-center gap-2">
                <span className="text-zinc-500">{new Date(e.at).toLocaleString()}</span>
                <span className="text-[#efe6cc]/85">{state.recipes.find((r) => r.recipeKey === e.recipeKey)?.name ?? e.recipeKey}</span>
                <span>{outcomeName(e.outcome, t)}</span>
                <button className="ml-auto text-zinc-500 underline hover:text-zinc-300" onClick={() => update((s) => undoAttempt(s, e.id))}>{t("Rückgängig", "Undo")}</button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
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
    <div className="rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2 text-xs">
      <div className="flex flex-wrap items-center gap-2">
        <span className={LABEL}>{t("Gesamtziel · 80 %-Planungswert", "Whole goal · 80 % planning value")}</span>
        <select className={`${INPUT} text-xs`} value={s} onChange={(e) => setS(e.target.value as Scenario)}>
          <option value="low">{t("Niedrigpreis", "Low price")}</option><option value="high">{t("Hochpreis", "High price")}</option><option value="ref">{t("Referenzpreis", "Reference price")}</option>
        </select>
        <button className={BTN} disabled={!input.steps || busy} onClick={run}>{busy ? t("Rechnet …", "Running …") : t("Berechnen", "Calculate")}</button>
      </div>
      {!input.steps && (
        <div className="mt-1 text-[#ffa31a]">
          {t("Daten fehlen, deshalb keine Kostenangabe:", "Data missing, so no cost shown:")}
          <ul className="list-inside list-disc text-zinc-400">{[...new Set(input.missing.map((m) => `${m.step}: ${m.what}${m.item ? ` (${m.item})` : ""}`))].slice(0, 8).map((m) => <li key={m}>{m}</li>)}</ul>
        </div>
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

function logAttempt(s: CraftState, step: NextStep, outcome: Outcome): CraftState {
  const fx = attemptEffects(step.recipe, outcome);
  const crafted = (i: { name: string; itemId?: string }) => !!producerOf(i, s.recipes, step.project.faction);
  const cost = (sc: Scenario) => {
    const r = outcome === "base_fail"
      ? attemptCost({ ...step.recipe, ingredients: step.recipe.ingredients.filter((i) => fx.consumed.some((c) => itemKey(c) === itemKey(i))) }, s.prices, sc, crafted)
      : attemptCost(step.recipe, s.prices, sc, crafted);
    return r.cost;
  };
  const inv = { ...s.inventory };
  for (const c of fx.consumed) if (!crafted(c)) inv[itemKey(c)] = Math.max(0, (inv[itemKey(c)] ?? 0) - c.qty);
  return {
    ...s, inventory: inv,
    events: [...s.events, { id: uid(), kind: "attempt", projectId: step.project.id, at: new Date().toISOString(), recipeKey: step.recipe.recipeKey, outcome, ...fx, costLow: cost("low"), costHigh: cost("high") }],
  };
}

function NextStepsTab({ state, update, charKey: key }: { state: CraftState; update: Update; charKey: string }) {
  const t = useT();
  const steps = nextSteps(state, key);
  if (!steps.length) return <p className="text-sm text-zinc-500">{t("Keine offenen Schritte. Lege unter „Projekte“ ein Projekt an.", "No open steps. Create a project under “Projects”.")}</p>;
  return <div className="space-y-3">{steps.map((s) => <StepCard key={s.project.id} s={s} state={state} onLog={(o) => update((st) => logAttempt(st, s, o))} />)}</div>;
}

function StepCard({ s, state, onLog }: { s: NextStep; state: CraftState; onLog: (o: Outcome) => void }) {
  const t = useT();
  const kinah = useKinah();
  const target = projectTarget(s.project, state.recipes);
  const want = s.goal === "combo" && s.recipe.comboOutput ? s.recipe.comboOutput.name : s.recipe.output.name;
  const crafted = (i: { name: string; itemId?: string }) => !!producerOf(i, state.recipes, s.project.faction);
  const next = { low: attemptCost(s.recipe, state.prices, "low", crafted), high: attemptCost(s.recipe, state.prices, "high", crafted) };
  const pActual = s.chance.actual ? effectiveChance(s.chance.actual, s.goal) : null;
  const budget = { low: stepBudget(s.recipe, pActual, state.prices, "low"), high: stepBudget(s.recipe, pActual, state.prices, "high") };
  const dataMissing = <span className="text-[#ffa31a]">{t("Daten fehlen", "Data missing")}</span>;
  return (
    <div className="card-face relative space-y-2 rounded-2xl px-4 py-3 text-sm">
      <div className="flex flex-wrap items-baseline gap-2">
        <span className="rounded-md border border-[#d9c58f]/25 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-[#beac80]">{slotName(s.project.slot, t)}</span>
        <span className="font-semibold text-[#f4eed7]">{target?.name}</span>
        <span className="text-xs text-zinc-500">{t("Nächster Schritt", "Next step")}: {want} · {s.recipe.name}{s.recipe.recipeId ? ` (#${s.recipe.recipeId})` : ""}</span>
      </div>
      <ul className="grid gap-1 text-xs sm:grid-cols-2">
        {s.ingredients.map((i) => {
          const ok = i.qty !== null && i.have >= i.qty;
          return (
            <li key={itemKey(i)} className="flex justify-between gap-2 rounded-lg bg-white/[0.03] px-2 py-1">
              <span className="text-[#efe6cc]/85">{i.name}{i.crafted ? <span className="text-zinc-500"> · {t("Zwischenitem", "intermediate")}</span> : ""}</span>
              <span className={ok ? "text-[#5fbf8a]" : "text-[#ff3344]"}>{i.have} / {i.qty ?? "?"}</span>
            </li>
          );
        })}
        {!s.ingredients.length && <li className="text-[#ffa31a]">{t("Zutaten nicht dokumentiert", "Ingredients not documented")}</li>}
      </ul>
      <div className="grid gap-1 text-xs text-zinc-300 sm:grid-cols-2">
        <div>{t("Chance bei deiner Stufe", "Chance at your level")} {s.project.mastery ?? "?"}: {pct(pActual) ?? <span className="text-[#ffa31a]">{t("unbekannt", "unknown")}</span>}
          {s.chance.basis === "character" && s.chance.override?.source && <span className="text-zinc-500"> · {s.chance.override.source}{s.chance.override.date ? `, ${s.chance.override.date}` : ""}</span>}</div>
        <div className="text-zinc-500">{t("Dokumentiert bei Stufe", "Documented at level")} {s.chance.documentedMastery ?? "?"}: {pct(s.documentedPlan.p) ?? t("unbekannt", "unknown")}
          {s.documentedPlan.n80 !== null && Number.isFinite(s.documentedPlan.n80) ? ` · ${s.documentedPlan.n80} ${t("Versuche (80 %)", "attempts (80 %)")}` : ""}</div>
        <div>{t("80 %-Planungswert", "80 % planning value")}: {s.plan.n80 === null ? <span className="text-[#ffa31a]">{t("unbekannt", "unknown")}</span> : !Number.isFinite(s.plan.n80) ? t("nie (0 %)", "never (0 %)") : <b className="text-[#f4eed7]">{s.plan.n80} {t("Versuche", "attempts")}</b>}
          {s.plan.reached !== null && <span className="text-zinc-500"> ({pct(s.plan.reached)})</span>}</div>
        <div className="text-zinc-500">{t("Erwartungswert", "Expected value")}: {s.plan.expected === null ? "?" : Number.isFinite(s.plan.expected) ? s.plan.expected.toFixed(1) : "∞"}</div>
        <div>{t("Nächster Versuch", "Next attempt")}: {next.low.cost === null ? dataMissing : `${kinah(next.low.cost)}${next.high.cost !== null && next.high.cost !== next.low.cost ? ` – ${kinah(next.high.cost)}` : ""}`}</div>
        <div>{t("Bis zu diesem Schritt (80 %)", "Up to this step (80 %)")}: {budget.low.budget === null ? dataMissing : `${kinah(budget.low.budget)}${budget.high.budget !== null && budget.high.budget !== budget.low.budget ? ` – ${kinah(budget.high.budget)}` : ""}`}</div>
      </div>
      <div className="flex flex-wrap gap-1.5 pt-1">
        <span className={`${LABEL} self-center`}>{t("Craft versuchen", "Try craft")}:</span>
        {s.outcomes.map((o) => <button key={o} className={BTN} onClick={() => onLog(o)}>{outcomeName(o, t)}</button>)}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ market prices ------------------------------------------------------------------ */

function PricesTab({ state, update }: { state: CraftState; update: Update }) {
  const t = useT();
  // every material named in a recipe gets a row, even without a price yet
  const rows = useMemo(() => {
    const m = new Map<string, Price>();
    for (const p of state.prices) m.set(itemKey(p), p);
    for (const r of state.recipes as Recipe[]) for (const i of r.ingredients) if (!m.has(itemKey(i))) m.set(itemKey(i), { name: i.name, itemId: i.itemId, low: null, high: null, ref: null, owned: null, tradeable: null });
    return [...m.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [state.prices, state.recipes]);
  const [name, setName] = useState("");
  const setPrice = (p: Price, patch: Partial<Price>) => update((s) => {
    const next = { ...p, ...patch, updated: new Date().toISOString() };
    const i = s.prices.findIndex((x) => itemKey(x) === itemKey(p));
    return { ...s, prices: i >= 0 ? s.prices.map((x, j) => (j === i ? next : x)) : [...s.prices, next] };
  });
  const numIn = (v: number | null, on: (n: number | null) => void) => (
    <input className={`${INPUT} w-24 text-right text-xs`} inputMode="numeric" value={v ?? ""} placeholder="?"
      onChange={(e) => { const x = e.target.value.trim(); const n = Number(x); on(x === "" ? null : Number.isFinite(n) ? n : v); }} />
  );
  return (
    <div className="card-face relative space-y-3 overflow-x-auto rounded-2xl px-4 py-3 text-sm">
      <p className="text-xs text-zinc-500">{t("Preise trägst du selbst ein. Leere Felder bleiben unbekannt und zählen nie als 0 Kinah.", "You enter prices yourself. Empty fields stay unknown and never count as 0 Kinah.")}</p>
      <table className="w-full min-w-[640px] text-xs">
        <thead className={LABEL}><tr>
          <th className="py-1 text-left">{t("Material", "Material")}</th><th>Item-ID</th><th>{t("Niedrig", "Low")}</th><th>{t("Hoch", "High")}</th><th>{t("Referenz", "Reference")}</th><th>{t("Vorhanden", "Owned")}</th><th>{t("Handelbar", "Tradeable")}</th><th>{t("Stand", "Updated")}</th>
        </tr></thead>
        <tbody>
          {rows.map((p) => (
            <tr key={itemKey(p)} className="border-t border-white/5">
              <td className="py-1 pr-2 text-[#efe6cc]/90">{p.name}{p.quality ? <span className="text-zinc-500"> · {p.quality}</span> : ""}</td>
              <td className="text-center text-zinc-500">{p.itemId ?? "–"}</td>
              <td className="text-center">{numIn(p.low, (n) => setPrice(p, { low: n }))}</td>
              <td className="text-center">{numIn(p.high, (n) => setPrice(p, { high: n }))}</td>
              <td className="text-center">{numIn(p.ref, (n) => setPrice(p, { ref: n }))}</td>
              <td className="text-center">{numIn(state.inventory[itemKey(p)] ?? null, (n) => update((s) => ({ ...s, inventory: { ...s.inventory, [itemKey(p)]: n ?? 0 } })))}</td>
              <td className="text-center">
                <select className={`${INPUT} text-xs`} value={p.tradeable === null ? "" : String(p.tradeable)} onChange={(e) => setPrice(p, { tradeable: e.target.value === "" ? null : e.target.value === "true" })}>
                  <option value="">?</option><option value="true">{t("ja", "yes")}</option><option value="false">{t("nein", "no")}</option>
                </select>
              </td>
              <td className="text-center text-zinc-500">{p.updated ? new Date(p.updated).toLocaleDateString() : "–"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex gap-2">
        <input className={INPUT} value={name} onChange={(e) => setName(e.target.value)} placeholder={t("Material hinzufügen …", "Add material …")} />
        <button className={BTN} disabled={!name.trim()} onClick={() => { setPrice({ name: name.trim(), low: null, high: null, ref: null, owned: null, tradeable: null }, {}); setName(""); }}>{t("Hinzufügen", "Add")}</button>
      </div>
    </div>
  );
}
