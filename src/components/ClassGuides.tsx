"use client";
import { useEffect, useState } from "react";
import { useT } from "@/lib/i18n";
import { CLASS_GUIDES, CLASS_GUIDE_SOURCE, type ClassGuide } from "@/lib/class-guides";
import { ClassIcon } from "./ClassIcon";

const DIFF_COLOR: Record<ClassGuide["difficulty"], string> = { leicht: "#5fbf8a", mittel: "#e6b450", schwer: "#ff6b6b" };

/** Class guides: one card per class in the style of the character cards; a tap opens the big card. */
export function ClassGuides({ onBack }: { onBack: () => void }) {
  const t = useT();
  const [open, setOpen] = useState<ClassGuide>();
  return (
    <div className="space-y-6">
      <div className="bm-backdrop pointer-events-none fixed inset-0 -z-10" aria-hidden />
      <div className="pt-4">
        <button onClick={onBack} className="text-sm text-zinc-400 hover:text-white">‹ {t("Charaktere", "Characters")}</button>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[#f4eed7]">{t("Klassenguides", "Class guides")}</h1>
        <p className="mt-1 text-sm text-[#efe6cc]/50">{t("Klasse antippen: Beschreibung, Hauptskills, Stärken und Schwächen", "Tap a class: description, main skills, strengths and weaknesses")}</p>
      </div>
      <ul className="grid grid-cols-2 gap-3 sm:gap-5 md:gap-6 lg:grid-cols-4">
        {CLASS_GUIDES.map((g) => (
          <li key={g.cls}>
            <button onClick={() => setOpen(g)}
              className="card-face group relative flex h-full w-full flex-col items-center gap-3 overflow-hidden rounded-[20px] p-3 text-center sm:p-5 shadow-[0_0_0_1px_#d9c58f30,0_18px_40px_-18px_#000] transition hover:-translate-y-0.5 active:scale-[0.99]">
              <span aria-hidden className="pointer-events-none absolute inset-[5px] rounded-[15px] border border-[#d9c58f]/20" />
              <ClassIcon className={g.cls} size={88} />
              <div className="relative">
                <div className="text-lg font-semibold text-[#f4eed7] sm:text-xl">{g.name}</div>
                <div className="text-sm text-[#beac80]/80">{[g.role, g.weapon].filter(Boolean).join(" · ")}</div>
                <div className="mt-1 text-xs text-zinc-400">{g.tagline}</div>
              </div>
            </button>
          </li>
        ))}
      </ul>
      <p className="text-xs text-zinc-500">{t("Inhalte zusammengefasst nach dem Klassen-Guide von", "Summarised from the class guide by")} <a href={CLASS_GUIDE_SOURCE} target="_blank" rel="noreferrer" className="underline hover:text-zinc-300">wakayashi.gg</a>.</p>
      {open && <GuideCard g={open} onClose={() => setOpen(undefined)} />}
    </div>
  );
}

function GuideCard({ g, onClose }: { g: ClassGuide; onClose: () => void }) {
  const t = useT();
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  const H = "mb-2 text-[11px] uppercase tracking-[0.2em] text-zinc-500";
  return (
    <div role="dialog" aria-modal aria-label={g.name} onClick={onClose}
      className="fixed inset-0 z-30 flex items-start justify-center overflow-y-auto bg-black/70 p-3 backdrop-blur-sm sm:items-center sm:p-6">
      <div onClick={(e) => e.stopPropagation()}
        className="card-face relative my-4 w-full max-w-3xl rounded-[24px] p-5 shadow-[0_0_0_1px_#d9c58f50,0_0_40px_-8px_#d9c58f40,0_30px_60px_-20px_#000] sm:p-7">
        <span aria-hidden className="pointer-events-none absolute inset-[6px] rounded-[18px] border border-[#d9c58f]/20" />
        <button onClick={onClose} aria-label={t("Schließen", "Close")} className="absolute right-4 top-4 z-10 h-9 w-9 rounded-full border border-[#d9c58f]/25 text-lg text-[#efe6cc] hover:border-[#d9c58f]/60">×</button>
        <div className="relative space-y-6">
          <div className="flex flex-wrap items-center gap-5 pr-10">
            <ClassIcon className={g.cls} size={112} />
            <div className="min-w-0">
              <h2 className="text-3xl font-semibold text-[#f4eed7]">{g.name}</h2>
              <div className="mt-1 flex flex-wrap gap-2 text-sm">
                <span className="rounded-full bg-white/[0.06] px-2.5 py-0.5 text-[#efe6cc]">{g.role}</span>
                {g.weapon && <span className="rounded-full bg-white/[0.06] px-2.5 py-0.5 text-[#efe6cc]">{g.weapon}</span>}
                <span className="rounded-full px-2.5 py-0.5" style={{ background: `${DIFF_COLOR[g.difficulty]}22`, color: DIFF_COLOR[g.difficulty] }}>{t("Schwierigkeit", "Difficulty")}: {g.difficulty}</span>
              </div>
            </div>
          </div>
          <section>
            <div className={H}>{t("Die Klasse", "The class")}</div>
            <p className="text-base leading-relaxed text-[#efe6cc]/90">{g.description}</p>
          </section>
          <section>
            <div className={H}>{t("Hauptskills", "Main skills")}</div>
            <ul className="grid gap-2 sm:grid-cols-2">
              {g.skills.map((s) => (
                <li key={s.name} className="rounded-xl bg-white/[0.04] px-3 py-2 ring-1 ring-white/5">
                  <div className="font-semibold text-[#f4eed7]">{s.name}</div>
                  <div className="text-sm text-zinc-400">{s.why}</div>
                </li>
              ))}
            </ul>
          </section>
          <div className="grid gap-4 sm:grid-cols-2">
            <section className="rounded-xl bg-[#5fbf8a]/[0.06] p-4 ring-1 ring-[#5fbf8a]/25">
              <div className={`${H} !text-[#5fbf8a]`}>{t("Stärken", "Strengths")}</div>
              <ul className="space-y-1.5 text-sm text-[#efe6cc]/90">{g.strengths.map((x) => <li key={x} className="flex gap-2"><span className="text-[#5fbf8a]">+</span>{x}</li>)}</ul>
            </section>
            <section className="rounded-xl bg-[#ff6b6b]/[0.06] p-4 ring-1 ring-[#ff6b6b]/25">
              <div className={`${H} !text-[#ff8b8b]`}>{t("Schwächen", "Weaknesses")}</div>
              <ul className="space-y-1.5 text-sm text-[#efe6cc]/90">{g.weaknesses.map((x) => <li key={x} className="flex gap-2"><span className="text-[#ff8b8b]">−</span>{x}</li>)}</ul>
            </section>
          </div>
          <p className="text-xs text-zinc-500">{t("Quelle", "Source")}: <a href={CLASS_GUIDE_SOURCE} target="_blank" rel="noreferrer" className="underline hover:text-zinc-300">wakayashi.gg</a>{t(", in eigenen Worten zusammengefasst.", ", summarised in our own words.")}</p>
        </div>
      </div>
    </div>
  );
}
