"use client";
import { useSyncExternalStore } from "react";
import { emptyState, type CraftState } from "@/lib/crafting/model";

/**
 * Crafting data on the device, in its own key: projects, history, prices and imported recipes.
 * Kept apart from the kisk character data, so a character refresh never touches it.
 */
const KEY = "bm:craft:v1";
const BACKUP = "bm:craft:backup";
const listeners = new Set<() => void>();
let raw: string | null = null;
let cache: CraftState = emptyState();

function read(): CraftState {
  if (typeof window === "undefined") return cache;
  const r = localStorage.getItem(KEY);
  if (r !== raw) {
    raw = r;
    try { cache = r ? migrate(JSON.parse(r)) : emptyState(); } catch { cache = emptyState(); }
  }
  return cache;
}

/** Fills fields added later; a backup of the old data is kept before anything changes. */
function migrate(s: Partial<CraftState>): CraftState {
  if (s.version !== 1) localStorage.setItem(`${BACKUP}:${Date.now()}`, JSON.stringify(s));
  return { ...emptyState(), ...s, version: 1 };
}

function write(s: CraftState) {
  localStorage.setItem(KEY, JSON.stringify(s));
  listeners.forEach((l) => l());
}

export function useCraft() {
  const state = useSyncExternalStore(
    (cb) => { listeners.add(cb); window.addEventListener("storage", cb); return () => { listeners.delete(cb); window.removeEventListener("storage", cb); }; },
    read,
    () => cache,
  );
  return {
    state,
    update(fn: (s: CraftState) => CraftState) { write(fn(read())); },
    /** whole crafting data as a JSON file */
    exportJson() { return JSON.stringify(read(), null, 1); },
    /** restores an exported file; the current data is backed up first */
    importJson(text: string) {
      const next = JSON.parse(text) as Partial<CraftState>;
      if (!next || typeof next !== "object" || !Array.isArray(next.projects)) throw new Error("keine BuildMaster-Crafting-Datei");
      localStorage.setItem(`${BACKUP}:${Date.now()}`, JSON.stringify(read()));
      write(migrate(next));
    },
  };
}
