import { describe, expect, it } from "vitest";
import { bodyItems, weaponKindFor } from "../hologram";
import { FLORENTINA } from "../fixtures/florentina";
import type { Item } from "../types";

const w = (name: string): Item => ({ slot: "weapon", name, grade: "A", lines: [], scored: true });

describe("weaponKindFor", () => {
  it("reads the weapon type from the item name", () => {
    expect(weaponKindFor(FLORENTINA)).toBe("orb");
    expect(weaponKindFor({ gear: [w("True Dragon Lord Greatsword")] })).toBe("greatsword");
    expect(weaponKindFor({ gear: [w("True Dragon Lord Longsword")] })).toBe("sword");
    expect(weaponKindFor({ gear: [w("Nuakum Spellbook")] })).toBe("spellbook");
  });
  it("falls back to the class weapon", () => {
    expect(weaponKindFor({ className: "Ranger", gear: [] })).toBe("bow");
    expect(weaponKindFor({ className: "Unbekannt", gear: [] })).toBe("sword");
  });
});

describe("bodyItems", () => {
  it("numbers paired slots and skips arcana and runes", () => {
    const m = bodyItems(FLORENTINA);
    expect(m.get("ring:0")?.grade).toBe("D");
    expect(m.get("ring:1")?.grade).toBe("A");
    expect(m.get("weapon:0")?.name).toContain("Orb");
    expect([...m.keys()].some((k) => k.startsWith("rune") || k.startsWith("arcana"))).toBe(false);
  });
});
