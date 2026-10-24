/**
 * Wow moment (MASTER_PROMPT §8.1): pure chart maths for the four phases
 * Forward → Call → time value → put-call parity. No DOM.
 *
 * All curves are drawn on the same axes: x = USD/CHF (at expiry, in phase 3 the forward today),
 * y = profit or value in pips, strike = forward of the running example. Values in pips come from
 * the calculation core (`@/lib/fx`), the layout maps them to SVG units 1:1 in CSS pixels.
 */
import {
  areaPath,
  clamp,
  easeInOutCubic,
  linePath,
  sample,
  scaleLinear,
  type Point,
  type Scale,
} from '@/lib/chart';
import { EXAMPLE, EXAMPLE_FORWARD, EXAMPLE_STRIKE } from '@/lib/fx/example';
import { black76, payoff } from '@/lib/fx/vanilla';
import { pipSize, toPips } from '@/lib/format';

/** Phase index: 0 forward, 1 call at expiry, 2 before expiry (time value), 3 parity. */
export type Phase = 0 | 1 | 2 | 3;
export const PHASES: readonly Phase[] = [0, 1, 2, 3];

/** Autoplay duration per phase in ms (phase 3 runs the clock, so it is longer). */
export const PHASE_MS: readonly number[] = [5200, 5200, 6400, 5200];
/** Curve morph between phases, easeInOutCubic. */
export const MORPH_MS = 900;
/** Phase 3: the clock starts after the morph and runs 365 days → T of the example. */
export const CLOCK_DELAY_MS = MORPH_MS;
export const CLOCK_MS = 3200;
export const DAYS_MAX = 365;
/** Target of the clock: T = 0.25 → 91.25 days ("3 Monate"). */
export const DAYS_TARGET = EXAMPLE.T * DAYS_MAX;

export const STRIKE = EXAMPLE_STRIKE;
export const VOL = EXAMPLE.vol;
export const PIP = pipSize(EXAMPLE.pair);

/** x domain: strike ± 0.08 (as in the prototype: 0.713 … 0.873). */
export const X_DOMAIN: readonly [number, number] = [STRIKE - 0.08, STRIKE + 0.08];
/** y domain in pips. */
export const Y_DOMAIN: readonly [number, number] = [-800, 800];
export const SAMPLES = 120;

/** Time to expiry in years from calendar days (option model: T = days / 365). */
export const daysToT = (days: number): number => days / DAYS_MAX;

/** Rounded forward points of the example (≈ 70 pips below spot), for the caption. */
export const forwardPointsRounded = (): number =>
  Math.round(Math.abs(toPips(EXAMPLE_FORWARD - EXAMPLE.spot, EXAMPLE.pair)));

/** Value of a curve in pips at spot/forward S. */
export function curvePips(phase: Phase, S: number, T: number): number {
  if (phase === 0 || phase === 3) return (S - STRIKE) / PIP;
  if (phase === 1) return payoff(S, STRIKE, 'call') / PIP;
  return black76(S, STRIKE, T, VOL, 'call') / PIP;
}

/** Short put payoff in pips (phase 4): −max(K − S, 0). */
export const shortPutPips = (S: number): number => -payoff(S, STRIKE, 'put') / PIP;

/** Undiscounted Black-76 time value at the strike (ATMF), in pips. */
export const timeValuePips = (T: number): number => black76(STRIKE, STRIKE, T, VOL, 'call') / PIP;

/** Pointwise morph between the previous and the current phase, e = eased progress 0..1. */
export const morphPips =
  (prev: Phase, phase: Phase, e: number, T: number) =>
  (S: number): number =>
    curvePips(prev, S, T) * (1 - e) + curvePips(phase, S, T) * e;

/** Opacity weights of the comparison layers: fade out with the old phase, in with the new one. */
export function phaseWeights(prev: Phase, phase: Phase, e: number) {
  const w = (ph: Phase) => (phase === ph ? e : 0) + (prev === ph && phase !== ph ? 1 - e : 0);
  return { ghost: w(1) * 0.45, timeValue: w(2), parity: w(3) };
}

/** Days on the clock at `elapsed` ms into phase 3: 365 → DAYS_TARGET, easeInOutCubic. */
export function clockDays(elapsed: number): number {
  const k = clamp((elapsed - CLOCK_DELAY_MS) / CLOCK_MS, 0, 1);
  return DAYS_MAX - (DAYS_MAX - DAYS_TARGET) * easeInOutCubic(k);
}

export type DaysLabel = 'expiry' | 'year' | 'months3' | 'days';

/** Which label the slider value gets: "Verfall", "1 Jahr", "3 Monate" or "n Tage". */
export function daysLabelKind(days: number): DaysLabel {
  if (days <= 0) return 'expiry';
  if (days >= DAYS_MAX) return 'year';
  if (Math.abs(days - DAYS_TARGET) < 0.5) return 'months3';
  return 'days';
}

