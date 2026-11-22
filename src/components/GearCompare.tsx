"use client";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from "react";
import type { Character, Grade, Item } from "@/lib/types";
import { compareIdeal } from "@/lib/compare";
import { slotLines, statLinks, type LinePair, type LinkColor, type Verdict } from "@/lib/slot-lines";
import type { StatLine } from "@/lib/types";
import { buildPlan } from "@/lib/advisor";
import { iconFor, localIcon, type CatalogItem, ALL_ITEMS } from "@/lib/knowledge/item-catalog";
import { PUBLIC_ITEMS, REGION_LABEL, regionStatus } from "@/lib/region";
import { CATALOG_SLOTS, fitsClass } from "@/lib/slot-map";
import { ItemIcon, SkillIcon, Sheet } from "./ui";
import { usePlanned } from "./plan-store";
import { craftedBis } from "@/lib/crafted-bis";
import { statLabel } from "@/lib/stat-names";
import { Card, CardArt, Filler, SHOW_ITEM_ICONS } from "./deck/Card";
import { SLOT_LABEL_DE } from "@/lib/knowledge/slots";
import { GRADE_HEX_CSS } from "@/lib/grades";

const LINK: Record<LinkColor, { hex: string; dot: string; mark: string; markCls: string }> = {
  green: { hex: "#34d399", dot: "bg-emerald-400", mark: "✓", markCls: "text-emerald-300" },
  orange: { hex: "#ff9a2e", dot: "bg-orange-400", mark: "Platz", markCls: "text-orange-300" },
  red: { hex: "#ff3b3b", dot: "bg-rose-400", mark: "✕", markCls: "text-rose-300" },
};

const VERDICT: Record<Verdict, { dot: string; mark: string; markCls: string; arrow?: string }> = {
  right: { dot: "bg-emerald-400", mark: "✓", markCls: "text-emerald-300", arrow: "#34d399" },
  half: { dot: "bg-orange-400", mark: "Platz", markCls: "text-orange-300", arrow: "#ff9a2e" },
  wrong: { dot: "bg-rose-400", mark: "✕", markCls: "text-rose-300", arrow: "#ff3b3b" },
  empty: { dot: "bg-rose-400", mark: "Leer", markCls: "text-zinc-500", arrow: "#ff3b3b" },
  none: { dot: "bg-zinc-500", mark: "", markCls: "text-zinc-500" },
};

type Side = "ist" | "soll";

/** One arrow between the cards: from a row on the Ist card to a row on the Soll card. */
interface Link { key: string; from: string; to: string; color: string }

/**
 * Ist vs. Soll for one gear piece as two cards side by side. Skills sit at the same height on both cards.
 * Stats keep their own order on each card (Ist as on the item, Soll in BiS order); arrows connect them:
 * green = right stat, orange = unlock stat not on the last line, red = wrong stat (points to a missing BiS stat).
 * "Noch zu tun" follows in full width.
 */
