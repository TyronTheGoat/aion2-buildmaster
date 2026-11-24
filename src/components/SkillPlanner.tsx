"use client";
import { useEffect, useMemo, useState } from "react";
import type { Character } from "@/lib/types";
import { refClass, refSkills } from "@/lib/reference/rolls-v3";
import {
  ARCANA_CARD_LINES, DAEVANION_MAX, DEFAULT_ORDER, PLACES, STORY_MAX, placeOf, planSkills, type Goal, type PlaceRule,
} from "@/lib/skill-plan";
import { charKey } from "./store";

/** Saved per character on this device (offline preview): goals in priority order and the order / limits of the places. */
const KEY = "bm:skillplan";
interface Saved { goals: Goal[]; order: PlaceRule[] }
const load = (k: string): Saved | undefined => { try { return JSON.parse(localStorage.getItem(KEY) ?? "{}")[k]; } catch { return undefined; } };
const save = (k: string, v: Saved) => { try { const all = JSON.parse(localStorage.getItem(KEY) ?? "{}"); all[k] = v; localStorage.setItem(KEY, JSON.stringify(all)); } catch { /* full */ } };

const SEL = "rounded-lg border border-[#d9c58f]/25 bg-[#0d1119] px-2 py-1.5 text-sm text-[#f4eed7] outline-none focus:border-[#d9c58f]/60";
const ICON_BTN = "h-8 w-8 shrink-0 rounded-lg border border-[#d9c58f]/20 text-[#efe6cc] hover:border-[#d9c58f]/50 disabled:opacity-30";
const range = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
const move = <T,>(l: T[], i: number, d: number) => { const n = [...l]; const j = i + d; if (j < 0 || j >= n.length) return l; [n[i], n[j]] = [n[j], n[i]]; return n; };
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/** Skill planner: which abilities to which level (priority), where the levels may fall (priority, limits), and the result. */
export function SkillPlanner({ char }: { char: Character }) {
  const cls = refClass(char.className);
  const key = charKey(char);
  const skills = useMemo(() => (cls ? refSkills(cls) : []), [cls]);
  const [goals, setGoals] = useState<Goal[]>(() => load(key)?.goals ?? []);
  const [order, setOrder] = useState<PlaceRule[]>(() => {
    const o = load(key)?.order ?? [];
    return [...o.filter((r) => PLACES.some((p) => p.id === r.id)), ...DEFAULT_ORDER.filter((d) => !o.some((r) => r.id === d.id))];
  });
  useEffect(() => save(key, { goals, order }), [key, goals, order]);
  if (!cls) return null;

  const de = (en: string) => skills.find((s) => s.skill_en === en)?.skill_de ?? en;
  const plan = planSkills(cls, goals, order);
  // what the character has right now from kisk (gear + Arcana lines of this skill)
  const nowBonus = (en: string) => [...char.gear, ...char.arcana].flatMap((i) => i.lines).filter((l) => norm(l.name) === norm(en))
    .reduce((a, l) => a + (Number(String(l.value).replace(/[^\d]/g, "")) || 0), 0);
  const free = skills.filter((s) => !goals.some((g) => g.skill === s.skill_en));
  const setGoal = (i: number, patch: Partial<Goal>) => setGoals((g) => g.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const used = plan.places.filter((p) => p.lines.length);

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-baseline gap-2">
        <h3 className="text-2xl font-semibold text-[#f4eed7]">Skill-Planer</h3>
        <span className="rounded-full bg-[#ffa31a]/15 px-2 py-0.5 text-xs text-[#ffa31a]">Vorschau</span>
      </div>

      {/* 1: goals */}
      <div className="space-y-2">
        <div className="text-base font-semibold text-[#efe6cc]">1 · Welche Abilities, auf welche Stufe?</div>
        {goals.length > 0 && (
          <div className="hidden grid-cols-[2rem_minmax(0,1fr)_4.5rem_4.5rem_4.5rem_6rem_5.5rem] gap-2 px-1 text-[10px] uppercase tracking-widest text-zinc-500 md:grid">
            <span>Prio</span><span>Ability</span><span>Story</span><span>Daevanion</span><span>Ziel</span><span>Ergebnis</span><span />
          </div>
        )}
        <ul className="space-y-2">
          {plan.goals.map((r, i) => {
            const g = r.goal;
            const now = Math.min(g.story, STORY_MAX) + Math.min(g.daevanion, DAEVANION_MAX) + nowBonus(g.skill);
            return (
              <li key={g.skill} className="card-face grid grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-2 rounded-xl p-2 ring-1 ring-[#d9c58f]/20 md:grid-cols-[2rem_minmax(0,1fr)_4.5rem_4.5rem_4.5rem_6rem_5.5rem]">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#d9c58f] text-sm font-bold text-[#14110a]">{i + 1}</span>
                <select className={SEL} value={g.skill} onChange={(e) => setGoal(i, { skill: e.target.value })} aria-label="Ability">
                  {[skills.find((s) => s.skill_en === g.skill)!, ...free].filter(Boolean).map((s) => <option key={s.skill_en} value={s.skill_en}>{s.skill_de} ({s.skill_type === "active" ? "aktiv" : "passiv"})</option>)}
                </select>
                <span className="flex gap-1 md:hidden">
                  <button className={ICON_BTN} disabled={i === 0} onClick={() => setGoals((l) => move(l, i, -1))} aria-label="hoch">↑</button>
                  <button className={ICON_BTN} onClick={() => setGoals((l) => l.filter((_, j) => j !== i))} aria-label="entfernen">×</button>
                </span>
                <div className="col-span-3 grid grid-cols-3 gap-2 md:col-span-1 md:contents">
                  <label className="text-[10px] uppercase tracking-widest text-zinc-500 md:contents"><span className="md:hidden">Story</span>
                    <select className={`${SEL} w-full`} value={g.story} onChange={(e) => setGoal(i, { story: Number(e.target.value) })}>{range(0, STORY_MAX).map((n) => <option key={n}>{n}</option>)}</select></label>
                  <label className="text-[10px] uppercase tracking-widest text-zinc-500 md:contents"><span className="md:hidden">Daevanion</span>
                    <select className={`${SEL} w-full`} value={g.daevanion} onChange={(e) => setGoal(i, { daevanion: Number(e.target.value) })}>{range(0, DAEVANION_MAX).map((n) => <option key={n}>{n}</option>)}</select></label>
                  <label className="text-[10px] uppercase tracking-widest text-zinc-500 md:contents"><span className="md:hidden">Ziel</span>
                    <select className={`${SEL} w-full`} value={g.target} onChange={(e) => setGoal(i, { target: Number(e.target.value) })}>{range(10, 30).map((n) => <option key={n}>{n}</option>)}</select></label>
                </div>
                <span className="col-span-3 text-sm md:col-span-1" title={`jetzt laut kisk: ${now}`}>
                  {r.missing === 0 ? <span className="font-semibold text-[#5fbf8a]">✓ erreichbar</span> : <span className="font-semibold text-[#ff8b8b]">fehlt {r.missing}</span>}
                  <span className="block text-[11px] text-zinc-500">jetzt {now}</span>
                </span>
                <span className="hidden gap-1 md:flex">
                  <button className={ICON_BTN} disabled={i === 0} onClick={() => setGoals((l) => move(l, i, -1))} aria-label="hoch">↑</button>
                  <button className={ICON_BTN} disabled={i === goals.length - 1} onClick={() => setGoals((l) => move(l, i, 1))} aria-label="runter">↓</button>
                  <button className={ICON_BTN} onClick={() => setGoals((l) => l.filter((_, j) => j !== i))} aria-label="entfernen">×</button>
                </span>
                {r.got.length > 0 && <div className="col-span-full flex flex-wrap gap-1.5 pl-9">
                  {r.got.map((x) => <span key={x.place} className="rounded-full bg-white/[0.06] px-2 py-0.5 text-xs text-[#efe6cc]">{placeOf(x.place).de} +{x.levels}</span>)}
                </div>}
              </li>
            );
          })}
        </ul>
        {free.length > 0 && <button className="rounded-xl border border-[#d9c58f]/40 bg-[#d9c58f]/10 px-4 py-2 text-sm font-semibold text-[#f4eed7] hover:bg-[#d9c58f]/20"
          onClick={() => setGoals((g) => [...g, { skill: free[0].skill_en, target: 20, story: STORY_MAX, daevanion: DAEVANION_MAX }])}>+ Ability</button>}
      </div>

      {/* 2: places */}
      <details className="rounded-2xl bg-white/[0.02] px-2.5 py-3 sm:px-4 ring-1 ring-white/10">
        <summary className="cursor-pointer select-none text-base font-semibold text-[#efe6cc]">2 · Wo zuerst, und wie viele Abilities pro Teil?</summary>
        <ul className="mt-3 grid gap-2 md:grid-cols-2">
          {order.map((r, i) => {
            const p = placeOf(r.id);
            const maxes = p.kind === "arcana" ? range(0, ARCANA_CARD_LINES) : range(0, 5);
            return (
              <li key={r.id} className="flex min-w-0 items-center gap-1.5 rounded-xl bg-white/[0.03] px-2 py-1.5 ring-1 ring-white/5">
                <span className="w-5 shrink-0 text-center text-sm font-semibold text-zinc-400">{i + 1}</span>
                <span className="min-w-0 flex-1 truncate text-sm text-[#f4eed7]">{p.de}<span className="ml-1.5 text-xs text-zinc-500">{p.kind === "arcana" ? "Arcana" : ""}</span></span>
                <select className={`${SEL} shrink-0 !px-1.5`} value={r.max} aria-label={`${p.de}: max. Abilities`} onChange={(e) => setOrder((o) => o.map((x) => (x.id === r.id ? { ...x, max: Number(e.target.value) } : x)))}>
                  {maxes.map((n) => <option key={n} value={n}>{n === 0 ? "keine" : `max ${n}`}</option>)}
                </select>
                <button className={ICON_BTN} disabled={i === 0} onClick={() => setOrder((o) => move(o, i, -1))} aria-label="hoch">↑</button>
                <button className={ICON_BTN} disabled={i === order.length - 1} onClick={() => setOrder((o) => move(o, i, 1))} aria-label="runter">↓</button>
              </li>
            );
          })}
        </ul>
        <p className="mt-2 text-xs text-zinc-500">Arcana-Karte: 5 Level insgesamt, höchstens +4 auf eine Ability. Ausrüstung: +1 pro Ability.</p>
      </details>

      {/* 3: result */}
      {used.length > 0 && (
        <div className="space-y-2">
          <div className="text-base font-semibold text-[#efe6cc]">3 · So muss es fallen</div>
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {used.map((p) => (
              <li key={p.id} className="card-face rounded-xl p-3 ring-1 ring-[#d9c58f]/25">
                <div className="mb-1 flex items-baseline justify-between text-sm font-semibold text-[#f4eed7]">{placeOf(p.id).de}
                  {p.levelsLeft !== null && <span className="text-xs font-normal text-zinc-500">{p.levelsLeft} frei</span>}</div>
                <ul className="space-y-0.5 text-sm">{p.lines.map((l) => <li key={l.skill} className="flex justify-between gap-2 text-[#efe6cc]/90"><span className="truncate">{de(l.skill)}</span><b className="text-[#d9c58f]">+{l.levels}</b></li>)}</ul>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
