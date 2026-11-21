"use client";
import { useCallback, useEffect, useState } from "react";
import type { Character } from "@/lib/types";
import { parseKiskGear } from "@/lib/kisk/parse";
import { textToLines } from "@/lib/kisk/html-to-text";
import { CharacterView } from "./CharacterView";
import { GradeBadge } from "./GradeBadge";
import { ItemIcon, Sheet } from "./ui";
import { AetherBackground } from "./AetherBackground";
import { charKey, parseKiskLink, useCharacters, type SavedChar } from "./store";

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

const isOffline = () => typeof location !== "undefined" && location.protocol === "file:";

async function fetchLive(c: SavedChar): Promise<Character> {
  const q = new URLSearchParams({ region: c.region, server: c.server, name: c.name });
  const res = await fetch(`/api/character?${q}`);
  const body = await res.json();
  if (!res.ok) throw new Error(body.error ?? "Laden fehlgeschlagen");
  return body as Character;
}

export function BuildMasterApp() {
  const { chars, upsert, remove } = useCharacters();
  const [route, go] = useHashRoute();
  const [adding, setAdding] = useState(false);
  const selected = chars.find((c) => charKey(c) === route);

  if (route && selected) {
    return <CharacterScreen key={route} saved={selected} onBack={() => go()} upsert={upsert}
      onRemove={() => { if (confirm(`${selected.name} entfernen?`)) { remove(route); go(); } }} />;
  }

  return (
    <div className="space-y-5">
      <AetherBackground />
      <div className="flex items-end justify-between pt-6">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Charaktere</h1>
          <p className="text-sm text-zinc-300">Wähle einen Charakter oder füge einen neuen hinzu.</p>
        </div>
        <button onClick={() => setAdding(true)} aria-label="Charakter hinzufügen"
          className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-400 text-3xl font-light leading-none text-black shadow-lg shadow-amber-400/20 active:scale-95">+</button>
      </div>

      <ul className="space-y-3">
        {chars.map((c) => {
          const s = c.snapshot;
          const weapon = s?.gear.find((i) => i.slot === "weapon");
          return (
            <li key={charKey(c)}>
              <button onClick={() => go(charKey(c))}
                className="flex w-full items-center gap-4 rounded-2xl border border-white/10 bg-zinc-900/75 p-4 text-left shadow-xl shadow-black/50 backdrop-blur-xl transition active:scale-[0.99] hover:border-white/25 hover:bg-zinc-900/85">
                <ItemIcon src={weapon?.icon} name={c.name} grade={s?.gearGrade ?? "?"} size={56} />
                <div className="min-w-0 flex-1">
                  <div className="text-lg font-semibold">{c.name}</div>
                  <div className="truncate text-sm text-zinc-400">
                    {[s?.className, `${c.server} · ${c.region.toUpperCase()}`].filter(Boolean).join(" · ")}
                  </div>
                  {s?.combatPower && <div className="text-xs text-zinc-500">{s.combatPower.toLocaleString("de-DE")} Kampfkraft</div>}
                </div>
                {s?.gearGrade && <GradeBadge grade={s.gearGrade} size="lg" />}
                <span className="text-zinc-500">›</span>
              </button>
            </li>
          );
        })}
        {chars.length === 0 && (
          <li className="rounded-2xl border border-dashed border-white/15 p-6 text-center text-sm text-zinc-400">
            Noch keine Charaktere. Tippe auf <b>+</b> und füge deinen kisk.app-Link ein.
          </li>
        )}
      </ul>

      <AddCharacterSheet open={adding} onClose={() => setAdding(false)}
        onAdd={(c) => { upsert(c); setAdding(false); go(charKey(c)); }} />
    </div>
  );
}

