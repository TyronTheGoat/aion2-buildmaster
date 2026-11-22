"use client";
import { useSyncExternalStore } from "react";
import { emptyState, importFile, type CraftState } from "@/lib/crafting/model";
import { BUILTIN_FILES, BUILTIN_VERSION } from "@/lib/crafting/builtin-data";

/**
 * Crafting data on the device, in its own key: projects, history, prices and imported recipes.
 * Kept apart from the kisk character data, so a character refresh never touches it.
 */
const KEY = "bm:craft:v1";
const BACKUP = "bm:craft:backup";
const listeners = new Set<() => void>();
let raw: string | null | undefined; // undefined: not read yet
let cache: CraftState = emptyState();
const SERVER = emptyState();

function read(): CraftState {
  if (typeof window === "undefined") return cache;
  const r = localStorage.getItem(KEY);
  if (r !== raw) {
    raw = r;
    try { cache = migrate(r ? JSON.parse(r) : {}); } catch { cache = withBuiltin(emptyState()); }
    if (cache.dataVersion && JSON.stringify(cache) !== r) { raw = JSON.stringify(cache); localStorage.setItem(KEY, raw); }
  }
  return cache;
}

/**
 * Fills fields added later and merges the data package built into the app when it is newer.
 * A backup of the old data is kept before anything changes. Prices, projects, inventory and history are never touched.
 */
export function migrate(s: Partial<CraftState> & { version?: number }): CraftState {
  const old = s.version !== 2 || s.dataVersion !== BUILTIN_VERSION;
  if (old && typeof localStorage !== "undefined" && (s.projects?.length || s.prices?.length || s.events?.length)) {
    localStorage.setItem(`${BACKUP}:${Date.now()}`, JSON.stringify(s));
  }
  let next: CraftState = { ...emptyState(), ...(s as Partial<CraftState>), version: 2 };
  if (next.dataVersion !== BUILTIN_VERSION) next = withBuiltin(next);
  return next;
}

/** Imports the built-in files in their fixed order (recipes, ingredients, transfers, key fix, chain, gap lists, catalogue). */
export function withBuiltin(s: CraftState): CraftState {
  let next = s;
  for (const [file, text] of BUILTIN_FILES) next = importFile(next, file, text).state;
  return { ...next, dataVersion: BUILTIN_VERSION };
}

function write(s: CraftState) {
  localStorage.setItem(KEY, JSON.stringify(s));
  listeners.forEach((l) => l());
}

export function useCraft() {
  const state = useSyncExternalStore(
    (cb) => { listeners.add(cb); window.addEventListener("storage", cb); return () => { listeners.delete(cb); window.removeEventListener("storage", cb); }; },
    read,
    () => SERVER,
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
