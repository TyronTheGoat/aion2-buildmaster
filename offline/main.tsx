import { createRoot } from "react-dom/client";
import { BuildMasterApp } from "@/components/BuildMasterApp";

function App() {
  return (
    <div className="min-h-full flex flex-col">
      <header className="sticky top-0 z-10 border-b border-[#d9c58f]/10 bg-[#0b0c10]/80 backdrop-blur pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <a href="#" className="font-semibold tracking-tight"><span className="text-[#d9c58f]">Aion 2</span> BuildMaster</a>
          <span className="text-xs text-zinc-500">Offline-Version</span>
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-5">
        <BuildMasterApp />
      </main>
      <footer className="mx-auto max-w-3xl px-4 pb-6 text-xs text-zinc-500">
        Charakterdaten von kisk.app. Nicht offiziell, kein Bezug zu NCSOFT.
      </footer>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
