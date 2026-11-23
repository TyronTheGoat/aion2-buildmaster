/**
 * German names of stat lines and skill lines, as the German client shows them. Source: gamewith.ai AION2 wiki,
 * the same items in English and German side by side (data from the official AION2 site), checked 2026-11-22:
 * items 310330016 (ring), 115040013 (guard), 210140013 (chest), 210240013 (legs), 210340013 (helm),
 * 210440013 (shoulders), 210640013 (boots), 210740013 (cape), 310430041 (bracelet). Names not in that list stay as kisk.app delivers them.
 */
const STATS: Record<string, string> = {
  Might: "Macht",
  Precision: "Präzision",
  Intelligence: "Intelligenz",
  Dexterity: "Agilität",
  Constitution: "Vitalität",
  Willpower: "Wille",
  Attack: "Angriffskraft",
  Defense: "Verteidigung",
  // the German pages call Accuracy "Präzision" as well; the suffix keeps it apart from Precision
  Accuracy: "Präzision (Treffer)",
  Evasion: "Ausweichen",
  "Critical Hit": "Kritischer Treffer",
  "Critical Hit Resist": "Krit.-Widerstand",
  "Critical Attack": "Krit.-Angriffskraft",
  "Critical Damage Defense": "Krit.-Verteidigung",
  "Critical Damage Boost": "Krit.-Schadensverstärkung",
  "Critical Damage Tolerance": "Krit.-Schadensresistenz",
  HP: "LP",
  MP: "MP",
  "Natural HP Regen": "LP-Regeneration (Natürlich)",
  "Natural MP Regen": "MP-Regeneration (Natürlich)",
  Regeneration: "Regeneration",
  "Flight Power": "FP",
  Block: "Block",
  "Back Attack": "Angriffskraft (Rückseitig)",
  "Front Attack": "Angriffskraft (Frontal)",
  "Back Defense": "Verteidigung (Rückseitig)",
  "Front Defense": "Verteidigung (Frontal)",
  "Attack increase": "Angriffskraft +",
  "Defense increase": "Verteidigung +",
  "Combat Speed": "Kampftempo",
  "Move Speed": "Bewegungstempo",
  "Multi-hit Chance": "Mehrfachtreffer",
  "Multi-hit Resist": "Widerstand (Mehrfachtreffer)",
  "Damage Boost": "Schadensverstärkung",
  "Weapon Damage Boost": "Verstärkung (Waffenschaden)",
  "Damage Tolerance": "Schadensresistenz",
  "Weapon Damage Tolerance": "Schadensresistenz (Waffenschaden)",
  "Status Effect Chance": "Statuseffekt-Trefferchance",
  "Status Effect Accuracy": "Statuseffekt-Trefferchance",
  "Status Effect Resist": "Widerstand (Statuseffekte)",
  "Incoming Heal": "Heilung (Erhalten)",
  "Double Chance": "Wucht",
  "Double Resist": "Wucht-Widerstand",
  "Perfect Chance": "Perfektion",
  "Perfect Resist": "Perfekter Widerstand",
  Endurance: "Eisenwall",
  "Endurance Penetration": "Eisenwall-Penetration",
  // Daevanion lines of bracelets (item 310430041)
  "Justice [Nezekan]": "Gerechtigkeit [Nezekan]", "Freedom [Vaizel]": "Freiheit [Vaizel]", "Illusion [Kaisinel]": "Illusion [Kaisinel]",
  "Life [Yustiel]": "Leben [Yustiel]", "Time [Siel]": "Zeit [Siel]", "Destruction [Zikel]": "Zerstörung [Zikel]", "Death [Triniel]": "Tod [Triniel]",
  "Wisdom [Lumiel]": "Weisheit [Lumiel]", "Destiny [Marchutan]": "Schicksal [Marchutan]", "Space [Israphel]": "Raum [Israphel]",
};

