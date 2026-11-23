"use client";
import { useSyncExternalStore } from "react";

/** Planned (Soll) item per character and slot, stored on the device: { [charKey]: { [slotId]: catalogKey } } */
const KEY = "bm:planned";
const listeners = new Set<() => void>();
let raw: string | null = null, cache: Record<string, Record<string, string>> = {};

function read() {
  if (typeof window === "undefined") return cache;
  const r = localStorage.getItem(KEY) ?? "{}";
  if (r !== raw) { raw = r; try { cache = JSON.parse(r); } catch { cache = {}; } }
  return cache;
}

export function usePlanned(charKey: string) {
  const all = useSyncExternalStore(
    (cb) => { listeners.add(cb); window.addEventListener("storage", cb); return () => { listeners.delete(cb); window.removeEventListener("storage", cb); }; },
    read,
    () => cache,
  );
  const mine = all[charKey] ?? {};
  return {
    planned: mine,
    setPlanned(slotId: string, catalogKey: string | undefined) {
      const next = { ...read(), [charKey]: { ...(read()[charKey] ?? {}) } };
      if (catalogKey) next[charKey][slotId] = catalogKey; else delete next[charKey][slotId];
      localStorage.setItem(KEY, JSON.stringify(next));
      listeners.forEach((l) => l());
    },
  };
}
