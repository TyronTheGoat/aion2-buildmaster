"use client";
/**
 * Online storage on the live site (Cloudflare Worker behind Cloudflare Access, see worker/index.js).
 * The app keeps working on localStorage as before; this module mirrors it:
 * - private per account: character box, gender, planned items, skill levels, skill planner, builds, favourites
 * - shared by all accounts: the newest kisk data of every character (a refresh by anyone updates the character for everybody)
 * Without the API (offline file, dev server) nothing changes.
 */
import { useSyncExternalStore } from "react";
import { CHARS_KEY, GENDER_KEY, SEEDED_KEY, SEED_VERSION, SHARED_CHARS_KEY, charKey, newer, type SavedChar } from "./store";
import type { Character } from "@/lib/types";
import { SKILLS_KEY } from "./skill-store";

const PLANNED_KEY = "bm:planned";
/** localStorage key → document name on the server */
const DOCS: Record<string, string> = { [CHARS_KEY]: "chars", [GENDER_KEY]: "gender", [PLANNED_KEY]: "planned", [SKILLS_KEY]: "skills", "bm:skillplan": "skillplan", "bm:builds": "builds", "bm:build-active": "buildactive", "bm:favorites": "favorites", "bm:intro": "intro" };

export type CloudStatus = { mode: "offline" } | { mode: "online"; email: string; error?: string };
let status: CloudStatus = { mode: "offline" };
const listeners = new Set<() => void>();
const setStatus = (s: CloudStatus) => { status = s; listeners.forEach((l) => l()); };
export const useCloud = () => useSyncExternalStore((cb) => { listeners.add(cb); return () => listeners.delete(cb); }, () => status, () => status);

let origSet: (k: string, v: string) => void = () => {};
const timers = new Map<string, ReturnType<typeof setTimeout>>();

