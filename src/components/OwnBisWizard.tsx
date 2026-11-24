"use client";
import { PREVIEW } from "@/lib/preview";
import { Help } from "./extras";
import { useState } from "react";
import type { Character, IdealLine } from "@/lib/types";
import { needsPick, pickOptions, type OwnBuild } from "@/lib/own-bis";
import { currentItems, placeName, type PlaceId } from "@/lib/skill-plan";
import { skillLabel, statLabel } from "@/lib/stat-names";
import { useLang, useT } from "@/lib/i18n";

/** Gear in the order the wizard walks through it. */
const GEAR_ORDER: PlaceId[] = ["weapon", "guard", "helm", "pauldrons", "top", "legs", "gloves", "shoes", "cloak", "necklace", "earring1", "earring2", "ring1", "ring2"];
const isSkill = (v: string) => /^\+\d+$/.test(v.trim());

/** Gear pieces of a build that still need the choice of kisk lines. */
export function pendingPieces(build: OwnBuild, kiskChar: Character): PlaceId[] {
  const items = currentItems(kiskChar);
  return GEAR_ORDER.filter((id) => {
    const it = items[id];
    const planned = build.places.find((p) => p.id === id)?.lines ?? [];
    return it && !build.picks[id] && needsPick(it, planned);
  });
}

/**
 * First switch to an own BiS (Tyron 2026-11-24): piece by piece (weapon, off-hand, helmet …, only pieces where the build
 * differs), kisk's BiS and the own BiS side by side; take out as many kisk lines as the build brings new abilities, Next.
 */
