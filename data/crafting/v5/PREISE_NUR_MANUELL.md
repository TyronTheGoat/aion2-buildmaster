# Änderung gegenüber V4: Preise nur manuell

Die zwei vorbereiteten Preistabellen (`06_Neue_Marktpreis_Eingaben.csv` und `12_IMPORT_FERTIG_Marktpreise_Gesamt.csv`) wurden **entfernt**.

## Gewünschte Funktion in Build Master
- Neue Preiszeile nur nach manueller Aktion „Preis hinzufügen“ anlegen.
- Material/Item aus den Rezeptdaten auswählen oder freie Eingabe inklusive möglicher Item-ID erlauben.
- Mindest- und Höchstpreis in Kinah und optional Referenzpreis eingeben, mit Server und Stand/Zeitpunkt.
- Gespeicherte Werte für alle betroffenen Crafting-Projekte wiederverwenden.
- Niemals unbekannte Preise als 0 interpretieren.
- Rezeptdaten und Materialmengen unbedingt beibehalten: die Preisliste war nur eine Eingabevorlage, keine Zutatenliste.
- Optional Lagerbestand separat erfassen und beim Projekt reservieren.
