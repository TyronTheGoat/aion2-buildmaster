"use client";
import { itemName } from "@/lib/item-names";
import { useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";
import type { Character } from "@/lib/types";
import { numberLocale, useLang, useT, type T } from "@/lib/i18n";
import { craftIcon } from "@/lib/crafting/craft-icons";
import { GEAR_GROUPS, MATERIAL_GROUPS, entriesFor, type GearGroup, type MaterialGroup, type PriceArea, type PriceGroup } from "@/lib/crafting/catalog-groups";
import { charKey } from "../store";
import { useCraft } from "../craft-store";
import { uploadIconPack, useCloud } from "../cloud";
import { Card, CardArt, Filler, SHOW_ITEM_ICONS } from "../deck/Card";
import {
  activeAttempts, attemptCost, attemptEffects, buildCatalog, canCraft, craftSlotOf, craftsItself, ctxOf, findPrice, importFile,
  GEAR_SLOTS, PLAN_CONFIDENCE, craftPlan, currentCraft, itemKey, ladderItems, levelOf, normName, ownedCount, planCost, prioritySlot, missingRoutePrices, routeItems, routeOf, routeOptions, sameItem, topOf, weaponTypeOf, withOwnedCount, withRoute, producerOf, progress, projectTarget, savePrice, sortProjects,
  spent, stageLevel, uid, validatePrice,
  type CatalogEntry, type CraftSlot, type CraftState, type ImportError, type ItemRef, type NextStep, type PlanLine, type Outcome, type Project, type Scenario,
} from "@/lib/crafting/model";

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
  const online = useCloud().mode === "online";
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
          {online && <IconPackButton />}
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
        {" · "}{online ? t("Marktpreise sind für alle Accounts gemeinsam: was du änderst, sehen alle sofort.", "Market prices are shared by all accounts: what you change, everyone sees at once.") : t("Preise trägst nur du ein.", "Only you enter prices.")}
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
  const target = projectTarget(p, state.recipes);
  const root = state.recipes.find((r) => r.recipeKey === p.targetRecipeKey);
  const pr = progress(p, state);
  const cur = p.status === "done" || p.setup ? null : currentCraft(p, state);
  const step = cur?.step;
  const cost = cur ? planCost(cur.plan, ctxOf(state, p), "ref") : null;
  const kinah = useKinah();
  const last = [...pr.milestones].reverse().find((m) => m.done);
  const from = last ? stageLevel(last) : null;
  const to = root ? levelOf(state, root) : null;
  const icon = iconOf(target, p.faction);
  return (
    <Card as="button" onClick={onOpen} label={`${target?.name ?? "?"}: ${pr.percent ?? "–"} %`} className={`flex h-full w-full flex-col gap-3 p-3 ${p.status !== "active" ? "opacity-70" : ""}`}>
      <div className="relative flex w-full items-center gap-3 pr-10">
        <div className="relative w-16 shrink-0">{icon ? <CardArt src={icon} alt={target!.name} /> : <Filler className="aspect-square w-full" />}</div>
        <div className="relative min-w-0">
          <div className="truncate text-sm font-semibold text-[#f4eed7]">{target ? shown(target.name) : t("Rezept fehlt", "Recipe missing")}</div>
          <div className="truncate text-xs text-zinc-400">{p.gearSlot ? gearSlotName(p.gearSlot === p.gearSlot.toLowerCase() && ["ring", "earrings", "necklace", "gloves", "chest", "legs", "helm", "shoulders", "boots", "cape"].includes(p.gearSlot) ? p.gearSlot : "weapon", t) : slotName(p.slot, t)} · {statusName(p.status, t)}</div>
          <div className="truncate text-[11px] text-zinc-500">{from !== null ? `Lv ${from}` : t("Start", "Start")} → {to !== null ? `Lv ${to}` : t("Ziel", "Goal")}</div>
        </div>
      </div>
      <div className="relative w-full space-y-1 text-[11px]">
        <div className="truncate text-zinc-400">{t("Aktueller Craft", "Current craft")}: <span className="text-[#efe6cc]/85">
          {p.status === "done" ? t("keiner (fertig)", "none (finished)") : p.setup ? t("Einrichtung offen", "setup open") : step ? `${shown(step.goal === "combo" && step.recipe.comboOutput ? step.recipe.comboOutput.name : step.recipe.output.name)}${cur?.line ? ` · ${t("noch", "still")} ${cur.line.missing}×` : ""}` : pr.percent === 100 ? t("fertig", "done") : t("unbekannt", "unknown")}
        </span></div>
        {cost && (
          <div className="truncate text-zinc-500">{t("Noch zu kaufen", "Still to buy")}: {cost.cost !== null
            ? <span className="text-[#efe6cc]/85">{kinah(cost.cost)}</span>
            : <span className={MISSING}>{t("Preise fehlen", "prices missing")}{cost.known > 0 ? ` (${t("bekannt", "known")} ${kinah(cost.known)})` : ""}</span>}</div>
        )}
      </div>
      <div className="relative w-full"><Progress percent={pr.percent} done={pr.done} total={pr.total} /></div>
    </Card>
  );
}

/** Equipment slot of the character for each project choice. */
const WORN_SLOT: Record<string, string> = { weapon: "weapon", offhand: "offhand", ring: "ring", earrings: "earring", necklace: "necklace", gloves: "gloves", chest: "torso", legs: "pants", helm: "helmet", shoulders: "shoulders", boots: "boots", cape: "cape" };

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
          // the target's own icon; while it is missing, the item the character wears in that slot stands for the slot
          const worn = SHOW_ITEM_ICONS ? char.gear.find((g) => g.slot === WORN_SLOT[o.choice])?.icon : undefined;
          const icon = iconOf(o.top?.output, faction) ?? worn;
          const lv = o.top ? levelOf(state, o.top) : null;
          return (
            <li key={o.choice}>
              <button onClick={() => setPick(o.choice)} aria-pressed={pick === o.choice} disabled={!o.top}
                className={`flex w-full items-center gap-2 rounded-xl border px-2 py-2 text-left transition-colors disabled:opacity-50 ${pick === o.choice ? "border-[#d9c58f]/60 bg-white/[0.08]" : "border-white/10 bg-white/[0.02] hover:border-[#d9c58f]/35"}`}>
                <ItemIcon src={icon} />
                <span className="min-w-0">
                  <span className="block text-xs font-semibold text-[#f4eed7]">{gearSlotName(o.choice, t)}</span>
                  <span className="block truncate text-[11px] text-zinc-400">{o.top ? `${shown(o.top.output.name)}${lv ? ` · Lv ${lv}` : ""}` : t("Waffentyp wählen", "Pick weapon type")}</span>
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
            <div className="text-[#f4eed7]">{shown(chosen.top.output.name)}{levelOf(state, chosen.top) ? <span className="text-zinc-500"> · Lv {levelOf(state, chosen.top)}</span> : ""}</div>
          </div>
          <label className="grid gap-1"><span className={LABEL}>{t("Deine Handwerksstufe", "Your crafting level")}</span>
            <input className={`${INPUT} w-32`} inputMode="numeric" value={mastery} onChange={(e) => setMastery(e.target.value)} placeholder={t("unbekannt", "unknown")} /></label>
          <button className={BTN} disabled={m !== null && !Number.isFinite(m)} onClick={() => onDone({
            id: uid(), charKey: key, character: char.name, faction, server: char.server, className: char.className,
            slot: prioritySlot(chosen.gearSlot!), gearSlot: chosen.gearSlot!, mastery: m, profession: chosen.top!.profession,
            targetRecipeKey: chosen.top!.recipeKey, goal: "normal", status: "active", createdAt: new Date().toISOString(), owned: [], setup: "stock", confidence: PLAN_CONFIDENCE,
          })}>{t("Projekt starten", "Start project")}</button>
        </div>
      )}
    </div>
  );
}

