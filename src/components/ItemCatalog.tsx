"use client";
import { useMemo, useState } from "react";
import { PUBLIC_ITEMS, REGION_LABEL, regionCounts, regionStatus, type RegionStatus } from "@/lib/region";
import { CLASSES, fitsClass } from "@/lib/slot-map";
import { Sheet } from "./ui";
import { Card, CardArt } from "./deck/Card";
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
  const [shown, setShown] = useState<CatalogItem>();
  const [limit, setLimit] = useState(PAGE);
  const opts = internal ? ALL_OPTS : PUBLIC_OPTS;

  const items = useMemo(() => (internal ? ALL_ITEMS : PUBLIC_ITEMS).filter((i) =>
    (source === "Alle" || i.source.startsWith(source)) &&
    (cat === "Alle" || i.category === cat) &&
    (slot === "Alle" || i.slot === slot) &&
    (rarity === "Alle" || i.rarity === rarity) &&
    (level === "Alle" || String(i.level) === level) &&
    (cls === "Alle" || fitsClass(i.slot, cls)) &&
    (!q || i.name.toLowerCase().includes(q.toLowerCase())))
    // items with an original icon first, highest item level first
    .sort((a, b) => Number(!!b.icon) - Number(!!a.icon) || (b.level ?? 0) - (a.level ?? 0)), [internal, source, cat, slot, rarity, level, cls, q]);
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
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {items.slice(0, limit).map((i) => (
          <li key={i.key}>
            <Card as="button" grade={i.crafted ? "BiS" : "?"} onClick={() => setShown(i)} label={i.name} className="flex h-full w-full flex-col p-2.5">
              <CardArt src={localIcon(i.icon)} alt={i.name} grade={i.crafted ? "BiS" : "?"} />
              <div className="relative mt-2 line-clamp-2 min-h-[2.5em] text-[12px] font-medium leading-tight text-[#f4eed7]">{i.name}</div>
              <div className="relative mt-0.5 flex items-center gap-1.5 text-[10px] text-zinc-500">
                <span className="truncate">{[i.slot, i.level && `IL ${i.level}`].filter(Boolean).join(" · ")}</span>
                {internal && <span className={`shrink-0 rounded px-1.5 py-px text-[9px] ${BADGE[regionStatus(i)]}`}>{regionStatus(i) === "eu" ? "EU" : regionStatus(i) === "tw" ? "nur TW" : "unbestätigt"}</span>}
              </div>
            </Card>
          </li>
        ))}
      </ul>
      <Sheet open={!!shown} onClose={() => setShown(undefined)} title={<h2 className="text-lg font-semibold text-[#f4eed7]">{shown?.name}</h2>}>
        {shown && (
          <div className="space-y-4">
            <div className="mx-auto w-48"><CardArt src={localIcon(shown.icon)} alt={shown.name} grade={shown.crafted ? "BiS" : "?"} /></div>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
              {([
                ["Slot", shown.slot], ["Kategorie", shown.category], ["Item-Level", shown.level], ["Seltenheit", shown.rarity],
                ["Quelle", shown.source], ["Fraktion", shown.faction !== "Beide" ? shown.faction : ""], ["Item-ID", shown.itemId],
                ["Region", REGION_LABEL[regionStatus(shown)]],
              ] as [string, string | number | null][]).filter(([, v]) => v).map(([k, v]) => (
                <div key={k} className="contents"><dt className="text-zinc-500">{k}</dt><dd className="text-zinc-200">{v}</dd></div>
              ))}
            </dl>
            {shown.regions.length > 0 && (
              <div className="text-[11px] text-zinc-500">Nachweis: {shown.regions.map((r) => r.source).join(" · ")}</div>
            )}
            {!shown.icon && <p className="text-xs text-zinc-500">Für dieses Item liegt noch kein Original-Icon vor.</p>}
          </div>
        )}
      </Sheet>
      {items.length > limit && (
        <button onClick={() => setLimit((l) => l + PAGE * 2)} className="w-full rounded-lg bg-white/5 py-2.5 text-sm text-zinc-300">
          Weitere anzeigen ({items.length - limit})
        </button>
      )}
      {items.length === 0 && <p className="text-sm text-zinc-400">Keine bestätigten EU / Global Items für diese Filter.</p>}
    </div>
  );
}
