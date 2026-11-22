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


---

# Build Master – Crafting V5: Marktpreise, Tab-Navigation und Projektkarten

## 0. Umfang und Änderungsverbot
Diese Erweiterung **ergänzt V4, ersetzt aber NICHT die vorhandenen verifizierten Rezept-/Material-/Chancendaten**. Alle Originaldaten und der V4-Prompt sind im ZIP unverändert mit enthalten. Implementiere die neuen Features auf Basis der aktuellen Build-Master-App. **Keine bestehenden UI-Layouts, Styles, Farbpaletten, Animationen oder Komponenten neu erfinden.** Kein Umbau der Kisk-, Equipment-, Arcana- oder bestehenden Next-Steps-Berechnung.

## 1. Crafting an derselben Stelle wie Equipment und Arcana
Der jetzige Crafting-Zugang über den oberen Header in der Nähe von „Refresh/Aktualisieren“ und „Switch Character/Charakter wechseln“ ist unerwünscht.

- Suche in der aktuellen Charakteransicht den vorhandenen **zweistufigen Equipment/Arcana-Umschalter** (Gear/Arcana; in der Offline-Vorlage ein `role="switch"` mit einem zweigeteilten `grid-cols-2`-Steuerelement).
- Verwandle diesen Bereich gezielt in eine **dreiteilige, zusammengehörige Auswahl**: `Equipment | Arcana | Crafting` (oder bestehende lokalisierte Bezeichnung für Equipment beibehalten). Crafting steht **rechts von Arcana, auf exakt derselben Höhe** und mit gleicher Höhe, Abständen, Rahmen, Hintergrund und Hover-/Aktivzuständen.
- Entferne den separaten Crafting-Einstieg oben neben Aktualisieren/Charakter wechseln, **falls vorhanden**. Diese vorhandenen zwei Buttons bleiben an ihrer bisherigen Stelle und funktionieren weiter.
- Klick auf Crafting: Die **gesamte Inhaltsansicht** wechselt zur Crafting-Ansicht, nicht nur eine kleine untergeordnete Box im Equipment-Inhalt. Aktive Charakteridentität bleibt gleich.
- **Reuse exakt die bestehende Seitenwechsel-/Drehanimation** (`wheel-in-ccw`/`wheel-out-ccw` bzw. die in der aktuellen Projektversion verwendete Animation). Kein neues Flip-Framework erfinden, kein Wechsel zurück auf die Charakterauswahl, kein Navigations-Reset. Beachte `prefers-reduced-motion` und verhindere Doppelwechsel während laufender Animation.
- Eine bestehende Detailansicht darf nicht ungewollt offen bleiben; sichere interne Crafting- und Equipment-States sauber pro Ansicht. Keine Daten beim Tabwechsel verlieren.

## 2. Crafting-Seite – vorhandenes Karten-Design exakt wiederverwenden
- Innerhalb von Crafting gibt es `Crafting-Projekte`, `Crafting Next Steps` und `Marktpreise` als **Unteransichten** oder bestehende Subtabs im selben Stil, nicht als neue globale Hauptnavigation.
- Projekte erscheinen als **anklickbare Karten analog zu Charakterkarte (z. B. Celest) bzw. Ausrüstungskarte (z. B. Waffe)**: gleiche Card-Komponenten, Typografie, Padding, Rundungen, Schatten, Rahmen, indirekte Hintergrundbeleuchtung/Glow und ggf. Microanimationen.
- Karteninhalt: vorhandenes korrekt zugeordnetes Itemicon oder `Filler`-Slot; Zielgegenstand, Klasse/Slot, Projektstatus, aktuelle bestätigte Stufe → Zielstufe, nächster Step, kompakter Prozent-Fortschrittsbalken und Zahl (`65 %`) sowie optional verbleibender Preisbereich.
- Das **bestehende Rangfarbschema** soll nur verwendet werden, wenn ein tatsächlicher Item-Rang (BiS/S+/S/A/B/C/D) bekannt ist. Projektstatus oder Fortschritt dürfen nicht fälschlich als Item-Tier ausgegeben werden. Fehlt der Rang, nutze die vorhandene neutrale Akzent-/Hintergrundbeleuchtung der App statt eine neue Farbe zu erfinden.
- Karten responsiv; mobile einspaltig, Desktop in bestehendem Kartenraster. Keine zusätzlichen Bilder oder erfundenen Icons.
- Klick auf Projekt öffnet eine im bisherigen Design gestaltete Projekt-Detailansicht mit Steps, Craft-Ergebnisprotokoll, Materialien, Marktwerten und Preisen.

## 3. Zentraler Unterreiter „Marktpreise“ – leere Preise, voller Auswahlkatalog
Erstelle einen übersichtlichen, **durchsuchbaren Auswahlkatalog** für sämtliche in der lokalen Rezeptdatenbank bekannten **direkten Materialien, Zwischenprodukte, Transfer-Gegenstände, Craft-Ziele, Waffen, Schützer, Ringe, Schmuck- und Rüstungsgegenstände**. **Nicht auf die bisherigen 47 Preispositionen begrenzen.**

