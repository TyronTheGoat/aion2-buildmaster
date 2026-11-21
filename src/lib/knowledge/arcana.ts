/** Where Arcana cards drop. Source: metabot.gg Arcana guide (Nov 2026). Verify each season. */
export const ARCANA_SOURCES: Record<string, string[]> = {
  chalice: ["Transzendenz: Deus Research Base (Boss Atiel)", "Transzendenz: Shattered Arkanis (Boss Talisra of the Void)", "Unique-Kelch nur in Stufe 4 (ab Itemlevel 2.500)"],
  compass: ["Transzendenz: Deus Research Base (Boss Atiel)"],
  bell: ["Transzendenz: Deus Research Base (Boss Atiel)"],
  parchment: ["Transzendenz: Shattered Arkanis (Boss Talisra of the Void)"],
  mirror: ["Transzendenz: Shattered Arkanis (Boss Talisra of the Void)"],
};

export const ARCANA_GENERAL_TIPS = [
  "Doppelte Karten extrahieren: das gibt Mysterious Crystals für die Transmutation.",
  "Transmutation baut eine Unique-Karte für Slot und Set deiner Wahl: 5 Kristalle + 2 Mio. Kinah, jede gewählte Nebenlinie kostet 10 Kristalle + 3 Mio. (bis zu 2).",
  "Aufwerten über Training Arcana ist ohne Fehlschlag; investierte EXP bleiben erhalten, wenn die Karte als Material genutzt wird.",
  "Set-Boni: Primal Vigor (2/4 Teile: +60/+150 PvE-Angriff bei ≥70 % HP), Magic Armor (2: MP-Refill, 4: +1.000 PvE-Verteidigung).",
];

export function arcanaType(name: string): string | undefined {
  return name.match(/\b(chalice|parchment|compass|bell|mirror)\b/i)?.[1].toLowerCase();
}
