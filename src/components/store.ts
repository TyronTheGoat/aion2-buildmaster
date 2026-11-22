"use client";
import { useSyncExternalStore } from "react";
import type { Character } from "@/lib/types";
import { FLORENTINA } from "@/lib/fixtures/florentina";

export interface SavedChar {
  region: string;
  server: string;
  name: string;
  /** Last known data (from kisk or pasted), so the app also works offline */
  snapshot?: Character;
  /** Base body of the 3D hologram, asked on first open */
  gender?: "f" | "m";
}

const KEY = "bm:chars";
const SEEDED = "bm:seeded";
/** Gender per character, kept separately so it stays even if the character is removed and added again */
const GENDER = "bm:gender";
const listeners = new Set<() => void>();
let cacheRaw: string | null = null;
let cache: SavedChar[] = [];

export const charKey = (c: { region: string; server: string; name: string }) =>
  `${c.region.toLowerCase()}/${c.server.toLowerCase()}/${c.name.toLowerCase()}`;

function read(): SavedChar[] {
  if (typeof window === "undefined") return cache;
  if (!localStorage.getItem(SEEDED)) {
    localStorage.setItem(SEEDED, "1");
    localStorage.setItem(KEY, JSON.stringify([{ region: "eu", server: "odar", name: "Florentina", snapshot: FLORENTINA }]));
  }
  const raw = (localStorage.getItem(KEY) ?? "[]") + (localStorage.getItem(GENDER) ?? "");
  if (raw !== cacheRaw) {
    cacheRaw = raw;
    const genders: Record<string, "f" | "m"> = JSON.parse(localStorage.getItem(GENDER) ?? "{}");
    cache = (JSON.parse(localStorage.getItem(KEY) ?? "[]") as SavedChar[]).map((c) => ({ ...c, gender: c.gender ?? genders[charKey(c)] }));
  }
  return cache;
}

function write(list: SavedChar[]) {
  const genders: Record<string, "f" | "m"> = JSON.parse(localStorage.getItem(GENDER) ?? "{}");
  for (const c of list) if (c.gender) genders[charKey(c)] = c.gender;
  localStorage.setItem(GENDER, JSON.stringify(genders));
  localStorage.setItem(KEY, JSON.stringify(list));
  listeners.forEach((l) => l());
}

export function useCharacters() {
  const chars = useSyncExternalStore(
    (cb) => { listeners.add(cb); window.addEventListener("storage", cb); return () => { listeners.delete(cb); window.removeEventListener("storage", cb); }; },
    read,
    () => [] as SavedChar[],
  );
  return {
    chars,
    upsert(c: SavedChar) {
      const list = read();
      const i = list.findIndex((x) => charKey(x) === charKey(c));
      write(i >= 0 ? list.map((x, j) => (j === i ? { ...x, ...c, snapshot: c.snapshot ?? x.snapshot } : x)) : [...list, c]);
    },
    remove(key: string) {
      write(read().filter((x) => charKey(x) !== key));
    },
  };
}

/** Parses "https://kisk.app/c/eu/odar/Florentina[/gear]" */
export function parseKiskLink(s: string): { region: string; server: string; name: string } | undefined {
  const m = s.match(/kisk\.app\/c\/([^/\s]+)\/([^/\s]+)\/([^/?#\s]+)/i);
  return m ? { region: m[1].toLowerCase(), server: m[2].toLowerCase(), name: decodeURIComponent(m[3]) } : undefined;
}
