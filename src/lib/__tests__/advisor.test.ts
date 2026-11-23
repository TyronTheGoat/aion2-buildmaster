import { describe, expect, it } from "vitest";
import { buildPlan } from "../advisor";
import { FLORENTINA } from "../fixtures/florentina";

describe("buildPlan (Florentina)", () => {
  const plan = buildPlan(FLORENTINA);

  it("lists BiS arcana as done", () => {
    expect(plan.done.map((i) => i.name)).toEqual(["Parchment of Vigor", "Bell of Magic"]);
  });

  it("puts big D-grade gaps before near-S+ pieces", () => {
    const first = plan.steps[0];
    expect(["D", "C"]).toContain(first.item.grade);
    const guard = plan.steps.findIndex((s) => s.item.name === "Nuakum Guard");
    expect(guard).toBeGreaterThan(0);
  });

  it("recommends replacing bracelets with fixed lines", () => {
    const br = plan.steps.filter((s) => s.item.slot === "bracelet");
    expect(br).toHaveLength(2);
    expect(br.every((s) => s.kind === "replace")).toBe(true);
  });

  it("suggests rerolling all four torso lines toward ideal lines", () => {
    const torso = plan.steps.find((s) => s.item.slot === "torso")!;
    expect(torso.kind).toBe("reroll");
    expect(torso.details.join("\n")).toContain("Schadensverstärkung");
  });

  it("does not include unscored items", () => {
    expect(plan.steps.some((s) => s.item.slot === "belt" || s.item.slot === "rune")).toBe(false);
  });
});
