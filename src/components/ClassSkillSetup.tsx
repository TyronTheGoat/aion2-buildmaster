"use client";
import { useState } from "react";
import { useT } from "@/lib/i18n";
import data from "../../data/class-skills.json";

/** Skill setup per class, taken from the class guide of wakayashi.gg (2026-11-23); pictures in the icon pack / offline file. */
interface Specialty { slot: number; level: number; text: string }
interface Skill {
  name: string; nameEn: string; kind: "mastery" | "stigma" | "passive"; targetLevel: number | null; rank: number | null;
  unlockLevel: number | null; cooldown: string | null; tags: string[] | null; description: string | null; note: string | null;
  specialtyOrder: number[] | null; specialties: Specialty[] | null; featured: boolean | null; icon: string;
}
interface ClassSkills { nameEn: string; name: string; specialtyIcons: Record<string, string>; skills: Skill[]; stigmaSwaps: { name: string; icon: string; note: string | null }[] }

const ALL = data as ClassSkills[];
/** wakayashi names the Spiritmaster "Elementalist". */
const EN: Record<string, string> = { spiritmaster: "Elementalist", gladiator: "Gladiator", templar: "Templar", assassin: "Assassin", ranger: "Ranger", sorcerer: "Sorcerer", cleric: "Cleric", chanter: "Chanter" };
export const skillsFor = (slug?: string) => (slug ? ALL.find((c) => c.nameEn === EN[slug]) : undefined);

/** Picture from the icon pack (online) or embedded in the offline file. */
function pic(file: string) {
  return globalThis.__BM_ICONS__?.[file] ?? (typeof location !== "undefined" && /^https?:$/.test(location.protocol) ? `/api/icon/${file}` : undefined);
}

function Pic({ file, alt, className }: { file: string; alt: string; className: string }) {
  const src = pic(file);
  const [bad, setBad] = useState(false);
  if (!src || bad) return <span className={`${className} block rounded-lg bg-white/[0.06]`} aria-hidden />;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} loading="lazy" onError={() => setBad(true)} className={className} />;
}

/** "[Name]" in the game texts as a highlighted name. */
function Rich({ text }: { text: string }) {
  return <>{text.split(/(\[[^\]]+\])/).map((p, i) => (p.startsWith("[") ? <b key={i} className="font-semibold text-[#efe6cc]">{p.slice(1, -1)}</b> : p))}</>;
}

const H = "mb-1 text-[11px] uppercase tracking-[0.2em] text-zinc-500";

