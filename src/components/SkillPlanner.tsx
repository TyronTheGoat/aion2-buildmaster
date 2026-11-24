"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Character } from "@/lib/types";
import { refClass, refSkills } from "@/lib/reference/rolls-v3";
import {
  ARCANA_CARD_LEVELS, ARCANA_CARD_LINES, ARCANA_ENHANCE, ARCANA_SKILL_MAX, DAEVANION_MAX, DEFAULT_ORDER, PLACES, STORY_MAX, allowed, alignToCurrent,
  HIGHEST, currentItems, currentLines, diffPlan, placeOf, planSkills, type Goal, type HaveMap, type Line, type NowState, type PieceDiff, type PlaceId, type PlaceRule, type WantState,
} from "@/lib/skill-plan";
import { charKey } from "./store";
import { newBuildId, nowIso, useBuilds } from "./build-store";
import { allPlaced, type OwnBuild } from "@/lib/own-bis";
import { Pic, skillIcon } from "./ClassSkillSetup";
import { iconFor } from "@/lib/knowledge/item-catalog";
import type { Item } from "@/lib/types";

/** Small picture of the piece the character wears there now (kisk), right after the name. */
function PieceIco({ item }: { item?: Item }) {
  const [bad, setBad] = useState(false);
  const src = item ? iconFor(item) : undefined;
  if (!src || bad) return null;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt="" title={item!.name} loading="lazy" onError={() => setBad(true)} className="ml-1.5 inline-block h-5 w-5 shrink-0 rounded object-contain align-[-4px] ring-1 ring-white/10" />;
}

/** Saved per character on this device (offline preview): goals, order / limits of the places, what already stands on them. */
const KEY = "bm:skillplan";
interface Saved { goals: Goal[]; order: PlaceRule[]; have?: HaveMap; compareNow?: boolean }
const load = (k: string): Saved | undefined => { try { return JSON.parse(localStorage.getItem(KEY) ?? "{}")[k]; } catch { return undefined; } };
const save = (k: string, v: Saved) => { try { const all = JSON.parse(localStorage.getItem(KEY) ?? "{}"); all[k] = v; localStorage.setItem(KEY, JSON.stringify(all)); } catch { /* full */ } };

const SEL = "rounded-lg border border-[#d9c58f]/25 bg-[#0d1119] px-2 py-1.5 text-sm text-[#f4eed7] outline-none focus:border-[#d9c58f]/60";
const ICON_BTN = "h-8 w-8 shrink-0 rounded-lg border border-[#d9c58f]/20 text-[#efe6cc] hover:border-[#d9c58f]/50 disabled:opacity-30";
const H = "text-base font-semibold text-[#efe6cc]";
const range = (a: number, b: number) => Array.from({ length: Math.max(0, b - a + 1) }, (_, i) => a + i);

/**
 * Drag to reorder, with mouse and touch: grab a row (on touch: its number), pull it to its new place, let go.
 * Pointer based instead of HTML drag and drop, which phones do not support.
 */
function useSortable<T>(setItems: (f: (l: T[]) => T[]) => void, group: string) {
  const cur = useRef<number | null>(null);
  const [drag, setDrag] = useState<number | null>(null);
  // window listeners: the dragged row moves in the DOM while it is dragged, which would drop a pointer capture
  const move = (e: PointerEvent) => {
    const from = cur.current;
    if (from === null) return;
    e.preventDefault();
    // near the edge of the screen the page scrolls along
    if (e.clientY < 70) window.scrollBy(0, -14); else if (e.clientY > window.innerHeight - 70) window.scrollBy(0, 14);
    const hit = document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLElement>(`[data-sort="${group}"]`);
    const me = document.querySelector<HTMLElement>(`[data-sort="${group}"][data-idx="${from}"]`);
    if (!hit || !me) return;
    const to = Number(hit.dataset.idx);
    if (to === from) return;
    const r = hit.getBoundingClientRect();
    // in the same column only past the middle of the neighbour, so rows of different height do not flip back and forth
    if (Math.abs(r.left - me.getBoundingClientRect().left) < 8 && (to > from ? e.clientY < r.top + r.height / 2 : e.clientY > r.top + r.height / 2)) return;
    setItems((l) => { const n = [...l]; const [x] = n.splice(from, 1); n.splice(to, 0, x); return n; });
    cur.current = to; setDrag(to);
  };
  const end = () => {
    cur.current = null; setDrag(null);
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", end);
    window.removeEventListener("pointercancel", end);
  };
  const row = (i: number) => ({
    "data-sort": group, "data-idx": i,
    onPointerDown: (e: React.PointerEvent<HTMLElement>) => {
      const t = e.target as HTMLElement;
      if (e.button !== 0 || t.closest("select,button,input")) return;
      if (e.pointerType !== "mouse" && !t.closest("[data-grip]")) return;
      e.preventDefault();
      cur.current = i; setDrag(i);
      window.addEventListener("pointermove", move, { passive: false });
      window.addEventListener("pointerup", end);
      window.addEventListener("pointercancel", end);
    },
  });
  return { drag, row };
}

