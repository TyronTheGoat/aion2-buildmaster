import type { Item, StatLine } from "./types";
import { compareIdeal, toNum } from "./compare";

/** "+N" lines are skill levels (Arcana / skill lines), everything else is a stat. */
export const isSkillValue = (value: string) => /^\+\d+$/.test(value.trim());

export type LinkColor = "green" | "red" | "orange";

export interface StatLinks {
  /** current lines (stats and skills together) in the order they sit on the item, never re-sorted */
  ist: StatLine[];
  /** BiS lines in BiS order; the last one is the unlockable line */
  bis: { name: string; value: string; missing: boolean; skill: boolean }[];
  /** arrows from an Ist line to a BiS line (to = -1: nothing left to point at) */
  links: { from: number; to: number; color: LinkColor }[];
}

/**
 * All lines of one item against its BiS target, each in its own order. Only the last place matters:
 * the last BiS line has to sit on the last line of the item, every other BiS line may sit anywhere but there.
 * - green: a BiS line on an allowed place
 * - orange: a BiS line on the wrong place (the last BiS line not on the last place, or another one on the last place)
 * - red: not part of the BiS target (arrow to a BiS line that is still missing)
 * The current item never shows more lines than the BiS target; when it has more, its real last line is kept.
 *
 * Arcana cards work differently: the place of an ability does not matter, its plus level does.
 * - green: the right ability with exactly the ideal plus
 * - orange: the right ability, but the plus is too low or too high
 * - red: the wrong ability (arrow to an ability that is still missing)
 * The current card always shows all its abilities, even when kisk names fewer ideal ones (Tyron 2026-11-24);
 * an ability beyond the ideal ones with nothing left to point at stays neutral (no arrow, no colour).
 */
export function statLinks(item: Item): StatLinks | undefined {
  const cmp = compareIdeal(item);
  if (!cmp) return undefined;
  const rows = cmp.rows;
  const n = Math.max(rows.length, 1);
  const arcana = item.slot === "arcana";
  const ist = !arcana && item.lines.length > n ? [...item.lines.slice(0, n - 1), item.lines[item.lines.length - 1]] : item.lines;
  const bis = rows.map((r) => ({ name: r.name, value: r.target, missing: !r.have || !ist.includes(r.have), skill: isSkillValue(r.target) }));
  const lastBis = rows.length - 1;
  // the last place only counts once the item has all its lines
  const lastIst = ist.length === rows.length ? ist.length - 1 : -1;
  const free = bis.map((b, i) => (b.missing ? i : -1)).filter((i) => i >= 0);
  const links: StatLinks["links"] = ist.flatMap((line, from): StatLinks["links"] => {
    const to = rows.findIndex((r) => r.have === line);
    if (to < 0) { const t = free.shift(); return t === undefined && arcana ? [] : [{ from, to: t ?? -1, color: "red" }]; }
    if (arcana) return [{ from, to, color: toNum(line.value) === toNum(rows[to].target) ? "green" : "orange" }];
    const wrong = to === lastBis ? from !== ist.length - 1 : from === lastIst;
    return [{ from, to, color: wrong ? "orange" : "green" }];
  });
  return { ist, bis, links };
}
