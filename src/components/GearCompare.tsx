"use client";
import { useMemo, useState } from "react";
import type { Character, Item, StatLine } from "@/lib/types";
import { compareIdeal, type MatchState } from "@/lib/compare";
import { buildPlan } from "@/lib/advisor";
import { iconFor, localIcon, type CatalogItem, ALL_ITEMS } from "@/lib/knowledge/item-catalog";
import { PUBLIC_ITEMS, REGION_LABEL, regionStatus } from "@/lib/region";
import { CATALOG_SLOTS, fitsClass } from "@/lib/slot-map";
import { GradeBadge } from "./GradeBadge";
import { ItemIcon, SkillIcon, Sheet, isSkillLine } from "./ui";
import { usePlanned } from "./plan-store";
import { statLabel } from "@/lib/stat-names";

type Row = { name: string; have?: StatLine; target?: string; state: MatchState | "extra" };

/** Current lines and BiS targets merged into one ordered list (BiS order first, then extra lines). */
function rowsFor(item: Item): Row[] {
  const cmp = compareIdeal(item);
  if (!cmp) return item.lines.map((l) => ({ name: l.name, have: l, state: "extra" }));
  return [
    ...cmp.rows.map((r) => ({ name: r.name, have: r.have, target: r.target, state: r.state })),
    ...cmp.extra.map((l) => ({ name: l.name, have: l, state: "extra" as const })),
  ];
}

const STATE: Record<Row["state"], { dot: string; text: string }> = {
  ok: { dot: "bg-emerald-400", text: "text-emerald-200" },
  low: { dot: "bg-amber-400", text: "text-amber-200" },
  missing: { dot: "bg-rose-400", text: "text-rose-200" },
  extra: { dot: "bg-zinc-500", text: "text-zinc-300" },
};

/**
 * Ist vs. Soll for one equipment slot: two equal columns whose rows line up
 * (same slot, same ability, same stat at the same height), then "Noch zu tun".
 */
