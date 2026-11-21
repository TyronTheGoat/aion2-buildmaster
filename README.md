# Aion 2 BuildMaster

Mobile-first Web-App (PWA), die deinen Aion-2-Charakter von [kisk.app](https://kisk.app) lädt,
jeden Slot bewertet, die BiS-Linien pro Slot zeigt und einen priorisierten Upgrade-Pfad ausgibt
(was neu rollen, was ersetzen, wo Arcana farmen).

## Funktionen (MVP)
- Charakter über Region/Server/Name oder kisk-Link laden, Favoriten auf dem Gerät speichern
- Übersicht: Gear-Note, Ø-Score, Notenverteilung
- Upgrade-Pfad: sortiert nach Gewinn bis zur nächsten Note × Slot-Gewicht ÷ Aufwand
- Ausrüstung & Arcana: jede Linie mit Wert/Max und Anteil der Top-Spieler (✓ ≥ 50 %)
- Fallback „Einfügen“: kisk-Seite kopieren und einfügen, falls das Laden nicht klappt
- `/demo`: Schnappschuss von Florentina (Spiritmaster, Odar)

## Datenquellen
- Charakterdaten: kisk.app (max. ein Abruf pro Charakter alle 30 Minuten, Quelle wird angezeigt)
- BiS-Linien: kisk.app/scoring (Stand 2026-10-19), aktuell nur Spiritmaster in `src/lib/knowledge/ideal-lines.ts`
- Arcana-Quellen: metabot.gg Arcana-Guide, `src/lib/knowledge/arcana.ts`

## Entwicklung
```bash
npm install
npm run dev      # http://localhost:3000
npm test         # Parser- und Advisor-Tests
npm run build
```
Deploy: Repo bei Vercel importieren, keine Umgebungsvariablen nötig.

## Nächste Schritte
- Parser gegen echtes kisk-HTML prüfen (Tests nutzen nachgebauten Seitentext)
- BiS-Tabellen für weitere Klassen
- Phase 2: Screenshots aus dem Spiel auslesen (Claude Vision) und mit kisk abgleichen
