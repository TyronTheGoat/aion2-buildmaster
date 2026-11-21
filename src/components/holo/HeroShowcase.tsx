"use client";
import { lazy, Suspense, useMemo } from "react";
import type { Character } from "@/lib/types";
import { bodyItems, hexCss, LEGEND_GRADES, weaponKindFor, type Gender } from "@/lib/hologram";

const HoloScene = lazy(() => import("./HoloScene"));

/** Grade → aura colour key, so the colours on the model can be read at a glance. */
export function AuraLegend({ className = "" }: { className?: string }) {
  return (
    <div className={`flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[10px] font-medium tracking-[0.14em] text-sky-100/60 ${className}`}>
      {LEGEND_GRADES.map((g) => (
        <span key={g} className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full" style={{ background: hexCss(g), boxShadow: `0 0 8px ${hexCss(g)}` }} />
          {g}
        </span>
      ))}
    </div>
  );
}

/** Start-page hero: the featured character as a slowly turning hologram on its stage. */
export function HeroShowcase({ char, name, server, gender, onOpen }: {
  char?: Character; name: string; server: string; gender: Gender; onOpen: () => void;
}) {
  const grades = useMemo(
    () => (char ? Object.fromEntries([...bodyItems(char)].map(([id, it]) => [id, it.scored ? it.grade : ("?" as const)])) : {}),
    [char],
  );
  const weapon = useMemo(() => (char ? weaponKindFor(char) : "sword"), [char]);

  return (
    <section className="relative -mx-4 overflow-hidden sm:mx-0 sm:rounded-[2rem] sm:border sm:border-sky-300/10" style={{ height: "min(76vh, 660px)" }}>
      <Suspense fallback={null}>
        <HoloScene key={`${name}-${gender}`} mode="hero" gender={gender} weapon={weapon} grades={grades} panel="bottom" onPick={onOpen} />
      </Suspense>
      <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-[#03070f] via-[#03070f]/60 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-[#03070f] via-[#03070f]/70 to-transparent" />

      <div className="pointer-events-none absolute inset-x-0 top-0 px-5 pt-6 sm:px-8">
        <div className="text-[10px] uppercase tracking-[0.35em] text-sky-300/70">Showcase</div>
        <h1 className="mt-1.5 text-4xl font-semibold tracking-tight text-white sm:text-5xl">{name}</h1>
        <p className="mt-1 text-sm text-sky-100/55">{[char?.className, server].filter(Boolean).join(" · ")}</p>
      </div>

      <div className="absolute inset-x-0 bottom-0 flex flex-col items-center gap-4 px-5 pb-6">
        <button onClick={onOpen}
          className="rounded-full border border-sky-200/30 bg-white/10 px-6 py-2.5 text-sm font-medium text-white backdrop-blur-xl transition hover:bg-white/15 hover:shadow-[0_0_28px_rgba(80,170,255,0.35)] active:scale-[0.98]">
          Ausrüstung ansehen ›
        </button>
        <AuraLegend />
      </div>
    </section>
  );
}
