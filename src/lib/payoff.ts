/**
 * Payoff builder (MASTER_PROMPT §8.3): pure maths for positions made of vanilla legs.
 * No DOM. Used by the PayoffBuilder island (modules 04 and 06).
 *
 * Convention: pair Base/Quote (USD/CHF), rd = quote-currency rate (CHF, domestic),
 * rf = base-currency rate (USD, foreign), continuous rates, T in years (days/365).
 * A leg has a notional in base currency (USD); all money amounts are in quote currency (CHF).
 * Pips are quoted per unit of the reference notional `market.notional`
 * (net value in CHF / reference notional / pip), the usual way to quote a structure.
 *
 * - Payoff at expiry of a leg: sign · N · max(S_T − K, 0) (call), max(K − S_T, 0) (put),
 *   S_T − K (forward), sign = +1 long, −1 short.
 * - Value today: Garman-Kohlhagen for options, N · (S·e^(−rf T) − K·e^(−rd T)) for a forward.
 * - Net premium = value today of the whole position (> 0 you pay, < 0 you receive).
 *   "Zero Cost" when |net premium| < 0.05 pips.
 * - With a smile (optional), each option leg is valued at the smile vol of its strike,
 *   computed at today's forward and kept fixed when the spot moves (sticky strike).
 */
import { gkPrice, type OptionType } from '@/lib/fx/vanilla';
import { greeks, thetaOneDay } from '@/lib/fx/greeks';
import { atmDnsStrike, strikeFromDelta } from '@/lib/fx/implied';
import { volAtStrike, type SmileQuotes } from '@/lib/fx/smile';
import { pipSize } from '@/lib/format';

export type LegKind = OptionType | 'forward';
export type LegSide = 'long' | 'short';

export interface Leg {
  side: LegSide;
  kind: LegKind;
  /** Strike (forward: the agreed rate), quote currency per 1 unit base. */
  strike: number;
  /** Notional in base currency (e.g. USD 1’000’000). */
  notional: number;
}

export interface PayoffMarket {
  /** Spot, quote per base. */
  S: number;
  /** Time to expiry in years (days/365). */
  T: number;
  /** Flat implied vol (decimal), used when no smile is given. */
  vol: number;
  /** Quote-currency rate (domestic, CHF), continuous. */
  rd: number;
  /** Base-currency rate (foreign, USD), continuous. */
  rf: number;
  /** Reference notional in base currency for pips and ratios (e.g. 1’000’000). */
  notional: number;
  /** Pair, sets the pip size (default USD/CHF). */
  pair?: string;
  /** Optional smile quotes (module 06); legs then use the smile vol of their strike. */
  smile?: SmileQuotes;
}

/** |net premium| below this many pips counts as zero cost. */
export const ZERO_COST_PIPS = 0.05;
/** Strike grid of the builder: 5 pips. */
export const STRIKE_STEP = 0.0005;
/** Strike range of the builder (handles and sliders), quote per base. */
export const STRIKE_RANGE: readonly [number, number] = [0.74, 0.85];
/** x range of the chart (USD/CHF), a bit wider than the strike range. */
export const X_RANGE: readonly [number, number] = [0.73, 0.86];

export const sideSign = (side: LegSide): 1 | -1 => (side === 'long' ? 1 : -1);

const pipOf = (m: PayoffMarket): number => pipSize(m.pair ?? 'USD/CHF');

/** Forward of the market, S · e^((rd − rf) T). */
export const marketForward = (m: PayoffMarket): number => m.S * Math.exp((m.rd - m.rf) * m.T);

/** Rounds a strike to the 5-pip grid. */
export function roundStrike(K: number, step = STRIKE_STEP): number {
  return Number((Math.round(K / step) * step).toFixed(6));
}

/** Vol used for an option leg: flat, or the smile vol at its strike (sticky strike). */
export function legVol(leg: Leg, m: PayoffMarket): number {
  if (!m.smile || leg.kind === 'forward' || !(m.T > 0)) return m.vol;
  return volAtStrike(leg.strike, marketForward(m), m.T, m.smile);
}