/** Number badge that is also the grip. */
const Grip = ({ n, gold }: { n: number; gold?: boolean }) => (
  <span data-grip title="Ziehen zum Verschieben" className={`flex h-7 shrink-0 cursor-grab touch-none items-center gap-0.5 rounded-full px-1.5 text-sm font-bold active:cursor-grabbing ${gold ? "bg-[#d9c58f] text-[#14110a]" : "bg-white/[0.06] text-zinc-300"}`}>
    <span aria-hidden className="text-[10px] opacity-60">⠿</span>{n}
  </span>
);

/** Skill icon from the class guide pictures (empty square when there is none). */
function SkillIco({ cls, en, size = "h-8 w-8" }: { cls: string; en: string; size?: string }) {
  const f = skillIcon(cls, en);
  return f ? <Pic file={f} alt="" className={`${size} shrink-0 rounded-md ring-1 ring-[#d9c58f]/30`} /> : <span className={`${size} shrink-0 rounded-md bg-white/[0.06]`} />;
}

const NOW_MARK: Record<NowState, [string, string]> = { ok: ["✓", "text-[#5fbf8a]"], low: ["zu niedrig", "text-[#ff9a2e]"], drop: ["raus", "text-[#ff8b8b]"], free: ["egal", "text-zinc-500"] };
const WANT_MARK: Record<WantState, [string, string]> = { ok: ["✓", "text-[#5fbf8a]"], low: ["", "text-[#ff9a2e]"], missing: ["fehlt", "text-[#ff9a2e]"] };

/**
 * One piece: the current card first stands in the middle, slides to the left, then the target card opens on the right
 * (same motion as the slot comparison).
 */
