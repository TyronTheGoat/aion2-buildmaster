"use client";
import { itemName } from "@/lib/item-names";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Character, Item } from "@/lib/types";
import { iconFor } from "@/lib/knowledge/item-catalog";
import { numberLocale, slotLabel, useLang, useT, type Lang } from "@/lib/i18n";
import { GRADE_HEX_CSS } from "@/lib/grades";
import { Card, CardArt, Filler, Portrait, SHOW_ITEM_ICONS } from "./Card";
import { charKey, portraitOf } from "../store";
import { GearCompare } from "../GearCompare";
import { ClassGuideBody, guideForClass } from "../ClassGuides";
import { SkillPlanner } from "../SkillPlanner";
import { OwnBisPicker } from "../OwnBisPicker";
import { OwnBisWizard, pendingPieces } from "../OwnBisWizard";
import { useBuilds } from "../build-store";
import { allPlaced, applyBuild } from "@/lib/own-bis";
import { refClass } from "@/lib/reference/rolls-v3";
import { AbilityLevels } from "../AbilityLevels";
import { currentItems, type PlaceId } from "@/lib/skill-plan";

/** Order of the cards: weapon first, then armour, jewellery, the rest and Arcana last. */
const ORDER: Item["slot"][] = [
  "weapon", "offhand", "helmet", "shoulders", "torso", "gloves", "pants", "boots", "cape",
  "necklace", "earring", "ring", "bracelet", "belt", "amulet", "rune", "arcana", "unknown",
];

export type DeckEntry = { id: string; item: Item; label: string };

export function deckOf(char: Character, lang: Lang = "en"): DeckEntry[] {
  const all = [...char.gear, ...char.arcana];
  const count = new Map<string, number>();
  const seen = new Map<string, number>();
  for (const it of all) count.set(it.slot, (count.get(it.slot) ?? 0) + 1);
  return all
    .map((item) => {
      const n = seen.get(item.slot) ?? 0;
      seen.set(item.slot, n + 1);
      // Arcana cards are named by their kind ("Chalice", "Parchment", …) instead of "Arcana 1–5"
      const label = item.slot === "arcana" && item.name
        ? item.name.split(" ")[0]
        : `${slotLabel(item.slot, lang)}${(count.get(item.slot) ?? 0) > 1 ? ` ${n + 1}` : ""}`;
      return { id: `${item.slot}:${n}`, item, label };
    })
    .sort((a, b) => ORDER.indexOf(a.item.slot) - ORDER.indexOf(b.item.slot) || a.id.localeCompare(b.id));
}

/**
 * Character view: the gear laid out as physical cards (big icon, slot, name, rank glow, no stats yet).
 * Tapping a card opens the Ist / Soll comparison as two cards side by side.
 */
type View = "gear" | "arcana" | "guide" | "planner";
/** Crafting is out for good (Tyron 2026-11-24); the skill planner is live since 2026-11-24. */
const VIEWS: View[] = ["gear", "arcana", "guide", "planner"];

/** Saved builds as target (own BiS), gear wizard, ability levels and Any. */
const SHOW_PREVIEW = true; // saved builds as target, gear wizard, ability levels, Any: live since 2026-11-24 (Tyron)

