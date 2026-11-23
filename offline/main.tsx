import { createRoot } from "react-dom/client";
import { BuildMasterApp } from "@/components/BuildMasterApp";
import { FooterNote, LangSwitch, OfflineBadge, OfflineNav } from "@/components/Chrome";
import { initCloud } from "@/components/cloud";
import { listenKiskImport, takeKiskImport } from "@/components/kisk-import";

function App() {
  return (
    <div className="min-h-full flex flex-col">
      <header className="sticky top-0 z-10 border-b border-[#d9c58f]/10 bg-[#0b0c10]/80 backdrop-blur pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 sm:gap-6">
          <a href="#" className="whitespace-nowrap font-semibold tracking-tight text-[#f4eed7]">Build Master</a>
          <OfflineNav />
          <LangSwitch />
          <div className="hidden min-w-0 truncate sm:block"><OfflineBadge /></div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pt-5 pb-8">
        <BuildMasterApp />
      </main>
      <FooterNote />
    </div>
  );
}

const showResult = (r: { route?: string; error?: string }) => {
  if (r.route) location.hash = `/c/${encodeURIComponent(r.route)}`;
  else { history.replaceState(null, "", location.pathname); alert(`kisk-Import: ${r.error}`); }
};

(async () => {
  // online: the account's data and the shared prices first, so the app starts with them
  await initCloud();
  const sent = await takeKiskImport();
  if (sent) showResult(sent);
  else listenKiskImport(showResult);
  createRoot(document.getElementById("root")!).render(<App />);
})();
