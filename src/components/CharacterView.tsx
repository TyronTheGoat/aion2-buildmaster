"use client";
import { useMemo, useState } from "react";
import type { Character, Item } from "@/lib/types";
import { buildPlan, shareOf, GOOD_SHARE, type UpgradeStep } from "@/lib/advisor";
import { SLOT_LABEL_DE } from "@/lib/knowledge/slots";
import { missingIdealLines } from "@/lib/knowledge/ideal-lines";
import { ARCANA_GENERAL_TIPS } from "@/lib/knowledge/arcana";
import { classKey } from "@/lib/knowledge/ideal-lines";
import { GradeBadge } from "./GradeBadge";
import { useFavorites } from "./favorites";

type Tab = "plan" | "gear" | "arcana";

const KIND_LABEL: Record<UpgradeStep["kind"], string> = {
  reroll: "Neu rollen", replace: "Ersetzen", arcana: "Arcana", enhance: "Maximieren", keep: "Fertig",
};
const EFFORT = ["", "wenig Aufwand", "mittlerer Aufwand", "viel Aufwand"];

export function CharacterView({ char }: { char: Character }) {
  const [tab, setTab] = useState<Tab>("plan");
  const plan = useMemo(() => buildPlan(char), [char]);
  const { isFav, toggle } = useFavorites();
  const fav = { region: char.region, server: char.server, name: char.name };
  const knownClass = !!classKey(char.className);

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.06] to-transparent p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">{char.name}</h1>
            <p className="text-sm text-zinc-400">
              {[char.race, char.className, char.level && `Lv ${char.level}`, `${char.server} · ${char.region.toUpperCase()}`].filter(Boolean).join(" · ")}
            </p>
          </div>
          {char.source.mode !== "demo" && (
            <button onClick={() => toggle(fav)} className="text-2xl text-amber-400" aria-label="Favorit">
              {isFav(fav) ? "★" : "☆"}
            </button>
          )}
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          <Stat label="Gear-Note">{char.gearGrade ? <GradeBadge grade={char.gearGrade} size="lg" /> : "–"}</Stat>
          <Stat label="Ø Score">{plan.averageScore.toFixed(0)}</Stat>
          <Stat label="Kampfkraft">{char.combatPower?.toLocaleString("de-DE") ?? "–"}</Stat>
        </div>
        <GradeBar counts={plan.gradeCounts} />
        {char.warnings.map((w) => (
          <p key={w} className="mt-2 rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-300">{w}</p>
        ))}
        {!knownClass && (
          <p className="mt-2 rounded-lg bg-sky-500/10 px-3 py-2 text-xs text-sky-300">
            Für {char.className ?? "diese Klasse"} fehlt noch die BiS-Tabelle. Die Bewertung nutzt nur die kisk-Werte.
          </p>
        )}
      </section>

      <div className="sticky top-[57px] z-[5] -mx-4 flex gap-1 bg-[#0b0b12]/95 px-4 py-2 backdrop-blur">
        {(["plan", "gear", "arcana"] as Tab[]).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex-1 rounded-lg py-2 text-sm font-medium ${tab === t ? "bg-amber-400 text-black" : "bg-white/5 text-zinc-300"}`}>
            {t === "plan" ? `Upgrade-Pfad (${plan.steps.length})` : t === "gear" ? "Ausrüstung" : "Arcana"}
          </button>
        ))}
      </div>

      {tab === "plan" && <PlanList steps={plan.steps} done={plan.done} />}
      {tab === "gear" && <ItemList char={char} items={char.gear} />}
      {tab === "arcana" && (
        <>
          <ItemList char={char} items={char.arcana} />
          <section className="rounded-2xl border border-white/10 p-4">
            <h3 className="mb-2 font-semibold">Arcana-Tipps</h3>
            <ul className="list-disc space-y-1 pl-5 text-sm text-zinc-300">
              {ARCANA_GENERAL_TIPS.map((t) => <li key={t}>{t}</li>)}
            </ul>
          </section>
        </>
      )}

      <p className="text-xs text-zinc-500">
        Stand: {new Date(char.source.fetchedAt).toLocaleString("de-DE")} · Quelle:{" "}
        <a href={char.source.url} className="underline" target="_blank" rel="noreferrer">kisk.app</a>
        {char.source.mode === "demo" && " (Demo-Schnappschuss)"}
        {char.source.mode === "paste" && " (eingefügt)"}
      </p>
    </div>
  );
}

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-black/30 py-2">
      <div className="text-[11px] uppercase tracking-wide text-zinc-500">{label}</div>
      <div className="mt-1 text-lg font-semibold">{children}</div>
    </div>
  );
}

function GradeBar({ counts }: { counts: Record<string, number> }) {
  const order = ["BiS", "S+", "S", "A", "B", "C", "D"] as const;
  const total = order.reduce((a, g) => a + (counts[g] ?? 0), 0);
  if (!total) return null;
  return (
    <div className="mt-3 flex flex-wrap gap-1.5">
      {order.filter((g) => counts[g]).map((g) => (
        <span key={g} className="flex items-center gap-1 text-xs text-zinc-400">
          <GradeBadge grade={g} size="sm" />×{counts[g]}
        </span>
      ))}
    </div>
  );
}

function PlanList({ steps, done }: { steps: UpgradeStep[]; done: Item[] }) {
  return (
    <ol className="space-y-3">
      {steps.map((s, i) => (
        <li key={`${s.item.name}-${i}`} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-400 text-sm font-bold text-black">{i + 1}</span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-zinc-300">{KIND_LABEL[s.kind]}</span>
                <GradeBadge grade={s.item.grade} score={s.item.score} size="sm" />
                <span className="text-xs text-zinc-500">→</span>
                <GradeBadge grade={s.target} size="sm" />
                <span className="text-[11px] text-zinc-500">{EFFORT[s.effort]}</span>
              </div>
              <h3 className="mt-1.5 font-semibold leading-snug">{s.title}</h3>
              <p className="text-xs text-zinc-500">{s.item.name}{s.item.enhance !== undefined && ` · +${s.item.enhance}`}</p>
              <ul className="mt-2 space-y-1 text-sm text-zinc-300">
                {s.details.map((d) => <li key={d}>{d}</li>)}
              </ul>
            </div>
          </div>
        </li>
      ))}
      {done.length > 0 && (
        <li className="rounded-2xl border border-amber-400/30 bg-amber-400/5 p-4 text-sm">
          <span className="font-semibold text-amber-300">Schon BiS:</span> {done.map((d) => d.name).join(", ")}
        </li>
      )}
    </ol>
  );
}

function ItemList({ char, items }: { char: Character; items: Item[] }) {
  return (
    <ul className="space-y-3">
      {items.map((item, idx) => {
        const want = missingIdealLines(char.className, item.slot, item.lines.map((l) => l.name), 4);
        return (
          <li key={`${item.name}-${idx}`} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="text-[11px] uppercase tracking-wide text-zinc-500">{SLOT_LABEL_DE[item.slot]}</div>
                <div className="font-semibold leading-snug">{item.name}</div>
                <div className="text-xs text-zinc-500">
                  {[item.level && `Lv ${item.level}`, item.rarity, item.enhance !== undefined && `+${item.enhance}`, item.exceed && `Exceed ${item.exceed}`].filter(Boolean).join(" · ")}
                </div>
              </div>
              {item.scored ? <GradeBadge grade={item.grade} score={item.score} /> : <span className="text-xs text-zinc-500">ohne Wertung</span>}
            </div>
            {item.lines.length > 0 && (
              <ul className="mt-3 space-y-1.5">
                {item.lines.map((l, i) => {
                  const sh = shareOf(char, item, l);
                  const good = sh !== undefined && sh >= GOOD_SHARE;
                  const pct = l.max ? Math.min(100, (parseFloat(l.value.replace(/[+,%]/g, "")) / parseFloat(l.max.replace(/[+,%]/g, ""))) * 100) : undefined;
                  return (
                    <li key={i} className="text-sm">
                      <div className="flex items-center justify-between gap-2">
                        <span className={good ? "text-emerald-300" : sh === undefined ? "text-zinc-300" : "text-red-300"}>
                          {good ? "✓ " : sh === undefined ? "" : "✗ "}{l.name}
                        </span>
                        <span className="shrink-0 tabular-nums text-zinc-400">
                          {l.value}{l.max && <span className="text-zinc-600">/{l.max}</span>}
                          {sh !== undefined && <span className="ml-2 text-[11px] text-zinc-500">{sh}%</span>}
                        </span>
                      </div>
                      {pct !== undefined && (
                        <div className="mt-1 h-1 rounded bg-white/10">
                          <div className={`h-1 rounded ${good ? "bg-emerald-400" : "bg-zinc-500"}`} style={{ width: `${pct}%` }} />
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
            {item.scored && item.grade !== "BiS" && want.length > 0 && (
              <p className="mt-3 text-xs text-zinc-400"><span className="text-amber-300">BiS-Linien, die fehlen:</span> {want.join(", ")}</p>
            )}
            {item.fixedLines && <p className="mt-2 text-xs text-zinc-500">Feste Linien, nicht rerollbar.</p>}
          </li>
        );
      })}
    </ul>
  );
}