/** Name without the faction tag: the project already knows the faction. */
const shown = (n: string) => itemName(n.replace(/\s*\((elyos|asmodian)\)\s*$/i, ""));

function ProjectDetail({ p, state, update, char, onBack, onPrice }: { p: Project; state: CraftState; update: Update; char: Character; onBack: () => void; onPrice: (x: PriceTarget) => void }) {
  const t = useT();
  const range = useRange();
  const kinah = useKinah();
  const target = projectTarget(p, state.recipes);
  const pr = progress(p, state);
  const money = spent(p, state.events);
  const set = (patch: Partial<Project>) => update((s) => ({ ...s, projects: s.projects.map((x) => (x.id === p.id ? { ...x, ...patch } : x)) }));
  const header = (
    <div className="flex items-center gap-3">
      <button onClick={onBack} className="shrink-0 rounded-full border border-[#d9c58f]/20 bg-white/[0.03] px-3.5 py-1.5 text-sm text-[#efe6cc]/85 hover:border-[#d9c58f]/40">‹ {t("Projekte", "Projects")}</button>
      <h2 className="min-w-0 flex-1 text-base font-semibold leading-tight tracking-tight text-[#f4eed7] sm:truncate sm:text-xl">{target ? shown(target.name) : t("Rezept fehlt", "Recipe missing")}</h2>
      <input className={`${INPUT} w-28 text-xs`} inputMode="numeric" title={t("Deine Handwerksstufe", "Your crafting level")} aria-label={t("Deine Handwerksstufe", "Your crafting level")}
        placeholder={t("Stufe ?", "Level ?")} value={p.mastery ?? ""} onChange={(e) => set({ mastery: e.target.value === "" ? null : Number(e.target.value) })} />
      <ProjectMenu p={p} update={update} />
    </div>
  );
  if (p.setup) return <div className="space-y-4">{header}<Setup p={p} state={state} update={update} char={char} /></div>;

  const { plan, line, step } = currentCraft(p, state);
  const cost = planCost(plan, ctxOf(state, p), "ref");
  const conf = Math.round((p.confidence ?? PLAN_CONFIDENCE) * 100);
  return (
    <div className="space-y-4">
      {header}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-400">
        <span>{statusName(p.status, t)} · {p.server}{p.className ? ` · ${p.className}` : ""}</span>
        <span>{t("Bisher ausgegeben", "Spent so far")}: {range(money.low, money.high) ?? "0 Kinah"}{money.unknown > 0 && <span className={MISSING}> · {money.unknown} {t("Versuche ohne Preis", "attempts without price")}</span>}</span>
        <span>{t("Noch zu kaufen", "Still to buy")} ({conf} %): {cost.cost !== null ? <b className="text-[#f4eed7]">{kinah(cost.cost)}</b> : <span className={MISSING}>{t("Preise fehlen", "prices missing")}{cost.known > 0 ? ` (${t("bekannt", "known")} ${kinah(cost.known)})` : ""}</span>}</span>
        <span className="min-w-[12rem] flex-1"><Progress percent={pr.percent} done={pr.done} total={pr.total} /></span>
      </div>
      {p.status === "paused" && <p className="text-xs text-zinc-500">{t("Pausiert. Über ⋯ fortsetzen.", "Paused. Resume via ⋯.")}</p>}

      {p.buyFinal ? (
        <Card className="p-4 text-center text-sm">
          <div className="relative space-y-2">
            <div className={LABEL}>{t("Dein Weg", "Your route")}</div>
            <div className="text-[#f4eed7]">{t("Endwaffe direkt im Markt kaufen", "Buy the final item on the market")}: <b>{target ? shown(target.name) : "?"}</b></div>
            <button className={BTN} onClick={() => update((s) => ({ ...s, projects: s.projects.map((x) => (x.id === p.id ? { ...x, status: "done", owned: target ? [...x.owned, target] : x.owned } : x)) }))}>{t("Gekauft, Projekt fertig", "Bought, project finished")}</button>
          </div>
        </Card>
      ) : step && line && p.status === "active" ? (
        <CurrentCraft s={step} line={line} conf={conf} state={state} onLog={(o) => update((st) => logAttempt(st, step, o))} onPrice={onPrice} />
      ) : p.status === "active" && pr.percent !== 100 && (
        <p className={`text-sm ${MISSING}`}>{plan.unknown.length ? `${t("Kein nächster Craft bestimmbar", "No next craft")}: ${plan.unknown.slice(0, 3).join(" · ")}` : t("Kein nächster Craft bestimmbar: Zutaten dieser Linie fehlen noch in den Daten.", "No next craft: the ingredients of this line are still missing in the data.")}</p>
      )}

      <div className="flex flex-wrap gap-1.5">
        <button className={BTN} onClick={() => set({ setup: "stock" })}>{t("Lager anpassen", "Adjust stock")}</button>
        <button className={BTN} onClick={() => set({ setup: "prices" })}>{t("Preise anpassen", "Adjust prices")}</button>
        <button className={BTN} onClick={() => set({ setup: "route" })}>{t("Weg ändern", "Change route")}</button>
      </div>

      <details className="card-face relative rounded-2xl px-4 py-3 text-sm">
        <summary className="cursor-pointer text-[#efe6cc]/90">{t("Gesamtplan anzeigen", "Show the whole plan")}</summary>
        <div className="mt-3"><PlanPanel p={p} plan={plan} state={state} /></div>
      </details>
      <details className="card-face relative rounded-2xl px-4 py-3 text-sm">
        <summary className="cursor-pointer text-[#efe6cc]/90">{t("Protokoll", "Log")}</summary>
        <div className="mt-3"><LogPanel p={p} state={state} update={update} /></div>
      </details>
    </div>
  );
}

