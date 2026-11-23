import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { FooterNote, LangSwitch, NAV_CLS, NavLabel } from "@/components/Chrome";
import "./globals.css";

export const metadata: Metadata = {
  title: "Aion 2 BuildMaster",
  description: "Rate your gear, best in slot per slot and current vs. BiS comparison for Aion 2.",
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
            <nav aria-label="Main navigation"><Link href="/#" className={NAV_CLS}><NavLabel /></Link></nav>
            <LangSwitch />
          </div>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-5 pb-[calc(2rem+env(safe-area-inset-bottom))]">
          {children}
        </main>
        <FooterNote />
      </body>
    </html>
  );
}
