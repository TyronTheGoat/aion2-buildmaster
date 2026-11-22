"use client";
import type { CSSProperties, ReactNode } from "react";
import type { Grade } from "@/lib/types";
import { GRADE_GLOW, GRADE_HEX_CSS } from "@/lib/grades";

/**
 * A physical-looking card: graphite face, thin champagne-gold frame, soft sheen,
 * and an indirect backlight in the colour of its rank (BiS gold … D crimson).
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
    boxShadow: `0 0 0 1px ${hex}${a(0.35 + g * 0.3)}, 0 0 ${14 + g * 22}px ${hex}${a(0.25 + g * 0.35)}, 0 ${10 + g * 10}px ${30 + g * 40}px -6px ${hex}${a(0.18 + g * 0.3)}, 0 18px 40px -18px #000`,
  } as CSSProperties;
  const cls = `card-face relative isolate overflow-hidden rounded-[18px] text-left ${onClick ? "transition duration-200 hover:-translate-y-1 active:translate-y-0 active:scale-[0.98]" : ""} ${className}`;
  const inner = (
    <>
      {/* gold frame inset */}
      <span aria-hidden className="pointer-events-none absolute inset-[5px] rounded-[13px] border border-[#d9c58f]/25" />
      {/* sheen */}
      <span aria-hidden className="pointer-events-none absolute -left-1/3 -top-1/2 h-[120%] w-2/3 rotate-12 bg-gradient-to-b from-white/[0.07] to-transparent" />
      {children}
    </>
  );
  return as === "button"
    ? <button type="button" onClick={onClick} style={style} className={cls} aria-label={label}>{inner}</button>
    : <div style={style} className={cls}>{inner}</div>;
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

/** Neutral placeholder area (no picture, no decoration). */
export function Filler({ className = "", label }: { className?: string; label?: string }) {
  return (
    <div className={`flex shrink-0 items-center justify-center rounded-xl border border-dashed border-white/15 bg-white/[0.03] text-[10px] uppercase tracking-[0.2em] text-zinc-600 ${className}`}>
      {label}
    </div>
  );
}