/** Payoff of one leg at expiry, in quote currency, for a spot S_T at expiry (no premium). */
export function legPayoff(leg: Leg, ST: number): number {
  const s = sideSign(leg.side) * leg.notional;
  if (leg.kind === 'forward') return s * (ST - leg.strike);
  if (leg.kind === 'call') return s * Math.max(ST - leg.strike, 0);
  return s * Math.max(leg.strike - ST, 0);
}

/**
 * Value of one leg today, in quote currency, at spot S and time to expiry T (defaults: market).
 * `vol` overrides the leg vol (callers that evaluate many spots pass it once).
 */
export function legValue(leg: Leg, m: PayoffMarket, S = m.S, T = m.T, vol?: number): number {
  const s = sideSign(leg.side) * leg.notional;
  if (leg.kind === 'forward') {
    return (
      s * (S * Math.exp(-m.rf * Math.max(T, 0)) - leg.strike * Math.exp(-m.rd * Math.max(T, 0)))
    );
  }
  return s * gkPrice(S, leg.strike, T, vol ?? legVol(leg, m), m.rd, m.rf, leg.kind);
}

/** Payoff of the position at expiry (quote currency). */
export function positionPayoff(legs: readonly Leg[], ST: number): number {
  let v = 0;
  for (const l of legs) v += legPayoff(l, ST);
  return v;
}

/** Value of the position today (quote currency) at spot S (default: market spot). */
export function positionValue(legs: readonly Leg[], m: PayoffMarket, S = m.S, T = m.T): number {
  let v = 0;
  for (const l of legs) v += legValue(l, m, S, T);
  return v;
}

export type PremiumDirection = 'pay' | 'receive' | 'zero';

export interface NetPremium {
  /** Net value today in quote currency: > 0 you pay, < 0 you receive. */
  quote: number;
  /** Same in pips of the reference notional. */
  pips: number;
  /** As a fraction of the base notional, premium converted at spot: quote / (S · N). */
  pctBase: number;
  direction: PremiumDirection;
  /** |pips| < ZERO_COST_PIPS. */
  zeroCost: boolean;
}

/** Net premium of the position (the value today). */
export function netPremium(legs: readonly Leg[], m: PayoffMarket): NetPremium {
  const quote = positionValue(legs, m);
  const pips = quote / m.notional / pipOf(m);
  const zeroCost = Math.abs(pips) < ZERO_COST_PIPS;
  return {
    quote,
    pips,
    pctBase: quote / (m.S * m.notional),
    direction: zeroCost ? 'zero' : quote > 0 ? 'pay' : 'receive',
    zeroCost,
  };
}

export interface NetGreeks {
  /** Spot delta in base currency (USD): Σ sign · N · Δ. */
  delta: number;
  /** Forward delta in base currency: Σ sign · N · Δ_F (a forward counts 1 per unit). */
  deltaFwd: number;
  /** Change of the base-currency delta per big figure (100 pips). */
  gamma: number;
  /** Quote currency per vol point (+1 %). */
  vega: number;
  /** Quote currency per calendar day, one-day difference V(T − 1/365) − V(T). */
  theta: number;
  /** Quote currency per +1 % quote-currency rate. */
  rhoD: number;
  /** Quote currency per +1 % base-currency rate. */
  rhoF: number;
}

const ZERO_GREEKS: NetGreeks = {
  delta: 0,
  deltaFwd: 0,
  gamma: 0,
  vega: 0,
  theta: 0,
  rhoD: 0,
  rhoF: 0,
};

