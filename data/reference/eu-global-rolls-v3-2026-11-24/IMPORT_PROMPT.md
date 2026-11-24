# BuildMaster – Claude-Import: Arcana, Soul Binding, Skilllevel (AION 2 EU/Global)

## Ziel
Importiere eine **read-only Referenz-Datenbank** möglicher Arcana- und Equipment-Rolls für alle 8 Global-Klassen. Das ist zunächst nur ein Input für zukünftige Build- und Levelrechner, **kein Auftrag, den Rechner jetzt zu bauen**.

## Schritt 1: Bestehenden Stand bewahren
- Verändere **keine** Charaktere, vorhandenen Arcana, Gear-Items, gewählten Fähigkeiten, fertigen Crafting-Rezepte, Preise oder Notizen.
- Vor dem Import existierende Schlüssel, Namen, Item-IDs und Datenmodelle abgleichen; stabile Keys nutzen: `class_en + skill_en + skill_type`, `slot_group + stat_en`, `class_en + arcana_slot_en + skill_en`.
- Keine Duplikate erzeugen. Daten als gesonderte Version **eu-global-rolls-v3-2026-11-24** importieren. Bereits vorhandene Quellen/Datensätze priorisiert erhalten.

## Schritt 2: Import-Reihenfolge
1. `00_REGELN_UND_METADATEN.json` als Regelwerk lesen.
2. `01_Klassen_Skills_176_DE_EN.csv` für die 176 regulären Mastery-Skills.
3. `02_Arcana_352_Karten_Skill_Zuordnungen.csv`: pro Klasse/Karte erlaubte Skills, **nicht** beliebig kombinieren.
4. `03_Gear_Stat_Pools_255_Ranges.csv`: pro Slot exakt erlaubte normale Stats, Gewichte und Stufen-gebundene Min-/Max-Werte.
5. `04_Gear_Klassen_Skill_Zuordnungen_1008.csv`: pro Klasse/Slot erlaubte +1-Aktiv- bzw. +1-Passivboni.
6. `05_Slots_13_UI_Regeln.csv`: Slot-Logik und Armband-Sonderfall.
7. `06_Arcana_Karten_40_Varianten.csv`: echte 5 Global-Kartenarten × 2 Familien × 4 Seltenheiten. Keine Korea/Taiwan-only zusätzlichen Slots importieren.
8. Optional `07_GESAMT_IMPORT.json` statt einzelner CSVs, **nicht zusätzlich** (sonst doppelt!).

## Harte Spielregeln
- Aktive/passive Mastery-Fähigkeiten: direkt gelevelt bis 10; Devanion maximal +4; ergibt 14 vor Equipment und Arcana (falls voll ausgebaut).
- Zusätzliche aktive/passive Skilllevel stammen aus tatsächlich ausgerüsteten Arcana und Gear. Ziel Level 20 ist ein **Planungsziel**, keine pauschale technische Obergrenze.
- Stigmas sind ein **eigenes System** mit Stigma-Scherben. Sie können **nie** auf diesen normalen Equipment-Rolls oder den fünf Arcana-Karten stehen. Stigma-Skills dürfen auch nicht zum 12-Aktiv-/10-Passivpool hinzugefügt werden.
- Heiliger Gral kann alle 22 regulären Skills der Klasse enthalten. Pergament: 6 bestimmte aktive; Kompass: die anderen 6. Glocke: 5 bestimmte passive; Spiegel: die anderen 5. Vigor/Magic ändern diese Pools nicht.
- Arcana-Skillbonus pro tatsächlich angezeigter Skill-Zeile beim Erhalt zunächst +1; durch Kartenaufwertung für einen Skill auf der Karte bis +4. Nicht alle vier Linien automatisch auf +4 setzen.
- Waffen, Schützer und 2 Ringe: aktive Klassenfähigkeiten (+1). Rüstung (Helm, Schultern, Brust, Hose, Handschuhe, Schuhe, Umhang), 2 Ohrringe und Halskette: passive Klassenfähigkeiten (+1). Armbänder: Pantheon-Werte, keine regulären +1-Skillboni.
- Wenn eine Fähigkeit mehrfach auf verschiedenen **angelegten** Items steht, Beiträge addieren. In einem Item dürfen bereits vorhandene Optionen bei weiteren Ziehungen nicht unbeschränkt dupliziert werden.

