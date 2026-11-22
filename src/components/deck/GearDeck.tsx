"use client";
import { useEffect, useMemo, useState } from "react";
import type { Character, Item } from "@/lib/types";
import { iconFor } from "@/lib/knowledge/item-catalog";
import { SLOT_LABEL_DE } from "@/lib/knowledge/slots";
import { GRADE_HEX_CSS } from "@/lib/grades";
import { Card, CardArt } from "./Card";
import { GearCompare } from "../GearCompare";
import { ClassIcon } from "../ClassIcon";

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
      const label = item.slot === "arcana" ? "Arcana" : `${SLOT_LABEL_DE[item.slot]}${(count.get(item.slot) ?? 0) > 1 ? ` ${n + 1}` : ""}`;
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

  if (entry) {
    return <GearCompare char={char} item={entry.item} slotId={entry.id} label={entry.label} onClose={() => setOpen(undefined)} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2 whitespace-nowrap">
        <button onClick={onBack} className="rounded-full border border-[#d9c58f]/20 bg-white/[0.03] px-3.5 py-1.5 text-sm text-[#efe6cc]/85 hover:border-[#d9c58f]/40">‹ Charaktere</button>
        <div className="flex gap-1.5 text-xs">
          <button onClick={onDetails} className="rounded-full bg-white/[0.04] px-2.5 py-1.5 text-zinc-300 hover:bg-white/[0.08]">Upgrade-Pfad</button>
          <button onClick={onRefresh} className="rounded-full bg-white/[0.04] px-2.5 py-1.5 text-zinc-300 hover:bg-white/[0.08]">Aktualisieren</button>
          <button onClick={onRemove} className="rounded-full bg-white/[0.04] px-2.5 py-1.5 text-zinc-500 hover:bg-white/[0.08]">Entfernen</button>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <ClassIcon className={char.className} grade={char.gearGrade} size={60} />
        <div className="min-w-0">
          <h1 className="truncate text-3xl font-semibold tracking-tight text-[#f4eed7]">{char.name}</h1>
          <div className="truncate text-sm text-[#beac80]/80">
            {[char.className, char.race, `${char.server} · ${char.region.toUpperCase()}`].filter(Boolean).join(" · ")}
          </div>
        </div>
      </div>
      {note}

      <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
        {deck.map((d) => (
          <li key={d.id}>
            <Card as="button" grade={d.item.grade} onClick={() => setOpen(d.id)} label={`${d.label}: ${d.item.name}`}
              className="flex h-full w-full flex-col p-3 pb-3.5">
              <CardArt src={iconFor(d.item)} alt={d.item.name} grade={d.item.grade} />
              <div className="mt-3 text-[10px] font-semibold uppercase tracking-[0.22em]" style={{ color: GRADE_HEX_CSS[d.item.grade] }}>{d.label}</div>
              <div className="mt-0.5 line-clamp-2 min-h-[2.5em] text-[13px] font-medium leading-tight text-[#f4eed7]">{d.item.name}</div>
            </Card>
          </li>
        ))}
      </ul>
    </div>
  );
}
