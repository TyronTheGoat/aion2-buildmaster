import { createRoot } from "react-dom/client";
import { BuildMasterApp } from "@/components/BuildMasterApp";

function App() {
  return (
    <div className="min-h-full flex flex-col">
      <header className="sticky top-0 z-10 border-b border-white/10 bg-[#0b0b12]/90 backdrop-blur pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <a href="#" className="font-semibold tracking-tight"><span className="text-amber-400">Aion 2</span> BuildMaster</a>
          <span className="text-xs text-zinc-500">Offline-Version</span>
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-5">
        <BuildMasterApp />
      </main>
      <footer className="mx-auto max-w-3xl px-4 pb-6 text-xs text-zinc-500">
        Charakterdaten von kisk.app. Bilder werden aus dem Internet geladen. Nicht offiziell, kein Bezug zu NCSOFT.
      </footer>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