/** Class skills (active options on weapons / guards, passive options on armour), English → German, per class in the wiki's order. */
const SKILLS: Record<string, string> = {
  // Gladiator
  "Keen Strike": "Scharfer Schlag", "Leaping Slam": "Sprungangriff", "Overhead Slam": "Abwärtsschlag", "Ankle Slice": "Knöchelschnitt",
  "Aerial Snare": "Luftfesselung", "Ruinous Blow": "Verheerender Schlag", "Rending Blow": "Zerreißender Schlag", "Mocking Blade": "Spottklinge",
  "Rush Strike": "Sturmhieb", "Crushing Wave": "Zerschmetternde Welle", "Sword Aura Rampage": "Klingenraserei",
  "Survival Stance": "Überlebenshaltung", "Blood Absorption": "Blutabsorption", "Attack Preparation": "Angriffsvorbereitung",
  "Destructive Impulse": "Zerstörungsdrang", "Survival Willpower": "Überlebenswille", "Protection Armor": "Schutzrüstung",
  "Identify Weakness": "Schwächenanalyse", "Impact Hit": "Schocktreffer", "Experienced Counterstrike": "Erfahrener Konterangriff",
  "Murderous Burst": "Tödliche Eruption",
  // Templar
  "Vicious Strike": "Brutaler Schlag", Poach: "Fesseln", Annihilate: "Vernichtung", Judgment: "Urteil", "Debilitating Smash": "Lähmender Schlag",
  Punishment: "Bestrafung", Pummel: "Tobende Hiebe", "Shield Smite": "Schildhieb", "Shield Rush": "Schildsturm", "Warding Strike": "Behütender Schlag",
  "Flash Rampage": "Lichtraserei",
  "Enhance Health": "Vitalitätsverstärkung", "Punishing Benediction": "Gnade der Verdammnis", "Guarding Seal": "Schutzsiegel",
  "Insulting Roar": "Gebrüll der Verachtung", Fury: "Kampfrausch", "Warding Shield": "Behütungsschild", "Ironclad Defense": "Eisenwall-Verteidigung",
  "Block Pain": "Schmerzblockade",
  // Ranger
  Snipe: "Scharfschuss", "Snare Shot": "Schlingenpfeil", "Drill Dart": "Bohrpfeil", "Burst Arrow": "Sprengpfeil", "Explosion Trap": "Explosionsfalle",
  "Tempest Shot": "Schnellschuss", Deadshot: "Zielpfeil", "Marking Shot": "Markierungsschuss", "Suppressing Arrow": "Unterdrückungspfeil",
  "Gale Arrow": "Orkanpfeil", "Arrow Scattershot": "Pfeilhagel",
  "Vigilant Eye": "Achtsames Auge", "Wind Vigor": "Elan des Windes", "Hunter's Resolve": "Entschlossenheit des Jägers", "Rooting Eye": "Fesselndes Auge",
  "Revitalization Contract": "Pakt der Revitalisierung", "Concentrated Fire": "Fokussiertes Feuer", "Focused Eye": "Fokussiertes Auge",
  "Unyielding Resolve": "Entschlossenheit des Widerstands", "Melee Fire": "Nahschuss", "Hunter's Soul": "Jägerseele",
  // Assassin
  "Quick Slice": "Schneller Schnitt", Shadowstrike: "Schattenschlag", "Heart Gore": "Herzstoß", "Whirlwind Slice": "Wirbelschnitt", "Shadow Fall": "Schattenfall",
  "Insignia Explosion": "Glyphenexplosion", Ambush: "Hinterhalt", "Savage Roar": "Gebrüll der Bestie", Infiltrate: "Infiltration", "Flash Slice": "Blitzhafter Schnitt",
  "Storm Rampage": "Sturmwirbel",
  "Heightened Sixth Sense": "Geschärfte Sinne", "Apply Poison": "Klingengift", "Assault Stance": "Sturmhaltung", "Ambush Stance": "Lauerhaltung",
  "Exploit Weakness": "Schwachstellenfokus", "Rear Smite": "Rückhieb", "Defense Break": "Verteidigungsbruch", Determination: "Entschlossenheit",
  // Spiritmaster
  "Cold Shock": "Kälteschock", "Summon: Fire Spirit": "Beschwörung: Feuergeist", "Jointstrike: Curse": "Koordinationsangriff: Fluch",
  "Summon: Earth Spirit": "Beschwörung: Erdgeist", "Dimensional Control": "Raumbeherrschung", "Elemental Fusion": "Elementarfusion", Combustion: "Einäscherung",
  "Summon: Water Spirit": "Beschwörung: Wassergeist", "Soul's Cry": "Seelenschrei", "Summon: Wind Spirit": "Beschwörung: Windgeist", "Rapid Scattershot": "Schnellfeuer",
  "Spirit Strike": "Geisterschlag", "Spirit's Descent": "Herabkunft des Naturgeists", "Spirit Revitalization": "Revitalisierung des Naturgeists",
  "Spirit Communion": "Geisterbindung", "Element Unification": "Elementarvereinigung", "Spirit Protection": "Naturgeistschutz", Corrode: "Erosion",
  "Mental Focus": "Mentale Konzentration", "Consecutive Countercurrent": "Kontinuierlicher Rückfluss",
  // Sorcerer
  "Flame Arrow": "Flammenpfeil", Firestorm: "Flammenschlag", Blaze: "Flammenexplosion", "Frost Burst": "Eisexplosion", "Wish of Concentration": "Andacht der Konzentration",
  Hellfire: "Höllenflamme", "Ice Chain": "Eiskette", "Bittercold Wind": "Bitterkalter Wind", Frost: "Einfrieren", "Winter's Shackles": "Winterbann",
  "Flame Scattershot": "Flammenfeuer",
  "Fire Mark": "Feuerzeichen", "Cold Snap": "Beschwörung der Kälte", "Robe of Cold": "Robe der Kälte", "Grace of Resistance": "Gnade des Widerstands",
  "Robe of Earth": "Robe der Erde", "Robe of Flame": "Robe der Flamme", "Absorb Essence": "Essenzabsorption", "Grace of Enhancement": "Gnade der Verstärkung",
  "Vitality Evaporation": "Entzug der Lebensenergie",
  // Cleric
  "Earth's Retribution": "Rache der Erde", "Debilitating Mark": "Mal der Schwächung", "Chain of Torment": "Kette des Schmerzes", Condemnation: "Verdammnis",
  "Radiant Recovery": "Glanz der Genesung", Bolt: "Donnerschlag", "Judgment Thunder": "Blitz des Urteils", "Divine Aura": "Heilige Aura",
  "Light of Regeneration": "Licht der Regeneration", "Healing Light": "Licht der Heilung", "Lightning Strike Scattershot": "Blitzfeuer",
  "Warm Benediction": "Warme Gnade", "Empyrean Lord's Grace": "Segen des Gebieters", "Immortal Veil": "Schleier der Unsterblichkeit",
  "Prayer of Concentration": "Gebet der Konzentration", "Empyrean Lords' Benediction": "Gnade des Gebieters", "Healing Enhancement": "Heilungsverstärkung",
  "Heal Block": "Regenerationsblockade", "Radiant Benediction": "Strahlende Gnade", "Earth's Grace": "Segen der Erde",
  // Chanter
  Onslaught: "Zerschmetterungsschlag", "Rushing Smash": "Sturmschlag", "Wave Blow": "Wellenschlag", "Heat Wave Blow": "Hitzewellenschlag", "Dark Crush": "Finsterbruch",
  "Spinning Strike": "Wirbelschlag", "Incandescent Blow": "Gleißschlag", "Impactful Crush": "Wuchtschlag", "Tremor Crush": "Erschütterungsschlag",
  Recuperation: "Zauber der Genesung", "Gust Rampage": "Sturmraserei",
  "Blessing of Life": "Segen des Lebens", "Protection Circle": "Schutzformation", "Raging Spell": "Zauber des Furors", Crossguard: "Kreuzverteidigung",
  "Inspiring Spell": "Zauber der Eingebung", "Earth's Promise": "Gelübde der Erde", "Wind's Promise": "Gelübde des Windes",
  // all classes
  Defiance: "Schockaufhebung",
};

/** In English the name stays as kisk.app delivers it (the game's English name). */
export const statLabel = (name: string, lang: "en" | "de" = "de") => (lang === "en" ? name : STATS[name] ?? SKILLS[name] ?? name);
/** Skill lines: German client name where known. */
export const skillLabel = (name: string, lang: "en" | "de" = "de") => (lang === "en" ? name : SKILLS[name] ?? STATS[name] ?? name);
/** Whether a German name is known (for tests and gaps). */
export const hasGerman = (name: string) => name in STATS || name in SKILLS;