## Wahrscheinlichkeiten korrekt anzeigen
- `chance_single_line_pct`: Basis-Wahrscheinlichkeit **einer einzelnen neu gezogenen Zufallszeile** (nicht für eine ganze 5-Zeilen-Ausrüstung).
- 80% normale Stats + 20% eigene Klassenskills gemäß Datensammlung (Ausnahme Armband). Bei 12 Aktiven: ca. 1,6667% je konkreter Skill-Zeile; bei 10 Passiven: 2%. Dies sind **abgeleitete Basiswerte**, keine unveränderlichen Chancen jedes gezielten Rerolls.
- Arcana: `probability_one_skill_line_pct` bezieht sich auf die Auswahl **innerhalb des jeweiligen Karten-Skillpools**. Bei vier unterschiedlichen Karten-Skilloptionen: `4 / pool_size` für mindestens einen gewünschten Skill (bei gleichmäßiger Auswahl ohne Wiederholung). Diese Karten-Chance nie mit der Gear-Chance gleichsetzen.
- Die aion2.gg Angabe `chance to appear` beschreibt die Chance, einen Stat unter **allen Zeilen eines gesamten Bindings** zu haben; **nicht** die Chance pro einzelne Zeile. Unsere CSV enthält pro einzelne Zeile die Basisgewichtung aus aion2maps.
- Nicht per Item-ID oder Gegenstandsstufe nachgewiesene Chancen als `Referenzwerte` ausweisen, nie als absolute Garantien. Wenn eine Ziehung auf einem Item Optionen ausschließt, Item-Tooltip-Quoten bevorzugen.

## Min-/Max-Statwerte
- `range_min` und `range_max` sind echte numerische Beispielbereiche mit `range_reference_item_level`, meist Gegenstandsstufe **102**, für Armbänder Stufe **86**. **Niemals** unverändert anderen Itemstufen zuordnen oder linear hochrechnen, ohne dafür eigene gesicherte Werte.
- `range_unit=points` = absolute Statpunkte; `%` = Prozentpunkte.
- Deutsche Statnamen sind teilweise noch nicht spielclient-verifiziert; nutze `stat_en` als technischen Schlüssel. Leere deutsche Namen nicht selbst als amtlich übersetzt ausgeben.

## UI-Vorschlag (nur Datenhaltung vorbereiten, noch kein Rechner)
- Ansicht: Klasse → Ausrüstungs-Slot / Arcana-Karte → erlaubte Stats und Skills → Wertespanne (mit Itemlevel) → Basis-Rollchance → Quellenstatus.
- Filter für „Aktiv“, „Passiv“, „Stat“, „Armband-Pantheon“, DE/EN-Suche.
- UI-Warnungen: `Referenzlevel 102`, `Chance pro Zeile`, `deutscher Name noch zu prüfen`.
- Zukünftiger Level-20-Rechner kann später `trainiert + Devanion + tatsächlich getragenes Gear + tatsächlich getragene Arcana` berechnen. Ein vollständiger Schadens-/Combat-Power-Rechner benötigt **zusätzlich** Formeln für Stat-Skalierung, Base Stats und Modifikatoren; diese Inputliste allein reicht dafür nicht.

## Akzeptanztests
1. `Spiritmaster/Elemental Fusion` erscheint auf **Gral + Pergament**, niemals auf Kompass, Glocke, Spiegel.
2. `Spiritmaster/Spirit Strike` erscheint auf **Gral + Glocke**, nicht Pergament/Kompass/Spiegel.
3. `Spiritmaster/Mental Focus` erscheint auf **Gral + Spiegel**.
4. Für Spiritmaster enthält ein Ring **12 aktive Skillmöglichkeiten**, keine Passiven oder Stigmas.
5. Helm bietet die 10 passiven Skills der gewählten Klasse sowie genau seine Slot-Stats.
6. Armband enthält nur 8 Pantheon-Werte; keine Aktiv-/Passiv-Skills.
7. 10 reguläre Level +4 Devanion +6 tatsächliche Bonuslevel = 20; Stigma-Level ändern diese Rechnung nicht.
8. `Damage Boost`-Waffe Stufe 102 hat 6.29–7.30%, die Werte dürfen nicht automatisch auf Stufe 70 übertragen werden.
9. Alle 8 Klassen haben 22 Mastery-Skills, 12 aktive/10 passive, 5 Arcana-Pools (22/6/6/5/5).
10. Import erhält alle bestehenden Benutzerdaten unverändert.

## Quellen und Qualitätsgrenzen
Siehe `08_Quellen_und_Grenzen.md`. Werte, die nur aus Community-Datamining und älteren Datensätzen stammen, nicht zu offiziell verifizierten Werten aufwerten.
