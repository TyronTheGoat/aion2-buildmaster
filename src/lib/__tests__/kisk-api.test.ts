import { expect, test } from "vitest";
import { FLORENTINA } from "../fixtures/florentina";
import { mergeKiskGear, type KiskGear } from "../kisk/api";

const later = Date.parse(FLORENTINA.source.fetchedAt) + 3_600_000;
const asApi = (patch: (i: number) => object = () => ({})): KiskGear => ({
  fetched: later, combatPower: 200000,
  items: FLORENTINA.gear.map((g, i) => ({
    slot: "x", name: g.name, grade: g.rarity, icon: g.icon, level: g.level, enchantLevel: g.enhance, exceedLevel: g.exceed,
    subStats: g.lines.filter((l) => !/^\+\d+$/.test(l.value)).map((l) => ({ name: l.name, value: l.value })),
    subSkills: g.lines.filter((l) => /^\+\d+$/.test(l.value)).map((l) => ({ name: l.name, level: Number(l.value.slice(1)) })),
    ...patch(i),
  })),
});

test("same gear: kisk's ranks and BiS lines stay, CP and time are new", () => {
  const c = mergeKiskGear(FLORENTINA, asApi())!;
  expect(c.combatPower).toBe(200000);
  expect(c.source.fetchedAt).toBe(new Date(later).toISOString());
  expect(c.gear.length).toBe(FLORENTINA.gear.length);
  expect(c.arcana).toEqual(FLORENTINA.arcana);
  for (const g of c.gear) {
    const o = FLORENTINA.gear.find((x) => x.name === g.name && x.slot === g.slot)!;
    expect(g.grade).toBe(o.grade);
    expect(g.ideal).toEqual(o.ideal);
  }
});

test("changed lines: own rank against the BiS lines", () => {
  const i = FLORENTINA.gear.findIndex((g) => g.ideal?.length && g.lines.length);
  const c = mergeKiskGear(FLORENTINA, asApi((j) => (j === i ? { subStats: [], subSkills: [] } : {})))!;
  const g = c.gear.find((x) => x.name === FLORENTINA.gear[i].name)!;
  expect(g.lines).toEqual([]);
  expect(g.score).toBe(0);
  expect(g.grade).toBe("D");
});

test("not newer: nothing to do", () => {
  expect(mergeKiskGear(FLORENTINA, { ...asApi(), fetched: Date.parse(FLORENTINA.source.fetchedAt) })).toBeUndefined();
});
