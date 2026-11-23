/** Small CSV reader: UTF-8 BOM, quoted fields, "" escapes, comma or semicolon separator, CRLF. */
export function parseCsv(text: string): { header: string[]; rows: Record<string, string>[] } {
  const src = text.replace(/^﻿/, "");
  const firstLine = src.slice(0, src.search(/\r?\n|$/));
  const sep = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ";" : ",";
  const records: string[][] = [];
  let field = "", rec: string[] = [], quoted = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') { field += '"'; i++; } else quoted = false;
      } else field += ch;
    } else if (ch === '"' && field === "") quoted = true;
    else if (ch === sep) { rec.push(field); field = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      rec.push(field); field = "";
      if (rec.some((f) => f.trim() !== "")) records.push(rec);
      rec = [];
    } else field += ch;
  }
  rec.push(field);
  if (rec.some((f) => f.trim() !== "")) records.push(rec);
  const header = (records.shift() ?? []).map((h) => h.trim().toLowerCase());
  const rows = records.map((r) => Object.fromEntries(header.map((h, i) => [h, (r[i] ?? "").trim()])));
  return { header, rows };
}

const UNKNOWN = new Set(["", "unknown", "unbekannt", "null", "n/a", "na", "-", "?", "tbd"]);

export const isUnknown = (v: string | undefined) => v === undefined || UNKNOWN.has(v.trim().toLowerCase());

/** Number with a decimal point (a lone decimal comma is accepted too); unknown → null; garbage → error. */
export function readNumber(v: string | undefined): { value: number | null; error?: string } {
  if (isUnknown(v)) return { value: null };
  const s = v!.replace(/\s/g, "").replace(/^(\d+),(\d+)$/, "$1.$2");
  const n = Number(s);
  return Number.isFinite(n) ? { value: n } : { value: null, error: `keine Zahl: "${v}"` };
}

/** Probability as 0..1. Values like 25 or "25%" are rejected: the files use 0..1. */
export function readProb(v: string | undefined): { value: number | null; error?: string } {
  if (isUnknown(v)) return { value: null };
  if (/%/.test(v!)) return { value: null, error: `Wahrscheinlichkeit als 0..1 erwartet, nicht in Prozent: "${v}"` };
  const r = readNumber(v);
  if (r.error) return r;
  if (r.value! < 0 || r.value! > 1) return { value: null, error: `Wahrscheinlichkeit außerhalb 0..1: "${v}"` };
  return r;
}

export function readBool(v: string | undefined): { value: boolean | null; error?: string } {
  if (isUnknown(v)) return { value: null };
  const s = v!.trim().toLowerCase();
  if (["true", "ja", "yes", "1", "wahr", "y", "j"].includes(s)) return { value: true };
  if (["false", "nein", "no", "0", "falsch", "n"].includes(s)) return { value: false };
  return { value: null, error: `kein Ja/Nein-Wert: "${v}"` };
}

/** First present column of several possible names. */
export function col(row: Record<string, string>, ...names: string[]): string | undefined {
  for (const n of names) if (row[n] !== undefined) return row[n];
  return undefined;
}
