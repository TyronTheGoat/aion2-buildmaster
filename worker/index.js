// Cloudflare Worker: serves the single-file app (static assets) and a small API behind Cloudflare Access.
// - private data per account (the e-mail Cloudflare Access logged in): character box, crafting projects, stock
// - market prices shared by every account (anyone with access can change them)
// Storage: SQLite-backed Durable Objects, one per account and one for the shared prices; no setup needed in the dashboard.
import { DurableObject } from "cloudflare:workers";

const USER_KEYS = new Set(["chars", "gender", "planned", "craft"]);
const MAX_DOC = 1_500_000;
const MAX_PRICE = 4_000;

export class Store extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.sql = ctx.storage.sql;
    this.sql.exec("CREATE TABLE IF NOT EXISTS kv (k TEXT PRIMARY KEY, v TEXT NOT NULL, by TEXT, at INTEGER NOT NULL)");
  }
  list() {
    return this.sql.exec("SELECT k, v, at FROM kv").toArray();
  }
  put(k, v, by) {
    const at = Date.now();
    this.sql.exec("INSERT INTO kv (k, v, by, at) VALUES (?, ?, ?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v, by = excluded.by, at = excluded.at", k, v, by, at);
    return at;
  }
  del(k) {
    this.sql.exec("DELETE FROM kv WHERE k = ?", k);
  }
  keys(prefix) {
    return this.sql.exec("SELECT k FROM kv WHERE k >= ? AND k < ?", prefix, prefix + "\uffff").toArray().map((r) => r.k);
  }
  get(k) {
    return this.sql.exec("SELECT v FROM kv WHERE k = ?", k).toArray()[0]?.v ?? null;
  }
  putMany(entries, by) {
    const at = Date.now();
    for (const [k, v] of entries) this.sql.exec("INSERT INTO kv (k, v, by, at) VALUES (?, ?, ?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v, by = excluded.by, at = excluded.at", k, v, by, at);
    return at;
  }
}

const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });

/* ---------------------------------------------------------------- Cloudflare Access identity ---------------------------------------------------------------- */

let jwks; // cached keys of the Access team
async function verifyAccessJwt(token, env) {
  const [h, p, s] = token.split(".");
  if (!h || !p || !s) return null;
  const dec = (x) => Uint8Array.from(atob(x.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));
  const header = JSON.parse(new TextDecoder().decode(dec(h)));
  const payload = JSON.parse(new TextDecoder().decode(dec(p)));
  if (!jwks) jwks = (await (await fetch(`https://${env.ACCESS_TEAM_DOMAIN}/cdn-cgi/access/certs`)).json()).keys;
  const jwk = jwks.find((k) => k.kid === header.kid);
  if (!jwk) { jwks = undefined; return null; }
  const key = await crypto.subtle.importKey("jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
  const ok = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, dec(s), new TextEncoder().encode(`${h}.${p}`));
  const aud = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  if (!ok || !aud.includes(env.ACCESS_AUD) || payload.exp * 1000 < Date.now()) return null;
  return payload;
}

const b64json = (part) => JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(part.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0))));

/**
 * Who is calling: a person (the e-mail Cloudflare Access logged in) or a service token (Access "Service Auth" policy, no e-mail).
 * With ACCESS_TEAM_DOMAIN and ACCESS_AUD set, the Access token is checked as well.
 */
async function identity(req, env) {
  const token = req.headers.get("cf-access-jwt-assertion");
  let payload = null;
  if (env.ACCESS_TEAM_DOMAIN && env.ACCESS_AUD) {
    payload = token ? await verifyAccessJwt(token, env).catch(() => null) : null;
    if (!payload) return null;
  } else if (token) {
    try { payload = b64json(token.split(".")[1]); } catch { payload = null; }
  }
  const email = payload?.email ?? req.headers.get("cf-access-authenticated-user-email");
  if (email) return { id: email.toLowerCase(), service: false };
  if (payload?.common_name) return { id: `service:${payload.common_name}`, service: true };
  return null;
}

/* ---------------------------------------------------------------- API ---------------------------------------------------------------- */

const okNum = (v) => v === null || v === undefined || (typeof v === "number" && Number.isFinite(v) && v >= 0);
function validPrice(p) {
  return p && typeof p === "object" && typeof p.name === "string" && p.name.length < 200 && okNum(p.low) && okNum(p.high) && okNum(p.ref)
    && (p.low == null || p.high == null || p.low <= p.high) && !p.suggested;
}

