import { describe, expect, it } from "vitest";
import { craftedBis } from "../crafted-bis";
import { regionStatus } from "../region";

describe("crafted best in slot (Global)", () => {
  const asmo = { className: "Spiritmaster", race: "Asmodian" };
  it("uses the class weapon of the faction line", () => {
    const w = craftedBis(asmo, "weapon")!;
    expect(w.name).toBe("Splendent Ebony Dragon Lord Orb");
    expect(w.level).toBe(102);
    expect(regionStatus(w)).toBe("eu");
    expect(w.icon).toContain("Icon_WP_OR_0100_T06.png");
    expect(craftedBis({ className: "Templar", race: "Elyos" }, "weapon")!.name).toBe("Splendent Wise Dragon Lord Longsword");
  });
  it("covers armour and jewellery, but not slots without a recipe", () => {
    expect(craftedBis(asmo, "helmet")!.name).toBe("Splendent Ebony Dragon Lord Helm");
    expect(craftedBis(asmo, "ring")!.name).toBe("Splendent Ebony Dragon Lord Ring");
    expect(craftedBis(asmo, "ring")!.icon).toContain("Icon_ACC_Ring_0047.png"); // by item ID 310330040
    expect(craftedBis(asmo, "belt")).toBeUndefined();
    expect(craftedBis(asmo, "arcana")).toBeUndefined();
  });
});
