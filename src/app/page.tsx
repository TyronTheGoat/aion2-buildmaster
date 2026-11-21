import Link from "next/link";
import { CharacterSearch } from "@/components/CharacterSearch";

export default function Home() {
  return (
    <div className="space-y-6">
      <section>
        <h1 className="text-2xl font-bold">Dein Build, auf einen Blick</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Lädt dein aktuelles Gear und deine Arcana von kisk.app, bewertet jeden Slot und sagt dir, was du als Nächstes verbessern solltest.
        </p>
      </section>
      <CharacterSearch />
      <section className="grid gap-3 sm:grid-cols-2">
        <Link href="/demo" className="rounded-2xl border border-white/10 p-4 hover:bg-white/5">
          <div className="font-semibold">Demo ansehen</div>
          <div className="text-sm text-zinc-400">Florentina, Spiritmaster auf Odar</div>
        </Link>
        <Link href="/import" className="rounded-2xl border border-white/10 p-4 hover:bg-white/5">
          <div className="font-semibold">Seite einfügen</div>
          <div className="text-sm text-zinc-400">kisk-Seite kopieren und hier einfügen, falls Laden nicht klappt</div>
        </Link>
      </section>
    </div>
  );
}
