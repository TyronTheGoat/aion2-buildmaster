# Claude – Build Master EU-/Global-Crafting V7 (bitte zuerst lesen)

Ich habe `BuildMaster_EU_Global_Crafting_V7.zip` hochgeladen. Bitte entpacke sie und lies `README_START_HIER.md`, `ABDECKUNG.json` und `07_DIREKTZUTATEN_ABDECKUNG.csv`.

## Ziel

Importiere **ausschließlich EU-/Global-AION-2-Craftingdaten** für Waffen, Schützer, Ringe, Handschuhe, sonstigen Schmuck und Rüstung. Korea-/Taiwan-Only-Rezepte bleiben komplett aus dem aktiven Katalog und der Kostenberechnung heraus. Wenn ein Datensatz nur aus einer Global-Clientextraktion stammt, zeige „Global-Clientdaten, nicht live bestätigt“ an; behaupte keine aktuell live erreichbare EU-Rezeptfreigabe ohne Beleg.

## Datenimport

1. `01_EU_GLOBAL_REZEPTE_409.csv`: 409 eindeutige Rezept-IDs nach Fraktion und Klasse/Slot importieren, bei bestehender DB sauber zusammenführen.
2. `02_DIREKTZUTATEN_ZUSAMMEN.csv`: direkte Rezept-Zutaten, nicht die rekursiv aufsummierte Shopping-Liste. Doppelte Zutaten nach (recipe_key, material_item_id) zusammenführen, nie ungeprüft addieren.
3. `04_EU_REZEPTQUELLEN.csv`: Einzel-URLs nur bei `checked_individual_page_2026-11-22` oder `v6_individual_page` als überprüft behandeln. `candidate_generated_NOT_VALIDATED` zunächst aufrufen und verifizieren. Alle dort in der Quelle angegebenen direkten Zutaten, IDs, Mengen, Handwerksanforderungen und Erfolgsraten nachladen. Aus `07_DIREKTZUTATEN_ABDECKUNG.csv` genau diejenigen zuerst nachladen, deren `ingredient_coverage` nicht `verified_complete_individual_page` ist.
4. `05_EU_PROJEKTKETTEN_V6.csv`: als vorläufige Relation nutzen. Garantierte Upgrades und Combo-Alternative als alternative Kanten in einem Rezeptgraphen modellieren, nicht alle als nacheinander verpflichtende Stufen. Unbestätigte Zwischenitem-Abhängigkeiten vor Kostenausgabe prüfen.
5. Nutze `06_PREISOBJEKTE_MANUELL_OHNE_PREISE.csv` als durchsuchbare Vorschlagsliste. Der Nutzer trägt für jedes Material und jeden handelbaren Zwischengegenstand Minimum/Maximum in Kinah manuell ein. Niemals automatische Marktpreise eintragen.

## 80%-Planungsregel

`n80 = ceil(log(0.2)/log(1-p))` für 0<p<1, sonst n80=1 bei 100% Erfolg. Bei p=0.25 sind das 6 Versuche.

Berechne pro Craft **separat**:
- `p_normal_at_required_mastery`, `p_normal_best_documented`, `p_combo_result_per_attempt_best`
- `n80_normal_at_required`, `n80_normal_best`, `n80_combo_best`

Bei einer Combo gilt: Die Spalte `p_combo_result_per_attempt_best` ist **bereits die gesamte Chance pro Versuch auf das Combo-Endergebnis**. Nicht noch einmal mit `combo_activation_p` multiplizieren. Effektive Werte abhängig vom Spieler-Handwerkslevel nur mit bestätigter Chance übernehmen; nicht interpolieren.

Der 80%-Wert ist ein **Richtwert für einen Schritt**, weder der statistische Mittelwert noch eine 80%-Garantie für die gesamte Rezeptkette. Keine Überbehauptung bei Gesamtbudgets.

## UI und bestehende Funktionen

- **Kein Redesign**. Das vorhandene dunkelblaue Build-Master-Design, die Gear-Karten, Rahmen, Schatten und Animationen unverändert wiederverwenden.
- Crafting als gleichrangiger Umschalter **rechts neben Equipment und Arcana**, exakt auf deren Höhe; derselbe vorhandene Karten-/Dreheffekt beim Seitenwechsel.
- Crafting-Unterseiten: **Projekte**, **Crafting Next Steps**, **Marktpreise**.
- Projekte zeigen Projektname, Slot, Start-/Zielstufe, nach belegten Schritten berechneten prozentualen Fortschritt, nächsten Craft und Materialbedarf.
- Feste Priorität: **Waffe > Ringe > Schützer > Handschuhe > übriger Schmuck > übrige Rüstung**; unabhängig vom Gear-Rang.
- Spieler kann bei einer bestätigten Zwischenstufe anfangen und vorgelagerte fertige Schritte überspringen, aber später noch notwendige zusätzliche Zutaten/44er-Basiswaffen bleiben im Bedarf.
- Crafting-Aktion: Spieler wählt den im Spiel beobachteten Craft-Ausgang, System setzt den nächsten Schritt entsprechend dem belegten Rezeptgraphen. Kein spekulatives Materialverlust-Modell.
- Materialien/Marktpreise sind während des Crafts editierbar. Globale Marktpreisänderung aktualisiert künftige Prognosen, nicht die historische tatsächlich gezahlte Summe.
- Keine Kostenprognose als „vollständig“, solange notwendige Zutaten oder Bedingungen unbekannt sind; zeige unvollständige Summen mit klarer Lückenliste.
- Crafting-Projekte separat von Kisk lokal speichern. Keine Überschreibung durch Kisk-Refresh.

## Validation

1. 409 einzigartige Rezeptzeilen, kein Asia-Only-Datensatz aus fremden Quellen.
2. 25% effektive Chance -> 6 Versuche für 80%-Planung; 100% -> 1; unbekannt -> keine fiktive Zahl.
3. Finale Combo-Chance nicht nochmals multiplizieren.
4. Einzelseite liefert bei einem Rezept 6 direkte Zutaten -> erst dann „vollständig“ wenn exakt diese sechs korrekt übernommen wurden.
5. Preis-Eingaben starten leer; manuelle Eingaben sind persistent.
6. Crafting-Projekte der Charaktere sauber getrennt; neue Inhalte im bestehenden Design.
7. Fehlende Global-Daten transparent als „Unbekannt / noch nicht geprüft“ darstellen.

Bitte implementiere die vorhandenen Daten sicher und ergänze weitere verifizierte EU-/Global-Einzelrezepte anhand der Rezept-URLs, ohne Asien-Rezepte zu vermischen.
