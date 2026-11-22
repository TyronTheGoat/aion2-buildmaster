"use client";
import { useState } from "react";
import type { Character, Item, StatLine } from "@/lib/types";
import { compareIdeal, type IdealRow } from "@/lib/compare";
import { buildPlan, shareOf, GOOD_SHARE } from "@/lib/advisor";
import { SLOT_LABEL_DE } from "@/lib/knowledge/slots";
import { findCatalogItem, iconFor } from "@/lib/knowledge/item-catalog";
import { GradeBadge } from "./GradeBadge";
import { useLang } from "@/lib/i18n";
import { statLabel } from "@/lib/stat-names";
import { ItemIcon, SkillIcon, Sheet, isSkillLine } from "./ui";

function lineState(char: Character, item: Item, l: StatLine): "good" | "bad" | "neutral" {
  const cmp = compareIdeal(item);
  if (cmp) return cmp.extra.includes(l) ? "bad" : "good";
  const sh = shareOf(char, item, l);
  return sh === undefined ? "neutral" : sh >= GOOD_SHARE ? "good" : "bad";
}

const STATE_CLS = { good: "text-emerald-300", bad: "text-red-300/90", neutral: "text-zinc-300" };
const STATE_MARK = { good: "✓", bad: "✗", neutral: "·" };

function LineRow({ l, state }: { l: StatLine; state: "good" | "bad" | "neutral" }) {
  const lang = useLang();
  return (
    <li className="flex items-center justify-between gap-2 text-[13px] leading-5">
      <span className={`flex min-w-0 items-center gap-1.5 ${STATE_CLS[state]}`}>
        {isSkillLine(l.value) ? <SkillIcon name={l.name} size={16} /> : <span className="w-4 text-center text-[11px]">{STATE_MARK[state]}</span>}
        <span className="truncate">{statLabel(l.name, lang)}</span>
      </span>
      <span className="shrink-0 tabular-nums text-zinc-400">{l.value}</span>
    </li>
  );
}

/** List of items showing the current state; tapping opens the BiS comparison. */
export function ItemCards({ char, items, arcana = false }: { char: Character; items: Item[]; arcana?: boolean }) {
  const [open, setOpen] = useState<Item>();
  return (
    <>
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {items.map((item, idx) => {
          const cmp = compareIdeal(item);
          return (
            <li key={`${item.name}-${idx}`} className="min-w-0">
              <button onClick={() => setOpen(item)} disabled={!item.scored && !item.lines.length}
                className="w-full rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-left transition active:scale-[0.99] enabled:hover:border-white/25">
                <div className="flex gap-3">
                  <ItemIcon src={iconFor(item)} name={item.name} grade={item.grade} enhance={item.enhance} size={52} tall={arcana} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-[10px] uppercase tracking-wide text-zinc-500">{SLOT_LABEL_DE[item.slot]}</div>
                        <div className="truncate font-semibold leading-snug">{item.name}</div>
                        <SourceLine name={item.name} />
                      </div>
                      {item.scored ? <GradeBadge grade={item.grade} score={item.score} size="sm" /> : <span className="text-[10px] text-zinc-500">ohne Wertung</span>}
                    </div>
                    {cmp && (
                      <div className="mt-1 flex items-center gap-2 text-[11px] text-zinc-400">
                        <div className="h-1.5 flex-1 rounded bg-white/10">
                          <div className="h-1.5 rounded bg-emerald-400" style={{ width: `${(cmp.present / cmp.total) * 100}%` }} />
                        </div>
                        <span>{cmp.present}/{cmp.total} BiS</span>
                      </div>
                    )}
                  </div>
                </div>
                {item.lines.length > 0 && (
                  <ul className="mt-2.5 space-y-0.5 border-t border-white/5 pt-2">
                    {item.lines.map((l, i) => <LineRow key={i} l={l} state={lineState(char, item, l)} />)}
                  </ul>
                )}
                {item.scored && <div className="mt-2 text-right text-[11px] text-amber-300/80">BiS anzeigen ›</div>}
              </button>
            </li>
          );
        })}
      </ul>
      <Sheet open={!!open} onClose={() => setOpen(undefined)}
        title={open && (
          <div className="flex items-center gap-3">
            <ItemIcon src={iconFor(open)} name={open.name} grade={open.grade} enhance={open.enhance} size={44} tall={open.slot === "arcana"} />
            <div className="min-w-0">
              <div className="text-[10px] uppercase tracking-wide text-zinc-500">{SLOT_LABEL_DE[open.slot]}</div>
              <div className="font-semibold leading-snug">{open.name}</div>
              <SourceLine name={open.name} />
              <div className="mt-0.5"><GradeBadge grade={open.grade} score={open.score} size="sm" /></div>
            </div>
          </div>
        )}>
        {open && <BisDetail char={char} item={open} />}
      </Sheet>
    </>
  );
}