export function OwnBisWizard({ build, kiskChar, onSave, onCancel }: { build: OwnBuild; kiskChar: Character; onSave: (b: OwnBuild) => void; onCancel: () => void }) {
  const t = useT();
  const lang = useLang();
  const [steps] = useState(() => pendingPieces(build, kiskChar));
  const [i, setI] = useState(0);
  const [picks, setPicks] = useState<Partial<Record<PlaceId, string[]>>>({});
  const [removed, setRemoved] = useState<Partial<Record<PlaceId, string[]>>>({});
  const items = currentItems(kiskChar);
  const place = steps[i];
  if (!place) return null;
  const item = items[place]!;
  const planned = build.places.find((p) => p.id === place)?.lines ?? [];
  const { lines, room } = pickOptions(item, planned);
  const need = Math.max(0, lines.length - room);
  const out = removed[place] ?? [];
  const keep = lines.filter((l) => !out.includes(l.name));
  const name = (l: IdealLine) => (isSkill(l.value) ? skillLabel(l.name, lang) : statLabel(l.name, lang));
  const toggle = (n: string) => setRemoved((r) => {
    const cur = r[place] ?? [];
    return { ...r, [place]: cur.includes(n) ? cur.filter((x) => x !== n) : cur.length < need ? [...cur, n] : cur };
  });
  const next = () => {
    const all = { ...picks, [place]: keep.map((l) => l.name) };
    setPicks(all);
    if (i + 1 < steps.length) setI(i + 1);
    else onSave({ ...build, picks: { ...build.picks, ...all } });
  };
  const inKisk = (skill: string) => (item.ideal ?? []).some((l) => l.name.toLowerCase() === skill.toLowerCase());

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-3 sm:p-6" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-[2px]" />
      <div key={place} className="card-face pop-in relative max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl p-4 ring-1 ring-[#d9c58f]/45 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[11px] uppercase tracking-widest text-[#d9c58f]">{t(`Eigener BiS „${build.name}“ einrichten`, `Set up own BiS "${build.name}"`)} · {t("Schritt", "Step")} {i + 1}/{steps.length}</div>
            <h2 className="mt-1 flex items-center gap-2 text-2xl font-semibold text-[#f4eed7]">{placeName(place, lang)}
              {PREVIEW && <Help text={t("Dein Build bringt auf dieses Teil neue Abilities. Dafür fallen Zeilen aus dem kisk-BiS weg: Tippe so viele an, wie angezeigt. Zeilen aus deinem Plan bleiben fest.", "Your build puts new abilities on this piece, so lines of kisk's BiS have to go: tap as many as shown. Lines from your plan stay fixed.")} />}</h2>
            <p className="mt-1 text-sm text-zinc-400">
              {need > 0
                ? t(`Dein Build bringt hier ${planned.filter((p) => !inKisk(p.skill)).length} neue Abilities. Nimm ${need} Zeile${need === 1 ? "" : "n"} aus dem kisk-BiS heraus, der Rest bleibt.`,
                  `Your build brings ${planned.filter((p) => !inKisk(p.skill)).length} new abilities here. Take ${need} line${need === 1 ? "" : "s"} out of kisk's BiS, the rest stays.`)
                : t("Hier passt alles hinein, nichts muss raus.", "Everything fits here, nothing has to go.")}
            </p>
          </div>
          <button onClick={onCancel} className="shrink-0 rounded-lg bg-white/5 px-2.5 py-1 text-sm text-zinc-300" aria-label={t("Abbrechen", "Cancel")}>✕</button>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 sm:gap-5">
          <div className="rounded-xl bg-white/[0.03] p-3 ring-1 ring-white/10">
            <div className="mb-2 text-[10px] uppercase tracking-widest text-zinc-500">kisk-BiS · {t("antippen zum Entfernen", "tap to take out")}</div>
            <ul className="space-y-1.5">
              {(item.ideal ?? []).map((l) => {
                const fixed = planned.some((p) => p.skill.toLowerCase() === l.name.toLowerCase());
                const gone = out.includes(l.name);
                return (
                  <li key={l.name}>
                    <button type="button" disabled={fixed || (!gone && out.length >= need)} onClick={() => toggle(l.name)} aria-pressed={gone}
                      className={`flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-left text-sm ring-1 transition-colors ${gone ? "bg-[#ff6b6b]/10 text-[#ff8b8b] line-through ring-[#ff6b6b]/40" : fixed ? "text-[#5fbf8a] ring-[#5fbf8a]/30" : "text-[#efe6cc] ring-white/10 hover:ring-[#ff8b8b]/50 disabled:opacity-50"}`}>
                      <span className="min-w-0 truncate">{name(l)}</span>
                      <span className="shrink-0 text-xs">{fixed ? t("auch im Plan", "also planned") : gone ? t("raus", "out") : l.value}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
          <div className="rounded-xl bg-[#d9c58f]/[0.06] p-3 ring-1 ring-[#d9c58f]/35">
            <div className="mb-2 text-[10px] uppercase tracking-widest text-[#d9c58f]">{t("Dein BiS", "Your BiS")} „{build.name}“</div>
            <ul className="space-y-1.5 text-sm">
              {keep.slice(0, room).map((l) => <li key={l.name} className="flex justify-between gap-2 rounded-lg px-2.5 py-1.5 text-[#efe6cc] ring-1 ring-white/10"><span className="truncate">{name(l)}</span><span className="text-xs text-zinc-400">{l.value}</span></li>)}
              {planned.map((p) => <li key={p.skill} className="flex justify-between gap-2 rounded-lg bg-[#d9c58f]/10 px-2.5 py-1.5 font-semibold text-[#f4eed7] ring-1 ring-[#d9c58f]/40"><span className="truncate">{skillLabel(p.skill, lang)}</span><span className="text-xs text-[#d9c58f]">+1 · {t("Plan", "plan")}</span></li>)}
            </ul>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-2">
          <button onClick={() => (i > 0 ? setI(i - 1) : onCancel())} className="rounded-lg px-3 py-2 text-sm text-zinc-400 hover:text-zinc-200">{i > 0 ? `‹ ${t("Zurück", "Back")}` : t("Abbrechen", "Cancel")}</button>
          <span className="ml-auto text-xs text-zinc-500">{out.length}/{need} {t("entfernt", "taken out")}</span>
          <button onClick={next} disabled={out.length < need}
            className="rounded-lg bg-[#d9c58f] px-4 py-2 text-sm font-semibold text-[#14110a] disabled:cursor-not-allowed disabled:opacity-40">
            {i + 1 < steps.length ? `${t("Weiter", "Next")} ›` : t("Fertig, speichern", "Done, save")}</button>
        </div>
      </div>
    </div>
  );
}
