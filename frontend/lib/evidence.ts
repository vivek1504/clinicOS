/** Where a structured item came from in the raw notes, found on the client so no backend change is needed. */
export interface Span {
  start: number;
  end: number;
}

/** Exact phrase first; otherwise the longest run of three or more consecutive words that appears in the notes. */
export function findSpan(notes: string, item: string): Span | null {
  const hay = notes.toLowerCase();
  const needle = item.trim().toLowerCase();
  if (!needle) return null;
  const exact = hay.indexOf(needle);
  if (exact >= 0) return { start: exact, end: exact + needle.length };
  const words = needle.split(/[\s,;:()]+/).filter((w) => w.length > 1); // punctuation must not glue to a word
  for (let len = Math.min(words.length, 8); len >= 3; len--) {
    for (let s = 0; s + len <= words.length; s++) {
      const phrase = words.slice(s, s + len).join(" ");
      const i = hay.indexOf(phrase);
      if (i >= 0) return { start: i, end: i + phrase.length };
    }
  }
  return null;
}

/** Spans for many items, merged where they overlap, in document order. */
export function spansFor(notes: string, items: string[]): Span[] {
  const found = items.map((v) => findSpan(notes, v)).filter((s): s is Span => s !== null).sort((a, b) => a.start - b.start);
  const merged: Span[] = [];
  for (const s of found) {
    const last = merged[merged.length - 1];
    if (last && s.start <= last.end) last.end = Math.max(last.end, s.end);
    else merged.push({ ...s });
  }
  return merged;
}