const ROW_STYLE: Record<IdealRow["state"], { mark: string; cls: string; label: string }> = {
  ok: { mark: "✓", cls: "text-emerald-300", label: "erreicht" },
  low: { mark: "◐", cls: "text-amber-300", label: "zu niedrig" },
  missing: { mark: "✗", cls: "text-red-300", label: "fehlt" },
};

function BisDetail({ char, item }: { char: Character; item: Item }) {
  const lang = useLang();
  const cmp = compareIdeal(item);
  const step = buildPlan(char).steps.find((s) => s.item === item);
  // The table above already shows missing/extra lines; only keep the extra advice here.
  const tips = step?.details.filter((d) => !/^(Fehlt|Unnötig|Ziel-Linien|Wert noch unter|Stufe erhöhen|\d+\.)/.test(d)) ?? [];
  const isArcana = item.slot === "arcana";
  return (
    <div className="space-y-4">
      {cmp ? (
        <section>
          <div className="mb-2 flex items-baseline justify-between">
            <h3 className="font-semibold text-amber-300">BiS-Ziel</h3>
            <span className="text-xs text-zinc-400">Du hast {cmp.present} von {cmp.total}</span>
          </div>
          <div className="overflow-hidden rounded-xl border border-white/10">
            <div className="grid grid-cols-[1fr_auto_auto] gap-x-3 bg-white/5 px-3 py-1.5 text-[10px] uppercase tracking-wide text-zinc-500">
              <span>{isArcana ? "Fähigkeit" : "Linie"}</span><span className="text-right">Ist</span><span className="text-right">{isArcana ? "Ziel-Stufe" : "BiS"}</span>
            </div>
            <ul>
              {cmp.rows.map((r) => {
                const st = ROW_STYLE[r.state];
                return (
                  <li key={r.name} className="grid grid-cols-[1fr_auto_auto] items-center gap-x-3 border-t border-white/5 px-3 py-2 text-sm">
                    <span className={`flex min-w-0 items-center gap-2 ${st.cls}`}>
                      <span className="w-4 text-center">{st.mark}</span>
                      {isSkillLine(r.target) && <SkillIcon name={r.name} size={18} />}
                      <span className="truncate">{statLabel(r.name, lang)}</span>
                    </span>
                    <span className="text-right tabular-nums text-zinc-400">{r.have?.value ?? "–"}</span>
                    <span className="text-right font-semibold tabular-nums text-zinc-100">{r.target}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>
      ) : (
        <p className="text-sm text-zinc-400">Für dieses Teil liegt kein BiS-Ziel von kisk.app vor.</p>
      )}

      {cmp && cmp.extra.length > 0 && (
        <section>
          <h3 className="mb-2 font-semibold text-red-300">{item.fixedLines ? "Feste Linien (nicht rerollbar)" : isArcana ? "Nicht im BiS" : "Nicht im BiS, neu rollen"}</h3>
          <ul className="space-y-1 rounded-xl border border-red-400/20 bg-red-500/5 px-3 py-2">
            {cmp.extra.map((l, i) => <LineRow key={i} l={l} state="bad" />)}
          </ul>
        </section>
      )}

      {step && (
        <section>
          <h3 className="mb-2 font-semibold">Nächster Schritt</h3>
          <p className="text-sm text-zinc-200">{step.title}</p>
          {tips.length > 0 && (
            <ul className="mt-1 space-y-1 text-sm text-zinc-400">
              {tips.map((d) => <li key={d}>{d}</li>)}
            </ul>
          )}
        </section>
      )}
      {!step && item.grade === "BiS" && <p className="text-sm text-amber-300">Schon BiS. Hier ist nichts mehr zu tun.</p>}
    </div>
  );
}

/** Where the item comes from (Feuertempel, Grimmhornhöhle, Ludra, Crafted Gear), if it is in the item catalog. */
function SourceLine({ name }: { name: string }) {
  const c = findCatalogItem(name);
  if (!c) return null;
  return (
    <div className="truncate text-[11px] text-zinc-500">
      {[c.source, c.rarity, c.faction !== "Beide" && c.faction].filter(Boolean).join(" · ")}
    </div>
  );
}
