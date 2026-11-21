"use client";
import { useMemo, useState } from "react";
import { ITEM_CATALOG } from "@/lib/knowledge/item-catalog";

const SOURCES = ["Feuertempel", "Grimmhornhöhle", "Ludra", "Crafted Gear"] as const;
const CATEGORIES = ["Waffen", "Rüstung", "Schmuck"] as const;
const FACTIONS = ["Elyos", "Asmodier"] as const;

function Chips<T extends string>({ value, options, onChange }: { value: T | "Alle"; options: readonly T[]; onChange: (v: T | "Alle") => void }) {
  return (
    <div className="flex gap-1.5 overflow-x-auto pb-1">
      {(["Alle", ...options] as (T | "Alle")[]).map((o) => (
        <button key={o} onClick={() => onChange(o)}
          className={`shrink-0 rounded-full px-3 py-1 text-xs ${value === o ? "bg-amber-400 text-black" : "bg-white/5 text-zinc-300"}`}>{o}</button>
      ))}
    </div>
  );
}

/** Browse the gear catalog by dungeon, type and faction; shows which original icons are available. */
export function ItemCatalog({ onBack }: { onBack: () => void }) {
  const [source, setSource] = useState<(typeof SOURCES)[number] | "Alle">("Alle");
  const [cat, setCat] = useState<(typeof CATEGORIES)[number] | "Alle">("Alle");
  const [faction, setFaction] = useState<(typeof FACTIONS)[number] | "Alle">("Alle");
  const [q, setQ] = useState("");

  const items = useMemo(() => ITEM_CATALOG.filter((i) =>
    (source === "Alle" || i.source.startsWith(source)) &&
    (cat === "Alle" || i.category === cat) &&
    (faction === "Alle" || i.faction === faction || i.faction === "Beide") &&
    (!q || i.name.toLowerCase().includes(q.toLowerCase()))), [source, cat, faction, q]);
  const withIcon = items.filter((i) => i.icon).length;

  return (
    <div className="space-y-4">
      <button onClick={onBack} className="text-sm text-zinc-400 hover:text-white">‹ Charaktere</button>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Item-Katalog</h1>
        <p className="text-sm text-zinc-400">{items.length} Items · {withIcon} mit Originalbild</p>
      </div>
      <div className="space-y-2">
        <Chips value={source} options={SOURCES} onChange={setSource} />
        <Chips value={cat} options={CATEGORIES} onChange={setCat} />
        <Chips value={faction} options={FACTIONS} onChange={setFaction} />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Item suchen…"
          className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-base outline-none focus:border-amber-400" />
      </div>
      <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {items.map((i) => (
          <li key={i.key} className="flex items-center gap-3 rounded-xl border border-white/10 bg-zinc-900/75 p-2.5">
            <CatalogIcon src={i.icon} />
            <div className="min-w-0">
              <div className="truncate text-sm font-medium">{i.name}</div>
              <div className="truncate text-[11px] text-zinc-500">
                {[i.source, i.category, i.slot, `Lv ${i.level}`, i.rarity, i.faction !== "Beide" && i.faction].filter(Boolean).join(" · ")}
              </div>
              {i.itemId && <div className="text-[10px] text-zinc-600">ID {i.itemId}</div>}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function CatalogIcon({ src }: { src: string }) {
  const [failed, setFailed] = useState(false);
  if (src && !failed) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt="" width={44} height={44} loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(true)}
      className="h-11 w-11 shrink-0 rounded-lg bg-black/40 object-contain" />;
  }
  return (
    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-dashed border-white/15 text-center text-[9px] leading-tight text-zinc-500">
      Bild<br />fehlt
    </div>
  );
}