/* ------------------------------------------------------------------ guided setup ------------------------------------------------------------------ */

const SETUP_STEPS = ["stock", "prices", "route"] as const;

/** After creating a project: stock first (or "I have nothing"), then market prices, then the route (buy or craft, where to start). */
function Setup({ p, state, update, char }: { p: Project; state: CraftState; update: Update; char: Character }) {
  const t = useT();
  const set = (patch: Partial<Project>) => update((s) => ({ ...s, projects: s.projects.map((x) => (x.id === p.id ? { ...x, ...patch } : x)) }));
  const at = SETUP_STEPS.indexOf(p.setup!);
  const names = [t("Lager", "Stock"), t("Preise", "Prices"), t("Weg", "Route")];
  const go = (i: number) => set({ setup: SETUP_STEPS[i] });
  // what the whole line uses, crafted from scratch (so the lists do not change while typing)
  const full = { ...p, owned: [], buyFinal: false, buy: (p.buy ?? []).filter((k) => !routeItems(p, state).some((x) => itemKey(x) === k)) };
  const fullPlan = craftPlan(full, { ...state, events: [] });
  const stages = routeItems(p, state);
  const ladder = ladderItems(state, p.faction, p.gearSlot ?? state.recipes.find((r) => r.recipeKey === p.targetRecipeKey)?.slot ?? "");
  const levelOfItem = (i: ItemRef) => ladder.find((x) => sameItem(x.item, i))?.level ?? null;
  const mats = fullPlan.materials.filter((m) => !m.chainItem);
  return (
    <Card className="p-4 text-sm">
      <div className="relative space-y-4">
        <ol className="flex flex-wrap gap-2 text-xs">
          {names.map((n, i) => (
            <li key={n}><button onClick={() => go(i)} className={`rounded-full px-3 py-1 ring-1 ${i === at ? "bg-white/[0.1] text-[#f4eed7] ring-[#d9c58f]/50" : i < at ? "text-[#5fbf8a] ring-white/10" : "text-zinc-500 ring-white/10"}`}>{i + 1}. {n}</button></li>
          ))}
        </ol>

        {p.setup === "stock" && <>
          <div>
            <div className="text-base font-semibold text-[#f4eed7]">{t("Hast du schon gecraftete Waffen oder Material?", "Do you already have crafted items or materials?")}</div>
            <p className="text-xs text-zinc-400">{t("Trag ein, was im Lager liegt. Die Endstufe fehlt hier absichtlich: Wenn du die hast, musst du nicht mehr craften.", "Enter what is in your storage. The final stage is left out on purpose: if you have it, there is nothing left to craft.")}</p>
          </div>
          <StockGroup title={t("Combo-Stufen bis Lv 44", "Combo stages up to Lv 44")} items={stages.filter((i) => (levelOfItem(i) ?? 0) <= 44)} p={p} update={update} levelOf={levelOfItem} />
          <StockGroup title={t("Höhere Stufen (optional, ab hier Safecraft)", "Higher stages (optional, safe crafts from here)")} items={stages.filter((i) => (levelOfItem(i) ?? 0) > 44)} p={p} update={update} levelOf={levelOfItem} />
          <section className="space-y-2">
            <div className={LABEL}>{t("Materialien der ganzen Kette (Lager gilt für alle Projekte)", "Materials of the whole line (stock is shared by all projects)")}</div>
            <ul className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
              {mats.map((m) => (
                <li key={itemKey(m.item)} className="flex items-center gap-2 rounded-xl bg-white/[0.03] px-2 py-1.5 text-xs ring-1 ring-white/5" style={rarityEdge(m.item.name)}>
                  <ItemIcon src={iconOf(m.item, p.faction)} rarity={rarityOf(m.item.name)} />
                  <span className="min-w-0 flex-1 truncate text-[#efe6cc]/90">{shown(m.item.name)}</span>
                  <input className={`${INPUT} w-20 text-right text-xs`} inputMode="numeric" aria-label={m.item.name} value={state.inventory[itemKey(m.item)] ?? ""} placeholder="0"
                    onChange={(e) => { const v = e.target.value.replace(/\D/g, ""); update((s) => { const inv = { ...s.inventory }; if (v === "") delete inv[itemKey(m.item)]; else inv[itemKey(m.item)] = Number(v); return { ...s, inventory: inv }; }); }} />
                </li>
              ))}
              {!mats.length && <li className="text-zinc-500">{t("Keine Materialliste: Zutaten fehlen in den Daten.", "No material list: ingredients missing in the data.")}</li>}
            </ul>
          </section>
          <div className="flex flex-wrap gap-2">
            <button className={BTN} onClick={() => update((s) => {
              const inv = { ...s.inventory };
              for (const m of mats) delete inv[itemKey(m.item)];
              return { ...s, inventory: inv, projects: s.projects.map((x) => (x.id === p.id ? { ...x, owned: [], setup: "prices" } : x)) };
            })}>{t("Ich habe nichts", "I have nothing")}</button>
            <button className={`${BTN} border-[#d9c58f]/50 text-[#f4eed7]`} onClick={() => go(1)}>{t("Weiter zu den Preisen", "Next: prices")} ›</button>
          </div>
        </>}

        {p.setup === "prices" && <>
          <div>
            <div className="text-base font-semibold text-[#f4eed7]">{t("Was kosten die Stufen im Markt?", "What do the stages cost on the market?")}</div>
            <p className="text-xs text-zinc-400">{t("Ein Preis pro Stück für deinen Server", "One price per piece for your server")} ({char.server}). {t("Leer lassen, wenn du es nicht weißt. Damit rechne ich aus, ob Kaufen oder Craften günstiger ist.", "Leave empty if you do not know. I use them to work out whether buying or crafting is cheaper.")}</p>
          </div>
          <ul className="grid gap-1.5 sm:grid-cols-2">
            {[...stages, ...(projectTarget(p, state.recipes) ? [projectTarget(p, state.recipes)!] : [])].map((i) => (
              <li key={itemKey(i)} className="flex items-center gap-2 rounded-xl bg-white/[0.03] px-2 py-1.5 text-xs ring-1 ring-white/5">
                <ItemIcon src={iconOf(i, p.faction)} />
                <span className="min-w-0 flex-1"><span className="block truncate text-[#efe6cc]/90">{shown(i.name)}</span><span className="text-[11px] text-zinc-500">{levelOfItem(i) ? `Lv ${levelOfItem(i)}` : ""}</span></span>
                <PriceSlider item={i} state={state} update={update} server={p.server} />
              </li>
            ))}
          </ul>
          <section className="space-y-2">
            <div className={LABEL}>{t("Materialpreise", "Material prices")}</div>
            <ul className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
              {mats.map((m) => (
                <li key={itemKey(m.item)} className="flex items-center gap-2 rounded-xl bg-white/[0.03] px-2 py-1.5 text-xs ring-1 ring-white/5" style={rarityEdge(m.item.name)}>
                  <ItemIcon src={iconOf(m.item, p.faction)} rarity={rarityOf(m.item.name)} />
                  <span className="min-w-0 flex-1 truncate text-[#efe6cc]/90">{shown(m.item.name)}</span>
                  <PriceSlider item={m.item} state={state} update={update} server={p.server} />
                </li>
              ))}
            </ul>
          </section>
          <p className="text-[11px] text-zinc-500">{t("Referenzpreise aus deinem anderen Tool kannst du später als Preis-CSV importieren; sie landen hier automatisch.", "Reference prices from your other tool can be imported later as a price CSV; they show up here automatically.")}</p>
          <div className="flex flex-wrap gap-2">
            <button className={BTN} onClick={() => go(0)}>‹ {t("Zurück", "Back")}</button>
            <button className={`${BTN} border-[#d9c58f]/50 text-[#f4eed7]`} onClick={() => go(2)}>{t("Weiter: Kaufen oder Craften", "Next: buy or craft")} ›</button>
          </div>
        </>}

        {p.setup === "route" && <RouteStep p={p} state={state} update={update} onBack={() => go(1)} />}
      </div>
    </Card>
  );
}

