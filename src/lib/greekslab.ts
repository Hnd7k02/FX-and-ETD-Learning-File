/**
 * Greeks lab (MASTER_PROMPT §8.2, docs/design/GreeksLab.dc.html): pure logic, no DOM.
 *
 * Everything the island draws comes from here: the Greeks of the importer's USD call on the
 * notional, the two chart panels per mode (curve, current point, tangent, reference lines),
 * dynamic axis domains, the moneyness chip, the numeric check and the "aha" annotation.
 * Maths only via the calculation core (src/lib/fx); this file never re-implements a formula.
 *
 * Units: price panels in pips (1 pip = 0.0001 CHF per USD); vol and rates in percent points on
 * the x axis, so tangent slopes read "pips per vol point" and "pips per +1 %"; time to expiry in
 * calendar days (T = days / 365, the slider works in weeks, T = weeks / 52).
 */
import { niceStep, sample, tangentSegment, type Point } from '@/lib/chart';
import { EXAMPLE, EXAMPLE_STRIKE } from '@/lib/fx/example';
import { greeks, numericGreeks, thetaOneDay, PIP } from '@/lib/fx/greeks';
import { gkPrice, payoff, type OptionType } from '@/lib/fx/vanilla';

export type LabMode = 'delta-gamma' | 'vega' | 'theta' | 'rho';
export const LAB_MODES: readonly LabMode[] = ['delta-gamma', 'vega', 'theta', 'rho'];

/** Slider state. Vol and rates in percent points so that slider steps stay exact. */
export interface LabParams {
  spot: number;
  weeks: number;
  volPct: number;
  rdPct: number;
  rfPct: number;
}
export type ParamKey = keyof LabParams;

/** Fraction → percent points without float noise (0.035 → 3.5). */
const pct = (x: number): number => Number((x * 100).toFixed(6));

export interface Range {
  min: number;
  max: number;
  step: number;
}

/**
 * Everything that is a choice rather than a law lives here (D-22): option, slider ranges,
 * chart domains, tangent length and thresholds of the annotations.
 */
export const LAB_CONFIG = {
  type: 'call' as OptionType,
  strike: EXAMPLE_STRIKE,
  notional: EXAMPLE.notional,
  pip: PIP,
  /** Weeks of the running example (13 weeks = 3 months, T = 0.25). */
  defaults: {
    spot: EXAMPLE.spot,
    weeks: Math.round(EXAMPLE.T * 52),
    volPct: pct(EXAMPLE.vol),
    rdPct: pct(EXAMPLE.rd),
    rfPct: pct(EXAMPLE.rf),
  } satisfies LabParams,
  ranges: {
    spot: { min: 0.76, max: 0.84, step: 0.0005 },
    weeks: { min: 1, max: 52, step: 1 },
    volPct: { min: 4, max: 16, step: 0.5 },
    rdPct: { min: -1, max: 5, step: 0.25 },
    rfPct: { min: 0, max: 6, step: 0.25 },
  } satisfies Record<ParamKey, Range>,
  /** x domains of the charts (spot as in the prototype: 0.74 … 0.86). */
  xDomains: {
    spot: [0.74, 0.86],
    volPct: [0, 20],
    days: [365, 0],
    rdPct: [-1, 5],
    rfPct: [0, 6],
  } satisfies Record<XKey, readonly [number, number]>,
  /** Fixed y domains (prototype: price 0 … 800 pips, delta 0 … 1). */
  priceDomain: [0, 800] as [number, number],
  deltaDomain: [0, 1] as [number, number],
  vegaDomain: [0, 4000] as [number, number],
  /** Rho panels rescale with the curves but never show less than this many pips. */
  rhoMinSpan: 100,
  /** Tangent length on each side, as a share of the x span (prototype ±0.025 of 0.12). */
  tangentHalf: 0.21,
  samples: 120,
  /** ATMF if |F − K| ≤ 1 pip. */
  atmfPips: 1,
  /** Annotation thresholds. */
  aha: {
    gammaPeakShare: 0.97,
    vegaPeakShare: 0.99,
    deltaHigh: 0.85,
    deltaLow: 0.15,
    thetaAccelWeeks: 4,
    thetaAccelGammaShare: 0.8,
    equalRatesPct: 0.125,
  },
} as const;

