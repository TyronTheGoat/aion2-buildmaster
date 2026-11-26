"use client";
import { useEffect, useMemo, useState } from "react";
import { useLang, useT } from "@/lib/i18n";
import data from "../../data/pets.json";

/**
 * Where to get which pet (Tyron 2026-11-26), from wakayashi.gg's pet atlas. Big pet pictures first, the name below.
 * Pictures (pet-<id>.webp) are embedded in the offline file, online they come from the icon pack.
 */
interface Named { de: string; en: string }
interface Pet {
  id: string; en: string; de: string; genus: string; group: string;
  spawns?: Record<string, number>; dungeons?: (Named & { n: number })[]; monsters?: Named[];
  chests?: string[]; shops?: string[]; acquisition?: string;
}
const PETS = data.pets as Pet[];

type FilterId = "all" | "verteron" | "altgard" | "both" | "abyss" | "outside" | "dungeon" | "chest" | "special";
/** Same groups as the pet atlas; "without a farming spot" is split into its parts (Tyron). */
const FILTERS: { id: FilterId; de: string; en: string; groups: string[] }[] = [
  { id: "all", de: "Alle Pets", en: "All pets", groups: [] },
  { id: "altgard", de: "Altgard", en: "Altgard", groups: ["asmo", "asmo-abyss"] },
  { id: "verteron", de: "Verteron", en: "Verteron", groups: ["elyos", "elyos-abyss"] },
  { id: "both", de: "Verteron + Altgard", en: "Verteron + Altgard", groups: ["both"] },
  { id: "abyss", de: "Nur Lower Reshanta", en: "Lower Reshanta only", groups: ["abyss"] },
  { id: "outside", de: "Weltbosse (Eltnen / Morheim)", en: "World bosses (Eltnen / Morheim)", groups: ["outside"] },
  { id: "dungeon", de: "Dungeon", en: "Dungeon", groups: ["dungeon"] },
  { id: "chest", de: "Nur Kisten und Shops", en: "Chests and shops only", groups: ["chest"] },
  { id: "special", de: "Cash-Shop (Special)", en: "Cash shop (special)", groups: ["special"] },
];
const MAP_NAME: Record<string, string> = { verteron: "Verteron", altgard: "Altgard", "abyss-reshanta-a": "Lower Reshanta" };
const GENUS: Record<string, string> = { fera: "Fera", natura: "Natura", varian: "Varian", cogni: "Cogni", special: "Special" };

function petPic(id: string) {
  const file = `pet-${id}.webp`;
  return globalThis.__BM_ICONS__?.[file] ?? (typeof location !== "undefined" && /^https?:$/.test(location.protocol) ? `/api/icon/${file}` : undefined);
}

function PetPic({ pet, size }: { pet: Pet; size: "tile" | "big" }) {
  const src = petPic(pet.id);
  const [bad, setBad] = useState(false);
  const box = size === "big" ? "h-32 w-32" : "aspect-square w-full";
  return (
    <span className={`${box} relative block overflow-hidden rounded-xl border border-[#d9c58f]/20 bg-[radial-gradient(circle_at_50%_35%,rgba(217,197,143,0.16),rgba(255,255,255,0.02)_70%)]`}>
      {src && !bad
        // eslint-disable-next-line @next/next/no-img-element
        ? <img src={src} alt={pet.en} loading="lazy" onError={() => setBad(true)} className="h-full w-full scale-[1.22] object-cover transition-transform duration-300 group-hover:scale-[1.32]" />
        : <span className="flex h-full w-full items-center justify-center text-2xl text-[#d9c58f]/40">?</span>}
    </span>
  );
}

/** Short "where" line under the name. */
function whereShort(p: Pet, t: (de: string, en: string) => string): string {
  const maps = Object.keys(p.spawns ?? {}).map((m) => MAP_NAME[m] ?? m);
  if (maps.length) return maps.join(" · ");
  if (p.group === "dungeon") return t("Dungeon", "Dungeon");
  if (p.group === "outside") return t("Weltboss", "World boss");
  if (p.group === "special") return "Cash-Shop";
  return t("Kiste / Shop", "Chest / shop");
}

