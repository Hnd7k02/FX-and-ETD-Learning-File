/**
 * Small, dependency-free helpers for the hand-written SVG charts.
 * Pure functions: scales, nice ticks, path builders, clipping and easing.
 */

export interface Scale {
  (x: number): number;
  invert(y: number): number;
  domain: [number, number];
  range: [number, number];
}

/** Linear scale mapping [d0, d1] → [r0, r1]. */
export function scaleLinear(domain: [number, number], range: [number, number]): Scale {
  const [d0, d1] = domain;
  const [r0, r1] = range;
  const k = d1 === d0 ? 0 : (r1 - r0) / (d1 - d0);
  const f = ((x: number) => r0 + (x - d0) * k) as Scale;
  f.invert = (y: number) => (k === 0 ? d0 : d0 + (y - r0) / k);
  f.domain = [d0, d1];
  f.range = [r0, r1];
  return f;
}

/** "Nice" step (1, 2, 2.5 or 5 × 10^n) for about `count` intervals. */
export function niceStep(span: number, count = 5): number {
  if (!(span > 0) || !Number.isFinite(span)) return 1;
  const raw = span / Math.max(1, count);
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / mag;
  const e = 1e-9; // tolerance: 0.6 / 3 = 0.19999999999999998 must still count as 2
  const nice =
    norm <= 1 + e ? 1 : norm <= 2 + e ? 2 : norm <= 2.5 + e ? 2.5 : norm <= 5 + e ? 5 : 10;
  return nice * mag;
}

/** Ticks covering [min, max] at a nice step (values rounded to avoid float noise). */
export function niceTicks(min: number, max: number, count = 5): number[] {
  if (max < min) [min, max] = [max, min];
  const step = niceStep(max - min, count);
  const start = Math.ceil(min / step - 1e-9) * step;
  const out: number[] = [];
  const decimals = Math.max(0, -Math.floor(Math.log10(step)) + 2);
  for (let v = start; v <= max + step * 1e-9; v += step) out.push(Number(v.toFixed(decimals)));
  return out;
}

export type Point = [number, number];

/** Samples f on [x0, x1] at n + 1 points. */
export function sample(f: (x: number) => number, x0: number, x1: number, n = 120): Point[] {
  const pts: Point[] = [];
  for (let i = 0; i <= n; i++) {
    const x = x0 + ((x1 - x0) * i) / n;
    pts.push([x, f(x)]);
  }
  return pts;
}

/** SVG path "M x,y L x,y …" with one decimal. Skips non-finite points by starting a new segment. */
export function linePath(points: Point[]): string {
  let d = '';
  let pen = false;
  for (const [x, y] of points) {
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      pen = false;
      continue;
    }
    d += `${pen ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`;
    pen = true;
  }
  return d;
}

/** Closed area between an upper and a lower polyline (same x order). */
export function areaPath(upper: Point[], lower: Point[]): string {
  if (!upper.length || !lower.length) return '';
  const back = [...lower].reverse();
  return `${linePath(upper)}L${back.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join('L')}Z`;
}

/** Maps data points through x and y scales. */
export function project(
  points: Point[],
  sx: (x: number) => number,
  sy: (y: number) => number,
): Point[] {
  return points.map(([x, y]) => [sx(x), sy(y)]);
}

export const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));

/**
 * Tangent segment y = y0 + m (x − x0) on [xa, xb], clipped so that y stays in [lo, hi].
 * Returns [xStart, yStart, xEnd, yEnd] in data units (as in the Greeks lab prototype).
 */
export function tangentSegment(
  x0: number,
  y0: number,
  m: number,
  xa: number,
  xb: number,
  lo: number,
  hi: number,
): [number, number, number, number] {
  let a = xa;
  let b = xb;
  if (m !== 0) {
    const xl = x0 + (lo - y0) / m;
    const xh = x0 + (hi - y0) / m;
    a = Math.max(a, Math.min(xl, xh));
    b = Math.min(b, Math.max(xl, xh));
  }
  return [a, y0 + m * (a - x0), b, y0 + m * (b - x0)];
}

export const easeInOutCubic = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
export const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

/** Linear interpolation of two equally long point lists (morphs). */
export function lerpPoints(a: Point[], b: Point[], t: number): Point[] {
  const n = Math.min(a.length, b.length);
  const out: Point[] = [];
  for (let i = 0; i < n; i++) {
    const p = a[i]!;
    const q = b[i]!;
    out.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]);
  }
  return out;
}

/** Index of the point whose x is closest to `x` (sorted by x). Binary search. */
export function nearestIndex(xs: number[], x: number): number {
  if (!xs.length) return -1;
  let lo = 0;
  let hi = xs.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (xs[mid]! < x) lo = mid;
    else hi = mid;
  }
  return Math.abs(xs[lo]! - x) <= Math.abs(xs[hi]! - x) ? lo : hi;
}
