import { describe, expect, it } from "vitest";
import { slotLines } from "../slot-lines";
import { FLORENTINA as florentina } from "../fixtures/florentina";

const weapon = florentina.gear.find((i) => i.slot === "weapon")!;

describe("slot lines aligned with BiS", () => {
  it("shows exactly as many stat lines as the BiS target", () => {
    const { stats } = slotLines(weapon);
    expect(stats.length).toBe(weapon.ideal!.filter((l) => !/^\+\d+$/.test(l.value)).length);
  });
  it("fills missing BiS stats with wrong current stats and marks them wrong", () => {
    const { stats } = slotLines(weapon);
    const missing = stats.filter((p) => p.verdict === "wrong");
    expect(missing.every((p) => p.ist && p.ist.name !== p.bis!.name)).toBe(true);
  });
  it("the last BiS stat must sit on the last line, also on the highest craft", () => {
    const last = slotLines(weapon).stats.at(-1)!;
    expect(last.unlock).toBe(true);
    if (last.ist && last.ist.name === last.bis!.name && last.ist !== weapon.lines.at(-1)) expect(last.verdict).toBe("half");
  });
});

import { statLinks } from "../slot-lines";
describe("stat links (Ist order kept)", () => {
  it("keeps the current order and marks the unlock line on the wrong place orange", () => {
    const r = statLinks(weapon)!;
    expect(r.ist.map((l) => l.name)).toEqual(weapon.lines.filter((l) => !/^\+\d+$/.test(l.value)).map((l) => l.name));
    const unlock = r.links.find((l) => l.to === r.bis.length - 1)!;
    // Multi-hit Chance sits on line 5 of 6 on Florentina's orb
    expect(unlock.color).toBe("orange");
    expect(r.links.filter((l) => l.color === "red").every((l) => r.bis[l.to]?.missing)).toBe(true);
  });
});
