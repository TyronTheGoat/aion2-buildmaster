import type { Character, IdealLine, Item, StatLine } from "../types";

/** Snapshot of kisk.app/c/eu/odar/Florentina/gear (kisk gear data 2026-11-22 23:08 UTC), used as demo/test data. */
const s = (name: string, value: string, max?: string, share?: number): StatLine => ({ name, value, max, share });
const ideal = (...pairs: [string, string][]): IdealLine[] => pairs.map(([name, value]) => ({ name, value }));
const CDN = "https://assets.playnccdn.com/static-aion2-gamedata/resources/";
const it = (p: Omit<Item, "scored" | "icon"> & { scored?: boolean; icon?: string }): Item =>
  ({ scored: true, ...p, icon: p.icon ? CDN + p.icon : undefined });

const ARMOR_SKILLS: [string, string][] = [["Spirit Strike", "+1"], ["Mental Focus", "+1"], ["Element Unification", "+1"]];
const EARRING_IDEAL = ideal(["Move Speed", "6.5%"], ["Might", "16"], ["Attack", "33"], ["Precision", "16"], ["Accuracy", "61"], ["Critical Hit", "47"]);
const RING_IDEAL = ideal(["Might", "14"], ["Precision", "14"], ["Attack", "29"], ["Elemental Fusion", "+1"], ["Combustion", "+1"], ["Summon: Fire Spirit", "+1"]);
const BRACELET_IDEAL = ideal(["Illusion [Kaisinel]", "17"], ["Time [Siel]", "17"], ["Destruction [Zikel]", "17"], ["Wisdom [Lumiel]", "17"], ["Justice [Nezekan]", "17"]);