- `13_PREISOBJEKT_KATALOG_OHNE_PREISE.csv` ist eine START-DATEI für die Artikel-AUSWAHL, **nicht** eine Tabelle mit angelegten Preisen. Generiere die endgültige Auswahl dynamisch aus allen importierten Rezepten, Zutaten, Transfer-Abhängigkeiten und späteren neuen Rezepten. Die Liste wächst mit neuen Daten mit.
- Durchsuchbare Gruppen/Filter: Rohmaterialien (Holz, Erz, Edelsteine, Stein, Schuppen etc., soweit vorhanden), verarbeitete Materialien, Zwischenitems, Waffen, Schützer, Handschuhe, Ringe, übriger Schmuck, übrige Rüstung. Kategorien aus **wirklich verfügbaren Itemdaten** ableiten; nicht belegte Kategoriezuordnungen nicht behaupten. Freitext-Suche, Item-ID-Suche, Filter nach Fraktion/Server und Berufs-/Itemtyp.
- Bei Rezeptzielen kann eine **Item-ID fehlen**. `recipe_id` ist **keine** Item-ID; verwende zunächst `catalog_key` oder lass den Nutzer die echte Item-ID nachtragen. Bei identischen Namen aus verschiedenen Fraktionen/Qualitäten keine falschen Preis-Verknüpfungen erzeugen.
- Für gebundene / nicht handelbare Items den Kaufpreis nicht als verfügbaren Marktpreis verwenden; Handelsstatus zunächst `unbekannt` und nur nach verifizierten Daten bzw. Nutzereingabe korrigieren.
- **Erzeuge nie automatisch MarktpreisDATENSÄTZE.** Nur wenn der Nutzer „Preis hinzufügen“ klickt, entsteht ein gespeicherter Preisdatensatz. Bis dahin zeigen Material- und Itemnamen die Auswahloption, aber „Kein Preis hinterlegt“.
- Ein Preis-Eingabefeld hat: Artikel/Material, Region/Server, **Mindestpreis (Kinah)**, **Höchstpreis (Kinah)**, optional Referenzpreis, Notiz, letzte Aktualisierung. Alle Werte manuell eintragen, editieren und löschen. Keine Defaultpreise oder Nullersatz; min/max dürfen nicht vertauscht sein.
- Preise persistent (aktuelle Offline-Version über bestehenden `localStorage`-Datenmechanismus, gegen Datenverlust mit Import/Export; später DB-fähige Struktur). Zentrale Preiswerte werden von allen Crafting-Projekten desselben Servers wiederverwendet.
- Vorhandene Materialmengen gehören zur getrennten **Bestandsverwaltung**, nicht zu den Preiswerten; Reservierungen in mehreren Projekten dürfen sich nicht doppeln.

## 4. Preise sofort IN einem aktiven Craft ändern
- In jeder Projekt-Detailansicht und in jedem offenen Rezeptschritt neben jeder Zutat/Zwischenwaffe Preis, ggf. Min–Max oder den Status „Kein Preis hinterlegt“ und einen **Editieren-/Preis-eingeben-Button** anzeigen.
- Öffne denselben bereits vorhandenen Modal-/Eingabestil wie im zentralen Marktpreis-Reiter; **kein anderes Design**.
- Nutzer kann beim Craft eine neue Marktpreis-Spanne hinterlegen, z. B. weil Holz teurer geworden ist.
- Klare Wahl: **„Für alle Projekte auf diesem Server aktualisieren“ (globaler gespeicherter Preis)** oder **„Nur in diesem Projekt/Schritt verwenden“ (Override)**. Nie unbemerkt alle Server oder abgeschlossene Schritte verändern.
- Änderungen sofort in noch offenen Stufen / Next-Step-Prognosen / vollständigem Restbudget aktualisieren.
- Bereits **tatsächlich ausgegebene** Kinah und Materialverbrauch werden beim Durchführen eines Crafts als unveränderlicher Historien-Snapshot gespeichert; spätere Marktpreisedits ändern die Historie nicht.
- Kauf-vs-Craft-Vergleich und Kostenfenster verwenden aktuelle manuelle Preise, Preise für gebundene Items nicht fälschlich als kaufbar behandeln. Unbekannte Preise = fehlender Wert, nicht 0; bei unvollständigem Rezept KEINE scheinbar vollständige Gesamt-Kinahsumme zeigen.

