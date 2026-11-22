import { createRoot } from "react-dom/client";
import { BuildMasterApp } from "@/components/BuildMasterApp";

function App() {
  return (
    <div className="min-h-full flex flex-col">
      <header className="sticky top-0 z-10 border-b border-[#d9c58f]/10 bg-[#0b0c10]/80 backdrop-blur pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex max-w-6xl items-center gap-6 px-4 py-3">
          <a href="#" className="font-semibold tracking-tight text-[#f4eed7]">Build Master</a>
          <nav aria-label="Hauptnavigation"><a href="#" className="rounded-lg border border-[#d9c58f]/25 px-3 py-1 text-sm text-[#efe6cc]/85 hover:border-[#d9c58f]/50">Charaktere</a></nav>
          <span className="ml-auto text-xs text-zinc-500">Offline-Version</span>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pt-5 pb-8">
        <BuildMasterApp />
      </main>
      <footer className="pointer-events-none fixed inset-x-0 bottom-0 z-20 bg-[#0b0c10]/85 pb-[env(safe-area-inset-bottom)] text-center text-[9px] leading-[14px] text-zinc-600">
        Daten: kisk.app · Nicht offiziell, kein Bezug zu NCSOFT
      </footer>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
