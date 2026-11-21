# Aion 2 BuildMaster

Mobile-first Web-App (PWA), die deinen Aion-2-Charakter von [kisk.app](https://kisk.app) lädt,
jeden Slot bewertet, die BiS-Linien pro Slot zeigt und einen priorisierten Upgrade-Pfad ausgibt
(was neu rollen, was ersetzen, wo Arcana farmen).

## Funktionen
- Startseite mit Charakterauswahl, neue Charaktere über **+** und kisk.app-Link
- Ausrüstung & Arcana im Ist-Stand mit Icons, ✓/✗ je Linie und Fortschritt „X/Y BiS“
- Tippen auf ein Teil öffnet das BiS-Ziel von kisk.app: Ist vs. Ziel je Linie,
  bei Arcana mit Ziel-Stufe je Fähigkeit (✓ erreicht, ◐ zu niedrig, ✗ fehlt)
- Upgrade-Pfad: sortiert nach Gewinn bis zur nächsten Note × Slot-Gewicht ÷ Aufwand
- Seiteninhalt einfügen als Fallback (und in der Offline-Version)
- Florentina (Spiritmaster, Odar) ist als Schnappschuss vorinstalliert

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
npm run offline  # dist/aion2-buildmaster-offline.html: eine Datei, läuft ohne Server
```
Deploy: Repo bei Vercel importieren, keine Umgebungsvariablen nötig.

## Nächste Schritte
- Parser gegen echtes kisk-HTML prüfen (Tests nutzen nachgebauten Seitentext)
- BiS-Tabellen für weitere Klassen
- Phase 2: Screenshots aus dem Spiel auslesen (Claude Vision) und mit kisk abgleichen
