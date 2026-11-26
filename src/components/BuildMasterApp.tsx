"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Character } from "@/lib/types";
import { parseKiskGear } from "@/lib/kisk/parse";
import { textToLines } from "@/lib/kisk/html-to-text";
import { CharacterView } from "./CharacterView";
import { GRADE_HEX_CSS } from "@/lib/grades";
import { Sheet } from "./ui";
import { ClassGuides } from "./ClassGuides";
import { ItemCatalog } from "./ItemCatalog";
import { GearDeck, deckOf } from "./deck/GearDeck";
import { Filler, Portrait, SHOW_ITEM_ICONS } from "./deck/Card";
import { iconFor } from "@/lib/knowledge/item-catalog";
import { charKey, parseKiskLink, portraitOf, useCharacters, type SavedChar } from "./store";
import { numberLocale, useLang, useT } from "@/lib/i18n";
import { addBlocked, isAdminAccount, removeShared, useCloud } from "./cloud";
import { PREVIEW } from "@/lib/preview";
import { useFavorites } from "./fav-store";
import { FavStar, IntroPopups } from "./extras";
import { bookmarklet } from "./kisk-import";

/** The page the class guides were opened from (their back button returns there, Tyron 2026-11-24). */
let guidesFrom: string | undefined;
let lastRoute: string | undefined;
function useHashRoute(): [string | undefined, (k?: string) => void] {
  const [route, setRoute] = useState<string>();
  useEffect(() => {
    const read = () => {
      const r = decodeURIComponent(location.hash.replace(/^#\/?c\//, "")) || undefined;
      if (r === "klassen" && lastRoute !== "klassen") guidesFrom = lastRoute;
      lastRoute = r;
      setRoute(r);
    };
    read();
    window.addEventListener("hashchange", read);
    return () => window.removeEventListener("hashchange", read);
  }, []);
  const go = useCallback((k?: string) => { location.hash = k ? `/c/${encodeURIComponent(k)}` : ""; }, []);
  return [route, go];
}

// The single-file offline build sets this flag; opening the file on a phone is not always a file:// URL.
declare const __BM_OFFLINE__: boolean | undefined;
const isOffline = () =>
  (typeof __BM_OFFLINE__ !== "undefined" && __BM_OFFLINE__) ||
  (typeof location !== "undefined" && !/^https?:$/.test(location.protocol));

/** Online: the character from kisk's API through our server (same: kisk has nothing newer than what we have). */
async function fetchLive(c: { region: string; server: string; name: string }): Promise<{ c: Character; same: boolean; kiskFetched: number | null }> {
  const res = await fetch("/api/kisk/char", {
    method: "POST", credentials: "same-origin", cache: "no-store",
    headers: { "x-bm": "1", "content-type": "application/json" },
    body: JSON.stringify({ region: c.region, server: c.server, name: c.name }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? `${res.status}`);
  return body;
}

/** kisk link, "region/server/Name", "server/Name" or just "Name" (EU Odar). */
function parseCharInput(s: string): { region: string; server: string; name: string } | undefined {
  const link = parseKiskLink(s);
  if (link) return link;
  const parts = s.trim().split("/").filter(Boolean);
  if (!parts.length || parts.length > 3 || parts.some((p) => /[\s?#]/.test(p))) return undefined;
  const [region, server, name] = parts.length === 3 ? parts : parts.length === 2 ? ["eu", ...parts] : ["eu", "odar", parts[0]];
  return /^[a-z]{2,3}$/i.test(region) && name.length <= 40 ? { region: region.toLowerCase(), server: server.toLowerCase(), name } : undefined;
}

export function BuildMasterApp() {
  const { chars, upsert, remove } = useCharacters();
  // 3D look with gloss (styles in globals.css under html.bm-3d), live since 2026-11-24
  useEffect(() => { document.documentElement.classList.add("bm-3d"); }, []);
  const [route, go] = useHashRoute();
  const [adding, setAdding] = useState(false);
  const [query, setQuery] = useState("");
  const cloudOnline = useCloud().mode === "online";
  const fav = useFavorites();
  const shown = chars
    .filter((c) => !query || c.name.toLowerCase().includes(query.trim().toLowerCase()))
    // favourites first (offline preview)
    .map((c, i) => ({ c, i, f: PREVIEW && fav.isFav(charKey(c)) ? 0 : 1 })).sort((a, b) => a.f - b.f || a.i - b.i).map((x) => x.c);
  const selected = chars.find((c) => charKey(c) === route);
  const t = useT();
  const lang = useLang();

  if (route === "katalog") return <ItemCatalog onBack={() => go()} />;
  if (route === "klassen") return <ClassGuides onBack={() => go(guidesFrom && guidesFrom !== "katalog" ? guidesFrom : undefined)} />;

  if (route && selected) {
    return <CharacterScreen key={route} saved={selected} onBack={() => go()} upsert={upsert}
      onRemove={() => {
        if (selected.builtin) { alert(t(`${selected.name} ist ein Testcharakter und gehört bei allen zur Grundausstattung.`, `${selected.name} is a test character every account has.`)); return; }
        if (!confirm(t(`${selected.name} entfernen?`, `Remove ${selected.name}?`))) return;
        void removeShared(route).then((err) => { if (err) { alert(err); return; } remove(route); go(); });
      }} />;
  }

  return (
    <div className="space-y-6">
      <div className="bm-backdrop pointer-events-none fixed inset-0 -z-10" aria-hidden />
      {PREVIEW && <IntroPopups />}
      {/* title, search, new character */}
      <div className="flex flex-col gap-3 pt-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-[#f4eed7]">{t("Charakterauswahl", "Character selection")}</h1>
          <p className="mt-1 text-sm text-[#efe6cc]/50">{t("Charakter öffnen oder neuen Charakter anlegen", "Open a character or add a new one")}</p>
        </div>
        <div className="flex gap-2 md:w-[520px]">
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("Suche: Charaktername …", "Search: character name …")} aria-label={t("Charakter suchen", "Search characters")}
            className="min-w-0 flex-1 rounded-xl border border-[#d9c58f]/20 bg-white/[0.03] px-3.5 py-2.5 text-base text-[#f4eed7] outline-none placeholder:text-zinc-500 focus:border-[#d9c58f]/50" />
        </div>
      </div>

      {/* character cards + "new character" card */}
      <ul className="grid grid-cols-1 gap-5 md:grid-cols-2 md:gap-6 lg:grid-cols-3">
        {shown.map((c) => {
          const s = c.snapshot;
          const grade = s?.gearGrade ?? "?";
          const preview = s ? deckOf(s, lang).slice(0, 6) : [];
          return (
            <li key={charKey(c)} className="relative">
              {PREVIEW && <FavStar on={fav.isFav(charKey(c))} onToggle={() => fav.toggle(charKey(c))} className="absolute right-3 top-3 z-10" />}
              <button onClick={() => go(charKey(c))}
                style={{ boxShadow: `0 0 0 1px ${GRADE_HEX_CSS[grade]}40, 0 0 28px -6px ${GRADE_HEX_CSS[grade]}55, 0 18px 40px -18px #000` }}
                className="card-face group relative flex h-full w-full flex-col gap-4 overflow-hidden rounded-[20px] p-4 text-left transition hover:-translate-y-0.5 active:scale-[0.99]">
                <span aria-hidden className="pointer-events-none absolute inset-[5px] rounded-[15px] border border-[#d9c58f]/20" />
                <div className="relative flex items-center gap-4">
                  <Portrait src={portraitOf(c)} name={c.name} className="h-20 w-20" />
                  <div className="min-w-0 flex-1">
                    <div className={`truncate text-xl font-semibold text-[#f4eed7] ${PREVIEW ? "pr-8" : ""}`}>{c.name}</div>
                    <div className="truncate text-sm text-[#beac80]/80">
                      {[s?.className, s?.race, `${c.server} · ${c.region.toUpperCase()}`].filter(Boolean).join(" · ")}
                    </div>
                    <div className="mt-0.5 text-xs text-[#99e4e2]/60">
                      {[s?.combatPower && `CP ${s.combatPower.toLocaleString(numberLocale(lang))}`, s?.gearGrade && `${t("Gear-Rang", "Gear rank")} ${s.gearGrade}`].filter(Boolean).join(" · ") || t("Noch keine Daten", "No data yet")}
                    </div>
                  </div>
                </div>
                <div className="relative border-t border-white/[0.07] pt-3">
                  <div className="mb-2 text-[10px] uppercase tracking-[0.2em] text-zinc-500">{t("Gear-Schnellübersicht", "Gear at a glance")}</div>
                  <div className="grid grid-cols-6 gap-1.5">
                    {(preview.length ? preview : Array.from({ length: 6 }, () => undefined)).map((d, i) => {
                      const icon = d && SHOW_ITEM_ICONS ? iconFor(d.item) : undefined;
                      return icon ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img key={d!.id} src={icon} alt={d!.label} title={`${d!.label}: ${d!.item.name}`} loading="lazy" referrerPolicy="no-referrer"
                          className="aspect-square w-full rounded-lg bg-[radial-gradient(circle_at_50%_40%,#1f3a66_0%,#111a2b_70%)] object-contain p-0.5"
                          style={{ boxShadow: `0 0 0 1px ${GRADE_HEX_CSS[d!.item.grade]}55` }} />
                      ) : <Filler key={d?.id ?? i} className="aspect-square w-full" />;
                    })}
                  </div>
                </div>
              </button>
            </li>
          );
        })}
        <li>
          <button onClick={() => setAdding(true)}
            className="flex h-full min-h-[200px] w-full flex-col items-center justify-center gap-2 rounded-[20px] border border-dashed border-[#d9c58f]/25 bg-white/[0.02] p-6 text-center hover:border-[#d9c58f]/50">
            <span className="text-3xl font-light text-[#d9c58f]">+</span>
            <span className="font-semibold text-[#f4eed7]">{t("Neuen Charakter hinzufügen", "Add a new character")}</span>
            <span className="text-xs text-zinc-500">{cloudOnline ? t("kisk.app-Link oder Name eingeben", "Enter a kisk.app link or name") : t("kisk.app-Link eingeben oder Seiteninhalt einfügen", "Enter a kisk.app link or paste the page content")}</span>
          </button>
        </li>
      </ul>
      {query && shown.length === 0 && <p className="text-sm text-zinc-400">{t(`Kein Charakter mit „${query}“ gefunden.`, `No character named “${query}” found.`)}</p>}

      <button onClick={() => go("katalog")} className="text-sm text-[#efe6cc]/50 underline-offset-4 hover:text-[#efe6cc]/80 hover:underline">
        {t("Item-Katalog öffnen", "Open item catalog")}
      </button>

      <AddCharacterSheet open={adding} onClose={() => setAdding(false)}
        onAdd={(c) => { const err = chars.some((x) => charKey(x) === charKey(c)) ? undefined : addBlocked(charKey(c)); if (err) { alert(err); return; } upsert(c); setAdding(false); go(charKey(c)); }} />
    </div>
  );
}

function AddCharacterSheet({ open, onClose, onAdd }: { open: boolean; onClose: () => void; onAdd: (c: SavedChar) => void }) {
  const [link, setLink] = useState("");
  const [text, setText] = useState("");
  const t = useT();
  const online = useCloud().mode === "online";
  const parsed = online ? parseCharInput(link) : parseKiskLink(link);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string>();
  const input = "w-full rounded-lg border border-white/10 bg-white/5 px-3 py-3 text-base outline-none focus:border-amber-400";

  async function submit() {
    if (!parsed) return;
    let snapshot = text.trim()
      ? parseKiskGear(textToLines(text), { ...parsed, url: `https://kisk.app/c/${parsed.region}/${parsed.server}/${encodeURIComponent(parsed.name)}/gear`, mode: "paste" })
      : undefined;
    if (!snapshot && online) {
      // straight from kisk's API: no bookmark needed
      setBusy(true); setErr(undefined);
      try { snapshot = (await fetchLive(parsed)).c; } catch (e) { setErr((e as Error).message); setBusy(false); return; }
      setBusy(false);
    }
    onAdd({ ...parsed, name: snapshot?.name ?? parsed.name, snapshot });
    setLink(""); setText("");
  }

  return (
    <Sheet open={open} onClose={onClose} title={<h2 className="text-lg font-semibold">{t("Charakter hinzufügen", "Add character")}</h2>}>
      <div className="space-y-3">
        <label className="block text-sm text-zinc-400">{online ? t("kisk.app-Link oder Name", "kisk.app link or name") : t("kisk.app-Link", "kisk.app link")}
          <input value={link} onChange={(e) => { setLink(e.target.value); setErr(undefined); }} placeholder={online ? t("Name (EU Odar) oder https://kisk.app/c/eu/odar/Name", "Name (EU Odar) or https://kisk.app/c/eu/odar/Name") : "https://kisk.app/c/eu/odar/Name"} className={`${input} mt-1`} autoCapitalize="none" inputMode="url" />
        </label>
        {link && !parsed && <p className="text-xs text-[#ff8b8b]">{t("Das sieht nicht wie ein kisk.app-Charakterlink aus.", "That does not look like a kisk.app character link.")}</p>}
        {err && <p className="text-xs text-[#ff8b8b]">{err}</p>}
        {online && isAdminAccount() && (
          <details className="rounded-lg border border-white/10 p-3 text-xs text-zinc-400">
            <summary className="cursor-pointer">{t("Admin: Lesezeichen für das BiS-Update", "Admin: bookmark for the BiS update")}</summary>
            <div className="mt-2"><KiskBookmarklet /></div>
          </details>
        )}
        {parsed && <p className="text-xs text-[#5fbf8a]">{parsed.name} · {parsed.server} · {parsed.region.toUpperCase()}</p>}
        {!online && <details className="rounded-lg border border-white/10 p-3 text-sm" open={isOffline()}>
          <summary className="cursor-pointer text-zinc-300">{t("Seiteninhalt einfügen", "Paste page content")} {isOffline() ? t("(nötig in der Offline-Version)", "(required in the offline version)") : "(optional)"}</summary>
          <p className="mt-2 text-xs text-zinc-500">{t("Öffne die Gear-Seite auf kisk.app, markiere alles, kopiere es und füge es hier ein.", "Open the gear page on kisk.app, select everything, copy it and paste it here.")}</p>
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={6} className={`${input} mt-2`} placeholder={t("Seiteninhalt…", "Page content…")} />
        </details>}
        <button onClick={() => void submit()} disabled={!parsed || busy} className="w-full rounded-lg bg-amber-400 py-3 font-semibold text-black disabled:opacity-40">{busy ? t("Lade von kisk.app…", "Loading from kisk.app…") : t("Hinzufügen", "Add")}</button>
      </div>
    </Sheet>
  );
}

type Device = "iphone" | "android" | "pc";
const deviceOf = (): Device => typeof navigator === "undefined" ? "pc"
  : /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1) ? "iphone"
    : /Android/.test(navigator.userAgent) ? "android" : "pc";

/**
 * The "Zu BuildMaster senden" bookmark with a step-by-step guide per device (PC: drag; iPhone / Android: copy the code
 * into a bookmark, then call it from the address bar on the kisk page).
 */
function KiskBookmarklet() {
  const t = useT();
  const ref = useRef<HTMLAnchorElement>(null);
  const code = typeof location !== "undefined" ? bookmarklet(location.origin) : "";
  const [copied, setCopied] = useState(false);
  const [device, setDevice] = useState<Device>(deviceOf);
  // React blocks javascript: links in JSX; the bookmark needs one, so it is set on the element directly
  useEffect(() => { ref.current?.setAttribute("href", code); }, [code, device]);
  const copy = async () => {
    try { await navigator.clipboard.writeText(code); setCopied(true); }
    catch { setCopied(false); alert(t("Kopieren ging nicht. Halte im Feld darunter gedrückt und wähle „Alles auswählen“ und „Kopieren“.", "Copy failed. Long-press the field below and choose “Select all” and “Copy”.")); }
  };
  const copyBtn = (
    <button className="w-full rounded-lg bg-amber-400 px-3 py-3 text-sm font-semibold text-black" onClick={copy}>
      {copied ? t("✓ Code kopiert", "✓ Code copied") : t("Code kopieren", "Copy code")}
    </button>
  );
  const steps: Record<Device, string[]> = {
    iphone: [
      t("Tippe auf den gelben Knopf „Code kopieren“.", "Tap the yellow “Copy code” button."),
      t("Tippe in Safari auf das Teilen-Symbol (Quadrat mit Pfeil) → „Lesezeichen hinzufügen“. Name: BuildMaster → „Sichern“.", "In Safari tap the share icon (square with arrow) → “Add Bookmark”. Name: BuildMaster → “Save”."),
      t("Öffne die Lesezeichen (Buch-Symbol) → „Bearbeiten“ → tippe auf „BuildMaster“. Lösche die Adresse, füge den kopierten Code ein (gedrückt halten → „Einsetzen“) → „Fertig“.", "Open bookmarks (book icon) → “Edit” → tap “BuildMaster”. Delete the address, paste the copied code (long-press → “Paste”) → “Done”."),
      t("Öffne auf kisk.app die Gear-Seite deines Charakters. Tippe oben in die Adressleiste, schreib „BuildMaster“ und tippe in der Liste auf das Lesezeichen (Buch-Symbol).", "Open your character's gear page on kisk.app. Tap the address bar, type “BuildMaster” and tap the bookmark (book icon) in the list."),
      t("BuildMaster öffnet sich mit deinem Charakter. Zum Aktualisieren später einfach Schritt 4 wiederholen.", "BuildMaster opens with your character. To update later, just repeat step 4."),
    ],
    android: [
      t("Tippe auf den gelben Knopf „Code kopieren“.", "Tap the yellow “Copy code” button."),
      t("Chrome: ⋮ → Stern-Symbol (Lesezeichen). Dann unten „Bearbeiten“: Name BuildMaster, bei URL alles löschen und den Code einfügen → zurück.", "Chrome: ⋮ → star icon (bookmark). Then “Edit” at the bottom: name BuildMaster, delete the URL and paste the code → back."),
      t("Öffne auf kisk.app die Gear-Seite deines Charakters. Tippe in die Adressleiste, schreib „BuildMaster“ und tippe auf das Lesezeichen in der Liste.", "Open your character's gear page on kisk.app. Tap the address bar, type “BuildMaster” and tap the bookmark in the list."),
      t("BuildMaster öffnet sich mit deinem Charakter. Zum Aktualisieren später einfach Schritt 3 wiederholen.", "BuildMaster opens with your character. To update later, just repeat step 3."),
    ],
    pc: [
      t("Zieh den gelben Knopf unten in deine Lesezeichenleiste (einmalig; Leiste einblenden mit Strg+Umschalt+B).", "Drag the yellow button below to your bookmarks bar (once; show the bar with Ctrl+Shift+B)."),
      t("Öffne auf kisk.app die Gear-Seite deines Charakters.", "Open your character's gear page on kisk.app."),
      t("Klick dort auf das Lesezeichen. BuildMaster öffnet sich mit deinem Charakter. Nochmal klicken aktualisiert ihn.", "Click the bookmark there. BuildMaster opens with your character. Clicking again updates it."),
    ],
  };
  return (
    <div className="space-y-3 rounded-lg border border-[#d9c58f]/25 bg-white/[0.02] p-3 text-sm">
      <div className="font-semibold text-[#f4eed7]">{t("Charakter von kisk holen: Lesezeichen „BuildMaster“", "Get a character from kisk: the “BuildMaster” bookmark")}</div>
      <p className="text-xs text-zinc-400">{t("Einmal einrichten, danach reicht auf kisk ein Tipp. Das Lesezeichen bringt neue Charaktere und kisks BiS-Zeilen. Danach holt BuildMaster alle 30 Minuten über die offizielle kisk-API den neuesten Stand.", "Set up once, afterwards one tap on kisk is enough. The bookmark brings new characters and kisk's BiS lines. After that BuildMaster fetches the latest state through kisk's official API every 30 minutes.")}</p>
      <div className="flex gap-1 text-xs" role="tablist">
        {(["iphone", "android", "pc"] as const).map((d) => (
          <button key={d} role="tab" aria-selected={device === d} onClick={() => setDevice(d)}
            className={`flex-1 rounded-lg px-2 py-1.5 ring-1 ${device === d ? "bg-white/10 text-[#f4eed7] ring-[#d9c58f]/50" : "text-zinc-400 ring-white/10"}`}>
            {d === "iphone" ? "iPhone" : d === "android" ? "Android" : "PC"}
          </button>
        ))}
      </div>
      {device !== "pc" && copyBtn}
      <ol className="list-decimal space-y-1.5 pl-5 text-xs text-zinc-300">{steps[device].map((x) => <li key={x}>{x}</li>)}</ol>
      {device === "pc" ? (
        <a ref={ref} onClick={(e) => { e.preventDefault(); alert(t("Nicht hier klicken: zieh den Knopf in die Lesezeichenleiste und klick ihn auf der kisk-Seite.", "Do not click it here: drag it to the bookmarks bar and click it on the kisk page.")); }}
          className="inline-block cursor-grab rounded-lg bg-amber-400 px-3 py-2 text-xs font-semibold text-black">⇪ BuildMaster</a>
      ) : <>
        <textarea readOnly value={code} rows={2} onFocus={(e) => e.currentTarget.select()} aria-label={t("Lesezeichen-Code", "Bookmark code")}
          className="w-full rounded-lg border border-white/10 bg-black/30 px-2 py-1 font-mono text-[10px] text-zinc-500" />
      </>}
    </div>
  );
}

function CharacterScreen({ saved, onBack, onRemove, upsert }: {
  saved: SavedChar; onBack: () => void; onRemove: () => void; upsert: (c: SavedChar) => void;
}) {
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [error, setError] = useState<string>();
  const [info, setInfo] = useState<string>();
  const [pasting, setPasting] = useState(false);
  const [text, setText] = useState("");
  const [view, setView] = useState<"deck" | "list">("deck");
  const online = useCloud().mode === "online";
  const t = useT();
  const lang = useLang();

  const refresh = useCallback(async (manual: unknown = true) => {
    if (!online) { setPasting(true); return; }
    setStatus("loading"); setInfo(undefined);
    try {
      const r = await fetchLive(saved);
      const mine = saved.snapshot;
      // only something newer than what this device has replaces it
      if (!mine || r.c.source.fetchedAt > mine.source.fetchedAt) upsert({ ...saved, snapshot: { ...r.c, portrait: r.c.portrait ?? portraitOf(saved) } });
      if (manual !== false) setInfo(r.same || (mine && r.c.source.fetchedAt <= mine.source.fetchedAt)
        ? t("kisk.app hat keinen neueren Stand. Für frische Daten einmal die Gear-Seite auf kisk.app öffnen, dann noch mal aktualisieren.", "kisk.app has nothing newer. For fresh data open the gear page on kisk.app once, then refresh again.")
        : t("Neuer Stand von kisk.app übernommen.", "New data from kisk.app applied."));
      setStatus("idle");
    } catch (e) {
      setError(e instanceof TypeError ? t("Server gerade nicht erreichbar", "Server not reachable right now") : e instanceof Error ? e.message : String(e));
      setStatus("error");
    }
  }, [saved, upsert, t, online]);

  // Load live data once when opened (online only) if we have nothing or only an old snapshot.
  useEffect(() => {
    const age = saved.snapshot ? Date.now() - new Date(saved.snapshot.source.fetchedAt).getTime() : Infinity;
    if (!online || age <= 30 * 60 * 1000) return;
    const t = setTimeout(() => void refresh(false), 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function applyPaste() {
    const url = `https://kisk.app/c/${saved.region}/${saved.server}/${encodeURIComponent(saved.name)}/gear`;
    const char = parseKiskGear(textToLines(text), { region: saved.region, server: saved.server, name: saved.name, url, mode: "paste" });
    // pasted text carries no picture: keep the known portrait
    upsert({ ...saved, snapshot: { ...char, portrait: portraitOf(saved) } });
    setPasting(false); setText(""); setStatus("idle");
  }

  const input = "w-full rounded-lg border border-white/10 bg-white/5 px-3 py-3 text-base outline-none focus:border-amber-400";
  const pasteSheet = (
    <Sheet open={pasting} onClose={() => setPasting(false)} title={<h2 className="text-lg font-semibold">{t("Neuen Stand einfügen", "Paste a new snapshot")}</h2>}>
      <p className="mb-2 text-sm text-zinc-400">
        {t("Öffne", "Open")} <a className="underline" target="_blank" rel="noreferrer" href={`https://kisk.app/c/${saved.region}/${saved.server}/${encodeURIComponent(saved.name)}/gear`}>{saved.name} {t("auf", "on")} kisk.app</a>,
        {" "}{t("markiere alles, kopiere es und füge es hier ein.", "select everything, copy it and paste it here.")}
      </p>
      {online && <p className="mb-2 text-xs text-[#5fbf8a]">{t("Schneller: auf der kisk-Seite das Lesezeichen „Zu BuildMaster senden“ klicken.", "Faster: click the “Send to BuildMaster” bookmark on the kisk page.")}</p>}
      <textarea value={text} onChange={(e) => setText(e.target.value)} rows={8} className={input} />
      <button onClick={applyPaste} disabled={!text.trim()} className="mt-3 w-full rounded-lg bg-amber-400 py-3 font-semibold text-black disabled:opacity-40">{t("Übernehmen", "Apply")}</button>
    </Sheet>
  );

  if (!saved.snapshot) {
    return (
      <div className="space-y-4">
        <button onClick={onBack} className="rounded-lg border border-[#d9c58f]/25 bg-white/[0.04] px-3 py-1.5 text-sm text-[#efe6cc] hover:border-[#d9c58f]/50">‹ {t("Charaktere", "Characters")}</button>
        <div className="rounded-2xl border border-white/10 p-5">
          <h1 className="text-xl font-bold">{saved.name}</h1>
          {status === "loading" && <p className="mt-2 animate-pulse text-sm text-zinc-400">{t("Lade Build von kisk.app…", "Loading build from kisk.app…")}</p>}
          {status !== "loading" && (
            <>
              <p className="mt-2 text-sm text-zinc-400">{error ?? (!online ? t("In der Offline-Version kann ich kisk.app nicht direkt abrufen.", "The offline version cannot load kisk.app directly.") : t("Noch keine Daten.", "No data yet."))}</p>
              <button onClick={() => setPasting(true)} className="mt-4 w-full rounded-lg bg-amber-400 py-3 font-semibold text-black">{t("Seiteninhalt einfügen", "Paste page content")}</button>
              <button onClick={onRemove} className="mt-2 w-full rounded-lg bg-white/5 py-3 text-sm text-zinc-300">{t("Entfernen", "Remove")}</button>
            </>
          )}
        </div>
        {pasteSheet}
      </div>
    );
  }

  const offlineNote = !online && saved.snapshot ? (
    <p className="rounded-lg bg-white/[0.03] px-3 py-2 text-xs text-zinc-400">
      {online ? t("Stand vom", "Data from") : t("Offline-Version: Stand vom", "Offline version: data from")} {new Date(saved.snapshot.source.fetchedAt).toLocaleString(numberLocale(lang))}. {online ? t("Neuen Stand: auf der kisk-Seite das Lesezeichen „Zu BuildMaster senden“ klicken.", "New snapshot: click the “Send to BuildMaster” bookmark on the kisk page.") : t("Neuen Stand über „Aktualisieren“ einfügen.", "Paste a new snapshot via “Refresh”.")}
    </p>
  ) : null;
  const statusNote = status === "error"
      ? <p className="rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-300">{t("Aktualisieren hat nicht geklappt", "Refresh failed")} ({error}). {t("Du siehst den letzten Stand.", "You are seeing the last snapshot.")}</p>
      : info ? <p className="rounded-lg bg-white/[0.03] px-3 py-2 text-center text-xs text-zinc-400">{info}</p> : null;

  if (view === "deck") {
    return (
      <>
        <div className="bm-backdrop pointer-events-none fixed inset-0 -z-10" aria-hidden />
        <GearDeck char={saved.snapshot} onBack={onBack} onRefresh={refresh} onRemove={onRemove} refreshing={status === "loading"}
          note={<>{statusNote}{offlineNote}</>} />
        {pasteSheet}
      </>
    );
  }

  return (
    <>
      <button onClick={() => setView("deck")} className="mb-3 w-full rounded-xl border border-[#d9c58f]/20 bg-white/[0.03] py-2.5 text-sm text-[#efe6cc]/85 hover:border-[#d9c58f]/40">
        ‹ Zurück zu den Karten
      </button>
      {status === "loading" && <p className="mb-2 animate-pulse text-center text-xs text-zinc-400">Aktualisiere von kisk.app…</p>}
      {status === "error" && <p className="mb-2 rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-300">Aktualisieren hat nicht geklappt ({error}). Du siehst den letzten Stand.</p>}
      {!online && saved.snapshot && (
        <p className="mb-2 rounded-lg bg-white/5 px-3 py-2 text-xs text-zinc-400">
          Offline-Version: Stand vom {new Date(saved.snapshot.source.fetchedAt).toLocaleString("de-DE")}. Neuen Stand über „Aktualisieren“ einfügen.
        </p>
      )}
      <CharacterView char={saved.snapshot} onBack={onBack} onRemove={onRemove} onRefresh={refresh} />
      {pasteSheet}
    </>
  );
}

