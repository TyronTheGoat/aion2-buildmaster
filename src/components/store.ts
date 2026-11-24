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
  /** test character every account has (Tyron, 2026-11-23); cannot be removed */
  builtin?: boolean;
  /** added by someone for everybody (live site), not stored in this box */
  shared?: boolean;
}

/** The test characters from the start (Florentina, ASNA, WRVITH, Creapure, Healga, TestoSpritze): in every box, view only. */
export const BUILTIN_CHARS: SavedChar[] = [FLORENTINA, ...ODAR_CHARS].map((c) => ({ region: c.region, server: c.server, name: c.name, snapshot: c, builtin: true }));

const KEY = "bm:chars";
const SEEDED = "bm:seeded";
export const SEED_VERSION = "5";
export const SEEDED_KEY = SEEDED;
export const CHARS_KEY = KEY;
export const GENDER_KEY = "bm:gender";
/** Newest kisk data per character shared by all accounts on the live site (charKey → snapshot), see cloud.ts */
export const SHARED_CHARS_KEY = "bm:shared-chars";
// same data time but now with the guild (filled in by the server later) counts as newer too
const newer = (a?: Character, b?: Character) => !!a && (!b || a.source.fetchedAt > b.source.fetchedAt || (a.source.fetchedAt === b.source.fetchedAt && !!a.legion && !b.legion));
/** fetchedAt of the short version-2 snapshots (no stat lines), replaced by the full ones in version 3 */
const SHORT_SNAPSHOT = "2026-11-22T13:50:00Z";
/** Gender per character, kept separately so it stays even if the character is removed and added again */
const GENDER = GENDER_KEY;
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
    // A new box starts empty: everyone adds their own characters.
    // Boxes that got the demo characters earlier (versions 1-3) keep them; older saved copies get the newer built-in snapshot.
    let list: SavedChar[] = seeded ? JSON.parse(localStorage.getItem(KEY) ?? "[]") : [];
    list = list.map((x) => {
      const full = [FLORENTINA, ...ODAR_CHARS].find((s) => charKey(s) === charKey(x));
      const at = x.snapshot?.source.fetchedAt;
      return full && at && (at === SHORT_SNAPSHOT || at < full.source.fetchedAt) && x.snapshot?.source.mode === "demo" ? { ...x, snapshot: full } : x;
    });
    localStorage.setItem(KEY, JSON.stringify(list));
    localStorage.setItem(SEEDED, SEED_VERSION);
  }
  const raw = (localStorage.getItem(KEY) ?? "[]") + (localStorage.getItem(GENDER) ?? "") + (localStorage.getItem(SHARED_CHARS_KEY) ?? "");
  if (raw !== cacheRaw) {
    cacheRaw = raw;
    const genders: Record<string, "f" | "m"> = JSON.parse(localStorage.getItem(GENDER) ?? "{}");
    const own = JSON.parse(localStorage.getItem(KEY) ?? "[]") as SavedChar[];
    // the test characters are always there; a refreshed copy in the box (newer snapshot) wins
    const all = [...own.map((c) => (BUILTIN_CHARS.some((b) => charKey(b) === charKey(c)) ? { ...c, builtin: true } : c)),
      ...BUILTIN_CHARS.filter((b) => !own.some((c) => charKey(c) === charKey(b)))];
    // characters someone added for everybody, and the newest data of each (whoever refreshed it last)
    let shared: Record<string, Character> = {};
    try { shared = JSON.parse(localStorage.getItem(SHARED_CHARS_KEY) ?? "{}").chars ?? {}; } catch { /* broken */ }
    for (const [k, snap] of Object.entries(shared)) {
      if (!all.some((c) => charKey(c) === k)) all.push({ region: snap.region, server: snap.server, name: snap.name, snapshot: snap, shared: true });
    }
    cache = all.map((c) => {
      const s = shared[charKey(c)];
      return { ...c, snapshot: newer(s, c.snapshot) ? s : c.snapshot, gender: c.gender ?? genders[charKey(c)] };
    });
  }
  return cache;
}

function write(list: SavedChar[]) {
  const genders: Record<string, "f" | "m"> = JSON.parse(localStorage.getItem(GENDER) ?? "{}");
  for (const c of list) if (c.gender) genders[charKey(c)] = c.gender;
  localStorage.setItem(GENDER, JSON.stringify(genders));
  // test characters stay built in: only a refreshed copy (newer data than the built-in one) is stored
  let shared: Record<string, Character> = {};
  try { shared = JSON.parse(localStorage.getItem(SHARED_CHARS_KEY) ?? "{}").chars ?? {}; } catch { /* broken */ }
  const keep = list.filter((c) => !c.builtin || c.snapshot !== BUILTIN_CHARS.find((b) => charKey(b) === charKey(c))?.snapshot)
    // a character of everybody is only stored here once this box has newer data of it
    .filter((c) => !c.shared || c.snapshot !== shared[charKey(c)])
    .map((c) => { const x = { ...c }; delete x.builtin; delete x.shared; return x; });
  localStorage.setItem(KEY, JSON.stringify(keep));
  listeners.forEach((l) => l());
}

const NO_CHARS: SavedChar[] = [];

/** Is the character already in the box (own, built in or shared)? */
export const hasChar = (key: string) => read().some((x) => charKey(x) === key);

/** Adds or updates a character in the box (outside React, e.g. the kisk import). */
export function upsertChar(c: SavedChar) {
  const list = read();
  const i = list.findIndex((x) => charKey(x) === charKey(c));
  write(i >= 0 ? list.map((x, j) => (j === i ? { ...x, ...c, snapshot: c.snapshot ?? x.snapshot } : x)) : [...list, c]);
}

export function useCharacters() {
  const chars = useSyncExternalStore(
    (cb) => { listeners.add(cb); window.addEventListener("storage", cb); return () => { listeners.delete(cb); window.removeEventListener("storage", cb); }; },
    read,
    () => NO_CHARS,
  );
  return {
    chars,
    upsert: upsertChar,
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
