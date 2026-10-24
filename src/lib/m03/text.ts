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

/** Like {@link stepTicks}, without ticks that sit on the ends of [lo, hi]. */
export function innerTicks(lo: number, hi: number, step: number): number[] {
  const eps = step * 1e-6;
  return stepTicks(lo, hi, step).filter((v) => v - lo > eps && hi - v > eps);
}

/** Axis-aligned box of an SVG label (y0 = top, y1 = bottom, in px). */
export interface Box {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

/** True if two boxes overlap (touching edges do not count). */
export function overlaps(a: Box, b: Box): boolean {
  return a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0;
}

/**
 * Vertical shift that moves `label` clear of every obstacle, going up (`dir` −1) or down (+1)
 * past each box it hits, with `pad` px of air. Returns 0 if the label is already clear.
 */
export function nudgeY(label: Box, obstacles: readonly Box[], dir: 1 | -1, pad = 2): number {
  let shift = 0;
  for (let k = 0; k <= obstacles.length; k++) {
    const moved = { ...label, y0: label.y0 + shift, y1: label.y1 + shift };
    const hit = obstacles.find((o) => overlaps(moved, o));
    if (!hit) return shift;
    shift = dir < 0 ? hit.y0 - pad - label.y1 : hit.y1 + pad - label.y0;
  }
  return shift;
}
