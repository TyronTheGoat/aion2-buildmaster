"use client";
import { hexCss, LEGEND_GRADES } from "@/lib/hologram";

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
