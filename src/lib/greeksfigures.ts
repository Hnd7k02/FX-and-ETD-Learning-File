/**
 * Pure logic for the two smaller figures of module 05 (no DOM):
 *
 * 1. Five levers (section 1): how the premium of the importer's USD call changes when exactly
 *    one market input moves (spot, time, vol, CHF rate, USD rate), exact repricing next to the
 *    Greek's own estimate.
 * 2. Gamma against theta (section 4): one-day P&L of the delta-hedged call,
 *    ½ · Γ · [(ΔS)² − σ² · S² · Δt], with its break-even move σ · S / √365.
 *
 * All maths via the calculation core (src/lib/fx). Money in CHF on the USD 1 Mio. notional.
 */
import { niceStep, sample, type Point } from '@/lib/chart';
import { EXAMPLE, EXAMPLE_STRIKE } from '@/lib/fx/example';
import {
  DAY,
  PIP,
  breakEvenMove,
  deltaGammaPnl,
  greeks,
  thetaGammaShare,
} from '@/lib/fx/greeks';
import { gkPrice } from '@/lib/fx/vanilla';

const { spot: S0, T: T0, vol: V0, rd: RD0, rf: RF0, notional: N } = EXAMPLE;
const K = EXAMPLE_STRIKE;

/* ================= 1. Five levers ================= */

export type LeverKey = 'spot' | 'time' | 'vol' | 'rd' | 'rf';
/** Direction of a lever (time only moves forward: how long it runs). */
export type LeverChoice = 'down' | 'up' | 'day' | 'week' | 'month';

/** One configurable place for the steps of the levers (D-22). */
export const LEVER_CONFIG = {
  order: ['spot', 'time', 'vol', 'rd', 'rf'] as LeverKey[],
  /** One big figure. */
  spotStep: 100 * PIP,
  /** One vol point. */
  volStep: 0.01,
  /** One percentage point. */
  rateStep: 0.01,
  /** Calendar days for the time lever (a month = 365 / 12 days, T = days / 365). */
  days: { day: 1, week: 7, month: 365 / 12 },
  choices: {
    spot: ['down', 'up'],
    time: ['day', 'week', 'month'],
    vol: ['down', 'up'],
    rd: ['down', 'up'],
    rf: ['down', 'up'],
  } as Record<LeverKey, LeverChoice[]>,
  defaults: { spot: 'up', time: 'month', vol: 'up', rd: 'up', rf: 'up' } as Record<
    LeverKey,
    LeverChoice
  >,
  /** Fixed CHF axis of the bars, so the levers stay comparable. */
  axisChf: 6000,
} as const;

export interface LeverEffect {
  /** Exact change of the premium (full repricing), CHF on the notional. */
  exact: number;
  /** Estimate from the lever's Greek (spot: delta plus gamma), CHF on the notional. */
  estimate: number;
  /** New premium, CHF. */
  price: number;
}

const base = () => gkPrice(S0, K, T0, V0, RD0, RF0, 'call');

/** Premium of the example call today, CHF on the notional. */
export const basePremiumChf = (): number => base() * N;

/** Exact and Greek-estimated change of the premium when one lever moves alone. */
export function leverEffect(key: LeverKey, choice: LeverChoice): LeverEffect {
  const C = LEVER_CONFIG;
  const g = greeks(S0, K, T0, V0, RD0, RF0, 'call');
  const sign = choice === 'down' ? -1 : 1;
  let price: number;
  let estimate: number;
  switch (key) {
    case 'spot': {
      const dS = sign * C.spotStep;
      price = gkPrice(S0 + dS, K, T0, V0, RD0, RF0, 'call');
      estimate = g.delta * dS + 0.5 * g.gamma * dS * dS;
      break;
    }
    case 'time': {
      const d = choice === 'day' ? C.days.day : choice === 'week' ? C.days.week : C.days.month;
      price = gkPrice(S0, K, Math.max(0, T0 - d * DAY), V0, RD0, RF0, 'call');
      estimate = g.thetaDay * d;
      break;
    }
    case 'vol': {
      const dv = sign * C.volStep;
      price = gkPrice(S0, K, T0, V0 + dv, RD0, RF0, 'call');
      estimate = g.vega * dv;
      break;
    }
    case 'rd': {
      const dr = sign * C.rateStep;
      price = gkPrice(S0, K, T0, V0, RD0 + dr, RF0, 'call');
      estimate = g.rhoD * dr;
      break;
    }
    case 'rf': {
      const dr = sign * C.rateStep;
      price = gkPrice(S0, K, T0, V0, RD0, RF0 + dr, 'call');
      estimate = g.rhoF * dr;
      break;
    }
  }
  return { exact: (price - base()) * N, estimate: estimate * N, price: price * N };
}

