import type { Character, Grade, Item, StatLine } from "../types";
import { gradeFromScore } from "../grades";
import { slotFromName } from "../knowledge/slots";

const RARITY = "(Unique|Legend(?:ary)?|Special|Epic|Rare|Heroic|Common|Mythic|Fabled|Eternal)";
const LV_RE = new RegExp(`\\bLv\\.?\\s*(\\d{1,3})\\b[^\\n]*?\\b${RARITY}\\b`, "i");
const GRADE_TOKEN = "(BiS|S\\+|S|A|B|C|D)";
const GRADE_ONLY = new RegExp(`^${GRADE_TOKEN}$`);
const GRADE_SCORE = new RegExp(`^(?:grade\\s*)?${GRADE_TOKEN}\\s*[·:,(]?\\s*(?:score\\s*)?(\\d{1,3})\\)?$`, "i");
const SCORE_GRADE = new RegExp(`^(?:score\\s*)?(\\d{1,3})\\s*[·:,(]?\\s*${GRADE_TOKEN}\\)?$`, "i");
const VAL = "\\+?(-?[\\d.,]+%?)";
const STAT_WITH_MAX = new RegExp(`^(.+?)\\s+${VAL}\\s*/\\s*${VAL}(?:\\s*\\(?\\s*(\\d{1,3})\\s*%\\s*\\)?)?$`);
const STAT_SIMPLE = new RegExp(`^([A-Za-z][A-Za-z' :\\[\\]-]+?)\\s+${VAL}(?:\\s*\\(?\\s*(\\d{1,3})\\s*%\\s*\\)?)?$`);
const STOP_RE = /^(ideal|yours has|best in slot|how we (score|plan)|unscored|arcana|equipment|gear)\b/i;

function num(s: string | undefined): number | undefined {
  if (!s) return undefined;
  const n = Number(s.replace(/,/g, ""));
  return Number.isFinite(n) ? n : undefined;
}

function cleanName(s: string): string {
  return s.replace(/^\+\d+\s*/, "").replace(/\s*\+\d+$/, "").trim();
}

function parseStat(line: string): StatLine | undefined {
  let m = line.match(STAT_WITH_MAX);
  if (m) return { name: m[1].trim(), value: m[2], max: m[3], share: num(m[4]) };
  m = line.match(STAT_SIMPLE);
  if (m && !/^(lv|score|grade|exceed)\b/i.test(m[1])) {
    return { name: m[1].trim(), value: m[2], share: num(m[3]) };
  }
  return undefined;
}

/** Finds item starts: index of the "Lv NN Rarity" line + the item name. */
function findItemStarts(lines: string[]): { at: number; nameAt: number; name: string }[] {
  const out: { at: number; nameAt: number; name: string }[] = [];
  lines.forEach((line, i) => {
    const m = line.match(LV_RE);
    if (!m) return;
    const before = line.slice(0, m.index).trim();
    if (before && slotFromName(before) !== "unknown") {
      out.push({ at: i, nameAt: i, name: cleanName(before) });
      return;
    }
    for (let j = i - 1; j >= Math.max(0, i - 3); j--) {
      const cand = cleanName(lines[j]);
      if (cand && slotFromName(cand) !== "unknown") {
        out.push({ at: i, nameAt: j, name: cand });
        return;
      }
    }
  });
  return out;
}