export function GearCompare({ char, item, slotId, label, wide, onClose }: {
  char: Character; item: Item; slotId: string; label: string; wide: boolean; onClose: () => void;
}) {
  const charKey = `${char.region}/${char.server}/${char.name}`.toLowerCase();
  const { planned, setPlanned } = usePlanned(charKey);
  const plannedItem = planned[slotId] ? ALL_ITEMS.find((i) => i.key === planned[slotId]) : undefined;
  // a stored choice that is not (or no longer) released for EU / Global is not shown
  const target = plannedItem && regionStatus(plannedItem) === "eu" ? plannedItem : undefined;
  const [picking, setPicking] = useState(false);

  const cmp = compareIdeal(item);
  const rows = rowsFor(item);
  const skills = rows.filter((r) => isSkillLine(r.target ?? r.have?.value ?? ""));
  const stats = rows.filter((r) => !skills.includes(r));
  // crafted / exceeded gear carries a 6th stat line: shown as the highlighted purple row
  const statLines = item.lines.filter((l) => !isSkillLine(l.value));
  const craftedName = statLines.length >= 6 ? statLines[5].name : undefined;
  if (craftedName) stats.sort((a, b) => Number(a.name === craftedName) - Number(b.name === craftedName));
  const step = buildPlan(char).steps.find((s) => s.item === item);
  const isBis = item.grade === "BiS";
  const todo = [
    ...(cmp?.rows.filter((r) => r.state === "missing").map((r) => `${r.name} ${r.target} fehlt`) ?? []),
    ...(cmp?.rows.filter((r) => r.state === "low").map((r) => `${r.name}: ${r.have?.value} → ${r.target}`) ?? []),
    ...(cmp?.extra.map((l) => `${l.name} ${l.value} ${item.fixedLines ? "ist fest (Teil ersetzen)" : "neu rollen"}`) ?? []),
  ];

  return (
    <div className={`flex h-full max-h-[inherit] flex-col overflow-hidden border border-sky-200/10 bg-[#07101f]/80 shadow-2xl shadow-sky-900/30 backdrop-blur-2xl ${wide ? "rounded-3xl" : "rounded-t-3xl"}`}>
      <div className="flex items-center justify-between gap-3 px-5 pb-2 pt-4">
        <div className="text-[11px] uppercase tracking-[0.25em] text-sky-300/80">{label}</div>
        <button onClick={onClose} aria-label="Schließen" className="rounded-full bg-white/5 px-2.5 py-1 text-sm text-zinc-300 hover:bg-white/10">✕</button>
      </div>

      <div className="overflow-y-auto px-4 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:px-5">
        {/* column headers */}
        <div className="sticky top-0 z-[1] grid grid-cols-2 gap-3 bg-[#07101f]/95 pb-2 pt-1 backdrop-blur">
          <div className="rounded-xl border border-sky-300/20 bg-sky-300/[0.06] px-3 py-2 text-sm font-semibold tracking-wide text-sky-100">Ist-Stand</div>
          <div className="rounded-xl border border-amber-300/25 bg-amber-300/[0.06] px-3 py-2 text-sm font-semibold tracking-wide text-amber-100">Soll-Stand</div>
        </div>

        {/* equipped vs. planned item */}
        <div className="grid grid-cols-2 gap-3">
          <ItemCell icon={iconFor(item)} name={item.name} grade={item.grade} score={item.score} enhance={item.enhance} />
          {target ? (
            <ItemCell icon={localIcon(target.icon)} name={target.name} meta={[target.source, target.rarity].filter(Boolean).join(" · ")}
              action={<button onClick={() => setPicking(true)} className="text-[11px] text-amber-200/80 underline-offset-2 hover:underline">ändern</button>} />
          ) : isBis ? (
            <ItemCell icon={iconFor(item)} name={item.name} grade="BiS" enhance={item.enhance} meta="Schon BiS"
              action={<button onClick={() => setPicking(true)} className="text-[11px] text-amber-200/80 underline-offset-2 hover:underline">anderes Ziel</button>} />
          ) : (
            <button onClick={() => setPicking(true)}
              className="flex min-h-[76px] items-center gap-3 rounded-2xl border border-dashed border-amber-300/30 bg-amber-300/[0.03] px-3 text-left hover:bg-amber-300/[0.07]">
              <ItemIcon name="Offen" size={44} />
              <span><span className="block text-sm font-semibold text-amber-100">Offen</span><span className="block text-[11px] text-zinc-400">Ziel-Item wählen</span></span>
            </button>
          )}
        </div>

        {skills.length > 0 && <Section title="Fähigkeiten">{skills.map((r) => <CompareRow key={r.name} row={r} skill />)}</Section>}
        <Section title="Werte">
          {stats.length ? stats.map((r) => <CompareRow key={r.name} row={r} crafted={r.name === craftedName} />) : <EmptyRow />}
        </Section>

        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-zinc-500">
          <Legend cls="bg-emerald-400" label="erreicht" /><Legend cls="bg-amber-400" label="zu niedrig" />
          <Legend cls="bg-rose-400" label="fehlt" /><Legend cls="bg-zinc-500" label="nicht im BiS" />
          {craftedName && <span className="flex items-center gap-1.5"><span className="h-2.5 w-4 rounded-sm bg-violet-500/50" />Crafting-Bonus</span>}
        </div>

        {/* to-do, full width */}
        <div className="mt-5 rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4">
          <div className="mb-2 text-[11px] uppercase tracking-[0.25em] text-sky-300/80">Noch zu tun</div>
          {isBis ? (
            <p className="text-sm text-amber-200">Nichts mehr. Dieses Teil ist BiS.</p>
          ) : todo.length ? (
            <ul className="space-y-1.5 text-sm text-zinc-200">
              {todo.map((t) => <li key={t} className="flex gap-2"><span className="text-sky-400">•</span><span>{t}</span></li>)}
            </ul>
          ) : (
            <p className="text-sm text-zinc-300">{step?.title ?? "Für dieses Teil liegt kein BiS-Ziel vor."}</p>
          )}
        </div>
      </div>

      <ItemPicker open={picking} onClose={() => setPicking(false)} slot={item.slot} className={char.className}
        current={target?.key} onPick={(k) => { setPlanned(slotId, k); setPicking(false); }} />
    </div>
  );
}

