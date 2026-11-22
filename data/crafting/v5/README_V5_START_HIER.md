# Build Master – V5: Preisverwaltung + Crafting-Reiter + Projektkarten

Diese Version baut auf dem **inhaltlich unveränderten V4-Paket mit manuellen Preisen** auf. Alle ursprünglichen CSV/JSON/MD-Dateien wurden **bytegenau kopiert**, nicht ersetzt oder bearbeitet.

## WAS NEU IST
- `13_PREISOBJEKT_KATALOG_OHNE_PREISE.csv` – **214 auswählbare Einträge** aus den V4-Quellen (Zutaten, Transfergegenstände und Rezeptziel-Kandidaten). **Preisfelder sämtlich leer; keine Nutzerpreise angelegt.** Der spätere App-Katalog soll **dynamisch** aus sämtlichen verfügbaren Datensätzen wachsen.
- `14_PREISDATEN_SPEICHERSCHEMA_BEISPIEL.json` – Vorschlag für globale/projektbezogene Preisfelder und Historie; keine Testpreise.
- `15_CLAUDE_ERWEITERUNG_PREISE_TABS_KARTEN.md` – alle neuen UI- und Preis-Anforderungen.
- `CLAUDE_PROMPT_GESAMT_V5.md` – V4-Implementierungsprompt plus V5-Erweiterung in einer Datei.

## WICHTIGE ABGRENZUNG
Die Preiseingaben sollen manuell erfolgen; **die Liste der AUSWÄHLBAREN Material- und Itemnamen darf aus den Rezeptdaten stammen**. Die Auswahl ist weder eine Liste echter Marktpreise noch eine Garantie, sämtliche Crafting-Items aus AION 2 abzudecken. Die Datenbasis umfasst derzeit 158 Rezeptschlüssel und 146 direkte Zutatenzeilen; 123 ursprünglich fehlende Rezepte bleiben laut V4 offen. Item-IDs in Rezeptzielen sind nicht automatisch bekannt: `recipe_id != item_id`.

## WIE AN CLAUDE ÜBERGEBEN?
1. Diese ZIP vollständig hochladen.
2. Claude ausdrücklich auffordern, **`CLAUDE_PROMPT_GESAMT_V5.md` zu lesen und umzusetzen**.
3. V4-Snapshots `10_IMPORT_FERTIG_Rezepte_Gesamt.csv` und `11_IMPORT_FERTIG_Direktzutaten_Gesamt.csv` als Kanondaten importieren; nicht noch einmal die Einzel-CSV duplizieren.
4. Vorhandene Build-Master-App/HTML als Ziel bereitstellen, damit Claude echte bestehende Components und die Dreh-Animation wiederverwendet.

## VORHER / NACHHER
- V4: Preise werden nur manuell angelegt; einfacher leerer Preisformular-Bereich.
- V5: Materialien/Items **durchsuchbar und auswählbar**, Preisfelder weiterhin leer bis Benutzer eingibt, Änderungen im Crafting-Projekt möglich; Crafting direkt im Equipment/Arcana-Umschalter, komplette Drehansicht, Projektkarten mit echtem %.

Es wurden keine Marktpreise, Itemicons oder Rezepte erfunden.
