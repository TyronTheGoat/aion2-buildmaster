import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Aion 2 BuildMaster",
  description: "Gear bewerten, BiS pro Slot und priorisierter Upgrade-Pfad für Aion 2.",
  appleWebApp: { capable: true, title: "BuildMaster", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  themeColor: "#0b0c10",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="de" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <header className="sticky top-0 z-10 border-b border-[#d9c58f]/10 bg-[#0b0c10]/80 backdrop-blur pt-[env(safe-area-inset-top)]">
          <div className="mx-auto flex max-w-6xl items-center gap-6 px-4 py-3">
            <Link href="/" className="font-semibold tracking-tight text-[#f4eed7]">Build Master</Link>
            <nav aria-label="Hauptnavigation"><Link href="/#" className="rounded-lg border border-[#d9c58f]/25 px-3 py-1 text-sm text-[#efe6cc]/85 hover:border-[#d9c58f]/50">Charaktere</Link></nav>
          </div>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-5 pb-[calc(2rem+env(safe-area-inset-bottom))]">
          {children}
        </main>
        <footer className="pointer-events-none fixed inset-x-0 bottom-0 z-20 bg-[#0b0c10]/85 pb-[env(safe-area-inset-bottom)] text-center text-[9px] leading-[14px] text-zinc-600">
          Daten: kisk.app · Nicht offiziell, kein Bezug zu NCSOFT
        </footer>
      </body>
    </html>
  );
}
