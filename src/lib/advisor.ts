import type { Character, Grade, Item, StatLine } from "./types";
import { gradeRank, minScoreFor } from "./grades";
import { SLOT_LABEL_DE, SLOT_WEIGHT } from "./knowledge/slots";
import { lineShare, missingIdealLines } from "./knowledge/ideal-lines";
import { ARCANA_SOURCES, arcanaType } from "./knowledge/arcana";

export type ActionKind = "reroll" | "replace" | "arcana" | "enhance" | "keep";

export interface UpgradeStep {
  item: Item;
  kind: ActionKind;
  title: string;
  details: string[];
  /** Target grade for this step */
  target: Grade;
  /** Score points gained toward target (0-100 scale) */
  gain: number;
  priority: number;
  /** Rough effort 1 (cheap) .. 3 (expensive) */
  effort: 1 | 2 | 3;
}

/** Lines worth keeping: carried by at least half of the top players. */
export const GOOD_SHARE = 50;

export function shareOf(char: Character, item: Item, line: StatLine): number | undefined {
  return line.share ?? lineShare(char.className, item.slot, line.name);
}

export function badLines(char: Character, item: Item): StatLine[] {
  return item.lines.filter((l) => {
    const sh = shareOf(char, item, l);
    return sh !== undefined && sh < GOOD_SHARE;
  });
}

export function lowRolls(char: Character, item: Item): StatLine[] {
  return item.lines.filter((l) => {
    const sh = shareOf(char, item, l);
    if (sh === undefined || sh < GOOD_SHARE || !l.max) return false;
    return parseFloat(l.value.replace(/[+,%]/g, "")) < parseFloat(l.max.replace(/[+,%]/g, ""));
  });
}

function targetFor(item: Item): Grade {
  return gradeRank(item.grade) >= gradeRank("S+") ? "BiS" : "S+";
}

function adviseItem(char: Character, item: Item): UpgradeStep | undefined {
  if (!item.scored) return undefined;
  const label = SLOT_LABEL_DE[item.slot];
  const target = targetFor(item);
  const score = item.score ?? 0;
  const gain = Math.max(0, minScoreFor(target) - score);
  const weight = SLOT_WEIGHT[item.slot] ?? 1;
  const bad = badLines(char, item);
  const low = lowRolls(char, item);

  if (item.grade === "BiS") {
    return { item, kind: "keep", title: `${label}: BiS, nichts zu tun`, details: [], target: "BiS", gain: 0, priority: 0, effort: 1 };
  }

  if (item.slot === "arcana") {
    const type = arcanaType(item.name);
    const details = [
      ...bad.map((l) => `Schwache Linie: ${l.name} ${l.value}${l.max ? `/${l.max}` : ""} (nur ${shareOf(char, item, l) ?? "?"} % der Top-Spieler)`),
      ...low.map((l) => `Linie gut, Stufe ausbaufähig: ${l.name} ${l.value}/${l.max}`),
      ...(type && ARCANA_SOURCES[type] ? ARCANA_SOURCES[type].map((s) => `Neue Karte farmen: ${s}`) : []),
      bad.length >= 2
        ? "Alternative: per Transmutation eine Unique-Karte mit Wunschlinien bauen."
        : "Mit Dubletten farmen und die beste Version behalten.",
    ];
    return {
      item, kind: "arcana", target, gain, effort: bad.length >= 2 ? 3 : 2,
      title: `${item.name}: ${bad.length ? `${bad.length} schwache Linie(n) ersetzen` : "auf " + target + " bringen"}`,
      details, priority: (gain * weight) / (bad.length >= 2 ? 1.5 : 1),
    };
  }

  if (item.fixedLines) {
    const want = missingIdealLines(char.className, item.slot, item.lines.map((l) => l.name), 4);
    return {
      item, kind: "replace", target, gain, effort: 3, priority: (gain * weight) / 2,
      title: `${label} ersetzen: ${item.name} hat feste Linien`,
      details: [
        "Feste Linien lassen sich nicht neu rollen, nur ein neues Teil hilft.",
        want.length ? `Suche ein Armband mit: ${want.join(", ")}` : "Suche ein Teil mit besseren Linien für deine Klasse.",
      ],
    };
  }

  const want = missingIdealLines(char.className, item.slot, item.lines.filter((l) => !bad.includes(l)).map((l) => l.name));
  const details: string[] = [];
  const sortedBad = [...bad].sort((a, b) => (shareOf(char, item, a) ?? 0) - (shareOf(char, item, b) ?? 0));
  sortedBad.forEach((l, i) =>
    details.push(`${i + 1}. ${l.name} (${l.value}${l.max ? `/${l.max}` : ""}) neu rollen · nur ${shareOf(char, item, l) ?? 0} % der Top-Spieler`),
  );
  if (want.length) details.push(`Ziel-Linien: ${want.join(", ")}`);
  low.forEach((l) => details.push(`Gute Linie, Wert noch nicht maximal: ${l.name} ${l.value}/${l.max}`));
  if (!details.length) details.push("Linien passen schon. Weiter verstärken bzw. Werte maximieren.");

  const effort: 1 | 2 | 3 = bad.length <= 1 ? 1 : bad.length <= 2 ? 2 : 3;
  return {
    item, kind: bad.length ? "reroll" : "enhance", target, gain, effort,
    title: bad.length
      ? `${label}: ${bad.length === 1 ? "1 Linie" : `${bad.length} Linien`} neu rollen`
      : `${label}: Werte maximieren`,
    details,
    // Big gaps on important slots first; cheap fixes get a bonus.
    priority: (gain * weight) / (1 + (effort - 1) * 0.25),
  };
}

export interface Plan {
  steps: UpgradeStep[];
  done: Item[];
  gradeCounts: Record<string, number>;
  averageScore: number;
}

export function buildPlan(char: Character): Plan {
  const all = [...char.gear, ...char.arcana];
  const steps = all
    .map((i) => adviseItem(char, i))
    .filter((s): s is UpgradeStep => !!s && s.kind !== "keep")
    .sort((a, b) => b.priority - a.priority);
  const done = all.filter((i) => i.grade === "BiS");
  const scored = all.filter((i) => i.scored && i.score !== undefined);
  const gradeCounts: Record<string, number> = {};
  for (const i of all.filter((x) => x.scored)) gradeCounts[i.grade] = (gradeCounts[i.grade] ?? 0) + 1;
  const averageScore = scored.length ? scored.reduce((a, i) => a + (i.score ?? 0), 0) / scored.length : 0;
  return { steps, done, gradeCounts, averageScore };
}
