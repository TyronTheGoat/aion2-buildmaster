"use client";
/**
 * "Ability-Level" button beside the target (Tyron 2026-11-24, offline preview): a popup with every ability of the class,
 * its level now (kisk gear + Arcana) and with the chosen target (own build or kisk's BiS), side by side.
 */
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { Character } from "@/lib/types";
import type { Goal } from "@/lib/skill-plan";
import { refSkills } from "@/lib/reference/rolls-v3";
import { abilityLevels, type OwnBuild } from "@/lib/own-bis";
import { useLang, useT } from "@/lib/i18n";
import { Pic, skillIcon } from "./ClassSkillSetup";
import { charKey } from "./store";

const plannerGoals = (char: Character): Goal[] => {
  try { return JSON.parse(localStorage.getItem("bm:skillplan") ?? "{}")[charKey(char)]?.goals ?? []; } catch { return []; }
};

export function AbilityLevels({ cls, char, build }: { cls: string; char: Character; build?: OwnBuild }) {
  const t = useT();
  const lang = useLang();
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<ReturnType<typeof abilityLevels>>([]);
  const names = refSkills(cls);
  const name = (en: string) => (lang === "en" ? en : names.find((s) => s.skill_en === en)?.skill_de ?? en);
  const show = () => { setRows(abilityLevels(cls, char, build, plannerGoals(char))); setOpen(true); };
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopPropagation(); setOpen(false); } };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open]);
  const targetName = build ? `★ ${build.name}` : "kisk-BiS";

  const group = (active: boolean) => {
    const list = rows.filter((r) => r.active === active).sort((a, b) => b.target - a.target || b.now - a.now);
    if (!list.length) return null;
    return (
      <div className="space-y-1">
        <div className="text-[10px] uppercase tracking-widest text-zinc-500">{active ? t("Aktiv", "Active") : t("Passiv", "Passive")}</div>
        {list.map((r) => {
          const d = r.target - r.now;
          const f = skillIcon(cls, r.skill);
          return (
            <div key={r.skill} className="grid grid-cols-[2rem_minmax(0,1fr)_2.75rem_2.75rem_2.5rem] items-center gap-2 rounded-lg bg-white/[0.03] px-2 py-1.5 ring-1 ring-white/5">
              {f ? <Pic file={f} alt="" className="h-8 w-8 rounded-md ring-1 ring-[#d9c58f]/30" /> : <span className="h-8 w-8 rounded-md bg-white/[0.06]" />}
              <span className="truncate text-sm text-[#f4eed7]">{name(r.skill)}</span>
              <span className="text-center text-sm tabular-nums text-zinc-300">{r.now}</span>
              <span className="text-center text-sm font-semibold tabular-nums text-[#f4eed7]">{r.target}</span>
              <span className={`text-right text-xs tabular-nums ${d > 0 ? "text-[#5fbf8a]" : d < 0 ? "text-[#ff8b8b]" : "text-zinc-600"}`}>{d > 0 ? `+${d}` : d < 0 ? d : "="}</span>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <>
      <button type="button" onClick={show}
        className="rounded-lg border border-[#d9c58f]/30 px-2.5 py-1.5 text-sm text-[#f4eed7] hover:bg-[#d9c58f]/10">
        {t("Ability-Level", "Ability levels")}
      </button>
      {open && createPortal(
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={t("Ability-Level", "Ability levels")}>
          <button className="absolute inset-0 bg-black/60 backdrop-blur-[2px]" aria-label={t("Schließen", "Close")} onClick={() => setOpen(false)} />
          <div className="card-face pop-in relative max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl p-4 ring-1 ring-[#d9c58f]/40 sm:p-5">
            <div className="mb-3 flex items-start gap-3">
              <div className="min-w-0">
                <h4 className="text-lg font-semibold text-[#f4eed7]">{t("Ability-Level", "Ability levels")}</h4>
                <p className="text-xs text-zinc-500">{t("Story + Daevanion aus dem Skill-Planer (ohne Eintrag 10 + 4), dazu die Zeilen auf Ausrüstung und Arcana.", "Story + Daevanion from the skill planner (10 + 4 without an entry), plus the lines on equipment and Arcana.")}</p>
              </div>
              <button className="ml-auto rounded-md px-2 text-xl leading-none text-zinc-500 hover:text-[#f4eed7]" aria-label={t("Schließen", "Close")} onClick={() => setOpen(false)}>×</button>
            </div>
            <div className="sticky -top-5 z-10 mb-1 grid grid-cols-[2rem_minmax(0,1fr)_2.75rem_2.75rem_2.5rem] gap-2 bg-[#0d1119]/95 px-2 py-1 text-[10px] uppercase tracking-widest text-zinc-500">
              <span /><span>Ability</span><span className="text-center">{t("Jetzt", "Now")}</span>
              <span className="truncate text-center" title={targetName}>{t("Ziel", "Target")}</span><span />
            </div>
            <div className="mb-2 text-right text-[11px] text-zinc-500">{t("Ziel", "Target")}: {targetName}</div>
            <div className="space-y-3">{group(true)}{group(false)}</div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
