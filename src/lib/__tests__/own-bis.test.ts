import { expect, test } from "vitest";
import { FLORENTINA } from "../fixtures/florentina";
import { applyBuild, needsPick, ownIdeal, ownScore, pickOptions, type OwnBuild } from "../own-bis";
import { compareIdeal } from "../compare";

const build: OwnBuild = {
  id: "b1", name: "PvP", bis: true, savedAt: "2026-11-24T21:00:00Z", goals: [], order: [], have: {}, picks: {},
  places: [
    { id: "Compass", lines: [{ skill: "Combustion", levels: 4 }, { skill: "Summon: Wind Spirit", levels: 4 }] },
    { id: "top", lines: [{ skill: "Spirit Protection", levels: 1 }] },
  ],
};
const compass = FLORENTINA.arcana.find((a) => a.name === "Compass of Vigor")!;
const top = FLORENTINA.gear.find((g) => g.slot === "torso")!;

test("Arcana: planned abilities, the rest Any", () => {
  expect(ownIdeal(compass, "Compass", build)).toEqual([
    { name: "Combustion", value: "+4" }, { name: "Summon: Wind Spirit", value: "+4" }, { name: "Any", value: "+1" }, { name: "Any", value: "+1" },
  ]);
  // Wind +4 fits, Combustion +2 of +4, the two other lines fill the Any places
  const ideal = ownIdeal(compass, "Compass", build)!;
  expect(ownScore(compass, ideal)).toBeCloseTo(((1 + 0.5) + 2) / 4 * 100);
  const rows = compareIdeal({ ...compass, ideal })!.rows;
  expect(rows.map((r) => r.state)).toEqual(["low", "ok", "ok", "ok"]);
});

test("gear: planned ability plus kisk lines the player keeps", () => {
  const planned = build.places[1].lines;
  expect(needsPick(top, planned)).toBe(true);
  const { room, preset } = pickOptions(top, planned);
  expect(room).toBe((top.ideal?.length ?? 0) - 1);
  expect(preset.length).toBe(room);
  const ideal = ownIdeal(top, "top", build)!;
  expect(ideal).toHaveLength(top.ideal!.length);
  expect(ideal.at(-1)).toEqual({ name: "Spirit Protection", value: "+1" });
  const picked = ownIdeal(top, "top", { ...build, picks: { top: [preset[0]] } })!;
  expect(picked.filter((l) => l.name === "Any")).toHaveLength(room - 1);
});

test("the character with the build: own ranks, other pieces keep kisk's BiS", () => {
  const c = applyBuild(FLORENTINA, build);
  const comp = c.arcana.find((a) => a.name === "Compass of Vigor")!;
  expect(comp.ideal?.[0].name).toBe("Combustion");
  expect(comp.grade).toBe("S+");
  const weapon = c.gear.find((g) => g.slot === "weapon")!;
  expect(weapon.ideal).toBe(FLORENTINA.gear.find((g) => g.slot === "weapon")!.ideal);
});
