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

/** Small tile like on wakayashi: icon with order number, goal level, name, chosen specialties as tiny icons. */
function SkillTile({ s, cls, active, onPick }: { s: Skill; cls: ClassSkills; active: boolean; onPick: () => void }) {
  const order = s.specialtyOrder ?? [];
  return (
    <li className="min-w-0">
      <button onClick={onPick} aria-expanded={active}
        className={`card-face relative flex h-full w-full flex-col items-center gap-1 rounded-xl px-1.5 pb-2 pt-2.5 text-center transition hover:-translate-y-0.5 ${active ? "ring-2 ring-[#d9c58f]/80" : "ring-1 ring-[#d9c58f]/20"}`}
        style={s.featured ? { boxShadow: "0 0 18px -6px #d9c58f88" } : undefined}>
        <span className="relative">
          <Pic file={s.icon} alt={s.name} className="h-12 w-12 rounded-lg ring-1 ring-[#d9c58f]/35" />
          {s.rank != null && s.kind !== "passive" && <span className="absolute -left-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-[#d9c58f] text-[11px] font-bold text-[#14110a]">{s.rank}</span>}
          {s.targetLevel != null && <span className="absolute -bottom-1.5 -right-2 rounded-md bg-[#0b0e14] px-1 text-[11px] font-bold leading-4 text-[#f4eed7] ring-1 ring-[#d9c58f]/50">{s.targetLevel}</span>}
        </span>
        <span lang="de" className="mt-1 line-clamp-2 hyphens-auto break-words text-[11px] leading-tight text-[#efe6cc]/90">{s.name}</span>
        {order.length > 0 && <span className="flex gap-0.5">{order.map((n) => <Pic key={n} file={cls.specialtyIcons[String(n)]} alt="" className="h-4 w-4" />)}</span>}
      </button>
    </li>
  );
}

/** Details of the picked skill: description, all specialties with the order, the reason. */
function SkillDetail({ s, cls, onClose }: { s: Skill; cls: ClassSkills; onClose: () => void }) {
  const t = useT();
  const order = s.specialtyOrder ?? [];
  return (
    <div className="card-face relative space-y-3 rounded-2xl p-4 text-sm ring-1 ring-[#d9c58f]/40 [overflow-wrap:anywhere]">
      <button onClick={onClose} aria-label={t("Schließen", "Close")} className="absolute right-3 top-3 h-7 w-7 rounded-full border border-[#d9c58f]/25 text-[#efe6cc] hover:border-[#d9c58f]/60">×</button>
      <div className="flex items-center gap-3 pr-8">
        <Pic file={s.icon} alt={s.name} className="h-12 w-12 shrink-0 rounded-lg ring-1 ring-[#d9c58f]/35" />
        <div className="min-w-0">
          <div className="text-base font-semibold text-[#f4eed7]">{s.name} <span className="text-xs font-normal text-zinc-500">{s.nameEn}</span></div>
          <div className="text-xs text-zinc-400">{[s.targetLevel != null && `${t("Ziel Lv", "Goal Lv")} ${s.targetLevel}`, s.rank != null && s.kind !== "passive" && `${t("Priorität", "Priority")} ${s.rank}`, s.unlockLevel != null && `${t("ab Lv", "from Lv")} ${s.unlockLevel}`, s.cooldown && `${s.cooldown} CD`].filter(Boolean).join(" · ")}</div>
        </div>
      </div>
      {s.description && <p className="leading-relaxed text-zinc-300"><Rich text={s.description} /></p>}
      {!!s.specialties?.length && (
        <ul className="grid gap-1 sm:grid-cols-2">
          {s.specialties.map((x) => {
            const n = order.indexOf(x.slot);
            return (
              <li key={x.slot} className={`flex items-center gap-2 rounded-lg px-2 py-1 text-xs ${n >= 0 ? "bg-[#d9c58f]/10 text-[#f4eed7] ring-1 ring-[#d9c58f]/35" : "text-zinc-500"}`}>
                <Pic file={cls.specialtyIcons[String(x.slot)]} alt="" className={`h-5 w-5 shrink-0 ${n >= 0 ? "" : "opacity-40 grayscale"}`} />
                <span className="w-9 shrink-0">{t("ab", "from")} {x.level}</span>
                <span className="min-w-0 flex-1"><Rich text={x.text} /></span>
                {n >= 0 && <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[#d9c58f] text-[10px] font-bold text-[#14110a]">{n + 1}</span>}
              </li>
            );
          })}
        </ul>
      )}
      {s.note && <p className="rounded-lg bg-white/[0.03] px-3 py-2 text-[#efe6cc]/85"><span className="text-[#d9c58f]">{t("Warum", "Why")}: </span>{s.note}</p>}
    </div>
  );
}

/** One group of tiles; a tap shows the details right under the group. */
function SkillGroup({ title, hint, skills, cls }: { title: string; hint?: string; skills: Skill[]; cls: ClassSkills }) {
  const [pick, setPick] = useState<string>();
  const sel = skills.find((s) => s.name === pick);
  return (
    <section className="space-y-2">
      <div className="text-base font-semibold text-[#efe6cc]">{title}{hint && <span className="ml-2 text-xs font-normal text-zinc-500">{hint}</span>}</div>
      <ul className="grid grid-cols-3 gap-2 min-[420px]:grid-cols-4 sm:grid-cols-6 lg:grid-cols-8">
        {skills.map((s) => <SkillTile key={s.name} s={s} cls={cls} active={pick === s.name} onPick={() => setPick(pick === s.name ? undefined : s.name)} />)}
      </ul>
      {sel && <SkillDetail s={sel} cls={cls} onClose={() => setPick(undefined)} />}
    </section>
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
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-2xl font-semibold text-[#f4eed7]">{t("Skill-Setup", "Skill setup")}</h3>
        <p className="text-sm text-zinc-400">{t("Zahl unten rechts = Ziel-Stufe · Zahl im Kreis = Reihenfolge · kleine Symbole = gewählte Spezialitäten. Skill antippen für Details.", "Number bottom right = goal level · number in the circle = order · small symbols = chosen specialties. Tap a skill for details.")}</p>
      </div>
      <SkillGroup title={t("Mastery", "Mastery")} hint={t("nach Ziel-Stufe sortiert", "sorted by goal level")} skills={mastery} cls={cls} />
      <SkillGroup title={t("Stigma", "Stigma")} hint={t("Nummer = Reihenfolge", "number = order")} skills={stigma} cls={cls} />
      {cls.stigmaSwaps.length > 0 && (
        <div className="space-y-2 rounded-2xl bg-white/[0.03] p-3 ring-1 ring-white/10">
          <div className={H}>{t("Stigma-Alternativen", "Stigma alternatives")}</div>
          {cls.stigmaSwaps.map((x) => (
            <div key={x.name} className="flex items-start gap-3 text-sm">
              <Pic file={x.icon} alt={x.name} className="h-9 w-9 shrink-0 rounded-lg ring-1 ring-[#d9c58f]/30" />
              <div><b className="text-[#f4eed7]">{x.name}</b>{x.note && <span className="text-zinc-300">: {x.note}</span>}</div>
            </div>
          ))}
        </div>
      )}
      <SkillGroup title={t("Passiv", "Passive")} skills={passive} cls={cls} />
    </div>
  );
}
