"use client";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { SlotKind } from "@/lib/types";
import { gearSkillRolls, gearStats, refClass, refStatDe, type GearSlot } from "@/lib/reference/rolls-v3";
import { numberLocale, slotLabel, useLang, useT } from "@/lib/i18n";
import { hasGerman, statLabel } from "@/lib/stat-names";
import { Pic, skillIcon } from "./ClassSkillSetup";

/** Our gear slots → slot groups of the reference database V3 (belt, rune, amulet, Arcana have no entry). */
const REF_SLOT: Partial<Record<SlotKind, GearSlot>> = {
  weapon: "weapon", offhand: "guard", helmet: "helm", shoulders: "pauldrons", torso: "top", pants: "legs", gloves: "gloves",
  boots: "shoes", cape: "cloak", necklace: "necklace", earring: "earring", ring: "ring", bracelet: "bracelet",
};
export const hasRollChances = (slot: SlotKind) => !!REF_SLOT[slot];

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/**
 * Small "%" next to "Stats / abilities": opens a card on top with the chance of every stat and class ability on this
 * slot (reference database V3: per new random line, before duplicates are excluded; Tyron 2026-11-24).
 * Lines the target (BiS) wants are marked.
 */
export function RollChances({ slot, className, want = [] }: { slot: SlotKind; className?: string; want?: string[] }) {
  const [open, setOpen] = useState(false);
  const t = useT();
  const lang = useLang();
  const ref = REF_SLOT[slot];
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopPropagation(); setOpen(false); } };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [open]);
  if (!ref) return null;
  const cls = refClass(className);
  const stats = gearStats(ref);
  const skills = cls ? gearSkillRolls(cls, ref) : [];
  const wanted = new Set(want.map(norm));
  const pct = (n: number) => `${n.toLocaleString(numberLocale(lang), { maximumFractionDigits: 2 })} %`;
  const statSum = stats.reduce((a, s) => a + s.chance_single_line_pct, 0);
  const skillSum = skills[0]?.probability_skill_category_single_line_pct ?? 0;
  const rows = [...stats].sort((a, b) => b.chance_single_line_pct - a.chance_single_line_pct);

  return (
    <>
      <button type="button" onClick={(e) => { e.stopPropagation(); setOpen(true); }} aria-label={t("Roll-Chancen", "Roll chances")} title={t("Roll-Chancen", "Roll chances")}
        className="ml-1.5 inline-flex h-[1.5em] min-w-[1.5em] items-center justify-center rounded-full border border-[#d9c58f]/40 align-middle text-[#d9c58f] tracking-normal hover:bg-[#d9c58f]/15">%</button>
      {open && createPortal(
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
          <button className="absolute inset-0 bg-black/60 backdrop-blur-[2px]" aria-label={t("Schließen", "Close")} onClick={() => setOpen(false)} />
          <div className="card-face pop-in relative max-h-[85vh] w-full max-w-md overflow-y-auto rounded-2xl p-4 text-left normal-case tracking-normal ring-1 ring-[#d9c58f]/40 sm:p-5">
            <div className="mb-1 flex items-start justify-between gap-3">
              <div>
                <div className="text-lg font-semibold text-[#f4eed7]">{t("Roll-Chancen", "Roll chances")} · {slotLabel(slot, lang)}</div>
                <div className="text-xs text-zinc-500">{t("Chance pro neuer Zeile, bevor doppelte Werte ausgeschlossen werden.", "Chance per new line, before duplicates are excluded.")}</div>
              </div>
              <button onClick={() => setOpen(false)} className="rounded-lg bg-white/5 px-2.5 py-1 text-sm text-zinc-300">✕</button>
            </div>

            <div className="mt-3 flex items-baseline justify-between text-[11px] uppercase tracking-widest text-zinc-500">
              <span>{t("Werte", "Stats")}</span><span>{pct(statSum)}</span>
            </div>
            <ul className="mt-1 divide-y divide-white/5 text-sm">
              {rows.map((s) => {
                // same German names as the rest of the site (Accuracy = "Präzision (Treffer)", apart from Precision)
                const name = lang === "en" ? statLabel(s.stat_en, "en") : hasGerman(s.stat_en) ? statLabel(s.stat_en, "de") : refStatDe(s).de;
                const hit = wanted.has(norm(s.stat_en));
                return <li key={s.stat_en} className={`flex justify-between gap-3 py-1 ${hit ? "text-[#f4eed7]" : "text-[#efe6cc]/80"}`}>
                  <span className="min-w-0 truncate">{hit && <span className="mr-1 text-[#5fbf8a]">●</span>}{name}</span><b className="shrink-0 font-semibold text-[#d9c58f]">{pct(s.chance_single_line_pct)}</b></li>;
              })}
            </ul>

            {skills.length > 0 && <>
              <div className="mt-4 flex items-baseline justify-between text-[11px] uppercase tracking-widest text-zinc-500">
                <span>{skills[0].skill_type === "active" ? t("Fähigkeiten (aktiv) · +1", "Abilities (active) · +1") : t("Passive · +1", "Passives · +1")}</span><span>{pct(skillSum)}</span>
              </div>
              <ul className="mt-1 divide-y divide-white/5 text-sm">
                {skills.map((s) => {
                  const hit = wanted.has(norm(s.skill_en));
                  const icon = cls ? skillIcon(cls, s.skill_en) : undefined;
                  return <li key={s.skill_en} className={`flex items-center gap-2 py-1 ${hit ? "text-[#f4eed7]" : "text-[#efe6cc]/80"}`}>
                    {icon ? <Pic file={icon} alt="" className="h-5 w-5 shrink-0 rounded" /> : <span className="h-5 w-5 shrink-0" />}
                    <span className="min-w-0 flex-1 truncate">{hit && <span className="mr-1 text-[#5fbf8a]">●</span>}{lang === "en" ? s.skill_en : s.skill_de}</span>
                    <b className="shrink-0 font-semibold text-[#d9c58f]">{pct(s.probability_target_skill_single_line_pct)}</b></li>;
                })}
              </ul>
            </>}
            {ref === "bracelet" && <p className="mt-3 text-xs text-zinc-500">{t("Armbänder haben keine Fähigkeiten-Zeilen.", "Bracelets roll no ability lines.")}</p>}
            {want.length > 0 && <p className="mt-3 text-xs text-zinc-500"><span className="text-[#5fbf8a]">●</span> {t("steht auf deinem Ziel (BiS)", "on your target (BiS)")}</p>}
            <p className="mt-1 text-[11px] text-zinc-600">{t("Quelle: Referenz-Datenbank V3 (EU/Global, Stand 24.11.2026).", "Source: reference database V3 (EU/Global, 2026-11-24).")}</p>
          </div>
        </div>, document.body,
      )}
    </>
  );
}
