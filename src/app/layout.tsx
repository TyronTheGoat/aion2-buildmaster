import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Aion 2 BuildMaster",
  description: "Gear bewerten, BiS pro Slot und priorisierter Upgrade-Pfad für Aion 2.",
  appleWebApp: { capable: true, title: "BuildMaster", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  themeColor: "#0b0b12",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="de" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <header className="sticky top-0 z-10 border-b border-white/10 bg-[#0b0b12]/90 backdrop-blur pt-[env(safe-area-inset-top)]">
          <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
            <Link href="/" className="font-semibold tracking-tight">
              <span className="text-amber-400">Aion 2</span> BuildMaster
            </Link>
          </div>
        </header>
        <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))]">
          {children}
        </main>
        <footer className="mx-auto max-w-3xl px-4 pb-6 text-xs text-zinc-500">
          Charakterdaten von <a className="underline" href="https://kisk.app" target="_blank" rel="noreferrer">kisk.app</a>.
          Nicht offiziell, kein Bezug zu NCSOFT. Angaben ohne Gewähr.
        </footer>
      </body>
    </html>
  );
}