/** Greeks of one leg on its notional (units as NetGreeks). */
export function legGreeks(leg: Leg, m: PayoffMarket): NetGreeks {
  const s = sideSign(leg.side) * leg.notional;
  const bigFigure = 100 * pipOf(m);
  const { S, T, rd, rf } = m;
  if (leg.kind === 'forward') {
    const t = Math.max(T, 0);
    const dff = Math.exp(-rf * t);
    const dfd = Math.exp(-rd * t);
    const tm = Math.max(t - 1 / 365, 0);
    const vNow = S * dff - leg.strike * dfd;
    const vTomorrow = S * Math.exp(-rf * tm) - leg.strike * Math.exp(-rd * tm);
    return {
      delta: s * dff,
      deltaFwd: s,
      gamma: 0,
      vega: 0,
      theta: s * (vTomorrow - vNow),
      rhoD: (s * leg.strike * t * dfd) / 100,
      rhoF: (-s * S * t * dff) / 100,
    };
  }
  const vol = legVol(leg, m);
  const g = greeks(S, leg.strike, T, vol, rd, rf, leg.kind);
  return {
    delta: s * g.delta,
    deltaFwd: s * g.deltaFwd,
    gamma: s * g.gamma * bigFigure,
    vega: (s * g.vega) / 100,
    theta: s * thetaOneDay(S, leg.strike, T, vol, rd, rf, leg.kind),
    rhoD: (s * g.rhoD) / 100,
    rhoF: (s * g.rhoF) / 100,
  };
}

/** Net Greeks of the position (sum over legs). */
export function netGreeks(legs: readonly Leg[], m: PayoffMarket): NetGreeks {
  const out = { ...ZERO_GREEKS };
  for (const l of legs) {
    const g = legGreeks(l, m);
    for (const k of Object.keys(out) as Array<keyof NetGreeks>) out[k] += g[k];
  }
  return out;
}

/** The position with the strikes of the given legs replaced by K. */
function withStrike(legs: readonly Leg[], idx: readonly number[], K: number): Leg[] {
  return legs.map((l, i) => (idx.includes(i) ? { ...l, strike: K } : l));
}

/**
 * Strike K for the legs `idx` (all set to the same K) at which the net premium is zero,
 * searched in `range`. The net value need not be monotone in K (e.g. a straddle), so the
 * range is scanned for sign changes and the root nearest to `near` (default: the current
 * strike of the first leg) is refined by bisection. Returns null if there is no root.
 */
export function solveZeroCostStrike(
  legs: readonly Leg[],
  idx: number | readonly number[],
  m: PayoffMarket,
  range: readonly [number, number] = STRIKE_RANGE,
  near?: number,
): number | null {
  const ids = typeof idx === 'number' ? [idx] : [...idx];
  if (!ids.length || ids.some((i) => !legs[i])) return null;
  const target = near ?? legs[ids[0]!]!.strike;
  const f = (K: number): number => positionValue(withStrike(legs, ids, K), m);
  const n = 64;
  const [a, b] = range;
  let best: number | null = null;
  let prevK = a;
  let prevF = f(a);
  if (prevF === 0) best = a;
  for (let i = 1; i <= n; i++) {
    const K = a + ((b - a) * i) / n;
    const fK = f(K);
    if (fK === 0) {
      if (best === null || Math.abs(K - target) < Math.abs(best - target)) best = K;
    } else if (prevF !== 0 && Math.sign(fK) !== Math.sign(prevF)) {
      let lo = prevK;
      let hi = K;
      let flo = prevF;
      for (let j = 0; j < 80 && hi - lo > 1e-12; j++) {
        const mid = 0.5 * (lo + hi);
        const fm = f(mid);
        if (Math.sign(fm) === Math.sign(flo)) {
          lo = mid;
          flo = fm;
        } else hi = mid;
      }
      const root = 0.5 * (lo + hi);
      if (best === null || Math.abs(root - target) < Math.abs(best - target)) best = root;
    }
    prevK = K;
    prevF = fK;
  }
  return best;
}

/* ---------- At expiry: break-even, maximum gain and loss ---------- */

/** Sorted distinct strikes of the position (kinks of the payoff). */
export function kinks(legs: readonly Leg[]): number[] {
  const ks = [...new Set(legs.map((l) => l.strike))].sort((x, y) => x - y);
  return ks;
}

