"use client";
import { useSyncExternalStore } from "react";

/** Skill levels the player typed in, per character: { [charKey]: { mode, levels: { [skill nameEn]: level } } }; synced per account. */
export const SKILLS_KEY = "bm:skills";
export type SkillInputMode = "total" | "base";
interface CharSkills { mode?: SkillInputMode; levels?: Record<string, number> }
const listeners = new Set<() => void>();
let raw: string | null = null, cache: Record<string, CharSkills> = {};

function read() {
  if (typeof window === "undefined") return cache;
  const r = localStorage.getItem(SKILLS_KEY) ?? "{}";
  if (r !== raw) { raw = r; try { cache = JSON.parse(r) ?? {}; } catch { cache = {}; } }
  return cache;
}

function write(charKey: string, fn: (c: CharSkills) => CharSkills) {
  const all = read();
  localStorage.setItem(SKILLS_KEY, JSON.stringify({ ...all, [charKey]: fn(all[charKey] ?? {}) }));
  listeners.forEach((l) => l());
}

export function useSkillLevels(charKey: string) {
  const all = useSyncExternalStore(
    (cb) => { listeners.add(cb); window.addEventListener("storage", cb); return () => { listeners.delete(cb); window.removeEventListener("storage", cb); }; },
    read,
    () => cache,
  );
  const mine = all[charKey] ?? {};
  return {
    mode: mine.mode ?? "total",
    levels: mine.levels ?? {},
    setMode: (mode: SkillInputMode) => write(charKey, (c) => ({ ...c, mode })),
    setLevel: (skill: string, level: number | null) => write(charKey, (c) => {
      const levels = { ...(c.levels ?? {}) };
      if (level === null) delete levels[skill]; else levels[skill] = level;
      return { ...c, levels };
    }),
  };
}
