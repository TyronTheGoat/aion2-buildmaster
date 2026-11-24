"use client";
import { useState } from "react";
import type { Item } from "@/lib/types";
import { needsPick, pickOptions, type OwnBuild } from "@/lib/own-bis";
import { placeOf, type PlaceId } from "@/lib/skill-plan";
import { skillLabel, statLabel } from "@/lib/stat-names";
import { useLang } from "@/lib/i18n";

/**
 * Own BiS on a gear piece with planned abilities kisk's BiS does not have: which of kisk's BiS lines stay beside them?
 * Asked once per piece (open until confirmed), can be changed later.
 */
export function OwnBisPicker({ build, place, kiskItem, onSave }: { build: OwnBuild; place: PlaceId; kiskItem: Item; onSave: (b: OwnBuild) => void }) {
  const lang = useLang();
  const planned = build.places.find((p) => p.id === place)?.lines ?? [];
  const { lines, room, preset } = pickOptions(kiskItem, planned);
  const saved = build.picks[place];
  const [sel, setSel] = useState<string[]>(saved ?? preset);
  if (!needsPick(kiskItem, planned)) return null;
  const toggle = (n: string) => setSel((s) => (s.includes(n) ? s.filter((x) => x !== n) : s.length < room ? [...s, n] : s));
  return (
    <details open={!saved} className="rounded-2xl bg-[#d9c58f]/[0.06] px-3 py-3 ring-1 ring-[#d9c58f]/35 sm:px-4">
      <summary className="cursor-pointer select-none text-sm font-semibold text-[#f4eed7]">
        {saved ? `Eigener BiS „${build.name}“: Zeilen aus dem kisk-BiS ändern` : `Eigener BiS „${build.name}“ · ${placeOf(place).de}: Welche ${room} Zeile${room === 1 ? "" : "n"} aus dem kisk-BiS behältst du?`}
      </summary>
      <p className="mt-1 text-xs text-zinc-400">Fest im Plan: {planned.map((l) => `${skillLabel(l.skill, lang)} +1`).join(", ")}. Den Rest wählst du aus dem kisk-BiS.</p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {lines.map((l) => {
          const on = sel.includes(l.name);
          return <button key={l.name} type="button" onClick={() => toggle(l.name)} aria-pressed={on}
            className={`rounded-lg px-2.5 py-1 text-sm ring-1 ${on ? "bg-[#d9c58f]/20 text-[#f4eed7] ring-[#d9c58f]/60" : "text-zinc-400 ring-white/10 hover:text-zinc-200"} ${!on && sel.length >= room ? "opacity-40" : ""}`}>
            {on ? "✓ " : ""}{statLabel(l.name, lang)} {l.value}</button>;
        })}
      </div>
      <div className="mt-2 flex items-center gap-3">
        <button type="button" onClick={() => onSave({ ...build, picks: { ...build.picks, [place]: sel } })}
          className="rounded-lg bg-[#d9c58f] px-3 py-1.5 text-sm font-semibold text-[#14110a]">Übernehmen</button>
        <span className="text-xs text-zinc-500">{sel.length}/{room} gewählt{sel.length < room ? ", der Rest bleibt „Any“" : ""}</span>
      </div>
    </details>
  );
}
