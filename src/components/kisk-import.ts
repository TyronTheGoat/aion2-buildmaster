"use client";
/**
 * "Zu BuildMaster senden": a bookmarklet the player clicks on the kisk.app character page they have open.
 * It packs that page (scripts and styles removed, gzip, base64url) into the link of BuildMaster, which reads it
 * with the same parser as the paste import. Afterwards the live server refreshes the gear through kisk's API (worker, every 30 minutes).
 * Fallback when the link loses its data (e.g. a login page in between): the opened window asks the kisk tab via postMessage.
 */
import { parseKiskGear } from "@/lib/kisk/parse";
import { extractPortrait, htmlToLines } from "@/lib/kisk/html-to-text";
import { charKey, hasChar, parseKiskLink, upsertChar } from "./store";
import { addBlocked } from "./cloud";

const PREFIX = "#kisk-import";

/** The bookmarklet for this site (javascript: URL). */
export function bookmarklet(origin: string): string {
  const o = JSON.stringify(origin);
  const code = `(async()=>{if(!/kisk\\.app$/.test(location.hostname)||!/\\/c\\//.test(location.pathname)){alert('Bitte auf einer kisk.app-Charakterseite ausführen.');return}`
    + `const d=document.documentElement.cloneNode(true);d.querySelectorAll('script,style,noscript,svg,template,link').forEach(e=>e.remove());`
    // only what the parser reads stays: picture sources and meta contents (keeps the link short on phones)
    + `d.querySelectorAll('*').forEach(e=>{for(const a of [...e.attributes])if(!/^(src|content|property)$/.test(a.name))e.removeAttribute(a.name)});`
    + `const b=new Uint8Array(await new Response(new Blob([d.outerHTML]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer());`
    + `let t='';for(let i=0;i<b.length;i+=32768)t+=String.fromCharCode.apply(null,b.subarray(i,i+32768));`
    + `const z=btoa(t).replace(/\\+/g,'-').replace(/\\//g,'_').replace(/=+$/,''),u=location.href,o=${o};`
    // same tab: a new window after the await would be blocked as a pop-up (iPhone Safari)
    + `location.href=o+'/${PREFIX}?u='+encodeURIComponent(u)+'&z='+z})()`;
  return `javascript:${encodeURIComponent(code)}`;
}

async function unpack(z: string): Promise<string> {
  const bin = atob(z.replace(/-/g, "+").replace(/_/g, "/"));
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"))).text();
}

/** Reads a sent kisk page into the character box; returns the character key. */
export async function importKiskPage(url: string, z: string): Promise<string> {
  const who = parseKiskLink(url);
  if (!who) throw new Error("Keine kisk.app-Charakterseite");
  const html = await unpack(z);
  const gearUrl = `https://kisk.app/c/${who.region}/${who.server}/${encodeURIComponent(who.name)}/gear`;
  const char = parseKiskGear(htmlToLines(html), { ...who, url: gearUrl, mode: "paste" });
  if (!char.gear.length && !char.arcana.length) throw new Error("Auf der Seite wurde keine Ausrüstung erkannt. Bitte die Gear-Seite des Charakters öffnen.");
  const blocked = hasChar(charKey(who)) ? undefined : addBlocked(charKey(who));
  if (blocked) throw new Error(blocked);
  const portrait = extractPortrait(html);
  upsertChar({ ...who, snapshot: { ...char, portrait: portrait ?? char.portrait } });
  return charKey(who);
}

/**
 * Called once at start: when the page was opened by the bookmarklet with the data in the link, imports it and
 * returns the character key (or an error text). Undefined when there is nothing to import.
 */
export async function takeKiskImport(): Promise<{ route?: string; error?: string } | undefined> {
  if (!location.hash.startsWith(PREFIX)) return undefined;
  const q = new URLSearchParams(location.hash.slice(PREFIX.length + 1));
  const url = q.get("u"), z = q.get("z");
  if (!url || !z) return { error: LOST };
  try { return { route: await importKiskPage(url, z) }; } catch (e) { return { error: (e as Error).message }; }
}
const LOST = "Keine Daten angekommen. Bitte das Lesezeichen auf der kisk-Seite noch einmal klicken.";

/**
 * Fallback when the link lost its data (a login page in between): a window opened from a kisk tab asks that tab,
 * which answers with the page. `onDone` gets the character key or an error text.
 */
export function listenKiskImport(onDone: (r: { route?: string; error?: string }) => void) {
  if (!window.opener) return;
  window.addEventListener("message", async (e) => {
    if (e.origin !== "https://kisk.app" || e.data?.type !== "bm-kisk") return;
    try { onDone({ route: await importKiskPage(String(e.data.url), String(e.data.z)) }); } catch (err) { onDone({ error: (err as Error).message }); }
  });
  try { window.opener.postMessage("bm-kisk-ready", "https://kisk.app"); } catch { /* opener gone */ }
}
