const ENTITIES: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", "#39": "'", times: "×", rarr: "→",
};

/** Turns an HTML page into trimmed, non-empty text lines (one per block element). */
export function htmlToLines(html: string): string[] {
  const text = html
    .replace(/<(script|style|noscript|svg|template)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    // Keep game icons as marker lines so the parser can attach them to items.
    .replace(/<img\b[^>]*?src="([^"]*static-aion2-gamedata[^"]*)"[^>]*>/gi, "\n[img:$1]\n")
    .replace(/<img\b[^>]*>/gi, " ")
    .replace(/<(br|hr)\b[^>]*>/gi, "\n")
    .replace(/<\/?(p|div|li|ul|ol|tr|td|th|table|section|article|header|footer|h[1-6]|dt|dd|dl|span|a|small|strong|b|em|button|label)\b[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&(#?\w+);/g, (m, e: string) => {
      if (ENTITIES[e]) return ENTITIES[e];
      if (e.startsWith("#x")) return String.fromCodePoint(parseInt(e.slice(2), 16));
      if (e.startsWith("#")) return String.fromCodePoint(parseInt(e.slice(1), 10));
      return m;
    });
  return textToLines(text);
}

export function textToLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.replace(/[\s ]+/g, " ").trim())
    .filter(Boolean);
}