async function call(method: string, path: string, body?: unknown) {
  const res = await fetch(path, {
    method, credentials: "same-origin", cache: "no-store",
    headers: body === undefined ? { "x-bm": "1" } : { "x-bm": "1", "content-type": "application/json" },
    body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
}

function notify(key: string) {
  window.dispatchEvent(new StorageEvent("storage", { key }));
}

/** Sends one changed document (debounced). */
function schedule(key: string) {
  clearTimeout(timers.get(key));
  timers.set(key, setTimeout(async () => {
    timers.delete(key);
    try {
      const raw = localStorage.getItem(key);
      await call("PUT", `/api/user/${DOCS[key]}`, raw ?? "null");
      if (status.mode === "online" && status.error) setStatus({ mode: "online", email: status.email });
    } catch (e) {
      if (status.mode === "online") setStatus({ ...status, error: String((e as Error).message ?? e) });
    }
  }, 800));
}

/* ---------------------------------------------------------------- shared character data ---------------------------------------------------------------- */

let sharedChars: Record<string, Character> = {};
/** characters this account added for everybody, and how many it may add (null: no limit) */
const sharedMine = new Set<string>();
let sharedLimit: number | null = 10;
const isNewer = newer;
const writeShared = () => origSet(SHARED_CHARS_KEY, JSON.stringify({ chars: sharedChars, mine: [...sharedMine], limit: sharedLimit }));

/** Sends every character of the list whose data is newer than the shared one (real kisk data only, never the demo data). */
function shareChars(list: SavedChar[]) {
  for (const c of list) {
    const snap = c.snapshot;
    if (!snap || snap.source.mode === "demo" || !snap.gear) continue;
    const k = charKey(snap);
    if (!isNewer(snap, sharedChars[k])) continue;
    const isNew = !sharedChars[k];
    if (isNew && sharedLimit !== null && sharedMine.size >= sharedLimit) continue;
    sharedChars = { ...sharedChars, [k]: snap };
    if (isNew) sharedMine.add(k);
    call("PUT", "/api/chars", { k, c: snap }).catch(() => { /* next time */ });
  }
  writeShared();
}

async function pullChars() {
  try {
    const r = await call("GET", "/api/chars") as { chars: { k: string; c: Character; mine?: boolean }[]; limit: number | null };
    for (const { k, c, mine } of r.chars) { if (isNewer(c, sharedChars[k])) sharedChars[k] = c; if (mine) sharedMine.add(k); }
    sharedLimit = r.limit;
  } catch { /* stays as it is */ }
}

/** The admin (no character limit): only they see the BiS bookmark tool. */
export const isAdminAccount = () => status.mode === "online" && sharedLimit === null;

/** Online: why this character cannot be added (limit of characters per account reached), else undefined. */
export function addBlocked(key: string): string | undefined {
  if (status.mode !== "online" || sharedChars[key] || sharedLimit === null || sharedMine.size < sharedLimit) return undefined;
  return `Du kannst höchstens ${sharedLimit} Charaktere für alle hinzufügen. Entferne erst einen, den du hinzugefügt hast.`;
}

/** Takes a character out for everybody (only the account that added it). Returns an error text when not allowed. */
export async function removeShared(key: string): Promise<string | undefined> {
  if (status.mode !== "online" || !sharedChars[key]) return undefined;
  if (!sharedMine.has(key) && sharedLimit !== null) return "Diesen Charakter hat jemand anderes für alle hinzugefügt, du kannst ihn nicht entfernen.";
  try { await call("DELETE", `/api/chars?k=${encodeURIComponent(key)}`); } catch (e) { return `Entfernen fehlgeschlagen (${(e as Error).message}).`; }
  const rest = { ...sharedChars }; delete rest[key];
  sharedChars = rest; sharedMine.delete(key);
  writeShared(); notify(SHARED_CHARS_KEY);
  return undefined;
}

/**
 * Called once before the app renders. Online: loads the account's data into localStorage,
 * then mirrors every later change. Returns the status.
 */
export async function initCloud(): Promise<CloudStatus> {
  if (typeof window === "undefined" || !/^https?:$/.test(location.protocol)) return status;
  let email: string;
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 5000);
    const res = await fetch("/api/me", { credentials: "same-origin", cache: "no-store", signal: ctl.signal });
    clearTimeout(t);
    if (!res.ok || !(res.headers.get("content-type") ?? "").includes("json")) return status;
    email = (await res.json()).email;
    if (!email) return status;
  } catch { return status; }

  try {
    const { docs } = await call("GET", "/api/user") as { docs: Record<string, unknown> };
    const first = !Object.keys(docs).length;
    localStorage.setItem(SEEDED_KEY, SEED_VERSION);
    // shared kisk data: newer data from others replaces the own copy, own newer data goes out to everybody
    await pullChars();
    const own = ((docs.chars ?? []) as SavedChar[]).map((c) => {
      const s = sharedChars[charKey(c)];
      return isNewer(s, c.snapshot) ? { ...c, snapshot: s } : c;
    });
    localStorage.setItem(CHARS_KEY, JSON.stringify(own));
    origSet = (k, v) => Storage.prototype.setItem.call(localStorage, k, v);
    shareChars(own);
    localStorage.setItem(GENDER_KEY, JSON.stringify(docs.gender ?? {}));
    localStorage.setItem(PLANNED_KEY, JSON.stringify(docs.planned ?? {}));
    localStorage.setItem(SKILLS_KEY, JSON.stringify(docs.skills ?? {}));
    localStorage.setItem("bm:skillplan", JSON.stringify(docs.skillplan ?? {}));
    // saved skill planner builds and the chosen target (live since 2026-11-24)
    localStorage.setItem("bm:builds", JSON.stringify(docs.builds ?? {}));
    localStorage.setItem("bm:build-active", JSON.stringify(docs.buildactive ?? {}));
    // favourite characters and whether the intro was seen, per login
    localStorage.setItem("bm:favorites", JSON.stringify(docs.favorites ?? []));
    if (docs.intro) localStorage.setItem("bm:intro", JSON.stringify(docs.intro));
    localStorage.setItem("bm:cloud:owner", email);
    setStatus({ mode: "online", email });
    if (first) for (const k of Object.keys(DOCS)) schedule(k);
  } catch (e) {
    // the API answered /me but not the data: stay on this device, say so
    setStatus({ mode: "online", email, error: String((e as Error).message ?? e) });
    return status;
  }

  await loadIcons();

  // mirror every later write of the app
  const proto = Storage.prototype;
  const native = proto.setItem;
  origSet = (k, v) => native.call(localStorage, k, v);
  proto.setItem = function (this: Storage, k: string, v: string) {
    native.call(this, k, v);
    if (this === localStorage && DOCS[k]) schedule(k);
    if (this === localStorage && k === CHARS_KEY) { try { shareChars(JSON.parse(v)); } catch { /* not a list */ } }
  };
  const refreshChars = async () => { const before = JSON.stringify(sharedChars); await pullChars(); if (JSON.stringify(sharedChars) !== before) { writeShared(); notify(SHARED_CHARS_KEY); } };
  setInterval(() => { void refreshChars(); }, 60_000);
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") void refreshChars(); });
  return status;
}

/* ---------------------------------------------------------------- original icons (icon pack on the server) ---------------------------------------------------------------- */

/** Points every icon name the server has to its address, so the app shows the uploaded originals. */
async function loadIcons() {
  try {
    const { files, alias } = await call("GET", "/api/icons") as { files: string[]; alias: Record<string, string> };
    const map = (globalThis.__BM_ICONS__ ??= {});
    const have = new Set(files);
    for (const f of files) map[f] ??= `/api/icon/${encodeURIComponent(f)}`;
    for (const [name, f] of Object.entries(alias)) if (have.has(f)) map[name] ??= `/api/icon/${encodeURIComponent(f)}`;
  } catch { /* no icons yet */ }
}

/** Uploads an icon pack (scripts/make-icon-pack.mjs) in parts; reports progress 0..1. */
export async function uploadIconPack(text: string, onProgress: (done: number) => void) {
  const pack = JSON.parse(text) as { kind?: string; files?: Record<string, string>; alias?: Record<string, string> };
  if (pack.kind !== "buildmaster-icons" || !pack.files) throw new Error("keine BuildMaster-Icon-Datei");
  const entries = Object.entries(pack.files);
  let batch: Record<string, string> = {}, size = 0, sent = 0, first = true;
  const flush = async () => {
    await call("PUT", "/api/icons", { files: batch, ...(first ? { alias: pack.alias ?? {} } : {}) });
    first = false; sent += Object.keys(batch).length; batch = {}; size = 0;
    onProgress(sent / entries.length);
  };
  for (const [name, data] of entries) {
    if (size + data.length > 1_500_000) await flush();
    batch[name] = data; size += data.length;
  }
  if (Object.keys(batch).length || first) await flush();
  return entries.length;
}