export function PetAtlas({ onBack }: { onBack: () => void }) {
  const t = useT();
  const lang = useLang();
  const [filter, setFilter] = useState<FilterId>("altgard");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<Pet>();
  const name = (n: Named) => (lang === "en" ? n.en : n.de || n.en);

  const list = useMemo(() => {
    const f = FILTERS.find((x) => x.id === filter)!;
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    return PETS.filter((p) => (!f.groups.length || f.groups.includes(p.group))
      && words.every((w) => [p.en, p.de, ...(p.monsters ?? []).flatMap((m) => [m.en, m.de])].some((s) => s.toLowerCase().includes(w))))
      .sort((a, b) => name(a).localeCompare(name(b)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, q, lang]);

  return (
    <div className="space-y-5">
      <div className="bm-backdrop pointer-events-none fixed inset-0 -z-10" aria-hidden />
      <div className="pt-4">
        <button onClick={onBack} className="rounded-lg border border-[#d9c58f]/25 bg-white/[0.04] px-3 py-1.5 text-sm text-[#efe6cc] hover:border-[#d9c58f]/50">‹ {t("Zurück", "Back")}</button>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[#f4eed7]">Pets</h1>
        <p className="mt-1 text-sm text-[#efe6cc]/50">{t("Wo du welches Pet bekommst. Pet antippen für Monster, Dungeons und Kisten.", "Where to get which pet. Tap a pet for monsters, dungeons and chests.")}</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <label className="relative flex-1 sm:flex-none">
          <span className="sr-only">{t("Farmort", "Farming spot")}</span>
          <select value={filter} onChange={(e) => setFilter(e.target.value as FilterId)}
            className="w-full appearance-none rounded-lg border border-[#d9c58f]/30 bg-[#14151b] py-2 pl-3 pr-9 text-sm font-medium text-[#f4eed7] hover:border-[#d9c58f]/60 focus:outline-none focus:ring-1 focus:ring-[#d9c58f]/50">
            {FILTERS.map((f) => <option key={f.id} value={f.id}>{lang === "en" ? f.en : f.de}</option>)}
          </select>
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#d9c58f]">▾</span>
        </label>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("Pet oder Monster suchen", "Search pet or monster")}
          className="w-full min-w-0 flex-1 basis-full rounded-lg border border-[#d9c58f]/20 bg-white/[0.04] px-3 py-2 text-sm text-[#f4eed7] placeholder:text-zinc-500 focus:border-[#d9c58f]/50 focus:outline-none sm:max-w-xs sm:basis-auto" />
        <span className="text-xs text-zinc-500">{list.length} Pets</span>
      </div>

      {list.length === 0 && <p className="text-sm text-zinc-500">{t("Kein Pet gefunden.", "No pet found.")}</p>}
      <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-7">
        {list.map((p) => (
          <li key={p.id}>
            <button type="button" onClick={() => setOpen(p)} className="group flex w-full flex-col items-center gap-1.5 rounded-xl p-1 text-center focus:outline-none focus-visible:ring-1 focus-visible:ring-[#d9c58f]/60">
              <PetPic pet={p} size="tile" />
              <span className="line-clamp-2 text-[13px] font-medium leading-tight text-[#f4eed7]">{name(p)}</span>
              <span className="-mt-1 truncate text-[10px] text-zinc-500">{whereShort(p, t)}</span>
            </button>
          </li>
        ))}
      </ul>
      <p className="text-[11px] text-zinc-600">{t("Daten", "Data")}: <a href={data.source} target="_blank" rel="noreferrer" className="underline hover:text-zinc-400">wakayashi.gg Pet-Atlas</a> ({data.dataDate})</p>

      {open && <PetDetail pet={open} onClose={() => setOpen(undefined)} />}
    </div>
  );
}

function Section({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <div>
      <div className="text-[11px] font-semibold uppercase tracking-wide text-[#d9c58f]/70">{title}</div>
      <ul className="mt-1 flex flex-wrap gap-1.5">{items.map((s) => <li key={s} className="rounded-md border border-white/10 bg-white/[0.04] px-2 py-0.5 text-xs text-[#efe6cc]/85">{s}</li>)}</ul>
    </div>
  );
}

function PetDetail({ pet, onClose }: { pet: Pet; onClose: () => void }) {
  const t = useT();
  const lang = useLang();
  const name = (n: Named) => (lang === "en" ? n.en : n.de || n.en);
  const spawns = Object.entries(pet.spawns ?? {});
  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [onClose]);
  return (
    <div role="dialog" aria-modal="true" aria-label={name(pet)} className="fixed inset-0 z-[90] flex items-end justify-center p-3 sm:items-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px]" />
      <div className="relative max-h-[85vh] w-full max-w-md overflow-y-auto rounded-2xl border border-[#d9c58f]/25 bg-[#111217] p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} aria-label={t("Schließen", "Close")} className="absolute right-3 top-3 rounded-md px-2 text-lg text-zinc-400 hover:text-white">×</button>
        <div className="flex items-center gap-4">
          <PetPic pet={pet} size="big" />
          <div className="min-w-0">
            <div className="text-xl font-semibold text-[#f4eed7]">{name(pet)}</div>
            {lang !== "en" && pet.de !== pet.en && <div className="text-xs text-zinc-500">{pet.en}</div>}
            <div className="mt-1 inline-block rounded-md bg-[#d9c58f]/15 px-2 py-0.5 text-[11px] font-semibold text-[#d9c58f]">{GENUS[pet.genus] ?? pet.genus}</div>
          </div>
        </div>
        <div className="mt-4 space-y-3">
          <Section title={t("Karten (Fundorte)", "Maps (spawns)")} items={spawns.map(([m, n]) => `${MAP_NAME[m] ?? m} · ${n}×`)} />
          <Section title="Dungeons" items={(pet.dungeons ?? []).map((d) => name(d))} />
          <Section title={t("Monster", "Monsters")} items={(pet.monsters ?? []).map((m) => name(m))} />
          <Section title={t("Kisten", "Chests")} items={pet.chests ?? []} />
          <Section title="Shops" items={pet.shops ?? []} />
          {pet.acquisition && <p className="text-xs text-[#efe6cc]/60">{pet.acquisition}</p>}
          {pet.group === "outside" && <p className="text-xs text-[#efe6cc]/60">{t("Die Soul droppt ein Weltboss außerhalb der drei Karten (Eltnen oder Morheim).", "The soul drops from a world boss outside the three maps (Eltnen or Morheim).")}</p>}
          {pet.group === "special" && <p className="text-xs text-[#efe6cc]/60">{t("Nur im Cash-Shop, ohne Boni.", "Cash shop only, no bonuses.")}</p>}
        </div>
      </div>
    </div>
  );
}
