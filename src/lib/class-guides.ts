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

/** English text of the guides (our own translation; skill names are the English client names from wakayashi.gg). */
export const CLASS_GUIDES_EN: Record<string, Omit<ClassGuide, "cls" | "difficulty">> = {
  Gladiator: {
    name: "Gladiator", role: "Bruiser", weapon: "Greatsword", tagline: "Damage and tank in one",
    description: "The Gladiator combines damage and tank in one class. He buffs the whole group's offence, makes it tougher and weakens the boss. He prefers to fight from the front, because his buffs add more damage on frontal attacks. With a lot of life steal he can take quite a beating on the side.",
    skills: [
      { name: "Overhead Slam", why: "Main damage and an important source of aggro." },
      { name: "Rage Burst", why: "Makes Overhead Slam usable without a condition." },
      { name: "Lunge Stance", why: "Gives cooldown back and raises combat speed." },
      { name: "Keen Strike", why: "Area aggro as a tank, restores MP." },
    ],
    strengths: ["Damage and tank in one class", "Offensive buffs for the whole group", "Very strong 1-on-1 and in small PvP fights", "Lots of crowd control", "Lots of life steal, which makes him tough"],
    weaknesses: ["Weak in large PvP battles", "Full power only with frontal attacks"],
  },
  Templar: {
    name: "Templar", role: "Tank", weapon: "Sword and shield", tagline: "The classic tank",
    description: "The Templar is the tank of the game and always stands in front of the boss, because his passives reward frontal attacks. Later his damage comes mostly from Judgment, which several shield skills keep unlocking. Early on the stats and cooldown reduction for that are missing, so you simply alternate between two basic attacks. The class is cheap, because no stigma has to reach level 20.",
    skills: [
      { name: "Judgment", why: "Main damage in the late game." },
      { name: "Warding Strike", why: "Unlocks Judgment and is reset by Vicious Strike." },
      { name: "Vicious Strike", why: "Basic attack on left click, aggro and MP." },
      { name: "Shield Smite / Shield Rush", why: "More triggers for Judgment." },
    ],
    strengths: ["Best tank in the game", "Very strong group buffs, defensive and offensive", "Very good solo, e.g. levelling or in Nightmare", "Lots of stagger damage"],
    weaknesses: ["No notable weaknesses"],
  },
  Assassin: {
    name: "Assassin", role: "Melee DPS", weapon: "Daggers", tagline: "Burst from behind",
    description: "The Assassin stacks insignias on the target, up to five, and then makes them explode in one hit. On top comes positioning: hits from behind count for more. He uses his three sprints to get back behind the boss after each of its attacks.",
    skills: [
      { name: "Insignia Explosion", why: "Detonates the stacked insignias, the big burst." },
      { name: "Savage Roar", why: "Stacks insignias on the target." },
      { name: "Savage Fang", why: "Stacks insignias as well." },
    ],
    strengths: ["Highest burst on a single target", "Very mobile with three sprints", "Invisibility as an option in PvP", "Farms quickly in the open world"],
    weaknesses: ["Depends heavily on his own buffs", "Without buffs little damage and little fun"],
  },
  Ranger: {
    name: "Ranger", role: "Ranged DPS", weapon: "Bow", tagline: "Range and farming",
    description: "Everything about the Ranger turns around Deadshot, a charged skill that should always be fully charged. Before the fight he puts up his buffs, then Marking Shot and Gale Arrow add more buff stacks. After that you hold attack and macro and renew Marking Shot when it runs out.",
    skills: [
      { name: "Deadshot", why: "Most important skill, always charge it fully." },
      { name: "Marking Shot", why: "Gives buff stacks, helps with kiting." },
      { name: "Vaizel's Authority / Bow of Blessing", why: "Buffs before the fight." },
    ],
    strengths: ["Long range", "Mobile, Deadshot can even be charged while moving", "Best farmer in the open world, good for pet farming", "Good crowd control"],
    weaknesses: ["Very weak early on and very gear dependent", "Needs a lot of mana", "Fragile, only one defensive cooldown"],
  },
  Sorcerer: {
    name: "Sorcerer", role: "Magic DPS", weapon: "", tagline: "Lives on cooldown reduction",
    description: "The Sorcerer draws his damage from shorter cooldowns. Several skills lower the cooldowns, and Hellfire, his most important skill that is charged by hand, profits most. The mechanic only really works from a certain value on, so early on he lacks some damage.",
    skills: [
      { name: "Hellfire", why: "Most important skill, charged." },
      { name: "Flame Arrow", why: "Basic attack, drives the cooldown reduction." },
      { name: "Element Enhancement", why: "His most important buff." },
    ],
    strengths: ["One of the strongest classes early on", "Good range", "Many useful extras such as Steel Barrier"],
    weaknesses: ["Many ground skills that need good placement", "Hardly mobile"],
  },
  Spiritmaster: {
    name: "Spiritmaster", role: "Pet DPS", weapon: "Book", tagline: "The spirits fight along",
    description: "The Spiritmaster plays through his spirits: most of the damage comes from them. What matters is having the right spirits out for the first attack. Since the spirits keep attacking even while you dodge, he has the steadiest damage in the game.",
    skills: [
      { name: "Elemental Fusion", why: "Strong skill, needs four element stacks." },
      { name: "Summon: Fire Spirit", why: "Spirit for extra damage." },
      { name: "Summon: Ancient Spirit", why: "Spirit for extra damage, gets better with more combat speed." },
    ],
    strengths: ["Constant damage thanks to the spirits, even while dodging", "Easiest class, the spirits do almost everything", "Toughest pure damage class, only the Gladiator takes more"],
    weaknesses: ["Immobile, no sprints", "Weak early on, because the combat speed for the Ancient Spirit is missing"],
  },
  Cleric: {
    name: "Cleric", role: "Healer", weapon: "Mace", tagline: "Heals and deals damage",
    description: "The Cleric does not only heal, with Condemnation he also deals solid damage. His healing grows with attack power, so his buff is a damage and a healing buff at the same time. He is the only one who can revive in combat.",
    skills: [
      { name: "Condemnation", why: "Main damage, runs all the time with Chain of Torment." },
      { name: "Chain of Torment", why: "Has to be on the target so Condemnation keeps running." },
      { name: "Earth Punishment", why: "Makes Condemnation crit all the time." },
      { name: "Prayer of Amplification", why: "Buff for damage and healing at once." },
    ],
    strengths: ["Very high survivability through many strong heals", "Only class that can revive in combat", "Most important class in group PvP", "Solo content is easy thanks to self healing"],
    weaknesses: ["Little damage", "Very weak 1-on-1, because he relies on the group"],
  },
  Chanter: {
    name: "Chanter", role: "Support", weapon: "Staff", tagline: "The buff engine of the group",
    description: "The Chanter is the group's buffer. His two invocations run all the time, and before every fight he fires Power of the Storm. His main damage is Dark Crush, which is only available for a short time after certain hits.",
    skills: [
      { name: "Dark Crush", why: "Main damage, free shortly after Spinning Strike, Impactful Crush or Marchutan's Wrath." },
      { name: "Power of the Storm", why: "Big group buff before every fight." },
      { name: "Invocations", why: "The most important buffs in the game, always active." },
    ],
    strengths: ["Works well with the group in PvE and PvP through heals and buffs", "The most important buffs in the game, always active", "Good survivability thanks to healing skills", "Easy pet farming in the open world thanks to Rushing Smash"],
    weaknesses: ["Weak early on, because Dark Crush is rarely available", "No strong heals and no revive, no replacement for the Cleric"],
  },
};

const DIFF_EN: Record<ClassGuide["difficulty"], string> = { leicht: "easy", mittel: "medium", schwer: "hard" };
/** The guide in the chosen language (German as written, English from CLASS_GUIDES_EN); difficulty stays the key. */
export function localGuide(g: ClassGuide, lang: "de" | "en"): ClassGuide & { difficultyLabel: string } {
  if (lang !== "en" || !CLASS_GUIDES_EN[g.cls]) return { ...g, difficultyLabel: g.difficulty };
  return { ...g, ...CLASS_GUIDES_EN[g.cls], difficultyLabel: DIFF_EN[g.difficulty] };
}
