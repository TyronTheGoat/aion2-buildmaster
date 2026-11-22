import type { Character, Grade, Item, SlotKind } from "../types";

/**
 * Short snapshots of five EU / Odar characters from kisk.app (gear page, 2026-11-22): name, item level,
 * upgrade level, grade and score per slot, plus the portrait link. Stat lines and BiS lines are not part of
 * these snapshots; "Refresh" (paste or live) fills them in.
 */
type Row = [SlotKind, string, Grade, number | undefined, number | undefined, number | undefined]; // slot, name, grade, score, level, enhance
const items = (rows: Row[]): Item[] => rows.map(([slot, name, grade, score, level, enhance]) => ({
  slot, name, grade, score, level, enhance, lines: [], scored: score !== undefined,
}));
const STD_UNSCORED: Row[] = [
  ["belt", "Noble Belt", "?", undefined, 65, undefined], ["rune", "Clash Rune", "?", undefined, 40, undefined],
  ["rune", "Clash Rune", "?", undefined, 40, undefined], ["amulet", "Revelation Amulet", "?", undefined, 65, undefined],
];
const PORTRAIT = (key: string) => `https://profileimg.plaync.com/game_profile_images/aion2global/images?gameServerKey=2314&charKey=${key}`;
const char = (name: string, className: string, combatPower: number, gearGrade: Grade, portrait: string, gear: Row[], arcana: Row[]): Character => ({
  region: "eu", server: "odar", name, className, race: "Asmodian", level: 45, combatPower, gearGrade, portrait,
  source: { url: `https://kisk.app/c/eu/odar/${name}/gear`, fetchedAt: "2026-11-22T13:50:00Z", mode: "demo" },
  warnings: ["Kurzdaten: Werte und BiS-Linien über „Aktualisieren“ laden."],
  gear: items(gear), arcana: items(arcana),
});

