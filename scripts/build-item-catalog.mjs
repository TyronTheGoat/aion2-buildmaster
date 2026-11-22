// Builds src/lib/knowledge/item-catalog.json from every item source we have, with a region
// verdict and evidence per item. Never invents icons or IDs.
//
// Sources (all optional except the first):
//  - data/item-catalog.source.json   330 planned items (aion2.gg family lists, IDs unconfirmed)  → region unclear
//  - data/eu-verified-items.json     items with IDs from aion2.market (EU) or the KINA/TW index    → EU / TW
//  - data/gear-catalog.json          output/catalog.json of collect_and_download.py (NCSOFT TW)   → TW
//  - data/icon-manifest.json         output/manifest.json of the first download_icons.py          → local icons
//  - OFFICIAL_ICONS                  items seen equipped on an EU character via kisk.app           → EU + icon
import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const CDN = "https://assets.playnccdn.com/static-aion2-gamedata/resources/";
const read = (p) => (existsSync(path.join(root, p)) ? JSON.parse(readFileSync(path.join(root, p), "utf8")) : undefined);
const items = (j) => (Array.isArray(j) ? j : j?.items ?? []);

/** Icon file names verified on kisk.app for the EU character Florentina (Odar), 2026-11-21. */
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
  "Ascension Bracelet": "Icon_Acc_Bracelet_R_027.png",
  "Liberator Bracelet": "Icon_ACC_Bracelet_0071.png",
  "Noble Belt": "Icon_Acc_Belt_C_022.png",
  "Clash Rune": "Icon_Acc_Rune_R_002.png",
  "Revelation Amulet": "Icon_Item_Craft_Conversion_Crystal_L_lv5_01.png",
};
const KISK_EVIDENCE = { region: "EU", source: "kisk.app: auf EU-Charakter Florentina (Odar) ausgerüstet", url: "https://kisk.app/c/eu/odar/Florentina/gear", date: "2026-11-21" };

const SOURCE_LABEL = (s = "") =>
  s.startsWith("Crafting_Stufe_") ? `Crafted Gear (Stufe ${s.split("_").pop()})` : s === "Grimmhornhoehle" ? "Grimmhornhöhle" : s;
