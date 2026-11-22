"use client";
import { useMemo, useState } from "react";
import { PUBLIC_ITEMS, REGION_LABEL, regionCounts, regionStatus, type RegionStatus } from "@/lib/region";
import { CLASSES, fitsClass } from "@/lib/slot-map";
import { ItemIcon } from "./ui";
import { ALL_ITEMS, localIcon, type CatalogItem } from "@/lib/knowledge/item-catalog";

const uniq = (xs: string[]) => [...new Set(xs.filter(Boolean))].sort((a, b) => a.localeCompare(b, "de"));
function optionsOf(list: CatalogItem[]) {
  return {
    sources: uniq(list.map((i) => i.source.replace(/ \(Stufe \d+\)$/, ""))),
    categories: uniq(list.map((i) => i.category)),
    slots: uniq(list.map((i) => i.slot)),
    rarities: uniq(list.map((i) => i.rarity)),
    levels: [...new Set(list.map((i) => i.level).filter((l): l is number => l != null))].sort((a, b) => b - a).map(String),
  };
}
// filter options of the public view come only from the released EU / Global selection
const PUBLIC_OPTS = optionsOf(PUBLIC_ITEMS);
const ALL_OPTS = optionsOf(ALL_ITEMS);
const PAGE = 120;
const BADGE: Record<RegionStatus, string> = {
  eu: "bg-emerald-400/15 text-emerald-200",
  tw: "bg-rose-400/15 text-rose-200",
  unclear: "bg-amber-400/15 text-amber-200",
};

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
  // internal view: also Taiwan-only and unconfirmed items, clearly marked; never used for planning
  const [internal, setInternal] = useState(false);
  const [limit, setLimit] = useState(PAGE);
  const opts = internal ? ALL_OPTS : PUBLIC_OPTS;

  const items = useMemo(() => (internal ? ALL_ITEMS : PUBLIC_ITEMS).filter((i) =>
    (source === "Alle" || i.source.startsWith(source)) &&
    (cat === "Alle" || i.category === cat) &&
    (slot === "Alle" || i.slot === slot) &&
    (rarity === "Alle" || i.rarity === rarity) &&
    (level === "Alle" || String(i.level) === level) &&
    (cls === "Alle" || fitsClass(i.slot, cls)) &&
    (!q || i.name.toLowerCase().includes(q.toLowerCase()))), [internal, source, cat, slot, rarity, level, cls, q]);
  const withIcon = items.filter((i) => i.icon).length;
  const hidden = regionCounts();

  return (
    <div className="space-y-4">
      <button onClick={onBack} className="text-sm text-zinc-400 hover:text-white">‹ Charaktere</button>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Item-Katalog</h1>
        <p className="text-sm text-zinc-400">{items.length} Items · {withIcon} mit Originalbild · {internal ? "inkl. interner Daten" : REGION_LABEL.eu}</p>
        <p className="text-[11px] text-zinc-500">{internal ? "Intern" : "Intern ausgeblendet"}: {hidden.tw} nur Taiwan · {hidden.unclear} {REGION_LABEL.unclear}</p>
        <label className="mt-2 flex items-center gap-2 text-xs text-zinc-300">
          <input type="checkbox" checked={internal} onChange={(e) => { setInternal(e.target.checked); setLimit(PAGE); }} className="accent-amber-400" />
          Interne Daten zeigen (nur Taiwan / unbestätigt, nicht für die Planung)
        </label>
      </div>
      <div className="space-y-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Item suchen…"
          className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-base outline-none focus:border-amber-400" />
        <Chips value={cat} options={opts.categories} onChange={(v) => { setCat(v); setSlot("Alle"); }} />
        <Chips value={slot} options={cat === "Alle" ? opts.slots : uniq((internal ? ALL_ITEMS : PUBLIC_ITEMS).filter((i) => i.category === cat).map((i) => i.slot))} onChange={setSlot} />
        <Chips value={cls} options={CLASSES} onChange={setCls} />
        <Chips value={source} options={opts.sources} onChange={setSource} />
        <Chips value={rarity} options={opts.rarities} onChange={setRarity} />
        <Chips value={level} options={opts.levels} onChange={setLevel} />
      </div>
      <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {items.slice(0, limit).map((i) => (
          <li key={i.key} className="flex items-center gap-3 rounded-xl border border-white/10 bg-zinc-900/75 p-2.5">
            <ItemIcon src={localIcon(i.icon)} name={i.name} size={44} />
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="truncate text-sm font-medium">{i.name}</span>
                {internal && <span className={`shrink-0 rounded px-1.5 py-px text-[9px] ${BADGE[regionStatus(i)]}`}>{regionStatus(i) === "eu" ? "EU" : regionStatus(i) === "tw" ? "nur TW" : "unbestätigt"}</span>}
              </div>
              <div className="truncate text-[11px] text-zinc-500">
                {[i.source, i.category, i.slot, i.level && `Lv ${i.level}`, i.rarity, i.faction !== "Beide" && i.faction].filter(Boolean).join(" · ")}
              </div>
              {i.itemId && <div className="text-[10px] text-zinc-600">ID {i.itemId}</div>}
            </div>
          </li>
        ))}
      </ul>
      {items.length > limit && (
        <button onClick={() => setLimit((l) => l + PAGE * 2)} className="w-full rounded-lg bg-white/5 py-2.5 text-sm text-zinc-300">
          Weitere anzeigen ({items.length - limit})
        </button>
      )}
      {items.length === 0 && <p className="text-sm text-zinc-400">Keine bestätigten EU / Global Items für diese Filter.</p>}
    </div>
  );
}
