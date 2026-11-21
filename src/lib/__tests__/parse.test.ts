import { describe, expect, it } from "vitest";
import { parseKiskGear } from "../kisk/parse";
import { htmlToLines, textToLines } from "../kisk/html-to-text";

const opts = { region: "eu", server: "odar", name: "Florentina", url: "x", mode: "paste" as const };

// Text roughly as a browser "select all + copy" of the kisk gear page yields it.
const PASTED = `
Florentina
Asmodian Spiritmaster · Lv 45 · Odar
193,085 CP
Gear
A
Splendent Ebony Dragon Lord Orb
Lv 102 Unique · exceed 3
+15
S+
79
Might 32/32 100%
Attack 51/51 76%
Weapon Damage Boost 9.6%/9.6% 100%
Critical Attack 102/102 0%
Ideal
Weapon Damage Boost
Combat Speed
Yours has 4 of these 6
Nuakum Breastplate
Lv 86 Unique
+10
D 0
Natural HP Regen
47
/
61
0%
Evasion 30/37 0%
Ascension Bracelet
Lv 51 Unique
+10
D
0
Evasion 120%
Critical Hit 90%
Chalice of Vigor
Lv 80 Unique
+5
S+ 57
Spirit Protection +2/+4 9%
Combustion +4/+4 84%
Noble Belt
Lv 65 Unique
+10
`;

describe("parseKiskGear", () => {
  const c = parseKiskGear(textToLines(PASTED), opts);

  it("reads the header", () => {
    expect(c.className).toBe("Spiritmaster");
    expect(c.race).toBe("Asmodian");
    expect(c.combatPower).toBe(193085);
    expect(c.gearGrade).toBe("A");
  });

  it("finds items and slots", () => {
    expect(c.gear.map((i) => i.slot)).toEqual(["weapon", "torso", "bracelet", "belt"]);
    expect(c.arcana.map((i) => i.name)).toEqual(["Chalice of Vigor"]);
  });

  it("reads weapon details and skips ideal block", () => {
    const w = c.gear[0];
    expect(w).toMatchObject({ level: 102, rarity: "Unique", exceed: 3, enhance: 15, grade: "S+", score: 79 });
    expect(w.lines.map((l) => l.name)).toEqual(["Might", "Attack", "Weapon Damage Boost", "Critical Attack"]);
    expect(w.lines[1]).toMatchObject({ value: "51", max: "51", share: 76 });
  });

  it("joins stats split across lines", () => {
    const t = c.gear[1];
    expect(t.grade).toBe("D");
    expect(t.lines[0]).toMatchObject({ name: "Natural HP Regen", value: "47", max: "61", share: 0 });
    expect(t.lines).toHaveLength(2);
  });

  it("flags fixed bracelet lines and unscored belt", () => {
    expect(c.gear[2].fixedLines).toBe(true);
    expect(c.gear[3].scored).toBe(false);
  });

  it("parses arcana", () => {
    expect(c.arcana[0]).toMatchObject({ grade: "S+", score: 57, enhance: 5 });
    expect(c.arcana[0].lines[0]).toMatchObject({ name: "Spirit Protection", value: "2", max: "4", share: 9 });
  });

  it("works on HTML too", () => {
    const html = `<html><body><script>x()</script><div><h3>Nuakum Guard</h3><span>Lv 86 Unique</span><span>+13</span><b>S</b><b>47</b>
      <ul><li><span>Damage Boost</span> <span>5.5%/5.5%</span> <span>100%</span></li></ul></div></body></html>`;
    const h = parseKiskGear(htmlToLines(html), opts);
    expect(h.gear[0]).toMatchObject({ slot: "offhand", grade: "S", score: 47, enhance: 13 });
    expect(h.gear[0].lines[0]).toMatchObject({ name: "Damage Boost", value: "5.5%", share: 100 });
  });
});
