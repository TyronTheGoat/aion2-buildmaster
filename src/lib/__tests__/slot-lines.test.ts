import { describe, expect, it } from "vitest";
import { statLinks } from "../slot-lines";
import { FLORENTINA as florentina } from "../fixtures/florentina";
import type { Item } from "../types";

const weapon = florentina.gear.find((i) => i.slot === "weapon")!;
const item = (lines: string[], ideal: string[]): Item =>
  ({ ...weapon, lines: lines.map((name) => ({ name, value: "1" })), ideal: ideal.map((name) => ({ name, value: "1" })) });

describe("stat links (Ist order kept, only the last place matters)", () => {
  it("keeps the current order and never shows more lines than BiS", () => {
    const r = statLinks(weapon)!;
    expect(r.ist.length).toBeLessThanOrEqual(r.bis.length);
    expect(r.ist.map((l) => weapon.lines.indexOf(l))).toEqual([...r.ist.map((l) => weapon.lines.indexOf(l))].sort((a, b) => a - b));
  });
  it("marks the last BiS stat orange when it is not on the last place (Florentina's orb)", () => {
    const r = statLinks(weapon)!;
    expect(r.links.find((l) => l.to === r.bis.length - 1)!.color).toBe("orange");
    expect(r.links.filter((l) => l.color === "red").every((l) => r.bis[l.to]?.missing)).toBe(true);
  });
  it("other BiS stats may sit anywhere except the last place", () => {
    const r = statLinks(item(["C", "A", "B"], ["A", "B", "C"]))!;
    expect(r.links.map((l) => l.color)).toEqual(["orange", "green", "orange"]);
    const ok = statLinks(item(["B", "A", "C"], ["A", "B", "C"]))!;
    expect(ok.links.map((l) => l.color)).toEqual(["green", "green", "green"]);
  });
  it("wrong lines point to missing BiS lines", () => {
    const r = statLinks(item(["X", "A", "C"], ["A", "B", "C"]))!;
    expect(r.links[0]).toEqual({ from: 0, to: 1, color: "red" });
  });
});
