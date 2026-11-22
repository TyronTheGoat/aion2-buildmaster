"use client";
import { useCallback, useEffect, useState } from "react";
import type { Character } from "@/lib/types";
import { parseKiskGear } from "@/lib/kisk/parse";
import { textToLines } from "@/lib/kisk/html-to-text";
import { CharacterView } from "./CharacterView";
import { GRADE_HEX_CSS } from "@/lib/grades";
import { Sheet } from "./ui";
import { ItemCatalog } from "./ItemCatalog";
import { GearDeck, deckOf } from "./deck/GearDeck";
import { Filler, Portrait, SHOW_ITEM_ICONS } from "./deck/Card";
import { iconFor } from "@/lib/knowledge/item-catalog";
import { charKey, parseKiskLink, portraitOf, useCharacters, type SavedChar } from "./store";
import { numberLocale, useLang, useT } from "@/lib/i18n";

function useHashRoute(): [string | undefined, (k?: string) => void] {
  const [route, setRoute] = useState<string>();
  useEffect(() => {
    const read = () => setRoute(decodeURIComponent(location.hash.replace(/^#\/?c\//, "")) || undefined);
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

async function fetchLive(c: SavedChar): Promise<Character> {
  const q = new URLSearchParams({ region: c.region, server: c.server, name: c.name });
  const res = await fetch(`/api/character?${q}`);
  const body = await res.json();
  if (!res.ok) throw new Error(body.error ?? "Loading failed / Laden fehlgeschlagen");
  return body as Character;
}

export function BuildMasterApp() {
  const { chars, upsert, remove } = useCharacters();
  const [route, go] = useHashRoute();
  const [adding, setAdding] = useState(false);
  const [query, setQuery] = useState("");
  const shown = chars.filter((c) => !query || c.name.toLowerCase().includes(query.trim().toLowerCase()));
  const selected = chars.find((c) => charKey(c) === route);
  const t = useT();
  const lang = useLang();

  if (route === "katalog") return <ItemCatalog onBack={() => go()} />;

  if (route && selected) {
    return <CharacterScreen key={route} saved={selected} onBack={() => go()} upsert={upsert}
      onRemove={() => { if (confirm(t(`${selected.name} entfernen?`, `Remove ${selected.name}?`))) { remove(route); go(); } }} />;
  }

  return (
    <div className="space-y-6">
      <div className="bm-backdrop pointer-events-none fixed inset-0 -z-10" aria-hidden />
      {/* title, search, new character */}
      <div className="flex flex-col gap-3 pt-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-[#f4eed7]">{t("Charakterauswahl", "Character selection")}</h1>
          <p className="mt-1 text-sm text-[#efe6cc]/50">{t("Charakter öffnen oder neuen Charakter anlegen", "Open a character or add a new one")}</p>
        </div>
        <div className="flex gap-2 md:w-[520px]">
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("Suche: Charaktername …", "Search: character name …")} aria-label={t("Charakter suchen", "Search characters")}
            className="min-w-0 flex-1 rounded-xl border border-[#d9c58f]/20 bg-white/[0.03] px-3.5 py-2.5 text-base text-[#f4eed7] outline-none placeholder:text-zinc-500 focus:border-[#d9c58f]/50" />
          <button onClick={() => setAdding(true)}
            className="shrink-0 rounded-xl border border-[#d9c58f]/30 bg-white/[0.04] px-4 py-2.5 text-sm font-medium text-[#efe6cc] hover:border-[#d9c58f]/60">{t("+ Neuer Charakter", "+ New character")}</button>
        </div>
      </div>

      {/* character cards + "new character" card */}
      <ul className="grid grid-cols-1 gap-5 md:grid-cols-2 md:gap-6 lg:grid-cols-3">
        {shown.map((c) => {
          const s = c.snapshot;
          const grade = s?.gearGrade ?? "?";
          const preview = s ? deckOf(s, lang).slice(0, 6) : [];
          return (
            <li key={charKey(c)}>
              <button onClick={() => go(charKey(c))}
                style={{ boxShadow: `0 0 0 1px ${GRADE_HEX_CSS[grade]}40, 0 0 28px -6px ${GRADE_HEX_CSS[grade]}55, 0 18px 40px -18px #000` }}
                className="card-face group relative flex h-full w-full flex-col gap-4 overflow-hidden rounded-[20px] p-4 text-left transition hover:-translate-y-0.5 active:scale-[0.99]">
                <span aria-hidden className="pointer-events-none absolute inset-[5px] rounded-[15px] border border-[#d9c58f]/20" />
                <div className="relative flex items-center gap-4">
                  <Portrait src={portraitOf(c)} name={c.name} className="h-20 w-20" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-xl font-semibold text-[#f4eed7]">{c.name}</div>
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
            <span className="text-xs text-zinc-500">{t("kisk.app-Link eingeben oder Seiteninhalt einfügen", "Enter a kisk.app link or paste the page content")}</span>
          </button>
        </li>
      </ul>
      {query && shown.length === 0 && <p className="text-sm text-zinc-400">{t(`Kein Charakter mit „${query}“ gefunden.`, `No character named “${query}” found.`)}</p>}

      <button onClick={() => go("katalog")} className="text-sm text-[#efe6cc]/50 underline-offset-4 hover:text-[#efe6cc]/80 hover:underline">
        {t("Item-Katalog öffnen", "Open item catalog")}
      </button>

      <AddCharacterSheet open={adding} onClose={() => setAdding(false)}
        onAdd={(c) => { upsert(c); setAdding(false); go(charKey(c)); }} />
    </div>
  );
}

function AddCharacterSheet({ open, onClose, onAdd }: { open: boolean; onClose: () => void; onAdd: (c: SavedChar) => void }) {
  const [link, setLink] = useState("");
  const [text, setText] = useState("");
  const parsed = parseKiskLink(link);
  const t = useT();
  const input = "w-full rounded-lg border border-white/10 bg-white/5 px-3 py-3 text-base outline-none focus:border-amber-400";

  function submit() {
    if (!parsed) return;
    const snapshot = text.trim()
      ? parseKiskGear(textToLines(text), { ...parsed, url: `https://kisk.app/c/${parsed.region}/${parsed.server}/${encodeURIComponent(parsed.name)}/gear`, mode: "paste" })
      : undefined;
    onAdd({ ...parsed, snapshot });
    setLink(""); setText("");
  }

  return (
    <Sheet open={open} onClose={onClose} title={<h2 className="text-lg font-semibold">{t("Charakter hinzufügen", "Add character")}</h2>}>
      <div className="space-y-3">
        <label className="block text-sm text-zinc-400">{t("kisk.app-Link", "kisk.app link")}
          <input value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://kisk.app/c/eu/odar/Name" className={`${input} mt-1`} autoCapitalize="none" inputMode="url" />
        </label>
        {link && !parsed && <p className="text-xs text-red-300">{t("Das sieht nicht wie ein kisk.app-Charakterlink aus.", "That does not look like a kisk.app character link.")}</p>}
        {parsed && <p className="text-xs text-emerald-300">{parsed.name} · {parsed.server} · {parsed.region.toUpperCase()}</p>}
        <details className="rounded-lg border border-white/10 p-3 text-sm" open={isOffline()}>
          <summary className="cursor-pointer text-zinc-300">{t("Seiteninhalt einfügen", "Paste page content")} {isOffline() ? t("(nötig in der Offline-Version)", "(required in the offline version)") : "(optional)"}</summary>
          <p className="mt-2 text-xs text-zinc-500">{t("Öffne die Gear-Seite auf kisk.app, markiere alles, kopiere es und füge es hier ein.", "Open the gear page on kisk.app, select everything, copy it and paste it here.")}</p>
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={6} className={`${input} mt-2`} placeholder={t("Seiteninhalt…", "Page content…")} />
        </details>
        <button onClick={submit} disabled={!parsed} className="w-full rounded-lg bg-amber-400 py-3 font-semibold text-black disabled:opacity-40">{t("Hinzufügen", "Add")}</button>
      </div>
    </Sheet>
  );
}

function CharacterScreen({ saved, onBack, onRemove, upsert }: {
  saved: SavedChar; onBack: () => void; onRemove: () => void; upsert: (c: SavedChar) => void;
}) {
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [error, setError] = useState<string>();
  const [pasting, setPasting] = useState(false);
  const [text, setText] = useState("");
  const [view, setView] = useState<"deck" | "list">("deck");
  const t = useT();
  const lang = useLang();

  const refresh = useCallback(async () => {
    if (isOffline()) { setPasting(true); return; }
    setStatus("loading");
    try {
      const char = await fetchLive(saved);
      upsert({ ...saved, snapshot: { ...char, portrait: char.portrait ?? portraitOf(saved) } });
      setStatus("idle");
    } catch (e) {
      setError(e instanceof TypeError ? t("kisk.app gerade nicht erreichbar", "kisk.app is not reachable right now") : e instanceof Error ? e.message : String(e));
      setStatus("error");
    }
  }, [saved, upsert, t]);

  // Load live data once when opened (online only) if we have nothing or only an old snapshot.
  useEffect(() => {
    const age = saved.snapshot ? Date.now() - new Date(saved.snapshot.source.fetchedAt).getTime() : Infinity;
    if (isOffline() || age <= 30 * 60 * 1000) return;
    const t = setTimeout(() => void refresh(), 0);
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
      <textarea value={text} onChange={(e) => setText(e.target.value)} rows={8} className={input} />
      <button onClick={applyPaste} disabled={!text.trim()} className="mt-3 w-full rounded-lg bg-amber-400 py-3 font-semibold text-black disabled:opacity-40">{t("Übernehmen", "Apply")}</button>
    </Sheet>
  );

  if (!saved.snapshot) {
    return (
      <div className="space-y-4">
        <button onClick={onBack} className="text-sm text-zinc-400">‹ {t("Charaktere", "Characters")}</button>
        <div className="rounded-2xl border border-white/10 p-5">
          <h1 className="text-xl font-bold">{saved.name}</h1>
          {status === "loading" && <p className="mt-2 animate-pulse text-sm text-zinc-400">{t("Lade Build von kisk.app…", "Loading build from kisk.app…")}</p>}
          {status !== "loading" && (
            <>
              <p className="mt-2 text-sm text-zinc-400">{error ?? (isOffline() ? t("In der Offline-Version kann ich kisk.app nicht direkt abrufen.", "The offline version cannot load kisk.app directly.") : t("Noch keine Daten.", "No data yet."))}</p>
              <button onClick={() => setPasting(true)} className="mt-4 w-full rounded-lg bg-amber-400 py-3 font-semibold text-black">{t("Seiteninhalt einfügen", "Paste page content")}</button>
              <button onClick={onRemove} className="mt-2 w-full rounded-lg bg-white/5 py-3 text-sm text-zinc-300">{t("Entfernen", "Remove")}</button>
            </>
          )}
        </div>
        {pasteSheet}
      </div>
    );
  }

  const offlineNote = isOffline() && saved.snapshot ? (
    <p className="rounded-lg bg-white/[0.03] px-3 py-2 text-xs text-zinc-400">
      {t("Offline-Version: Stand vom", "Offline version: data from")} {new Date(saved.snapshot.source.fetchedAt).toLocaleString(numberLocale(lang))}. {t("Neuen Stand über „Aktualisieren“ einfügen.", "Paste a new snapshot via “Refresh”.")}
    </p>
  ) : null;
  const statusNote = status === "loading"
    ? <p className="animate-pulse text-center text-xs text-zinc-400">{t("Aktualisiere von kisk.app…", "Refreshing from kisk.app…")}</p>
    : status === "error"
      ? <p className="rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-300">{t("Aktualisieren hat nicht geklappt", "Refresh failed")} ({error}). {t("Du siehst den letzten Stand.", "You are seeing the last snapshot.")}</p>
      : null;

  if (view === "deck") {
    return (
      <>
        <div className="bm-backdrop pointer-events-none fixed inset-0 -z-10" aria-hidden />
        <GearDeck char={saved.snapshot} onBack={onBack} onRefresh={refresh} onRemove={onRemove}
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
      {isOffline() && saved.snapshot && (
        <p className="mb-2 rounded-lg bg-white/5 px-3 py-2 text-xs text-zinc-400">
          Offline-Version: Stand vom {new Date(saved.snapshot.source.fetchedAt).toLocaleString("de-DE")}. Neuen Stand über „Aktualisieren“ einfügen.
        </p>
      )}
      <CharacterView char={saved.snapshot} onBack={onBack} onRemove={onRemove} onRefresh={refresh} />
      {pasteSheet}
    </>
  );
}

