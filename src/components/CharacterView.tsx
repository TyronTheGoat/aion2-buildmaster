"use client";
import { useMemo, useState } from "react";
import type { Character, Item } from "@/lib/types";
import { buildPlan, type UpgradeStep } from "@/lib/advisor";
import { ARCANA_GENERAL_TIPS } from "@/lib/knowledge/arcana";
import { classKey } from "@/lib/knowledge/ideal-lines";
import { GradeBadge } from "./GradeBadge";
import { ItemCards } from "./ItemCards";
import { ItemIcon } from "./ui";

type Tab = "gear" | "arcana" | "plan";

const KIND_LABEL: Record<UpgradeStep["kind"], string> = {
  reroll: "Neu rollen", replace: "Ersetzen", arcana: "Arcana", enhance: "Verbessern", keep: "Fertig",
};
const EFFORT = ["", "wenig Aufwand", "mittlerer Aufwand", "viel Aufwand"];

export function CharacterView({ char, onBack, onRefresh, onRemove }: {
  char: Character; onBack?: () => void; onRefresh?: () => void; onRemove?: () => void;
}) {
  const [tab, setTab] = useState<Tab>("gear");
  const plan = useMemo(() => buildPlan(char), [char]);
  const knownClass = !!classKey(char.className) || [...char.gear, ...char.arcana].some((i) => i.ideal?.length);

  return (
    <div className="space-y-4">
      {onBack && (
        <div className="flex items-center justify-between text-sm">
          <button onClick={onBack} className="text-zinc-400 hover:text-white">‹ Charaktere</button>
          <div className="flex gap-3 text-zinc-400">
            {onRefresh && <button onClick={onRefresh} className="hover:text-white">↻ Aktualisieren</button>}
            {onRemove && <button onClick={onRemove} className="hover:text-red-300">Entfernen</button>}
          </div>
        </div>
      )}
      <section className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.06] to-transparent p-4">
        <h1 className="text-2xl font-bold">{char.name}</h1>
        <p className="text-sm text-zinc-400">
          {[char.race, char.className, char.level && `Lv ${char.level}`, `${char.server} · ${char.region.toUpperCase()}`].filter(Boolean).join(" · ")}
        </p>
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
            Für {char.className ?? "diese Klasse"} fehlen noch BiS-Daten. Die Bewertung nutzt nur die kisk-Noten.
          </p>
        )}
      </section>

      <div className="sticky top-[57px] z-[5] -mx-4 flex gap-1 bg-[#0b0b12]/95 px-4 py-2 backdrop-blur">
        {([["gear", "Ausrüstung"], ["arcana", "Arcana"], ["plan", `Upgrade-Pfad (${plan.steps.length})`]] as [Tab, string][]).map(([t, label]) => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex-1 rounded-lg py-2 text-sm font-medium ${tab === t ? "bg-amber-400 text-black" : "bg-white/5 text-zinc-300"}`}>
            {label}
          </button>
        ))}
      </div>

      {tab === "gear" && (
        <>
          <p className="text-xs text-zinc-500">Ist-Stand deiner Ausrüstung. Tippe auf ein Teil, um das BiS-Ziel zu sehen.</p>
          <ItemCards char={char} items={char.gear} />
        </>
      )}
      {tab === "arcana" && (
        <>
          <p className="text-xs text-zinc-500">Tippe auf eine Karte, um die BiS-Fähigkeiten mit Ziel-Stufe zu sehen.</p>
          <ItemCards char={char} items={char.arcana} arcana />
          <section className="rounded-2xl border border-white/10 p-4">
            <h3 className="mb-2 font-semibold">Arcana-Tipps</h3>
            <ul className="list-disc space-y-1 pl-5 text-sm text-zinc-300">
              {ARCANA_GENERAL_TIPS.map((t) => <li key={t}>{t}</li>)}
            </ul>
          </section>
        </>
      )}
      {tab === "plan" && <PlanList steps={plan.steps} done={plan.done} />}

      <p className="text-xs text-zinc-500">
        Stand: {new Date(char.source.fetchedAt).toLocaleString("de-DE")} · Quelle:{" "}
        <a href={char.source.url} className="underline" target="_blank" rel="noreferrer">kisk.app</a>
        {char.source.mode === "demo" && " (Schnappschuss)"}
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
  if (!order.some((g) => counts[g])) return null;
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
            <div className="relative">
              <ItemIcon src={s.item.icon} name={s.item.name} grade={s.item.grade} size={44} tall={s.item.slot === "arcana"} />
              <span className="absolute -left-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-amber-400 text-xs font-bold text-black">{i + 1}</span>
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-zinc-300">{KIND_LABEL[s.kind]}</span>
                <GradeBadge grade={s.item.grade} score={s.item.score} size="sm" />
                <span className="text-xs text-zinc-500">→</span>
                <GradeBadge grade={s.target} size="sm" />
                <span className="text-[11px] text-zinc-500">{EFFORT[s.effort]}</span>
              </div>
              <h3 className="mt-1.5 font-semibold leading-snug">{s.title}</h3>
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
