import "server-only";
import { cacheLife } from "next/cache";
import type { Character } from "../types";
import { extractPortrait, htmlToLines } from "./html-to-text";
import { parseKiskGear } from "./parse";

export const KISK_BASE = "https://kisk.app";

export function kiskUrl(region: string, server: string, name: string, sub = "gear") {
  const seg = (s: string) => encodeURIComponent(s.trim());
  return `${KISK_BASE}/c/${seg(region.toLowerCase())}/${seg(server.toLowerCase())}/${seg(name)}${sub ? `/${sub}` : ""}`;
}

/**
 * Loads a character from kisk.app. Cached for 30 minutes per character,
 * so we stay well within kisk's "don't flood" rule.
 */
export async function loadFromKisk(region: string, server: string, name: string): Promise<Character> {
  const url = kiskUrl(region, server, name);
  const { status, html } = await fetchKiskHtml(url);
  if (status === 404) throw new KiskError("Charakter auf kisk.app nicht gefunden.", 404);
  if (status !== 200) throw new KiskError(`kisk.app antwortet mit ${status}.`, status);
  return { ...parseKiskGear(htmlToLines(html), { region, server, name, url, mode: "live" }), portrait: extractPortrait(html) };
}

export class KiskError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

/** One request per character per 30 minutes at most. */
async function fetchKiskHtml(url: string): Promise<{ status: number; html: string }> {
  "use cache";
  cacheLife({ stale: 300, revalidate: 1800, expire: 86400 });
  const res = await fetch(url, {
    headers: { "User-Agent": "Aion2-BuildMaster/0.1 (+personal build tracker; data from kisk.app)", Accept: "text/html" },
  });
  return { status: res.status, html: res.ok ? await res.text() : "" };
}