export function GearCompare({ char, item, slotId }: {
  char: Character; item: Item; slotId: string; label?: string;
}) {
  // opening: the Ist card appears first, moves to the left, then the BiS card opens on the right
  const [stage, setStage] = useState(0);
  const gridRef = useRef<HTMLDivElement>(null);
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
  const skills = useMemo(() => slotLines(item).skills, [item]);
  const stats = useMemo(() => statLinks(item), [item]);
  const istStats = useMemo(() => stats?.ist ?? item.lines.filter((l) => !/^\+\d+$/.test(l.value.trim())), [stats, item]);
  const links = useMemo<Link[]>(() => [
    ...skills.flatMap((p) => VERDICT[p.verdict].arrow ? [{ key: `k:${p.key}`, from: `k:${p.key}`, to: `k:${p.key}`, color: VERDICT[p.verdict].arrow! }] : []),
    ...(stats?.links ?? []).filter((l) => l.to >= 0).map((l) => ({ key: `s:${l.from}`, from: `s:${l.from}`, to: `s:${l.to}`, color: LINK[l.color].hex })),
  ], [skills, stats]);
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

  const istColor = (i: number) => stats?.links.find((l) => l.from === i)?.color;
  const section = (side: Side) => (
    <>
      {skills.length > 0 && <RowList title="Fähigkeiten" pairs={skills} side={side} skill />}
      <div className="relative mt-3">
        <div className="mb-1.5 text-[10px] uppercase tracking-[0.22em] text-zinc-500">Werte / Stats</div>
        <div className="space-y-1">
          {side === "ist"
            ? (istStats.length ? istStats.map((l, i) => <IstStat key={i} id={`s:${i}`} line={l} color={stats ? istColor(i) : undefined} unlockSlot={!!stats && i === istStats.length - 1} />)
              : <EmptyRow>Leer</EmptyRow>)
            : (stats?.bis.length ? stats.bis.map((b, i) => <BisStat key={i} id={`s:${i}`} name={b.name} missing={b.missing} unlock={i === stats.bis.length - 1} />)
              : <EmptyRow>Offen</EmptyRow>)}
        </div>
      </div>
    </>
  );


  const istInfo = [SLOT_LABEL_DE[item.slot], item.level && `IL ${item.level}`].filter(Boolean).join(" · ");
  const istSub = [item.enhance !== undefined && `+${item.enhance}`, item.exceed && `Überschreitung ${item.exceed}`, item.rarity].filter(Boolean).join(" · ");
  const sollItem = target ?? bisCraft;
  const sollInfo = sollItem ? [SLOT_LABEL_DE[item.slot], sollItem.level && `IL ${sollItem.level}`].filter(Boolean).join(" · ") : SLOT_LABEL_DE[item.slot];
  const sollSub = sollItem ? [sollItem.source, sollItem.rarity].filter(Boolean).join(" · ") : soll?.meta ?? "";

  return (
    <div className="space-y-5">
      <div ref={gridRef} className="relative grid grid-cols-2 gap-10 [--gap:2.5rem] sm:gap-20 sm:[--gap:5rem]">
        {stage === 1 && <Arrows container={gridRef} links={links} />}
        {/* Ist-Stand */}
        <div className="transition-transform duration-500 ease-out motion-reduce:transition-none"
          style={{ transform: stage ? "none" : "translateX(calc(50% + var(--gap) / 2))" }}>
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
        <span className="flex items-center gap-1.5"><Arrowlet color="#34d399" />richtiger Stat</span>
        <span className="flex items-center gap-1.5"><Arrowlet color="#ff9a2e" />richtiger Stat, falscher Slot (Freischalt-Stat nicht auf dem letzten Platz)</span>
        <span className="flex items-center gap-1.5"><Arrowlet color="#ff3b3b" />falscher Stat (zeigt auf den fehlenden BiS-Stat)</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-4 rounded-sm bg-violet-500/50" />Freischalt-Stat (gehört auf den letzten Platz)</span>
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

function RowList({ title, pairs, side, skill }: { title: string; pairs: LinePair[]; side: Side; skill?: boolean }) {
  return (
    <div className="relative mt-3">
      <div className="mb-1.5 text-[10px] uppercase tracking-[0.22em] text-zinc-500">{title}</div>
      <div className="space-y-1">
        {pairs.length ? pairs.map((p) => <CompareRow key={p.key} pair={p} side={side} skill={skill} />)
          : <div className="flex h-9 items-center rounded-lg bg-white/[0.035] px-2.5 text-[12px] text-zinc-500">{side === "ist" ? "Leer" : "Offen"}</div>}
      </div>
    </div>
  );
}

/** One line. Ist shows the stat that sits on the item at this height, Soll the BiS stat; skills keep their level. */
function CompareRow({ pair, side, skill }: { pair: LinePair; side: Side; skill?: boolean }) {
  const v = VERDICT[pair.verdict];
  const line = side === "ist" ? pair.ist : pair.bis;
  const label = line ? (skill ? line.name : statLabel(line.name)) : side === "ist" ? "Leer" : "Offen";
  const mark = side === "ist"
    ? (skill && pair.ist ? pair.ist.value : pair.ist ? v.mark : "")
    : (skill && pair.bis ? pair.bis.value : pair.bis ? "◆" : "–");
  const markCls = side === "ist" ? (skill && pair.ist ? "text-white" : v.markCls) : pair.bis ? (skill ? "text-white" : "text-[#ffd54a]") : "text-zinc-500";
  const bg = pair.unlock ? "bg-gradient-to-r from-violet-500/35 via-violet-500/20 to-violet-500/5 ring-1 ring-violet-300/30" : "bg-white/[0.035]";
  return (
    <div data-pair={`${side}:k:${pair.key}`} className={`flex h-9 items-center justify-between gap-1.5 rounded-lg px-2 text-[12px] sm:px-2.5 sm:text-[13px] ${bg}`}>
      <span className="flex min-w-0 items-center gap-1.5">
        <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${side === "ist" ? v.dot : "bg-[#ffd54a]/70"}`} />
        {skill && line && <SkillIcon name={line.name} size={16} />}
        <span className={`truncate font-medium ${line ? (pair.unlock ? "text-violet-50" : "text-zinc-100") : "text-zinc-500"}`}>{label}</span>
      </span>
      <span className={`shrink-0 text-[11px] font-semibold tabular-nums ${markCls}`}>{mark}</span>
    </div>
  );
}

function EmptyRow({ children }: { children: React.ReactNode }) {
  return <div className="flex h-9 items-center rounded-lg bg-white/[0.035] px-2.5 text-[12px] text-zinc-500">{children}</div>;
}

/** A stat line of the current item, in the order it sits on the item. The last row is the unlock slot. */
function IstStat({ id, line, color, unlockSlot }: { id: string; line: StatLine; color?: LinkColor; unlockSlot: boolean }) {
  const v = color ? LINK[color] : undefined;
  return (
    <div data-pair={`ist:${id}`} className={`flex h-9 items-center justify-between gap-1.5 rounded-lg bg-white/[0.035] px-2 text-[12px] sm:px-2.5 sm:text-[13px] ${unlockSlot ? "ring-1 ring-violet-300/30" : ""}`}>
      <span className="flex min-w-0 items-center gap-1.5">
        <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${v?.dot ?? "bg-zinc-500"}`} />
        <span className="truncate font-medium text-zinc-100">{statLabel(line.name)}</span>
      </span>
      {v && <span className={`shrink-0 text-[11px] font-semibold ${v.markCls}`}>{v.mark}</span>}
    </div>
  );
}

/** A BiS stat line, in BiS order. The last one is the unlockable stat. */
function BisStat({ id, name, missing, unlock }: { id: string; name: string; missing: boolean; unlock: boolean }) {
  const bg = unlock ? "bg-gradient-to-r from-violet-500/35 via-violet-500/20 to-violet-500/5 ring-1 ring-violet-300/30" : "bg-white/[0.035]";
  return (
    <div data-pair={`soll:${id}`} className={`flex h-9 items-center justify-between gap-1.5 rounded-lg px-2 text-[12px] sm:px-2.5 sm:text-[13px] ${bg}`}>
      <span className="flex min-w-0 items-center gap-1.5">
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#ffd54a]/70" />
        <span className={`truncate font-medium ${unlock ? "text-violet-50" : "text-zinc-100"}`}>{statLabel(name)}</span>
      </span>
      <span className={`shrink-0 text-[11px] font-semibold ${missing ? "text-rose-300/80" : "text-[#ffd54a]"}`}>{missing ? "fehlt" : "◆"}</span>
    </div>
  );
}

function Arrowlet({ color }: { color: string }) {
  return <svg width="18" height="8" viewBox="0 0 18 8" aria-hidden><path d="M0 4h14" stroke={color} strokeWidth="1.6" /><path d="M12 1l4 3-4 3" fill="none" stroke={color} strokeWidth="1.6" /></svg>;
}

/** Arrows in the gap between the cards, from an Ist row to a Soll row. Rows at different heights get a curve. */
function Arrows({ container, links }: { container: RefObject<HTMLDivElement | null>; links: Link[] }) {
  const [paths, setPaths] = useState<{ key: string; d: string; head: string; color: string }[]>([]);
  useLayoutEffect(() => {
    const root = container.current;
    if (!root) return;
    const measure = () => {
      const box = root.getBoundingClientRect();
      const out: typeof paths = [];
      for (const l of links) {
        const a = root.querySelector<HTMLElement>(`[data-pair="ist:${CSS.escape(l.from)}"]`);
        const b = root.querySelector<HTMLElement>(`[data-pair="soll:${CSS.escape(l.to)}"]`);
        if (!a || !b) continue;
        const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect();
        const x1 = ra.right - box.left + 3, x2 = rb.left - box.left - 4;
        const y1 = ra.top + ra.height / 2 - box.top, y2 = rb.top + rb.height / 2 - box.top;
        const c = (x2 - x1) * 0.55;
        // the line ends where the arrow head starts, the head points straight right into the BiS row
        out.push({
          key: l.key, color: l.color,
          d: Math.abs(y2 - y1) < 1 ? `M${x1} ${y1}H${x2 - 1}` : `M${x1} ${y1}C${x1 + c} ${y1} ${x2 - c} ${y2} ${x2 - 1} ${y2}`,
          head: `M${x2 - 5} ${y2 - 3.5}L${x2} ${y2}L${x2 - 5} ${y2 + 3.5}`,
        });
      }
      setPaths(out);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(root);
    const t = setTimeout(measure, 600); // after the cards have settled
    return () => { ro.disconnect(); clearTimeout(t); };
  }, [container, links]);
  return (
    <svg className="pointer-events-none absolute inset-0 z-10 h-full w-full overflow-visible" aria-hidden>
      {paths.map((p) => (
        <g key={p.key} stroke={p.color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none" style={{ filter: `drop-shadow(0 0 3px ${p.color})` }}>
          <path d={p.d} />
          <path d={p.head} />
        </g>
      ))}
    </svg>
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
