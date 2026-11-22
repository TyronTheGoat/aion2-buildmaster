"use client";
import { useEffect, useMemo, useState } from "react";
import type { Character, Grade, Item, StatLine } from "@/lib/types";
import { compareIdeal, type MatchState } from "@/lib/compare";
import { buildPlan } from "@/lib/advisor";
import { iconFor, localIcon, type CatalogItem, ALL_ITEMS } from "@/lib/knowledge/item-catalog";
import { PUBLIC_ITEMS, REGION_LABEL, regionStatus } from "@/lib/region";
import { CATALOG_SLOTS, fitsClass } from "@/lib/slot-map";
import { ItemIcon, SkillIcon, Sheet, isSkillLine } from "./ui";
import { usePlanned } from "./plan-store";
import { craftedBis } from "@/lib/crafted-bis";
import { statLabel } from "@/lib/stat-names";
import { Card, CardArt, Filler, SHOW_ITEM_ICONS } from "./deck/Card";
import { SLOT_LABEL_DE } from "@/lib/knowledge/slots";
import { GRADE_HEX_CSS } from "@/lib/grades";

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

const DOT: Record<Row["state"], string> = { ok: "bg-emerald-400", low: "bg-amber-400", missing: "bg-rose-400", extra: "bg-zinc-500" };

type Side = "ist" | "soll";

/**
 * Ist vs. Soll for one gear piece as two cards side by side. Both cards list the same rows in the same
 * order and height, so a stat sits at the same height on both. "Noch zu tun" follows in full width.
 */
