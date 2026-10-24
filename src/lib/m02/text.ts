/**
 * Small text helpers for SVG annotations of the module 02 figures (SVG text does not wrap).
 * Estimates only: Plus Jakarta Sans averages about 0.56 em per character at 11–13 px.
 */

/** Estimated width of a text in px at `fontPx` (`em` = average character width in em). */
export function textWidth(s: string, fontPx: number, em = 0.56): number {
  return s.length * fontPx * em;
}

/**
 * Splits `text` into lines of at most `maxChars` characters at normal spaces (long words stay
 * whole). No-break spaces (e.g. "8 %", "CHF 1’000") never break.
 */
export function wrapText(text: string, maxChars: number): string[] {
  const lines: string[] = [];
  let cur = '';
  for (const word of text.split(/[ \t\r\n]+/).filter(Boolean)) {
    const next = cur ? `${cur} ${word}` : word;
    if (next.length > maxChars && cur) {
      lines.push(cur);
      cur = word;
    } else {
      cur = next;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}
