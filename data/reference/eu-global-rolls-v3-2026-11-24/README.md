# BuildMaster EU/Global – bestätigte Slotpools + Skillzuordnung

**Import-V3, 24.11.2026**

Dieses Paket baut auf deinen vorherigen Arcana-/Gear-Daten V2 auf, bereinigt die Darstellung der Wahrscheinlichkeiten und trennt die Quellen deutlich.

**Umfang**
- 8 Klassen, 176 reguläre Skills (96 aktiv, 80 passiv)
- 352 Klasse/Karte/Skill-Zuordnungen (22 Gral + 6 Pergament + 6 Kompass + 5 Glocke + 5 Spiegel pro Klasse)
- 40 Arcana-Kartenversionen (5 Slots × 2 Familien × 4 Seltenheiten)
- 13 Gear-Slotgruppen, 255 zulässige normale Stat-Zuordnungen inklusive Prozentgewicht und Min-/Max-Referenzwert
- 1.008 Klasse/Gear-Slot/Skill-Roll-Möglichkeiten (288 aktive, 720 passive)
- Ein JSON-Gesamtimport und Claude-Anleitung

**Wichtig**: Die Gear-Prozente in CSV 03/04 beziehen sich auf eine **einzelne anfängliche Ziehung**. Die Quellen-Webseiten zeigen teils andere Prozente für „Stat taucht irgendwo unter mehreren Zeilen auf“ – diese Werte dürfen nicht verwechselt werden. Die meisten Stat-Ranges beziehen sich nur auf Item-Level 102, Armbänder auf 86. Deutsche Übersetzungen und jede Einzelitem-ID sind nicht vollständig nachgeprüft. Kein Skill-Levelrechner ist umgesetzt.

**Start für Claude:** `CLAUDE_IMPORT_PROMPT.md` lesen. Daten aus `07_GESAMT_IMPORT.json` *oder* CSV 01–06 importieren, niemals beides. Vorhandene Benutzer-/Charakterdaten nicht überschreiben.
