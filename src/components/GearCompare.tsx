"use client";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from "react";
import type { Character, Grade, Item } from "@/lib/types";
import { compareIdeal, toNum } from "@/lib/compare";
import { isSkillValue, statLinks, type LinkColor } from "@/lib/slot-lines";
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



/** One arrow between the cards: from a row on the Ist card to a row on the Soll card. */
interface Link { key: string; from: string; to: string; color: string }

/**
 * Ist vs. Soll for one gear piece as two cards side by side. All lines (stats and skills) keep their own order
 * on each card (Ist as on the item, Soll in BiS order). Once both cards stand, arrows grow out of the Ist lines:
 * green = right, orange = wrong place (only the last place matters), red = wrong line (points to a missing BiS line).
 * "Noch zu tun" follows in full width.
 */
export function GearCompare({ char, item, slotId }: {
  char: Character; item: Item; slotId: string; label?: string;
}) {
  // opening: the Ist card appears first, moves to the left, then the BiS card opens on the right
  const [stage, setStage] = useState(0);
  const gridRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const t1 = setTimeout(() => setStage(1), 220);
    const t2 = setTimeout(() => setStage(2), 220 + 560);
    return () => { clearTimeout(t1); clearTimeout(t2); };
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
  const stats = useMemo(() => statLinks(item), [item]);
  // Arcana: the place of an ability does not matter, its plus level does
  const arcana = item.slot === "arcana";
  const istStats = stats?.ist ?? item.lines;
  const links = useMemo<Link[]>(() => (stats?.links ?? []).filter((l) => l.to >= 0)
    .map((l) => ({ key: `s:${l.from}`, from: `s:${l.from}`, to: `s:${l.to}`, color: LINK[l.color].hex })), [stats]);
  const step = buildPlan(char).steps.find((s) => s.item === item);
  const isBis = item.grade === "BiS";
  const todo = [
    ...(cmp?.rows.filter((r) => r.state === "missing").map((r) => `${r.name} ${r.target} fehlt`) ?? []),
    ...(cmp?.rows.filter((r) => r.state === "low").map((r) => `${r.name}: ${r.have?.value} → ${r.target}`) ?? []),
    // Arcana: a plus above the ideal is wasted too
    ...(arcana ? cmp?.rows.filter((r) => r.have && toNum(r.have.value) > toNum(r.target)).map((r) => `${r.name}: ${r.have?.value} → ${r.target} (zu hoch)`) ?? [] : []),
    ...(cmp?.extra.map((l) => `${l.name} ${l.value} ${item.fixedLines ? "ist fest (Teil ersetzen)" : "neu rollen"}`) ?? []),
  ];

  // the target piece shown on the Soll card
  const soll: { icon?: string; name: string; meta: string; grade: Grade } | undefined = target
    ? { icon: localIcon(target.icon), name: target.name, meta: [target.source, target.rarity].filter(Boolean).join(" · "), grade: "BiS" }
    : bisCraft
      ? { icon: localIcon(bisCraft.icon), name: bisCraft.name, meta: wearsBisCraft ? "Schon BiS · höchstes Crafting" : `Höchstes Crafting · IL ${bisCraft.level}`, grade: "BiS" }
      : isBis ? { icon: iconFor(item), name: item.name, meta: "Schon BiS", grade: "BiS" }
        // Arcana: the target is the same card with the ideal abilities, so it shows the same picture
        : arcana && stats ? { icon: iconFor(item), name: item.name, meta: "Ideale Fähigkeiten", grade: "BiS" } : undefined;

  const istColor = (i: number) => stats?.links.find((l) => l.from === i)?.color;
  const section = (side: "ist" | "soll") => (
    <>
      <div className="relative mt-3">
        <div className="mb-1.5 text-[10px] uppercase tracking-[0.22em] text-zinc-500"><span className="sm:hidden">Werte</span><span className="hidden sm:inline">Werte / Fähigkeiten</span></div>
        <div className="space-y-1">
          {side === "ist"
            ? (istStats.length ? istStats.map((l, i) => <IstStat key={i} id={`s:${i}`} line={l} color={stats ? istColor(i) : undefined} unlockSlot={!arcana && !!stats && i === istStats.length - 1} plus={arcana} />)
              : <EmptyRow>Leer</EmptyRow>)
            : (stats?.bis.length ? stats.bis.map((b, i) => <BisStat key={i} id={`s:${i}`} name={b.name} skill={b.skill} missing={b.missing} unlock={!arcana && i === stats.bis.length - 1} plus={arcana ? b.value : undefined} />)
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
        {stage === 2 && <Arrows container={gridRef} links={links} />}
        {/* Ist-Stand */}
        <div className="transition-transform duration-500 ease-out motion-reduce:transition-none"
          style={{ transform: stage >= 1 ? "none" : "translateX(calc(50% + var(--gap) / 2))" }}>
          <Card grade={item.grade} className="flex h-full flex-col p-3 sm:p-5">
            <CardHead title="Ist-Stand" rank={item.grade} />
            <ItemBlock icon={SHOW_ITEM_ICONS ? iconFor(item) : undefined} grade={item.grade} name={item.name} info={istInfo} sub={istSub} />
            {section("ist")}
            <CardFoot>Aktuell ausgerüstet</CardFoot>
          </Card>
        </div>

        {/* Soll-Stand / BiS */}
        <div className="transition-all duration-500 ease-out motion-reduce:transition-none"
          style={{ opacity: stage >= 1 ? 1 : 0, transform: stage >= 1 ? "none" : "translateX(1.5rem)" }}>
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
        {arcana ? <>
          <span className="flex items-center gap-1.5"><Arrowlet color="#34d399" />richtige Fähigkeit mit genau dem idealen Plus</span>
          <span className="flex items-center gap-1.5"><Arrowlet color="#ff9a2e" />richtige Fähigkeit, Plus zu niedrig oder zu hoch</span>
          <span className="flex items-center gap-1.5"><Arrowlet color="#ff3b3b" />falsche Fähigkeit (zeigt auf das, was fehlt)</span>
          <span>Bei Arcana ist der Platz egal.</span>
        </> : <>
          <span className="flex items-center gap-1.5"><Arrowlet color="#34d399" />richtig</span>
          <span className="flex items-center gap-1.5"><Arrowlet color="#ff9a2e" />richtig, aber falscher Platz (nur der letzte Platz zählt)</span>
          <span className="flex items-center gap-1.5"><Arrowlet color="#ff3b3b" />falsch (zeigt auf das, was fehlt)</span>
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-4 rounded-sm bg-violet-500/50" />Freischalt-Zeile (gehört auf den letzten Platz)</span>
        </>}
      </div>

      <Card grade="?" className="p-4 sm:p-5">
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.25em] text-[#beac80]">Noch zu tun</div>
        {isBis && !(arcana && todo.length) ? (
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

function EmptyRow({ children }: { children: React.ReactNode }) {
  return <div className="flex h-9 items-center rounded-lg bg-white/[0.035] px-2.5 text-[12px] text-zinc-500">{children}</div>;
}

/** A line (stat or skill) of the current item, in the order it sits on the item. The last row is the unlock slot. */
function IstStat({ id, line, color, unlockSlot, plus }: { id: string; line: StatLine; color?: LinkColor; unlockSlot: boolean; plus?: boolean }) {
  const v = color ? LINK[color] : undefined;
  return (
    <div data-pair={`ist:${id}`} className={`flex h-9 items-center justify-between gap-1.5 rounded-lg bg-white/[0.035] px-2 text-[12px] sm:px-2.5 sm:text-[13px] ${unlockSlot ? "ring-1 ring-violet-300/30" : ""}`}>
      <span className="flex min-w-0 items-center gap-1.5">
        <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${v?.dot ?? "bg-zinc-500"}`} />
        {isSkillValue(line.value) && <SkillIcon name={line.name} size={16} />}
        <span className="truncate font-medium text-zinc-100">{isSkillValue(line.value) ? line.name : statLabel(line.name)}</span>
      </span>
      {plus ? <span className={`shrink-0 text-[12px] font-semibold tabular-nums ${v?.markCls ?? "text-zinc-300"}`}>{line.value}</span>
        : v && <span className={`shrink-0 text-[11px] font-semibold ${v.markCls}`}>{v.mark}</span>}
    </div>
  );
}

/** A BiS line, in BiS order. The last one is the unlockable line. */
function BisStat({ id, name, skill, missing, unlock, plus }: { id: string; name: string; skill: boolean; missing: boolean; unlock: boolean; plus?: string }) {
  const bg = unlock ? "bg-gradient-to-r from-violet-500/35 via-violet-500/20 to-violet-500/5 ring-1 ring-violet-300/30" : "bg-white/[0.035]";
  return (
    <div data-pair={`soll:${id}`} className={`flex h-9 items-center justify-between gap-1.5 rounded-lg px-2 text-[12px] sm:px-2.5 sm:text-[13px] ${bg}`}>
      <span className="flex min-w-0 items-center gap-1.5">
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#ffd54a]/70" />
        {skill && <SkillIcon name={name} size={16} />}
        <span className={`truncate font-medium ${unlock ? "text-violet-50" : "text-zinc-100"}`}>{skill ? name : statLabel(name)}</span>
      </span>
      {plus ? <span className={`shrink-0 text-[12px] font-semibold tabular-nums ${missing ? "text-rose-300/80" : "text-[#ffd54a]"}`}>{plus}</span>
        : <span className={`shrink-0 text-[11px] font-semibold ${missing ? "text-rose-300/80" : "text-[#ffd54a]"}`}>{missing ? "fehlt" : "◆"}</span>}
    </div>
  );
}

function Arrowlet({ color }: { color: string }) {
  return <svg width="18" height="8" viewBox="0 0 18 8" aria-hidden><path d="M0 4h14" stroke={color} strokeWidth="1.6" /><path d="M12 1l4 3-4 3" fill="none" stroke={color} strokeWidth="1.6" /></svg>;
}

/**
 * Arrows in the gap between the cards, from an Ist line to a Soll line, one smooth curve each with the head
 * drawn in the same stroke. They grow out of the Ist card one after another; a soft glow follows a little later.
 */
function Arrows({ container, links }: { container: RefObject<HTMLDivElement | null>; links: Link[] }) {
  const [paths, setPaths] = useState<{ key: string; d: string; color: string }[]>([]);
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
        const x1 = ra.right - box.left + 2, x2 = rb.left - box.left - 3;
        const y1 = ra.top + ra.height / 2 - box.top, y2 = rb.top + rb.height / 2 - box.top;
        const c = (x2 - x1) * 0.5;
        const f = (n: number) => n.toFixed(1);
        // curve to the tip, then the two wings of the head in one continuous stroke (no sub-paths, so the dash grows in one piece)
        out.push({
          key: l.key, color: l.color,
          d: `M${f(x1)} ${f(y1)}C${f(x1 + c)} ${f(y1)} ${f(x2 - c)} ${f(y2)} ${f(x2)} ${f(y2)}L${f(x2 - 6)} ${f(y2 - 4)}L${f(x2)} ${f(y2)}L${f(x2 - 6)} ${f(y2 + 4)}`,
        });
      }
      setPaths(out);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(root);
    return () => ro.disconnect();
  }, [container, links]);
  return (
    <svg className="pointer-events-none absolute inset-0 z-10 h-full w-full overflow-visible" aria-hidden>
      {paths.map((p, i) => (
        <g key={p.key} stroke={p.color} strokeLinecap="round" strokeLinejoin="round" fill="none" style={{ "--d": `${i * 110}ms` } as React.CSSProperties}>
          <path d={p.d} pathLength={1} strokeWidth="6" className="arrow-glow" />
          <path d={p.d} pathLength={1} strokeWidth="1.8" className="arrow-line" />
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
