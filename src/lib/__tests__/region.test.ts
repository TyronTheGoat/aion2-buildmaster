import { describe, expect, it } from "vitest";
import { PUBLIC_ITEMS, regionStatus } from "../region";
import { ALL_ITEMS, findCatalogItem, iconFor } from "../knowledge/item-catalog";

describe("EU / Global filter", () => {
  it("only releases items with EU evidence", () => {
    expect(PUBLIC_ITEMS.length).toBeGreaterThan(0);
    expect(PUBLIC_ITEMS.every((i) => i.regions.some((r) => r.region === "EU"))).toBe(true);
  });

  it("keeps Taiwan-only and unclear items internally", () => {
    const tw = ALL_ITEMS.filter((i) => regionStatus(i) === "tw");
    const unclear = ALL_ITEMS.filter((i) => regionStatus(i) === "unclear");
    expect(tw.length).toBeGreaterThan(0);
    expect(unclear.length).toBeGreaterThan(0);
    expect(PUBLIC_ITEMS.some((i) => tw.includes(i) || unclear.includes(i))).toBe(false);
  });

  it("marks gear seen on the EU character as EU with evidence", () => {
    // kisk shows only the name; it belongs to two TW item IDs, so the EU evidence stays on a separate name entry
    const orb = PUBLIC_ITEMS.find((i) => i.name === "Splendent Ebony Dragon Lord Orb")!;
    expect(regionStatus(orb)).toBe("eu");
    expect(orb.regions[0].source).toContain("kisk.app");
    const ids = ALL_ITEMS.filter((i) => i.name === orb.name && i.itemId);
    expect(ids.length).toBeGreaterThan(1);
    expect(ids.every((i) => regionStatus(i) === "tw")).toBe(true);
  });

  it("does not match ambiguous names to an icon", () => {
    // "Fierce Battle Amulet" exists with several item IDs (rarities)
    expect(findCatalogItem("Fierce Battle Amulet")).toBeUndefined();
    expect(iconFor({ name: "Nuakum Guard" })).toBeUndefined();
    // the icon kisk.app delivers is still used
    expect(iconFor({ name: "Nuakum Guard", icon: "https://x/Icon_Weapon_Guarder_L_012.png" })).toContain("Icon_Weapon_Guarder_L_012.png");
    // by ID it is unambiguous
    expect(iconFor({ name: "?", itemId: "115030051" })).toContain("Icon_Weapon_Guarder_L_012.png");
  });
});
