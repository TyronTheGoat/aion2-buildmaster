"use client";
import { useCloud } from "./cloud";
import { setLang, useLang, useT } from "@/lib/i18n";

/** Small language switch (EN / DE) in the header, on every page. */
export function LangSwitch() {
  const lang = useLang();
  return (
    <div role="group" aria-label="Language / Sprache" className="ml-auto flex shrink-0 overflow-hidden rounded-md border border-[#d9c58f]/20 text-[10px] font-semibold tracking-wide">
      {(["en", "de"] as const).map((l) => (
        <button key={l} type="button" onClick={() => setLang(l)} aria-pressed={lang === l}
          className={`px-1.5 py-0.5 ${lang === l ? "bg-[#d9c58f]/20 text-[#f4eed7]" : "text-zinc-500 hover:text-zinc-300"}`}>
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  );
}

export const NAV_CLS = "rounded-lg border border-[#d9c58f]/25 px-3 py-1 text-sm text-[#efe6cc]/85 hover:border-[#d9c58f]/50";

/** Label of the one navigation tab (the link itself is rendered by the page shell). No next/link here: the offline build has no Next runtime. */
export function NavLabel() {
  return <>{useT()("Charaktere", "Characters")}</>;
}

/** Offline shell: one tab back to the character selection. */
export function OfflineNav() {
  return <nav aria-label="Main navigation"><a href="#" className={NAV_CLS}><NavLabel /></a></nav>;
}

export function OfflineBadge() {
  const t = useT();
  const cloud = useCloud();
  if (cloud.mode === "online") {
    return <span className="truncate text-xs text-zinc-500" title={cloud.error ? t("Speichern auf dem Server klappt gerade nicht, die Daten bleiben auf diesem Gerät", "Saving to the server fails right now, the data stays on this device") : t("Deine Daten werden online gespeichert", "Your data is saved online")}>
      <span className={cloud.error ? "text-[#ffa31a]" : "text-[#5fbf8a]"}>●</span> {cloud.email}
    </span>;
  }
  return <span className="text-xs text-zinc-500">{t("Offline-Version", "Offline version")}</span>;
}

/** Fixed, very small note at the bottom of every page. */
export function FooterNote() {
  const t = useT();
  return (
    <footer className="pointer-events-none fixed inset-x-0 bottom-0 z-20 bg-[#0b0c10]/85 pb-[env(safe-area-inset-bottom)] text-center text-[9px] leading-[14px] text-zinc-600">
      {t("Daten: kisk.app · Nicht offiziell, kein Bezug zu NCSOFT", "Data: kisk.app · Unofficial, not affiliated with NCSOFT")}
    </footer>
  );
}