function AddCharacterSheet({ open, onClose, onAdd }: { open: boolean; onClose: () => void; onAdd: (c: SavedChar) => void }) {
  const [link, setLink] = useState("");
  const [text, setText] = useState("");
  const parsed = parseKiskLink(link);
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
    <Sheet open={open} onClose={onClose} title={<h2 className="text-lg font-semibold">Charakter hinzufügen</h2>}>
      <div className="space-y-3">
        <label className="block text-sm text-zinc-400">kisk.app-Link
          <input value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://kisk.app/c/eu/odar/Name" className={`${input} mt-1`} autoCapitalize="none" inputMode="url" />
        </label>
        {link && !parsed && <p className="text-xs text-red-300">Das sieht nicht wie ein kisk.app-Charakterlink aus.</p>}
        {parsed && <p className="text-xs text-emerald-300">{parsed.name} · {parsed.server} · {parsed.region.toUpperCase()}</p>}
        <details className="rounded-lg border border-white/10 p-3 text-sm" open={isOffline()}>
          <summary className="cursor-pointer text-zinc-300">Seiteninhalt einfügen {isOffline() ? "(nötig in der Offline-Version)" : "(optional)"}</summary>
          <p className="mt-2 text-xs text-zinc-500">Öffne die Gear-Seite auf kisk.app, markiere alles, kopiere es und füge es hier ein.</p>
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={6} className={`${input} mt-2`} placeholder="Seiteninhalt…" />
        </details>
        <button onClick={submit} disabled={!parsed} className="w-full rounded-lg bg-amber-400 py-3 font-semibold text-black disabled:opacity-40">Hinzufügen</button>
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

  const refresh = useCallback(async () => {
    if (isOffline()) { setPasting(true); return; }
    setStatus("loading");
    try {
      const char = await fetchLive(saved);
      upsert({ ...saved, snapshot: char });
      setStatus("idle");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStatus("error");
    }
  }, [saved, upsert]);

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
    upsert({ ...saved, snapshot: char });
    setPasting(false); setText(""); setStatus("idle");
  }

  const input = "w-full rounded-lg border border-white/10 bg-white/5 px-3 py-3 text-base outline-none focus:border-amber-400";
  const pasteSheet = (
    <Sheet open={pasting} onClose={() => setPasting(false)} title={<h2 className="text-lg font-semibold">Neuen Stand einfügen</h2>}>
      <p className="mb-2 text-sm text-zinc-400">
        Öffne <a className="underline" target="_blank" rel="noreferrer" href={`https://kisk.app/c/${saved.region}/${saved.server}/${encodeURIComponent(saved.name)}/gear`}>{saved.name} auf kisk.app</a>,
        markiere alles, kopiere es und füge es hier ein.
      </p>
      <textarea value={text} onChange={(e) => setText(e.target.value)} rows={8} className={input} />
      <button onClick={applyPaste} disabled={!text.trim()} className="mt-3 w-full rounded-lg bg-amber-400 py-3 font-semibold text-black disabled:opacity-40">Übernehmen</button>
    </Sheet>
  );

  if (!saved.snapshot) {
    return (
      <div className="space-y-4">
        <button onClick={onBack} className="text-sm text-zinc-400">‹ Charaktere</button>
        <div className="rounded-2xl border border-white/10 p-5">
          <h1 className="text-xl font-bold">{saved.name}</h1>
          {status === "loading" && <p className="mt-2 animate-pulse text-sm text-zinc-400">Lade Build von kisk.app…</p>}
          {status !== "loading" && (
            <>
              <p className="mt-2 text-sm text-zinc-400">{error ?? (isOffline() ? "In der Offline-Version kann ich kisk.app nicht direkt abrufen." : "Noch keine Daten.")}</p>
              <button onClick={() => setPasting(true)} className="mt-4 w-full rounded-lg bg-amber-400 py-3 font-semibold text-black">Seiteninhalt einfügen</button>
              <button onClick={onRemove} className="mt-2 w-full rounded-lg bg-white/5 py-3 text-sm text-zinc-300">Entfernen</button>
            </>
          )}
        </div>
        {pasteSheet}
      </div>
    );
  }

  return (
    <>
      {status === "loading" && <p className="mb-2 animate-pulse text-center text-xs text-zinc-400">Aktualisiere von kisk.app…</p>}
      {status === "error" && <p className="mb-2 rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-300">Live-Update fehlgeschlagen ({error}). Zeige letzten Stand.</p>}
      <CharacterView char={saved.snapshot} onBack={onBack} onRemove={onRemove} onRefresh={refresh} />
      {pasteSheet}
    </>
  );
}