async function api(req, env, url) {
  const who = await identity(req, env);
  if (!who) return json({ error: "nicht angemeldet" }, 401);
  const email = who.id;
  // a service token may only maintain shared data (icon pack, market prices), never an account's characters or projects
  if (who.service && !/^\/api\/(me|icons?|prices)(\/|$)/.test(url.pathname)) return json({ error: "nur für Personen-Logins" }, 403);
  // writes need our own header: a plain cross-site form or fetch cannot send it without a CORS preflight we never allow
  if (req.method !== "GET" && req.headers.get("x-bm") !== "1") return json({ error: "forbidden" }, 403);
  const path = url.pathname.replace(/\/+$/, "");
  const user = () => env.STORE.get(env.STORE.idFromName(`user:${email}`));
  const prices = () => env.STORE.get(env.STORE.idFromName("prices"));

  if (path === "/api/me") return json({ email: who.service ? null : email, service: who.service || undefined });

  // original item icons, uploaded once as an icon pack (kept out of the repo); shared by all accounts
  const icons = () => env.STORE.get(env.STORE.idFromName("icons"));
  if (path === "/api/icons" && req.method === "GET") {
    const store = icons();
    const [files, alias] = await Promise.all([store.keys("f:"), store.get("alias")]);
    return json({ files: files.map((k) => k.slice(2)), alias: alias ? JSON.parse(alias) : {} });
  }
  if (path === "/api/icons" && req.method === "PUT") {
    const text = await req.text();
    if (text.length > 2_000_000) return json({ error: "zu groß" }, 413);
    let body;
    try { body = JSON.parse(text); } catch { return json({ error: "kein JSON" }, 400); }
    const entries = [];
    for (const [name, data] of Object.entries(body.files ?? {})) {
      if (!/^[\w.-]{1,120}$/.test(name) || typeof data !== "string" || !/^data:image\/(webp|png|jpeg);base64,[A-Za-z0-9+/=]+$/.test(data) || data.length > 300_000) return json({ error: `ungültiges Icon ${name}` }, 400);
      entries.push([`f:${name}`, data]);
    }
    if (body.alias) {
      if (typeof body.alias !== "object" || JSON.stringify(body.alias).length > 500_000) return json({ error: "ungültige Namen" }, 400);
      const old = await icons().get("alias");
      entries.push(["alias", JSON.stringify({ ...(old ? JSON.parse(old) : {}), ...body.alias })]);
    }
    return json({ at: await icons().putMany(entries, email), count: entries.length });
  }
  const icon = path.match(/^\/api\/icon\/([\w.-]{1,120})$/);
  if (icon && req.method === "GET") {
    const data = await icons().get(`f:${icon[1]}`);
    if (!data) return new Response("not found", { status: 404 });
    const [, mime, b64] = data.match(/^data:([^;]+);base64,(.*)$/);
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    return new Response(bytes, { headers: { "content-type": mime, "cache-control": "private, max-age=604800" } });
  }

  if (path === "/api/user" && req.method === "GET") {
    const rows = await user().list();
    return json({ docs: Object.fromEntries(rows.map((r) => [r.k, JSON.parse(r.v)])), at: Object.fromEntries(rows.map((r) => [r.k, r.at])) });
  }
  const doc = path.match(/^\/api\/user\/([a-z]+)$/);
  if (doc && req.method === "PUT") {
    if (!USER_KEYS.has(doc[1])) return json({ error: "unbekannter Schlüssel" }, 400);
    const text = await req.text();
    if (text.length > MAX_DOC) return json({ error: "zu groß" }, 413);
    try { JSON.parse(text); } catch { return json({ error: "kein JSON" }, 400); }
    return json({ at: await user().put(doc[1], text, email) });
  }

  if (path === "/api/prices" && req.method === "GET") {
    const rows = await prices().list();
    return json({ prices: rows.map((r) => ({ k: r.k, p: JSON.parse(r.v), at: r.at })) });
  }
  if (path === "/api/prices" && req.method === "PUT") {
    const text = await req.text();
    if (text.length > MAX_PRICE) return json({ error: "zu groß" }, 413);
    let body;
    try { body = JSON.parse(text); } catch { return json({ error: "kein JSON" }, 400); }
    if (typeof body.k !== "string" || body.k.length > 300 || !validPrice(body.p)) return json({ error: "ungültiger Preis" }, 400);
    return json({ at: await prices().put(body.k, JSON.stringify(body.p), email) });
  }
  if (path === "/api/prices" && req.method === "DELETE") {
    const k = url.searchParams.get("k");
    if (!k || k.length > 300) return json({ error: "Schlüssel fehlt" }, 400);
    await prices().del(k);
    return json({ ok: true });
  }
  return json({ error: "not found" }, 404);
}

const worker = {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (url.pathname.startsWith("/api/")) {
      try { return await api(req, env, url); } catch (e) { return json({ error: String(e?.message ?? e) }, 500); }
    }
    return env.ASSETS.fetch(req);
  },
};
export default worker;
