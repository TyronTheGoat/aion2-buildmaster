# Build Master – EU-/Global-Crafting V7

Erstellt 22.11.2026. **Nur EU-/Global-Clientdaten als Ausgangspunkt**, keine zusätzlichen Korea-/Taiwan-Rezepte. Elyos und Asmodier sind separat.

## Was tatsächlich geliefert wird

- **409 Rezeptdatensätze** aus dem bestehenden V6-Paket für Waffen, Rüstung, Schmuck und einige zugehörige Material-Crafts. Das bedeutet nicht alle im Global-Client enthaltenen Cooking- und sonstigen Rezepte und ist auch kein Live-Ingame-Nachweis für alle Einträge.
- **329 eindeutige Direktzutatenzeilen**, darunter **78 neu auf nachgewiesenen Einzelrezeptseiten erfasste Zutaten** und **30 erneut geprüfte/ergänzte vorhandene Zutaten**.
- **18 Rezepte** mit einzeln geprüftem vollständigem direkten Materialset, **56** mit teilweiser Materialabdeckung und **335** ganz ohne direkte Zutaten in dieser importierbaren Datei. Andere alte Tabellen können weitere Belege enthalten, sind aber nicht als vollständig verifiziert anzusehen.
- **409** Chancen-Zeilen; davon **409** normal und **188** Combo 80%-Planungswerte mit belegter entsprechender Eingabe.
- **465** auswählbare Material-/Gegenstandspositionen für manuelle Preisangaben, **ohne vorbefüllte Preise**.
- **18** explizit nachgeprüfte Einzelrezeptseiten mit URL und direkten Materialien.

## Ganz wichtig

Der frühere Ausdruck "105 Rezepte fehlen" war irreführend: Die Rezeptzeilen waren bereits vorhanden, aber die **Direktzutatenlisten** nicht erfasst. Sie sind nicht zwingend aus der EU-Version ausgeschlossen. Dieses Paket bringt einen überprüfbaren Fortschritt, aber keine erfundene Vollständigkeit.

### Dateien

- `01_EU_GLOBAL_REZEPTE_409.csv`: Rezept-Mastertabelle aus V6. Bestehende Daten nicht überschreiben, ohne Quellenabgleich.
- `02_DIREKTZUTATEN_ZUSAMMEN.csv`: konsolidierte *direkte* Zutaten pro Einzelversuch, keine rekursiven Rohstoffe.
- `03_REZEPT_CHANCEN_80_PROZENT.csv`: p-Werte und n80 pro Rezept. `p_combo_result_per_attempt_best` ist bereits die finale Wahrscheinlichkeit auf das Combo-Ergebnis bei bester dokumentierter Handwerksstufe; **nicht noch einmal mit 25% multiplizieren**.
- `04_EU_REZEPTQUELLEN.csv`: URLs für 409 Rezepte; `candidate_generated_NOT_VALIDATED` bedeutet nur potenzielle URL, keine tatsächliche Bestätigung.
- `05_EU_PROJEKTKETTEN_V6.csv`: Ketten aus V6; bei alternativen Rezepten NICHT alle Zeilen als Pflichtfolge ansehen.
- `06_PREISOBJEKTE_MANUELL_OHNE_PREISE.csv`: kein automatisch festgelegter Marktpreis, Nutzer pflegt Preise im UI.
- `07_DIREKTZUTATEN_ABDECKUNG.csv`: vollständige Transparenz zur Belegung.
- `08_EINZELSEITEN_VERIFIZIERT.csv`: neu einzeln geöffnete EU/Global-Seiten.
- `09_BESTEHENDE_REZEPT_MAPPING.csv`: bisherige Zuordnung.
- `10_TRANSFERALTERNATIVEN_V6.csv`: bisherige Transfer-Varianten, ggf. erneut überprüfen.
- `11_ABWEICHUNGEN_ZUTATEN.csv` nur wenn ältere Mengen mit neu geprüftem Rezept widersprechen.

## Mathematische Regel

`n80 = ceil(ln(1-0.8) / ln(1-p))` für 0 < p < 1; p = 1 ergibt 1. Beispiel: p=0.25 => n80=6. Das ist eine **80%-Planungszahl**, nicht der Erwartungswert (bei p=0.25 ist Erwartungswert 4). Die Berechnung erfolgt **pro Rezept** und ist keine 80%-Garantie für eine ganze mehrstufige Kette.

`p_best` gilt nur bei maximaler in der Quelle dokumentierter Proficiency und darf nicht als aktuelle Spielerchance behandelt werden. Bei abweichender Meisterschaft Spiel-/Source-Wert oder manuellen Input verwenden.

## Abgrenzung

- Keine Korea/Taiwan-Daten importieren. Kein rein KR/TW-verfügbares Item aktivieren.
- Global-Clientdaten aus 2026.10.28/2026.11.11 sind nicht zwingend ein Live-Verfügbarkeitsnachweis am 22.11.; vor Aktivierung abweichende Patch-/Serverbeschränkungen prüfen.
- Fehlende Zutatenmengen oder Wahrscheinlichkeiten = unbekannt. Keine automatischen Gesamtmaterialkosten bei unvollständigen Rezept-Abhängigkeitsbäumen.
- Materialverlust und Marktpreise **werden hier nicht vorgegeben**.
- Die Preis-UI soll Namen/IDs automatisch aus den Material- und Gegenstandsdateien bereitstellen; Preisfelder bleiben **leer**.

## Quellen

Die belegten Einzelrezept-URLs stehen in jeder neuen Zeile. Bereichsquellen: Aion2Data /crafting/blacksmithing, /handicrafting, /armorsmithing und /alchemy. Referenzabbildung Global/Asia siehe https://aion2.gg/guides/global-vs-asia .
