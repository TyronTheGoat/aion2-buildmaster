"use client";
import { useMemo, useState } from "react";
import { PUBLIC_ITEMS, REGION_LABEL, regionCounts } from "@/lib/region";
import { CLASSES, fitsClass } from "@/lib/slot-map";
import { ItemIcon } from "./ui";

const uniq = (xs: string[]) => [...new Set(xs.filter(Boolean))].sort((a, b) => a.localeCompare(b, "de"));
// filter options come only from the released EU / Global selection
const SOURCES = uniq(PUBLIC_ITEMS.map((i) => i.source.replace(/ \(Stufe \d+\)$/, "")));
const CATEGORIES = uniq(PUBLIC_ITEMS.map((i) => i.category));
const SLOTS = uniq(PUBLIC_ITEMS.map((i) => i.slot));
const RARITIES = uniq(PUBLIC_ITEMS.map((i) => i.rarity));
const LEVELS = [...new Set(PUBLIC_ITEMS.map((i) => i.level).filter((l): l is number => l != null))].sort((a, b) => b - a).map(String);

function Chips({ value, options, onChange }: { value: string; options: readonly string[]; onChange: (v: string) => void }) {
  if (options.length < 2) return null;
  return (
    <div className="flex gap-1.5 overflow-x-auto pb-1">
      {["Alle", ...options].map((o) => (
        <button key={o} onClick={() => onChange(o)}
          className={`shrink-0 rounded-full px-3 py-1 text-xs ${value === o ? "bg-amber-400 text-black" : "bg-white/5 text-zinc-300"}`}>{o}</button>
      ))}
    </div>
  );
}

/** Item catalog: only items confirmed for EU / Global. Taiwan-only and unclear items stay internal. */
export function ItemCatalog({ onBack }: { onBack: () => void }) {
  const [source, setSource] = useState("Alle");
  const [cat, setCat] = useState("Alle");
  const [slot, setSlot] = useState("Alle");
  const [rarity, setRarity] = useState("Alle");
  const [level, setLevel] = useState("Alle");
  const [cls, setCls] = useState("Alle");
  const [q, setQ] = useState("");

  const items = useMemo(() => PUBLIC_ITEMS.filter((i) =>
    (source === "Alle" || i.source.startsWith(source)) &&
    (cat === "Alle" || i.category === cat) &&
    (slot === "Alle" || i.slot === slot) &&
    (rarity === "Alle" || i.rarity === rarity) &&
    (level === "Alle" || String(i.level) === level) &&
    (cls === "Alle" || fitsClass(i.slot, cls)) &&
    (!q || i.name.toLowerCase().includes(q.toLowerCase()))), [source, cat, slot, rarity, level, cls, q]);
  const withIcon = items.filter((i) => i.icon).length;
  const hidden = regionCounts();

  return (
    <div className="space-y-4">
      <button onClick={onBack} className="text-sm text-zinc-400 hover:text-white">‹ Charaktere</button>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Item-Katalog</h1>
        <p className="text-sm text-zinc-400">{items.length} Items · {withIcon} mit Originalbild · {REGION_LABEL.eu}</p>
        <p className="text-[11px] text-zinc-500">Intern ausgeblendet: {hidden.tw} nur Taiwan · {hidden.unclear} {REGION_LABEL.unclear}</p>
      </div>
      <div className="space-y-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Item suchen…"
          className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-base outline-none focus:border-amber-400" />
        <Chips value={cat} options={CATEGORIES} onChange={setCat} />
        <Chips value={slot} options={SLOTS} onChange={setSlot} />
        <Chips value={cls} options={CLASSES} onChange={setCls} />
        <Chips value={source} options={SOURCES} onChange={setSource} />
        <Chips value={rarity} options={RARITIES} onChange={setRarity} />
        <Chips value={level} options={LEVELS} onChange={setLevel} />
      </div>
      <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {items.map((i) => (
          <li key={i.key} className="flex items-center gap-3 rounded-xl border border-white/10 bg-zinc-900/75 p-2.5">
            <ItemIcon src={i.icon || undefined} name={i.name} size={44} />
            <div className="min-w-0">
              <div className="truncate text-sm font-medium">{i.name}</div>
              <div className="truncate text-[11px] text-zinc-500">
                {[i.source, i.category, i.slot, i.level && `Lv ${i.level}`, i.rarity, i.faction !== "Beide" && i.faction].filter(Boolean).join(" · ")}
              </div>
              {i.itemId && <div className="text-[10px] text-zinc-600">ID {i.itemId}</div>}
            </div>
          </li>
        ))}
      </ul>
      {items.length === 0 && <p className="text-sm text-zinc-400">Keine bestätigten EU / Global Items für diese Filter.</p>}
    </div>
  );
}
