# Build Master – Zweite Crafting-Datenergänzung V4 importieren

Ich habe dir das zweite Crafting-Datenpaket `BuildMaster_Crafting_Ergaenzung_V4_Manuelle_Preise.zip` hochgeladen. Das ergänzt das erste Paket V3. Bitte lies zuerst `README_START_HIER.md` und `ABDECKUNG_V4.json`.

## Ziel
Ergänze die Crafting-Datenbank um die verifizierten neuen Rezeptdaten, **ohne das Design oder bestehende Funktionen von Build Master zu verändern**.

## Import
- Verwende die fertig zusammengeführten Dateien `10_IMPORT_FERTIG_Rezepte_Gesamt.csv` und `11_IMPORT_FERTIG_Direktzutaten_Gesamt.csv` als neue Kanon-Datenbasis. Nicht zusätzlich dieselben Rezept- und Zutatenzeilen aus V3 duplizieren.
- Lade `03_Transfer_Voraussetzungen.csv` als eigenständige Tabelle (Item-Input für Übertragungen getrennt von normalen Direktzutaten).
- Migriere die in V3 provisorisch vergebenen Orb-Recipe-Keys gemäß `04_V3_Orb_ID_Korrekturen.csv`. Referenzen auf alte Keys aktualisieren, keine doppelt angelegten Projekte.
- Baue `09_Orb_Projektkette.csv` als bestätigtes Beispiel für die Reihenfolge ein. Der Spieler darf an einer beliebigen vorhandenen Stufe starten oder jeden erledigten Step nachträglich markieren.

## Korrekte Crafting-Logik
- Trenne Grund-Craft-Erfolg, Combo-Aktivierung, effektive Endchance und sichere Transfers. Das 80%-Planungsziel ist n80 der *effektiven Endchance bei der tatsächlichen Charakter-Handwerksstufe*, nicht pauschal 25%.
- Nach jeder Aktion muss der Nutzer auswählen können: Fehlschlag, normal erfolgreich, Combo erfolgreich oder garantiert abgeschlossen. Aktualisiere Zustand/Bestand; bei gescheiterter Combo die nächste bestätigte sichere Transferoption anbieten.
- Überprüfe alle benötigten Zwischenwaffen, darunter zusätzliche 44er-Basiswaffen bei bestimmten 78er/94er-Rezepten.
- 80%-Schätzer für Einzelrezept: `ceil(log(0.2)/log(1-p_effektiv))`; bei mehrstufigen Ketten baue ein kohärentes Zustandsmodell statt n80-Werte stumpf zusammenzurechnen.
- **Keine Preis-Eingabeliste importieren und keine Preise vorausfüllen.** Stattdessen in der Anwendung ein leeres, dynamisches Formular zum manuellen Hinzufügen/Bearbeiten von Material- und Zwischenitem-Marktpreisen (Min/Max) anbieten. Rezeptzutaten können zur Auswahl dienen; kein Preisdatensatz wird automatisch erstellt. Preis und Inventarbestand getrennt verwalten, zuordnen wenn möglich über eindeutige Item-ID. Craft-vs-Buy erst bei vollständigen belegten Kosten ausgeben.

## Datenqualität
- Genau 123 ursprüngliche V3-Rezeptzeilen sind nach diesem Paket weiterhin ohne bestätigte Direktzutaten. `07_Weiterhin_fehlende_V3_Rezepte.csv` dient als Import-/Recherche-Rückstand, nicht als fertiges Rezept.
- Aus den Quelldaten darf nicht auf die Erhältlichkeit in jedem EU-Patch geschlossen werden. Kennzeichne Region, Quellenzeit und nicht-verifizierte alternative Transferitems.
- Leere Preise, Chancen und Zutaten keinesfalls als 0 behandeln.
- Bestehende Charaktere, Kisk-Verbindung, Arcana, Gear-Vergleich und Upgrade-Pfad unangetastet lassen. Keine Änderung der Farben, Animationen, Karten oder Navigation außerhalb des neuen Crafting-Reiters.

## Abnahme
- Prüfe Eindeutigkeit aller `recipe_key`-Werte und dass keine Zutat/kein Transferitem doppelt gezählt wird.
- Teste für Elyos/Asmodian beide Orb-Ketten inklusive Lv18,22,28,35,39,44,62,70,78,86,94,102; die 22/35/44/70/86/102 Ergebnisse können über Bonus oder Safe-Rezept anfallen.
- Prüfe die Input-/Output-Abhängigkeiten aus `03_Transfer_Voraussetzungen.csv`, besonders separate Zusatzkosten der 44er-Basiswaffe.
- Verifiziere n80(25%) = 6 und unterscheide es vom mathematischen Erwartungswert 4.
- Zeige nachvollziehbar an, wo andere Waffen-, Schmuck- oder Rüstungsrezepte noch keine vollständigen Mengen haben.

Bitte ausschließlich diese Import-Erweiterung implementieren und mir danach eine Übersicht von fertig, teilweise fertig und noch offen geben.
