// Official AION 2 patch notes for Europe / Global, as NCSOFT posts them on Steam (app 3393110), into
// data/patch-notes.json (git-ignored, embedded in the offline file). Run: node scripts/fetch-patch-notes.mjs
import { writeFileSync } from "node:fs";
import path from "node:path";
const url = "https://api.steampowered.com/ISteamNews/GetNewsForApp/v2/?appid=3393110&count=300&maxlength=0&format=json&feeds=steam_community_announcements";
const res = await fetch(url);
if (!res.ok) throw new Error(`Steam ${res.status}`);
const items = (await res.json()).appnews.newsitems;
const notes = items.filter((n) => /patch notes|hotfix/i.test(n.title))
  .map((n) => ({ id: n.gid, title: n.title, date: n.date, url: n.url, body: n.contents }));
writeFileSync(path.join(import.meta.dirname, "../data/patch-notes.json"), JSON.stringify({ source: "Steam / NCSOFT", fetched: new Date().toISOString(), notes }));
console.log(`${notes.length} Patch Notes`);
