"use client";
import { useState } from "react";
import type { Grade } from "@/lib/types";
import { assetUrl } from "./holo/assets";
import { GRADE_RING } from "./ui";

/**
 * Class emblem for the character list. Uses the official class icon when it is installed
 * (public/class-icons/<class>.png, git-ignored like the item icons; embedded in the offline file),
 * otherwise a neutral line symbol of the class weapon – never a made-up "official" icon.
 */
const SLUG: Record<string, string> = {
  gladiator: "gladiator", templar: "templar", assassin: "assassin", ranger: "ranger", sorcerer: "sorcerer",
  spiritmaster: "spiritmaster", cleric: "cleric", chanter: "chanter", fighter: "fighter",
  // German client names
  templer: "templar", assassine: "assassin", jäger: "ranger", zauberer: "sorcerer",
  beschwörer: "spiritmaster", kleriker: "cleric", kantor: "chanter",
};
export const classSlug = (cls?: string) => (cls ? SLUG[cls.trim().toLowerCase()] : undefined);

function Glyph({ slug }: { slug?: string }) {
  const p = { fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  switch (slug) {
    case "gladiator": return <g {...p}><path d="M6 6l11 11M18 6 7 17M5 9l3-3M16 5l3 3M5 15l3 3M16 19l3-3" /></g>;
    case "templar": return <g {...p}><path d="M12 3 5 6v5c0 5 3 8 7 10 4-2 7-5 7-10V6z" /><path d="M12 8v8M9 11h6" /></g>;
    case "assassin": return <g {...p}><path d="M7 5l6 9M17 5l-6 9M10 15l-2 4M14 15l2 4M9 14h6" /></g>;
    case "ranger": return <g {...p}><path d="M7 4c6 2 9 6 9 8s-3 6-9 8M7 4v16M5 12h13M15 10l3 2-3 2" /></g>;
    case "sorcerer": return <g {...p}><path d="M5 6c3-1 5-1 7 1 2-2 4-2 7-1v12c-3-1-5-1-7 1-2-2-4-2-7-1z" /><path d="M12 7v12" /></g>;
    case "spiritmaster": return <g {...p}><circle cx="12" cy="12" r="4" /><ellipse cx="12" cy="12" rx="8.5" ry="3.5" transform="rotate(-25 12 12)" /></g>;
    case "cleric": return <g {...p}><path d="M7 19 15 11M14 6l4 4M13 7l4 4M15 5l4 4-2 2-4-4z" /></g>;
    case "chanter": return <g {...p}><path d="M12 9v12M9.5 21h5" /><circle cx="12" cy="6" r="3" /><path d="M7 4.5 5.5 3.5M17 4.5l1.5-1M7 7.5H5M17 7.5h2" /></g>;
    default: return <g {...p}><circle cx="12" cy="8" r="3.5" /><path d="M5 20c1-4 4-6 7-6s6 2 7 6" /></g>;
  }
}

export function ClassIcon({ className, grade = "?", size = 56 }: { className?: string; grade?: Grade; size?: number }) {
  const slug = classSlug(className);
  const src = slug ? assetUrl(`class-icons/${slug}.png`) : undefined;
  const [failed, setFailed] = useState<string>();
  return (
    <div className={`relative flex shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-[#0d1b33] to-[#050b16] text-sky-200/85 ring-2 ${GRADE_RING[grade]}`}
      style={{ width: size, height: size }} title={className}>
      {src && failed !== src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={className ?? ""} className="h-[82%] w-[82%] object-contain" onError={() => setFailed(src)} />
      ) : (
        <svg viewBox="0 0 24 24" width={size * 0.8} height={size * 0.8} aria-hidden>
          <path d="M12 1.5 21 6.75v10.5L12 22.5 3 17.25V6.75z" fill="rgba(56,152,255,0.08)" stroke="rgba(125,200,255,0.28)" strokeWidth={0.8} />
          <g transform="translate(3 3) scale(0.75)"><Glyph slug={slug} /></g>
        </svg>
      )}
    </div>
  );
}
