/**
 * Short class guides (German), summarised in our own words from the class guide of wakayashi.gg/aion2
 * (as of 2026-11-23). Skill names are the German client names used there.
 */
export interface ClassGuide {
  /** class name as used by kisk / ClassIcon (English) */
  cls: string;
  name: string;
  role: string;
  weapon: string;
  difficulty: "leicht" | "mittel" | "schwer";
  /** two-word summary shown on the small card */
  tagline: string;
  description: string;
  skills: { name: string; why: string }[];
  strengths: string[];
  weaknesses: string[];
}

export const CLASS_GUIDE_SOURCE = "https://wakayashi.gg/aion2#class-guides";

export const CLASS_GUIDES: ClassGuide[] = [
  {
    cls: "Gladiator", name: "Gladiator", role: "Bruiser", weapon: "Großschwert", difficulty: "leicht",
    tagline: "Schaden und Tank in einem",
    description: "Der Gladiator verbindet Schaden und Tank in einer Klasse. Er bufft die ganze Gruppe offensiv, macht sie widerstandsfähiger und schwächt den Boss. Er kämpft am liebsten von vorne, weil seine Buffs bei Front-Angriffen mehr Schaden bringen. Durch viel Lebensraub hält er nebenbei einiges aus.",
    skills: [
      { name: "Abwärtsschlag", why: "Hauptschaden und zugleich eine wichtige Aggro-Quelle." },
      { name: "Furorausbruch", why: "Macht Abwärtsschlag ohne Bedingung nutzbar." },
      { name: "Angriffsstellung", why: "Gibt Abklingzeit zurück und erhöht das Kampftempo." },
      { name: "Scharfer Schlag", why: "Flächen-Aggro als Tank, regeneriert MP." },
    ],
    strengths: ["Schaden und Tank in einer Klasse", "Offensive Buffs für die ganze Gruppe", "Sehr stark im 1-gegen-1 und in kleinen PvP-Kämpfen", "Viel Kontrolle (CC)", "Viel Lebensraub, dadurch indirekt robust"],
    weaknesses: ["Schwach in großen PvP-Schlachten", "Volle Leistung nur mit Front-Angriffen"],
  },
  {
    cls: "Templar", name: "Templer", role: "Tank", weapon: "Schwert und Schild", difficulty: "mittel",
    tagline: "Der klassische Tank",
    description: "Der Templer ist der Tank schlechthin und gehört immer vor den Boss, weil seine Passiven Front-Angriffe belohnen. Später kommt sein Schaden vor allem aus Urteil, das von mehreren Schild-Skills immer wieder freigeschaltet wird. Am Anfang fehlen dafür Werte und Abklingzeit-Reduktion, dann wechselt man einfach zwischen zwei Grundangriffen. Die Klasse ist günstig, weil kein Stigma auf Stufe 20 muss.",
    skills: [
      { name: "Urteil", why: "Hauptschaden im Lategame." },
      { name: "Behütender Schlag", why: "Schaltet Urteil frei und wird durch Brutaler Schlag zurückgesetzt." },
      { name: "Brutaler Schlag", why: "Grundangriff auf Linksklick, Aggro und MP." },
      { name: "Schildhieb / Schildsturm", why: "Weitere Auslöser für Urteil." },
    ],
    strengths: ["Bester Tank im Spiel", "Sehr starke Gruppenbuffs, defensiv wie offensiv", "Sehr gut solo spielbar, etwa beim Leveln oder in Alptraum", "Viel Stagger-Schaden"],
    weaknesses: ["Keine nennenswerten Schwächen"],
  },
  {
    cls: "Assassin", name: "Assassine", role: "Nahkampf-DPS", weapon: "Dolche", difficulty: "schwer",
    tagline: "Burst aus dem Rücken",
    description: "Der Assassine baut Glyphen auf dem Ziel auf, bis zu fünf Stück, und lässt sie dann in einem Schlag explodieren. Dazu kommt Positionsspiel: Treffer von hinten zählen mehr. Seine drei Sprints nutzt er, um nach jeder Boss-Attacke schnell wieder in den Rücken zu kommen.",
    skills: [
      { name: "Glyphenexplosion", why: "Zündet die gestapelten Glyphen, der große Burst." },
      { name: "Gebrüll der Bestie", why: "Stapelt Glyphen auf dem Ziel." },
      { name: "Reißzahn der Bestie", why: "Stapelt ebenfalls Glyphen." },
    ],
    strengths: ["Höchster Burst auf ein einzelnes Ziel", "Sehr beweglich mit drei Sprints", "Unsichtbarkeit als Option im PvP", "Farmt schnell in der offenen Welt"],
    weaknesses: ["Stark von eigenen Buffs abhängig", "Ohne Buffs wenig Schaden und wenig Spielspaß"],
  },
  {
    cls: "Ranger", name: "Jäger", role: "Fernkampf-DPS", weapon: "Bogen", difficulty: "mittel",
    tagline: "Reichweite und Farmen",
    description: "Beim Jäger dreht sich alles um den Zielpfeil, einen Skill zum Aufladen, der immer voll geladen werden sollte. Vor dem Kampf legt er seine Buffs an, danach sorgen Markierungsschuss und Orkanpfeil für weitere Buff-Stapel. Danach hält man Angriff und Makro gedrückt und erneuert den Markierungsschuss, wenn er ausläuft.",
    skills: [
      { name: "Zielpfeil", why: "Wichtigster Skill, immer voll aufladen." },
      { name: "Markierungsschuss", why: "Bringt Buff-Stapel, hilft beim Kiten." },
      { name: "Vaizels Hoheit / Segensbogen", why: "Buffs vor dem Kampf." },
    ],
    strengths: ["Große Reichweite", "Gut beweglich, auch Zielpfeil geht im Laufen", "Bester Farmer in der offenen Welt, gut fürs Pet-Farmen", "Gute Kontroll-Möglichkeiten"],
    weaknesses: ["Am Anfang sehr schwach und stark ausrüstungsabhängig", "Braucht viel Mana", "Hält wenig aus, nur eine Verteidigungs-Abklingzeit"],
  },
  {
    cls: "Sorcerer", name: "Zauberer", role: "Magie-DPS", weapon: "", difficulty: "mittel",
    tagline: "Lebt von Abklingzeit-Reduktion",
    description: "Der Zauberer zieht seinen Schaden aus verkürzten Abklingzeiten. Mehrere Skills senken die Cooldowns, und davon profitiert vor allem Höllenflamme, sein wichtigster Skill, der von Hand aufgeladen wird. Die Mechanik greift erst ab einem bestimmten Wert richtig, deshalb fehlt ihm am Anfang etwas Schaden.",
    skills: [
      { name: "Höllenflamme", why: "Wichtigster Skill, wird aufgeladen." },
      { name: "Flammenpfeil", why: "Grundangriff, treibt die Abklingzeit-Reduktion an." },
      { name: "Elementarverstärkung", why: "Sein wichtigster Buff." },
    ],
    strengths: ["Eine der stärksten Klassen am Anfang", "Gute Reichweite", "Viele nützliche Extras wie Winterschlaf oder Stahlbarriere"],
    weaknesses: ["Viele Boden-Skills, die gut platziert sein wollen", "Kaum beweglich"],
  },
  {
    cls: "Spiritmaster", name: "Beschwörer", role: "Pet-DPS", weapon: "Buch", difficulty: "leicht",
    tagline: "Die Geister kämpfen mit",
    description: "Der Beschwörer spielt über seine Geister: Der Schaden kommt größtenteils von ihnen. Wichtig ist, beim ersten Angriff die richtigen Geister draußen zu haben. Weil die Geister weiter angreifen, auch wenn man ausweichen muss, hat er den gleichmäßigsten Schaden im Spiel.",
    skills: [
      { name: "Elementarfusion", why: "Starker Skill, braucht vier Element-Stapel." },
      { name: "Beschwörung: Feuergeist", why: "Geist für Zusatzschaden." },
      { name: "Beschwörung: Uralter Naturgeist", why: "Geist für Zusatzschaden, wird mit mehr Kampftempo besser." },
    ],
    strengths: ["Durchgehender Schaden dank der Geister, auch beim Ausweichen", "Einfachste Klasse, die Geister erledigen fast alles", "Robusteste reine Schadensklasse, nur der Gladiator hält mehr aus"],
    weaknesses: ["Unbeweglich, keine Sprints", "Am Anfang schwach, weil das Kampftempo für den Naturgeist fehlt"],
  },
  {
    cls: "Cleric", name: "Kleriker", role: "Heiler", weapon: "Streitkolben", difficulty: "schwer",
    tagline: "Heilt und macht Schaden",
    description: "Der Kleriker heilt nicht nur, er macht mit Verdammnis auch ordentlich Schaden. Seine Heilung wird mit der Angriffskraft stärker, deshalb ist sein Buff gleichzeitig ein Schadens- und Heilungs-Buff. Als Einziger kann er im Kampf wiederbeleben.",
    skills: [
      { name: "Verdammnis", why: "Hauptschaden, läuft mit Kette des Schmerzes dauerhaft." },
      { name: "Kette des Schmerzes", why: "Muss auf dem Ziel liegen, damit Verdammnis läuft." },
      { name: "Strafe der Erde", why: "Lässt Verdammnis durchgehend kritisch treffen." },
      { name: "Gebet der Verstärkung", why: "Buff für Schaden und Heilung zugleich." },
    ],
    strengths: ["Sehr hohe Überlebensfähigkeit durch viele starke Heilungen", "Einzige Klasse mit Wiederbelebung im Kampf", "Wichtigste Klasse im Gruppen-PvP", "Solo-Inhalte leicht dank Selbstheilung"],
    weaknesses: ["Wenig Schaden", "Im 1-gegen-1 sehr schwach, weil er auf die Gruppe angewiesen ist"],
  },
  {
    cls: "Chanter", name: "Kantor", role: "Support", weapon: "Stab", difficulty: "leicht",
    tagline: "Der Buff-Motor der Gruppe",
    description: "Der Kantor ist der Buffer der Gruppe. Seine beiden Invokationen laufen dauerhaft, und vor jedem Kampf zündet er Hoheit des Sturmwinds. Sein Hauptschaden ist Finsterbruch, der aber nur kurz nach bestimmten Schlägen verfügbar ist.",
    skills: [
      { name: "Finsterbruch", why: "Hauptschaden, kurz nach Wirbelschlag, Wuchtschlag oder Marchutans Zorn frei." },
      { name: "Hoheit des Sturmwinds", why: "Großer Gruppenbuff vor jedem Kampf." },
      { name: "Invokationen", why: "Die wichtigsten Buffs im Spiel, laufen dauerhaft." },
    ],
    strengths: ["Gutes Zusammenspiel mit der Gruppe in PvE und PvP durch Heilung und Buffs", "Die wichtigsten Buffs im Spiel, dauerhaft aktiv", "Gute Überlebensfähigkeit dank Heil-Skills", "Pet-Farmen in der offenen Welt leicht dank Sturmschlag"],
    weaknesses: ["Am Anfang schwach, weil Finsterbruch selten verfügbar ist", "Keine starken Heilungen und keine Wiederbelebung, kein Ersatz für den Kleriker"],
  },
];