const CATEGORY = { Waffen: "Waffen", Ruestung: "Rüstung", Schmuck: "Schmuck", Fluegel: "Flügel" };
const RARITY = { Einzigartig: "Unique", Episch: "Epic", Legendary: "Legendary", Legend: "Legendary" };
const SLOT_CATEGORY = {
  Greatsword: "Waffen", Longsword: "Waffen", Dagger: "Waffen", Bow: "Waffen", Spellbook: "Waffen", Orb: "Waffen",
  Mace: "Waffen", Staff: "Waffen", Guard: "Waffen", Gauntlet: "Waffen", Fist: "Waffen",
  Helm: "Rüstung", Breastplate: "Rüstung", Top: "Rüstung", Pauldrons: "Rüstung", Gloves: "Rüstung", Greaves: "Rüstung",
  Legs: "Rüstung", Boots: "Rüstung", Shoes: "Rüstung", Cloak: "Rüstung",
  Necklace: "Schmuck", Earrings: "Schmuck", Ring: "Schmuck", Bracelet: "Schmuck", Amulet: "Schmuck", Belt: "Schmuck", Brooch: "Schmuck", Rune: "Schmuck",
  Wings: "Flügel",
};
const norm = (s) => String(s || "").toLowerCase().replace(/[’']/g, "'").replace(/[^a-z0-9']+/g, " ").trim();
const slotFromName = (n) => Object.keys(SLOT_CATEGORY).find((s) => new RegExp(`\\b${s}s?\\b`, "i").test(n)) ?? "";

/** key → merged item */
const merged = new Map();
const byId = new Map(), byName = new Map();
function upsert(rec) {
  let cur = (rec.itemId && byId.get(rec.itemId)) || (!rec.itemId && byName.get(norm(rec.name))) || undefined;
  // a name-only record may also match an item that already has an ID
  if (!cur && rec.itemId) {
    const n = byName.get(norm(rec.name));
    if (n && !n.itemId) cur = n;
  }
  if (!cur) {
    cur = { key: rec.itemId ? `id:${rec.itemId}` : `name:${norm(rec.name)}`, regions: [], ...rec, regions: [] };
    merged.set(cur.key, cur);
  } else {
    for (const k of ["itemId", "source", "category", "slot", "level", "rarity", "faction", "icon", "iconSource", "itemPage"])
      if (!cur[k] && rec[k]) cur[k] = rec[k];
  }
  for (const ev of rec.regions ?? []) if (!cur.regions.some((e) => e.region === ev.region && e.source === ev.source)) cur.regions.push(ev);
  if (cur.itemId) byId.set(cur.itemId, cur);
  if (!byName.has(norm(cur.name))) byName.set(norm(cur.name), cur);
  return cur;
}

// 1) EU / TW seed with real IDs
for (const s of items(read("data/eu-verified-items.json"))) {
  const eu = /^EU/.test(s.region_status);
  upsert({
    itemId: s.item_id, name: s.name_en, slot: s.slot, category: CATEGORY[s.group] ?? SLOT_CATEGORY[s.slot] ?? "",
    rarity: RARITY[s.rarity] ?? s.rarity, level: s.required_level ?? undefined, itemPage: s.item_page,
    regions: [eu
      ? { region: "EU", source: `aion2.market EU-Katalog (${s.region_status.replace(/^EU-Katalog verzeichnet; /, "")})`, url: s.item_page }
      : { region: "TW", source: "aion2kina KINA/TW-Index (EU nicht verifiziert)", url: s.item_page }],
  });
}

// 2) full NCSOFT TW dictionary from collect_and_download.py (if imported)
for (const s of items(read("data/gear-catalog.json"))) {
  const eu = /^EU/.test(String(s.region_status));
  upsert({
    itemId: String(s.item_id), name: s.name_en, slot: s.slot, category: CATEGORY[s.group] ?? SLOT_CATEGORY[s.slot] ?? "",
    rarity: RARITY[s.rarity] ?? s.rarity, level: s.item_level ?? s.required_level ?? undefined, faction: s.faction || undefined,
    itemPage: s.item_page,
    // canonical original URL (works on the web); the offline build inlines the downloaded file for it
    icon: s.icon_url || (s.icon_file ? "/item-icons/" + String(s.icon_file).replace(/^icons\//, "") : ""),
    iconSource: s.icon_file ? "NCSOFT (Original-Icon, heruntergeladen + SHA-256 geprüft)" : s.icon_url ? "NCSOFT (Original-Icon)" : "",
    regions: [eu ? { region: "EU", source: String(s.region_status), url: s.source_index } : { region: "TW", source: "NCSOFT TW-Itemdictionary", url: s.source_index }],
  });
}

// 3) planned list (names, families) – region stays unclear unless confirmed elsewhere
const manifest = new Map(items(read("data/icon-manifest.json")).map((m) => [m.key, m]));
for (const it of items(read("data/item-catalog.source.json"))) {
  const m = manifest.get(it.key);
  const local = m?.icon_file && ["bild_gespeichert", "bild_vorhanden"].includes(m.status);
  upsert({
    itemId: m?.item_id || undefined, name: it.name_en, source: SOURCE_LABEL(it.source),
    category: CATEGORY[it.category] ?? it.category, slot: it.slot, level: it.level, rarity: RARITY[it.rarity] ?? it.rarity,
    faction: it.faction, itemPage: m?.item_page || it.family_url,
    icon: local ? "/item-icons/" + m.icon_file.replace(/^icons\//, "") : "", iconSource: local ? "download_icons.py" : "",
    regions: [],
  });
}

// 4) items seen on the EU character: EU evidence + official icon
for (const [name, file] of Object.entries(OFFICIAL_ICONS)) {
  const slot = slotFromName(name);
  // kisk shows the name, not the item ID: merge only when the name belongs to exactly one ID,
  // otherwise keep a separate EU entry so no single TW ID is wrongly marked as EU
  const ids = [...merged.values()].filter((m) => m.itemId && norm(m.name) === norm(name));
  const rec = { name, slot, category: SLOT_CATEGORY[slot] ?? "", regions: [KISK_EVIDENCE] };
  let it;
  if (ids.length === 1) it = upsert({ ...rec, itemId: ids[0].itemId });
  else if (ids.length === 0) it = upsert(rec);
  else {
    const key = `name:${norm(name)}`;
    it = merged.get(key) ?? { key, ...rec, source: ids[0].source, rarity: ids[0].rarity, level: ids[0].level, regions: [] };
    if (!it.regions.length) it.regions.push(KISK_EVIDENCE);
    merged.set(key, it);
  }
  if (!it.icon) { it.icon = CDN + file; it.iconSource = "kisk.app (NCSOFT CDN)"; }
}

const out = [...merged.values()].map((i) => ({
  key: i.key, name: i.name, itemId: i.itemId ?? "", source: i.source ?? "", category: i.category ?? "", slot: i.slot ?? "",
  level: i.level ?? null, rarity: i.rarity ?? "", faction: i.faction ?? "Beide", icon: i.icon ?? "", iconSource: i.iconSource ?? "",
  itemPage: i.itemPage ?? "", regions: i.regions,
}));
writeFileSync(path.join(root, "src/lib/knowledge/item-catalog.json"), JSON.stringify(out));
// original icon file name → downloaded local copy (only names/hashes, no images: the icons stay git-ignored)
const iconFiles = {};
for (const s of items(read("data/gear-catalog.json")))
  if (s.icon_url && s.icon_file) iconFiles[s.icon_url.split("/").pop()] = "/item-icons/" + String(s.icon_file).replace(/^icons\//, "");
// icons saved under their original NCSOFT file name (e.g. Icon_ACC_Ring_0053.png) map to themselves
try {
  for (const f of readdirSync(path.join(root, "public/item-icons")))
    if (/^Icon_.+\.(png|webp|jpg)$/i.test(f) && !iconFiles[f]) iconFiles[f] = "/item-icons/" + f;
} catch { /* no icons installed */ }
writeFileSync(path.join(root, "data/icon-files.json"), JSON.stringify(iconFiles, null, 1));

const status = (i) => (i.regions.some((r) => r.region === "EU") ? "eu" : i.regions.some((r) => r.region === "TW") ? "tw" : "unclear");
const count = (f) => out.filter(f).length;
const w = (i) => i.category === "Waffen";
console.log(`item-catalog.json: ${out.length} Items · Icons: ${count((i) => i.icon)} · ohne Icon: ${count((i) => !i.icon)}`);
console.log(`  Alle:   EU/Global sichtbar ${count((i) => status(i) === "eu")} · nur Taiwan ${count((i) => status(i) === "tw")} · ungeklärt ${count((i) => status(i) === "unclear")}`);
console.log(`  Waffen: EU/Global sichtbar ${count((i) => w(i) && status(i) === "eu")} · nur Taiwan ${count((i) => w(i) && status(i) === "tw")} · ungeklärt ${count((i) => w(i) && status(i) === "unclear")}`);