export function GearCompare({ char, item, slotId }: {
  char: Character; item: Item; slotId: string; label?: string;
}) {
  // opening: the Ist card appears first, moves to the left, then the BiS card opens on the right
  const [stage, setStage] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setStage(1), 220);
    return () => clearTimeout(t);
  }, []);
  const charKey = `${char.region}/${char.server}/${char.name}`.toLowerCase();
  const { planned, setPlanned } = usePlanned(charKey);
  const plannedItem = planned[slotId] ? ALL_ITEMS.find((i) => i.key === planned[slotId]) : undefined;
  // a stored choice that is not (or no longer) released for EU / Global is not shown
  const target = plannedItem && regionStatus(plannedItem) === "eu" ? plannedItem : undefined;
  const [picking, setPicking] = useState(false);
  // default target: the highest crafted piece in Global for this slot (class weapon, faction line)
  const bisCraft = craftedBis(char, item.slot);
  const wearsBisCraft = !!bisCraft && bisCraft.name.toLowerCase() === item.name.toLowerCase();

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

  // the target piece shown on the Soll card
  const soll: { icon?: string; name: string; meta: string; grade: Grade } | undefined = target
    ? { icon: localIcon(target.icon), name: target.name, meta: [target.source, target.rarity].filter(Boolean).join(" · "), grade: "BiS" }
    : bisCraft
      ? { icon: localIcon(bisCraft.icon), name: bisCraft.name, meta: wearsBisCraft ? "Schon BiS · höchstes Crafting" : `Höchstes Crafting · IL ${bisCraft.level}`, grade: "BiS" }
      : isBis ? { icon: iconFor(item), name: item.name, meta: "Schon BiS", grade: "BiS" } : undefined;

  const section = (side: Side) => (
    <>
      {skills.length > 0 && <RowList title="Fähigkeiten" rows={skills} side={side} skill />}
      <RowList title="Werte / Stats" rows={stats} side={side} craftedName={craftedName} />
    </>
  );

  const istInfo = [SLOT_LABEL_DE[item.slot], item.level && `IL ${item.level}`].filter(Boolean).join(" · ");
  const istSub = [item.enhance !== undefined && `+${item.enhance}`, item.exceed && `Überschreitung ${item.exceed}`, item.rarity].filter(Boolean).join(" · ");
  const sollItem = target ?? bisCraft;
  const sollInfo = sollItem ? [SLOT_LABEL_DE[item.slot], sollItem.level && `IL ${sollItem.level}`].filter(Boolean).join(" · ") : SLOT_LABEL_DE[item.slot];
  const sollSub = sollItem ? [sollItem.source, sollItem.rarity].filter(Boolean).join(" · ") : soll?.meta ?? "";

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:gap-5">
        {/* Ist-Stand */}
        <div className="transition-transform duration-500 ease-out motion-reduce:transition-none"
          style={{ transform: stage ? "none" : "translateX(calc(50% + 0.625rem))" }}>
          <Card grade={item.grade} className="flex h-full flex-col p-3 sm:p-5">
            <CardHead title="Ist-Stand" rank={item.grade} />
            <ItemBlock icon={SHOW_ITEM_ICONS ? iconFor(item) : undefined} grade={item.grade} name={item.name} info={istInfo} sub={istSub} />
            {section("ist")}
            <CardFoot>Aktuell ausgerüstet</CardFoot>
          </Card>
        </div>

        {/* Soll-Stand / BiS */}
        <div className="transition-all duration-500 ease-out motion-reduce:transition-none"
          style={{ opacity: stage ? 1 : 0, transform: stage ? "none" : "translateX(1.5rem)" }}>
          <Card grade={soll?.grade ?? "?"} className="flex h-full flex-col p-3 sm:p-5">
            <CardHead title="Soll-Stand / BiS" short="Soll / BiS" rank={soll ? "BiS" : undefined} />
            {soll ? (
              <ItemBlock icon={SHOW_ITEM_ICONS ? soll.icon : undefined} grade={soll.grade} name={soll.name} info={sollInfo} sub={sollSub}
                action={<button onClick={() => setPicking(true)} className="text-[11px] text-[#ffd54a]/80 underline-offset-2 hover:underline">{wearsBisCraft ? "Schon BiS · anderes Ziel" : "anderes Ziel"}</button>} />
            ) : (
              <button onClick={() => setPicking(true)} className="block w-full text-left">
                <ItemBlock name="Offen" info={SLOT_LABEL_DE[item.slot]} sub="Ziel-Item wählen" />
              </button>
            )}
            {section("soll")}
            <CardFoot>Ziel-Gegenstand (BiS)</CardFoot>
          </Card>
        </div>
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-zinc-500">
        <span>✓ erreicht</span><span>▲ zu niedrig</span><span>Leer = fehlt</span><span>✕ nicht im BiS</span><span>◆ Ziel</span>
        {craftedName && <span className="flex items-center gap-1.5"><span className="h-2.5 w-4 rounded-sm bg-violet-500/50" />Crafting-Bonus</span>}
      </div>

      <Card grade="?" className="p-4 sm:p-5">
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.25em] text-[#beac80]">Noch zu tun</div>
        {isBis ? (
          <p className="text-sm text-[#ffd54a]">Nichts mehr. Dieses Teil ist BiS.</p>
        ) : todo.length ? (
          <ul className="space-y-1.5 text-sm text-zinc-200">
            {todo.map((t) => <li key={t} className="flex gap-2"><span className="text-[#99e4e2]">•</span><span>{t}</span></li>)}
          </ul>
        ) : (
          <p className="text-sm text-zinc-300">{step?.title ?? "Für dieses Teil liegt kein BiS-Ziel vor."}</p>
        )}
      </Card>

      <ItemPicker open={picking} onClose={() => setPicking(false)} slot={item.slot} className={char.className}
        current={target?.key} onPick={(k) => { setPlanned(slotId, k); setPicking(false); }} />
    </div>
  );
}

function CardHead({ title, short, rank }: { title: string; short?: string; rank?: Grade }) {
  return (
    <div className="relative mb-3 flex items-center justify-between gap-2">
      <div className="truncate text-sm font-semibold text-[#f4eed7] sm:text-lg">{short ? <><span className="sm:hidden">{short}</span><span className="hidden sm:inline">{title}</span></> : title}</div>
      <span className="shrink-0 rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1 text-[11px] text-zinc-300 sm:px-2.5 sm:text-xs">
        Rang: <span className="font-semibold" style={{ color: rank ? GRADE_HEX_CSS[rank] : undefined }}>{rank && rank !== "?" ? rank : "–"}</span>
      </span>
    </div>
  );
}