/** Slope of the payoff at expiry for S_T above all strikes (quote per base move). */
export function slopeAbove(legs: readonly Leg[]): number {
  let s = 0;
  for (const l of legs) if (l.kind !== 'put') s += sideSign(l.side) * l.notional;
  return s;
}

/**
 * P&L at expiry after the premium: payoff(S_T) − premium · e^(rd T) (the premium is paid
 * today; compounded to expiry at the quote-currency rate).
 */
export function pnlAtExpiry(legs: readonly Leg[], m: PayoffMarket, ST: number): number {
  return positionPayoff(legs, ST) - positionValue(legs, m) * Math.exp(m.rd * m.T);
}

/**
 * Break-even rates at expiry: the S_T > 0 where the P&L after premium is zero. Piecewise
 * linear between the strikes, so each segment has at most one root. Segments on which the
 * P&L is identically zero (a zero-cost collar between its strikes) add no points.
 */
export function breakEvens(legs: readonly Leg[], m: PayoffMarket): number[] {
  const fv = positionValue(legs, m) * Math.exp(m.rd * m.T);
  const p = (x: number) => positionPayoff(legs, x) - fv;
  const xs = [0, ...kinks(legs)];
  const out: number[] = [];
  const eps = 1e-9 * Math.max(1, m.notional);
  const push = (x: number) => {
    if (x > 0 && !out.some((y) => Math.abs(y - x) < 1e-9)) out.push(x);
  };
  for (let i = 0; i < xs.length; i++) {
    const x0 = xs[i]!;
    const y0 = p(x0);
    const last = i === xs.length - 1;
    const x1 = last ? x0 + 1 : xs[i + 1]!;
    const y1 = last ? y0 + slopeAbove(legs) : p(x1);
    const slope = (y1 - y0) / (x1 - x0);
    if (Math.abs(slope) < 1e-12 * Math.max(1, m.notional)) continue;
    if (Math.abs(y0) <= eps) {
      push(x0);
      continue;
    }
    const root = x0 - y0 / slope;
    if (root >= x0 && (last || root <= x1)) push(root);
  }
  return out.sort((a, b) => a - b);
}

export interface ExpiryExtremes {
  /** Largest P&L at expiry (quote currency), or 'unlimited'. */
  maxGain: number | 'unlimited';
  /** Smallest P&L at expiry (quote currency, ≤ 0 if there is a loss), or 'unlimited'. */
  maxLoss: number | 'unlimited';
  /** Rate at expiry where the maximum gain is first reached (null if unlimited). */
  maxGainAt: number | null;
  /** Rate at expiry where the maximum loss is first reached (0 = only if the rate fell to zero). */
  maxLossAt: number | null;
}

/**
 * Maximum gain and loss at expiry after the premium, over S_T ∈ [0, ∞). The P&L is
 * piecewise linear, so the extremes sit at S_T = 0, at a strike or at infinity (slope above
 * the highest strike ≠ 0 → unlimited).
 */
export function expiryExtremes(legs: readonly Leg[], m: PayoffMarket): ExpiryExtremes {
  const xs = [0, ...kinks(legs)];
  const vals = xs.map((x) => pnlAtExpiry(legs, m, x));
  const slope = slopeAbove(legs);
  const tiny = 1e-9 * Math.max(1, m.notional);
  const hi = Math.max(...vals);
  const lo = Math.min(...vals);
  const at = (v: number) => xs[vals.findIndex((y) => Math.abs(y - v) <= tiny)] ?? null;
  return {
    maxGain: slope > tiny ? 'unlimited' : hi,
    maxLoss: slope < -tiny ? 'unlimited' : lo,
    maxGainAt: slope > tiny ? null : at(hi),
    maxLossAt: slope < -tiny ? null : at(lo),
  };
}

/* ---------- Templates ---------- */

export const TEMPLATE_IDS = [
  'long-call',
  'short-call',
  'long-put',
  'short-put',
  'synthetic-forward',
  'long-forward',
  'call-spread',
  'put-spread',
  'risk-reversal',
  'straddle',
  'strangle',
  'butterfly',
  'seagull',
] as const;
export type TemplateId = (typeof TEMPLATE_IDS)[number];