/** Forward after the lever moved (the channel through which spot and both rates act). */
export function leverForward(key: LeverKey, choice: LeverChoice): number {
  const sign = choice === 'down' ? -1 : 1;
  const C = LEVER_CONFIG;
  const s = key === 'spot' ? S0 + sign * C.spotStep : S0;
  const rd = key === 'rd' ? RD0 + sign * C.rateStep : RD0;
  const rf = key === 'rf' ? RF0 + sign * C.rateStep : RF0;
  const T =
    key === 'time'
      ? Math.max(0, T0 - (choice === 'day' ? 1 : choice === 'week' ? 7 : 365 / 12) * DAY)
      : T0;
  return s * Math.exp((rd - rf) * T);
}

/* ================= 2. Gamma against theta ================= */

export const GT_CONFIG = {
  /** Slider for the move over one day, in pips. */
  move: { min: -100, max: 100, step: 1 },
  vol: { min: 4, max: 16, step: 0.5 },
  defaults: { movePips: 0, volPct: EXAMPLE.vol * 100 },
  samples: 160,
} as const;

export interface GammaThetaNumbers {
  gamma: number;
  /** ½ · Γ · (ΔS)² · N: what the hedged call earns from the move. */
  gammaGainChf: number;
  /** Θ_Γ · N: the gamma share of theta, the daily cost of the gamma (negative). */
  thetaGammaChf: number;
  /** Net one-day P&L ½ · Γ · [(ΔS)² − σ²S²Δt] · N. */
  pnlChf: number;
  /** Break-even move σ · S / √365, in pips. */
  breakEvenPips: number;
  /** The move as an annualised realised vol: |ΔS| / S · √365. */
  realisedVol: number;
}

/** P&L of the delta-hedged example call over one day for a move of `movePips` at vol `volPct`. */
export function gammaTheta(movePips: number, volPct: number): GammaThetaNumbers {
  const vol = volPct / 100;
  const g = greeks(S0, K, T0, vol, RD0, RF0, 'call').gamma;
  const dS = movePips * PIP;
  const pnl = deltaGammaPnl(g, S0, vol, dS, DAY);
  const theta = thetaGammaShare(S0, vol, g);
  return {
    gamma: g,
    gammaGainChf: 0.5 * g * dS * dS * N,
    thetaGammaChf: theta * N,
    pnlChf: pnl * N,
    breakEvenPips: breakEvenMove(S0, vol) / PIP,
    realisedVol: (Math.abs(dS) / S0) * Math.sqrt(1 / DAY),
  };
}

/** The P&L parabola over the move axis (pips → CHF). */
export function gammaThetaCurve(volPct: number): Point[] {
  const M = GT_CONFIG.move;
  return sample((m) => gammaTheta(m, volPct).pnlChf, M.min, M.max, GT_CONFIG.samples);
}

/** y domain for the parabola: from below the theta cost to above the largest gain. */
export function gammaThetaDomain(volPct: number): { domain: [number, number]; step: number } {
  const M = GT_CONFIG.move;
  const hi = gammaTheta(M.max, volPct).pnlChf;
  const lo = gammaTheta(0, volPct).pnlChf;
  const step = niceStep(hi - lo, 4);
  // Below zero only the theta cost has to fit: a little headroom, not a whole grid step.
  return { domain: [-niceStep(Math.abs(lo) * 1.25, 1), Math.ceil(hi / step) * step], step };
}

export type GammaThetaZone = 'flat' | 'loss' | 'breakEven' | 'gain';

/** Where the move sits relative to the break-even (±0.5 pip counts as "at break-even"). */
export function gammaThetaZone(movePips: number, volPct: number): GammaThetaZone {
  const be = gammaTheta(0, volPct).breakEvenPips;
  const m = Math.abs(movePips);
  if (m === 0) return 'flat';
  if (Math.abs(m - be) <= 0.5) return 'breakEven';
  return m < be ? 'loss' : 'gain';
}