export const ODAR_CHARS: Character[] = [
  char("ASNA", "Ranger", 167344, "S", PORTRAIT("651333096108699568"), [
    ["weapon", "Enraged Kromede Longbow", "S", 45, 86, undefined], ["offhand", "Nuakum Guard", "S", 45, 86, undefined],
    ["torso", "Nuakum Breastplate", "B", 17, 86, undefined], ["pants", "Nuakum Greaves", "B", 20, 86, undefined],
    ["helmet", "Nuakum Helm", "S", 44, 86, undefined], ["shoulders", "Nuakum Pauldrons", "S", 47, 86, undefined],
    ["gloves", "Nuakum Gloves", "S", 36, 86, undefined], ["boots", "Nuakum Boots", "A", 26, 86, undefined],
    ["cape", "Nuakum Cloak", "D", 1, 86, undefined], ["necklace", "Enraged Kromede Necklace", "S", 51, 86, undefined],
    ["earring", "Enraged Kromede Earrings", "A", 33, 86, undefined], ["earring", "Enraged Kromede Earrings", "S", 42, 86, undefined],
    ["ring", "Enraged Kromede Ring", "A", 26, 86, undefined], ["ring", "Enraged Kromede Ring", "A", 22, 86, undefined],
    ["bracelet", "Ascension Bracelet", "D", 0, 51, undefined], ["bracelet", "Liberator Bracelet", "D", 0, 43, undefined],
    ...STD_UNSCORED,
  ], [
    ["arcana", "Chalice of Vigor", "S+", 56, 80, undefined], ["arcana", "Parchment of Vigor", "BiS", 99, 80, undefined],
    ["arcana", "Compass of Magic", "S", 36, 80, undefined], ["arcana", "Bell of Magic", "S+", 77, 80, undefined],
    ["arcana", "Mirror of Magic", "S+", 78, 80, undefined],
  ]),
  char("WRVITH", "Sorcerer", 181057, "S", PORTRAIT("651333096108653702"), [
    ["weapon", "Enraged Kromede Spellbook", "A", 32, 86, 15], ["offhand", "Nuakum Guard", "S+", 63, 86, 13],
    ["torso", "Nuakum Breastplate", "B", 21, 86, 12], ["pants", "Nuakum Greaves", "D", 0, 86, 12],
    ["helmet", "Nuakum Helm", "A", 28, 86, 12], ["shoulders", "Nuakum Pauldrons", "S", 37, 86, 12],
    ["gloves", "Nuakum Gloves", "S", 45, 86, 12], ["boots", "Nuakum Boots", "B", 17, 86, 12],
    ["cape", "Nuakum Cloak", "D", 0, 86, 10], ["necklace", "Enraged Kromede Necklace", "S+", 60, 86, 12],
    ["earring", "Enraged Kromede Earrings", "C", 7, 86, 12], ["earring", "Enraged Kromede Earrings", "B", 19, 86, 12],
    ["ring", "Enraged Kromede Ring", "B", 17, 86, 12], ["ring", "Enraged Kromede Ring", "D", 2, 86, 12],
    ["bracelet", "Ascension Bracelet", "D", 0, 51, 12], ["bracelet", "Liberator Bracelet", "D", 0, 43, 10],
    ...STD_UNSCORED,
  ], [
    ["arcana", "Chalice of Vigor", "S+", 88, 80, 5], ["arcana", "Parchment of Vigor", "BiS", 99, 80, 5],
    ["arcana", "Compass of Magic", "S+", 67, 80, 5], ["arcana", "Bell of Magic", "BiS", 91, 80, 5],
    ["arcana", "Mirror of Vigor", "S+", 61, 80, 5],
  ]),
  char("Creapure", "Gladiator", 169208, "A", PORTRAIT("651333096108652384"), [
    ["weapon", "Splendent Dark Dragon Lord Greatsword", "S+", 62, 86, undefined], ["offhand", "Nuakum Guard", "S", 46, 86, undefined],
    ["torso", "Nuakum Breastplate", "S", 36, 86, undefined], ["pants", "Nuakum Greaves", "C", 9, 86, undefined],
    ["helmet", "Nuakum Helm", "C", 11, 86, undefined], ["shoulders", "Nuakum Pauldrons", "B", 17, 86, undefined],
    ["gloves", "Nuakum Gloves", "S", 42, 86, undefined], ["boots", "Nuakum Boots", "B", 16, 86, undefined],
    ["cape", "Nuakum Cloak", "D", 0, 86, undefined], ["necklace", "Enraged Kromede Necklace", "A", 25, 86, undefined],
    ["earring", "Enraged Kromede Earrings", "C", 7, 86, undefined], ["earring", "Enraged Kromede Earrings", "B", 18, 86, undefined],
    ["ring", "Aulamus Ring", "A", 25, 70, undefined], ["ring", "Enraged Kromede Ring", "B", 13, 86, undefined],
    ["bracelet", "Ascension Bracelet", "D", 0, 51, undefined], ["bracelet", "Liberator Bracelet", "D", 0, 43, undefined],
    ...STD_UNSCORED,
  ], [
    ["arcana", "Chalice of Vigor", "S+", 66, 80, undefined], ["arcana", "Parchment of Vigor", "S+", 76, 80, undefined],
    ["arcana", "Compass of Magic", "S+", 58, 80, undefined], ["arcana", "Bell of Magic", "S", 53, 80, undefined],
    ["arcana", "Mirror of Magic", "BiS", 100, 80, undefined],
  ]),
  char("Healga", "Cleric", 77452, "C", PORTRAIT("651333096108762792"), [
    ["weapon", "Spiritforged Mace", "C", 8, 45, undefined], ["offhand", "Spiritforged Guard", "C", 6, 45, undefined],
    ["torso", "Bakarma Breastplate", "D", 0, 54, undefined], ["pants", "Unyielding Greaves", "C", 11, 42, undefined],
    ["helmet", "Bakarma Helm", "C", 6, 54, undefined], ["shoulders", "Bakarma Pauldrons", "C", 7, 54, undefined],
    ["gloves", "Vakron Gloves", "A", 23, 70, undefined], ["boots", "Bakarma Boots", "B", 17, 54, undefined],
    ["cape", "Bakarma Cloak", "B", 16, 54, undefined], ["necklace", "Liberator Necklace", "D", 0, 43, undefined],
    ["earring", "Liberator Earrings", "D", 3, 43, undefined], ["earring", "Liberator Earrings", "D", 3, 43, undefined],
    ["ring", "Liberator Ring", "D", 0, 43, undefined], ["ring", "Liberator Ring", "D", 0, 43, undefined],
    ["bracelet", "Ascension Bracelet", "D", 0, 51, undefined], ["bracelet", "Liberator Bracelet", "D", 0, 43, undefined],
    ["belt", "Noble Belt", "?", undefined, 36, undefined], ...STD_UNSCORED.slice(1),
  ], []),
  char("TestoSpritze", "Chanter", 102759, "C", PORTRAIT("651333096108757532"), [
    ["weapon", "Aulamus Staff", "A", 26, undefined, undefined], ["offhand", "Vakron Guard", "C", 12, undefined, undefined],
    ["torso", "Vakron Breastplate", "D", 1, undefined, undefined], ["pants", "Vakron Greaves", "B", 13, undefined, undefined],
    ["helmet", "Gartua Helm", "D", 0, undefined, undefined], ["shoulders", "Vakron Pauldrons", "D", 0, undefined, undefined],
    ["gloves", "Vakron Gloves", "D", 0, undefined, undefined], ["boots", "Vakron Boots", "D", 1, undefined, undefined],
    ["cape", "Vakron Cloak", "D", 0, undefined, undefined], ["necklace", "Aulamus Necklace", "C", 8, undefined, undefined],
    ["earring", "Aulamus Earrings", "C", 9, undefined, undefined], ["earring", "Aulamus Earrings", "B", 14, undefined, undefined],
    ["ring", "Aulamus Ring", "C", 5, undefined, undefined], ["ring", "Aulamus Ring", "B", 15, undefined, undefined],
    ["bracelet", "Ascension Bracelet", "D", 0, undefined, undefined], ["bracelet", "Liberator Bracelet", "D", 0, undefined, undefined],
    ...STD_UNSCORED,
  ], [
    ["arcana", "Chalice of Magic", "B", 22, 40, undefined], ["arcana", "Parchment of Vigor", "C", 6, 20, undefined],
    ["arcana", "Compass of Vigor", "C", 6, 20, undefined], ["arcana", "Bell of Vigor", "D", 0, 20, undefined],
    ["arcana", "Mirror of Magic", "A", 23, 60, undefined],
  ]),
];
