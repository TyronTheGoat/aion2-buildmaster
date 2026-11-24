"use client";
import { useState } from "react";
import { useLang, useT } from "@/lib/i18n";
import data from "../../data/class-skills.json";

/** Skills per class (and wakayashi's recommendations, not shown for now), taken from the class guide of wakayashi.gg (2026-11-23); pictures in the icon pack / offline file. */
interface Specialty { slot: number; level: number; text: string; textEn?: string | null }
interface Skill {
  name: string; nameEn: string; kind: "mastery" | "stigma" | "passive"; targetLevel: number | null; rank: number | null;
  unlockLevel: number | null; cooldown: string | null; tags: string[] | null; description: string | null; descriptionEn?: string | null; note: string | null;
  specialtyOrder: number[] | null; specialties: Specialty[] | null; featured: boolean | null; icon: string;
}
interface ClassSkills { nameEn: string; name: string; specialtyIcons: Record<string, string>; skills: Skill[]; stigmaSwaps: { name: string; icon: string; note: string | null }[] }

const ALL = data as ClassSkills[];
/** wakayashi names the Spiritmaster "Elementalist". */
const EN: Record<string, string> = { spiritmaster: "Elementalist", gladiator: "Gladiator", templar: "Templar", assassin: "Assassin", ranger: "Ranger", sorcerer: "Sorcerer", cleric: "Cleric", chanter: "Chanter" };
export const skillsFor = (slug?: string) => (slug ? ALL.find((c) => c.nameEn === EN[slug]) : undefined);
/** Icon file of a skill by its English name (class of the reference database, e.g. "Spiritmaster"). */
export const skillIcon = (refCls: string, skillEn: string) => skillsFor(refCls.toLowerCase())?.skills.find((s) => s.nameEn === skillEn)?.icon;

/** Picture from the icon pack (online) or embedded in the offline file. */
function pic(file: string) {
  return globalThis.__BM_ICONS__?.[file] ?? (typeof location !== "undefined" && /^https?:$/.test(location.protocol) ? `/api/icon/${file}` : undefined);
}

