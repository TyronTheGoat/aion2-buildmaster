"use client";
import { useSyncExternalStore } from "react";
import type { Character } from "@/lib/types";
import { FLORENTINA } from "@/lib/fixtures/florentina";
import { ODAR_CHARS } from "@/lib/fixtures/odar-chars";

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
const SEED_VERSION = "4";
/** fetchedAt of the short version-2 snapshots (no stat lines), replaced by the full ones in version 3 */
const SHORT_SNAPSHOT = "2026-11-22T13:50:00Z";
/** Gender per character, kept separately so it stays even if the character is removed and added again */
const GENDER = "bm:gender";
const listeners = new Set<() => void>();
let cacheRaw: string | null = null;
let cache: SavedChar[] = [];

/** Portrait of a character: from its data, or the known one for the demo character (older saved copies lack it). */
export function portraitOf(c: { region: string; server: string; name: string; portrait?: string; snapshot?: Character }): string | undefined {
  if (c.portrait ?? c.snapshot?.portrait) return c.portrait ?? c.snapshot?.portrait;
  const known = [FLORENTINA, ...ODAR_CHARS].find((k) => charKey(k) === charKey(c));
  return known?.portrait;
}

export const charKey = (c: { region: string; server: string; name: string }) =>
  `${c.region.toLowerCase()}/${c.server.toLowerCase()}/${c.name.toLowerCase()}`;

function read(): SavedChar[] {
  if (typeof window === "undefined") return cache;
  const seeded = localStorage.getItem(SEEDED);
  if (seeded !== SEED_VERSION) {
    // Version 1 seeded Florentina only; version 2 added the five Odar characters as short data;
    // version 3 brings their full data; version 4 replaces any saved copy older than the built-in snapshot
    // (newer kisk data, e.g. Florentina 2026-11-22). Entries the user refreshed later or added are not touched.
    let list: SavedChar[] = seeded ? JSON.parse(localStorage.getItem(KEY) ?? "[]") : [];
    const seeds = seeded ? ODAR_CHARS : [FLORENTINA, ...ODAR_CHARS];
    list = list.map((x) => {
      const full = [FLORENTINA, ...ODAR_CHARS].find((s) => charKey(s) === charKey(x));
      const at = x.snapshot?.source.fetchedAt;
      return full && (at === SHORT_SNAPSHOT || !at || at < full.source.fetchedAt) ? { ...x, snapshot: full } : x;
    });
    for (const s of seeds) {
      if (!list.some((x) => charKey(x) === charKey(s))) list.push({ region: s.region, server: s.server, name: s.name, snapshot: s });
    }
    localStorage.setItem(KEY, JSON.stringify(list));
    localStorage.setItem(SEEDED, SEED_VERSION);
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

const NO_CHARS: SavedChar[] = [];

export function useCharacters() {
  const chars = useSyncExternalStore(
    (cb) => { listeners.add(cb); window.addEventListener("storage", cb); return () => { listeners.delete(cb); window.removeEventListener("storage", cb); }; },
    read,
    () => NO_CHARS,
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