function CompareRow({ d, cls, de, delay, item }: { d: PieceDiff; cls: string; de: (en: string) => string; delay: number; item?: Item }) {
  const [stage, setStage] = useState(0);
  // side by side from 640 px on, with the slide; on a phone the two cards stand on top of each other
  const [wide] = useState(() => typeof window === "undefined" || window.matchMedia("(min-width: 640px)").matches);
  useEffect(() => { const t = setTimeout(() => setStage(1), 150 + delay); return () => clearTimeout(t); }, [delay]);
  const p = placeOf(d.id);
  const card = "card-face flex h-full min-w-0 flex-col rounded-xl p-2.5 ring-1 sm:p-3";
  const tag = "mb-1.5 text-[10px] uppercase tracking-widest";
  return (
    <li>
      <div className="mb-1.5 flex items-baseline gap-2 px-1 text-sm font-semibold text-[#f4eed7]"><span>{d.locked && "🔒 "}{p.de}<PieceIco item={item} /></span>
        <span className={`text-[10px] font-normal uppercase tracking-widest ${d.change ? "text-[#ff9a2e]" : "text-[#5fbf8a]"}`}>{d.change ? "ändern" : "passt ✓"}</span></div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-6 sm:[--gap:1.5rem]">
        <div className="min-w-0 transition-transform duration-[800ms] ease-[cubic-bezier(.45,0,.2,1)] motion-reduce:transition-none"
          style={wide ? { transform: stage ? "translateX(0)" : "translateX(calc(50% + var(--gap) / 2))" } : undefined}>
          <div className={`${card} ring-white/15`}>
            <div className={`${tag} text-zinc-500`}>Aktuell</div>
            {d.now.length ? <ul className="space-y-1 text-sm">{d.now.map((l) => (
              <li key={l.skill} className={`flex items-center gap-1.5 ${l.state === "free" ? "text-zinc-500" : "text-[#efe6cc]/90"}`}>
                <SkillIco cls={cls} en={l.skill} size="h-5 w-5" /><span className="min-w-0 flex-1 truncate">{de(l.skill)}</span>
                <b className="text-[#d9c58f]">+{l.levels}</b><span className={`w-16 shrink-0 text-right text-[10px] ${NOW_MARK[l.state][1]}`}>{l.state === "ok" ? "✓" : l.state === "low" ? "↑ zu niedrig" : l.state === "drop" ? "✕ raus" : "· egal"}</span>
              </li>))}</ul>
              : <p className="text-xs text-zinc-500">keine Ability</p>}
          </div>
        </div>
        <div className="min-w-0 transition-[opacity,transform] duration-[700ms] motion-reduce:transition-none"
          style={{ opacity: stage ? 1 : 0, transform: stage ? "none" : wide ? "translateX(1.5rem)" : "translateY(0.5rem)", transitionDelay: wide ? "250ms" : "0ms" }}>
          <div className={`${card} ${d.change ? "ring-[#ff9a2e]/45" : "ring-[#5fbf8a]/45"}`}>
            <div className={`${tag} ${d.change ? "text-[#ff9a2e]" : "text-[#5fbf8a]"}`}>So muss es sein</div>
            <ul className="space-y-1 text-sm">{d.want.map((l) => (
              <li key={l.skill} className="flex items-center gap-1.5 text-[#efe6cc]/90">
                <SkillIco cls={cls} en={l.skill} size="h-5 w-5" /><span className="min-w-0 flex-1 truncate">{de(l.skill)}</span>
                <b className="text-[#d9c58f]">+{l.levels}</b><span className={`w-16 shrink-0 text-right text-[10px] ${WANT_MARK[l.state][1]}`}>{l.state === "ok" ? "✓" : l.state === "low" ? `+${l.has} → +${l.levels}` : "! fehlt"}</span>
              </li>))}</ul>
          </div>
        </div>
      </div>
    </li>
  );
}

const GROUPS: { title: string; ids: PlaceId[] }[] = [
  { title: "Arcana-Karten", ids: ["Chalice", "Parchment", "Compass", "Bell", "Mirror"] },
  { title: "Waffe & Schützer", ids: ["weapon", "guard"] },
  { title: "Rüstung", ids: ["helm", "pauldrons", "top", "legs", "gloves", "shoes", "cloak"] },
  { title: "Schmuck", ids: ["necklace", "earring1", "earring2", "ring1", "ring2"] },
];

