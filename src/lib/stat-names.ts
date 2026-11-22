/** German labels for stat lines, only where the German client name is confirmed (in-game tooltip). Others stay as kisk.app delivers them. */
const DE: Record<string, string> = {
  Might: "Macht",
  Attack: "Angriffskraft",
  "Weapon Damage Boost": "Verstärkung (Waffenschaden)",
  "Combat Speed": "Kampftempo",
  "Multi-hit Chance": "Mehrfachtreffer",
  "Critical Attack": "Krit.-Angriffskraft",
};
export const statLabel = (name: string) => DE[name] ?? name;
