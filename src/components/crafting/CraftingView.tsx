"use client";
import { useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";
import type { Character } from "@/lib/types";
import { numberLocale, useLang, useT, type T } from "@/lib/i18n";
import { craftIcon } from "@/lib/crafting/craft-icons";
import { GEAR_GROUPS, MATERIAL_GROUPS, entriesFor, type GearGroup, type MaterialGroup, type PriceArea, type PriceGroup } from "@/lib/crafting/catalog-groups";
import { charKey } from "../store";
import { useCraft } from "../craft-store";
import { Card, CardArt, Filler, SHOW_ITEM_ICONS } from "../deck/Card";
import {
  activeAttempts, attemptCost, attemptEffects, buildCatalog, canCraft, craftSlotOf, craftsItself, ctxOf, findPrice, importFile,
  GEAR_SLOTS, itemKey, ladderItems, levelOf, needList, nextStep, normName, ownedCount, prioritySlot, topOf, weaponTypeOf, withOwnedCount, openCost, pathSimInput, producerOf, progress, projectTarget, remainingPath, savePrice, sortProjects,
  spent, stageLevel, uid, validatePrice,
  type CatalogEntry, type CraftSlot, type CraftState, type ImportError, type ItemRef, type NeedLine, type NextStep, type Outcome, type Project, type Scenario,
} from "@/lib/crafting/model";
import { effectiveChance, simulateBudget } from "@/lib/crafting/prob";

const BTN = "rounded-lg border border-[#d9c58f]/20 bg-white/[0.04] px-2.5 py-1.5 text-xs text-[#efe6cc] hover:border-[#d9c58f]/45 disabled:opacity-40";
const INPUT = "min-w-0 rounded-lg border border-[#d9c58f]/20 bg-white/[0.03] px-2.5 py-1.5 text-sm text-[#f4eed7] outline-none focus:border-[#d9c58f]/50";
const LABEL = "text-[10px] uppercase tracking-[0.22em] text-zinc-500";
const MISSING = "text-[#ffa31a]";

/** What the crafting page shows; kept by the parent so it survives switching to Equipment / Arcana and back. */
export interface CraftUi { sub: "projects" | "prices"; open?: string; adding?: boolean }

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

/** Crafting page of one character: project cards (with current craft, stock and next steps inside) and market prices. */
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
  const onPrices = ui.sub === "prices";
  const views = [["projects", t("Crafting-Projekte", "Crafting projects")], ["prices", t("Materialien & Preise", "Materials & prices")]] as const;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div role="tablist" aria-label="Crafting" className="relative grid w-full grid-cols-2 rounded-xl border border-[#d9c58f]/25 bg-white/[0.03] p-1 text-xs sm:text-sm lg:w-auto lg:flex-1">
          {views.map(([k, l]) => (
            <button key={k} role="tab" aria-selected={(k === "prices") === onPrices} onClick={() => setUi((u) => ({ ...u, sub: k }))}
              className={`rounded-lg px-2 py-1.5 transition-colors sm:px-3 ${(k === "prices") === onPrices ? "bg-white/[0.09] text-[#f4eed7] ring-1 ring-[#d9c58f]/40" : "text-zinc-500 hover:text-zinc-300"}`}>{l}</button>
          ))}
        </div>
        <div className="flex min-w-0 flex-wrap gap-1.5">
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

      {!onPrices && (open
        ? <ProjectDetail key={open.id} p={open} state={state} update={update} char={char} onBack={() => setUi((u) => ({ ...u, open: undefined }))} onPrice={setPriceFor} />
        : <ProjectsTab state={state} update={update} char={char} charKey={key} ui={ui} setUi={setUi} />)}
      {onPrices && <PricesTab state={state} update={update} char={char} onPrice={setPriceFor} />}

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

/** Gear slot names for the project choice. */
const gearSlotName = (g: string, t: T) => ({
  weapon: t("Hauptwaffe", "Main weapon"), offhand: t("Nebenhand", "Off-hand"), ring: t("Ring", "Ring"), earrings: t("Ohrringe", "Earrings"),
  necklace: t("Halskette", "Necklace"), gloves: t("Handschuhe", "Gloves"), chest: t("Brust", "Chest"), legs: t("Beine", "Legs"), helm: t("Helm", "Helm"),
  shoulders: t("Schultern", "Shoulders"), boots: t("Stiefel", "Boots"), cape: t("Umhang", "Cape"),
} as Record<string, string>)[g] ?? g;

/** Deletes a project with its logged attempts. */
const deleteProject = (s: CraftState, id: string): CraftState => {
  const mine = new Set(s.events.filter((e) => e.kind === "attempt" && e.projectId === id).map((e) => e.id));
  return { ...s, projects: s.projects.filter((p) => p.id !== id), events: s.events.filter((e) => (e.kind === "attempt" ? !mine.has(e.id) : !mine.has(e.target))) };
};

/** The "⋯" menu of a project: open, pause / resume, delete (asks once). */
function ProjectMenu({ p, update, onOpen, className = "" }: { p: Project; update: Update; onOpen?: () => void; className?: string }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const set = (patch: Partial<Project>) => update((s) => ({ ...s, projects: s.projects.map((x) => (x.id === p.id ? { ...x, ...patch } : x)) }));
  const item = "block w-full rounded-md px-3 py-1.5 text-left text-xs text-[#efe6cc] hover:bg-white/[0.07]";
  return (
    <div className={`relative ${className}`} onKeyDown={(e) => e.key === "Escape" && (setOpen(false), setConfirm(false))}>
      <button type="button" aria-label={t("Projekt-Menü", "Project menu")} aria-expanded={open} onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); setConfirm(false); }}
        className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#d9c58f]/20 bg-[#0b0e14]/80 text-lg leading-none text-[#efe6cc] hover:border-[#d9c58f]/50">⋯</button>
      {open && (
        <div role="menu" onClick={(e) => e.stopPropagation()} className="absolute right-0 top-9 z-20 w-44 rounded-xl border border-[#d9c58f]/25 bg-[#0d1119] p-1 shadow-[0_12px_30px_-8px_#000]">
          {onOpen && <button role="menuitem" className={item} onClick={() => { setOpen(false); onOpen(); }}>{t("Öffnen", "Open")}</button>}
          {p.status === "active"
            ? <button role="menuitem" className={item} onClick={() => { set({ status: "paused" }); setOpen(false); }}>{t("Pausieren", "Pause")}</button>
            : <button role="menuitem" className={item} onClick={() => { set({ status: "active" }); setOpen(false); }}>{p.status === "done" ? t("Wieder öffnen", "Reopen") : t("Fortsetzen", "Resume")}</button>}
          {p.status !== "done" && <button role="menuitem" className={item} onClick={() => { set({ status: "done" }); setOpen(false); }}>{t("Als fertig markieren", "Mark as finished")}</button>}
          {!confirm
            ? <button role="menuitem" className={`${item} text-[#ff6b6b]`} onClick={() => setConfirm(true)}>{t("Löschen …", "Delete …")}</button>
            : <div className="space-y-1 px-2 py-1.5 text-xs text-zinc-300">
              <div>{t("Projekt und sein Protokoll löschen?", "Delete project and its log?")}</div>
              <div className="flex gap-1.5">
                <button className={`${BTN} border-[#ff6b6b]/50 text-[#ff9b9b]`} onClick={() => update((s) => deleteProject(s, p.id))}>{t("Löschen", "Delete")}</button>
                <button className={BTN} onClick={() => setConfirm(false)}>{t("Abbrechen", "Cancel")}</button>
              </div>
            </div>}
        </div>
      )}
    </div>
  );
}