/** Default template list of the builder (MASTER_PROMPT §8.3; the plain forward only on request). */
export const DEFAULT_TEMPLATES: readonly TemplateId[] = TEMPLATE_IDS.filter(
  (id) => id !== 'long-forward',
);

export const BASIC_TEMPLATES: readonly TemplateId[] = [
  'long-call',
  'short-call',
  'long-put',
  'short-put',
];

export function isTemplateId(x: string): x is TemplateId {
  return (TEMPLATE_IDS as readonly string[]).includes(x);
}

export interface PositionTemplate {
  id: TemplateId;
  legs: Leg[];
  /** Index of the leg whose strike is solved for zero cost (and follows the others), or null. */
  solve: number | null;
}

/**
 * Template strikes relative to the market (change here to change every template):
 * ATMF rounded to 4 decimals (the strike of the running example), 25Δ spot-delta strikes on
 * the 5-pip grid, the delta-neutral straddle strike, and the forward itself.
 */
export interface TemplateStrikes {
  atmf: number;
  forward: number;
  dns: number;
  call25: number;
  put25: number;
  /** Butterfly wing distance from the body (quote units). */
  wing: number;
  /** Seagull: long call and short call strikes. */
  seagullLow: number;
  seagullHigh: number;
}

export function templateStrikes(m: PayoffMarket): TemplateStrikes {
  const F = marketForward(m);
  const pip = pipOf(m);
  return {
    atmf: Math.round(F / pip) * pip,
    forward: F,
    dns: atmDnsStrike(m.S, m.T, m.vol, m.rd, m.rf),
    call25: roundStrike(strikeFromDelta(0.25, m.S, m.T, m.vol, m.rd, m.rf, 'call')),
    put25: roundStrike(strikeFromDelta(-0.25, m.S, m.T, m.vol, m.rd, m.rf, 'put')),
    wing: 200 * pip,
    seagullLow: roundStrike(m.S),
    seagullHigh: roundStrike(m.S + 300 * pip),
  };
}

const leg = (side: LegSide, kind: LegKind, strike: number, notional: number): Leg => ({
  side,
  kind,
  strike,
  notional,
});

/** Builds a template for a market. Solved strikes are set to their zero-cost value. */
export function buildTemplate(id: TemplateId, m: PayoffMarket): PositionTemplate {
  const k = templateStrikes(m);
  const N = m.notional;
  let legs: Leg[];
  let solve: number | null = null;
  switch (id) {
    case 'long-call':
      legs = [leg('long', 'call', k.atmf, N)];
      break;
    case 'short-call':
      legs = [leg('short', 'call', k.atmf, N)];
      break;
    case 'long-put':
      legs = [leg('long', 'put', k.atmf, N)];
      break;
    case 'short-put':
      legs = [leg('short', 'put', k.atmf, N)];
      break;
    case 'synthetic-forward':
      legs = [leg('long', 'call', k.forward, N), leg('short', 'put', k.forward, N)];
      break;
    case 'long-forward':
      legs = [leg('long', 'forward', k.forward, N)];
      break;
    case 'call-spread':
      legs = [leg('long', 'call', k.atmf, N), leg('short', 'call', k.call25, N)];
      break;
    case 'put-spread':
      legs = [leg('long', 'put', k.atmf, N), leg('short', 'put', k.put25, N)];
      break;
    case 'risk-reversal':
      legs = [leg('long', 'call', k.call25, N), leg('short', 'put', k.put25, N)];
      solve = 1;
      break;
    case 'straddle':
      legs = [leg('long', 'call', k.dns, N), leg('long', 'put', k.dns, N)];
      break;
    case 'strangle':
      legs = [leg('long', 'put', k.put25, N), leg('long', 'call', k.call25, N)];
      break;
    case 'butterfly':
      legs = [
        leg('long', 'call', k.atmf - k.wing, N),
        leg('short', 'call', k.atmf, 2 * N),
        leg('long', 'call', k.atmf + k.wing, N),
      ];
      break;
    case 'seagull':
      legs = [
        leg('long', 'call', k.seagullLow, N),
        leg('short', 'call', k.seagullHigh, N),
        leg('short', 'put', k.put25, N),
      ];
      solve = 2;
      break;
  }
  if (solve !== null) {
    const K = solveZeroCostStrike(legs, solve, m);
    if (K !== null) legs[solve] = { ...legs[solve]!, strike: K };
  }
  return { id, legs, solve };
}