export type XKey = 'spot' | 'volPct' | 'days' | 'rdPct' | 'rfPct';
export type YKind = 'price' | 'delta' | 'vega' | 'theta';
export type PanelId = 'top' | 'bottom';

const K = LAB_CONFIG.strike;
const N = LAB_CONFIG.notional;
const TYPE = LAB_CONFIG.type;
const DAYS_PER_YEAR = 365;

/** Time to expiry in years from weeks (T = weeks / 52). */
export const yearsFromWeeks = (weeks: number): number => weeks / 52;
/** Calendar days to expiry for the theta axis (T · 365). */
export const daysFromWeeks = (weeks: number): number => yearsFromWeeks(weeks) * DAYS_PER_YEAR;

/** Rounds to a slider step and clamps to its range (no float noise). */
export function snap(value: number, r: Range): number {
  const k = Math.round((value - r.min) / r.step);
  const v = Math.min(r.max, Math.max(r.min, r.min + k * r.step));
  const decimals = Math.max(0, Math.ceil(-Math.log10(r.step)) + 1);
  return Number(v.toFixed(decimals));
}

/** Slider update from a point on a chart's x axis (drag on the chart). */
export function paramFromX(x: XKey, value: number): Partial<LabParams> {
  const R = LAB_CONFIG.ranges;
  switch (x) {
    case 'spot':
      return { spot: snap(value, R.spot) };
    case 'volPct':
      return { volPct: snap(value, R.volPct) };
    case 'days':
      return { weeks: snap((value * 52) / DAYS_PER_YEAR, R.weeks) };
    case 'rdPct':
      return { rdPct: snap(value, R.rdPct) };
    case 'rfPct':
      return { rfPct: snap(value, R.rfPct) };
  }
}

/** Current value of a chart's x variable. */
export function xValue(x: XKey, p: LabParams): number {
  return x === 'days' ? daysFromWeeks(p.weeks) : p[x];
}

export function sameParams(a: LabParams, b: LabParams): boolean {
  return (Object.keys(a) as ParamKey[]).every((k) => Math.abs(a[k] - b[k]) < 1e-9);
}

/* ---------- Greeks on the notional ---------- */

export interface LabNumbers {
  T: number;
  vol: number;
  rd: number;
  rf: number;
  forward: number;
  /** F − K in pips (positive: forward above the strike). */
  fwdMinusStrikePips: number;
  price: number;
  pricePips: number;
  priceChf: number;
  delta: number;
  /** Forward delta N(d1), used for the "deep in/out of the money" annotations. */
  deltaFwd: number;
  gamma: number;
  /** Change of delta per big figure (0.0100): Γ · 0.01. */
  gammaBigFigure: number;
  /** CHF per vol point on the notional. */
  vegaChf: number;
  /** Pips per vol point (slope of V(σ) with σ in percent points). */
  vegaPips: number;
  /** One-day difference V(T − 1 day) − V(T) in CHF on the notional (the number in the table). */
  thetaDayChf: number;
  /** Analytic theta / 365 in CHF on the notional. */
  thetaAnalyticChf: number;
  /** Analytic theta per day in pips (slope of V against calendar time). */
  thetaPips: number;
  rhoDChf: number;
  rhoFChf: number;
  /** Pips per +1 % CHF rate and per +1 % USD rate. */
  rhoDPips: number;
  rhoFPips: number;
  /** Central differences (numerischer Check), same units as the analytic values above. */
  check: {
    gamma: number;
    vegaChf: number;
    thetaChf: number;
    rhoDChf: number;
    rhoFChf: number;
  };
}

function inputs(p: LabParams) {
  return {
    S: p.spot,
    T: yearsFromWeeks(p.weeks),
    vol: p.volPct / 100,
    rd: p.rdPct / 100,
    rf: p.rfPct / 100,
  };
}

