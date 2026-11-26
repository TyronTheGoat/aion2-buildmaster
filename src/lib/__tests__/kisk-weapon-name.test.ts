import { describe, expect, it } from "vitest";
import { parseKiskGear } from "../kisk/parse";
import { fillIdeals, missingIdeals } from "../kisk/api";
import { slotFromName } from "../knowledge/slots";

// Asna's longbow (Tyron 2026-11-26): the name does not say "bow", kisk's ideal label says "Weapon"
const lines = [
  "Elyos Ranger", "+15", "Enraged Kromede Longbow", "Lv 86 Unique, exceed 3", "Score", "45", "S",
  "Precision 31", "/ 31", "99%", "Multi-hit Chance 9.1%", "/ 9.1%", "98%", "2 of 6 ideal lines", "Ideal", "★", "Ideal Ranger Weapon",
  "Best in slot", "Score", "100", "BiS", "Combat Speed 13.0%", "100%", "Precision 32", "99%", "Yours has 1 of these 2",
];
const opts = { region: "eu", server: "odar", name: "ASNA", url: "u", mode: "paste" as const };

describe("weapons with their own names", () => {
  it("finds the slot from kisk's ideal label", () => {
    const c = parseKiskGear(lines, opts);
    expect(c.gear).toHaveLength(1);
    expect(c.gear[0]).toMatchObject({ slot: "weapon", name: "Enraged Kromede Longbow", grade: "S" });
    expect(c.gear[0].ideal?.map((l) => l.name)).toEqual(["Combat Speed", "Precision"]);
  });
  it("knows more weapon words", () => {
    for (const n of ["Enraged Kromede Longbow", "Noble Longsword", "Fury Claymore", "Ludra's Grimoire", "Iron Warhammer"]) expect(slotFromName(n)).toBe("weapon");
    expect(slotFromName("Nuakum Gauntlets")).toBe("gloves");
  });
  it("fills missing BiS lines from the page", () => {
    const page = parseKiskGear(lines, opts);
    const live = { ...page, gear: [{ ...page.gear[0], ideal: undefined, grade: "?" as const }] };
    expect(missingIdeals(live)).toBe(true);
    const filled = fillIdeals(live, page)!;
    expect(filled.gear[0].ideal).toEqual(page.gear[0].ideal);
    expect(missingIdeals(filled)).toBe(false);
  });
});
