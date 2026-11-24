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
  it("arcana: place does not matter, the plus level does", () => {
    const card: Item = { ...weapon, slot: "arcana",
      lines: [{ name: "C", value: "+1" }, { name: "A", value: "+3" }, { name: "X", value: "+2" }, { name: "B", value: "+1" }],
      ideal: [{ name: "A", value: "+2" }, { name: "B", value: "+3" }, { name: "C", value: "+1" }, { name: "E", value: "+1" }] };
    const r = statLinks(card)!;
    // A has +3 but should have +2 (too high), B +1 instead of +3 (too low): both orange
    expect(r.links.map((l) => l.color)).toEqual(["green", "orange", "red", "orange"]);
  });
});

describe("Arcana with fewer ideal abilities than lines", () => {
  it("the current card keeps all four abilities", async () => {
    const { FLORENTINA } = await import("../fixtures/florentina");
    const compass = FLORENTINA.arcana.find((a) => a.name === "Compass of Vigor")!;
    expect(compass.ideal).toHaveLength(2);
    const r = statLinks(compass)!;
    expect(r.ist).toHaveLength(4);
    expect(r.bis).toHaveLength(2);
    // the two abilities that are not ideal have no arrow
    expect(r.links.map((l) => l.from).sort()).toEqual([1, 2]);
  });
});
