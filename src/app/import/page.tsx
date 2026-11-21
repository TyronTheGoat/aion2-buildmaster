"use client";
import { useState } from "react";
import { CharacterView } from "@/components/CharacterView";
import { parseKiskGear } from "@/lib/kisk/parse";
import { textToLines } from "@/lib/kisk/html-to-text";
import type { Character } from "@/lib/types";

export default function ImportPage() {
  const [text, setText] = useState("");
  const [link, setLink] = useState("");
  const [char, setChar] = useState<Character>();

  function analyse() {
    const m = link.match(/kisk\.app\/c\/([^/]+)\/([^/]+)\/([^/?#]+)/i);
    const [region, server, name] = m ? [m[1], m[2], decodeURIComponent(m[3])] : ["eu", "?", text.split("\n").find((l) => l.trim())?.trim() ?? "Charakter"];
    setChar(parseKiskGear(textToLines(text), {
      region, server, name,
      url: m ? `https://kisk.app/c/${region}/${server}/${m[3]}/gear` : "https://kisk.app",
      mode: "paste",
    }));
  }

  if (char) {
    return (
      <div className="space-y-4">
        <button onClick={() => setChar(undefined)} className="text-sm text-zinc-400 underline">← Neu einfügen</button>
        <CharacterView char={char} />
      </div>
    );
  }

  const input = "w-full rounded-lg border border-white/10 bg-white/5 px-3 py-3 text-base outline-none focus:border-amber-400";
  return (
    <div className="space-y-3">
      <h1 className="text-xl font-bold">kisk-Seite einfügen</h1>
      <ol className="list-decimal space-y-1 pl-5 text-sm text-zinc-400">
        <li>Öffne deine Charakterseite auf kisk.app und tippe auf „Gear“.</li>
        <li>Alles markieren (Strg+A bzw. lange tippen → Alles auswählen) und kopieren.</li>
        <li>Hier einfügen und auf „Analysieren“ tippen.</li>
      </ol>
      <input value={link} onChange={(e) => setLink(e.target.value)} placeholder="kisk.app-Link (optional)" className={input} />
      <textarea value={text} onChange={(e) => setText(e.target.value)} rows={10} placeholder="Seiteninhalt hier einfügen…" className={input} />
      <button onClick={analyse} disabled={!text.trim()} className="w-full rounded-lg bg-amber-400 py-3 font-semibold text-black disabled:opacity-40">
        Analysieren
      </button>
    </div>
  );
}
