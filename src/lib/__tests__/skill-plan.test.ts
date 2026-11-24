import { expect, test } from "vitest";
import { DEFAULT_ORDER, allowed, placeOf, planSkills } from "../skill-plan";

test("story 10 + Daevanion 4 + Gral +4 + Pergament +2 = 20 for Elemental Fusion", () => {
  const r = planSkills("Spiritmaster", [{ skill: "Elemental Fusion", target: 20, story: 10, daevanion: 4 }], DEFAULT_ORDER);
  expect(r.goals[0].need).toBe(6);
  expect(r.goals[0].got).toEqual([{ place: "Chalice", levels: 4 }, { place: "Parchment", levels: 2 }]);
  expect(r.goals[0].missing).toBe(0);
});

test("pools and gear types are respected", () => {
  expect(allowed("Spiritmaster", "Elemental Fusion", placeOf("Compass"))).toBe(false);
  expect(allowed("Spiritmaster", "Elemental Fusion", placeOf("ring1"))).toBe(true);
  expect(allowed("Spiritmaster", "Elemental Fusion", placeOf("helm"))).toBe(false);
  expect(allowed("Spiritmaster", "Spirit Strike", placeOf("helm"))).toBe(true);
});

test("a card hands out 5 levels in total; gear only +1; limits per piece hold", () => {
  const order = [{ id: "Chalice" as const, max: 4 }, { id: "ring1" as const, max: 1 }, { id: "ring2" as const, max: 0 }, { id: "weapon" as const, max: 2 }];
  const r = planSkills("Spiritmaster", [
    { skill: "Elemental Fusion", target: 20, story: 10, daevanion: 4 },
    { skill: "Combustion", target: 20, story: 10, daevanion: 4 },
  ], order);
  expect(r.goals[0].got).toEqual([{ place: "Chalice", levels: 4 }, { place: "ring1", levels: 1 }, { place: "weapon", levels: 1 }]);
  expect(r.goals[1].got).toEqual([{ place: "Chalice", levels: 1 }, { place: "weapon", levels: 1 }]);
  expect(r.goals[1].missing).toBe(4);
  expect(r.places.find((p) => p.id === "Chalice")!.levelsLeft).toBe(0);
});

test("a locked piece counts as it is and gets nothing new", () => {
  const order = [{ id: "Chalice" as const, max: 4 }, { id: "ring1" as const, max: 2 }, { id: "weapon" as const, max: 2 }];
  const r = planSkills("Spiritmaster", [{ skill: "Elemental Fusion", target: 20, story: 10, daevanion: 4 }], order,
    { ring1: { locked: true, lines: [{ skill: "Combustion", levels: 1 }] }, Chalice: { locked: true, lines: [{ skill: "Elemental Fusion", levels: 3 }] } });
  expect(r.goals[0].got).toEqual([{ place: "Chalice", levels: 3, fixed: true }, { place: "weapon", levels: 1 }]);
  expect(r.goals[0].missing).toBe(2);
  expect(r.places.find((p) => p.id === "ring1")).toEqual({ id: "ring1", lines: [{ skill: "Combustion", levels: 1 }], levelsLeft: null, locked: true });
});
