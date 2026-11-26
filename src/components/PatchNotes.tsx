"use client";
import { useEffect, useMemo, useState } from "react";
import { useLang, useT } from "@/lib/i18n";
import { noteTopics, parsePatchNote, type PatchBlock, type PatchNote } from "@/lib/patch-notes";
import { Pic, skillIcon } from "./ClassSkillSetup";

/**
 * Official patch notes for Europe (Tyron 2026-11-26): one box per update, closed at first; open shows the text with
 * NCSOFT's pictures and our skill icons in the class tables. Embedded in the offline file (scripts/fetch-patch-notes.mjs).
 */
declare global { var __BM_PATCH__: { fetched: string; notes: PatchNote[] } | undefined }

function usePatchNotes(): PatchNote[] | undefined {
  const [notes, setNotes] = useState<PatchNote[] | undefined>(globalThis.__BM_PATCH__?.notes);
  useEffect(() => {
    if (notes || typeof location === "undefined" || !/^https?:$/.test(location.protocol)) return;
    fetch("/api/patch-notes", { credentials: "same-origin" }).then((r) => (r.ok ? r.json() : undefined))
      .then((d) => setNotes(d?.notes ?? [])).catch(() => setNotes([]));
  }, [notes]);
  return notes;
}

const shortTitle = (title: string) => title.replace(/^\[Notice\]\s*/i, "").replace(/\s*\|\s*/, " · ");

function SkillName({ cls, name }: { cls?: string; name: string }) {
  const icon = cls ? skillIcon(cls, name) : undefined;
  return (
    <span className="flex items-center gap-2">
      {icon ? <Pic file={icon} alt="" className="h-7 w-7 shrink-0 rounded-md" /> : <span className="h-7 w-7 shrink-0 rounded-md bg-white/[0.05]" aria-hidden />}
      <span className="font-medium text-[#f4eed7]">{name}</span>
    </span>
  );
}

function Blocks({ blocks }: { blocks: PatchBlock[] }) {
  return (
    <div className="space-y-2 text-sm leading-relaxed text-[#efe6cc]/80">
      {blocks.map((b, i) => {
        switch (b.t) {
          case "h":
            return b.level === 1
              ? <h3 key={i} className="pt-3 text-base font-semibold text-[#d9c58f]">{b.text.replace(/^\[|\]$/g, "")}</h3>
              : <h4 key={i} className={`pt-2 font-semibold text-[#f4eed7] ${b.level === 2 ? "text-[15px]" : "text-sm text-[#f4eed7]/90"}`}>{b.text}</h4>;
          case "p":
            return <p key={i} className="whitespace-pre-line">{b.text}</p>;
          case "li":
            return <div key={i} className="flex gap-2" style={{ paddingLeft: `${(b.depth - 1) * 1.1}rem` }}><span className="mt-[0.55em] h-1.5 w-1.5 shrink-0 rounded-full bg-[#d9c58f]/60" /><span className="whitespace-pre-line">{b.text}</span></div>;
          case "img":
            // eslint-disable-next-line @next/next/no-img-element
            return <img key={i} src={b.src} alt="" loading="lazy" className="w-full rounded-lg border border-white/10" onError={(e) => { e.currentTarget.style.display = "none"; }} />;
          case "table":
            return (
              <div key={i} className="overflow-x-auto rounded-lg border border-white/10">
                <table className="w-full text-left text-[13px]">
                  <tbody>
                    {b.rows.map((r, j) => (
                      <tr key={j} className={r.head ? "bg-[#d9c58f]/10 text-[#d9c58f]" : "border-t border-white/5"}>
                        {r.cells.map((c, k) => {
                          const Cell = r.head ? "th" : "td";
                          return <Cell key={k} className="whitespace-pre-line px-3 py-2 align-top font-normal">
                            {!r.head && k === 0 && b.cls ? <span className="flex flex-col gap-1">{c.split("\n").map((n) => <SkillName key={n} cls={b.cls} name={n} />)}</span> : c}
                          </Cell>;
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
        }
      })}
    </div>
  );
}

function NoteBox({ note }: { note: PatchNote }) {
  const lang = useLang();
  const t = useT();
  const [open, setOpen] = useState(false);
  const blocks = useMemo(() => parsePatchNote(note.body), [note.body]);
  const topics = noteTopics(blocks).slice(0, 5);
  const hasClass = blocks.some((b) => b.t === "table" && b.cls);
  const date = new Date(note.date * 1000).toLocaleDateString(lang === "en" ? "en-GB" : "de-DE", { day: "numeric", month: "long", year: "numeric" });
  return (
    <li className="overflow-hidden rounded-2xl border border-[#d9c58f]/20 bg-white/[0.03]">
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-white/[0.03]">
        <span className="mt-0.5 flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-lg bg-[#d9c58f]/15 text-[#d9c58f]">
          <span className="text-sm font-bold leading-none">{new Date(note.date * 1000).getDate()}</span>
          <span className="text-[9px] uppercase leading-none">{new Date(note.date * 1000).toLocaleDateString(lang === "en" ? "en-GB" : "de-DE", { month: "short" })}</span>
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-semibold text-[#f4eed7]">{shortTitle(note.title)}</span>
          <span className="block text-xs text-zinc-500">{date}{hasClass ? ` · ${t("Klassenänderungen", "Class changes")}` : ""}</span>
          {topics.length > 0 && <span className="mt-1.5 flex flex-wrap gap-1">{topics.map((x) => <span key={x} className="rounded bg-white/[0.06] px-1.5 py-0.5 text-[10px] text-[#efe6cc]/70">{x}</span>)}</span>}
        </span>
        <span className={`mt-2 text-[#d9c58f] transition-transform ${open ? "rotate-180" : ""}`}>▾</span>
      </button>
      {open && (
        <div className="border-t border-white/5 px-4 pb-4 pt-2">
          <Blocks blocks={blocks} />
          <a href={note.url} target="_blank" rel="noreferrer" className="mt-4 inline-block text-xs text-zinc-500 underline hover:text-zinc-300">{t("Original bei Steam / NCSOFT", "Original on Steam / NCSOFT")}</a>
        </div>
      )}
    </li>
  );
}

export function PatchNotes({ onBack }: { onBack: () => void }) {
  const t = useT();
  const notes = usePatchNotes();
  return (
    <div className="space-y-5">
      <div className="bm-backdrop pointer-events-none fixed inset-0 -z-10" aria-hidden />
      <div className="pt-4">
        <button onClick={onBack} className="rounded-lg border border-[#d9c58f]/25 bg-white/[0.04] px-3 py-1.5 text-sm text-[#efe6cc] hover:border-[#d9c58f]/50">‹ {t("Zurück", "Back")}</button>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[#f4eed7]">Patch Notes</h1>
        <p className="mt-1 text-sm text-[#efe6cc]/50">{t("Offizielle Updates für Europa von NCSOFT (auf Englisch). Update antippen zum Aufklappen.", "Official updates for Europe from NCSOFT. Tap an update to open it.")}</p>
      </div>
      {!notes && <p className="text-sm text-zinc-500">{t("Lädt …", "Loading …")}</p>}
      {notes?.length === 0 && <p className="text-sm text-zinc-500">{t("Gerade keine Patch Notes verfügbar.", "No patch notes available right now.")}</p>}
      <ul className="space-y-3">{notes?.map((n) => <NoteBox key={n.id} note={n} />)}</ul>
    </div>
  );
}
