/** Our score of a piece against target lines on kisk's thresholds (own BiS, and pieces refreshed through kisk's API). */
import type { Grade, IdealLine, Item } from "./types";
import { gradeFromScore } from "./grades";
import { toNum } from "./compare";

export const ANY = "Any";
const key = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/** Our score of a piece against its target lines (0-100) on kisk's thresholds. */
export function ownScore(item: Item, ideal: IdealLine[]): number {
  if (!ideal.length) return NaN;
  const used = new Set<number>();
  const named = ideal.filter((t) => t.name !== ANY);
  let sum = 0;
  for (const t of named) {
    const i = item.lines.findIndex((l, j) => !used.has(j) && key(l.name) === key(t.name));
    if (i < 0) continue;
    used.add(i);
    const h = toNum(item.lines[i].value), g = toNum(t.value);
    sum += Number.isNaN(h) || Number.isNaN(g) || g <= 0 ? 1 : Math.min(1, h / g);
  }
  // "Any": every other line of the piece fills one
  const free = item.lines.length - used.size;
  sum += Math.min(free, ideal.length - named.length);
  return (sum / ideal.length) * 100;
}

export const ownGrade = (item: Item, ideal: IdealLine[]): Grade => gradeFromScore(ownScore(item, ideal));
