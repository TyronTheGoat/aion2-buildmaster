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

test("a card has 9 levels (4 lines at +1, 5 from enhancing); gear only +1; limits per piece hold", () => {
  const order = [{ id: "Chalice" as const, max: 4 }, { id: "ring1" as const, max: 1 }, { id: "ring2" as const, max: 0 }, { id: "weapon" as const, max: 2 }];
  const r = planSkills("Spiritmaster", [
    { skill: "Elemental Fusion", target: 20, story: 10, daevanion: 4 },
    { skill: "Combustion", target: 20, story: 10, daevanion: 4 },
  ], order);
  expect(r.goals[0].got).toEqual([{ place: "Chalice", levels: 4 }, { place: "ring1", levels: 1 }, { place: "weapon", levels: 1 }]);
  // 9 - 4 = 5 left, two more lines must keep +1 each: +3 for Combustion
  expect(r.goals[1].got).toEqual([{ place: "Chalice", levels: 3 }, { place: "weapon", levels: 1 }]);
  expect(r.goals[1].missing).toBe(2);
  expect(r.places.find((p) => p.id === "Chalice")!.levelsLeft).toBe(2);
});

test("a locked piece counts as it is and gets nothing new", () => {
  const order = [{ id: "Chalice" as const, max: 4 }, { id: "ring1" as const, max: 2 }, { id: "weapon" as const, max: 2 }];
  const r = planSkills("Spiritmaster", [{ skill: "Elemental Fusion", target: 20, story: 10, daevanion: 4 }], order,
    { ring1: { locked: true, lines: [{ skill: "Combustion", levels: 1 }] }, Chalice: { locked: true, lines: [{ skill: "Elemental Fusion", levels: 3 }] } });
  expect(r.goals[0].got).toEqual([{ place: "Chalice", levels: 3, fixed: true }, { place: "weapon", levels: 1 }]);
  expect(r.goals[0].missing).toBe(2);
  expect(r.places.find((p) => p.id === "ring1")).toEqual({ id: "ring1", lines: [{ skill: "Combustion", levels: 1 }], levelsLeft: null, locked: true });
});

test("current gear of Florentina is read per place and compared with the plan", async () => {
  const { FLORENTINA } = await import("../fixtures/florentina");
  const { currentLines, diffPlan, alignToCurrent } = await import("../skill-plan");
  const now = currentLines("Spiritmaster", FLORENTINA);
  expect(now.Parchment).toEqual([{ skill: "Jointstrike: Curse", levels: 3 }, { skill: "Cold Shock", levels: 1 }, { skill: "Summon: Fire Spirit", levels: 2 }, { skill: "Elemental Fusion", levels: 3 }]);
  expect(now.ring1).toEqual([{ skill: "Elemental Fusion", levels: 1 }, { skill: "Jointstrike: Curse", levels: 1 }]);
  const order = [{ id: "ring1" as const, max: 1 }, { id: "ring2" as const, max: 1 }];
  // the plan puts Fire Spirit on ring 1, but ring 2 already carries it: the rings swap
  const plan = alignToCurrent(planSkills("Spiritmaster", [
    { skill: "Summon: Fire Spirit", target: 15, story: 10, daevanion: 4 },
    { skill: "Elemental Fusion", target: 15, story: 10, daevanion: 4 },
  ], order), now);
  const d = diffPlan(plan, now);
  expect(d.find((x) => x.id === "ring2")!.want).toEqual([{ skill: "Summon: Fire Spirit", levels: 1, has: 1, state: "ok" }]);
  expect(d.find((x) => x.id === "ring1")!.want[0].state).toBe("ok");
  expect(d.every((x) => !x.change || x.now.some((n) => n.state === "drop"))).toBe(true);
});

test("Highest takes what the places left over allow, in priority order", () => {
  const order = [{ id: "Chalice" as const, max: 4 }, { id: "ring1" as const, max: 2 }];
  const r = planSkills("Spiritmaster", [
    { skill: "Elemental Fusion", target: 20, story: 10, daevanion: 4 },
    { skill: "Combustion", target: 0, story: 10, daevanion: 4 },
  ], order);
  // Fusion: Gral +4, ring +1, 1 missing; Combustion: what is left on the Gral (9 - 4 - 2 spare lines = +3) and the ring (+1)
  expect(r.goals[0].missing).toBe(1);
  expect(r.goals[1].got).toEqual([{ place: "Chalice", levels: 3 }, { place: "ring1", levels: 1 }]);
  expect(r.goals[1].reached).toBe(18);
  expect(r.goals[1].missing).toBe(0);
});
