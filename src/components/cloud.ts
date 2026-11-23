"use client";
/**
 * Online storage on the live site (Cloudflare Worker behind Cloudflare Access, see worker/index.js).
 * The app keeps working on localStorage as before; this module mirrors it:
 * - private per account: character box, gender, planned items, crafting projects / stock / history
 * - shared by all accounts: market prices the players entered (built-in reference prices stay local suggestions)
 * Without the API (offline file, dev server) nothing changes.
 */
import { useSyncExternalStore } from "react";
import { itemKey, type CraftState, type Price } from "@/lib/crafting/model";
import { CHARS_KEY, GENDER_KEY, SEEDED_KEY, SEED_VERSION } from "./store";

const CRAFT_KEY = "bm:craft:v1";
const PLANNED_KEY = "bm:planned";
/** localStorage key → document name on the server */
const DOCS: Record<string, string> = { [CHARS_KEY]: "chars", [GENDER_KEY]: "gender", [PLANNED_KEY]: "planned", [CRAFT_KEY]: "craft" };
/** Parts of the crafting data that belong to the player; recipes, chains etc. come from the built-in package. */
const CRAFT_USER = ["inventory", "projects", "events", "overrides", "catalogExtra"] as const;

export type CloudStatus = { mode: "offline" } | { mode: "online"; email: string; error?: string };
let status: CloudStatus = { mode: "offline" };
const listeners = new Set<() => void>();
const setStatus = (s: CloudStatus) => { status = s; listeners.forEach((l) => l()); };
export const useCloud = () => useSyncExternalStore((cb) => { listeners.add(cb); return () => listeners.delete(cb); }, () => status, () => status);

const priceKey = (p: Price) => `${itemKey(p)}|${(p.server ?? "").toLowerCase()}`;
/** Prices the players entered themselves (shared), as opposed to built-in suggestions. */
const ownPrices = (s: Partial<CraftState>) => (s.prices ?? []).filter((p) => !p.suggested);

let origSet: (k: string, v: string) => void = () => {};
/** last state of the shared prices as the server has it: key → JSON */
let synced = new Map<string, string>();
const timers = new Map<string, ReturnType<typeof setTimeout>>();
let pending = 0;

