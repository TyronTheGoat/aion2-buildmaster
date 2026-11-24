"use client";
/** Favourite characters per login (Tyron 2026-11-24): kept in the account's cloud doc "favorites", favourites stand first. */
import { useSyncExternalStore } from "react";

export const FAV_KEY = "bm:favorites";
const listeners = new Set<() => void>();
let raw: string | null = null;
let cache: string[] = [];
const read = () => {
  if (typeof window === "undefined") return cache;
  const r = localStorage.getItem(FAV_KEY);
  if (r !== raw) { raw = r; try { const v = JSON.parse(r ?? "[]"); cache = Array.isArray(v) ? v.filter((x) => typeof x === "string") : []; } catch { cache = []; } }
  return cache;
};
export function useFavorites() {
  const favs = useSyncExternalStore((cb) => { listeners.add(cb); window.addEventListener("storage", cb); return () => { listeners.delete(cb); window.removeEventListener("storage", cb); }; }, read, () => cache);
  return {
    favs,
    isFav: (k: string) => favs.includes(k),
    toggle(k: string) {
      const cur = read();
      localStorage.setItem(FAV_KEY, JSON.stringify(cur.includes(k) ? cur.filter((x) => x !== k) : [...cur, k]));
      listeners.forEach((l) => l());
    },
  };
}
