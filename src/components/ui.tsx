"use client";
import { useEffect, useState } from "react";
import type { Grade } from "@/lib/types";

const GRADE_RING: Record<Grade, string> = {
  BiS: "ring-amber-400", "S+": "ring-fuchsia-500", S: "ring-violet-500", A: "ring-sky-500",
  B: "ring-emerald-500", C: "ring-zinc-500", D: "ring-red-600", "?": "ring-zinc-700",
};

/** Game icon from kisk/NC CDN with a text fallback when offline or missing. */
export function ItemIcon({ src, name, grade = "?", enhance, size = 48, tall = false }: {
  src?: string; name: string; grade?: Grade; enhance?: number; size?: number; tall?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const w = size, h = tall ? Math.round(size * 1.4) : size;
  return (
    <div className={`relative shrink-0 overflow-hidden rounded-lg bg-gradient-to-br from-zinc-700 to-zinc-900 ring-2 ${GRADE_RING[grade]}`} style={{ width: w, height: h }}>
      {src && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={name} width={w} height={h} loading="lazy" referrerPolicy="no-referrer"
          className="h-full w-full object-cover" onError={() => setFailed(true)} />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-zinc-500" title={`${name}: kein Originalbild vorhanden`}>
          <GearGlyph size={Math.round(Math.min(w, h) * 0.55)} />
        </div>
      )}
      {enhance !== undefined && (
        <span className="absolute bottom-0 right-0 rounded-tl-md bg-black/80 px-1 text-[10px] font-bold leading-4 text-amber-300">+{enhance}</span>
      )}
    </div>
  );
}

/** Small round badge for a skill / ability (kisk has no skill icons, so we use a colored monogram). */
export function SkillIcon({ name, size = 22 }: { name: string; size?: number }) {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) % 360;
  const label = name.replace(/^(Summon|Jointstrike):\s*/i, "").split(/[\s']+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  return (
    <span className="inline-flex shrink-0 items-center justify-center rounded-full text-[9px] font-bold text-white"
      style={{ width: size, height: size, background: `hsl(${h} 55% 38%)` }} title={name}>
      {label}
    </span>
  );
}

export function isSkillLine(value: string) {
  return /^\+\d+$/.test(value.trim());
}

export function Sheet({ open, onClose, children, title }: { open: boolean; onClose: () => void; children: React.ReactNode; title?: React.ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true">
      <button className="absolute inset-0 bg-black/70" aria-label="Schließen" onClick={onClose} />
      <div className="relative max-h-[88vh] w-full overflow-y-auto rounded-t-2xl border border-white/10 bg-[#13131c] p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:max-w-lg sm:rounded-2xl">
        <div className="mx-auto mb-3 h-1 w-10 rounded bg-white/20 sm:hidden" />
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">{title}</div>
          <button onClick={onClose} className="rounded-lg bg-white/5 px-3 py-1 text-sm text-zinc-300">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

/** Neutral equipment symbol shown when no original item icon is available (never a fake item picture). */
export function GearGlyph({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z" opacity="0.9" />
      <path d="M12 7v10M8.5 10.5h7" opacity="0.6" />
    </svg>
  );
}
