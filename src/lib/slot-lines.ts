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

/**
 * Lines of one item, aligned with its BiS target.
 * - Exactly as many stat lines as the BiS target has.
 * - Each BiS stat is paired with the same current stat; free positions take a wrong current stat (or stay empty).
 * - The last BiS stat is the unlockable line: unless the item is already the highest craft, it only counts
 *   as fully right when it is also the last stat line of the current item, otherwise "half".
 */
export function slotLines(item: Item, opts: { topCraft?: boolean } = {}): { skills: LinePair[]; stats: LinePair[]; dropped: StatLine[] } {
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
      const verdict: Verdict = unlock && !opts.topCraft && !onLast ? "half" : "right";
      return { key: r.name, bis: { name: r.name, value: r.target }, ist: r.have, state: r.state, verdict, unlock };
    }
    const filler = wrong.shift();
    return { key: r.name, bis: { name: r.name, value: r.target }, ist: filler, state: filler ? "extra" : "missing", verdict: filler ? "wrong" : "empty", unlock };
  });
  return { skills, stats, dropped: wrong };
}
