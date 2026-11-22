import type { Item, StatLine } from "./types";
import { compareIdeal, type MatchState } from "./compare";

/** "+N" lines are skill levels (Arcana / skill lines), everything else is a stat. */
export const isSkillValue = (value: string) => /^\+\d+$/.test(value.trim());

export type Verdict = "right" | "half" | "wrong" | "empty" | "none";

export interface LinePair {
  key: string;
  /** BiS line at this position (undefined when there is no BiS target) */
  bis?: { name: string; value: string };
  /** current line shown at the same height */
  ist?: StatLine;
  state: MatchState | "extra";
  verdict: Verdict;
  /** last BiS stat: the unlockable line that has to sit on the last line of the item */
  unlock?: boolean;
}

export type LinkColor = "green" | "red" | "orange";

export interface StatLinks {
  /** current stat lines in the order they sit on the item (never re-sorted) */
  ist: StatLine[];
  /** BiS stat lines in BiS order; the last one is the unlockable line */
  bis: { name: string; value: string; missing: boolean }[];
  /** arrows from an Ist line to a BiS line */
  links: { from: number; to: number; color: LinkColor }[];
}

/**
 * Stat lines of one item against its BiS target, both in their own order.
 * - green: the current line is a BiS stat (arrow to that BiS line)
 * - orange: it is the last BiS stat (the unlockable line) but not on the last line of the item
 * - red: the current line is not part of the BiS target (arrow to a BiS stat that is still missing)
 * The current item never shows more lines than the BiS target has.
 */
export function statLinks(item: Item): StatLinks | undefined {
  const cmp = compareIdeal(item);
  if (!cmp) return undefined;
  const bisRows = cmp.rows.filter((r) => !isSkillValue(r.target));
  const ist = item.lines.filter((l) => !isSkillValue(l.value)).slice(0, Math.max(bisRows.length, 1));
  const bis = bisRows.map((r) => ({ name: r.name, value: r.target, missing: !r.have || !ist.includes(r.have) }));
  const links: StatLinks["links"] = [];
  const free = bis.map((b, i) => (b.missing ? i : -1)).filter((i) => i >= 0);
  ist.forEach((line, from) => {
    const to = bisRows.findIndex((r) => r.have === line);
    if (to >= 0) {
      const unlock = to === bisRows.length - 1;
      links.push({ from, to, color: unlock && from !== ist.length - 1 ? "orange" : "green" });
    } else {
      const target = free.shift();
      links.push({ from, to: target ?? -1, color: "red" });
    }
  });
  return { ist, bis, links };
}

/**
 * Lines of one item, aligned with its BiS target.
 * - Exactly as many stat lines as the BiS target has.
 * - Each BiS stat is paired with the same current stat; free positions take a wrong current stat (or stay empty).
 * - The last BiS stat is the unlockable line: it
 *   only counts as fully right when it is also the last stat line of the current item, otherwise "half"
 *   (this applies to every item, the highest craft included).
 */
export function slotLines(item: Item): { skills: LinePair[]; stats: LinePair[]; dropped: StatLine[] } {
  const cmp = compareIdeal(item);
  const istStats = item.lines.filter((l) => !isSkillValue(l.value));
  if (!cmp) {
    const toPair = (l: StatLine, i: number): LinePair => ({ key: `${l.name}:${i}`, ist: l, state: "extra", verdict: "none" });
    return { skills: item.lines.filter((l) => isSkillValue(l.value)).map(toPair), stats: istStats.map(toPair), dropped: [] };
  }

  const skillRows = cmp.rows.filter((r) => isSkillValue(r.target));
  const statRows = cmp.rows.filter((r) => !isSkillValue(r.target));
  const skills: LinePair[] = [
    ...skillRows.map((r) => ({ key: r.name, bis: { name: r.name, value: r.target }, ist: r.have, state: r.state, verdict: (r.have ? "right" : "empty") as Verdict })),
    ...cmp.extra.filter((l) => isSkillValue(l.value)).map((l) => ({ key: `x:${l.name}`, ist: l, state: "extra" as const, verdict: "wrong" as Verdict })),
  ];

  const wrong = cmp.extra.filter((l) => !isSkillValue(l.value));
  const lastIst = istStats[istStats.length - 1];
  const stats: LinePair[] = statRows.map((r, i) => {
    const unlock = i === statRows.length - 1;
    if (r.have) {
      const onLast = r.have === lastIst;
      const verdict: Verdict = unlock && !onLast ? "half" : "right";
      return { key: r.name, bis: { name: r.name, value: r.target }, ist: r.have, state: r.state, verdict, unlock };
    }
    const filler = wrong.shift();
    return { key: r.name, bis: { name: r.name, value: r.target }, ist: filler, state: filler ? "extra" : "missing", verdict: filler ? "wrong" : "empty", unlock };
  });
  return { skills, stats, dropped: wrong };
}
