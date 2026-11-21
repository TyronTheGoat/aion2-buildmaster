"use client";
import { useCallback, useSyncExternalStore } from "react";

export interface Fav { region: string; server: string; name: string }
const KEY = "bm:favorites";
const listeners = new Set<() => void>();

function read(): string {
  if (typeof window === "undefined") return "[]";
  return localStorage.getItem(KEY) ?? "[]";
}

export function useFavorites() {
  const raw = useSyncExternalStore(
    (cb) => { listeners.add(cb); window.addEventListener("storage", cb); return () => { listeners.delete(cb); window.removeEventListener("storage", cb); }; },
    read,
    () => "[]",
  );
  const favs: Fav[] = JSON.parse(raw);
  const save = (next: Fav[]) => { localStorage.setItem(KEY, JSON.stringify(next)); listeners.forEach((l) => l()); };
  const same = (a: Fav, b: Fav) => a.region === b.region && a.server.toLowerCase() === b.server.toLowerCase() && a.name.toLowerCase() === b.name.toLowerCase();
  const isFav = useCallback((f: Fav) => favs.some((x) => same(x, f)), [favs]);
  const toggle = (f: Fav) => save(isFav(f) ? favs.filter((x) => !same(x, f)) : [...favs, f]);
  return { favs, isFav, toggle };
}

export function charHref(f: Fav) {
  return `/c/${encodeURIComponent(f.region)}/${encodeURIComponent(f.server.toLowerCase())}/${encodeURIComponent(f.name)}`;
}