## 5. Crafting-Projekt-Fortschritt in Prozent
- Zeige pro Projekt eine **sichtbare Zahl in Prozent** plus einen Balken unter der Kartenbeschreibung, im Design der bisherigen Karte.
- Standardformel ist `erreichte und bestätigte erforderliche Meilensteine / erforderliche Meilensteine auf der aktuell gewählten Rezeptkette × 100`. Der Nenner umfasst den vollständigen ausgewählten Zielpfad inklusive beim Projektstart als **bereits vorhanden** markierter Stufen. Technisch muss bei Combo-Abkürzungen, Safe-Upgrades und alternativen Kaufpfaden der aktive Pfad neu bestimmt werden; optional separate Material-/Budget-Fortschritte ausweisen, aber nicht vermengen.
- Prozentzahl basiert auf **abgeschlossenen Crafting-Meilensteinen**, nicht auf der Zahl ausgeführter Versuche. Ein Fehlschlag erhöht den Fortschritt nicht, kann aber Materialbestand und Restkosten verändern. Ein bereits vorhandenes Zwischenitem zählt als bestätigter Fortschritt. Ein nicht verifizierter übersprungener Schritt darf nicht als abgeschlossen zählen.
- 100 % NUR, wenn der finale Zielgegenstand tatsächlich als hergestellt/im Besitz bestätigt wurde. Fertiggestellt und ausgerüstet weiterhin getrennt behandeln.
- Kennzeichne, welche Basis die Prozentberechnung verwendet, z. B. „4 von 7 Rezeptstufen“; bei unsicheren Pfaden eine nachvollziehbare Stufen-Zählung und Datenlücken anzeigen. Keine kosmetische Fantasie-Prozentzahl.
- Mindestens ein mögliches Beispiel: Projekt 70→86→102, 86 bereits vorhanden, 102 noch offen → Projekt nicht 100 %. Die Darstellung muss eindeutig sein, auch wenn Zwischenstufen künftig ergänzt werden.

## 6. Unveränderte bestehende Regeln
- Projekt-Next-Step-Priorität: **1 Waffe, 2 Ringe, 3 Schützer, 4 Handschuhe, 5 restlicher Schmuck, 6 restliche Rüstung**. Keine Bewertung/Stat-Priorisierung für Crafting einführen.
- Rezeptwahrscheinlichkeiten, 80%-Planungsregel, Crafting-Ergebnis-Auswahl nach jedem Versuch, Safe-/Combo-Verzweigungen und V4-Abhängigkeiten bleiben erhalten.
- 80%-Budget ist ein statistisches Planungsszenario, **nicht** mathematischer Mittelwert oder Garantie. Unbekannte Erfolgsquoten nicht erfinden.
- Keine Änderung der übrigen Charakter-, Kisk-, BiS-, Arcana-, Equipment- und bisherigen Next-Steps-Funktionalität.
- Bestehende CSV-Import-Snapshots **nicht doppelt importieren**. 123 nicht vervollständigte Rezeptdatensätze bleiben als Datenlücken erkennbar.

## 7. Technische Akzeptanztests
1. Crafting ist rechts neben Arcana auf gleicher Höhe sichtbar. Der Header enthält keinen zusätzlichen Crafting-Einstieg. Refresh und Switch Character funktionieren weiter.
2. Equipment → Crafting → Arcana → Equipment nutzt die etablierte vollständige Dreh-/Seitenwechselanimation, ohne Stateverlust oder Layoutbruch.
3. Neues Projekt → Karte wie bestehende Celest-/Waffe-Karte, mit indirektem Glow und **echtem** Fortschrittswert in %.
4. Preis-Katalog enthält alle bekannten Rohstoffe/Zwischenitems und die Rezeptziel-Namen aus V4; bei neuen Rezeptimports ergänzt sich die Auswahl automatisch; kein Marktpreis steht voreingetragen.
5. Ring-/Waffen-/Rüstungskandidaten erscheinen über den verfügbaren Rezeptkatalog; neue eigene Materialien/Items per Freitext+ID anlegbar.
6. Benutzer trägt für Holz Min 10.000, Max 12.000 Kinah ein → sofort in relevanten offenen Rezepten korrekt; bisherige Crafts unverändert.
7. Benutzer ändert Holz direkt beim Craft auf 15.000–18.000 Kinah → Preview zeigt globale oder projektbezogene Auswirkungen VOR dem Speichern.
8. Wechsel zwischen Projekten und Charakteren erhält Preise, Projekte und Zustände korrekt; keine Server-Vermischung.
9. Drei Fehlversuche hintereinander erhöhen den Prozent-Fortschritt nicht. Erfolgreiche nächste Zwischenstufe schon.
10. Fehlende Marktpreise/Materialmengen verhindern vollständige Kostenaussage, statt 0-Kinah auszugeben.
11. Abgeschlossene Projekte bleiben in der Historie, aus offenen Crafting Next Steps entfernt.
12. Mobile Layout, `prefers-reduced-motion`, LocalStorage-Migration und Regressionstests bestehender Funktionen überprüfen.

## 8. Umsetzung
Analysiere ZUERST die reale Build-Master-Projektstruktur und **reuse vorhandene Komponenten und Animationen**, implementiere danach im aktuellen Code; keine komplett neue Webseite als Ersatz schreiben. Berichte anschließend kurz: geänderte Module, neu angelegte Datenstrukturen, wie Preis- und Projektfortschritt gespeichert werden, und welche Rezeptdaten fehlen. Alle V4-Rezeptdateien und Originaldaten bleiben inhaltlich unverändert.

