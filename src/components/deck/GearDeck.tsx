"use client";
import { useEffect, useMemo, useState } from "react";
import type { Character, Item } from "@/lib/types";
import { iconFor } from "@/lib/knowledge/item-catalog";
import { SLOT_LABEL_DE } from "@/lib/knowledge/slots";
import { GRADE_HEX_CSS } from "@/lib/grades";
import { Card, CardArt, Filler, SHOW_ITEM_ICONS } from "./Card";
import { GearCompare } from "../GearCompare";

/** Order of the cards: weapon first, then armour, jewellery, the rest and Arcana last. */
const ORDER: Item["slot"][] = [
  "weapon", "offhand", "helmet", "shoulders", "torso", "gloves", "pants", "boots", "cape",
  "necklace", "earring", "ring", "bracelet", "belt", "amulet", "rune", "arcana", "unknown",
];

export type DeckEntry = { id: string; item: Item; label: string };

export function deckOf(char: Character): DeckEntry[] {
  const all = [...char.gear, ...char.arcana];
  const count = new Map<string, number>();
  const seen = new Map<string, number>();
  for (const it of all) count.set(it.slot, (count.get(it.slot) ?? 0) + 1);
  return all
    .map((item) => {
      const n = seen.get(item.slot) ?? 0;
      seen.set(item.slot, n + 1);
      const label = `${SLOT_LABEL_DE[item.slot]}${(count.get(item.slot) ?? 0) > 1 ? ` ${n + 1}` : ""}`;
      return { id: `${item.slot}:${n}`, item, label };
    })
    .sort((a, b) => ORDER.indexOf(a.item.slot) - ORDER.indexOf(b.item.slot) || a.id.localeCompare(b.id));
}

/**
 * Character view: the gear laid out as physical cards (big icon, slot, name, rank glow, no stats yet).
 * Tapping a card opens the Ist / Soll comparison as two cards side by side.
 */
export function GearDeck({ char, onBack, onRefresh, onRemove, onDetails, note }: {
  char: Character; onBack: () => void; onRefresh: () => void; onRemove: () => void; onDetails: () => void; note?: React.ReactNode;
}) {
  const deck = useMemo(() => deckOf(char), [char]);
  const [open, setOpen] = useState<string>();
  const entry = deck.find((d) => d.id === open);

  useEffect(() => {
    if (!entry) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(undefined);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [entry]);

  const header = (title: string, back: () => void) => (
    <div className="flex items-center gap-3">
      <button onClick={back} className="shrink-0 rounded-full border border-[#d9c58f]/20 bg-white/[0.03] px-3.5 py-1.5 text-sm text-[#efe6cc]/85 hover:border-[#d9c58f]/40">‹ Zurück</button>
      <h1 className="truncate text-lg font-semibold tracking-tight text-[#f4eed7] sm:text-2xl">{title}</h1>
    </div>
  );

  // 3 / slot comparison: slot list left, Ist card, BiS card
  if (entry) {
    return (
      <div className="space-y-5">
        {header(`Slot-Vergleich: ${entry.label}`, () => setOpen(undefined))}
        <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[200px_minmax(0,1fr)]">
          <nav aria-label="Slot-Auswahl" className="min-w-0 lg:sticky lg:top-20 lg:self-start">
            <div className="mb-2 hidden text-[10px] uppercase tracking-[0.22em] text-zinc-500 lg:block">Slot-Auswahl</div>
            <ul className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 lg:mx-0 lg:max-h-[calc(100vh-9rem)] lg:flex-col lg:overflow-y-auto lg:px-0">
              {deck.map((d) => {
                const active = d.id === entry.id;
                return (
                  <li key={d.id} className="shrink-0">
                    <button onClick={() => setOpen(d.id)} aria-current={active ? "true" : undefined}
                      className={`flex w-full items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-left text-sm transition ${active ? "bg-white/[0.09] text-[#f4eed7] ring-1 ring-[#d9c58f]/40" : "text-zinc-400 hover:bg-white/[0.05] hover:text-zinc-200"}`}>
                      <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: GRADE_HEX_CSS[d.item.grade] }} />
                      {d.label}
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>
          <GearCompare key={entry.id} char={char} item={entry.item} slotId={entry.id} label={entry.label} />
        </div>
      </div>
    );
  }

  // 2 / gear overview
  return (
    <div className="space-y-5">
      {header("Ausrüstungsübersicht", onBack)}

      <div className="card-face relative flex flex-col gap-4 overflow-hidden rounded-[20px] p-4 sm:flex-row sm:items-center">
        <span aria-hidden className="pointer-events-none absolute inset-[5px] rounded-[15px] border border-[#d9c58f]/20" />
        <div className="relative flex min-w-0 flex-1 items-center gap-4">
          <Filler className="h-16 w-16" />
          <div className="min-w-0">
            <div className="truncate text-2xl font-semibold tracking-tight text-[#f4eed7]">{char.name}</div>
            <div className="truncate text-sm text-[#beac80]/80">
              {[char.className, char.race, `${char.server} · ${char.region.toUpperCase()}`].filter(Boolean).join(" · ")}
            </div>
            <div className="text-xs text-[#99e4e2]/60">
              {[char.combatPower && `CP ${char.combatPower.toLocaleString("de-DE")}`, char.gearGrade && `Gear-Rang ${char.gearGrade}`].filter(Boolean).join(" · ")}
            </div>
          </div>
        </div>
        <div className="relative flex flex-wrap gap-2 text-sm">
          <button onClick={onRefresh} className="rounded-xl border border-[#d9c58f]/25 bg-white/[0.04] px-4 py-2 text-[#efe6cc] hover:border-[#d9c58f]/50">Aktualisieren</button>
          <button onClick={onBack} className="rounded-xl border border-[#d9c58f]/25 bg-white/[0.04] px-4 py-2 text-[#efe6cc] hover:border-[#d9c58f]/50">Charakter wechseln</button>
          <button onClick={onDetails} className="rounded-xl px-3 py-2 text-xs text-zinc-400 hover:text-zinc-200">Upgrade-Pfad</button>
          <button onClick={onRemove} className="rounded-xl px-3 py-2 text-xs text-zinc-500 hover:text-zinc-300">Entfernen</button>
        </div>
      </div>
      {note}

      <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-500">Gear-Slots</div>
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {deck.map((d) => (
          <li key={d.id}>
            <Card as="button" grade={d.item.grade} onClick={() => setOpen(d.id)} label={`${d.label}: ${d.item.name}`}
              className="flex h-full w-full items-center gap-3 p-3">
              <div className="relative w-16 shrink-0">
                {SHOW_ITEM_ICONS ? <CardArt src={iconFor(d.item)} alt={d.item.name} grade={d.item.grade} /> : <Filler className="aspect-square w-full" />}
              </div>
              <div className="relative min-w-0">
                <div className="truncate text-sm font-semibold text-[#f4eed7]">{d.label}</div>
                <div className="text-xs text-zinc-400">Rang: <span className="font-semibold" style={{ color: GRADE_HEX_CSS[d.item.grade] }}>{d.item.grade === "?" ? "–" : d.item.grade}</span></div>
                <div className="truncate text-[11px] text-zinc-500">{d.item.name}</div>
              </div>
            </Card>
          </li>
        ))}
      </ul>
    </div>
  );
}