export function Pic({ file, alt, className }: { file: string; alt: string; className: string }) {
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

/** Small tile: icon and name; a tap shows the details. No recommendations (Tyron adds his own later). */
function SkillTile({ s, active, onPick }: { s: Skill; active: boolean; onPick: () => void }) {
  const lang = useLang();
  return (
    <li className="min-w-0">
      <button onClick={onPick} aria-expanded={active}
        className={`card-face relative flex h-full w-full flex-col items-center gap-1 rounded-xl px-1.5 pb-2 pt-2.5 text-center transition hover:-translate-y-0.5 ${active ? "ring-2 ring-[#d9c58f]/80" : "ring-1 ring-[#d9c58f]/20"}`}>
        <Pic file={s.icon} alt={s.name} className="h-12 w-12 rounded-lg ring-1 ring-[#d9c58f]/35" />
        <span lang={lang} className="mt-1 line-clamp-2 hyphens-auto break-words text-[11px] leading-tight text-[#efe6cc]/90">{lang === "en" ? s.nameEn : s.name}</span>
      </button>
    </li>
  );
}

/** Details of the picked skill: what it does, and its specialties (a tap on one shows its text). */
function SkillDetail({ s, cls, onClose }: { s: Skill; cls: ClassSkills; onClose: () => void }) {
  const t = useT();
  const lang = useLang();
  const en = lang === "en";
  const [spec, setSpec] = useState<number>();
  const open = s.specialties?.find((x) => x.slot === spec);
  return (
    <div className="card-face relative space-y-3 rounded-2xl p-4 text-sm ring-1 ring-[#d9c58f]/40 [overflow-wrap:anywhere]">
      <button onClick={onClose} aria-label={t("Schließen", "Close")} className="absolute right-3 top-3 h-7 w-7 rounded-full border border-[#d9c58f]/25 text-[#efe6cc] hover:border-[#d9c58f]/60">×</button>
      <div className="flex items-center gap-3 pr-8">
        <Pic file={s.icon} alt={s.name} className="h-12 w-12 shrink-0 rounded-lg ring-1 ring-[#d9c58f]/35" />
        <div className="min-w-0">
          <div className="text-base font-semibold text-[#f4eed7]">{en ? s.nameEn : s.name} <span className="text-xs font-normal text-zinc-500">{en ? s.name : s.nameEn}</span></div>
          <div className="text-xs text-zinc-400">{[s.unlockLevel != null && `${t("ab Charakter-Lv", "from character Lv")} ${s.unlockLevel}`, s.cooldown && `${s.cooldown} ${t("Abklingzeit", "cooldown")}`, s.tags?.join(" · ")].filter(Boolean).join(" · ")}</div>
        </div>
      </div>
      {(en ? s.descriptionEn ?? s.description : s.description) && <p className="leading-relaxed text-zinc-300"><Rich text={(en ? s.descriptionEn ?? s.description : s.description)!} /></p>}
      {!!s.specialties?.length && (
        <div className="space-y-2">
          <div className={H}>{t("Spezialitäten", "Specialties")} <span className="normal-case tracking-normal text-zinc-600">· {t("antippen für den Text", "tap for the text")}</span></div>
          <div className="flex flex-wrap gap-2">
            {s.specialties.map((x) => (
              <button key={x.slot} onClick={() => setSpec(spec === x.slot ? undefined : x.slot)} aria-expanded={spec === x.slot}
                className={`flex items-center gap-1.5 ring-1 ${s.kind === "stigma" ? "rounded-full p-1" : "rounded-lg px-2 py-1 text-xs"} ${spec === x.slot ? "bg-[#d9c58f]/15 text-[#f4eed7] ring-[#d9c58f]/60" : "bg-white/[0.03] text-zinc-300 ring-white/10 hover:ring-[#d9c58f]/40"}`}>
                {s.kind === "stigma"
                  ? <span className="flex h-7 min-w-7 items-center justify-center rounded-full bg-gradient-to-b from-[#f4e3a8] to-[#b8964f] px-1.5 text-sm font-bold text-[#14110a] shadow-[0_0_10px_-2px_#d9c58f]">{x.level}</span>
                  : <><Pic file={cls.specialtyIcons[String(x.slot)]} alt="" className="h-6 w-6" /><span>{t("Skill-Stufe", "Skill level")} {x.level}</span></>}
              </button>
            ))}
          </div>
          {open && <p className="rounded-lg bg-white/[0.04] px-3 py-2 text-[#efe6cc]/90 ring-1 ring-[#d9c58f]/25"><span className="text-[#d9c58f]">{t("Ab Skill-Stufe", "From skill level")} {open.level}: </span><Rich text={en ? open.textEn ?? open.text : open.text} /></p>}
        </div>
      )}
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
        {skills.map((s) => <SkillTile key={s.name} s={s} active={pick === s.name} onPick={() => setPick(pick === s.name ? undefined : s.name)} />)}
      </ul>
      {sel && <SkillDetail key={sel.name} s={sel} cls={cls} onClose={() => setPick(undefined)} />}
    </section>
  );
}

/** Overview of all skills of a class: mastery, stigma, passive, sorted by the character level they unlock at. */
export function ClassSkillSetup({ slug }: { slug?: string }) {
  const t = useT();
  const cls = skillsFor(slug);
  if (!cls) return null;
  const byUnlock = (k: Skill["kind"]) => cls.skills.filter((s) => s.kind === k).sort((a, b) => (a.unlockLevel ?? 99) - (b.unlockLevel ?? 99));
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-2xl font-semibold text-[#f4eed7]">{t("Skill-Übersicht", "Skill overview")}</h3>
        <p className="text-sm text-zinc-400">{t("Was deine Klasse kann. Skill antippen für Beschreibung und Spezialitäten.", "What your class can do. Tap a skill for its description and specialties.")}</p>
      </div>
      <SkillGroup title={t("Mastery", "Mastery")} skills={byUnlock("mastery")} cls={cls} />
      <SkillGroup title={t("Stigma", "Stigma")} hint={t("Spezialitäten ab Skill-Stufe 5, 10, 15 und 20", "specialties from skill level 5, 10, 15 and 20")} skills={byUnlock("stigma")} cls={cls} />
      <SkillGroup title={t("Passiv", "Passive")} skills={byUnlock("passive")} cls={cls} />
    </div>
  );
}

/* ------------------------------------------------------------------ Ist / Soll ------------------------------------------------------------------ */
// Not shown for now (Tyron 2026-11-23): skill levels come from several sources (10 levelling / story, 4 Daevanion
// boards, 6 rings or Arcana cards); he will send a more exact input first. Kept here to build on.

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
const plus = (v: string) => { const n = Number(String(v).replace(/[^\d-]/g, "")); return Number.isFinite(n) ? n : 0; };
/** Short German card name: "Chalice of Vigor" → "Kelch (Vigor)". */
const CARD_DE: Record<string, string> = { chalice: "Kelch", parchment: "Pergament", compass: "Kompass", bell: "Glocke", mirror: "Spiegel" };
const cardName = (n: string) => { const m = n.match(/^(\w+)\s+of\s+(.+)$/i); return m ? `${CARD_DE[m[1].toLowerCase()] ?? m[1]} (${m[2]})` : n; };

interface ArcanaCard { name: string; lines: { name: string; value: string }[]; ideal?: { name: string; value: string }[] }

/**
 * Ist / Soll per skill: the player types the level (as shown in game with Arcana, or the base level without), the
 * Arcana bonus comes from the kisk data of the cards; the result says how many points are missing or too many and on
 * which card to plus less or more so the skill lands exactly on its goal level.
 */
export function SkillCompare({ slug, arcana, levels, mode, setLevel, setMode }: {
  slug?: string; arcana: ArcanaCard[]; levels: Record<string, number>; mode: "total" | "base";
  setLevel: (skill: string, level: number | null) => void; setMode: (m: "total" | "base") => void;
}) {
  const t = useT();
  const cls = skillsFor(slug);
  if (!cls) return null;
  const bonusOf = (s: Skill) => arcana.flatMap((c) => c.lines.filter((l) => norm(l.name) === norm(s.nameEn)).map((l) => ({ card: cardName(c.name), n: plus(l.value) })));
  const idealOf = (s: Skill) => arcana.flatMap((c) => (c.ideal ?? []).filter((l) => norm(l.name) === norm(s.nameEn)).map((l) => ({ card: cardName(c.name), n: plus(l.value) })));
  const rows = cls.skills
    .map((s) => ({ s, bonus: bonusOf(s), ideal: idealOf(s) }))
    .filter((r) => r.s.targetLevel != null || r.bonus.length || r.ideal.length)
    .sort((a, b) => (b.s.targetLevel ?? -1) - (a.s.targetLevel ?? -1) || (a.s.rank ?? 99) - (b.s.rank ?? 99));
  const sum = (x: { n: number }[]) => x.reduce((a, b) => a + b.n, 0);
  const results = rows.map(({ s, bonus }) => {
    const input = levels[s.nameEn];
    const arc = sum(bonus);
    const total = input == null ? null : mode === "total" ? input : input + arc;
    const diff = total == null || s.targetLevel == null ? null : s.targetLevel - total;
    return { s, bonus, arc, input, total, diff };
  });
  const over = results.filter((r) => r.diff != null && r.diff < 0 && r.arc > 0);
  const under = results.filter((r) => r.diff != null && r.diff > 0);
  const entered = results.filter((r) => r.input != null).length;
  return (
    <section className="space-y-4">
      <div>
        <h3 className="text-2xl font-semibold text-[#f4eed7]">{t("Dein Ist-Soll-Vergleich", "Your current vs. goal")}</h3>
        <p className="text-sm text-zinc-400">{t("Trag deine aktuellen Skill-Stufen ein. Der Arcana-Bonus kommt aus deinen Karten (kisk). Ich zeige dir, wo Punkte fehlen oder zu viel sind und auf welcher Karte du weniger oder mehr plussen solltest.", "Enter your current skill levels. The Arcana bonus comes from your cards (kisk). I show where points are missing or too many and on which card to plus less or more.")}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-zinc-400">{t("Ich trage ein:", "I enter:")}</span>
        {([["total", t("Stufe im Spiel (mit Arcana)", "Level in game (with Arcana)")], ["base", t("Grundstufe (ohne Arcana)", "Base level (without Arcana)")]] as const).map(([k, l]) => (
          <button key={k} onClick={() => setMode(k)} className={`rounded-full px-3 py-1 ring-1 ${mode === k ? "bg-[#d9c58f]/15 text-[#f4eed7] ring-[#d9c58f]/60" : "text-zinc-400 ring-white/10 hover:ring-[#d9c58f]/30"}`}>{l}</button>
        ))}
      </div>

      {entered > 0 && (over.length > 0 || under.length > 0) && (
        <div className="grid gap-3 md:grid-cols-2">
          {over.length > 0 && <div className="rounded-2xl bg-[#e6b450]/[0.07] p-4 ring-1 ring-[#e6b450]/30">
            <div className="mb-2 text-sm font-semibold text-[#e6b450]">{t("Weniger plussen", "Plus less")}</div>
            <ul className="space-y-1 text-sm text-[#efe6cc]/90">{over.map((r) => <li key={r.s.name}><b>{r.s.name}</b>: {-r.diff!} {t("zu viel", "too many")} · {t("auf", "on")} {r.bonus.filter((b) => b.n > 0).map((b) => `${b.card} +${b.n}`).join(", ")}</li>)}</ul>
          </div>}
          {under.length > 0 && <div className="rounded-2xl bg-[#5fbf8a]/[0.07] p-4 ring-1 ring-[#5fbf8a]/30">
            <div className="mb-2 text-sm font-semibold text-[#5fbf8a]">{t("Mehr plussen oder leveln", "Plus more or level up")}</div>
            <ul className="space-y-1 text-sm text-[#efe6cc]/90">{under.map((r) => <li key={r.s.name}><b>{r.s.name}</b>: +{r.diff} {t("bis Ziel", "to goal")} {r.s.targetLevel}{r.bonus.length ? ` · ${t("Karte mit dem Skill", "card with the skill")}: ${r.bonus.map((b) => b.card).join(", ")}` : ` · ${t("keine deiner Karten hat diesen Skill", "none of your cards has this skill")}`}</li>)}</ul>
          </div>}
        </div>
      )}
      {entered > 0 && !over.length && !under.length && <p className="rounded-xl bg-[#5fbf8a]/[0.07] px-4 py-2 text-sm text-[#5fbf8a] ring-1 ring-[#5fbf8a]/30">{t("Alle eingetragenen Skills liegen genau auf ihrer Ziel-Stufe.", "All entered skills are exactly on their goal level.")}</p>}

      <ul className="grid grid-cols-1 gap-2 lg:grid-cols-2">
        {results.map((r) => {
          const tone = r.diff == null ? "ring-white/10" : r.diff === 0 ? "ring-[#5fbf8a]/50" : r.diff > 0 ? "ring-[#ff6b6b]/45" : "ring-[#e6b450]/50";
          return (
            <li key={r.s.name} className={`card-face flex min-w-0 items-center gap-2 rounded-xl px-2 py-2 ring-1 sm:gap-3 sm:px-3 ${tone}`}>
              <Pic file={r.s.icon} alt={r.s.name} className="h-10 w-10 shrink-0 rounded-lg ring-1 ring-[#d9c58f]/30" />
              <div className="min-w-0 flex-1">
                <div lang="de" className="line-clamp-2 hyphens-auto break-words text-sm font-semibold leading-tight text-[#f4eed7]">{r.s.name}</div>
                <div className="truncate text-xs text-zinc-400">
                  {t("Arcana", "Arcana")}: {r.bonus.length ? r.bonus.map((b) => `${b.card} +${b.n}`).join(", ") : "–"}
                </div>
              </div>
              <label className="shrink-0 text-center">
                <span className="block text-[9px] uppercase tracking-widest text-zinc-500">{t("Ist", "Now")}</span>
                <input inputMode="numeric" value={r.input ?? ""} placeholder="?" aria-label={`${r.s.name}: ${t("aktuelle Stufe", "current level")}`}
                  onChange={(e) => { const v = e.target.value.replace(/\D/g, ""); setLevel(r.s.nameEn, v === "" ? null : Math.min(99, Number(v))); }}
                  className="w-12 rounded-lg border border-[#d9c58f]/25 bg-white/[0.04] px-1 py-1 text-center text-base text-[#f4eed7] outline-none focus:border-[#d9c58f]/60" />
              </label>
              <div className="w-9 shrink-0 text-center sm:w-12">
                <span className="block text-[9px] uppercase tracking-widest text-zinc-500">{t("Soll", "Goal")}</span>
                <span className="text-lg font-bold text-[#f4eed7]">{r.s.targetLevel ?? "–"}</span>
              </div>
              <div className="w-10 shrink-0 text-right text-sm font-semibold sm:w-16">
                {r.diff == null ? <span className="text-zinc-600">{mode === "base" && r.total != null ? `= ${r.total}` : ""}</span>
                  : r.diff === 0 ? <span className="text-[#5fbf8a]">✓</span>
                    : r.diff > 0 ? <span className="text-[#ff8b8b]">+{r.diff}</span>
                      : <span className="text-[#e6b450]">{r.diff}</span>}
                {r.total != null && mode === "base" && r.diff != null && <span className="block text-[10px] font-normal text-zinc-500">{t("gesamt", "total")} {r.total}</span>}
              </div>
            </li>
          );
        })}
      </ul>
      <p className="text-xs text-zinc-500">{t("Rot = fehlt noch, Gelb = zu viel (Arcana-Punkte woanders besser), Grün = passt. Skill-Stufen liefert kisk nicht, deshalb hier von Hand. Gespeichert pro Charakter und Login.", "Red = still missing, yellow = too many (Arcana points better elsewhere), green = fits. kisk does not deliver skill levels, so enter them here. Saved per character and login.")}</p>
    </section>
  );
}