/** Price, the six Greeks on USD 1 Mio. and the numeric check for the current sliders. */
export function labNumbers(p: LabParams): LabNumbers {
  const { S, T, vol, rd, rf } = inputs(p);
  const g = greeks(S, K, T, vol, rd, rf, TYPE);
  const n = numericGreeks(S, K, T, vol, rd, rf, TYPE);
  const forward = S * Math.exp((rd - rf) * T);
  return {
    T,
    vol,
    rd,
    rf,
    forward,
    fwdMinusStrikePips: (forward - K) / PIP,
    price: g.price,
    pricePips: g.price / PIP,
    priceChf: g.price * N,
    delta: g.delta,
    deltaFwd: g.deltaFwd,
    gamma: g.gamma,
    gammaBigFigure: g.gamma * 100 * PIP,
    vegaChf: (g.vega / 100) * N,
    vegaPips: g.vega / 100 / PIP,
    thetaDayChf: thetaOneDay(S, K, T, vol, rd, rf, TYPE) * N,
    thetaAnalyticChf: g.thetaDay * N,
    thetaPips: g.thetaDay / PIP,
    rhoDChf: (g.rhoD / 100) * N,
    rhoFChf: (g.rhoF / 100) * N,
    rhoDPips: g.rhoD / 100 / PIP,
    rhoFPips: g.rhoF / 100 / PIP,
    check: {
      gamma: n.gamma,
      vegaChf: (n.vega / 100) * N,
      thetaChf: (n.theta / DAYS_PER_YEAR) * N,
      rhoDChf: (n.rhoD / 100) * N,
      rhoFChf: (n.rhoF / 100) * N,
    },
  };
}

/* ---------- Moneyness chip ---------- */

export interface Moneyness {
  kind: 'ATMF' | 'ITM' | 'OTM';
  /** Distance of the forward from the strike, rounded to whole pips (0 for ATMF). */
  pips: number;
}

/** Moneyness of the call relative to the forward: ATMF if |F − K| ≤ 1 pip. */
export function moneyness(forward: number, strike = K): Moneyness {
  const diff = (forward - strike) / PIP;
  if (Math.abs(diff) <= LAB_CONFIG.atmfPips + 1e-9) return { kind: 'ATMF', pips: 0 };
  return { kind: diff > 0 ? 'ITM' : 'OTM', pips: Math.round(Math.abs(diff)) };
}

/* ---------- Peaks ---------- */

/**
 * Spot at which gamma (fixed strike) is largest: d1 = −σ√T, i.e. F = K·e^(−1.5σ²T).
 * Follows from ∂/∂S [φ(d1)/S] = 0.
 */
export function gammaPeakSpot(p: LabParams): number {
  const { T, vol, rd, rf } = inputs(p);
  return K * Math.exp(-1.5 * vol * vol * T) * Math.exp((rf - rd) * T);
}

/**
 * Spot at which spot vega (fixed strike) is largest: d2 = 0, i.e. F = K·e^(σ²T/2), a few pips
 * above ATMF. Follows from ∂/∂S [S·φ(d1)] = 0.
 */
export function vegaPeakSpot(p: LabParams): number {
  const { T, vol, rd, rf } = inputs(p);
  return K * Math.exp(0.5 * vol * vol * T) * Math.exp((rf - rd) * T);
}

/* ---------- Panels ---------- */

export interface RefLine {
  x: number;
  kind: 'strike' | 'equalRates';
}

export interface PanelSpec {
  id: PanelId;
  x: XKey;
  xDomain: [number, number];
  y: YKind;
  /** Target y domain (fixed or "nice" around the curve). */
  yDomain: [number, number];
  /** Gridline step for dynamic domains (ticks are multiples of it). */
  yStep: number;
  points: Point[];
  /** Current point (the draggable dot). */
  at: Point;
  /** Slope of the tangent in y units per x unit, or null if the panel has no tangent. */
  slope: number | null;
  /** Tangent segment [x0, y0, x1, y1], clipped to the plot, or null. */
  tangent: [number, number, number, number] | null;
  refs: RefLine[];
  /** Payoff at expiry (dashed grey) or null. */
  payoff: Point[] | null;
  /** Curve of the running example for comparison (dashed grey) or null. */
  ghost: Point[] | null;
  /** Peak marker (vega panel) or null. */
  peak: Point | null;
}

/** Which x variable each panel of a mode uses. */
export const PANEL_X: Record<LabMode, [XKey, XKey]> = {
  'delta-gamma': ['spot', 'spot'],
  vega: ['volPct', 'spot'],
  theta: ['days', 'days'],
  rho: ['rdPct', 'rfPct'],
};

/** True when both panels share the x axis (axis title only under the lower chart). */
export const sharedX = (mode: LabMode): boolean => PANEL_X[mode][0] === PANEL_X[mode][1];

/** Mutable copy of a domain tuple. */
const dom = (d: readonly [number, number]): [number, number] => [d[0], d[1]];
const lo = (d: readonly [number, number]) => Math.min(d[0], d[1]);
const hi = (d: readonly [number, number]) => Math.max(d[0], d[1]);