export const FLORENTINA: Character = {
  region: "eu",
  server: "odar",
  name: "Florentina",
  className: "Spiritmaster",
  race: "Asmodian",
  level: 45,
  combatPower: 195377,
  legion: "NargileNinja",
  gearGrade: "S",
  // linked on kisk.app (og:image), 2026-11-22
  portrait: "https://profileimg.plaync.com/game_profile_images/aion2global/images?gameServerKey=2314&charKey=651333096108652459",
  source: { url: "https://kisk.app/c/eu/odar/Florentina/gear", fetchedAt: "2026-11-22T23:08:00Z", mode: "demo" },
  warnings: [],
  gear: [
    it({ slot: "weapon", name: "Splendent Ebony Dragon Lord Orb", icon: "Icon_WP_OR_0100_T06.png", level: 102, rarity: "Unique", exceed: 3, enhance: 15, grade: "S+", score: 79,
      lines: [s("Might", "32", "32", 100), s("Attack", "51", "51", 76), s("Weapon Damage Boost", "9.6%", "9.6%", 100), s("Combat Speed", "13.0%", "13.0%", 100), s("Multi-hit Chance", "9.6%", "9.6%", 97), s("Critical Attack", "102", "102", 0)],
      ideal: ideal(["Combat Speed", "13.0%"], ["Weapon Damage Boost", "9.6%"], ["Might", "32"], ["Damage Boost", "7.3%"], ["Precision", "32"], ["Multi-hit Chance", "9.6%"]) }),
    it({ slot: "offhand", name: "Nuakum Guard", icon: "Icon_Weapon_Guarder_L_012.png", level: 86, rarity: "Unique", enhance: 13, grade: "S", score: 47,
      lines: [s("Weapon Damage Boost", "7.3%", "7.3%", 100), s("Damage Boost", "5.5%", "5.5%", 100), s("Combat Speed", "9.6%", "9.6%", 100), s("Accuracy", "76", "76", 0)],
      ideal: ideal(["Combat Speed", "10.1%"], ["Weapon Damage Boost", "7.7%"], ["Might", "27"], ["Damage Boost", "5.8%"], ["Precision", "27"], ["Multi-hit Chance", "7.7%"]) }),
    it({ slot: "torso", name: "Nuakum Breastplate", icon: "Icon_Equip_AR_L_Idris_01_Torso.png", level: 86, rarity: "Unique", enhance: 10, grade: "A", score: 29,
      lines: [s("Block", "27", "38", 0), s("Damage Boost", "5.4%", "6.2%", 100), s("Attack", "23", "32", 96), s("Spirit Protection", "+13%")],
      ideal: ideal(["Damage Boost", "6.6%"], ["Perfect Chance", "5.8%"], ["Attack", "33"], ...ARMOR_SKILLS) }),
    it({ slot: "pants", name: "Nuakum Greaves", icon: "Icon_Equip_AR_L_Idris_01_Pants.png", level: 86, rarity: "Unique", enhance: 10, grade: "D", score: 0,
      lines: [s("Front Defense", "253", "291", 0), s("Critical Hit Resist", "46", "56", 0), s("Block", "25", "36", 0), s("Spirit Communion", "+10%")],
      ideal: ideal(["Attack increase", "2.4%"], ["Damage Tolerance", "11.6%"], ["Perfect Chance", "5.3%"], ["Attack", "31"], ["Spirit Strike", "+1"], ["Mental Focus", "+1"]) }),
    it({ slot: "helmet", name: "Nuakum Helm", icon: "Icon_Equip_AR_L_Idris_01_Helmet.png", level: 86, rarity: "Unique", enhance: 10, grade: "B", score: 16,
      lines: [s("Dexterity", "12", "19", 0), s("MP", "97", "104", 0), s("Consecutive Countercurrent", "+10%"), s("Mental Focus", "+1", undefined, 80)],
      ideal: ideal(["Attack increase", "2.2%"], ["Double Chance", "2.2%"], ["Attack", "29"], ...ARMOR_SKILLS) }),
    it({ slot: "shoulders", name: "Nuakum Pauldrons", icon: "Icon_Equip_AR_L_Idris_01_Shoulder.png", level: 86, rarity: "Unique", enhance: 10, grade: "D", score: 5,
      lines: [s("Critical Hit", "24", "32", 30), s("Dexterity", "18", "23", 30), s("Critical Hit Resist", "34", "43", 30), s("Spirit Protection", "+14%")],
      ideal: ideal(["Critical Damage Boost", "12.8%"], ["Double Chance", "1.8%"], ["Attack", "24"], ...ARMOR_SKILLS) }),
    it({ slot: "gloves", name: "Nuakum Gloves", icon: "Icon_Equip_AR_L_Idris_01_Gloves.png", level: 86, rarity: "Unique", enhance: 10, grade: "S", score: 46,
      lines: [s("Combat Speed", "6.9%", "6.9%", 100), s("Consecutive Countercurrent", "+10%"), s("Mental Focus", "+1", undefined, 81), s("Element Unification", "+1", undefined, 63)],
      ideal: ideal(["Combat Speed", "7.2%"], ["Perfect Chance", "3.4%"], ["Attack", "22"], ...ARMOR_SKILLS) }),
    it({ slot: "boots", name: "Nuakum Boots", icon: "Icon_Equip_AR_L_Idris_01_Boots.png", level: 86, rarity: "Unique", enhance: 10, grade: "D", score: 2,
      lines: [s("MP", "79", "93", 0), s("Front Defense", "203", "239", 0), s("Accuracy", "34", "45", 16), s("Spirit Protection", "+11%")],
      ideal: ideal(["Move Speed", "10.3%"], ["Perfect Chance", "4.4%"], ["Attack", "27"], ...ARMOR_SKILLS) }),
    it({ slot: "cape", name: "Nuakum Cloak", icon: "Icon_Equip_AR_L_Idris_01_Cape.png", level: 86, rarity: "Unique", enhance: 10, grade: "D", score: 0,
      lines: [s("Critical Hit", "25", "32", 3), s("Critical Damage Defense", "179", "213", 0), s("Natural HP Regen", "33", "43", 0), s("Block", "18", "28", 0)],
      ideal: ideal(["Attack increase", "1.8%"], ["Double Chance", "1.8%"], ["Attack", "24"], ...ARMOR_SKILLS) }),
    it({ slot: "necklace", name: "Enraged Kromede Necklace", icon: "Icon_ACC_NL_0053.png", level: 86, rarity: "Unique", enhance: 10, grade: "S+", score: 62,
      lines: [s("Accuracy", "67", "67", 87), s("Attack", "36", "36", 100), s("Critical Hit", "52", "52", 83), s("Combat Speed", "4.1%", "4.1%", 100)],
      ideal: ideal(["Combat Speed", "4.4%"], ["Might", "20"], ["Attack", "38"], ["Precision", "20"], ["Accuracy", "70"], ["Spirit Strike", "+1"]) }),
    it({ slot: "earring", name: "Enraged Kromede Earrings", icon: "Icon_ACC_ER_0053.png", level: 86, rarity: "Unique", enhance: 10, grade: "A", score: 32,
      lines: [s("HP", "209", "239", 1), s("Accuracy", "46", "59", 89), s("Spirit Strike", "+1", undefined, 85), s("Corrode", "+1", undefined, 33)], ideal: EARRING_IDEAL }),
    it({ slot: "earring", name: "Enraged Kromede Earrings", icon: "Icon_ACC_ER_0053.png", level: 86, rarity: "Unique", enhance: 10, grade: "A", score: 25,
      lines: [s("Accuracy", "46", "59", 89), s("Critical Hit", "41", "45", 89), s("Flight Power", "254", "289", 90), s("MP", "104", "122", 20)], ideal: EARRING_IDEAL }),
    it({ slot: "ring", name: "Enraged Kromede Ring", icon: "Icon_ACC_Ring_0053.png", level: 86, rarity: "Unique", enhance: 10, grade: "A", score: 30,
      lines: [s("Accuracy", "37", "50", 25), s("Block", "25", "32", 0), s("Elemental Fusion", "+1", undefined, 85), s("Jointstrike: Curse", "+1", undefined, 60)], ideal: RING_IDEAL }),
    it({ slot: "ring", name: "Enraged Kromede Ring", icon: "Icon_ACC_Ring_0053.png", level: 86, rarity: "Unique", enhance: 10, grade: "A", score: 32,
      lines: [s("Block", "23", "32", 0), s("Summon: Fire Spirit", "+1", undefined, 79), s("Jointstrike: Curse", "+1", undefined, 60), s("Summon: Earth Spirit", "+1", undefined, 33)], ideal: RING_IDEAL }),
    it({ slot: "bracelet", name: "Ascension Bracelet", icon: "Icon_Acc_Bracelet_R_027.png", level: 51, rarity: "Unique", enhance: 10, grade: "D", score: 0, fixedLines: true,
      lines: [s("Evasion", "120%"), s("Critical Hit", "90%"), s("MP", "260%"), s("Natural MP Regen", "90%")], ideal: BRACELET_IDEAL }),
    it({ slot: "bracelet", name: "Liberator Bracelet", icon: "Icon_ACC_Bracelet_0071.png", level: 43, rarity: "Legend", enhance: 10, grade: "D", score: 0, fixedLines: true,
      lines: [s("Critical Hit", "80%"), s("MP", "220%"), s("Natural MP Regen", "80%")], ideal: BRACELET_IDEAL }),
    it({ slot: "belt", name: "Noble Belt", icon: "Icon_Acc_Belt_C_022.png", level: 65, rarity: "Unique", enhance: 10, grade: "?", lines: [], scored: false }),
    it({ slot: "rune", name: "Clash Rune", icon: "Icon_Acc_Rune_R_002.png", level: 40, rarity: "Special", enhance: 4, grade: "?", lines: [], scored: false }),
    it({ slot: "rune", name: "Clash Rune", icon: "Icon_Acc_Rune_R_002.png", level: 40, rarity: "Special", enhance: 4, grade: "?", lines: [], scored: false }),
    it({ slot: "amulet", name: "Revelation Amulet", icon: "Icon_Item_Craft_Conversion_Crystal_L_lv5_01.png", level: 65, rarity: "Unique", enhance: 10, grade: "?", lines: [], scored: false }),
  ],
  arcana: [
    it({ slot: "arcana", name: "Chalice of Vigor", icon: "Icon_Arcana_Card_Grail_u_PveSet2.png", level: 80, rarity: "Unique", enhance: 5, grade: "S+", score: 57,
      lines: [s("Spirit Protection", "+2", undefined, 9), s("Soul's Cry", "+2", undefined, 0), s("Summon: Fire Spirit", "+1", undefined, 79), s("Combustion", "+4", undefined, 84)],
      ideal: ideal(["Spirit Strike", "+4"], ["Mental Focus", "+3"], ["Elemental Fusion", "+1"], ["Combustion", "+1"]) }),
    it({ slot: "arcana", name: "Parchment of Vigor", icon: "Icon_Arcana_Card_Parchment_u_PveSet2.png", level: 80, rarity: "Unique", enhance: 5, grade: "BiS", score: 94,
      lines: [s("Jointstrike: Curse", "+3", undefined, 60), s("Cold Shock", "+1", undefined, 75), s("Summon: Fire Spirit", "+2", undefined, 79), s("Elemental Fusion", "+3", undefined, 85)],
      ideal: ideal(["Elemental Fusion", "+4"], ["Summon: Fire Spirit", "+3"], ["Cold Shock", "+1"], ["Jointstrike: Curse", "+1"]) }),
    it({ slot: "arcana", name: "Compass of Vigor", icon: "Icon_Arcana_Card_Compass_u_PveSet2.png", level: 80, rarity: "Unique", enhance: 5, grade: "S", score: 46,
      lines: [s("Summon: Wind Spirit", "+4", undefined, 0), s("Summon: Water Spirit", "+1", undefined, 34), s("Combustion", "+2", undefined, 84), s("Defiance", "+2", undefined, 0)],
      ideal: ideal(["Combustion", "+4"], ["Summon: Water Spirit", "+3"]) }),
    it({ slot: "arcana", name: "Bell of Magic", icon: "Icon_Arcana_Card_Bell_u_DefenceSet2.png", level: 80, rarity: "Unique", enhance: 5, grade: "BiS", score: 98,
      lines: [s("Element Unification", "+3", undefined, 81), s("Spirit Revitalization", "+3", undefined, 78), s("Spirit Strike", "+2", undefined, 85), s("Spirit's Descent", "+1", undefined, 10)],
      ideal: ideal(["Spirit Strike", "+4"], ["Element Unification", "+3"], ["Spirit Revitalization", "+1"], ["Spirit's Descent", "+1"]) }),
    it({ slot: "arcana", name: "Mirror of Vigor", icon: "Icon_Arcana_Card_Mirror_u_PveSet2.png", level: 80, rarity: "Unique", enhance: 5, grade: "S+", score: 88,
      lines: [s("Spirit Protection", "+1", undefined, 9), s("Corrode", "+1", undefined, 33), s("Consecutive Countercurrent", "+3", undefined, 6), s("Mental Focus", "+4", undefined, 85)],
      ideal: ideal(["Mental Focus", "+4"], ["Corrode", "+3"], ["Spirit Protection", "+1"], ["Consecutive Countercurrent", "+1"]) }),
  ],
};
