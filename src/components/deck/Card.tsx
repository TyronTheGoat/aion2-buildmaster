"use client";
import { useState, type CSSProperties, type PointerEvent, type ReactNode } from "react";
import type { Grade } from "@/lib/types";
import { GRADE_HEX_CSS, RANK_STYLE } from "@/lib/grades";

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
  const r = RANK_STYLE[grade];
  const hex = r.borderColor, glow = r.glowColor, g = r.backgroundGlow;
  const a = (x: number) => Math.round(Math.max(0, Math.min(1, x)) * 255).toString(16).padStart(2, "0");
  // layered depth + rank light; "peak" is the same with a stronger light for the pulse
  const shadow = (k: number) => [
    `0 0 0 1px ${hex}${a(0.35 + g * 0.35 + k * 0.15)}`, // frame
    "inset 0 1px 0 rgba(255,255,255,0.16)", // top bevel highlight
    "inset 0 -3px 6px rgba(0,0,0,0.55)", // bottom bevel
    `inset 0 0 ${16 + k * 6}px ${glow}${a(0.05 + g * 0.12 + k * 0.08)}`, // light caught inside the face
    "0 3px 0 -0.5px #06070a", // slab edge
    `0 3px 0 0 ${hex}${a(0.12 + g * 0.25)}`, // lit slab edge
    `0 0 ${4 + g * 10 + k * 6}px ${glow}${a(0.12 + g * 0.4 + k * 0.2)}`, // outer glow (kept tight, cards do not bleed into each other)
    `0 ${8 + g * 6}px ${10 + g * 12 + k * 6}px -8px ${glow}${a(0.2 + g * 0.5 + k * 0.15)}`, // indirect light underneath
    "0 16px 22px -14px #000", // contact shadow
  ].join(", ");
  const style = {
    "--glow": glow,
    "--rank-base": shadow(0),
    "--rank-peak": shadow(r.pulseStrength),
    "--rank-period": `${r.period || 4}s`,
    boxShadow: shadow(0),
  } as CSSProperties;
  const cls = `card-face relative isolate overflow-hidden rounded-[18px] text-left rank-${r.animationStyle} ${onClick ? "card-tilt" : ""} ${className}`;
  const inner = (
    <>
      {/* gold frame inset */}
      <span aria-hidden className="pointer-events-none absolute inset-[5px] rounded-[13px] border border-[#d9c58f]/25" />
      {/* glitter and a passing shine for the top ranks (BiS strongest, S+ light) */}
      {r.sparkleIntensity > 0 && <span aria-hidden className="rank-shine pointer-events-none absolute inset-0" style={{ "--shine": r.sparkleIntensity } as CSSProperties} />}
      {r.sparkleIntensity > 0.6 && <span aria-hidden className="rank-sparkle pointer-events-none absolute inset-0" />}
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