/** Skill planner: which abilities to which level (priority), where the levels may fall (priority, limits), the result, what is already there. */
export function SkillPlanner({ char, preview = false }: { char: Character; preview?: boolean }) {
  const cls = refClass(char.className);
  const key = charKey(char);
  const skills = useMemo(() => (cls ? refSkills(cls) : []), [cls]);
  const [goals, setGoals] = useState<Goal[]>(() => load(key)?.goals ?? []);
  const [order, setOrder] = useState<PlaceRule[]>(() => {
    const o = load(key)?.order ?? [];
    return [...o.filter((r) => PLACES.some((p) => p.id === r.id)), ...DEFAULT_ORDER.filter((d) => !o.some((r) => r.id === d.id))];
  });
  const [have, setHave] = useState<HaveMap>(() => load(key)?.have ?? {});
  // off: the plan only shows how to reach the goals; on: compared with the gear the character wears now (kisk)
  const [compareNow, setCompareNow] = useState(() => !!load(key)?.compareNow);
  useEffect(() => save(key, { goals, order, have, compareNow }), [key, goals, order, have, compareNow]);
  const builds = useBuilds(key);
  // the saved build that is loaded right now ("" = none)
  const [loaded, setLoaded] = useState("");
  const goalSort = useSortable<Goal>(setGoals, "goal");
  const placeSort = useSortable<PlaceRule>(setOrder, "place");
  if (!cls) return null;

  const de = (en: string) => skills.find((s) => s.skill_en === en)?.skill_de ?? en;
  const Icon = ({ en, size }: { en: string; size?: string }) => <SkillIco cls={cls} en={en} size={size} />;
  const now = currentLines(cls, char);
  const items = currentItems(char);
  const raw = planSkills(cls, goals, order, have);
  const plan = compareNow ? alignToCurrent(raw, now) : raw;
  const diffs = compareNow ? diffPlan(plan, now) : [];
  const toChange = diffs.filter((d) => d.change).length;
  // what the character has right now from kisk (gear + Arcana lines of this skill)
  const nowBonus = (en: string) => Object.values(now).flat().filter((l) => l!.skill === en).reduce((a, l) => a + l!.levels, 0);
  const free = skills.filter((s) => !goals.some((g) => g.skill === s.skill_en));
  const setGoal = (i: number, patch: Partial<Goal>) => setGoals((g) => g.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const shown = plan.places.filter((p) => p.lines.length || p.locked);
  const half = Math.ceil(order.length / 2);
  const placed = goals.filter((g) => skills.some((s) => s.skill_en === g.skill)).length;
  const complete = allPlaced(cls, goals);
  const current = builds.builds.find((b) => b.id === loaded);
  const saveBuild = (asBis: boolean) => {
    const name = window.prompt(asBis ? "Name für deinen eigenen BiS (z. B. PvP, Main Build 2):" : "Name für den Build:", current?.name ?? "");
    if (!name?.trim()) return;
    // same name: that build is overwritten (its kisk line choices stay)
    const same = builds.builds.find((b) => b.name.toLowerCase() === name.trim().toLowerCase());
    const b: OwnBuild = {
      id: same?.id ?? newBuildId(), name: name.trim(), bis: asBis || (!!same?.bis && complete), savedAt: nowIso(),
      goals, order, have, places: raw.places.map((p) => ({ id: p.id, lines: p.lines })), picks: same?.picks ?? {},
    };
    builds.save(b);
    setLoaded(b.id);
  };
  const loadBuild = (id: string) => {
    setLoaded(id);
    const b = builds.builds.find((x) => x.id === id);
    if (b) { setGoals(b.goals); setOrder(b.order); setHave(b.have); }
  };

  const haveOf = (id: PlaceId) => have[id] ?? { locked: false, lines: [] };
  const setLines = (id: PlaceId, f: (l: Line[]) => Line[]) => setHave((h) => ({ ...h, [id]: { ...haveOf(id), lines: f(haveOf(id).lines) } }));

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-baseline gap-2">
        <h3 className="text-2xl font-semibold text-[#f4eed7]">Skill-Planer</h3>
        <button className="ml-auto rounded-md px-2 py-0.5 text-[11px] uppercase tracking-widest text-zinc-500 ring-1 ring-white/10 hover:text-[#ff8b8b] hover:ring-[#ff8b8b]/40"
          onClick={() => { if (window.confirm("Skill-Planer für diesen Charakter zurücksetzen? Alle Eingaben werden gelöscht.")) { setGoals([]); setOrder(DEFAULT_ORDER); setHave({}); setCompareNow(false); setLoaded(""); } }}>Reset</button>
      </div>

      {preview && (
        <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-white/[0.03] px-3 py-2.5 ring-1 ring-white/10">
          <span className="text-[11px] uppercase tracking-widest text-zinc-500">Builds</span>
          <select className={`${SEL} min-w-0 max-w-[14rem]`} value={loaded} onChange={(e) => loadBuild(e.target.value)} aria-label="Build laden">
            <option value="">{builds.builds.length ? "– Build laden –" : "noch keine gespeichert"}</option>
            {builds.builds.map((b) => <option key={b.id} value={b.id}>{b.bis ? "★ " : ""}{b.name}</option>)}
          </select>
          <button className="rounded-lg border border-[#d9c58f]/30 px-3 py-1.5 text-sm text-[#f4eed7] hover:bg-[#d9c58f]/10" onClick={() => saveBuild(false)}>Speichern</button>
          <button className="rounded-lg border border-[#d9c58f]/50 bg-[#d9c58f]/10 px-3 py-1.5 text-sm font-semibold text-[#f4eed7] hover:bg-[#d9c58f]/20 disabled:cursor-not-allowed disabled:opacity-40"
            disabled={!complete} title={complete ? "Als eigenen BiS speichern" : `Erst alle Abilities platzieren (${placed}/${skills.length})`} onClick={() => saveBuild(true)}>★ Als eigenen BiS</button>
          {current && <button className="rounded-lg px-2 py-1.5 text-sm text-zinc-500 hover:text-[#ff8b8b]" onClick={() => { if (window.confirm(`Build „${current.name}“ löschen?`)) { builds.remove(current.id); setLoaded(""); } }}>Löschen</button>}
          <span className={`ml-auto text-xs ${complete ? "text-[#5fbf8a]" : "text-zinc-500"}`}>{placed}/{skills.length} Abilities platziert</span>
        </div>
      )}

      {/* 1: goals */}
      <div className="space-y-2">
        <div className={H}>1 · Welche Abilities, auf welche Stufe?</div>
        {goals.length > 0 && (
          <div className="hidden grid-cols-[3.25rem_2rem_minmax(0,1fr)_4.5rem_4.5rem_6.5rem_7.5rem_2rem] gap-2 px-2 text-[10px] uppercase tracking-widest text-zinc-500 md:grid">
            <span>Prio</span><span /><span>Ability</span><span>Story</span><span>Daevanion</span><span>Ziel</span><span>Ergebnis</span><span />
          </div>
        )}
        <ul className="space-y-2">
          {plan.goals.map((r, i) => {
            const g = r.goal;
            const nowLevel = Math.min(g.story, STORY_MAX) + Math.min(g.daevanion, DAEVANION_MAX) + nowBonus(g.skill);
            return (
              <li key={g.skill} {...goalSort.row(i)}
                className={`card-face grid select-none grid-cols-[auto_2rem_minmax(0,1fr)_2rem] items-center gap-2 rounded-xl p-2 ring-1 md:grid-cols-[3.25rem_2rem_minmax(0,1fr)_4.5rem_4.5rem_6.5rem_7.5rem_2rem] ${goalSort.drag === i ? "relative z-10 scale-[1.01] ring-2 ring-[#d9c58f]/70 shadow-2xl" : "ring-[#d9c58f]/20"}`}>
                <Grip n={i + 1} gold />
                <Icon en={g.skill} />
                <select className={`${SEL} min-w-0`} value={g.skill} onChange={(e) => setGoal(i, { skill: e.target.value })} aria-label="Ability">
                  {[skills.find((s) => s.skill_en === g.skill)!, ...free].filter(Boolean).map((s) => <option key={s.skill_en} value={s.skill_en}>{s.skill_de} ({s.skill_type === "active" ? "aktiv" : "passiv"})</option>)}
                </select>
                <button className={`${ICON_BTN} md:hidden`} onClick={() => setGoals((l) => l.filter((_, j) => j !== i))} aria-label="entfernen">×</button>
                <div className="col-span-4 grid grid-cols-3 gap-2 md:col-span-1 md:contents">
                  <label className="text-[10px] uppercase tracking-widest text-zinc-500 md:contents"><span className="md:hidden">Story</span>
                    <select className={`${SEL} w-full`} value={g.story} onChange={(e) => setGoal(i, { story: Number(e.target.value) })}>{range(0, STORY_MAX).map((n) => <option key={n}>{n}</option>)}</select></label>
                  <label className="text-[10px] uppercase tracking-widest text-zinc-500 md:contents"><span className="md:hidden">Daevanion</span>
                    <select className={`${SEL} w-full`} value={g.daevanion} onChange={(e) => setGoal(i, { daevanion: Number(e.target.value) })}>{range(0, DAEVANION_MAX).map((n) => <option key={n}>{n}</option>)}</select></label>
                  <label className="text-[10px] uppercase tracking-widest text-zinc-500 md:contents"><span className="md:hidden">Ziel</span>
                    <select className={`${SEL} w-full`} value={g.target} onChange={(e) => setGoal(i, { target: Number(e.target.value) })}><option value={HIGHEST}>Highest</option>{range(10, 30).map((n) => <option key={n} value={n}>{n}</option>)}</select></label>
                </div>
                <span className="col-span-4 text-sm md:col-span-1">
                  {g.target === HIGHEST ? <span className="font-semibold text-[#d9c58f]">{r.reached} erreichbar</span>
                    : r.missing === 0 ? <span className="font-semibold text-[#5fbf8a]">✓ erreichbar</span> : <span className="font-semibold text-[#ff8b8b]">fehlt {r.missing}</span>}
                  {compareNow && <span className="ml-2 text-[11px] text-zinc-500 md:ml-0 md:block" title="mit deinem aktuellen Gear laut kisk">jetzt {nowLevel}</span>}
                </span>
                <button className={`${ICON_BTN} hidden md:block`} onClick={() => setGoals((l) => l.filter((_, j) => j !== i))} aria-label="entfernen">×</button>
                {r.got.length > 0 && <div className="col-span-full flex flex-wrap gap-1.5 md:pl-[5.75rem]">
                  {r.got.map((x) => <span key={x.place} className={`rounded-full px-2 py-0.5 text-xs ${x.fixed ? "bg-[#d9c58f]/15 text-[#f4eed7]" : "bg-white/[0.06] text-[#efe6cc]"}`}>{x.fixed && "🔒 "}{placeOf(x.place).de} +{x.levels}</span>)}
                </div>}
              </li>
            );
          })}
        </ul>
        {free.length > 0 && <button className="rounded-xl border border-[#d9c58f]/40 bg-[#d9c58f]/10 px-4 py-2 text-sm font-semibold text-[#f4eed7] hover:bg-[#d9c58f]/20"
          onClick={() => setGoals((g) => [...g, { skill: free[0].skill_en, target: 20, story: STORY_MAX, daevanion: DAEVANION_MAX }])}>+ Ability</button>}
      </div>

      {/* 2: places, order and limits */}
      <details className="rounded-2xl bg-white/[0.02] px-2.5 py-3 ring-1 ring-white/10 sm:px-4">
        <summary className="cursor-pointer select-none text-base font-semibold text-[#efe6cc]">2 · Wo zuerst, und wie viele Abilities pro Teil?</summary>
        <p className="mt-1 text-xs text-zinc-500">Zum Umsortieren ein Teil greifen und an die neue Stelle ziehen.</p>
        <ul className="mt-3 grid gap-2 md:grid-flow-row-dense md:grid-cols-2">
          {order.map((r, i) => {
            const p = placeOf(r.id);
            const maxes = p.kind === "arcana" ? range(0, ARCANA_CARD_LINES) : range(0, 4);
            const locked = haveOf(r.id).locked;
            return (
              <li key={r.id} {...placeSort.row(i)}
                className={`pl-row flex min-w-0 cursor-grab select-none items-center gap-2 rounded-xl px-2 py-1.5 ring-1 active:cursor-grabbing ${placeSort.drag === i ? "relative z-10 bg-[#d9c58f]/15 ring-2 ring-[#d9c58f]/70 shadow-2xl" : "bg-white/[0.03] ring-white/5"}`}
                data-col={i < half ? 1 : 2}>
                <Grip n={i + 1} />
                <span className="min-w-0 flex-1 truncate text-sm text-[#f4eed7]">{locked && "🔒 "}{p.de}<PieceIco item={items[r.id]} /><span className="ml-1.5 text-xs text-zinc-500">{p.kind === "arcana" ? "Arcana" : ""}</span></span>
                <select className={`${SEL} shrink-0 !px-1.5`} value={r.max} aria-label={`${p.de}: max. Abilities`} disabled={locked}
                  onChange={(e) => setOrder((o) => o.map((x) => (x.id === r.id ? { ...x, max: Number(e.target.value) } : x)))}>
                  {maxes.map((n) => <option key={n} value={n}>{n === 0 ? "keine" : `max ${n}`}</option>)}
                </select>
              </li>
            );
          })}
        </ul>
        <style>{`@media (min-width: 768px) { .pl-row[data-col="1"] { grid-column: 1 } .pl-row[data-col="2"] { grid-column: 2 } }`}</style>
        <p className="mt-2 text-xs text-zinc-500">Arcana-Karte: {ARCANA_CARD_LINES} Zeilen ab +1, dazu {ARCANA_ENHANCE} Level durchs Verstärken ({ARCANA_CARD_LEVELS} insgesamt), höchstens +{ARCANA_SKILL_MAX} auf eine Ability. Ausrüstung: +1 pro Ability.</p>
      </details>

      {/* 3: result */}
      {shown.length > 0 && (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className={H}>3 · So muss es fallen</div>
            <label className="flex cursor-pointer select-none items-center gap-2 rounded-xl bg-white/[0.04] px-3 py-1.5 text-sm text-[#efe6cc] ring-1 ring-white/10 hover:ring-[#d9c58f]/40">
              <input type="checkbox" className="h-4 w-4 accent-[#d9c58f]" checked={compareNow} onChange={(e) => setCompareNow(e.target.checked)} />
              Änderungen an meinem aktuellen Gear
            </label>
          </div>
          {compareNow ? (<>
            <p className="text-xs text-zinc-500">{toChange ? `${toChange} von ${diffs.length} Teilen musst du ändern.` : "Dein aktuelles Gear passt schon zum Plan."} Je Teil: dein Gear laut kisk und wie es sein muss.</p>
            <ul className="space-y-4">{diffs.map((d, i) => <CompareRow key={d.id} d={d} cls={cls} de={de} delay={i * 90} item={items[d.id]} />)}</ul>
          </>) : (
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {shown.map((p) => {
              const before = haveOf(p.id).lines;
              const freeLines = placeOf(p.id).kind === "arcana" ? ARCANA_CARD_LINES - p.lines.length : 0;
              return (
                <li key={p.id} className={`card-face rounded-xl p-3 ring-1 ${p.locked ? "ring-[#d9c58f]/50" : "ring-[#d9c58f]/25"}`}>
                  <div className="mb-1.5 flex items-baseline justify-between text-sm font-semibold text-[#f4eed7]"><span>{p.locked && "🔒 "}{placeOf(p.id).de}<PieceIco item={items[p.id]} /></span>
                    <span className="text-xs font-normal text-zinc-500">{p.locked ? "bleibt so" : freeLines > 0 ? `${freeLines} Zeile${freeLines > 1 ? "n" : ""} egal` : ""}</span></div>
                  <ul className="space-y-1 text-sm">{p.lines.map((l) => {
                    const inGoal = goals.some((g) => g.skill === l.skill);
                    const there = !p.locked && before.some((b) => b.skill === l.skill && b.levels >= l.levels);
                    return <li key={l.skill} className={`flex items-center gap-2 ${inGoal ? "text-[#efe6cc]/90" : "text-zinc-500"}`}>
                      <Icon en={l.skill} size="h-6 w-6" /><span className="min-w-0 flex-1 truncate">{de(l.skill)}</span>
                      {there && <span className="text-[11px] text-[#5fbf8a]">✓ hast du</span>}
                      <b className="text-[#d9c58f]">+{l.levels}</b></li>;
                  })}</ul>
                </li>
              );
            })}
          </ul>)}
        </div>
      )}

      {/* 4: what is already there, locks */}
      <details className="rounded-2xl bg-white/[0.02] px-2.5 py-3 ring-1 ring-white/10 sm:px-4">
        <summary className="cursor-pointer select-none text-base font-semibold text-[#efe6cc]">4 · Schon vorhanden</summary>
        <p className="mt-1 text-xs text-zinc-500">Trag ein, was schon auf deinen Teilen ist. 🔒 = das Teil behältst du so, der Plan rechnet damit und plant dort nichts Neues.</p>
        <div className="mt-3 space-y-4">
          {GROUPS.map((grp) => (
            <div key={grp.title}>
              <div className="mb-1.5 text-[11px] uppercase tracking-widest text-zinc-500">{grp.title}</div>
              <ul className="grid gap-2 lg:grid-cols-2">
                {grp.ids.map((id) => {
                  const p = placeOf(id);
                  const h = haveOf(id);
                  const arcana = p.kind === "arcana";
                  const sum = h.lines.reduce((a, l) => a + l.levels, 0);
                  const full = h.lines.length >= 4;
                  const options = skills.filter((s) => allowed(cls, s.skill_en, p) && !h.lines.some((l) => l.skill === s.skill_en));
                  return (
                    <li key={id} className={`rounded-xl px-2 py-2 ring-1 ${h.locked ? "bg-[#d9c58f]/[0.08] ring-[#d9c58f]/45" : "bg-white/[0.03] ring-white/5"}`}>
                      <div className="flex items-center gap-2">
                        <button className={`${ICON_BTN} ${h.locked ? "border-[#d9c58f]/70 bg-[#d9c58f]/20" : ""}`} aria-pressed={h.locked} aria-label={`${p.de} sperren`}
                          title={h.locked ? "Gesperrt: bleibt so" : "Sperren: Teil so behalten"}
                          onClick={() => setHave((m) => ({ ...m, [id]: { ...h, locked: !h.locked } }))}>{h.locked ? "🔒" : "🔓"}</button>
                        <span className="min-w-0 flex-1 truncate text-sm font-semibold text-[#f4eed7]">{p.de}<PieceIco item={items[id]} /></span>
                        {!full && options.length > 0 && (
                          <select className={`${SEL} w-36 min-w-0 sm:w-44`} value="" aria-label={`${p.de}: Ability hinzufügen`}
                            onChange={(e) => { const en = e.target.value; if (en) setLines(id, (l) => [...l, { skill: en, levels: 1 }]); }}>
                            <option value="">+ Ability</option>
                            {options.map((s) => <option key={s.skill_en} value={s.skill_en}>{s.skill_de}</option>)}
                          </select>
                        )}
                      </div>
                      {h.lines.length > 0 && <ul className="mt-2 flex flex-wrap gap-1.5">
                        {h.lines.map((l, k) => (
                          <li key={l.skill} className="flex items-center gap-1.5 rounded-lg bg-white/[0.05] py-1 pl-1 pr-1 text-xs text-[#efe6cc]">
                            <Icon en={l.skill} size="h-6 w-6" /><span className="max-w-[9rem] truncate">{de(l.skill)}</span>
                            {arcana
                              ? <select className={`${SEL} !px-1 !py-0.5 text-xs`} value={l.levels} aria-label={`${de(l.skill)}: Level`}
                                  onChange={(e) => setLines(id, (ls) => ls.map((x, j) => (j === k ? { ...x, levels: Number(e.target.value) } : x)))}>
                                  {range(1, Math.min(ARCANA_SKILL_MAX, ARCANA_CARD_LEVELS - (sum - l.levels) - (ARCANA_CARD_LINES - h.lines.length))).map((n) => <option key={n} value={n}>+{n}</option>)}
                                </select>
                              : <b className="text-[#d9c58f]">+1</b>}
                            <button className="px-1 text-zinc-400 hover:text-[#ff8b8b]" aria-label={`${de(l.skill)} entfernen`} onClick={() => setLines(id, (ls) => ls.filter((_, j) => j !== k))}>×</button>
                          </li>
                        ))}
                      </ul>}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      </details>
    </section>
  );
}
