"use client";
import { useState, type CSSProperties, type PointerEvent, type ReactNode } from "react";
import type { Grade } from "@/lib/types";
import { GRADE_GLOW, GRADE_HEX_CSS } from "@/lib/grades";

/**
 * A physical card with depth: graphite face with bevelled edges (light top edge, dark bottom edge),
 * a thin slab edge underneath, layered shadows, a thin champagne-gold frame, a soft sheen and an
 * indirect light underneath in the colour of its rank (BiS gold … D crimson). The light is kept tight
 * so neighbouring cards do not bleed into each other.
 * Clickable cards tilt a little towards the pointer (not with reduced motion).
 * Palette taken from the Splendent Ebony Dragon Lord Orb: champagne gold, sapphire, aqua, graphite.
 */
export function Card({ grade = "?", children, className = "", onClick, as = "div", label }: {
  grade?: Grade; children: ReactNode; className?: string; onClick?: () => void; as?: "div" | "button"; label?: string;
}) {
  const hex = GRADE_HEX_CSS[grade];
  const g = GRADE_GLOW[grade];
  const a = (x: number) => Math.round(Math.min(1, x) * 255).toString(16).padStart(2, "0");
  const style = {
    "--glow": hex,
    boxShadow: [
      `0 0 0 1px ${hex}${a(0.3 + g * 0.3)}`, // rim
      "inset 0 1px 0 rgba(255,255,255,0.16)", // top bevel highlight
      "inset 0 -3px 6px rgba(0,0,0,0.55)", // bottom bevel
      `inset 0 0 18px ${hex}${a(0.06 + g * 0.1)}`, // light caught inside the face
      "0 3px 0 -0.5px #06070a", // slab edge
      `0 3px 0 0 ${hex}${a(0.15 + g * 0.2)}`, // lit slab edge
      `0 0 ${6 + g * 8}px ${hex}${a(0.18 + g * 0.3)}`, // tight backlight
      `0 ${10 + g * 4}px ${14 + g * 8}px -8px ${hex}${a(0.35 + g * 0.4)}`, // indirect light underneath
      "0 16px 22px -14px #000", // contact shadow
    ].join(", "),
  } as CSSProperties;
  const cls = `card-face relative isolate overflow-hidden rounded-[18px] text-left ${onClick ? "card-tilt" : ""} ${className}`;
  const inner = (
    <>
      {/* gold frame inset */}
      <span aria-hidden className="pointer-events-none absolute inset-[5px] rounded-[13px] border border-[#d9c58f]/25" />
      {/* sheen, follows the tilt */}
      <span aria-hidden className="card-sheen pointer-events-none absolute -left-1/3 -top-1/2 h-[120%] w-2/3 rotate-12 bg-gradient-to-b from-white/[0.08] to-transparent" />
      {children}
    </>
  );
  if (as !== "button") return <div style={style} className={cls}>{inner}</div>;
  const tilt = (e: PointerEvent<HTMLButtonElement>) => {
    if (e.pointerType !== "mouse" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const r = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
    e.currentTarget.style.setProperty("--ry", `${(x * 10).toFixed(2)}deg`);
    e.currentTarget.style.setProperty("--rx", `${(-y * 10).toFixed(2)}deg`);
    e.currentTarget.style.setProperty("--sx", `${(x * 30).toFixed(1)}px`);
    e.currentTarget.style.setProperty("--sy", `${(y * 30).toFixed(1)}px`);
  };
  const reset = (e: PointerEvent<HTMLButtonElement>) => { for (const k of ["--rx", "--ry", "--sx", "--sy"]) e.currentTarget.style.removeProperty(k); };
  return <button type="button" onClick={onClick} onPointerMove={tilt} onPointerLeave={reset} style={style} className={cls} aria-label={label}>{inner}</button>;
}

/** Big framed icon for the top of a card. */
export function CardArt({ src, alt, grade = "?" }: { src?: string; alt: string; grade?: Grade }) {
  return (
    <div className="relative mx-auto aspect-square w-full overflow-hidden rounded-xl bg-[radial-gradient(circle_at_50%_40%,#1f3a66_0%,#111a2b_55%,#0a0d14_100%)]">
      <span aria-hidden className="absolute inset-0 opacity-60" style={{ background: `radial-gradient(circle at 50% 55%, ${GRADE_HEX_CSS[grade]}33 0%, transparent 60%)` }} />
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={alt} loading="lazy" referrerPolicy="no-referrer" className="relative h-full w-full object-contain p-[8%] drop-shadow-[0_6px_14px_rgba(0,0,0,0.6)]"
          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
      ) : (
        <svg viewBox="0 0 24 24" className="relative mx-auto h-full w-1/2 text-[#d9c58f]/40" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" aria-hidden>
          <path d="M12 3 5 6v5c0 5 3 8 7 10 4-2 7-5 7-10V6z" />
        </svg>
      )}
    </div>
  );
}

/**
 * Layout phase: character pictures and item icons are neutral placeholders for now.
 * Set to true to show the original item icons again (data and matching stay unchanged).
 */
export const SHOW_ITEM_ICONS = true;

/**
 * Character portrait from kisk.app (NCSOFT profile image), loaded live. Falls back to the neutral placeholder
 * when there is none or it cannot be loaded (e.g. offline without internet).
 */
export function Portrait({ src, name, className = "" }: { src?: string; name: string; className?: string }) {
  const [failed, setFailed] = useState<string>();
  if (!src || failed === src) return <Filler className={className} />;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={name} referrerPolicy="no-referrer" onError={() => setFailed(src)}
      className={`shrink-0 rounded-xl object-cover ring-1 ring-[#d9c58f]/30 ${className}`} />
  );
}

/** Neutral placeholder area (no picture, no decoration). */
export function Filler({ className = "", label }: { className?: string; label?: string }) {
  return (
    <div className={`flex shrink-0 items-center justify-center rounded-xl border border-dashed border-white/15 bg-white/[0.03] text-[10px] uppercase tracking-[0.2em] text-zinc-600 ${className}`}>
      {label}
    </div>
  );
}