function parseItemBlock(name: string, block: string[], header: string): Item {
  const lv = header.match(LV_RE);
  const item: Item = {
    slot: slotFromName(name),
    name,
    level: num(lv?.[1]),
    rarity: lv?.[2],
    grade: "?",
    lines: [],
    scored: true,
  };
  const exceed = header.match(/exceed\s*\+?(\d+)/i);
  if (exceed) item.exceed = num(exceed[1]);
  const enh = header.match(/(?:^|\s)\+(\d{1,2})(?:\s|$)/);
  if (enh) item.enhance = num(enh[1]);

  let inIdeal = false;
  for (let i = 0; i < block.length; i++) {
    const line = block[i];
    if (/^ideal\b|^best in slot\b/i.test(line)) inIdeal = true;
    if (inIdeal) continue;
    if (/^unscored$/i.test(line)) { item.scored = false; continue; }
    if (STOP_RE.test(line)) continue;

    const ex = line.match(/^exceed\s*\+?(\d+)$/i);
    if (ex) { item.exceed = num(ex[1]); continue; }
    const en = line.match(/^\+(\d{1,2})$/);
    if (en && item.enhance === undefined) { item.enhance = num(en[1]); continue; }

    let m = line.match(GRADE_SCORE);
    if (m) { item.grade = m[1] as Grade; item.score = num(m[2]); continue; }
    m = line.match(SCORE_GRADE);
    if (m) { item.grade = m[2] as Grade; item.score = num(m[1]); continue; }
    if (GRADE_ONLY.test(line)) {
      item.grade = line as Grade;
      const next = block[i + 1];
      if (next && /^\d{1,3}$/.test(next)) { item.score = num(next); i++; }
      continue;
    }
    if (/^score\s*\d{1,3}$/i.test(line)) { item.score = num(line.replace(/\D/g, "")); continue; }

    // A stat may be split over several lines (name / value / "/" / max / share) in rendered HTML:
    // glue following lines that are pure numbers/symbols onto the stat name.
    let used = 0;
    while (used < 4 && i + used + 1 < block.length && /^[+\-\d.,%/() ]+$/.test(block[i + used + 1])) used++;
    const joined = block.slice(i, i + used + 1).join(" ").replace(/\s*\/\s*/g, " / ").replace(/\s+/g, " ");
    const stat = parseStat(joined);
    if (stat) {
      item.lines.push(stat);
      i += used;
    }
  }
  if (item.grade === "?" && item.score !== undefined) item.grade = gradeFromScore(item.score);
  if (item.score === undefined && item.grade === "?" && item.lines.length === 0) item.scored = false;
  if (item.slot === "bracelet" && item.lines.every((l) => !l.max)) item.fixedLines = true;
  return item;
}

export interface ParseOptions {
  region: string;
  server: string;
  name: string;
  url: string;
  mode: Character["source"]["mode"];
}

/** Parses the text lines of a kisk.app gear page (or pasted page text). */
export function parseKiskGear(lines: string[], opts: ParseOptions): Character {
  const joined = lines.join("\n");
  const warnings: string[] = [];
  const race = joined.match(/\b(Elyos|Asmodian)\b/i)?.[1];
  const className = joined.match(/\b(Elyos|Asmodian)\s+(Gladiator|Templar|Assassin|Ranger|Sorcerer|Spiritmaster|Cleric|Chanter|Fighter|Painter|Gunner|Bard)\b/i)?.[2]
    ?? joined.match(/\b(Gladiator|Templar|Assassin|Ranger|Sorcerer|Spiritmaster|Cleric|Chanter|Fighter)\b/)?.[1];
  const cp = joined.match(/([\d][\d,.]{2,})\s*CP\b/i)?.[1] ?? joined.match(/\bCP\s*:?\s*([\d][\d,.]{2,})/i)?.[1];
  const level = joined.match(/\b(?:level|Lv\.?)\s*(\d{1,3})\b/i)?.[1];
  const gearGrade = joined.match(/gear(?:\s+grade)?\s*:?\s*\n?\s*(BiS|S\+|S|A|B|C|D)\b/i)?.[1] as Grade | undefined;

  const starts = findItemStarts(lines);
  const items: Item[] = starts.map((s, idx) => {
    const end = idx + 1 < starts.length ? starts[idx + 1].nameAt : lines.length;
    const header = lines.slice(s.nameAt, s.at + 1).join(" ");
    return parseItemBlock(s.name, lines.slice(s.at + 1, end), header);
  });

  if (items.length === 0) warnings.push("Keine Ausrüstung erkannt. Ist das die /gear-Seite von kisk.app?");
  const unknown = items.filter((i) => i.slot === "unknown");
  if (unknown.length) warnings.push(`${unknown.length} Teil(e) keinem Slot zugeordnet.`);

  return {
    region: opts.region,
    server: opts.server,
    name: opts.name,
    className,
    race,
    level: num(level),
    combatPower: num(cp),
    gearGrade,
    gear: items.filter((i) => i.slot !== "arcana"),
    arcana: items.filter((i) => i.slot === "arcana"),
    source: { url: opts.url, fetchedAt: new Date().toISOString(), mode: opts.mode },
    warnings,
  };
}