function ItemCell({ icon, name, grade, score, enhance, meta, action }: {
  icon?: string; name: string; grade?: Item["grade"]; score?: number; enhance?: number; meta?: string; action?: React.ReactNode;
}) {
  return (
    <div className="flex min-h-[76px] items-center gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.03] px-3 py-2.5">
      <ItemIcon src={icon} name={name} grade={grade ?? "?"} enhance={enhance} size={44} />
      <div className="min-w-0">
        <div className="line-clamp-2 text-sm font-semibold leading-snug text-white">{name}</div>
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          {grade && grade !== "?" && <GradeBadge grade={grade} score={score} size="sm" />}
          {meta && <span className="truncate text-[11px] text-zinc-400">{meta}</span>}
          {action}
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-4">
      <div className="mb-1.5 text-[11px] uppercase tracking-[0.2em] text-zinc-500">{title}</div>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

/**
 * One line, the same stat on both sides at the same height.
 * Style follows the in-game tooltip: name left, value right with an "N" badge (max) or "▲ gain".
 * The crafted bonus line (6th stat of crafted / exceeded gear) is a highlighted purple row.
 */
function CompareRow({ row, skill, crafted }: { row: Row; skill?: boolean; crafted?: boolean }) {
  const st = STATE[row.state];
  const have = row.have?.value;
  const label = skill ? row.name : statLabel(row.name);
  const base = crafted
    ? "bg-gradient-to-r from-violet-500/35 via-violet-500/20 to-violet-500/5 ring-1 ring-violet-300/30"
    : "bg-white/[0.035]";
  const name = (dim?: boolean) => (
    <span className="flex min-w-0 items-center gap-2">
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${st.dot}`} />
      {skill && <SkillIcon name={row.name} size={18} />}
      <span className={`truncate font-semibold ${dim ? "text-zinc-500" : crafted ? "text-violet-50" : "text-zinc-100"}`}>{label}</span>
    </span>
  );
  // stats show only which line sits on the item and which line should; skills keep their level
  const left = skill ? (have ?? "Leer") : !have ? "Leer" : row.state === "ok" ? "✓" : row.state === "low" ? "zu niedrig" : row.state === "extra" ? "nicht im BiS" : "";
  const right = skill ? (row.target ?? (row.state === "extra" ? "–" : "Offen")) : row.target ? "Ziel" : row.state === "extra" ? "–" : "Offen";
  const leftCls = !have ? "text-zinc-500" : row.state === "ok" ? "text-emerald-300" : row.state === "low" ? "text-amber-300" : "text-zinc-400";
  return (
    <div className="grid grid-cols-2 gap-3">
      <div className={`flex min-h-[38px] items-center justify-between gap-2 rounded-lg px-3 py-1.5 text-[13px] sm:text-sm ${base}`}>
        {name(!have)}
        <span className={`shrink-0 text-[12px] font-semibold tabular-nums ${skill && have ? "text-white" : leftCls}`}>{left}</span>
      </div>
      <div className={`flex min-h-[38px] items-center justify-between gap-2 rounded-lg px-3 py-1.5 text-[13px] sm:text-sm ${crafted ? base : "bg-amber-200/[0.035]"}`}>
        {name(!row.target)}
        <span className={`shrink-0 text-[12px] font-semibold tabular-nums ${row.target ? (skill ? "text-white" : "text-amber-200/80") : "text-zinc-500"}`}>{right}</span>
      </div>
    </div>
  );
}

function EmptyRow() {
  return (
    <div className="grid grid-cols-2 gap-3 text-sm">
      <div className="rounded-xl bg-white/[0.04] px-3 py-2 text-zinc-500">Leer</div>
      <div className="rounded-xl bg-amber-200/[0.04] px-3 py-2 text-zinc-500">Offen</div>
    </div>
  );
}

function Legend({ cls, label }: { cls: string; label: string }) {
  return <span className="flex items-center gap-1.5"><span className={`h-2 w-2 rounded-full ${cls}`} />{label}</span>;
}

/** Choose the planned item for a slot – only from the released EU / Global selection. */
function ItemPicker({ open, onClose, slot, className, current, onPick }: {
  open: boolean; onClose: () => void; slot: Item["slot"]; className?: string; current?: string; onPick: (key: string | undefined) => void;
}) {
  const [q, setQ] = useState("");
  const options = useMemo(() => {
    const slots = CATALOG_SLOTS[slot] ?? [];
    return PUBLIC_ITEMS.filter((i: CatalogItem) => slots.includes(i.slot) && fitsClass(i.slot, className) && (!q || i.name.toLowerCase().includes(q.toLowerCase())))
      .sort((a, b) => (b.level ?? 0) - (a.level ?? 0) || a.name.localeCompare(b.name));
  }, [slot, className, q]);
  return (
    <Sheet open={open} onClose={onClose} title={<h2 className="text-lg font-semibold">Ziel-Item wählen</h2>}>
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Suchen…"
        className="mb-3 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-base outline-none focus:border-amber-400" />
      <ul className="space-y-1.5">
        {options.map((i) => (
          <li key={i.key}>
            <button onClick={() => onPick(i.key)}
              className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2 text-left hover:bg-white/[0.06] ${current === i.key ? "border-amber-300/50 bg-amber-300/[0.06]" : "border-white/10"}`}>
              <ItemIcon src={localIcon(i.icon)} name={i.name} size={36} />
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">{i.name}</span>
                <span className="block truncate text-[11px] text-zinc-500">{[i.source, i.slot, i.level && `Lv ${i.level}`, i.rarity].filter(Boolean).join(" · ")}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
      {options.length === 0 && <p className="text-sm text-zinc-400">Für diesen Slot ist noch kein Item für EU / Global bestätigt.</p>}
      <p className="mt-3 text-[11px] text-zinc-500">Es werden nur Items angezeigt, die als „{REGION_LABEL.eu}“ geprüft sind.</p>
      {current && <button onClick={() => onPick(undefined)} className="mt-3 w-full rounded-lg bg-white/5 py-2.5 text-sm text-zinc-300">Ziel zurücksetzen</button>}
    </Sheet>
  );
}