export function GearDeck({ char: kiskChar, onBack, onRefresh, onRemove, note, refreshing }: {
  char: Character; onBack: () => void; onRefresh: () => void; onRemove: () => void; note?: React.ReactNode; refreshing?: boolean;
}) {
  const t = useT();
  const lang = useLang();
  // own BiS (offline preview): the chosen build replaces kisk's BiS as the target of every piece
  const builds = useBuilds(charKey(kiskChar));
  const cls = refClass(kiskChar.className);
  // every saved build with all abilities placed can be the target (Arcana and gear switch together)
  const targets = useMemo(() => (cls ? builds.builds.filter((b) => allPlaced(cls, b.goals)) : []), [cls, builds.builds]);
  const ownBis = useMemo(() => (SHOW_PREVIEW ? targets.find((b) => b.id === builds.activeId) : undefined), [targets, builds.activeId]);
  const char = useMemo(() => applyBuild(kiskChar, ownBis), [kiskChar, ownBis]);
  const all = useMemo(() => deckOf(char, lang), [char, lang]);
  // three pages on one wheel: equipment cards, Arcana cards, class guide, skill planner (offline)
  const [tab, setTab] = useState<View>("gear");
  // the view that is turning away during the wheel switch
  const [leaving, setLeaving] = useState<View>();
  // keep the taller height while the wheel turns, so the outgoing view is not cut off
  const wheelRef = useRef<HTMLDivElement>(null);
  const [lockH, setLockH] = useState<number>();
  const switchTo = (v: View) => {
    if (leaving || v === tab) return; // no second switch while the wheel turns
    setLockH(wheelRef.current?.offsetHeight);
    setLeaving(tab);
    setTab(v);
  };
  useEffect(() => {
    if (!leaving) return;
    const t = setTimeout(() => { setLeaving(undefined); setLockH(undefined); }, 1650);
    return () => clearTimeout(t);
  }, [leaving, tab]);
  const deckFor = (v: View) => all.filter((d) => (v === "arcana") === (d.item.slot === "arcana"));
  const [open, setOpen] = useState<string>();
  const entry = all.find((d) => d.id === open);
  // first time an own BiS is the target of the gear: set it up piece by piece
  const wizard = ownBis && (tab === "gear" || (entry && entry.item.slot !== "arcana")) && pendingPieces(ownBis, kiskChar).length > 0
    ? <OwnBisWizard key={ownBis.id} build={ownBis} kiskChar={kiskChar} onSave={builds.save} onCancel={() => builds.setActive("")} />
    : null;

  useEffect(() => {
    if (!entry) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(undefined);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [entry]);

  const header = (title: string, back: () => void) => (
    <div className="flex items-center gap-3">
      <button onClick={back} className="shrink-0 rounded-full border border-[#d9c58f]/20 bg-white/[0.03] px-3.5 py-1.5 text-sm text-[#efe6cc]/85 hover:border-[#d9c58f]/40">‹ {t("Zurück", "Back")}</button>
      <h1 className="truncate text-lg font-semibold tracking-tight text-[#f4eed7] sm:text-2xl">{title}</h1>
    </div>
  );

  // 3 / slot comparison: slot list left, Ist card, BiS card
  if (entry) {
    return (
      <div className="space-y-5">
        {wizard}
        {header(`${t("Slot-Vergleich", "Slot comparison")}: ${entry.label}`, () => setOpen(undefined))}
        <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[200px_minmax(0,1fr)]">
          <nav aria-label={t("Slot-Auswahl", "Slot selection")} className="min-w-0 lg:sticky lg:top-20 lg:self-start">
            <div className="mb-2 hidden text-[10px] uppercase tracking-[0.22em] text-zinc-500 lg:block">{t("Slot-Auswahl", "Slot selection")}</div>
            <ul className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 lg:mx-0 lg:max-h-[calc(100vh-9rem)] lg:flex-col lg:overflow-y-auto lg:px-0">
              {all.filter((d) => (d.item.slot === "arcana") === (entry.item.slot === "arcana")).map((d) => {
                const active = d.id === entry.id;
                return (
                  <li key={d.id} className="shrink-0">
                    <button onClick={() => setOpen(d.id)} aria-current={active ? "true" : undefined}
                      className={`flex w-full items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-left text-sm transition ${active ? "bg-white/[0.09] text-[#f4eed7] ring-1 ring-[#d9c58f]/40" : "text-zinc-400 hover:bg-white/[0.05] hover:text-zinc-200"}`}>
                      <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: GRADE_HEX_CSS[d.item.grade] }} />
                      <SlotIcon src={SHOW_ITEM_ICONS ? iconFor(d.item) : undefined} />
                      {d.label}
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>
          <div className="min-w-0 space-y-4">
            {ownBis && (() => {
              const place = (Object.entries(currentItems(char)) as [PlaceId, typeof entry.item][]).find(([, it]) => it === entry.item)?.[0];
              const kiskItem = place && currentItems(kiskChar)[place];
              return place && kiskItem ? <OwnBisPicker key={`${ownBis.id}-${place}`} build={ownBis} place={place} kiskItem={kiskItem} onSave={builds.save} /> : null;
            })()}
            <GearCompare key={`${entry.id}-${ownBis?.id ?? "kisk"}`} char={char} item={entry.item} slotId={entry.id} label={entry.label} />
          </div>
        </div>
      </div>
    );
  }

  // 2 / gear overview: compact character bar, switch, cards
  const arcanaCount = all.filter((d) => d.item.slot === "arcana").length;
  return (
    <div className="space-y-4">
      {wizard}
      <div className="card-face relative flex flex-wrap items-center gap-x-3 gap-y-2 overflow-hidden rounded-2xl px-3 py-2.5">
        <button onClick={onBack} aria-label={t("Zurück zur Charakterauswahl", "Back to character selection")}
          className="relative shrink-0 rounded-full border border-[#d9c58f]/20 bg-white/[0.03] px-3 py-1 text-sm text-[#efe6cc]/85 hover:border-[#d9c58f]/40">‹ {t("Zurück", "Back")}</button>
        <Portrait src={portraitOf(char)} name={char.name} className="relative h-10 w-10 rounded-lg" />
        <div className="relative min-w-0 flex-1">
          <div className="truncate text-base font-semibold leading-tight text-[#f4eed7]">{char.name}</div>
          <div className="truncate text-[11px] text-[#beac80]/80">
            {[char.className, char.race, `${char.server} · ${char.region.toUpperCase()}`,
              char.combatPower && `CP ${char.combatPower.toLocaleString(numberLocale(lang))}`, char.gearGrade && `${t("Gear-Rang", "Gear rank")} ${char.gearGrade}`].filter(Boolean).join(" · ")}
          </div>
        </div>
        <div className="relative flex shrink-0 gap-1.5 text-xs">
          <button onClick={onRefresh} disabled={refreshing} aria-busy={refreshing}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#d9c58f]/20 bg-white/[0.04] px-2.5 py-1.5 text-[#efe6cc] hover:border-[#d9c58f]/45 disabled:cursor-wait">
            {refreshing && <span aria-hidden className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-[#d9c58f]/30 border-t-[#d9c58f]" />}
            {refreshing ? t("Lädt…", "Loading…") : t("Aktualisieren", "Refresh")}
          </button>
          <button onClick={onBack} className="rounded-lg border border-[#d9c58f]/20 bg-white/[0.04] px-2.5 py-1.5 text-[#efe6cc] hover:border-[#d9c58f]/45">{t("Charakter wechseln", "Switch character")}</button>
          <button onClick={onRemove} className="rounded-lg px-2 py-1.5 text-zinc-500 hover:text-zinc-300">{t("Entfernen", "Remove")}</button>
        </div>
      </div>
      {note}

      {/* one switch: Ausrüstung | Arcana | Klassenguide (| Skill-Planer offline); all views ride an invisible flat ring in depth that always turns the same way */}
      <div role="tablist" aria-label={t("Ansicht", "View")} onKeyDown={(e) => {
        const i = VIEWS.indexOf(tab);
        if (e.key === "ArrowRight") switchTo(VIEWS[(i + 1) % VIEWS.length]);
        if (e.key === "ArrowLeft") switchTo(VIEWS[(i + VIEWS.length - 1) % VIEWS.length]);
      }}
        className={`relative grid ${VIEWS.length === 4 ? "grid-cols-4" : "grid-cols-3"} rounded-xl border border-[#d9c58f]/25 bg-white/[0.03] p-1 text-sm shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_3px_0_-0.5px_#06070a] hover:border-[#d9c58f]/45`}>
        <span aria-hidden className={`absolute inset-y-1 left-1 ${VIEWS.length === 4 ? "w-[calc((100%-0.5rem)/4)]" : "w-[calc((100%-0.5rem)/3)]"} rounded-lg bg-white/[0.09] ring-1 ring-[#d9c58f]/40 transition-transform duration-500 ease-out motion-reduce:transition-none`}
          style={{ transform: `translateX(${VIEWS.indexOf(tab) * 100}%)` }} />
        {([["gear", t("Ausrüstung", "Equipment"), all.length - arcanaCount], ["arcana", "Arcana", arcanaCount], ["guide", t("Klassenguide", "Class guide"), null], ["planner", t("Skill-Planer", "Skill planner"), null]] as const).filter(([k]) => VIEWS.includes(k)).map(([k, l, n]) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k} tabIndex={tab === k ? 0 : -1} onClick={() => switchTo(k)}
            className={`relative px-2 py-1.5 text-center transition-colors sm:px-4 ${tab === k ? "text-[#f4eed7]" : "text-zinc-500 hover:text-zinc-300"}`}>
            {l} {n !== null && <span className="text-xs text-zinc-500">{n}</span>}
          </button>
        ))}
      </div>

      {SHOW_PREVIEW && (tab === "gear" || tab === "arcana") && (
        <div className="flex flex-wrap items-center justify-end gap-2 text-sm">
          {cls && <AbilityLevels cls={cls} char={kiskChar} build={ownBis} />}
          <span className="text-[11px] uppercase tracking-widest text-zinc-500">{t("Ziel", "Target")}</span>
          <select value={ownBis?.id ?? ""} onChange={(e) => builds.setActive(e.target.value)} aria-label={t("Ziel-BiS", "Target BiS")}
            className="rounded-lg border border-[#d9c58f]/30 bg-[#0d1119] px-2 py-1.5 text-sm text-[#f4eed7] outline-none">
            <option value="">kisk-BiS</option>
            {targets.map((b) => <option key={b.id} value={b.id}>★ {b.name}</option>)}
          </select>
          {!targets.length && <span className="text-xs text-zinc-500">{t("Build mit allen Abilities im Skill-Planer speichern", "Save a build with every ability in the skill planner")}</span>}
        </div>
      )}

      <div ref={wheelRef} className="wheel relative" style={{ minHeight: leaving ? lockH : undefined }}>
        {leaving && page(leaving, "pointer-events-none absolute inset-x-0 top-0 wheel-out-ccw", true)}
        {page(tab, leaving ? "wheel-in-ccw" : "")}
      </div>
    </div>
  );

  // one page of the wheel (a plain function, not a component)
  function page(view: View, className: string, out = false) {
    const key = `${out ? "out" : "in"}-${view}`;
    if (view === "guide") {
      const g = guideForClass(char.className);
      return <div key={key} className={className} inert={out} aria-hidden={out || undefined}>
        {g ? <div className="card-face relative rounded-[24px] p-4 sm:p-7"><span aria-hidden className="pointer-events-none absolute inset-[6px] rounded-[18px] border border-[#d9c58f]/20" /><div className="relative"><ClassGuideBody g={g} /></div></div>
          : <p className="text-sm text-zinc-400">{t("Für diese Klasse gibt es noch keinen Guide.", "No guide for this class yet.")}</p>}
      </div>;
    }
    if (view === "planner") return <div key={key} className={className} inert={out} aria-hidden={out || undefined}>
      <div className="card-face relative rounded-[24px] p-4 sm:p-7"><span aria-hidden className="pointer-events-none absolute inset-[6px] rounded-[18px] border border-[#d9c58f]/20" /><div className="relative"><SkillPlanner char={kiskChar} preview={SHOW_PREVIEW} /></div></div>
    </div>;
    return <Tiles key={key} deck={deckFor(view)} onOpen={setOpen} className={className} />;
  }
}

/** The card grid of one view (equipment or Arcana). The gap keeps the rank lights of neighbours apart. */
function Tiles({ deck, onOpen, className = "" }: { deck: DeckEntry[]; onOpen: (id: string) => void; className?: string }) {
  const rankWord = useT()("Rang", "Rank");
  return (
    <ul className={`grid grid-cols-1 gap-x-5 gap-y-8 sm:grid-cols-2 sm:gap-x-6 sm:gap-y-10 lg:grid-cols-4 ${className}`}>
      {deck.map((d) => (
        <li key={d.id}>
          <Card as="button" grade={d.item.grade} onClick={() => onOpen(d.id)} label={`${d.label}: ${itemName(d.item.name)}`}
            className="flex h-full w-full items-center gap-3 p-3">
            <div className="relative w-16 shrink-0">
              {SHOW_ITEM_ICONS ? <CardArt src={iconFor(d.item)} alt={d.item.name} grade={d.item.grade} /> : <Filler className="aspect-square w-full" />}
            </div>
            <div className="relative min-w-0">
              <div className="truncate text-sm font-semibold text-[#f4eed7]">{d.label}</div>
              <div className="text-xs text-zinc-400">{rankWord}: <span className="font-semibold" style={{ color: GRADE_HEX_CSS[d.item.grade] }}>{d.item.grade === "?" ? "–" : d.item.grade}</span></div>
              <div className="truncate text-[11px] text-zinc-500">{itemName(d.item.name)}</div>
            </div>
          </Card>
        </li>
      ))}
    </ul>
  );
}

/** Small icon of the equipped item in the slot list; an empty frame when there is none. */
function SlotIcon({ src }: { src?: string }) {
  return (
    <span aria-hidden className="relative h-6 w-6 shrink-0 overflow-hidden rounded-md bg-[radial-gradient(circle_at_50%_40%,#1f3a66_0%,#111a2b_60%,#0a0d14_100%)] ring-1 ring-white/10">
      {src && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" loading="lazy" referrerPolicy="no-referrer" className="h-full w-full object-contain p-[2px]"
          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
      )}
    </span>
  );
}
