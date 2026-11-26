/**
 * Official AION 2 patch notes (Europe / Global), as NCSOFT posts them on Steam in BBCode (Tyron 2026-11-26).
 * Turned into simple blocks the app renders itself (no HTML from outside).
 */
export type PatchBlock =
  | { t: "h"; level: 1 | 2 | 3; text: string }
  | { t: "p"; text: string }
  | { t: "li"; depth: number; text: string }
  | { t: "table"; rows: { head: boolean; cells: string[] }[]; cls?: string }
  | { t: "img"; src: string };

export interface PatchNote { id: string; title: string; date: number; url: string; body: string }

const TAG = /(?<!\\)\[(\/?)(h1|h2|h3|p|list|olist|\*|table|tr|th|td|b|u|i|s|strike|img|url|hr|quote|code|spoiler)((?:\s[^\]]*|=[^\]]*)?)\]/gi;

/** Plain text: escaped brackets back, zero-width characters and surplus spaces out. */
const clean = (s: string) => s.replace(/\\\[/g, "[").replace(/\\\]/g, "]").replace(/[​‌‍﻿]/g, "")
  .replace(/&nbsp;/g, " ").replace(/[ \t]+/g, " ").replace(/ *\n */g, "\n").trim();

export function parsePatchNote(body: string): PatchBlock[] {
  const out: PatchBlock[] = [];
  let text = "";
  let depth = 0;
  let table: { rows: { head: boolean; cells: string[] }[] } | undefined;
  let row: { head: boolean; cells: string[] } | undefined;
  let cell: string | undefined;
  let heading: 1 | 2 | 3 | undefined;
  let lastHeading = "";

  const flush = () => {
    const s = clean(text);
    text = "";
    if (!s) return;
    if (cell !== undefined) { cell += (cell ? "\n" : "") + s; return; }
    if (heading) { out.push({ t: "h", level: heading, text: s }); lastHeading = s; return; }
    if (depth > 0) { out.push({ t: "li", depth, text: s }); return; }
    out.push({ t: "p", text: s });
  };

  let at = 0;
  for (const m of body.matchAll(TAG)) {
    text += body.slice(at, m.index);
    at = m.index! + m[0].length;
    const close = m[1] === "/";
    const tag = m[2].toLowerCase();
    const attr = m[3] ?? "";
    switch (tag) {
      case "b": case "u": case "i": case "s": case "strike": case "url": case "spoiler": case "quote": case "code":
        break;
      case "img": {
        if (close) break;
        flush();
        const src = attr.match(/src="([^"]+)"/)?.[1] ?? attr.match(/^=(\S+)/)?.[1];
        if (src && /^https:\/\//.test(src)) out.push({ t: "img", src });
        break;
      }
      case "h1": case "h2": case "h3":
        flush();
        heading = close ? undefined : (Number(tag[1]) as 1 | 2 | 3);
        break;
      case "p":
        if (cell !== undefined) { if (close) text += "\n"; break; }
        flush();
        break;
      case "list": case "olist":
        flush();
        depth = Math.max(0, depth + (close ? -1 : 1));
        break;
      case "*": case "hr":
        flush();
        break;
      case "table":
        flush();
        if (close) {
          if (table?.rows.length) {
            const cls = /^(gladiator|templar|assassin|ranger|sorcerer|spiritmaster|cleric|chanter)$/i.test(lastHeading) ? lastHeading : undefined;
            out.push({ t: "table", rows: table.rows, ...(cls ? { cls } : {}) });
          }
          table = undefined;
        } else table = { rows: [] };
        break;
      case "tr":
        if (close) { if (row && table) table.rows.push(row); row = undefined; } else row = { head: false, cells: [] };
        break;
      case "th": case "td":
        if (close) {
          const s = clean(text); text = "";
          if (row) { row.cells.push(clean(`${cell ?? ""}${cell && s ? "\n" : ""}${s}`)); if (tag === "th") row.head = true; }
          cell = undefined;
        } else { text = ""; cell = ""; }
        break;
    }
  }
  text += body.slice(at);
  flush();
  return out;
}

/** The headings of the second level ("[Content & Systems]", "[Class]", ...) as a short preview of a note. */
export function noteTopics(blocks: PatchBlock[]): string[] {
  const heads = blocks.filter((b): b is Extract<PatchBlock, { t: "h" }> => b.t === "h");
  const top = heads.some((b) => b.level === 1) ? 1 : 2;
  return [...new Set(heads.filter((b) => b.level === top).map((b) => b.text.replace(/^\[|\]$/g, "").trim()))].filter(Boolean);
}
