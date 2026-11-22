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
    case "gladiator": return <g {...p}><path d="M6 18 18 6M15 5h4v4M8 14l2 2M5 19l2-2" /></g>;
    case "templar": return <g {...p}><path d="M12 3 5 6v5c0 5 3 8 7 10 4-2 7-5 7-10V6z" /><path d="M12 8v8M9 11h6" /></g>;
    case "assassin": return <g {...p}><path d="M7 17 16 8l2-2-1 3-9 9M6 18l-1 1M9 14l1 1" /></g>;
    case "ranger": return <g {...p}><path d="M7 4c6 2 9 6 9 8s-3 6-9 8M7 4v16M5 12h13M15 10l3 2-3 2" /></g>;
    case "sorcerer": return <g {...p}><path d="M5 6c3-1 5-1 7 1 2-2 4-2 7-1v12c-3-1-5-1-7 1-2-2-4-2-7-1z" /><path d="M12 7v12" /></g>;
    case "spiritmaster": return <g {...p}><circle cx="12" cy="12" r="4" /><ellipse cx="12" cy="12" rx="8.5" ry="3.5" transform="rotate(-25 12 12)" /></g>;
    case "cleric": return <g {...p}><path d="M7 19 15 11M14 6l4 4M13 7l4 4M15 5l4 4-2 2-4-4z" /></g>;
    case "chanter": return <g {...p}><path d="M8 20 15 5M14 4l3 1-1 3M6 9l3 1M15 15l3 1" /></g>;
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
        <svg viewBox="0 0 24 24" width={size * 0.6} height={size * 0.6} aria-hidden><Glyph slug={slug} /></svg>
      )}
    </div>
  );
}
