// Builds src/lib/knowledge/item-catalog.json from the researched item list
// (data/item-catalog.source.json) plus any verified icons:
//  - data/icon-manifest.json  (output/manifest.json of download_icons.py, imported via import-icons.mjs)
//  - OFFICIAL_ICONS below      (icons seen on kisk.app, served by NCSOFT's own CDN)
// Never invents icons: items without a verified file/URL stay without one.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const CDN = "https://assets.playnccdn.com/static-aion2-gamedata/resources/";

/** Icon file names verified on kisk.app character pages (2026-11-21). */
const OFFICIAL_ICONS = {
  "Splendent Ebony Dragon Lord Orb": "Icon_WP_OR_0100_T06.png",
  "Nuakum Guard": "Icon_Weapon_Guarder_L_012.png",
  "Nuakum Breastplate": "Icon_Equip_AR_L_Idris_01_Torso.png",
  "Nuakum Greaves": "Icon_Equip_AR_L_Idris_01_Pants.png",
  "Nuakum Helm": "Icon_Equip_AR_L_Idris_01_Helmet.png",
  "Nuakum Pauldrons": "Icon_Equip_AR_L_Idris_01_Shoulder.png",
  "Nuakum Gloves": "Icon_Equip_AR_L_Idris_01_Gloves.png",
  "Nuakum Boots": "Icon_Equip_AR_L_Idris_01_Boots.png",
  "Nuakum Cloak": "Icon_Equip_AR_L_Idris_01_Cape.png",
  "Enraged Kromede Necklace": "Icon_ACC_NL_0053.png",
  "Enraged Kromede Earrings": "Icon_ACC_ER_0053.png",
  "Enraged Kromede Ring": "Icon_ACC_Ring_0053.png",
};

const SOURCE_LABEL = (s) =>
  s.startsWith("Crafting_Stufe_") ? `Crafted Gear (Stufe ${s.split("_").pop()})`
    : s === "Grimmhornhoehle" ? "Grimmhornhöhle" : s;
const CATEGORY_LABEL = { Waffen: "Waffen", Ruestung: "Rüstung", Schmuck: "Schmuck" };

const src = JSON.parse(readFileSync(path.join(root, "data/item-catalog.source.json"), "utf8")).items;
const manifestPath = path.join(root, "data/icon-manifest.json");
const manifest = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, "utf8")) : [];
const byKey = new Map(manifest.map((m) => [m.key, m]));

let local = 0, official = 0;
const items = src.map((it) => {
  const m = byKey.get(it.key);
  let icon = "", iconSource = "";
  if (m?.icon_file && ["bild_gespeichert", "bild_vorhanden"].includes(m.status)) {
    icon = "/item-icons/" + m.icon_file.replace(/^icons\//, "");
    iconSource = m.icon_source_page || m.icon_url || "download_icons.py";
    local++;
  } else if (OFFICIAL_ICONS[it.name_en]) {
    icon = CDN + OFFICIAL_ICONS[it.name_en];
    iconSource = "kisk.app (NCSOFT CDN)";
    official++;
  }
  return {
    key: it.key,
    name: it.name_en,
    itemId: m?.item_id || it.item_id || "",
    source: SOURCE_LABEL(it.source),
    category: CATEGORY_LABEL[it.category] ?? it.category,
    slot: it.slot,
    level: it.level,
    rarity: it.rarity,
    faction: it.faction,
    icon,
    iconSource,
  };
});

writeFileSync(path.join(root, "src/lib/knowledge/item-catalog.json"), JSON.stringify(items));
console.log(`item-catalog.json: ${items.length} Items, ${local} lokale Originalbilder, ${official} offizielle CDN-Icons, ${items.length - local - official} ohne Bild`);
