/**
 * Small helpers for SVG labels of the module 03 figures (SVG text does not wrap or measure
 * itself before layout). Estimates only: Plus Jakarta Sans averages about 0.56 em per character
 * at 11–13 px, JetBrains Mono exactly 0.6 em.
 */

/** Estimated width of a text in px at `fontPx` (`em` = average character width in em). */
export function textWidth(s: string, fontPx: number, em = 0.56): number {
  return s.length * fontPx * em;
}

/**
 * Places a label centred at `x` inside [lo, hi] (keeps the whole text visible).
 * Returns the x of the label centre.
 */
export function fitCentre(x: number, width: number, lo: number, hi: number): number {
  const half = width / 2;
  if (hi - lo <= width) return (lo + hi) / 2;
  return Math.min(hi - half, Math.max(lo + half, x));
}

/** Ticks at multiples of `step` inside [lo, hi] (rounded to avoid float noise). */
export function stepTicks(lo: number, hi: number, step: number): number[] {
  const out: number[] = [];
  const decimals = Math.max(0, Math.ceil(-Math.log10(step)) + 2);
  for (let v = Math.ceil(lo / step - 1e-9) * step; v <= hi + step * 1e-9; v += step) {
    out.push(Number(v.toFixed(decimals)));
  }
  return out;
}