function SkillCard({ s, cls }: { s: Skill; cls: ClassSkills }) {
  const t = useT();
  const order = s.specialtyOrder ?? [];
  return (
    <li className="card-face relative flex min-w-0 flex-col gap-3 rounded-2xl p-3 [overflow-wrap:anywhere] sm:p-4 shadow-[0_0_0_1px_#d9c58f30,0_14px_30px_-16px_#000]"
      style={s.featured ? { boxShadow: "0 0 0 1px #d9c58f80, 0 0 24px -6px #d9c58f66, 0 14px 30px -16px #000" } : undefined}>
      <span aria-hidden className="pointer-events-none absolute inset-[4px] rounded-[12px] border border-[#d9c58f]/15" />
      <div className="relative flex items-start gap-3">
        <div className="relative shrink-0">
          <Pic file={s.icon} alt={s.name} className="h-14 w-14 rounded-xl ring-1 ring-[#d9c58f]/35" />
          {s.rank != null && s.kind !== "passive" && <span className="absolute -left-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-[#d9c58f] text-xs font-bold text-[#14110a]" title={t("Reihenfolge", "Order")}>{s.rank}</span>}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-base font-semibold leading-tight text-[#f4eed7]">{s.name}</div>
          <div className="text-xs text-zinc-500">{s.nameEn}</div>
          <div className="mt-1 text-xs text-zinc-400">{[s.unlockLevel != null && `${t("ab Lv", "from Lv")} ${s.unlockLevel}`, s.cooldown && `${s.cooldown} CD`, s.tags?.join(" · ")].filter(Boolean).join(" · ")}</div>
        </div>
        {s.targetLevel != null && (
          <div className="shrink-0 rounded-xl bg-white/[0.06] px-2.5 py-1 text-center ring-1 ring-[#d9c58f]/30">
            <div className="text-[9px] uppercase tracking-widest text-zinc-500">{t("Ziel", "Goal")}</div>
            <div className="text-lg font-bold leading-none text-[#f4eed7]">{s.targetLevel}</div>
          </div>
        )}
      </div>
      {s.description && <p className="relative text-sm leading-relaxed text-zinc-300"><Rich text={s.description} /></p>}
      {!!s.specialties?.length && (
        <div className="relative">
          <div className={H}>{t("Spezialitäten", "Specialties")}{order.length > 0 && <span className="normal-case tracking-normal text-zinc-600"> · {t("Nummer = Reihenfolge", "number = order")}</span>}</div>
          <ul className="space-y-1">
            {s.specialties.map((x) => {
              const n = order.indexOf(x.slot);
              const on = n >= 0;
              return (
                <li key={x.slot} className={`flex items-center gap-2 rounded-lg px-2 py-1 text-sm ${on ? "bg-[#d9c58f]/10 text-[#f4eed7] ring-1 ring-[#d9c58f]/35" : "text-zinc-500"}`}>
                  <Pic file={cls.specialtyIcons[String(x.slot)]} alt="" className={`h-6 w-6 shrink-0 ${on ? "" : "opacity-40 grayscale"}`} />
                  <span className="w-12 shrink-0 text-xs">{t("ab", "from")} {x.level}</span>
                  <span className="min-w-0 flex-1"><Rich text={x.text} /></span>
                  {on && <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#d9c58f] text-[11px] font-bold text-[#14110a]">{n + 1}</span>}
                </li>
              );
            })}
          </ul>
        </div>
      )}
      {s.note && <p className="relative rounded-lg bg-white/[0.03] px-3 py-2 text-sm text-[#efe6cc]/85"><span className="text-[#d9c58f]">{t("Warum", "Why")}: </span>{s.note}</p>}
    </li>
  );
}

/** The whole skill setup of a class: mastery skills by goal level, the four stigmas in order, the passives. */
export function ClassSkillSetup({ slug }: { slug?: string }) {
  const t = useT();
  const cls = skillsFor(slug);
  if (!cls) return null;
  const mastery = cls.skills.filter((s) => s.kind === "mastery").sort((a, b) => (b.targetLevel ?? 0) - (a.targetLevel ?? 0) || (a.rank ?? 99) - (b.rank ?? 99));
  const stigma = cls.skills.filter((s) => s.kind === "stigma").sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99));
  const passive = cls.skills.filter((s) => s.kind === "passive").sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99));
  const grid = "grid grid-cols-1 gap-4 md:grid-cols-2";
  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-2xl font-semibold text-[#f4eed7]">{t("Skill-Setup", "Skill setup")}</h3>
        <p className="text-sm text-zinc-400">{t("Zahl rechts = Ziel-Stufe des Skills · Zahl im Kreis = Reihenfolge", "Number on the right = goal level · number in the circle = order")}</p>
      </div>
      <section className="space-y-3">
        <div className="text-lg font-semibold text-[#efe6cc]">{t("Mastery", "Mastery")} <span className="text-sm font-normal text-zinc-500">{t("nach Ziel-Stufe sortiert", "sorted by goal level")}</span></div>
        <ul className={grid}>{mastery.map((s) => <SkillCard key={s.name} s={s} cls={cls} />)}</ul>
      </section>
      <section className="space-y-3">
        <div className="text-lg font-semibold text-[#efe6cc]">{t("Stigma", "Stigma")} <span className="text-sm font-normal text-zinc-500">{t("Nummer = Reihenfolge", "number = order")}</span></div>
        <ul className={grid}>{stigma.map((s) => <SkillCard key={s.name} s={s} cls={cls} />)}</ul>
        {cls.stigmaSwaps.length > 0 && (
          <div className="space-y-2 rounded-2xl bg-white/[0.03] p-4 ring-1 ring-white/10">
            <div className={H}>{t("Alternativen", "Alternatives")}</div>
            {cls.stigmaSwaps.map((x) => (
              <div key={x.name} className="flex items-start gap-3 text-sm">
                <Pic file={x.icon} alt={x.name} className="h-10 w-10 shrink-0 rounded-lg ring-1 ring-[#d9c58f]/30" />
                <div><b className="text-[#f4eed7]">{x.name}</b>{x.note && <span className="text-zinc-300">: {x.note}</span>}</div>
              </div>
            ))}
          </div>
        )}
      </section>
      <section className="space-y-3">
        <div className="text-lg font-semibold text-[#efe6cc]">{t("Passiv", "Passive")}</div>
        <ul className={grid}>{passive.map((s) => <SkillCard key={s.name} s={s} cls={cls} />)}</ul>
      </section>
    </div>
  );
}
