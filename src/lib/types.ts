export type Grade = "BiS" | "S+" | "S" | "A" | "B" | "C" | "D" | "?";

export type SlotKind =
  | "weapon" | "offhand" | "torso" | "pants" | "helmet" | "shoulders" | "gloves"
  | "boots" | "cape" | "necklace" | "earring" | "ring" | "bracelet"
  | "belt" | "rune" | "amulet" | "arcana" | "unknown";

export interface StatLine {
  name: string;
  /** Rolled value as shown, e.g. "32" or "9.6%" or "+3" */
  value: string;
  /** Max possible roll if kisk shows it */
  max?: string;
  /** % of top players of the class carrying this line on this slot (kisk "share"), if shown */
  share?: number;
}

export interface Item {
  slot: SlotKind;
  name: string;
  level?: number;
  rarity?: string;
  enhance?: number;
  exceed?: number;
  score?: number;
  grade: Grade;
  lines: StatLine[];
  /** true if lines cannot be rerolled (e.g. bracelets with fixed lines) */
  fixedLines?: boolean;
  scored: boolean;
}

export interface Character {
  region: string;
  server: string;
  name: string;
  className?: string;
  race?: string;
  level?: number;
  combatPower?: number;
  gearGrade?: Grade;
  gear: Item[];
  arcana: Item[];
  source: { url: string; fetchedAt: string; mode: "live" | "paste" | "demo" };
  warnings: string[];
}
