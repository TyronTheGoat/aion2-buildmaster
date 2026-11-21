import { describe, expect, it } from "vitest";
import { compareIdeal } from "../compare";
import { FLORENTINA } from "../fixtures/florentina";

const byName = (n: string) => [...FLORENTINA.gear, ...FLORENTINA.arcana].find((i) => i.name === n)!;

describe("compareIdeal", () => {
  it("marks arcana skills ok / low / missing by level", () => {
    const mirror = compareIdeal(byName("Mirror of Vigor"))!;
    expect(mirror.rows.map((r) => [r.name, r.state])).toEqual([
      ["Mental Focus", "ok"], ["Corrode", "low"], ["Spirit Protection", "ok"], ["Consecutive Countercurrent", "ok"],
    ]);
    const chalice = compareIdeal(byName("Chalice of Vigor"))!;
    expect(chalice.ok).toBe(1);
    expect(chalice.extra.map((l) => l.name)).toEqual(["Spirit Protection", "Soul's Cry", "Summon: Fire Spirit"]);
  });

  it("matches kisk's 'yours has X of Y' for gear", () => {
    expect(compareIdeal(byName("Splendent Ebony Dragon Lord Orb"))!.present).toBe(4);
    expect(compareIdeal(byName("Nuakum Breastplate"))!.present).toBe(0);
    expect(compareIdeal(byName("Nuakum Gloves"))!.present).toBe(3);
  });
});
