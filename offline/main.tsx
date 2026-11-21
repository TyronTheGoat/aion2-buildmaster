import { createRoot } from "react-dom/client";
import { useState } from "react";
import { CharacterView } from "@/components/CharacterView";
import ImportPage from "@/app/import/page";
import { FLORENTINA } from "@/lib/fixtures/florentina";

function App() {
  const [view, setView] = useState<"demo" | "import">("demo");
  return (
    <div className="min-h-full flex flex-col">
      <header className="sticky top-0 z-10 border-b border-white/10 bg-[#0b0b12]/90 backdrop-blur pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <span className="font-semibold tracking-tight"><span className="text-amber-400">Aion 2</span> BuildMaster <span className="text-xs text-zinc-500">offline</span></span>
          <nav className="flex gap-4 text-sm text-zinc-400">
            <button onClick={() => setView("demo")} className={view === "demo" ? "text-white" : ""}>Florentina</button>
            <button onClick={() => setView("import")} className={view === "import" ? "text-white" : ""}>Einfügen</button>
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-5">
        {view === "demo" ? <CharacterView char={FLORENTINA} /> : <ImportPage />}
      </main>
      <footer className="mx-auto max-w-3xl px-4 pb-6 text-xs text-zinc-500">
        Offline-Testversion. Daten: Schnappschuss von kisk.app (21.11.2026). Nicht offiziell, kein Bezug zu NCSOFT.
      </footer>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
