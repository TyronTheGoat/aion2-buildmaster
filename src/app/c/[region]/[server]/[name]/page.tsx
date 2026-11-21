import Link from "next/link";
import { Suspense } from "react";
import { CharacterView } from "@/components/CharacterView";
import { KiskError, loadFromKisk, kiskUrl } from "@/lib/kisk/source";
import type { Character } from "@/lib/types";

type Params = { region: string; server: string; name: string };

export async function generateMetadata({ params }: { params: Promise<Params> }) {
  const { name } = await params;
  return { title: `${decodeURIComponent(name)} · Aion 2 BuildMaster` };
}

export default function CharacterPage({ params }: { params: Promise<Params> }) {
  return (
    <Suspense fallback={<Loading />}>
      <CharacterLoader params={params} />
    </Suspense>
  );
}

function Loading() {
  return (
    <div className="space-y-3 animate-pulse">
      <div className="h-36 rounded-2xl bg-white/5" />
      <div className="h-10 rounded-lg bg-white/5" />
      {[0, 1, 2].map((i) => <div key={i} className="h-28 rounded-2xl bg-white/5" />)}
      <p className="text-center text-sm text-zinc-500">Lade Build von kisk.app…</p>
    </div>
  );
}

async function CharacterLoader({ params }: { params: Promise<Params> }) {
  const p = await params;
  const region = decodeURIComponent(p.region);
  const server = decodeURIComponent(p.server);
  const name = decodeURIComponent(p.name);

  let char: Character | undefined;
  let error: string | undefined;
  try {
    char = await loadFromKisk(region, server, name);
  } catch (e) {
    error = e instanceof KiskError ? e.message : "kisk.app ist gerade nicht erreichbar.";
  }

  if (!char || (char.gear.length === 0 && char.arcana.length === 0)) {
    return (
      <div className="space-y-4 rounded-2xl border border-white/10 p-5">
        <h1 className="text-xl font-bold">{name} konnte nicht geladen werden</h1>
        <p className="text-sm text-zinc-400">{error ?? "Auf der kisk-Seite wurde keine Ausrüstung erkannt."}</p>
        <p className="text-sm text-zinc-400">
          Öffne die <a className="underline" href={kiskUrl(region, server, name)} target="_blank" rel="noreferrer">kisk-Seite</a>,
          markiere alles, kopiere es und füge es unter <Link className="underline" href="/import">Einfügen</Link> ein.
        </p>
      </div>
    );
  }
  return <CharacterView char={char} />;
}