/** Stock of some stages of the line, with − n + steppers. */
function StockGroup({ title, items, p, update, levelOf: lv }: { title: string; items: ItemRef[]; p: Project; update: Update; levelOf: (i: ItemRef) => number | null }) {
  if (!items.length) return null;
  const setCount = (item: ItemRef, n: number) => update((s) => ({ ...s, projects: s.projects.map((x) => (x.id === p.id ? withOwnedCount(x, item, n) : x)) }));
  return (
    <section className="space-y-2">
      <div className={LABEL}>{title}</div>
      <ul className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((i) => (
          <li key={itemKey(i)} className="flex items-center gap-2 rounded-xl bg-white/[0.03] px-2 py-1.5 text-xs ring-1 ring-white/5">
            <ItemIcon src={iconOf(i, p.faction)} />
            <span className="min-w-0 flex-1"><span className="block truncate text-[#efe6cc]/90">{shown(i.name)}</span><span className="text-[11px] text-zinc-500">{lv(i) ? `Lv ${lv(i)}` : ""}</span></span>
            <Stepper value={ownedCount(p, i)} onChange={(n) => setCount(i, n)} label={i.name} />
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Market price per piece for the server, typed in place (saved when the field is left). */
function PriceInput({ item, state, update, server }: { item: ItemRef; state: CraftState; update: Update; server: string }) {
  const t = useT();
  const lang = useLang();
  const cur = findPrice({ prices: state.prices.filter((x) => (x.server ?? "").toLowerCase() === server.toLowerCase()), server }, item);
  const value = cur?.ref ?? cur?.low ?? null;
  const [text, setText] = useState<string>();
  const commit = () => {
    if (text === undefined) return;
    const n = numOrNull(text);
    setText(undefined);
    if (n === null) { update((s) => ({ ...s, prices: s.prices.filter((x) => !(sameItem(x, item) && (x.server ?? "").toLowerCase() === server.toLowerCase())) })); return; }
    if (!Number.isFinite(n) || n < 0) return;
    // the typed price becomes the current one; min / max widen when it lies outside
    const low = cur?.low ?? null, high = cur?.high ?? null;
    update((s) => savePrice(s, item, { low: low === null ? n : Math.min(low, n), high: high === null ? n : Math.max(high, n), ref: n, tradeable: true, note: cur?.suggested ? undefined : cur?.note }, { kind: "global", server }));
  };
  return (
    <label className="flex shrink-0 items-center gap-1 text-zinc-500">
      <input className={`${INPUT} w-28 text-right text-xs`} inputMode="numeric" aria-label={`${item.name}: ${t("Preis", "price")}`} placeholder={t("Kinah", "Kinah")}
        value={text ?? (value === null ? "" : value.toLocaleString(numberLocale(lang)))} onChange={(e) => setText(e.target.value)} onBlur={commit} onKeyDown={(e) => e.key === "Enter" && commit()} />
      {cur && <SuggestedTag p={cur} />}
    </label>
  );
}

/** Nice slider steps: about 100 per range, rounded to 1, 2 or 5 × 10^n. */
function sliderStep(span: number) {
  const raw = span / 100;
  if (raw <= 1) return 1;
  const p = 10 ** Math.floor(Math.log10(raw));
  return [1, 2, 5, 10].map((m) => m * p).find((x) => x >= raw)!;
}

/**
 * Market price as a slider between min and max (the value is the price used for the calculation), with
 * "Min-Max anpassen" to change the range; the slider follows. Without a range: a plain price field.
 * Changes are saved at once (and shared online).
 */
function PriceSlider({ item, state, update, server, wide }: { item: ItemRef & { catalogKey?: string; bound?: boolean | null }; state: CraftState; update: Update; server: string; wide?: boolean }) {
  const t = useT();
  const kinah = useKinah();
  const [editing, setEditing] = useState(false);
  const cur = findPrice({ prices: state.prices.filter((x) => (x.server ?? "").toLowerCase() === server.toLowerCase()), server }, item);
  const low = cur?.low ?? null, high = cur?.high ?? null;
  const value = cur ? cur.ref ?? low ?? high : null;
  const [drag, setDrag] = useState<number>();
  const hasRange = low !== null && high !== null && high > low;
  const commit = () => {
    if (drag === undefined || !cur) return;
    const v = drag;
    setDrag(undefined);
    if (v === value) return;
    update((s) => savePrice(s, item, { low, high, ref: v, tradeable: cur.tradeable ?? true, note: cur.suggested ? undefined : cur.note }, { kind: "global", server }));
  };
  return (
    <span className={`flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 ${wide ? "w-full sm:w-auto sm:min-w-[20rem]" : ""}`}>
      {hasRange ? (
        <span className="flex min-w-[12rem] flex-1 items-center gap-2">
          <span className="text-[10px] text-zinc-500">{kinah(low)!.replace(" Kinah", "")}</span>
          <input type="range" className="min-w-0 flex-1 accent-[#d9c58f]" min={low!} max={high!} step={sliderStep(high! - low!)}
            value={Math.min(high!, Math.max(low!, drag ?? value ?? low!))} aria-label={`${item.name}: ${t("Preis", "price")}`}
            onChange={(e) => setDrag(Number(e.target.value))} onPointerUp={commit} onKeyUp={commit} onBlur={commit} onTouchEnd={commit} />
          <span className="text-[10px] text-zinc-500">{kinah(high)!.replace(" Kinah", "")}</span>
          <b className="shrink-0 text-xs text-[#f4eed7]">{kinah(drag ?? value)}</b>
        </span>
      ) : <PriceInput item={item} state={state} update={update} server={server} />}
      {cur && <SuggestedTag p={cur} />}
      <button className="text-[11px] text-zinc-400 underline hover:text-zinc-200" onClick={() => setEditing(true)}>{t("Min-Max anpassen", "Adjust min-max")}</button>
      {editing && <PriceDialog target={{ item, server }} state={state} onClose={() => setEditing(false)} onSave={(fn) => { update(fn); setEditing(false); }} />}
    </span>
  );
}

/**
 * Buy or craft: every route with what is still to buy and where it starts (lowest stage still missing after the stock).
 * The default is to craft everything from the lowest stage; the cheapest known route is only suggested.
 * Prices the comparison lacks are listed right here to fill in.
 */
function RouteStep({ p, state, update, onBack }: { p: Project; state: CraftState; update: Update; onBack: () => void }) {
  const t = useT();
  const kinah = useKinah();
  const opts = routeOptions(p, state, "ref");
  const current = routeOf(p, state);
  const [pick, setPick] = useState(current);
  const conf = p.confidence ?? PLAN_CONFIDENCE;
  const best = opts.find((o) => o.recommended);
  const all = opts.find((o) => o.key === "all")!;
  const missing = missingRoutePrices(opts);
  const label = (o: (typeof opts)[number]) => o.key === "all" ? t("Alles selbst craften (ab der untersten Stufe)", "Craft everything myself (from the lowest stage)")
    : o.key === "final" ? `${t("Endwaffe direkt kaufen", "Buy the final item")}: ${shown(o.item?.name ?? "?")}`
      : `${shown(o.item!.name)} ${t("kaufen, ab da selbst craften", "buy, craft from there")}`;
  const cost = (o: (typeof opts)[number]) => {
    if (o.conf.cost !== null) return <>{Math.round(conf * 100)} %: <b className="text-[#f4eed7]">{kinah(o.conf.cost)}</b>{o.mean.cost !== null && <span className="text-zinc-500"> · Ø {kinah(o.mean.cost)}</span>}</>;
    if (o.unknown.length) return <span className={MISSING}>{t("Rezeptdaten fehlen", "recipe data missing")}</span>;
    const n = o.conf.missingPrices.length;
    return <>{o.conf.known > 0 && <>{t("mind.", "at least")} <b className="text-[#f4eed7]">{kinah(o.conf.known)}</b> · </>}<span className={MISSING}>{n} {n === 1 ? t("Preis fehlt", "price missing") : t("Preise fehlen", "prices missing")}</span></>;
  };
  return (
    <>
      <div>
        <div className="text-base font-semibold text-[#f4eed7]">{t("Kaufen oder selbst craften?", "Buy or craft yourself?")}</div>
        <p className="text-xs text-zinc-400">{t("Ziel ist die Endstufe, angefangen wird ganz unten. Pro Weg: wo du mit deinem Lager einsteigst und was du noch kaufen musst. Geplant wird so, dass jede Stufe mit der gewählten Sicherheit klappt; Ø ist der Mittelwert.", "The target is the final stage, you start at the very bottom. Per route: where you start with your stock and what you still have to buy. Each stage is planned to work with the chosen confidence; Ø is the mean.")}</p>
      </div>
      <div className="rounded-xl bg-white/[0.03] px-3 py-2 text-xs ring-1 ring-white/10">
        <div className="text-zinc-300">{all.start ? <>{t("Mit deinem Lager fängst du an bei", "With your stock you start at")}: <b className="text-[#f4eed7]">{shown(all.start.name)}</b></> : t("Mit deinem Lager ist nichts mehr zu craften.", "With your stock there is nothing left to craft.")}</div>
        {best && best.key !== "all" && <div className="mt-1 flex flex-wrap items-center gap-2 text-zinc-400">
          <span><span className="text-[#5fbf8a]">{t("Empfehlung", "Suggestion")}:</span> {label(best)}{best.start ? <> · {t("Einstieg bei", "start at")} {shown(best.start.name)}</> : null}{all.conf.cost !== null && best.conf.cost !== null && <> · {t("spart", "saves")} {kinah(all.conf.cost - best.conf.cost)}</>}</span>
          {pick !== best.key && <button className={BTN} onClick={() => setPick(best.key)}>{t("Empfehlung wählen", "Pick suggestion")}</button>}
        </div>}
        {best?.key === "all" && <div className="mt-1 text-[#5fbf8a]">{t("Empfehlung: alles selbst craften ist am günstigsten.", "Suggestion: crafting everything is cheapest.")}</div>}
      </div>
      <label className="flex items-center gap-2 text-xs text-zinc-400">{t("Sicherheit pro Stufe", "Confidence per stage")}
        <select className={`${INPUT} text-xs`} value={conf} onChange={(e) => update((s) => ({ ...s, projects: s.projects.map((x) => (x.id === p.id ? { ...x, confidence: Number(e.target.value) } : x)) }))}>
          {[0.75, 0.8, 0.9].map((c) => <option key={c} value={c}>{Math.round(c * 100)} %</option>)}
        </select>
      </label>
      <ul className="space-y-1.5" role="radiogroup">
        {opts.map((o) => (
          <li key={o.key}>
            <label className={`flex cursor-pointer flex-wrap items-center gap-x-3 gap-y-1 rounded-xl px-3 py-2 text-xs ring-1 ${pick === o.key ? "bg-white/[0.08] ring-[#d9c58f]/50" : "bg-white/[0.02] ring-white/10 hover:ring-[#d9c58f]/30"}`}>
              <input type="radio" name="route" checked={pick === o.key} onChange={() => setPick(o.key)} />
              {o.item && <ItemIcon src={iconOf(o.item, p.faction)} />}
              <span className="min-w-0 flex-1">
                <span className="block text-sm text-[#efe6cc]/90">{label(o)}{o.recommended && <span className="ml-2 rounded-full bg-[#5fbf8a]/15 px-2 py-0.5 text-[11px] text-[#5fbf8a]">{t("Empfohlen", "Suggested")}</span>}</span>
                {o.key !== "final" && <span className="block text-[11px] text-zinc-500">{o.start ? `${t("Einstieg bei", "start at")}: ${shown(o.start.name)}` : t("nichts mehr zu craften", "nothing left to craft")}</span>}
                {o.conf.missingPrices.length > 0 && <span className={`block text-[11px] ${MISSING}`}>{t("fehlt", "missing")}: {o.conf.missingPrices.map((i) => shown(i.name)).join(", ")}</span>}
              </span>
              <span className="text-zinc-300">{cost(o)}</span>
            </label>
          </li>
        ))}
      </ul>
      {missing.length > 0 && <section className="space-y-2 rounded-xl bg-white/[0.02] p-3 ring-1 ring-[#e6b450]/30">
        <div className="text-xs text-[#f4eed7]">{t("Diese Preise fehlen für die Rechnung. Trag sie kurz ein (Kinah pro Stück), dann rechne ich sofort neu:", "These prices are missing for the calculation. Enter them quickly (Kinah per piece) and I recalculate right away:")}</div>
        <ul className="grid gap-1.5 sm:grid-cols-2">
          {missing.map((i) => (
            <li key={itemKey(i)} className="flex items-center gap-2 rounded-xl bg-white/[0.03] px-2 py-1.5 text-xs ring-1 ring-white/5" style={rarityEdge(i.name)}>
              <ItemIcon src={iconOf(i, p.faction)} rarity={rarityOf(i.name)} />
              <span className="min-w-0 flex-1 truncate text-[#efe6cc]/90">{shown(i.name)}</span>
              <PriceSlider item={i} state={state} update={update} server={p.server} />
            </li>
          ))}
        </ul>
      </section>}
      <div className="flex flex-wrap gap-2">
        <button className={BTN} onClick={onBack}>‹ {t("Zurück", "Back")}</button>
        <button className={`${BTN} border-[#d9c58f]/50 text-[#f4eed7]`} onClick={() => update((s) => ({ ...s, projects: s.projects.map((x) => (x.id === p.id ? { ...withRoute(x, s, pick), setup: undefined } : x)) }))}>{t("Weg übernehmen und loslegen", "Take this route and start")} ›</button>
      </div>
    </>
  );
}

/** One material tile of the current craft: icon, name, in stock / needed for this stage, per attempt, price. */
function MaterialTile({ i, p, state, stepKey, attempts, onPrice }: { i: NextStep["ingredients"][number]; p: Project; state: CraftState; stepKey: string; attempts: number | null; onPrice: (x: PriceTarget) => void }) {
  const t = useT();
  const total = i.qty !== null && attempts !== null ? Math.ceil(i.qty * attempts) : null;
  const ok = total !== null && i.have >= total;
  const own = i.crafted || (i.kind === "transfer" && canCraft(p, i, state.recipes));
  return (
    <li className="flex items-center gap-2 rounded-xl bg-white/[0.03] px-2 py-1.5 ring-1 ring-white/5" style={own ? undefined : rarityEdge(i.name)}>
      <ItemIcon src={iconOf(i, p.faction)} rarity={own ? undefined : rarityOf(i.name)} size="h-10 w-10" />
      <div className="min-w-0 flex-1">
        <div className="truncate text-xs text-[#efe6cc]/90">{shown(i.name)}</div>
        <div className="text-[11px]">
          <span className={ok ? "text-[#5fbf8a]" : "text-[#ff6b6b]"}>{i.have} / {total ?? "?"}</span>
          <span className="text-zinc-500"> · {i.qty ?? "?"} {t("pro Versuch", "per attempt")}</span>
          {i.crafted && <span className="text-zinc-500"> · {t("Vorstufe", "previous stage")}</span>}
          {i.alternatives?.map((a) => <span key={a.itemId ?? a.name} className="text-zinc-500"> · {t("oder", "or")} {shown(a.name)}{a.unverified ? ` (${t("unbestätigt", "unconfirmed")})` : ""}</span>)}
        </div>
        {!own && <div className="mt-0.5"><PriceCell item={i} ctxProject={p} stepKey={stepKey} state={state} compact onEdit={() => onPrice({ item: i, server: p.server, project: p, stepKey })} /></div>}
      </div>
    </li>
  );
}

/** The craft to do now: big item picture in the middle, materials left and right, how many are still missing, chances and the result buttons. */
function CurrentCraft({ s, line, conf, state, onLog, onPrice }: { s: NextStep; line: PlanLine; conf: number; state: CraftState; onLog: (o: Outcome) => void; onPrice: (x: PriceTarget) => void }) {
  const t = useT();
  const range = useRange();
  const want = s.goal === "combo" && s.recipe.comboOutput ? s.recipe.comboOutput : s.recipe.output;
  const icon = iconOf(want, s.project.faction);
  const free = (i: ItemRef) => !!craftsItself(s.project, i, state.recipes) || ((i as { kind?: string }).kind === "transfer" && !!producerOf(i, state.recipes, s.project.faction));
  const ctx = ctxOf(state, s.project, s.recipe.recipeKey);
  const next = { low: attemptCost(s.recipe, ctx, "low", free), high: attemptCost(s.recipe, ctx, "high", free) };
  const half = Math.ceil(s.ingredients.length / 2);
  const lv = stageLevel(s);
  const basis = { character: t("deine Stufe", "your level"), required: t("Mindeststufe", "required level"), fixed: t("garantiert", "guaranteed"), best: t("beste dok. Stufe", "best documented level"), none: "" }[line.basis];
  const unconfirmed = s.ingredients.length > 0 && s.recipe.ingredientsStatus !== undefined && s.recipe.ingredientsStatus !== "complete";
  const tile = (i: NextStep["ingredients"][number]) => <MaterialTile key={`${i.kind}:${itemKey(i)}`} i={i} p={s.project} state={state} stepKey={s.recipe.recipeKey} attempts={line.attempts} onPrice={onPrice} />;
  return (
    <Card className="p-4 text-sm">
      <div className="relative mb-3 flex flex-wrap items-baseline gap-2">
        <span className={LABEL}>{t("Aktueller Craft", "Current craft")}</span>
        {unconfirmed && <span className={`text-[11px] ${MISSING}`}>{t("Zutatenliste unbestätigt, Kosten vorläufig", "ingredient list unconfirmed, cost provisional")}</span>}
        {s.recipe.liveUnconfirmed && <span className="text-[11px] text-zinc-500">{t("Global-Clientdaten, nicht live bestätigt", "Global client data, not confirmed live")}{s.recipe.source && <> · <a className="underline hover:text-zinc-300" href={s.recipe.source} target="_blank" rel="noreferrer">{t("Quelle", "Source")}</a></>}</span>}
      </div>
      <div className="relative grid gap-3 md:grid-cols-[1fr_minmax(0,15rem)_1fr] md:items-center">
        <ul className="order-2 space-y-1.5 md:order-1">{s.ingredients.slice(0, half).map(tile)}</ul>
        <div className="order-1 text-center md:order-2">
          <div className="mx-auto w-32 sm:w-40">{icon ? <CardArt src={icon} alt={want.name} /> : <Filler className="aspect-square w-full" />}</div>
          <div className="mt-2 font-semibold text-[#f4eed7]">{shown(want.name)}</div>
          <div className="text-xs text-zinc-400">{lv ? `Lv ${lv}` : ""}{s.goal === "combo" ? " · Combo" : ""}</div>
          <div className="mt-2 rounded-xl bg-white/[0.04] px-3 py-2 ring-1 ring-[#d9c58f]/25">
            <div className="text-lg font-semibold text-[#f4eed7]">{t("Noch", "Still")} {line.missing}× {t("craften", "to craft")}</div>
            <div className="text-[11px] text-zinc-400">{t("gebraucht", "needed")} {line.need} · {t("im Lager", "in stock")} {line.have}</div>
            <div className="text-xs text-zinc-300">{t("Geplant", "Planned")}: <b className="text-[#f4eed7]">{line.attempts ?? "?"}</b> {t("Versuche", "attempts")} ({conf} %)</div>
          </div>
          <div className="mt-1 text-xs text-zinc-300">{t("Chance", "Chance")}: {pct(line.p) ?? <span className={MISSING}>{t("unbekannt", "unknown")}</span>}{basis && <span className="text-zinc-500"> ({basis})</span>}</div>
          {s.chance.actual === null && line.basis !== "fixed" && <div className="text-[11px] text-zinc-500">{t("Trag deine Handwerksstufe oben ein, dann rechne ich mit deiner Chance.", "Enter your crafting level above to use your own chance.")}</div>}
          <div className="mt-1 text-xs text-zinc-400">{t("Ein Versuch", "One attempt")}: {next.low.cost !== null ? range(next.low.cost, next.high.cost) : <span className={MISSING}>{t("Preise fehlen", "prices missing")}</span>}</div>
        </div>
        <ul className="order-3 space-y-1.5">{s.ingredients.slice(half).map(tile)}</ul>
        {!s.ingredients.length && <p className={`order-3 md:col-span-3 ${MISSING}`}>{t("Zutaten nicht dokumentiert (Datenlücke)", "Ingredients not documented (data gap)")}</p>}
      </div>
      <div className="relative mt-3 flex flex-wrap justify-center gap-1.5">
        <span className={`${LABEL} self-center`}>{t("Ergebnis im Spiel", "Result in game")}:</span>
        {s.outcomes.map((o) => <button key={o} className={BTN} onClick={() => onLog(o)}>{outcomeName(o, t)}</button>)}
      </div>
    </Card>
  );
}

/** The whole plan, lowest stage first: needed, in stock, missing, chance, planned attempts; then what is still to buy. */
function PlanPanel({ p, plan, state }: { p: Project; plan: ReturnType<typeof craftPlan>; state: CraftState }) {
  const t = useT();
  const kinah = useKinah();
  const conf = Math.round(plan.confidence * 100);
  const ctx = ctxOf(state, p);
  return (
    <div className="space-y-3">
      <ol className="space-y-1.5">
        {plan.lines.map((l) => {
          const lv = l.goal === "combo" ? l.recipe.comboLevel ?? l.recipe.level : l.recipe.level;
          return (
            <li key={`${l.recipe.recipeKey}:${l.goal}`} className={`flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl bg-white/[0.03] px-3 py-2 text-xs ring-1 ${l.missing > 0 ? "ring-white/10" : "opacity-60 ring-white/5"}`}>
              <ItemIcon src={iconOf(l.item, p.faction)} />
              <span className="min-w-0 text-sm text-[#efe6cc]/90">{shown(l.item.name)}</span>
              <span className="text-zinc-500">{lv ? `Lv ${lv}` : ""}{l.goal === "combo" ? " · Combo" : ""}</span>
              {!l.ingredientsKnown && <span className={MISSING}>{l.recipe.ingredients.length ? t("Zutaten unbestätigt", "ingredients unconfirmed") : t("Zutaten fehlen", "ingredients missing")}</span>}
              <span className="ml-auto flex flex-wrap items-center gap-3 text-zinc-300">
                <span>{t("gebraucht", "needed")} {l.need} · {t("Lager", "stock")} {l.have}</span>
                <span>{t("fehlen", "missing")} <b className="text-[#f4eed7]">{l.missing}</b></span>
                <span>{t("Chance", "Chance")} {pct(l.p) ?? <span className={MISSING}>?</span>}</span>
                <span>{conf} %: <b className="text-[#f4eed7]">{l.attempts ?? "?"}</b> {t("Versuche", "attempts")}</span>
              </span>
            </li>
          );
        })}
        {!plan.lines.length && !p.buyFinal && <li className="text-zinc-500">{t("Pfad unbekannt: Zutaten fehlen in den Daten.", "Path unknown: ingredients missing in the data.")}</li>}
      </ol>
      {plan.materials.some((m) => m.missing > 0) && (
        <div className="space-y-1">
          <div className={LABEL}>{t("Noch zu kaufen", "Still to buy")}</div>
          <ul className="grid gap-1 text-xs sm:grid-cols-2 lg:grid-cols-3">
            {plan.materials.filter((m) => m.missing > 0).map((m) => {
              const pr = findPrice(ctx, m.item);
              return (
                <li key={itemKey(m.item)} className="flex items-center gap-2 rounded-lg bg-white/[0.02] px-2 py-1" style={rarityEdge(m.item.name)}>
                  <ItemIcon src={iconOf(m.item, p.faction)} rarity={m.chainItem ? undefined : rarityOf(m.item.name)} size="h-6 w-6" />
                  <span className="min-w-0 flex-1 truncate text-[#efe6cc]/90">{shown(m.item.name)}</span>
                  <b className="text-[#f4eed7]">{Math.ceil(m.missing)}×</b>
                  <span className={pr?.low != null ? "text-zinc-400" : MISSING}>{pr?.low != null ? kinah(pr.low * Math.ceil(m.missing)) : "?"}</span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
      {plan.unknown.length > 0 && <p className={`text-xs ${MISSING}`}>{t("Unvollständig", "Incomplete")}: {plan.unknown.slice(0, 6).join(" · ")}</p>}
      <p className="text-[11px] text-zinc-500">{t(`Gerechnet von oben nach unten: Für die fehlenden Treffer einer Stufe braucht es so viele Versuche, dass sie in ${conf} % der Fälle reichen. Jeder Versuch verbraucht eine Vorstufe, deshalb ist das die Menge, die die Stufe darunter liefern muss.`,
        `Worked out top-down: a stage needs so many attempts that its missing hits come in ${conf} % of cases. Every attempt uses one item of the stage below, so that is how many the stage below must deliver.`)}</p>
    </div>
  );
}

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
      {p ? <span className="text-[#efe6cc]/90">{range(p.low, p.high) ?? range(p.ref, p.ref)}{scope && <span className="text-zinc-500"> · {scope}</span>}<SuggestedTag p={p} /></span>
        : <span className={MISSING}>{compact ? t("kein Preis", "no price") : t("Kein Preis hinterlegt", "No price saved")}</span>}
      {item.bound === true && <span className="text-zinc-500">· {t("gebunden", "bound")}</span>}
      {compact
        ? <button className="text-[11px] text-zinc-400 underline hover:text-zinc-200" onClick={onEdit}>{p ? t("ändern", "edit") : t("eingeben", "enter")}</button>
        : <button className={BTN} onClick={onEdit}>{p ? t("Bearbeiten", "Edit") : t("Preis eingeben", "Enter price")}</button>}
    </span>
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

/** Marks a price from the reference list (not typed in by the player), with its source. */
function SuggestedTag({ p }: { p: { suggested?: "observed" | "rough"; sourceUrl?: string; note?: string; ref?: number | null } }) {
  const t = useT();
  if (!p.suggested) return null;
  const label = p.suggested === "rough" ? t("grobe Schätzung", "rough estimate") : t("Referenz", "reference");
  return (
    <span className={`ml-1.5 text-[11px] ${p.suggested === "rough" ? MISSING : "text-zinc-500"}`} title={p.note}>
      · {p.sourceUrl ? <a href={p.sourceUrl} target="_blank" rel="noreferrer" className="underline hover:text-zinc-300">{label}</a> : label}
    </span>
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

function CatalogRow({ e, state, server, update }: { e: CatalogEntry & { area: PriceArea; group: PriceGroup }; state: CraftState; server: string; update: Update; onPrice: (x: PriceTarget) => void }) {
  const t = useT();
  const mine = state.prices.find((x) => (x.server ?? "").toLowerCase() === server.toLowerCase() && findPrice({ prices: [x] }, e));
  const stock = state.inventory[itemKey(e)];
  const icon = SHOW_ITEM_ICONS ? craftIcon(e) : undefined;
  const isTarget = e.key.startsWith("recipe:") || e.key.startsWith("combo:");
  return (
    <li className="card-face relative flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl py-1.5 pl-2 pr-3 text-xs" style={e.area === "materials" ? rarityEdge(e.name) : undefined}>
      <ItemIcon src={icon} rarity={e.area === "materials" ? rarityOf(e.name) : undefined} />
      <span className="min-w-0 text-sm text-[#efe6cc]/90">{shown(e.name)}</span>
      <span className="text-zinc-500">{e.itemId ? `#${e.itemId}` : t("ohne Item-ID", "no item ID")}{e.bound === true ? ` · ${t("gebunden", "bound")}` : ""}
        {e.area === "gear" ? ` · ${isTarget ? t("Rezeptziel", "recipe target") : t("Zwischenstufe", "intermediate")}` : ""}{e.custom ? ` · ${t("eigener Eintrag", "own entry")}` : ""}</span>
      <span className="ml-auto flex flex-wrap items-center gap-2">
        {e.area === "materials" && (
          <label className="flex items-center gap-1 text-zinc-500">{t("Bestand", "Stock")}
            <input className={`${INPUT} w-16 text-right text-xs`} inputMode="numeric" value={stock ?? ""} placeholder="–"
              onChange={(ev) => { const v = ev.target.value.replace(/\D/g, ""); update((s) => { const inv = { ...s.inventory }; if (v === "") delete inv[itemKey(e)]; else inv[itemKey(e)] = Number(v); return { ...s, inventory: inv }; }); }} />
          </label>
        )}
        <PriceSlider item={{ ...e, catalogKey: e.key }} state={state} update={update} server={server} wide />
        {mine?.updated && <span className="text-zinc-500">{new Date(mine.updated).toLocaleDateString()}</span>}
        {mine && <button className={BTN} onClick={() => update((s) => ({ ...s, prices: s.prices.filter((x) => x !== mine && (!mine.id || x.id !== mine.id)) }))}>{t("Löschen", "Delete")}</button>}
      </span>
    </li>
  );
}

/** Uploads the icon pack (original icons, kept out of the repo) to the server once; afterwards every account sees the icons. */
function IconPackButton() {
  const t = useT();
  const ref = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<string>();
  return <>
    <button className={BTN} disabled={!!state && state !== "error"} onClick={() => ref.current?.click()}>{state && state !== "error" ? state : t("Icon-Paket hochladen", "Upload icon pack")}</button>
    <input ref={ref} type="file" accept=".json,application/json" hidden onChange={async (e) => {
      const f = e.target.files?.[0]; e.target.value = "";
      if (!f) return;
      try {
        setState("0 %");
        const n = await uploadIconPack(await f.text(), (x) => setState(`${Math.round(x * 100)} %`));
        alert(t(`${n} Icons hochgeladen. Die Seite lädt neu.`, `${n} icons uploaded. The page reloads.`));
        location.reload();
      } catch (err) { setState("error"); alert(`${t("Hochladen fehlgeschlagen", "Upload failed")}: ${(err as Error).message}`); }
    }} />
  </>;
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
    return state.projects.filter((p) => p.status !== "done" && p.server.toLowerCase() === server.toLowerCase() && craftPlan(p, state).materials.some((m) => m.missing > 0 && findPrice({ prices: [{ ...item, low: 0, high: 0, ref: 0, tradeable: null }] }, m.item)))
      .map((p) => {
        const pa = after.projects.find((x) => x.id === p.id)!;
        const cost = (x: Project, st: CraftState, sc: Scenario) => { const r = planCost(craftPlan(x, st), ctxOf(st, x), sc); return { cost: r.cost, partial: r.known }; };
        return { p, before: [cost(p, state, "low"), cost(p, state, "high")] as const, after: [cost(pa, after, "low"), cost(pa, after, "high")] as const };
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [low, high, ref, tradeable, scope, state]);
  const show = (c: readonly [{ cost: number | null; partial: number }, { cost: number | null; partial: number }]) => c[0].cost !== null ? range(c[0].cost, c[1].cost) : <span className={MISSING}>{t("Daten fehlen", "Data missing")}{c[0].partial ? ` (${t("bekannt", "known")} ${range(c[0].partial, c[1].partial)})` : ""}</span>;
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
            <div className="text-base font-semibold text-[#f4eed7]">{shown(item.name)}</div>
            {item.itemId && <div className="text-xs text-zinc-500">Item-ID {item.itemId}</div>}
          </div>
          <div className="relative grid grid-cols-2 gap-2">
            <label className="grid gap-1"><span className={LABEL}>{t("Mindestpreis (Kinah)", "Minimum price (Kinah)")}</span><input autoFocus className={INPUT} inputMode="numeric" value={low} onChange={(e) => setLow(e.target.value)} placeholder="?" /></label>
            <label className="grid gap-1"><span className={LABEL}>{t("Höchstpreis (Kinah)", "Maximum price (Kinah)")}</span><input className={INPUT} inputMode="numeric" value={high} onChange={(e) => setHigh(e.target.value)} placeholder="?" /></label>
            <label className="grid gap-1"><span className={LABEL}>{t("Aktueller Preis (Regler)", "Current price (slider)")}</span><input className={INPUT} inputMode="numeric" value={ref} onChange={(e) => setRef(e.target.value)} placeholder="–" /></label>
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

