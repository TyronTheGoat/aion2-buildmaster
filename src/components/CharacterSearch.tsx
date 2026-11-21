"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { charHref, useFavorites } from "./favorites";

/** Accepts either a kisk.app link or region/server/name. */
function fromKiskLink(s: string) {
  const m = s.match(/kisk\.app\/c\/([^/]+)\/([^/]+)\/([^/?#]+)/i);
  return m ? { region: m[1], server: m[2], name: decodeURIComponent(m[3]) } : undefined;
}

export function CharacterSearch() {
  const router = useRouter();
  const { favs, toggle } = useFavorites();
  const [region, setRegion] = useState("eu");
  const [server, setServer] = useState("");
  const [name, setName] = useState("");

  function go(e: React.FormEvent) {
    e.preventDefault();
    const link = fromKiskLink(name) ?? fromKiskLink(server);
    const target = link ?? { region, server: server.trim(), name: name.trim() };
    if (!target.server || !target.name) return;
    router.push(charHref(target));
  }

  const input = "w-full rounded-lg border border-white/10 bg-white/5 px-3 py-3 text-base outline-none focus:border-amber-400";
  return (
    <div className="space-y-6">
      <form onSubmit={go} className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <h2 className="font-semibold">Charakter laden</h2>
        <div className="grid grid-cols-[5.5rem_1fr] gap-2">
          <select value={region} onChange={(e) => setRegion(e.target.value)} className={input} aria-label="Region">
            <option value="eu">EU</option>
            <option value="na">NA</option>
          </select>
          <input value={server} onChange={(e) => setServer(e.target.value)} placeholder="Server, z. B. Odar" className={input} autoCapitalize="none" />
        </div>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name oder kisk.app-Link" className={input} autoCapitalize="none" />
        <button className="w-full rounded-lg bg-amber-400 py-3 font-semibold text-black active:scale-[0.99]">Build analysieren</button>
      </form>

      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-zinc-400">Meine Charaktere</h2>
        {favs.length === 0 ? (
          <p className="text-sm text-zinc-500">Noch keine Favoriten. Lade einen Charakter und tippe auf ☆.</p>
        ) : (
          <ul className="space-y-2">
            {favs.map((f) => (
              <li key={charHref(f)} className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03]">
                <Link href={charHref(f)} className="flex-1 px-4 py-3">
                  <span className="font-medium">{f.name}</span>
                  <span className="ml-2 text-sm text-zinc-400">{f.server} · {f.region.toUpperCase()}</span>
                </Link>
                <button onClick={() => toggle(f)} className="px-4 py-3 text-amber-400" aria-label="Favorit entfernen">★</button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