/**
 * "Nice" domain around [min, max] with about `count` gridlines, optionally forced to contain
 * zero and to span at least `minSpan`.
 */
export function niceDomain(
  min: number,
  max: number,
  opts: { count?: number; withZero?: boolean; minSpan?: number } = {},
): { domain: [number, number]; step: number } {
  let a = Math.min(min, max);
  let b = Math.max(min, max);
  if (opts.withZero) {
    a = Math.min(a, 0);
    b = Math.max(b, 0);
  }
  const minSpan = opts.minSpan ?? 0;
  if (b - a < minSpan) {
    if (opts.withZero && a >= 0) b = a + minSpan;
    else if (opts.withZero && b <= 0) a = b - minSpan;
    else {
      const mid = (a + b) / 2;
      a = mid - minSpan / 2;
      b = mid + minSpan / 2;
    }
  }
  if (b - a < 1e-9) b = a + 1;
  const step = niceStep(b - a, opts.count ?? 4);
  const d0 = Math.floor(a / step + 1e-9) * step;
  const d1 = Math.ceil(b / step - 1e-9) * step;
  return { domain: [round(d0), round(d1)], step };
}

const round = (x: number) => Number(x.toFixed(10));

function tangentFor(
  x0: number,
  y0: number,
  m: number,
  xDomain: [number, number],
  yDomain: [number, number],
): [number, number, number, number] {
  const half = LAB_CONFIG.tangentHalf * (hi(xDomain) - lo(xDomain));
  return tangentSegment(
    x0,
    y0,
    m,
    Math.max(lo(xDomain), x0 - half),
    Math.min(hi(xDomain), x0 + half),
    yDomain[0],
    yDomain[1],
  );
}

function priceAt(
  p: LabParams,
  over: Partial<{ S: number; T: number; vol: number; rd: number; rf: number }>,
): number {
  const b = { ...inputs(p), ...over };
  return gkPrice(b.S, K, b.T, b.vol, b.rd, b.rf, TYPE) / PIP;
}