function ProjectsTab({ state, update, char, charKey: key, ui, setUi }: {
  state: CraftState; update: Update; char: Character; charKey: string; ui: CraftUi; setUi: Dispatch<SetStateAction<CraftUi>>;
}) {
  const t = useT();
  const mine = sortProjects(state.projects.filter((p) => p.charKey === key));
  const current = mine.filter((p) => p.status !== "done");
  const done = mine.filter((p) => p.status === "done");
  const grid = "grid grid-cols-1 gap-x-5 gap-y-8 sm:grid-cols-2 sm:gap-x-6 sm:gap-y-10 lg:grid-cols-3";
  const card = (p: Project) => (
    <li key={p.id} className="relative">
      <ProjectCard p={p} state={state} onOpen={() => setUi((u) => ({ ...u, open: p.id }))} />
      <ProjectMenu p={p} update={update} onOpen={() => setUi((u) => ({ ...u, open: p.id }))} className="!absolute right-3 top-3 z-10" />
    </li>
  );
  return (
    <div className="space-y-5">
      <button className={BTN} onClick={() => setUi((u) => ({ ...u, adding: !u.adding }))} disabled={!state.recipes.length}>{ui.adding ? t("Abbrechen", "Cancel") : t("+ Neues Projekt", "+ New project")}</button>
      {ui.adding && <NewProject state={state} char={char} charKey={key} onDone={(p) => { if (p) update((s) => ({ ...s, projects: [...s.projects, p] })); setUi((u) => ({ ...u, adding: false, open: p?.id ?? u.open })); }} />}
      {!mine.length && !ui.adding && <p className="text-sm text-zinc-500">{t("Noch keine Projekte für diesen Charakter.", "No projects for this character yet.")}</p>}
      {current.length > 0 && <ul className={grid}>{current.map(card)}</ul>}
      {done.length > 0 && (
        <section className="space-y-3">
          <h2 className={LABEL}>{t("Fertig (Historie)", "Finished (history)")}</h2>
          <ul className={grid}>{done.map(card)}</ul>
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

/** Icon of an item, the faction of the project filled in for the lookup. */
const iconOf = (item: ItemRef | undefined, faction?: string) => (SHOW_ITEM_ICONS && item ? craftIcon({ ...item, faction: item.faction ?? factionOfName(item.name) ?? faction }) : undefined);
const factionOfName = (n: string) => n.match(/\((elyos|asmodian)\)\s*$/i)?.[1];

function ProjectCard({ p, state, onOpen }: { p: Project; state: CraftState; onOpen: () => void }) {
  const t = useT();
  const range = useRange();
  const target = projectTarget(p, state.recipes);
  const root = state.recipes.find((r) => r.recipeKey === p.targetRecipeKey);
  const pr = progress(p, state);
  const step = p.status === "done" ? null : nextStep(p, state);
  const cost = { low: openCost(p, state, "low"), high: openCost(p, state, "high") };
  const last = [...pr.milestones].reverse().find((m) => m.done);
  const from = last ? stageLevel(last) : null;
  const to = root ? levelOf(state, root) : null;
  const icon = iconOf(target, p.faction);
  return (
    <Card as="button" onClick={onOpen} label={`${target?.name ?? "?"}: ${pr.percent ?? "–"} %`} className={`flex h-full w-full flex-col gap-3 p-3 ${p.status !== "active" ? "opacity-70" : ""}`}>
      <div className="relative flex w-full items-center gap-3 pr-10">
        <div className="relative w-16 shrink-0">{icon ? <CardArt src={icon} alt={target!.name} /> : <Filler className="aspect-square w-full" />}</div>
        <div className="relative min-w-0">
          <div className="truncate text-sm font-semibold text-[#f4eed7]">{target?.name ?? t("Rezept fehlt", "Recipe missing")}</div>
          <div className="truncate text-xs text-zinc-400">{p.gearSlot ? gearSlotName(p.gearSlot === p.gearSlot.toLowerCase() && ["ring", "earrings", "necklace", "gloves", "chest", "legs", "helm", "shoulders", "boots", "cape"].includes(p.gearSlot) ? p.gearSlot : "weapon", t) : slotName(p.slot, t)} · {statusName(p.status, t)}</div>
          <div className="truncate text-[11px] text-zinc-500">{from !== null ? `Lv ${from}` : t("Start", "Start")} → {to !== null ? `Lv ${to}` : t("Ziel", "Goal")}</div>
        </div>
      </div>
      <div className="relative w-full space-y-1 text-[11px]">
        <div className="truncate text-zinc-400">{t("Aktueller Craft", "Current craft")}: <span className="text-[#efe6cc]/85">
          {p.status === "done" ? t("keiner (fertig)", "none (finished)") : step ? (step.goal === "combo" && step.recipe.comboOutput ? step.recipe.comboOutput.name : step.recipe.output.name) : pr.percent === 100 ? t("fertig", "done") : t("unbekannt", "unknown")}
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

/** Recipe gear slot for a project choice: weapon and off-hand follow what the character has equipped. */
function gearSlotFor(choice: string, char: Character): string | null {
  if (choice === "weapon") return weaponTypeOf(char.gear.find((i) => i.slot === "weapon")?.name);
  if (choice === "offhand") return weaponTypeOf(char.gear.find((i) => i.slot === "offhand")?.name);
  return choice;
}

/** New project: only what to craft. The target is always the highest stage of that line; the stock is entered in the project. */
function NewProject({ state, char, charKey: key, onDone }: { state: CraftState; char: Character; charKey: string; onDone: (p?: Project) => void }) {
  const t = useT();
  const faction = char.race ?? "";
  const [weaponPick, setWeaponPick] = useState("");
  const options = GEAR_SLOTS.map((choice) => {
    const gearSlot = (choice === "weapon" && weaponPick) || gearSlotFor(choice, char);
    const top = gearSlot ? topOf(state, faction, gearSlot) : undefined;
    return { choice, gearSlot, top };
  }).filter((o) => o.choice === "weapon" || o.top);
  const [pick, setPick] = useState<string>();
  const [mastery, setMastery] = useState("");
  const chosen = options.find((o) => o.choice === pick);
  const m = mastery.trim() === "" ? null : Number(mastery);
  const weaponTypes = [...new Set(state.recipes.filter((r) => craftSlotOf(r.slot) === "weapon").map((r) => r.slot!))].filter((g) => topOf(state, faction, g));
  return (
    <div className="card-face relative space-y-3 rounded-2xl px-4 py-3 text-sm">
      <div className={LABEL}>{t("Was willst du craften?", "What do you want to craft?")}</div>
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        {options.map((o) => {
          const icon = iconOf(o.top?.output, faction);
          const lv = o.top ? levelOf(state, o.top) : null;
          return (
            <li key={o.choice}>
              <button onClick={() => setPick(o.choice)} aria-pressed={pick === o.choice} disabled={!o.top}
                className={`flex w-full items-center gap-2 rounded-xl border px-2 py-2 text-left transition-colors disabled:opacity-50 ${pick === o.choice ? "border-[#d9c58f]/60 bg-white/[0.08]" : "border-white/10 bg-white/[0.02] hover:border-[#d9c58f]/35"}`}>
                <ItemIcon src={icon} />
                <span className="min-w-0">
                  <span className="block text-xs font-semibold text-[#f4eed7]">{gearSlotName(o.choice, t)}</span>
                  <span className="block truncate text-[11px] text-zinc-400">{o.top ? `${o.top.output.name}${lv ? ` · Lv ${lv}` : ""}` : t("Waffentyp wählen", "Pick weapon type")}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {(pick === "weapon" || !gearSlotFor("weapon", char)) && (
        <label className="flex flex-wrap items-center gap-2 text-xs text-zinc-400">{t("Waffentyp", "Weapon type")}
          <select className={INPUT} value={weaponPick} onChange={(e) => setWeaponPick(e.target.value)}>
            <option value="">{gearSlotFor("weapon", char) ? `${gearSlotFor("weapon", char)} (${t("ausgerüstet", "equipped")})` : t("bitte wählen", "please pick")}</option>
            {weaponTypes.map((g) => <option key={g} value={g}>{g}</option>)}
          </select>
        </label>
      )}
      {chosen?.top && (
        <div className="flex flex-wrap items-end gap-3 border-t border-white/5 pt-3">
          <div className="min-w-0 flex-1">
            <div className={LABEL}>{t("Ziel (immer die höchste Stufe)", "Goal (always the highest stage)")}</div>
            <div className="text-[#f4eed7]">{chosen.top.output.name}{levelOf(state, chosen.top) ? <span className="text-zinc-500"> · Lv {levelOf(state, chosen.top)}</span> : ""}</div>
          </div>
          <label className="grid gap-1"><span className={LABEL}>{t("Deine Handwerksstufe", "Your crafting level")}</span>
            <input className={`${INPUT} w-32`} inputMode="numeric" value={mastery} onChange={(e) => setMastery(e.target.value)} placeholder={t("unbekannt", "unknown")} /></label>
          <button className={BTN} disabled={m !== null && !Number.isFinite(m)} onClick={() => onDone({
            id: uid(), charKey: key, character: char.name, faction, server: char.server, className: char.className,
            slot: prioritySlot(chosen.gearSlot!), gearSlot: chosen.gearSlot!, mastery: m, profession: chosen.top!.profession,
            targetRecipeKey: chosen.top!.recipeKey, goal: "normal", status: "active", createdAt: new Date().toISOString(), owned: [],
          })}>{t("Projekt starten", "Start project")}</button>
        </div>
      )}
    </div>
  );
}

type DetailTab = "next" | "stock" | "log";

function ProjectDetail({ p, state, update, char, onBack, onPrice }: { p: Project; state: CraftState; update: Update; char: Character; onBack: () => void; onPrice: (x: PriceTarget) => void }) {
  const t = useT();
  const range = useRange();
  const target = projectTarget(p, state.recipes);
  const pr = progress(p, state);
  const money = spent(p, state.events);
  const step = p.status === "active" ? nextStep(p, state) : null;
  const [tab, setTab] = useState<DetailTab>("next");
  const set = (patch: Partial<Project>) => update((s) => ({ ...s, projects: s.projects.map((x) => (x.id === p.id ? { ...x, ...patch } : x)) }));
  const tabs = [["next", "Next Steps"], ["stock", t("Ist-Stand & Inventar", "Stock & inventory")], ["log", t("Protokoll", "Log")]] as const;
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="shrink-0 rounded-full border border-[#d9c58f]/20 bg-white/[0.03] px-3.5 py-1.5 text-sm text-[#efe6cc]/85 hover:border-[#d9c58f]/40">‹ {t("Projekte", "Projects")}</button>
        <h2 className="min-w-0 flex-1 text-base font-semibold leading-tight tracking-tight text-[#f4eed7] sm:truncate sm:text-xl">{target?.name ?? t("Rezept fehlt", "Recipe missing")}</h2>
        <input className={`${INPUT} w-28 text-xs`} inputMode="numeric" title={t("Deine Handwerksstufe", "Your crafting level")} aria-label={t("Deine Handwerksstufe", "Your crafting level")}
          placeholder={t("Stufe ?", "Level ?")} value={p.mastery ?? ""} onChange={(e) => set({ mastery: e.target.value === "" ? null : Number(e.target.value) })} />
        <ProjectMenu p={p} update={(fn) => { update(fn); }} />
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-400">
        <span>{statusName(p.status, t)} · {p.server}{p.faction ? ` · ${p.faction}` : ""}{p.className ? ` · ${p.className}` : ""}</span>
        <span>{t("Bisher ausgegeben", "Spent so far")}: {range(money.low, money.high) ?? "0 Kinah"}{money.unknown > 0 && <span className={MISSING}> · {money.unknown} {t("Versuche ohne Preis", "attempts without price")}</span>}</span>
        <span className="min-w-[12rem] flex-1"><Progress percent={pr.percent} done={pr.done} total={pr.total} /></span>
      </div>

      {p.status === "paused" && <p className="text-xs text-zinc-500">{t("Pausiert. Über ⋯ fortsetzen.", "Paused. Resume via ⋯.")}</p>}
      {step ? <CurrentCraft s={step} state={state} onLog={(o) => update((st) => logAttempt(st, step, o))} onPrice={onPrice} />
        : p.status === "active" && pr.percent !== 100 && <p className={`text-sm ${MISSING}`}>{t("Kein nächster Craft bestimmbar: Zutaten dieser Linie fehlen noch in den Daten.", "No next craft: the ingredients of this line are still missing in the data.")}</p>}

      <div role="tablist" className="grid grid-cols-3 rounded-xl border border-[#d9c58f]/25 bg-white/[0.03] p-1 text-xs sm:text-sm">
        {tabs.map(([k, l]) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
            className={`rounded-lg px-2 py-1.5 transition-colors ${tab === k ? "bg-white/[0.09] text-[#f4eed7] ring-1 ring-[#d9c58f]/40" : "text-zinc-500 hover:text-zinc-300"}`}>{l}</button>
        ))}
      </div>
      {tab === "next" && <NextStepsPanel p={p} state={state} />}
      {tab === "stock" && <StockPanel p={p} state={state} update={update} char={char} onPrice={onPrice} />}
      {tab === "log" && <LogPanel p={p} state={state} update={update} />}
    </div>
  );
}

/** One material tile of the current craft: icon, name, have / need, price. */
function MaterialTile({ i, p, state, stepKey, onPrice }: { i: NextStep["ingredients"][number]; p: Project; state: CraftState; stepKey: string; onPrice: (x: PriceTarget) => void }) {
  const t = useT();
  const ok = i.qty !== null && i.have >= i.qty;
  const own = i.crafted || (i.kind === "transfer" && canCraft(p, i, state.recipes));
  return (
    <li className="flex items-center gap-2 rounded-xl bg-white/[0.03] px-2 py-1.5 ring-1 ring-white/5">
      <ItemIcon src={iconOf(i, p.faction)} rarity={rarityOf(i.name)} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-xs text-[#efe6cc]/90">{i.name}</div>
        <div className="text-[11px]">
          <span className={ok ? "text-[#5fbf8a]" : "text-[#ff6b6b]"}>{i.have} / {i.qty ?? "?"}</span>
          {i.crafted && <span className="text-zinc-500"> · {t("Zwischenstufe", "intermediate")}</span>}
          {i.kind === "transfer" && <span className="text-zinc-500"> · Transfer</span>}
          {i.alternatives?.map((a) => <span key={a.itemId ?? a.name} className="text-zinc-500"> · {t("oder", "or")} {a.name}{a.unverified ? ` (${t("unbestätigt", "unconfirmed")})` : ""}</span>)}
        </div>
        {!own && <div className="mt-0.5"><PriceCell item={i} ctxProject={p} stepKey={stepKey} state={state} compact onEdit={() => onPrice({ item: i, server: p.server, project: p, stepKey })} /></div>}
      </div>
    </li>
  );
}

/** The craft to do now: big item picture in the middle, materials left and right, chances and the result buttons. */
function CurrentCraft({ s, state, onLog, onPrice }: { s: NextStep; state: CraftState; onLog: (o: Outcome) => void; onPrice: (x: PriceTarget) => void }) {
  const t = useT();
  const range = useRange();
  const want = s.goal === "combo" && s.recipe.comboOutput ? s.recipe.comboOutput : s.recipe.output;
  const icon = iconOf(want, s.project.faction);
  const free = (i: ItemRef) => !!craftsItself(s.project, i, state.recipes) || ((i as { kind?: string }).kind === "transfer" && !!producerOf(i, state.recipes, s.project.faction));
  const ctx = ctxOf(state, s.project, s.recipe.recipeKey);
  const next = { low: attemptCost(s.recipe, ctx, "low", free), high: attemptCost(s.recipe, ctx, "high", free) };
  const pActual = s.chance.actual ? effectiveChance(s.chance.actual, s.goal) : null;
  const plan = s.plan.p !== null ? s.plan : s.documentedPlan.p !== null ? s.documentedPlan : s.bestPlan;
  const planBasis = s.plan.p !== null ? t("bei deiner Stufe", "at your level") : s.documentedPlan.p !== null ? `${t("bei Mindeststufe", "at required level")} ${s.chance.documentedMastery ?? "?"}` : t("bei bester dok. Stufe", "at best documented level");
  const half = Math.ceil(s.ingredients.length / 2);
  const lv = stageLevel(s);
  const unconfirmed = s.ingredients.length > 0 && s.recipe.ingredientsStatus !== undefined && s.recipe.ingredientsStatus !== "complete";
  return (
    <Card className="p-4 text-sm">
      <div className="relative mb-3 flex flex-wrap items-baseline gap-2">
        <span className={LABEL}>{t("Aktueller Craft", "Current craft")}</span>
        {unconfirmed && <span className={`text-[11px] ${MISSING}`}>{t("Zutatenliste unbestätigt, Kosten vorläufig", "ingredient list unconfirmed, cost provisional")}</span>}
        {s.recipe.liveUnconfirmed && <span className="text-[11px] text-zinc-500">{t("Global-Clientdaten, nicht live bestätigt", "Global client data, not confirmed live")}{s.recipe.source && <> · <a className="underline hover:text-zinc-300" href={s.recipe.source} target="_blank" rel="noreferrer">{t("Quelle", "Source")}</a></>}</span>}
      </div>
      <div className="relative grid gap-3 md:grid-cols-[1fr_minmax(0,14rem)_1fr] md:items-center">
        <ul className="order-2 space-y-1.5 md:order-1">{s.ingredients.slice(0, half).map((i) => <MaterialTile key={`${i.kind}:${itemKey(i)}`} i={i} p={s.project} state={state} stepKey={s.recipe.recipeKey} onPrice={onPrice} />)}</ul>
        <div className="order-1 text-center md:order-2">
          <div className="mx-auto w-28 sm:w-36">{icon ? <CardArt src={icon} alt={want.name} /> : <Filler className="aspect-square w-full" />}</div>
          <div className="mt-2 font-semibold text-[#f4eed7]">{want.name}</div>
          <div className="text-xs text-zinc-400">{lv ? `Lv ${lv}` : ""}{s.goal === "combo" ? " · Combo" : ""}</div>
          <div className="mt-1 text-xs text-zinc-300">
            {t("Chance", "Chance")}: {pct(plan.p) ?? <span className={MISSING}>{t("unbekannt", "unknown")}</span>} <span className="text-zinc-500">({planBasis})</span>
          </div>
          {plan.p !== null && <div className="text-xs text-zinc-400">Ø {plan.expected !== null && Number.isFinite(plan.expected) ? plan.expected.toFixed(1) : "∞"} · 80 %: <b className="text-[#f4eed7]">{plan.n80 !== null && Number.isFinite(plan.n80) ? plan.n80 : "∞"}</b> {t("Versuche", "attempts")}</div>}
          {pActual === null && <div className="text-[11px] text-zinc-500">{t("Trag deine Handwerksstufe ein, wenn du die Chance im Spiel siehst.", "Enter your crafting level once you see the chance in game.")}</div>}
          <div className="mt-1 text-xs text-zinc-400">{t("Ein Versuch", "One attempt")}: {next.low.cost !== null ? range(next.low.cost, next.high.cost) : <span className={MISSING}>{t("Preise fehlen", "prices missing")}</span>}</div>
        </div>
        <ul className="order-3 space-y-1.5">{s.ingredients.slice(half).map((i) => <MaterialTile key={`${i.kind}:${itemKey(i)}`} i={i} p={s.project} state={state} stepKey={s.recipe.recipeKey} onPrice={onPrice} />)}</ul>
        {!s.ingredients.length && <p className={`order-3 md:col-span-3 ${MISSING}`}>{t("Zutaten nicht dokumentiert (Datenlücke)", "Ingredients not documented (data gap)")}</p>}
      </div>
      <div className="relative mt-3 flex flex-wrap justify-center gap-1.5">
        <span className={`${LABEL} self-center`}>{t("Ergebnis im Spiel", "Result in game")}:</span>
        {s.outcomes.map((o) => <button key={o} className={BTN} onClick={() => onLog(o)}>{outcomeName(o, t)}</button>)}
      </div>
    </Card>
  );
}

/** What is still to craft, lowest stage first, with Ø and 80 % attempts; then the recommendation and the whole-goal budget. */
function NextStepsPanel({ p, state }: { p: Project; state: CraftState }) {
  const t = useT();
  const lines = needList(p, state);
  const basisName = (b: NeedLine["basis"]) => ({ character: t("deine Stufe", "your level"), required: t("Mindeststufe", "required level"), fixed: t("garantiert", "guaranteed"), best: t("beste dok. Stufe", "best documented level"), none: "" })[b];
  const fmt = (n: number | null) => (n === null ? "?" : !Number.isFinite(n) ? "∞" : Number.isInteger(n) ? String(n) : n.toFixed(1));
  const first = lines[0];
  return (
    <div className="space-y-3">
      {first && (
        <p className="text-sm text-[#efe6cc]/90">
          {t("Als Nächstes", "Next")}: <b className="text-[#f4eed7]">{first.item.name}</b>{first.count > 1 ? ` (${t("noch", "still")} ${first.count}×)` : ""}.
          {" "}{t("Von unten nach oben brauchst du noch:", "From the bottom up you still need:")}
        </p>
      )}
      <ol className="space-y-1.5">
        {lines.map((l) => {
          const lv = stageLevel(l);
          return (
            <li key={`${l.recipe.recipeKey}:${l.goal}`} className="card-face relative flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl px-3 py-2 text-xs">
              <ItemIcon src={iconOf(l.item, p.faction)} />
              <span className="min-w-0 text-sm text-[#efe6cc]/90">{l.item.name}</span>
              <span className="text-zinc-500">{lv ? `Lv ${lv}` : ""}{l.goal === "combo" ? " · Combo" : ""}</span>
              {!l.ingredientsKnown && <span className={MISSING}>{l.recipe.ingredients.length ? t("Zutaten unbestätigt", "ingredients unconfirmed") : t("Zutaten fehlen", "ingredients missing")}</span>}
              <span className="ml-auto flex flex-wrap items-center gap-3 text-zinc-300">
                <span>{t("noch", "still")} <b className="text-[#f4eed7]">{l.count}×</b></span>
                <span>{t("Chance", "Chance")} {pct(l.p) ?? <span className={MISSING}>?</span>}{l.basis !== "none" && <span className="text-zinc-500"> ({basisName(l.basis)})</span>}</span>
                <span>Ø <b className="text-[#f4eed7]">{fmt(l.expected)}</b></span>
                <span>80 %: <b className="text-[#f4eed7]">{fmt(l.n80)}</b> {t("Versuche", "attempts")}</span>
              </span>
            </li>
          );
        })}
        {!lines.length && <li className="text-sm text-zinc-500">{progress(p, state).percent === 100 ? t("Alles da, Projekt fertig.", "Everything there, project finished.") : t("Pfad unbekannt: Zutaten fehlen in den Daten.", "Path unknown: ingredients missing in the data.")}</li>}
      </ol>
      <p className="text-[11px] text-zinc-500">{t("Ø = Mittelwert der Versuche. 80 % = so viele Versuche reichen in 8 von 10 Fällen für alle benötigten Erfolge dieser Stufe. Gilt pro Stufe, nicht als Garantie für die ganze Kette.",
        "Ø = average attempts. 80 % = this many attempts are enough for all needed successes of this stage in 8 of 10 cases. Per stage, not a guarantee for the whole chain.")}</p>
      {p.status !== "done" && <ProjectBudget p={p} state={state} />}
    </div>
  );
}

/** Starting stock of the gear line (how many of each stage you already have) and the materials with stock and price. */
function StockPanel({ p, state, update, char, onPrice }: { p: Project; state: CraftState; update: Update; char: Character; onPrice: (x: PriceTarget) => void }) {
  const t = useT();
  const gearSlot = p.gearSlot ?? state.recipes.find((r) => r.recipeKey === p.targetRecipeKey)?.slot ?? "";
  const items = ladderItems(state, p.faction, gearSlot);
  const setCount = (item: ItemRef, n: number) => update((s) => ({ ...s, projects: s.projects.map((x) => (x.id === p.id ? withOwnedCount(x, item, n) : x)) }));
  const mats = useMemo(() => {
    const out = new Map<string, { item: ItemRef & { bound?: boolean | null }; crafted: boolean; craftable: boolean }>();
    for (const { recipe } of remainingPath(p, state)) for (const i of recipe.ingredients) {
      if (i.kind === "transfer") continue;
      const k = itemKey(i);
      if (!out.has(k)) out.set(k, { item: i, crafted: !!craftsItself(p, i, state.recipes), craftable: canCraft(p, i, state.recipes) });
    }
    return [...out.values()].filter((m) => !m.crafted || !items.some((x) => sameItemRef(x.item, m.item)));
  }, [p, state, items]);
  const toggleBuy = (item: ItemRef, craft: boolean) => {
    const k = itemKey(item);
    update((s) => ({ ...s, projects: s.projects.map((x) => (x.id === p.id ? { ...x, buy: (x.buy ?? []).filter((y) => y !== k).concat(craft ? [] : [k]), craft: (x.craft ?? []).filter((y) => y !== k).concat(craft ? [k] : []) } : x)) }));
  };
  const setStock = (item: ItemRef, v: string) => update((s) => { const inv = { ...s.inventory }; if (v === "") delete inv[itemKey(item)]; else inv[itemKey(item)] = Number(v); return { ...s, inventory: inv }; });
  return (
    <div className="space-y-4">
      <section className="space-y-2">
        <div className={LABEL}>{t("Was hast du von dieser Linie schon?", "What do you already have of this line?")}</div>
        <ul className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((x) => (
            <li key={itemKey(x.item)} className="card-face relative flex items-center gap-2 rounded-xl px-2 py-1.5 text-xs">
              <ItemIcon src={iconOf(x.item, p.faction)} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[#efe6cc]/90">{x.item.name}</div>
                <div className="text-[11px] text-zinc-500">{x.level ? `Lv ${x.level}` : ""}{x.combo ? " · Combo" : ""}</div>
              </div>
              <Stepper value={ownedCount(p, x.item)} onChange={(n) => setCount(x.item, n)} label={x.item.name} />
            </li>
          ))}
          {!items.length && <li className="text-sm text-zinc-500">{t("Für diese Linie gibt es noch keine Stufenliste.", "No stage list for this line yet.")}</li>}
        </ul>
        <p className="text-[11px] text-zinc-500">{t("Gecraftete und hier eingetragene Teile zählen beide. Was später noch zusätzlich gebraucht wird (z. B. Lv44-Basen), bleibt im Bedarf.", "Crafted items and items entered here both count. What later stages need on top (e.g. Lv44 bases) stays in the need list.")}</p>
      </section>
      <section className="space-y-2">
        <div className={LABEL}>{t("Materialien (Bestand gilt für alle Projekte)", "Materials (stock is shared by all projects)")}</div>
        <ul className="grid gap-1.5 lg:grid-cols-2">
          {mats.map((m) => (
            <li key={itemKey(m.item)} className="card-face relative flex flex-wrap items-center gap-2 rounded-xl px-2 py-1.5 text-xs" style={rarityEdge(m.item.name)}>
              <ItemIcon src={iconOf(m.item, p.faction)} rarity={rarityOf(m.item.name)} />
              <span className="min-w-0 flex-1 truncate text-[#efe6cc]/90">{m.item.name}
                {m.craftable && <button className="ml-2 text-[11px] text-zinc-500 underline hover:text-zinc-300" onClick={() => toggleBuy(m.item, !m.crafted)}>{m.crafted ? t("selbst craften · lieber kaufen", "craft myself · buy instead") : t("kaufen · selbst craften", "buy · craft myself")}</button>}
              </span>
              {!m.crafted && <label className="flex items-center gap-1 text-zinc-500">{t("Bestand", "Stock")}
                <input className={`${INPUT} w-16 text-right text-xs`} inputMode="numeric" value={state.inventory[itemKey(m.item)] ?? ""} placeholder="–" onChange={(e) => setStock(m.item, e.target.value.replace(/\D/g, ""))} /></label>}
              {!m.crafted && <PriceCell item={m.item} ctxProject={p} state={state} compact onEdit={() => onPrice({ item: m.item, server: p.server, project: p })} />}
            </li>
          ))}
          {!mats.length && <li className="text-sm text-zinc-500">{t("Keine Materialliste: Zutaten fehlen in den Daten.", "No material list: ingredients missing in the data.")}</li>}
        </ul>
      </section>
      <p className="text-[11px] text-zinc-500">{char.server} · {t("Preise und Bestand sind für deinen Server.", "Prices and stock are for your server.")}</p>
    </div>
  );
}

const sameItemRef = (a: ItemRef, b: ItemRef) => itemKey(a) === itemKey(b) || (normName(a.name) === normName(b.name));

/** − n + stepper for a count. */
function Stepper({ value, onChange, label }: { value: number; onChange: (n: number) => void; label: string }) {
  const b = "h-7 w-7 rounded-md border border-[#d9c58f]/20 bg-white/[0.04] text-[#efe6cc] hover:border-[#d9c58f]/45 disabled:opacity-40";
  return (
    <span className="flex items-center gap-1">
      <button className={b} aria-label={`${label} −1`} disabled={value <= 0} onClick={() => onChange(value - 1)}>−</button>
      <input className={`${INPUT} w-12 px-1 text-center text-xs`} inputMode="numeric" aria-label={label} value={value} onChange={(e) => onChange(Number(e.target.value.replace(/\D/g, "") || 0))} />
      <button className={b} aria-label={`${label} +1`} onClick={() => onChange(value + 1)}>+</button>
    </span>
  );
}

function LogPanel({ p, state, update }: { p: Project; state: CraftState; update: Update }) {
  const t = useT();
  const range = useRange();
  const history = activeAttempts(state.events).filter((e) => e.projectId === p.id).reverse();
  return (
    <section className="card-face relative space-y-2 rounded-2xl px-4 py-3 text-sm">
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
      <p className="text-[11px] text-zinc-500">{t("Die Kosten stehen so, wie die Preise beim Eintragen waren. Spätere Preisänderungen ändern sie nicht.", "Costs stay as the prices were when logged. Later price changes do not change them.")}</p>
    </section>
  );
}


/** Price of an item as used in a project (or for a server), with the edit button. */
function PriceCell({ item, ctxProject, server, stepKey, state, onEdit, hide, compact }: {
  item: ItemRef & { bound?: boolean | null }; ctxProject?: Project; server?: string; stepKey?: string; state: CraftState; onEdit: () => void; hide?: boolean; compact?: boolean;
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
        : <span className={MISSING}>{compact ? t("kein Preis", "no price") : t("Kein Preis hinterlegt", "No price saved")}</span>}
      {item.bound === true && <span className="text-zinc-500">· {t("gebunden", "bound")}</span>}
      {compact
        ? <button className="text-[11px] text-zinc-400 underline hover:text-zinc-200" onClick={onEdit}>{p ? t("ändern", "edit") : t("eingeben", "enter")}</button>
        : <button className={BTN} onClick={onEdit}>{p ? t("Bearbeiten", "Edit") : t("Preis eingeben", "Enter price")}</button>}
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

/* ------------------------------------------------------------------ attempts ------------------------------------------------------------------ */

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
      {label} <span className="text-zinc-500">{n}</span>
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
            head && <li key={`h-${head}`} className={`${LABEL} pt-2`}>{names[head]}</li>,
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
    <li className="card-face relative flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl py-1.5 pl-2 pr-3 text-xs" style={e.area === "materials" ? rarityEdge(e.name) : undefined}>
      <ItemIcon src={icon} rarity={e.area === "materials" ? rarityOf(e.name) : undefined} />
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

/** Market rarity by name prefix, as in the Aion 2 market: plain grey, Fine green, Pure blue, Radiant gold. */
export type Rarity = "normal" | "fine" | "pure" | "radiant";
const RARITY_COLOR: Record<Rarity, string> = { normal: "#9aa0a8", fine: "#5fc46a", pure: "#4f9dff", radiant: "#e9b949" };
function rarityOf(name: string): Rarity {
  const m = name.trim().match(/^(fine|pure|radiant)\b/i);
  return m ? (m[1].toLowerCase() as Rarity) : "normal";
}
/** Left edge in the rarity colour. */
const rarityEdge = (name: string) => ({ boxShadow: `inset 3px 0 0 ${RARITY_COLOR[rarityOf(name)]}` });

/** Small item icon; with a rarity the frame takes its colour. An empty frame while the original icon is missing. */
function ItemIcon({ src, color, rarity, size = "h-8 w-8" }: { src?: string; color?: string; rarity?: Rarity; size?: string }) {
  const [failed, setFailed] = useState<string>();
  const tint = rarity ? RARITY_COLOR[rarity] : color;
  return (
    <span aria-hidden className={`relative ${size} shrink-0 overflow-hidden rounded-md bg-[radial-gradient(circle_at_50%_40%,#1f3a66_0%,#111a2b_60%,#0a0d14_100%)] ring-1 ring-white/10`}
      style={rarity ? { boxShadow: `0 0 0 1px ${tint}88` } : undefined}>
      {src && failed !== src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" loading="lazy" referrerPolicy="no-referrer" className="h-full w-full object-contain p-[2px]" onError={() => setFailed(src)} />
      ) : <span className="absolute inset-[30%] rounded-full opacity-50" style={{ background: tint ?? "#d9c58f55" }} />}
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

