"use client";
/** Saved skill planner builds and the chosen own BiS per character (this device; offline preview). */
import { useSyncExternalStore } from "react";
import type { OwnBuild } from "@/lib/own-bis";

const KEY = "bm:builds";
const ACTIVE = "bm:build-active";
const listeners = new Set<() => void>();
let raw = "";
let cache: { builds: Record<string, OwnBuild[]>; active: Record<string, string> } = { builds: {}, active: {} };

function read() {
  if (typeof window === "undefined") return cache;
  const r = (localStorage.getItem(KEY) ?? "{}") + "|" + (localStorage.getItem(ACTIVE) ?? "{}");
  if (r !== raw) {
    raw = r;
    try { cache = { builds: JSON.parse(localStorage.getItem(KEY) ?? "{}"), active: JSON.parse(localStorage.getItem(ACTIVE) ?? "{}") }; } catch { cache = { builds: {}, active: {} }; }
  }
  return cache;
}
function write(next: typeof cache) {
  localStorage.setItem(KEY, JSON.stringify(next.builds));
  localStorage.setItem(ACTIVE, JSON.stringify(next.active));
  listeners.forEach((l) => l());
}

export function useBuilds(charKey: string) {
  const s = useSyncExternalStore((cb) => { listeners.add(cb); window.addEventListener("storage", cb); return () => { listeners.delete(cb); window.removeEventListener("storage", cb); }; }, read, () => cache);
  const builds = s.builds[charKey] ?? [];
  const activeId = s.active[charKey] ?? "";
  return {
    builds,
    /** the own BiS chosen as target in the comparison ("" = kisk's BiS) */
    active: builds.find((b) => b.id === activeId),
    activeId,
    save(b: OwnBuild) {
      const cur = read();
      const list = cur.builds[charKey] ?? [];
      const i = list.findIndex((x) => x.id === b.id);
      write({ ...cur, builds: { ...cur.builds, [charKey]: i >= 0 ? list.map((x, j) => (j === i ? b : x)) : [...list, b] } });
    },
    remove(id: string) {
      const cur = read();
      const active = { ...cur.active };
      if (active[charKey] === id) delete active[charKey];
      write({ builds: { ...cur.builds, [charKey]: (cur.builds[charKey] ?? []).filter((x) => x.id !== id) }, active });
    },
    setActive(id: string) {
      const cur = read();
      write({ ...cur, active: { ...cur.active, [charKey]: id } });
    },
  };
}

/** A new build id (time based). */
export const newBuildId = () => `b${Date.now().toString(36)}`;
/** Time stamp for a saved build. */
export const nowIso = () => new Date().toISOString();
