# Aion 2 BuildMaster

Mobile-first Web-App (PWA), die deinen Aion-2-Charakter von [kisk.app](https://kisk.app) lädt,
jeden Slot bewertet, die BiS-Linien pro Slot zeigt und einen priorisierten Upgrade-Pfad ausgibt
(was neu rollen, was ersetzen, wo Arcana farmen).

## Funktionen
- Startseite mit Charakterauswahl, neue Charaktere über **+** und kisk.app-Link
- 3D-Hologramm je Charakter: die Bildmaster-Charaktermodelle (GLB, weiblich/männlich) mit projizierter Detail-Referenz
  vor einem Dungeon-/Wald-Hologramm-Hintergrund; kurze Klassen-Startanimation bei jeder Auswahl; Idle nur durch Atmen, leichtes Schweben und Gewichtsverlagerung (kein Rig), drehen/zoomen.
  Slot-Bereiche, Klickflächen und Ankerpunkte für Schmuck und Waffe werden beim Laden aus der Geometrie gemessen.
  Fehlen die Modelldateien, nutzt die App den eingebauten MakeHuman-Körper (CC0, `node scripts/build-human-mesh.mjs`).
  Aura je Teil in Farbe UND Stärke nach Note (BiS gold mit Funken, S+ pink, S violett, A grün, B lime, C grau, D schwach rot);
  die Waffe bekommt zusätzlich Halo und Funken. Nur die echte Klassenwaffe wird gezeigt (Schild nur bei Schwert/Streitkolben).
  Reiter „Ausrüstung“ rechts listet alle Teile (Ring 1/2, Armband 1/2 …); Tippen auf Teil oder Eintrag fliegt die Kamera hin
  und zeigt Ist vs. BiS. Das Geschlecht wird beim ersten Öffnen einmal gewählt und dauerhaft gespeichert.
  Die Waffe (Orb, Schwert, Stab, Bogen …) wird aus dem Waffennamen bzw. der Klasse abgeleitet. Keine Spiel-Assets.
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

## Original-Itembilder (Gear-Asset-Paket)
- `data/item-catalog.source.json`: 330 recherchierte Items (Feuertempel, Grimmhornhöhle, Ludra, Crafted Gear 62–102, Elyos/Asmodier)
- `node scripts/build-item-catalog.mjs` erzeugt `src/lib/knowledge/item-catalog.json`; nur verifizierte Bilder werden eingetragen
- Nach dem Lauf von `download_icons.py`: `node scripts/import-icons.mjs <assetpack-ordner>` kopiert `icons/` nach `public/item-icons/`
  (per .gitignore nicht im öffentlichen Repo) und trägt sie ein; die Offline-Datei bettet sie ein
- Fehlt ein Bild, zeigt die App „Bild fehlt“ statt eines Ersatzbildes

## Charaktermodelle, Hero-Szene und Waffen
- `node scripts/import-assets.mjs <entpacktes-paket> [...]` übernimmt die Bildmaster-Pakete:
  Charaktermodelle → `public/models/`, Hero-Hintergründe und Detail-Referenzen → `public/hero/`, Klassenwaffen → `public/weapons/`
- Modelle, Hintergründe und Referenzen sind aus Bildern abgeleitet bzw. Bilder, deren Rechte nicht geklärt sind:
  `public/models/` und `public/hero/` sind per .gitignore nicht im öffentlichen Repo. Die Waffen-GLBs sind eigene prozedurale
  Entwürfe und liegen im Repo. `npm run offline` bettet alles Installierte in die Offline-Datei ein.
- Meshy-Modelle (v3, detailreich, ohne Rig): `node scripts/optimize-character.mjs <male|female> <Meshy_AI_model.glb>`
  stellt die Füße auf y = 0, skaliert auf Körpergröße, reduziert auf ca. 60k Dreiecke und die Textur auf 1024 px WebP.
  v3 hat Vorrang vor v2; ihr Hell-Dunkel wird im Shader zum Hologramm (Farbton fällt weg).
- Geriggte Modelle (v4, Mixamo-Skelett): `node scripts/rig-character.mjs <male|female> <rigged.glb> [<texturiert.glb>]`
  skaliert Mesh, Skelett und Bind-Matrizen auf Körpergröße und vereinfacht; mit einem texturierten Modell in gleicher Pose
  werden dessen Mesh und Textur übernommen und die Skin-Gewichte übertragen. v4 hat Vorrang vor v3.
  Die Mixamo-Knochen folgen den App-Knochen (`RIG_MAP` in `model-body.ts`): Kampfhaltung, Atmen, Intro-Choreografien
  (`pose` in `intro.ts`) und Fingergriff laufen auf dem echten Skelett.
- Der Orb ist ein eigenes, festes Modell (Kristall in Klauenfassung): `node scripts/make-orb.mjs`.
- Auren: Palette und Stärke je Rang in `src/lib/hologram.ts` (BiS Gold … D Crimson, ungeprüft Grau); Waffe am stärksten,
  Rüstung dezenter, Schmuck kompakter, BiS/S+ pulsieren und funkeln.
- Übersicht: der Charakter dreht sich auf der gemalten Plattform (kein Kippen/Zoomen); Nahansichten dürfen beides.
- Die Detail-Referenz (nur für v2) wird beim Laden pro Körperteil auf das Modell projiziert (Gelenke werden auf Modell und Bild gemessen);
  die Rückseite bekommt einen sauberen Scan statt der gespiegelten Vorderseite.
- Hintergrund als 2.5D-Ebene nach dem Bloom: Parallaxe, zwei Nebelschichten, Vignette mit Lichtfokus, fallende Blätter.
- Klassenwaffen und Intros: `src/components/holo/weapons.ts` (Loadout und Halte-Pose je Klasse),
  `src/components/holo/intro.ts` (Choreografien nach `animation_blueprints_v2.json`).
  Ohne Rig spielen nur Waffen- und Lichtspuren; Körper mit Knochen spielen zusätzlich die Arm-Spur (`pose`).
- Für ein späteres geriggtes Modell: seine Knochen auf die `BoneName`s abbilden (`body.ts`), die Halte-Posen in
  `weapons.ts` an den Handknochen kalibrieren und `animatable` setzen; Slots, Auren, Kamera und Intros bleiben gleich.

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
