import type { IdealLine, Item, StatLine } from "./types";

export type MatchState = "ok" | "low" | "missing";

export interface IdealRow {
  name: string;
  target: string;
  have?: StatLine;
  state: MatchState;
}

export interface Comparison {
  rows: IdealRow[];
  /** Current lines that are not part of the BiS target (reroll candidates) */
  extra: StatLine[];
  ok: number;
  present: number;
  total: number;
}

export const toNum = (v: string | undefined) => (v === undefined ? NaN : parseFloat(v.replace(/[+,%\s]/g, "")));
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

export function compareIdeal(item: Item): Comparison | undefined {
  if (!item.ideal?.length) return undefined;
  const used = new Set<StatLine>();
  // named lines first; "Any" (own BiS: any ability may stand there) then takes one of the lines left
  const named = new Map<IdealLine, IdealRow>();
  for (const t of item.ideal) {
    if (t.name === "Any") continue;
    const have = item.lines.find((l) => !used.has(l) && norm(l.name) === norm(t.name));
    if (!have) { named.set(t, { name: t.name, target: t.value, state: "missing" }); continue; }
    used.add(have);
    const h = toNum(have.value), g = toNum(t.value);
    const state: MatchState = Number.isNaN(h) || Number.isNaN(g) || h >= g - 1e-9 ? "ok" : "low";
    named.set(t, { name: t.name, target: t.value, have, state });
  }
  const rows: IdealRow[] = item.ideal.map((t: IdealLine) => {
    const r = named.get(t);
    if (r) return r;
    const have = item.lines.find((l) => !used.has(l));
    if (!have) return { name: t.name, target: t.value, state: "missing" };
    used.add(have);
    return { name: t.name, target: t.value, have, state: "ok" };
  });
  const extra = item.lines.filter((l) => !used.has(l));
  return {
    rows, extra,
    ok: rows.filter((r) => r.state === "ok").length,
    present: rows.filter((r) => r.state !== "missing").length,
    total: rows.length,
  };
}