/** The two panels of a mode for the current sliders. */
export function panels(mode: LabMode, p: LabParams, n = labNumbers(p)): [PanelSpec, PanelSpec] {
  const C = LAB_CONFIG;
  const X = C.xDomains;
  const n0 = C.samples;
  const base = inputs(p);
  const strikeRef: RefLine[] = [{ x: K, kind: 'strike' }];

  if (mode === 'delta-gamma') {
    const top: PanelSpec = {
      id: 'top',
      x: 'spot',
      xDomain: dom(X.spot),
      y: 'price',
      yDomain: dom(C.priceDomain),
      yStep: 200,
      points: sample((S) => priceAt(p, { S }), X.spot[0], X.spot[1], n0),
      at: [p.spot, n.pricePips],
      slope: n.delta / PIP,
      tangent: tangentFor(p.spot, n.pricePips, n.delta / PIP, dom(X.spot), dom(C.priceDomain)),
      refs: strikeRef,
      payoff: sample((S) => payoff(S, K, TYPE) / PIP, X.spot[0], X.spot[1], n0),
      ghost: null,
      peak: null,
    };
    const deltaAt = (S: number) =>
      greeks(S, K, base.T, base.vol, base.rd, base.rf, TYPE).delta;
    const bottom: PanelSpec = {
      id: 'bottom',
      x: 'spot',
      xDomain: dom(X.spot),
      y: 'delta',
      yDomain: dom(C.deltaDomain),
      yStep: 0.25,
      points: sample(deltaAt, X.spot[0], X.spot[1], n0),
      at: [p.spot, n.delta],
      slope: n.gamma,
      tangent: tangentFor(p.spot, n.delta, n.gamma, dom(X.spot), dom(C.deltaDomain)),
      refs: strikeRef,
      payoff: null,
      ghost: null,
      peak: null,
    };
    return [top, bottom];
  }

  if (mode === 'vega') {
    const top: PanelSpec = {
      id: 'top',
      x: 'volPct',
      xDomain: dom(X.volPct),
      y: 'price',
      yDomain: dom(C.priceDomain),
      yStep: 200,
      points: sample((v) => priceAt(p, { vol: v / 100 }), X.volPct[0], X.volPct[1], n0),
      at: [p.volPct, n.pricePips],
      slope: n.vegaPips,
      tangent: tangentFor(p.volPct, n.pricePips, n.vegaPips, dom(X.volPct), dom(C.priceDomain)),
      refs: [],
      payoff: null,
      ghost: null,
      peak: null,
    };
    const vegaCurve = (q: LabParams) => {
      const b = inputs(q);
      return (S: number) => (greeks(S, K, b.T, b.vol, b.rd, b.rf, TYPE).vega / 100) * N;
    };
    const ex = C.defaults;
    const differs =
      Math.abs(p.weeks - ex.weeks) > 1e-9 ||
      Math.abs(p.volPct - ex.volPct) > 1e-9 ||
      Math.abs(p.rdPct - ex.rdPct) > 1e-9 ||
      Math.abs(p.rfPct - ex.rfPct) > 1e-9;
    const sPeak = vegaPeakSpot(p);
    const peakIn = sPeak >= X.spot[0] && sPeak <= X.spot[1];
    const bottom: PanelSpec = {
      id: 'bottom',
      x: 'spot',
      xDomain: dom(X.spot),
      y: 'vega',
      yDomain: dom(C.vegaDomain),
      yStep: 1000,
      points: sample(vegaCurve(p), X.spot[0], X.spot[1], n0),
      at: [p.spot, n.vegaChf],
      slope: null,
      tangent: null,
      refs: strikeRef,
      payoff: null,
      ghost: differs ? sample(vegaCurve({ ...ex, spot: p.spot }), X.spot[0], X.spot[1], n0) : null,
      peak: peakIn ? [sPeak, vegaCurve(p)(sPeak)] : null,
    };
    return [top, bottom];
  }

  if (mode === 'theta') {
    const days = daysFromWeeks(p.weeks);
    // dV/d(days to expiry) = −theta per day: the curve falls as time passes (x runs to expiry).
    const slope = -n.thetaPips;
    const intrinsic = payoff(p.spot, K, TYPE) / PIP;
    const top: PanelSpec = {
      id: 'top',
      x: 'days',
      xDomain: dom(X.days),
      y: 'price',
      yDomain: dom(C.priceDomain),
      yStep: 200,
      points: sample((d) => priceAt(p, { T: d / DAYS_PER_YEAR }), X.days[0], X.days[1], n0),
      at: [days, n.pricePips],
      slope,
      tangent: tangentFor(days, n.pricePips, slope, dom(X.days), dom(C.priceDomain)),
      refs: [],
      payoff: [
        [X.days[0], intrinsic],
        [X.days[1], intrinsic],
      ],
      ghost: null,
      peak: null,
    };
    const minDays = daysFromWeeks(C.ranges.weeks.min);
    const thetaAt = (d: number) =>
      thetaOneDay(base.S, K, d / DAYS_PER_YEAR, base.vol, base.rd, base.rf, TYPE) * N;
    const pts = sample(thetaAt, X.days[0], minDays, n0);
    const ys = pts.map(([, y]) => y);
    const nd = niceDomain(Math.min(...ys), Math.max(...ys), { withZero: true, minSpan: 40 });
    const bottom: PanelSpec = {
      id: 'bottom',
      x: 'days',
      xDomain: dom(X.days),
      y: 'theta',
      yDomain: nd.domain,
      yStep: nd.step,
      points: pts,
      at: [days, n.thetaDayChf],
      slope: null,
      tangent: null,
      refs: [],
      payoff: null,
      ghost: null,
      peak: null,
    };
    return [top, bottom];
  }

  // rho: price against the CHF rate (top) and against the USD rate (bottom), shared y domain.
  const topPts = sample((r) => priceAt(p, { rd: r / 100 }), X.rdPct[0], X.rdPct[1], n0);
  const botPts = sample((r) => priceAt(p, { rf: r / 100 }), X.rfPct[0], X.rfPct[1], n0);
  const all = [...topPts, ...botPts].map(([, y]) => y);
  const nd = niceDomain(Math.min(...all), Math.max(...all), { minSpan: C.rhoMinSpan });
  const yDom: [number, number] = [Math.max(0, nd.domain[0]), nd.domain[1]];
  const top: PanelSpec = {
    id: 'top',
    x: 'rdPct',
    xDomain: dom(X.rdPct),
    y: 'price',
    yDomain: yDom,
    yStep: nd.step,
    points: topPts,
    at: [p.rdPct, n.pricePips],
    slope: n.rhoDPips,
    tangent: tangentFor(p.rdPct, n.pricePips, n.rhoDPips, dom(X.rdPct), yDom),
    refs: inside(p.rfPct, X.rdPct) ? [{ x: p.rfPct, kind: 'equalRates' }] : [],
    payoff: null,
    ghost: null,
    peak: null,
  };
  const bottom: PanelSpec = {
    id: 'bottom',
    x: 'rfPct',
    xDomain: dom(X.rfPct),
    y: 'price',
    yDomain: yDom,
    yStep: nd.step,
    points: botPts,
    at: [p.rfPct, n.pricePips],
    slope: n.rhoFPips,
    tangent: tangentFor(p.rfPct, n.pricePips, n.rhoFPips, dom(X.rfPct), yDom),
    refs: inside(p.rdPct, X.rfPct) ? [{ x: p.rdPct, kind: 'equalRates' }] : [],
    payoff: null,
    ghost: null,
    peak: null,
  };
  return [top, bottom];
}

