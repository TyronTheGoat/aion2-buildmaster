import { describe, expect, it } from "vitest";
import { slotLines } from "../slot-lines";
import { FLORENTINA as florentina } from "../fixtures/florentina";

const weapon = florentina.gear.find((i) => i.slot === "weapon")!;

describe("slot lines aligned with BiS", () => {
  it("shows exactly as many stat lines as the BiS target", () => {
    const { stats } = slotLines(weapon, { topCraft: true });
    expect(stats.length).toBe(weapon.ideal!.filter((l) => !/^\+\d+$/.test(l.value)).length);
  });
  it("fills missing BiS stats with wrong current stats and marks them wrong", () => {
    const { stats } = slotLines(weapon, { topCraft: true });
    const missing = stats.filter((p) => p.verdict === "wrong");
    expect(missing.every((p) => p.ist && p.ist.name !== p.bis!.name)).toBe(true);
  });
  it("the last BiS stat must sit on the last line unless the item is the highest craft", () => {
    const top = slotLines(weapon, { topCraft: true }).stats.at(-1)!;
    const notTop = slotLines(weapon, { topCraft: false }).stats.at(-1)!;
    expect(top.unlock).toBe(true);
    if (top.ist && top.ist.name === top.bis!.name && top.ist !== weapon.lines.at(-1)) {
      expect(top.verdict).toBe("right");
      expect(notTop.verdict).toBe("half");
    }
  });
});
