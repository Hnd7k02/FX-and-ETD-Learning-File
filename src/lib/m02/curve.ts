/**
 * Figure (c) ForwardCurve, section 3: forward points per tenor and the exact split
 * "Forward = Spot + Cost − Benefit" (forwardCarry in the core):
 * - Cost = S · rd · tq / (1 + rf · tb): financing the quote currency (CHF) you pay with,
 * - Benefit = S · rf · tb / (1 + rf · tb): interest on the base currency (USD) you hold.
 * Points = Cost − Benefit (in pips). Positive points: base currency at a forward premium,
 * negative: at a forward discount. Pure functions; rates simple p.a., money market.
 */
import { forwardCarry, forwardPremiumAnnualized } from '@/lib/fx/forward';
import { M02_CONFIG, PIP, type Tenor } from './config';

/** Premium (forward above spot), discount (below) or flat (equal within 0.05 pips). */
export type PremiumWording = 'premium' | 'discount' | 'flat';

/** Wording for forward points; |points| below `eps` pips counts as flat. */
export function premiumWording(points: number, eps = 0.05): PremiumWording {
  if (Math.abs(points) < eps) return 'flat';
  return points > 0 ? 'premium' : 'discount';
}

export interface CurvePoint {
  id: string;
  days: number;
  forward: number;
  /** Forward points in pips: costPips − benefitPips. */
  points: number;
  /** Cost of carry in pips (negative if the quote rate is negative). */
  costPips: number;
  /** Benefit in pips (negative if the base rate is negative). */
  benefitPips: number;
  /** Forward premium p.a. in money-market terms, (F/S − 1) · 360 / days ≈ rd − rf. */
  premiumPa: number;
  wording: PremiumWording;
}

export interface CurveMarket {
  spot: number;
  rd: number;
  rf: number;
  basisQuote: number;
  basisBase: number;
}

/** One tenor of the curve. */
export function curvePoint(m: CurveMarket, tenor: Tenor): CurvePoint {
  const c = forwardCarry(m.spot, m.rd, m.rf, tenor.days, m.basisQuote, m.basisBase);
  const points = (c.forward - m.spot) / PIP;
  return {
    id: tenor.id,
    days: tenor.days,
    forward: c.forward,
    points,
    costPips: c.cost / PIP,
    benefitPips: c.benefit / PIP,
    premiumPa: forwardPremiumAnnualized(c.forward, m.spot, tenor.days, m.basisQuote),
    wording: premiumWording(points),
  };
}

/** Forward points for all tenors. */
export function forwardCurve(
  m: CurveMarket,
  tenors: readonly Tenor[] = M02_CONFIG.curve.tenors,
): CurvePoint[] {
  return tenors.map((t) => curvePoint(m, t));
}

/** First-order approximation of the points: S · (rd · tq − rf · tb), in pips. */
export function pointsApprox(m: CurveMarket, days: number): number {
  return (m.spot * (m.rd * (days / m.basisQuote) - m.rf * (days / m.basisBase))) / PIP;
}

/** Symmetric y domain in pips that holds every bar and point, rounded up to `step`. */
export function curveDomain(points: readonly CurvePoint[], step = 50): [number, number] {
  let hi = step;
  let lo = -step;
  for (const p of points) {
    hi = Math.max(hi, p.costPips, p.points, -p.benefitPips);
    lo = Math.min(lo, -p.benefitPips, p.points, p.costPips);
  }
  return [Math.floor(lo / step) * step, Math.ceil(hi / step) * step];
}

/**
 * Indices of the x labels that fit: walks the positions left to right and drops a label that
 * would sit closer than `minGap` to the previous kept one. The last label is always kept.
 */
export function visibleLabels(xs: readonly number[], minGap: number): number[] {
  const keep: number[] = [];
  let last = -Infinity;
  xs.forEach((x, i) => {
    if (x - last >= minGap) {
      keep.push(i);
      last = x;
    }
  });
  const end = xs.length - 1;
  if (end >= 0 && keep[keep.length - 1] !== end) {
    if (keep.length && xs[end]! - xs[keep[keep.length - 1]!]! < minGap) keep.pop();
    keep.push(end);
  }
  return keep;
}

/** Id of the preset whose rates match (within half a slider step), or null. */
export function matchPreset(
  rd: number,
  rf: number,
  presets: readonly { id: string; rd: number; rf: number }[] = M02_CONFIG.curve.presets,
  tol: number = M02_CONFIG.curve.rateStep / 2,
): string | null {
  const p = presets.find((x) => Math.abs(x.rd - rd) < tol && Math.abs(x.rf - rf) < tol);
  return p ? p.id : null;
}

/** Index of the tenor closest to `days` (for click/drag selection on the chart). */
export function nearestTenor(days: number, tenors: readonly Tenor[] = M02_CONFIG.curve.tenors): number {
  let best = 0;
  tenors.forEach((t, i) => {
    if (Math.abs(t.days - days) < Math.abs(tenors[best]!.days - days)) best = i;
  });
  return best;
}