const inside = (x: number, d: readonly [number, number]) =>
  x >= Math.min(d[0], d[1]) && x <= Math.max(d[0], d[1]);

/* ---------- Annotation ("aha") ---------- */

export type AhaKey =
  | 'gammaPeak'
  | 'deltaHigh'
  | 'deltaLow'
  | 'vegaPeak'
  | 'thetaAccel'
  | 'thetaPositive'
  | 'equalRates';

export interface Aha {
  key: AhaKey;
  panel: PanelId;
}

/**
 * The one insight worth pointing at for the current configuration, or null. Shown next to the
 * dot (or the reference line) exactly when the learner reaches it.
 */
export function aha(mode: LabMode, p: LabParams, n = labNumbers(p)): Aha | null {
  const A = LAB_CONFIG.aha;
  const { T, vol, rd, rf } = inputs(p);
  if (mode === 'delta-gamma') {
    const gMax = greeks(gammaPeakSpot(p), K, T, vol, rd, rf, TYPE).gamma;
    if (n.gamma >= A.gammaPeakShare * gMax) return { key: 'gammaPeak', panel: 'bottom' };
    if (n.deltaFwd >= A.deltaHigh) return { key: 'deltaHigh', panel: 'bottom' };
    if (n.deltaFwd <= A.deltaLow) return { key: 'deltaLow', panel: 'bottom' };
    return null;
  }
  if (mode === 'vega') {
    const vMax = (greeks(vegaPeakSpot(p), K, T, vol, rd, rf, TYPE).vega / 100) * N;
    return n.vegaChf >= A.vegaPeakShare * vMax ? { key: 'vegaPeak', panel: 'bottom' } : null;
  }
  if (mode === 'theta') {
    if (n.thetaDayChf > 0) return { key: 'thetaPositive', panel: 'bottom' };
    const gMax = greeks(gammaPeakSpot(p), K, T, vol, rd, rf, TYPE).gamma;
    if (p.weeks <= A.thetaAccelWeeks && n.gamma >= A.thetaAccelGammaShare * gMax)
      return { key: 'thetaAccel', panel: 'bottom' };
    return null;
  }
  return Math.abs(p.rdPct - p.rfPct) <= A.equalRatesPct ? { key: 'equalRates', panel: 'top' } : null;
}

/* ---------- Layout ---------- */

export interface LabLayout {
  width: number;
  compact: boolean;
  font: number;
  left: number;
  right: number;
  top: { height: number; plotTop: number; plotBottom: number };
  bottom: { height: number; plotTop: number; plotBottom: number };
}

/** Height ratios of the prototype (640 × 250 and 640 × 200) and phone minimums. */
export const CHART_RATIO = { top: 250 / 640, bottom: 200 / 640 } as const;
export const CHART_MIN = { top: 210, bottom: 172 } as const;

/**
 * Layout for the measured width of the chart column. The SVG viewBox is 1:1 with CSS pixels,
 * so labels stay at 12 px on every screen (the prototype's 640-unit viewBox would shrink them).
 */
