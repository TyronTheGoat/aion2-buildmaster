"use client";
/**
 * Small pieces from Tyron's list of 2026-11-24 (offline preview first): favourite star, "?" explanations,
 * the three intro pop-ups on the first visit, and the progress view with the CP curve.
 */
import { useEffect, useId, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { numberLocale, useLang, useT } from "@/lib/i18n";
import type { Character } from "@/lib/types";

/* ------------------------------------------------------------------ favourite star */

export function FavStar({ on, onToggle, className = "" }: { on: boolean; onToggle: () => void; className?: string }) {
  const t = useT();
  return (
    <button type="button" aria-pressed={on} title={on ? t("Favorit entfernen", "Remove favourite") : t("Als Favorit markieren", "Mark as favourite")}
      aria-label={on ? t("Favorit entfernen", "Remove favourite") : t("Als Favorit markieren", "Mark as favourite")}
      onClick={(e) => { e.stopPropagation(); e.preventDefault(); onToggle(); }}
      className={`fav-star grid h-9 w-9 place-items-center rounded-full text-xl leading-none ${on ? "fav-star-on" : "text-zinc-500 hover:text-[#d9c58f]"} ${className}`}>
      <span aria-hidden>{on ? "★" : "☆"}</span>
    </button>
  );
}

/* ------------------------------------------------------------------ "?" explanation */

export function Help({ text, className = "" }: { text: string; className?: string }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const id = useId();
  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    const tm = setTimeout(() => window.addEventListener("click", close), 0);
    return () => { clearTimeout(tm); window.removeEventListener("click", close); };
  }, [open]);
  return (
    <span className={`relative inline-flex align-middle ${className}`}>
      <button type="button" aria-expanded={open} aria-controls={id} aria-label={t("Erklärung", "Explanation")} onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }}
        className="grid h-5 w-5 place-items-center rounded-full border border-[#d9c58f]/35 text-[11px] font-semibold leading-none text-[#d9c58f] hover:border-[#d9c58f]/70">?</button>
      {open && (
        <span id={id} role="note" onClick={(e) => e.stopPropagation()}
          className="card-face pop-in absolute left-1/2 top-7 z-[60] w-64 -translate-x-1/2 rounded-xl px-3 py-2.5 text-left text-xs font-normal normal-case leading-relaxed tracking-normal text-[#efe6cc] ring-1 ring-[#d9c58f]/40">
          {text}
        </span>
      )}
    </span>
  );
}

/* ------------------------------------------------------------------ intro on the first visit */

export const INTRO_KEY = "bm:intro";