/** Structure of a template: legs as "side-kind-notionalRatio", plus a strike condition. */
const SIGNATURES: Record<TemplateId, { legs: string[]; strikes?: 'same' | 'distinct' }> = {
  'long-call': { legs: ['long-call-1'] },
  'short-call': { legs: ['short-call-1'] },
  'long-put': { legs: ['long-put-1'] },
  'short-put': { legs: ['short-put-1'] },
  'synthetic-forward': { legs: ['long-call-1', 'short-put-1'], strikes: 'same' },
  'long-forward': { legs: ['long-forward-1'] },
  'call-spread': { legs: ['long-call-1', 'short-call-1'], strikes: 'distinct' },
  'put-spread': { legs: ['long-put-1', 'short-put-1'], strikes: 'distinct' },
  'risk-reversal': { legs: ['long-call-1', 'short-put-1'], strikes: 'distinct' },
  straddle: { legs: ['long-call-1', 'long-put-1'], strikes: 'same' },
  strangle: { legs: ['long-call-1', 'long-put-1'], strikes: 'distinct' },
  butterfly: { legs: ['long-call-1', 'long-call-1', 'short-call-2'], strikes: 'distinct' },
  seagull: { legs: ['long-call-1', 'short-call-1', 'short-put-1'], strikes: 'distinct' },
};

/**
 * Which template (out of `ids`) the legs form, judged by structure only: sides, kinds and
 * notional ratios to the smallest notional, plus "same strike" (synthetic forward,
 * straddle) or "distinct strikes" (spreads, risk reversal, strangle …). Null if none.
 */
export function identifyTemplate(
  legs: readonly Leg[],
  ids: readonly TemplateId[] = TEMPLATE_IDS,
): TemplateId | null {
  if (!legs.length) return null;
  const unit = Math.min(...legs.map((l) => l.notional));
  if (!(unit > 0)) return null;
  const sig = legs
    .map((l) => `${l.side}-${l.kind}-${Math.round((l.notional / unit) * 100) / 100}`)
    .sort();
  const strikes = new Set(legs.map((l) => Math.round(l.strike * 1e8)));
  for (const id of ids) {
    const s = SIGNATURES[id];
    const want = [...s.legs].sort();
    if (want.length !== sig.length || want.some((w, i) => w !== sig[i])) continue;
    if (s.strikes === 'same' && strikes.size !== 1) continue;
    if (s.strikes === 'distinct' && strikes.size !== legs.length) continue;
    return id;
  }
  return null;
}

/** Legs grouped by identical strike (for one drag handle per strike), sorted by strike. */
export function strikeGroups(legs: readonly Leg[]): Array<{ strike: number; legs: number[] }> {
  const groups: Array<{ strike: number; legs: number[] }> = [];
  legs.forEach((l, i) => {
    const g = groups.find((x) => Math.abs(x.strike - l.strike) < 1e-9);
    if (g) g.legs.push(i);
    else groups.push({ strike: l.strike, legs: [i] });
  });
  return groups.sort((a, b) => a.strike - b.strike);
}

/** Small normalised sketch of a template's payoff at expiry for the template chips. */
export function payoffSketch(legs: readonly Leg[], x0: number, x1: number, n = 24): number[] {
  const ys: number[] = [];
  for (let i = 0; i <= n; i++) ys.push(positionPayoff(legs, x0 + ((x1 - x0) * i) / n));
  const max = Math.max(...ys.map(Math.abs), 1e-12);
  return ys.map((y) => y / max);
}