export function labLayout(width: number): LabLayout {
  const w = Math.max(260, Math.round(width));
  const compact = w < 480;
  const hTop = Math.max(CHART_MIN.top, Math.round(w * CHART_RATIO.top));
  const hBottom = Math.max(CHART_MIN.bottom, Math.round(w * CHART_RATIO.bottom));
  return {
    width: w,
    compact,
    font: 12,
    left: compact ? 44 : 48,
    right: 12,
    top: { height: hTop, plotTop: 14, plotBottom: hTop - 36 },
    bottom: { height: hBottom, plotTop: 12, plotBottom: hBottom - 32 },
  };
}

/** x ticks per axis (fewer on phones). Days are placed at whole months (365 · m / 12). */
export function xTicks(x: XKey, compact: boolean): number[] {
  switch (x) {
    case 'spot':
      return compact ? [0.76, 0.8, 0.84] : [0.76, 0.78, 0.8, 0.82, 0.84];
    case 'volPct':
      return compact ? [0, 8, 16] : [0, 4, 8, 12, 16, 20];
    case 'days':
      return (compact ? [12, 6, 0] : [12, 9, 6, 3, 0]).map((m) => (DAYS_PER_YEAR * m) / 12);
    case 'rdPct':
      return compact ? [0, 2, 4] : [-1, 0, 1, 2, 3, 4, 5];
    case 'rfPct':
      return compact ? [0, 2, 4, 6] : [0, 1, 2, 3, 4, 5, 6];
  }
}

/** Gridline values: multiples of `step` inside [a, b] (works while a tweened domain moves). */
export function yTicks(domain: [number, number], step: number): number[] {
  const a = Math.min(domain[0], domain[1]);
  const b = Math.max(domain[0], domain[1]);
  if (!(step > 0)) return [];
  const out: number[] = [];
  for (let k = Math.ceil(a / step - 1e-6); k * step <= b + step * 1e-6; k++)
    out.push(round(k * step));
  return out;
}

/** Weeks label kind for the maturity slider ("1 Woche", "13 Wochen (3M)", "1 Jahr", "n Wochen"). */
export function weeksLabel(weeks: number): 'one' | 'threeMonths' | 'year' | 'n' {
  if (weeks === 1) return 'one';
  if (weeks === 13) return 'threeMonths';
  if (weeks === 52) return 'year';
  return 'n';
}

/** Decimals for a percent value on a 0.25 grid: 3 → 0, 3.5 → 1, 3.25 → 2. */
export function pctDigits(v: number): number {
  if (Math.abs(v - Math.round(v)) < 1e-9) return 0;
  if (Math.abs(v * 2 - Math.round(v * 2)) < 1e-9) return 1;
  return 2;
}

/* ---------- Callout placement ---------- */

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Places a callout box of size w × h next to an anchor (the dot) so that it covers as few
 * obstacle points (curve, tangent) as possible and stays inside the plot. Pixel units.
 * Candidates: right/left × below/above the anchor, `gap` away from it.
 */
export function placeCallout(
  anchor: Point,
  size: { w: number; h: number },
  plot: { x0: number; x1: number; y0: number; y1: number },
  obstacles: Point[],
  gap = 12,
): Box {
  const [ax, ay] = anchor;
  const { w, h } = size;
  const candidates: Box[] = [
    { x: ax + gap, y: ay + gap, w, h },
    { x: ax + gap, y: ay - gap - h, w, h },
    { x: ax - gap - w, y: ay + gap, w, h },
    { x: ax - gap - w, y: ay - gap - h, w, h },
  ];
  let best = candidates[0]!;
  let bestScore = Infinity;
  candidates.forEach((b, i) => {
    const overflow =
      Math.max(0, plot.x0 - b.x) +
      Math.max(0, b.x + b.w - plot.x1) +
      Math.max(0, plot.y0 - b.y) +
      Math.max(0, b.y + b.h - plot.y1);
    let hits = 0;
    for (const [px, py] of obstacles) {
      if (px >= b.x - 4 && px <= b.x + b.w + 4 && py >= b.y - 4 && py <= b.y + b.h + 4) hits++;
    }
    const score = overflow * 10 + hits * 4 + i * 0.5;
    if (score < bestScore) {
      bestScore = score;
      best = b;
    }
  });
  // keep it inside the plot even if every candidate overflowed
  const x = Math.min(Math.max(best.x, plot.x0), Math.max(plot.x0, plot.x1 - w));
  const y = Math.min(Math.max(best.y, plot.y0), Math.max(plot.y0, plot.y1 - h));
  return { x, y, w, h };
}
