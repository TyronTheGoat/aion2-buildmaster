# Build Master – Crafting-Daten ERGÄNZUNG V4 (22.11.2026)

**Zweites Datenpaket zu V3.** Enthält überprüfte, zusätzliche Direkteingaben sowie **zwei bereits zusammengeführte CSV-Dateien** für Claude. Keine erfundenen Rohmaterialpreise, keine pauschalen unbekannten Erfolgswahrscheinlichkeiten.

## Neu gegenüber V3

- 27 dokumentierte Rezeptzeilen in `01_Ergaenzte_Rezepte.csv` (davon 19 bisher im V3-Katalog ohne vollständige Direktzutaten, 8 neue Zwischenmaterial-Rezepte).
- **106 neue direkte Materialzuordnungen** inklusive Mengen und Quellen in `02_Neue_Direktzutaten.csv`.
- **10 getrennte Transfergegenstand-Voraussetzungen** in `03_Transfer_Voraussetzungen.csv`.
- **18 alte Platzhalter-Keys** des Orbs im V3-Input werden jetzt per `04_V3_Orb_ID_Korrekturen.csv` echten Game-Rezept-IDs zugeordnet.
- 80%-Planungszahl unter klar bezeichneten Wahrscheinlichkeitsbedingungen und Orb-Planungsverlauf beider Fraktionen. Preis-Eingabelisten sind bewusst nicht enthalten.

**Wichtig:** 123 der ursprünglich 142 ohne Direktzutaten bekannten V3-Rezeptzeilen sind **weiterhin ungeklärt**. Siehe `07_Weiterhin_fehlende_V3_Rezepte.csv`. Keine falsche Vollständigkeit suggerieren.

## Direkt als Import verwenden

Wenn Claude V3 bereits kennt, nimm die **neuen vollständigen Snapshot-Dateien** statt die Tabellen manuell zu addieren:

1. `10_IMPORT_FERTIG_Rezepte_Gesamt.csv` – 158 eindeutige Rezeptschlüssel (V3 + echte Orb-Rezept-IDs + Zwischenmaterial-Rezepte).
2. `11_IMPORT_FERTIG_Direktzutaten_Gesamt.csv` – 146 Direktzutaten-Zeilen (V3 + V4, ohne Dubletten).
3. `03_Transfer_Voraussetzungen.csv` – **separat** einlesen (Transferitem ist kein normaler Rohstoff).
4. `09_Orb_Projektkette.csv` – Beispiel für die bestätigte Orb-Kette mit Combo-/Safe-Abzweigungen.

Die Namen und Spalten in den zusammengeführten Dateien orientieren sich am V3-Schema. `recipe_key`/Item-ID ist der sichere Join. **Importiere nicht gleichzeitig beide Snapshots plus die Ergänzungsdateien als neue, doppelte Rezepte.**

## Funktionslogik

### Direkte Zutaten vs. komplette Einkaufsliste

Eine Zeile in `02_Neue_Direktzutaten.csv` ist der Einsatz bei genau EINEM Craft dieses Rezeptes. Sie ist **keine** bereits expandierte Gesamtfarm-Liste. Beispiel: 21 Enhanced Durable Balaur Scale sind 21 Zwischenmaterialien; deren Rohstoffe müssen beim eigenen Unterrezept berechnet werden. Ansonsten droht Doppelzählung.

### Transfer-Inputs

Bei Transfer-Crafts müssen zusätzliche Transfer-Items aus `03_Transfer_Voraussetzungen.csv` separat berücksichtigt werden. Manche Quellseiten nennen explizit einen von zwei möglichen Eingangsgegenständen. Der **zweite nicht verifizierte Eingang** wird bewusst nicht erfunden.

### Combo

Eine im Rezept hinterlegte 25%-Chance ist bei einem garantierten Transfer ggf. die **Chance auf eine bessere Combo-Ausgabe**. Bei normalen Chance-Crafts ist sie nicht automatisch die effektive Endchance. Es existieren separate Angaben: Mindestmeisterschaft / dokumentiertes Maximum. **Nie vergleichen, als kämen beide Werte von derselben Meisterschaft.**

### 80%-Planungswert

`n80 = ceil(ln(0.2) / ln(1-p_effektiv))` für wiederholte unabhängige identische Versuche. Bei `p=0.25` ist n80=6; bei p=0.2304 ist n80=7. Kein mathematischer Mittelwert. Beim mehrstufigen Crafting **kein** naives Multiplizieren von n80 je Stage: benutze einen Abhängigkeitsbaum mit stochastischem Zustandsmodell oder nachvollziehbarer Simulation.

### Marktpreise (ausschließlich manuell)

Es gibt **keine vordefinierte Preis-Eingabeliste und keine automatisch befüllten Marktpreise**. Der Nutzer legt einzelne Preise erst dann an, wenn er einen Material- oder Zwischengegenstand erfassen möchte.

Das UI soll ein freies Formular anbieten: Material aus der Rezeptdatenbank wählen **oder** Materialname / Item-ID eingeben, Server, Mindestpreis, Höchstpreis, Zeitstempel sowie optional Lagerbestand. Werte separat speichern und per eindeutiger Item-ID den Rezeptzutaten zuordnen, wo verfügbar. Nur tatsächlich vom Benutzer angelegte Preisdatensätze anzeigen; keine 47 leeren Positionen voraussäen.

Fehlende Preise = **unbekannt**, NICHT null. Bei gebundenen Materialien kein Angebot zum direkten Kauf behaupten. Inventarbestand für Projekte nur einmal reservieren/abziehen.

## Datenquellen & Verifikation

Öffentlich einsehbare, **nicht-offizielle** Aion2Data-Seiten, deren Werte nach Angaben des Anbieters aus Global-Spieldaten extrahiert werden. Einige Rezeptseiten tragen ältere Client-Versionen; deshalb `source_client_version` für Ergänzungszeilen ohne sichere spezifische Einzelprüfung leer. Quelle je Zeile in `source_url` angegeben. Im Spiel aktuelle Chance prüfen und Abweichungen festhalten.

- https://aion2data.com/crafting/alchemy
- https://aion2data.com/crafting/blacksmithing
- https://aion2data.com/recipes/321093015-splendent-ebony-dragon-lord-orb
- https://aion2data.com/recipes/311093015-splendent-wise-dragon-lord-orb
- https://aion2data.com/recipes/315024003-enhanced-durable-balaur-scale

## Was weiterhin offen ist

- 123 Rezeptzeilen aus dem ersten Paket ohne vollständig geprüfte Direktzutaten;
- restliche Verzweigungen und zusätzliche alternative Transferitem-Eingänge;
- tatsächliche individuelle Charakter-Crafting-Chance nach Skill/Handwerksstufe;
- genaue Verfügbarkeit im *konkreten* EU-Spiel-Patch (Datenbank ist Sekundärquelle);
- Marktpreise und Lagerbestände, die der Spieler eingeben muss;
- vollständige 102er-Ketten für **alle** anderen Waffengattungen, Schmuck- und Rüstungsslots.

Für unvollständige Rezepte nur geschlossene Teilkosten berechnen und deutlich als **Teilbetrag** kennzeichnen. Keine Gesamtbudget- oder Kauf-vs-Craft-Empfehlung mit unvollständigem Pfad geben.