/* ---------- Layout ---------- */

export interface WowLayout {
  width: number;
  height: number;
  left: number;
  right: number;
  top: number;
  bottom: number;
  /** Axis label size in px. */
  font: number;
  /** Time value marker size in px. */
  fontBig: number;
  /** Main curve stroke width. */
  stroke: number;
  /** Phone layout: fewer x ticks, two-line strike label. */
  compact: boolean;
  /** x tick step. */
  xStep: number;
}

/** Chart height for a width: the prototype ratio 410/1000, never below MIN_HEIGHT on phones. */
export const HEIGHT_RATIO = 0.41;
export const MIN_HEIGHT = 260;
export const chartHeight = (width: number): number =>
  Math.max(MIN_HEIGHT, Math.round(width * HEIGHT_RATIO));

/**
 * Layout for a container width in CSS px. The SVG viewBox is 1:1 with CSS pixels, so text
 * stays readable at every width (prototype: 1000 × 410 with 13 px labels at 1000 px width).
 */
export function layoutFor(width: number): WowLayout {
  const w = Math.max(280, Math.round(width));
  if (w >= 640) {
    return {
      width: w,
      height: chartHeight(w),
      left: 64,
      right: 24,
      top: 24,
      bottom: 38,
      font: 13,
      fontBig: 16,
      stroke: 3.5,
      compact: false,
      xStep: 0.02,
    };
  }
  return {
    width: w,
    height: chartHeight(w),
    left: 46,
    right: 14,
    top: 22,
    bottom: 34,
    font: 12,
    fontBig: 14,
    stroke: 3,
    compact: true,
    xStep: 0.04,
  };
}

export interface WowScales {
  x: Scale;
  y: Scale;
  /** Plot rectangle in SVG units. */
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

export function scalesFor(l: WowLayout): WowScales {
  const x0 = l.left;
  const x1 = l.width - l.right;
  const y0 = l.top;
  const y1 = l.height - l.bottom;
  return {
    x: scaleLinear([X_DOMAIN[0], X_DOMAIN[1]], [x0, x1]),
    y: scaleLinear([Y_DOMAIN[1], Y_DOMAIN[0]], [y0, y1]),
    x0,
    x1,
    y0,
    y1,
  };
}

/** x ticks: 0.72, 0.74 … (step from the layout), rounded to 2 decimals. */
export function xTicks(l: WowLayout): number[] {
  const out: number[] = [];
  const start = Math.ceil(X_DOMAIN[0] / l.xStep - 1e-9) * l.xStep;
  for (let v = start; v <= X_DOMAIN[1] + 1e-9; v += l.xStep) out.push(Number(v.toFixed(2)));
  return out;
}

/** y ticks: +800, +400, 0, −400, −800. */
export const yTicks = (): number[] => [800, 400, 0, -400, -800];

/** Samples a pips curve over the x domain and projects it, clamping y to the domain. */
export function curvePoints(fn: (S: number) => number, sc: WowScales): Point[] {
  return sample(fn, X_DOMAIN[0], X_DOMAIN[1], SAMPLES).map(([S, p]) => [
    sc.x(S),
    sc.y(clamp(p, Y_DOMAIN[0], Y_DOMAIN[1])),
  ]);
}

export interface WowFrame {
  /** Main (morphing) curve. */
  main: string;
  /** Main curve colour key: blue in phases 2 and 3, black otherwise. */
  mainBlue: boolean;
  /** Forward ghost (phase 2) and dashed payoff (phase 3). */
  ghost: string;
  pay: string;
  /** Time value area between Black-76 value and payoff. */
  area: string;
  /** Parity layers. */
  longCall: string;
  shortPut: string;
  /** Time value marker at the strike. */
  strikeX: number;
  zeroY: number;
  tvY: number;
  tvPips: number;
  weights: { ghost: number; timeValue: number; parity: number };
}

/** Everything the SVG needs for one animation frame. */
export function frame(prev: Phase, phase: Phase, e: number, T: number, sc: WowScales): WowFrame {
  const main = curvePoints(morphPips(prev, phase, e, T), sc);
  const value = curvePoints((S) => curvePips(2, S, T), sc);
  const pay = curvePoints((S) => curvePips(1, S, T), sc);
  const tv = timeValuePips(T);
  return {
    main: linePath(main),
    mainBlue: phase === 1 || phase === 2,
    ghost: linePath(curvePoints((S) => curvePips(0, S, T), sc)),
    pay: linePath(pay),
    area: areaPath(value, pay),
    longCall: linePath(pay),
    shortPut: linePath(curvePoints(shortPutPips, sc)),
    strikeX: sc.x(STRIKE),
    zeroY: sc.y(0),
    tvY: sc.y(clamp(tv, Y_DOMAIN[0], Y_DOMAIN[1])),
    tvPips: tv,
    weights: phaseWeights(prev, phase, e),
  };
}
