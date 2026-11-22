/** German labels for stat lines, only where the German client name is confirmed (in-game tooltip). Others stay as kisk.app delivers them. */
const DE: Record<string, string> = {
  Might: "Macht",
  Attack: "Angriffskraft",
  "Weapon Damage Boost": "Verstärkung (Waffenschaden)",
  "Combat Speed": "Kampftempo",
  "Multi-hit Chance": "Mehrfachtreffer",
  "Critical Attack": "Krit.-Angriffskraft",
};
/** In English the name stays as kisk.app delivers it (the game's English name). */
export const statLabel = (name: string, lang: "en" | "de" = "de") => (lang === "en" ? name : DE[name] ?? name);
