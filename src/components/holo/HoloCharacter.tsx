"use client";
import { lazy, Suspense, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import type { Character, Item } from "@/lib/types";
import { BODY_SLOTS, bodyItems, hexCss, weaponKindFor, type Gender } from "@/lib/hologram";
import { SLOT_LABEL_DE } from "@/lib/knowledge/slots";
import { GradeBadge } from "../GradeBadge";
import { GearCompare } from "../GearCompare";
import { AuraLegend } from "./AuraLegend";

const HoloScene = lazy(() => import("./HoloScene"));

const wide = {
  subscribe: (cb: () => void) => { const m = matchMedia("(min-width: 768px)"); m.addEventListener("change", cb); return () => m.removeEventListener("change", cb); },
  get: () => matchMedia("(min-width: 768px)").matches,
};

/** Full-screen hologram of the character. Tap a part → camera flies there → Ist vs BiS panel. */
export function HoloCharacter({ char, gender, onBack, onDetails, onGender }: {
  char: Character; gender: Gender; onBack: () => void; onDetails: () => void; onGender: (g: Gender) => void;
}) {
  const items = useMemo(() => bodyItems(char), [char]);
  const grades = useMemo(() => Object.fromEntries([...items].map(([id, it]) => [id, it.scored ? it.grade : "?" as const])), [items]);
  const weapon = useMemo(() => weaponKindFor(char), [char]);
  const isWide = useSyncExternalStore(wide.subscribe, wide.get, () => false);
  const [focus, setFocus] = useState<string>();
  const [shown, setShown] = useState<string>(); // keeps the panel content while it slides out
  const [error, setError] = useState<string>();
  const [hint, setHint] = useState(true);
  const [listPref, setListPref] = useState<boolean>(); // undefined: open on wide screens, closed on phones
  const listOpen = listPref ?? isWide;

  useEffect(() => {
    if (focus) return;
    const t = setTimeout(() => setShown(undefined), 450);
    return () => clearTimeout(t);
  }, [focus]);
  useEffect(() => {
    const t = setTimeout(() => setHint(false), 7000);
    return () => clearTimeout(t);
  }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setFocus(undefined);
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, []);

  const pick = (id: string | undefined) => {
    const next = id && items.has(id) ? id : undefined;
    setFocus(next);
    if (next) { setShown(next); setHint(false); }
  };
  const choose = (id: string) => {
    if (!isWide) setListPref(false);
    pick(id);
  };
  const item = shown ? items.get(shown) : undefined;

  return (
    <div className="fixed inset-0 z-30 overflow-hidden bg-[#03070f] text-white">
      {error ? (
        <div className="flex h-full items-center justify-center p-8 text-center text-sm text-sky-200/80">{error}</div>
      ) : (
        <Suspense fallback={<div className="flex h-full items-center justify-center text-sm tracking-[0.3em] text-sky-300/70">LADE HOLOGRAMM…</div>}>
          <HoloScene key={gender} gender={gender} weapon={weapon} offhand={items.has("offhand:0")} grades={grades} focus={focus} panel={isWide ? "right" : "bottom"} panelWidth={isWide ? 680 : undefined} onPick={pick} onError={setError} />
        </Suspense>
      )}

      {/* top bar */}
      <div className="pointer-events-none absolute inset-x-0 top-0 bg-gradient-to-b from-[#03070f] via-[#03070f]/70 to-transparent px-4 pb-10 pt-[calc(0.75rem+env(safe-area-inset-top))]">
        <div className="pointer-events-auto mx-auto flex max-w-5xl items-center justify-between gap-3">
          <button onClick={focus ? () => setFocus(undefined) : onBack}
            className="whitespace-nowrap rounded-full border border-sky-300/15 bg-white/5 px-3.5 py-1.5 text-sm text-sky-100/90 backdrop-blur-xl transition hover:bg-white/10">
            ‹ {focus ? "Gesamt" : "Zurück"}
          </button>
          <div className="min-w-0 text-center">
            <div className="truncate text-lg font-semibold tracking-tight">{char.name}</div>
            <div className="truncate text-[11px] uppercase tracking-[0.2em] text-sky-300/70">
              {[char.className, char.server].filter(Boolean).join(" · ")}
            </div>
          </div>
          <div className="flex gap-1.5">
            <button onClick={() => onGender(gender === "f" ? "m" : "f")} title="Modell wechseln"
              className="h-9 w-9 rounded-full border border-sky-300/15 bg-white/5 text-sm text-sky-100/90 backdrop-blur-xl hover:bg-white/10">
              {gender === "f" ? "♀" : "♂"}
            </button>
            <button onClick={onDetails}
              className="rounded-full border border-sky-300/15 bg-white/5 px-3.5 py-1.5 text-sm text-sky-100/90 backdrop-blur-xl hover:bg-white/10">
              Liste
            </button>
          </div>
        </div>
      </div>

      <AuraLegend className={`pointer-events-none absolute inset-x-0 bottom-[calc(3.2rem+env(safe-area-inset-bottom))] transition-opacity duration-500 ${focus ? "opacity-0" : "opacity-100"}`} />
      <p className={`pointer-events-none absolute inset-x-0 bottom-[calc(1.5rem+env(safe-area-inset-bottom))] text-center text-xs tracking-[0.25em] text-sky-200/60 transition-opacity duration-700 ${hint && !focus ? "opacity-100" : "opacity-0"}`}>
        TIPPE AUF EIN TEIL · ZIEHEN ZUM DREHEN
      </p>

      {/* gear tab on the right: every piece, including both rings / earrings / bracelets */}
      {!focus && !listOpen && (
        <button onClick={() => setListPref(true)}
          className="absolute right-0 top-1/2 z-10 -translate-y-1/2 rounded-l-2xl border border-r-0 border-sky-300/20 bg-[#07101f]/70 px-2 py-4 text-[11px] font-medium uppercase tracking-[0.25em] text-sky-100/80 backdrop-blur-xl [writing-mode:vertical-rl] hover:bg-[#0b1830]/80">
          Ausrüstung
        </button>
      )}
      <div className={`absolute z-10 transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]
        ${isWide ? "bottom-4 right-4 top-20 w-[300px]" : "bottom-24 right-3 top-20 w-[264px]"}
        ${!focus && listOpen ? "translate-x-0 opacity-100" : "pointer-events-none translate-x-10 opacity-0"}`}>
        <GearList items={items} active={focus} onPick={choose} onClose={() => setListPref(false)} />
      </div>

      {/* info panel */}
      <div className={`absolute z-10 transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]
        ${isWide ? "bottom-4 right-4 top-20 w-[min(680px,calc(100vw-2rem))]" : "inset-x-0 bottom-0 max-h-[72vh]"}
        ${focus ? "translate-x-0 translate-y-0 opacity-100" : isWide ? "pointer-events-none translate-x-8 opacity-0" : "pointer-events-none translate-y-full opacity-0"}`}>
        {item && shown && <GearCompare char={char} item={item} slotId={shown} label={slotLabel(shown, items)} wide={isWide} onClose={() => setFocus(undefined)} />}
      </div>
    </div>
  );
}

/** Label with a number for paired slots: "Ring 1", "Ring 2". */
function slotLabel(id: string, items: Map<string, Item>) {
  const [slot, idx] = id.split(":");
  const pairs = [...items.keys()].filter((k) => k.startsWith(`${slot}:`)).length;
  return `${SLOT_LABEL_DE[slot as Item["slot"]]}${pairs > 1 ? ` ${+idx + 1}` : ""}`;
}

function GearList({ items, active, onPick, onClose }: { items: Map<string, Item>; active?: string; onPick: (id: string) => void; onClose: () => void }) {
  const ids = [...items.keys()].sort((a, b) => BODY_SLOTS.indexOf(a.split(":")[0] as Item["slot"]) - BODY_SLOTS.indexOf(b.split(":")[0] as Item["slot"]) || a.localeCompare(b));
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-3xl border border-sky-200/10 bg-[#07101f]/70 shadow-2xl shadow-black/40 backdrop-blur-2xl">
      <div className="flex items-center justify-between px-4 pb-2 pt-3.5">
        <span className="text-[10px] uppercase tracking-[0.3em] text-sky-300/70">Ausrüstung</span>
        <button onClick={onClose} aria-label="Liste schließen" className="rounded-full bg-white/5 px-2 py-0.5 text-xs text-zinc-300 hover:bg-white/10">›</button>
      </div>
      <ul className="flex-1 overflow-y-auto px-2 pb-2">
        {ids.map((id) => {
          const it = items.get(id)!;
          const rated = it.scored && it.grade !== "?";
          return (
            <li key={id}>
              <button onClick={() => onPick(id)}
                className={`flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition hover:bg-white/[0.06] ${active === id ? "bg-white/[0.08]" : ""}`}>
                <span className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={rated ? { background: hexCss(it.grade), boxShadow: `0 0 10px ${hexCss(it.grade)}` } : { background: "#334155" }} />
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-medium leading-tight text-white">{slotLabel(id, items)}</span>
                  <span className="block truncate text-[11px] leading-tight text-zinc-500">{it.name}</span>
                </span>
                {rated ? <GradeBadge grade={it.grade} size="sm" /> : <span className="text-[10px] text-zinc-600">–</span>}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** First-open question: which base body the hologram uses. */
export function GenderPicker({ name, onPick, onBack }: { name: string; onPick: (g: Gender) => void; onBack: () => void }) {
  return (
    <div className="fixed inset-0 z-30 flex flex-col items-center justify-center bg-[#03070f] px-6 text-white">
      <button onClick={onBack} className="absolute left-4 top-[calc(0.75rem+env(safe-area-inset-top))] rounded-full border border-sky-300/15 bg-white/5 px-3.5 py-1.5 text-sm text-sky-100/90">‹ Charaktere</button>
      <div className="text-[11px] uppercase tracking-[0.3em] text-sky-300/70">Hologramm einrichten</div>
      <h1 className="mt-2 text-center text-2xl font-semibold tracking-tight">Ist {name} weiblich oder männlich?</h1>
      <p className="mt-1 text-sm text-zinc-400">Du kannst das später jederzeit ändern.</p>
      <div className="mt-8 grid w-full max-w-md grid-cols-2 gap-4">
        {(["f", "m"] as const).map((g) => (
          <button key={g} onClick={() => onPick(g)}
            className="group rounded-3xl border border-sky-300/15 bg-sky-400/[0.04] p-5 transition hover:border-sky-300/40 hover:bg-sky-400/[0.08] active:scale-[0.98]">
            <Silhouette g={g} />
            <div className="mt-3 text-center font-medium text-sky-100">{g === "f" ? "Weiblich" : "Männlich"}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

function Silhouette({ g }: { g: Gender }) {
  const f = g === "f";
  return (
    <svg viewBox="0 0 100 200" className="mx-auto h-40 drop-shadow-[0_0_10px_rgba(56,152,255,0.9)] transition group-hover:drop-shadow-[0_0_16px_rgba(120,200,255,1)]" aria-hidden>
      <g fill="rgba(47,141,255,0.16)" stroke="#5fb4ff" strokeWidth="1.4">
        <ellipse cx="50" cy="22" rx={f ? 10 : 11} ry={f ? 13 : 14} />
        <path d={f
          ? "M43 36 L57 36 L60 42 Q70 44 72 52 L80 98 L76 100 L66 60 L64 78 Q70 92 68 104 L64 150 L62 186 L55 186 L52 108 L48 108 L45 186 L38 186 L36 150 L32 104 Q30 92 36 78 L34 60 L24 100 L20 98 L28 52 Q30 44 40 42 Z"
          : "M43 37 L57 37 L60 43 Q74 45 77 54 L86 100 L81 102 L70 62 L68 92 L68 108 L64 150 L62 188 L54 188 L52 112 L48 112 L46 188 L38 188 L36 150 L32 108 L32 92 L30 62 L19 102 L14 100 L23 54 Q26 45 40 43 Z"} />
      </g>
    </svg>
  );
}
