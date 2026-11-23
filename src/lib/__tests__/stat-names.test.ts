import { describe, expect, it } from "vitest";
import { FLORENTINA } from "../fixtures/florentina";
import * as odar from "../fixtures/odar-chars";
import { IDEAL_LINES } from "../knowledge/ideal-lines";
import { hasGerman, statLabel } from "../stat-names";

describe("German stat and skill names", () => {
  it("keeps English as delivered", () => {
    expect(statLabel("Double Chance", "en")).toBe("Double Chance");
    expect(statLabel("Double Chance", "de")).toBe("Wucht");
    expect(statLabel("Summon: Fire Spirit", "de")).toBe("Beschwörung: Feuergeist");
    expect(statLabel("Unknown Line", "de")).toBe("Unknown Line");
  });
  it("covers the lines of the demo characters and the ideal tables", () => {
    const chars = [FLORENTINA, ...Object.values(odar).flatMap((v) => (Array.isArray(v) ? v : v && typeof v === "object" && "gear" in v ? [v] : []))];
    const names = new Set<string>();
    for (const c of chars) for (const i of [...c.gear, ...c.arcana]) for (const l of [...i.lines, ...(i.ideal ?? [])]) names.add(l.name);
    for (const t of Object.values(IDEAL_LINES)) for (const slot of Object.values(t)) for (const n of Object.keys(slot ?? {})) names.add(n);
    const missing = [...names].filter((n) => !hasGerman(n));
    expect(missing).toEqual([]);
  });
});
