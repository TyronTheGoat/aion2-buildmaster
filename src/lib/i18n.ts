import { useSyncExternalStore } from "react";
import type { SlotKind } from "./types";
import { SLOT_LABEL_DE } from "./knowledge/slots";

/**
 * UI language. The page always starts in English; the small switch in the header changes it for the
 * current visit (not stored, so a reload is English again).
 */
export type Lang = "en" | "de";

let current: Lang = "en";
const listeners = new Set<() => void>();

export function setLang(l: Lang) {
  current = l;
  if (typeof document !== "undefined") document.documentElement.lang = l;
  listeners.forEach((f) => f());
}

export function useLang(): Lang {
  return useSyncExternalStore(
    (cb) => { listeners.add(cb); return () => { listeners.delete(cb); }; },
    () => current,
    () => "en" as Lang,
  );
}

/** Picks the text for the current language: t("Deutsch", "English"). */
export type T = (de: string, en: string) => string;
export function useT(): T {
  const lang = useLang();
  return (de, en) => (lang === "en" ? en : de);
}

export const numberLocale = (l: Lang) => (l === "en" ? "en-US" : "de-DE");

export const SLOT_LABEL_EN: Record<SlotKind, string> = {
  weapon: "Weapon", offhand: "Off-hand", torso: "Chest", pants: "Legs", helmet: "Helmet",
  shoulders: "Shoulders", gloves: "Gloves", boots: "Boots", cape: "Cloak",
  necklace: "Necklace", earring: "Earring", ring: "Ring", bracelet: "Bracelet",
  belt: "Belt", rune: "Rune", amulet: "Amulet", arcana: "Arcana", unknown: "Unknown",
};

export const slotLabel = (slot: SlotKind, l: Lang) => (l === "en" ? SLOT_LABEL_EN : SLOT_LABEL_DE)[slot];