export function IntroPopups() {
  const t = useT();
  const [step, setStep] = useState(() => (typeof window !== "undefined" && !localStorage.getItem(INTRO_KEY) ? 0 : -1));
  const steps: [string, string][] = [
    [t("Willkommen bei BuildMaster", "Welcome to BuildMaster"),
      t("Füge deinen Charakter mit dem kisk.app-Link oder einfach seinem Namen hinzu. Die Daten kommen automatisch von kisk.app und werden alle 30 Minuten aktualisiert.",
        "Add your character with its kisk.app link or simply its name. The data comes from kisk.app automatically and is refreshed every 30 minutes.")],
    [t("Ausrüstung und Arcana", "Equipment and Arcana"),
      t("Im Charakter siehst du jedes Teil mit Rang und dem Vergleich zum BiS. Tippe eine Karte an: Was fehlt, was du neu rollen solltest und mit welcher Chance.",
        "Inside a character you see every piece with its rank and the comparison with BiS. Tap a card: what is missing, what to reroll and with which chance.")],
    [t("Skill-Planer und eigener BiS", "Skill planner and own BiS"),
      t("Plane, welche Abilities auf welche Stufe sollen. Speicherst du einen fertigen Build, kannst du ihn bei Ausrüstung und Arcana als Ziel wählen. Mit dem Stern markierst du Favoriten, sie stehen dann oben.",
        "Plan which abilities go to which level. Save a finished build and pick it as target in equipment and Arcana. The star marks favourites, they stay on top.")],
  ];
  if (step < 0) return null;
  const done = () => { localStorage.setItem(INTRO_KEY, JSON.stringify({ seen: new Date().toISOString() })); setStep(-1); };
  const [title, body] = steps[step];
  return createPortal(
    <div className="fixed inset-0 z-[95] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px]" />
      <div key={step} className="card-face pop-in relative w-full max-w-sm rounded-2xl p-5 ring-1 ring-[#d9c58f]/40">
        <div className="mb-1 text-[11px] uppercase tracking-widest text-zinc-500">{step + 1} / {steps.length}</div>
        <h2 className="text-lg font-semibold text-[#f4eed7]">{title}</h2>
        <p className="mt-2 text-sm leading-relaxed text-[#efe6cc]/85">{body}</p>
        <div className="mt-4 flex items-center gap-2">
          <button type="button" onClick={done} className="text-xs text-zinc-500 hover:text-zinc-300">{t("Überspringen", "Skip")}</button>
          <button type="button" onClick={() => (step + 1 < steps.length ? setStep(step + 1) : done())}
            className="ml-auto rounded-lg bg-amber-400 px-4 py-2 text-sm font-semibold text-black">
            {step + 1 < steps.length ? t("Weiter", "Next") : t("Los geht's", "Let's go")}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/* ------------------------------------------------------------------ progress: CP over time */

type Pt = [number, number];
const W = 600, H = 220, P = { l: 56, r: 16, t: 16, b: 28 };

/** Fetches the server's CP history (online); offline only the current snapshot is known. */
function useHistory(char: Character, key: string, online: boolean) {
  const [pts, setPts] = useState<Pt[] | null>(online ? null : []);
  useEffect(() => {
    if (!online) return;
    let live = true;
    fetch(`/api/history?k=${encodeURIComponent(key)}`, { credentials: "same-origin", cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { points: [] })).then((b) => { if (live) setPts(Array.isArray(b.points) ? b.points : []); })
      .catch(() => { if (live) setPts([]); });
    return () => { live = false; };
  }, [key, online]);
  return useMemo(() => {
    if (pts === null) return null;
    const now: Pt | undefined = char.combatPower ? [Date.parse(char.source.fetchedAt), char.combatPower] : undefined;
    const all = [...pts];
    if (now && !all.some((p) => p[0] === now[0])) all.push(now);
    return all.filter((p) => Number.isFinite(p[0]) && Number.isFinite(p[1])).sort((a, b) => a[0] - b[0]);
  }, [pts, char]);
}

export function ProgressView({ char, charKey, portrait, online, onClose }: { char: Character; charKey: string; portrait?: string; online: boolean; onClose: () => void }) {
  const t = useT();
  const lang = useLang();
  const pts = useHistory(char, charKey, online);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  const fmt = (n: number) => n.toLocaleString(numberLocale(lang));
  const date = (ms: number) => new Date(ms).toLocaleDateString(numberLocale(lang), { day: "2-digit", month: "2-digit" });

  // chart in a 600 x 220 box
  const chart = useMemo(() => {
    if (!pts?.length) return null;
    const x0 = pts[0][0], x1 = pts[pts.length - 1][0];
    const ys = pts.map((p) => p[1]);
    let y0 = Math.min(...ys), y1 = Math.max(...ys);
    const pad = Math.max(500, (y1 - y0) * 0.15);
    y0 -= pad; y1 += pad;
    const X = (v: number) => (x1 === x0 ? (P.l + W - P.r) / 2 : P.l + ((v - x0) / (x1 - x0)) * (W - P.l - P.r));
    const Y = (v: number) => P.t + (1 - (v - y0) / (y1 - y0)) * (H - P.t - P.b);
    const xy = pts.map((p) => [X(p[0]), Y(p[1])] as const);
    const line = xy.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
    const area = xy.length > 1 ? `${line} L${xy[xy.length - 1][0].toFixed(1)},${H - P.b} L${xy[0][0].toFixed(1)},${H - P.b} Z` : "";
    const ticks = [0, 0.5, 1].map((f) => y0 + f * (y1 - y0));
    return { xy, line, area, ticks, Y, x0, x1 };
  }, [pts]);
  const first = pts?.[0], last = pts?.[pts.length - 1];
  const gain = first && last ? last[1] - first[1] : 0;

  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-3 sm:p-4" role="dialog" aria-modal="true" aria-label={t("Fortschritt", "Progress")}>
      <button className="absolute inset-0 bg-black/65 backdrop-blur-[2px]" aria-label={t("Schließen", "Close")} onClick={onClose} />
      <div className="card-face pop-in relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl p-4 ring-1 ring-[#d9c58f]/40 sm:p-6">
        <button className="absolute right-3 top-2 text-2xl leading-none text-zinc-500 hover:text-[#f4eed7]" aria-label={t("Schließen", "Close")} onClick={onClose}>×</button>
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-end">
          <div className="relative h-40 w-40 shrink-0 overflow-hidden rounded-2xl bg-[radial-gradient(circle_at_50%_40%,#1f3a66_0%,#111a2b_70%)] ring-1 ring-[#d9c58f]/40">
            {portrait
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={portrait} alt={char.name} referrerPolicy="no-referrer" className="progress-portrait h-full w-full object-cover" />
              : <span className="grid h-full place-items-center text-4xl text-zinc-600">{char.name[0]}</span>}
          </div>
          <div className="min-w-0 text-center sm:text-left">
            <div className="text-[11px] uppercase tracking-widest text-zinc-500">{t("Fortschritt", "Progress")}</div>
            <h2 className="truncate text-2xl font-semibold text-[#f4eed7]">{char.name}</h2>
            <div className="text-sm text-[#beac80]/80">{char.className}</div>
            {last && <div className="mt-1 text-3xl font-semibold tabular-nums text-[#f4eed7]">{fmt(last[1])} <span className="text-base font-normal text-zinc-500">CP</span></div>}
            {pts && pts.length > 1 && <div className={`text-sm font-semibold ${gain >= 0 ? "text-[#5fbf8a]" : "text-[#ff8b8b]"}`}>{gain >= 0 ? "+" : ""}{fmt(gain)} {t("seit", "since")} {date(first![0])}</div>}
          </div>
        </div>

        <div className="mt-5 rounded-xl bg-black/20 p-2 ring-1 ring-white/5">
          {pts === null && <div className="h-[220px] animate-pulse rounded-lg bg-white/[0.03]" />}
          {chart && (
            <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={t("CP-Verlauf", "CP over time")}>
              <defs>
                <linearGradient id="cpArea" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#d9c58f" stopOpacity="0.35" /><stop offset="1" stopColor="#d9c58f" stopOpacity="0" /></linearGradient>
              </defs>
              {chart.ticks.map((v, i) => (
                <g key={i}>
                  <line x1={P.l} x2={W - P.r} y1={chart.Y(v)} y2={chart.Y(v)} stroke="rgba(255,255,255,0.06)" />
                  <text x={P.l - 8} y={chart.Y(v) + 4} textAnchor="end" fontSize="11" fill="#71717a">{fmt(Math.round(v / 100) * 100)}</text>
                </g>
              ))}
              {chart.area && <path d={chart.area} fill="url(#cpArea)" className="cp-area" />}
              {chart.xy.length > 1 && <path d={chart.line} fill="none" stroke="#d9c58f" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" pathLength={1} className="cp-line" />}
              {chart.xy.map(([x, y], i) => (
                <circle key={i} cx={x} cy={y} r={i === chart.xy.length - 1 ? 5 : 3.5} fill={i === chart.xy.length - 1 ? "#f4eed7" : "#d9c58f"} stroke="#0d1119" strokeWidth="1.5"
                  className="cp-dot" style={{ animationDelay: `${0.25 + (chart.xy.length > 1 ? (i / (chart.xy.length - 1)) * 1.1 : 0)}s` }}>
                  <title>{`${date(pts![i][0])}: ${fmt(pts![i][1])} CP`}</title>
                </circle>
              ))}
              <text x={P.l} y={H - 8} fontSize="11" fill="#71717a">{date(chart.x0)}</text>
              <text x={W - P.r} y={H - 8} fontSize="11" fill="#71717a" textAnchor="end">{date(chart.x1)}</text>
            </svg>
          )}
          {pts && pts.length < 2 && (
            <p className="px-2 pb-1 pt-2 text-center text-xs text-zinc-500">
              {online
                ? t("Der Verlauf sammelt sich seit dem 24.11.2026: mit jedem neuen Stand von kisk kommt ein Punkt dazu.", "The history is collected since 24 Nov 2026: every new snapshot from kisk adds a point.")
                : t("Den Verlauf speichert die Live-Seite. In der Offline-Version gibt es nur den aktuellen Stand.", "The live site stores the history. The offline version only has the current snapshot.")}
            </p>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