/** Icon, name, slot / item level, upgrade / rarity. Fixed height so the stat rows start at the same height on both cards. */
function ItemBlock({ icon, grade = "?", name, info, sub, action }: {
  icon?: string; grade?: Grade; name: string; info: string; sub: string; action?: React.ReactNode;
}) {
  return (
    <div className="relative flex h-[200px] flex-col gap-2 sm:h-[124px] sm:flex-row sm:items-start sm:gap-4">
      <div className="w-16 shrink-0 sm:w-[104px]">
        {icon ? <CardArt src={icon} alt={name} grade={grade} /> : <Filler className="aspect-square w-full" />}
      </div>
      <div className="min-w-0">
        <div className="line-clamp-2 text-[13px] font-semibold leading-snug text-[#f4eed7] sm:text-base">{name}</div>
        <div className="mt-0.5 truncate text-[12px] text-zinc-300 sm:text-sm">{info}</div>
        <div className="truncate text-[11px] text-[#beac80]">{sub}</div>
        {action && <div className="mt-0.5">{action}</div>}
      </div>
    </div>
  );
}

function CardFoot({ children }: { children: React.ReactNode }) {
  return <div className="relative mt-auto border-t border-white/[0.07] pt-2.5 text-[11px] text-zinc-500">{children}</div>;
}

function RowList({ title, rows, side, skill, craftedName }: { title: string; rows: Row[]; side: Side; skill?: boolean; craftedName?: string }) {
  return (
    <div className="relative mt-3">
      <div className="mb-1.5 text-[10px] uppercase tracking-[0.22em] text-zinc-500">{title}</div>
      <div className="space-y-1">
        {rows.length ? rows.map((r) => <CompareRow key={r.name} row={r} side={side} skill={skill} crafted={r.name === craftedName} />)
          : <div className="flex h-9 items-center rounded-lg bg-white/[0.035] px-2.5 text-[12px] text-zinc-500">{side === "ist" ? "Leer" : "Offen"}</div>}
      </div>
    </div>
  );
}

/** One line: stats show only which stat sits on the item (Ist) and which should (Soll); skills keep their level. */
function CompareRow({ row, side, skill, crafted }: { row: Row; side: Side; skill?: boolean; crafted?: boolean }) {
  const have = row.have?.value;
  const present = side === "ist" ? !!have : !!row.target;
  const label = skill ? row.name : statLabel(row.name);
  const mark = side === "ist"
    ? (skill && have) || (!have ? "Leer" : row.state === "ok" ? "✓" : row.state === "low" ? "▲" : row.state === "extra" ? "✕" : "")
    : (skill && row.target) || (row.target ? "◆" : row.state === "extra" ? "–" : "Offen");
  const markCls = side === "ist"
    ? (!have ? "text-zinc-500" : skill ? "text-white" : row.state === "ok" ? "text-emerald-300" : row.state === "low" ? "text-amber-300" : "text-zinc-500")
    : (row.target ? (skill ? "text-white" : "text-[#ffd54a]") : "text-zinc-500");
  const bg = crafted ? "bg-gradient-to-r from-violet-500/35 via-violet-500/20 to-violet-500/5 ring-1 ring-violet-300/30" : "bg-white/[0.035]";
  return (
    <div className={`flex h-9 items-center justify-between gap-1.5 rounded-lg px-2 text-[12px] sm:px-2.5 sm:text-[13px] ${bg}`}>
      <span className="flex min-w-0 items-center gap-1.5">
        <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${DOT[row.state]}`} />
        {skill && <SkillIcon name={row.name} size={16} />}
        <span className={`truncate font-medium ${present ? (crafted ? "text-violet-50" : "text-zinc-100") : "text-zinc-500"}`}>{label}</span>
      </span>
      <span className={`shrink-0 text-[11px] font-semibold tabular-nums ${markCls}`}>{mark}</span>
    </div>
  );
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