async function call(method: string, path: string, body?: unknown) {
  const res = await fetch(path, {
    method, credentials: "same-origin", cache: "no-store",
    headers: body === undefined ? { "x-bm": "1" } : { "x-bm": "1", "content-type": "application/json" },
    body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
}

const userCraft = (raw: string | null) => {
  const s: Partial<CraftState> = raw ? JSON.parse(raw) : {};
  return Object.fromEntries(CRAFT_USER.map((k) => [k, s[k]]).filter(([, v]) => v !== undefined));
};

/** The local crafting data with the account's own part and the shared prices put in. */
function mergeCraft(raw: string | null, mine: Record<string, unknown> | undefined, shared: Price[]): string {
  const s: Record<string, unknown> = raw ? JSON.parse(raw) : {};
  for (const k of CRAFT_USER) delete s[k];
  Object.assign(s, mine ?? {});
  const sharedKeys = new Set(shared.map(priceKey));
  const suggestions = ((s.prices as Price[] | undefined) ?? []).filter((p) => p.suggested && !sharedKeys.has(priceKey(p)));
  s.prices = [...suggestions, ...shared];
  return JSON.stringify(s);
}

function notify(key: string) {
  window.dispatchEvent(new StorageEvent("storage", { key }));
}

/** Sends one changed document (debounced); for the crafting data also the changed shared prices. */
function schedule(key: string) {
  clearTimeout(timers.get(key));
  pending++;
  timers.set(key, setTimeout(async () => {
    timers.delete(key);
    try {
      const raw = localStorage.getItem(key);
      if (key === CRAFT_KEY) {
        await call("PUT", "/api/user/craft", userCraft(raw));
        const now = new Map(ownPrices(raw ? JSON.parse(raw) : {}).map((p) => [priceKey(p), JSON.stringify(p)] as const));
        for (const [k, v] of now) if (synced.get(k) !== v) { await call("PUT", "/api/prices", `{"k":${JSON.stringify(k)},"p":${v}}`); synced.set(k, v); }
        for (const k of [...synced.keys()]) if (!now.has(k)) { await call("DELETE", `/api/prices?k=${encodeURIComponent(k)}`); synced.delete(k); }
      } else {
        await call("PUT", `/api/user/${DOCS[key]}`, raw ?? "null");
      }
      if (status.mode === "online" && status.error) setStatus({ mode: "online", email: status.email });
    } catch (e) {
      if (status.mode === "online") setStatus({ ...status, error: String((e as Error).message ?? e) });
    } finally { pending--; }
  }, 800));
}

/** Pulls the shared prices (others may have changed them) unless own changes are still on the way. */
async function pullPrices() {
  if (pending > 0 || status.mode !== "online") return;
  try {
    const { prices } = await call("GET", "/api/prices") as { prices: { k: string; p: Price }[] };
    if (pending > 0) return;
    const next = new Map(prices.map((x) => [x.k, JSON.stringify(x.p)] as const));
    const same = next.size === synced.size && [...next].every(([k, v]) => synced.get(k) === v);
    if (same) return;
    synced = next;
    const raw = localStorage.getItem(CRAFT_KEY);
    origSet(CRAFT_KEY, mergeCraft(raw, userCraft(raw), prices.map((x) => x.p)));
    notify(CRAFT_KEY);
  } catch { /* next try later */ }
}

/**
 * Called once before the app renders. Online: loads the account's data and the shared prices into localStorage,
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

  const owner = localStorage.getItem("bm:cloud:owner");
  try {
    const [{ docs }, { prices }] = await Promise.all([
      call("GET", "/api/user") as Promise<{ docs: Record<string, unknown> }>,
      call("GET", "/api/prices") as Promise<{ prices: { k: string; p: Price }[] }>,
    ]);
    const first = !Object.keys(docs).length;
    const localCraft = localStorage.getItem(CRAFT_KEY);
    // first login of this account: projects and own prices made on this device before go along; the character box starts empty
    const mine = (docs.craft as Record<string, unknown> | undefined) ?? (first && owner !== email ? userCraft(localCraft) : {});
    const localOwn = first && owner !== email ? ownPrices(localCraft ? JSON.parse(localCraft) : {}) : [];
    synced = new Map(prices.map((x) => [x.k, JSON.stringify(x.p)] as const));
    const shared = [...prices.map((x) => x.p), ...localOwn.filter((p) => !synced.has(priceKey(p)))];
    localStorage.setItem(SEEDED_KEY, SEED_VERSION);
    localStorage.setItem(CHARS_KEY, JSON.stringify(docs.chars ?? []));
    localStorage.setItem(GENDER_KEY, JSON.stringify(docs.gender ?? {}));
    localStorage.setItem(PLANNED_KEY, JSON.stringify(docs.planned ?? {}));
    localStorage.setItem(CRAFT_KEY, mergeCraft(localCraft, mine, shared));
    localStorage.setItem("bm:cloud:owner", email);
    setStatus({ mode: "online", email });
    if (first) for (const k of Object.keys(DOCS)) schedule(k);
    else if (localOwn.length) schedule(CRAFT_KEY);
  } catch (e) {
    // the API answered /me but not the data: stay on this device, say so
    setStatus({ mode: "online", email, error: String((e as Error).message ?? e) });
    return status;
  }

  // mirror every later write of the app
  const proto = Storage.prototype;
  const native = proto.setItem;
  origSet = (k, v) => native.call(localStorage, k, v);
  proto.setItem = function (this: Storage, k: string, v: string) {
    native.call(this, k, v);
    if (this === localStorage && DOCS[k]) schedule(k);
  };
  setInterval(() => void pullPrices(), 60_000);
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") void pullPrices(); });
  return status;
}
