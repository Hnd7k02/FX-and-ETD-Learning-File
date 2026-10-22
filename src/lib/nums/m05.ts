/**
 * Numbers of module 05 (Greeks) for <Num of="m05.…" />, all computed from the running example
 * with the formulas of the Garman-Kohlhagen model (normal.ts, vanilla.ts). Nothing is typed in.
 *
 * Call, S = 0.80, K = ATMF, T = 0.25, σ = 8 %, rd = 0, rf = 3.5 %:
 *   Δ   = e^(−rf T) · N(d1)
 *   Γ   = e^(−rf T) · φ(d1) / (S · σ · √T)
 *   ν   = S · e^(−rf T) · φ(d1) · √T              (per 1.00 vol; shown per vol point)
 *   ρ_d = K · T · e^(−rd T) · N(d2), ρ_f = −S · T · e^(−rf T) · N(d1)   (per 1.00; shown per 1 %)
 *   Θ_Γ = −½ · σ² · S² · Γ / 365                  (gamma share of theta per calendar day)
 *   Θ   = V(T − 1/365) − V(T)                     (one-day difference, the number the lab shows)
 *   break-even move of a delta-hedged call = σ · S / √365
 */
import { EXAMPLE as E, EXAMPLE_STRIKE as K } from '@/lib/fx/example';
import { normCdf, normPdf } from '@/lib/fx/normal';
import { d1d2, gkPrice } from '@/lib/fx/vanilla';
import { pipSize } from '@/lib/format';
import type { NumTable } from './types';

const { spot: S, T, vol, rd, rf, notional: N } = E;
const PIP = pipSize(E.pair);
/** One big figure of USD/CHF: 100 pips. */
const BIG_FIGURE = 100 * PIP;
const DAY = 1 / 365;

const { d1, d2 } = d1d2(S, K, T, vol, rd, rf);
const dff = Math.exp(-rf * T);
const dfd = Math.exp(-rd * T);
const phi = normPdf(d1);
const sqrtT = Math.sqrt(T);

const deltaAt = (s: number) => dff * normCdf(d1d2(s, K, T, vol, rd, rf).d1);
const priceAt = (t: number) => gkPrice(S, K, t, vol, rd, rf, 'call');

const delta = deltaAt(S);
const gamma = (dff * phi) / (S * vol * sqrtT);
const deltaUp = deltaAt(S + BIG_FIGURE);
const gammaNumeric = (deltaAt(S + PIP) - deltaAt(S - PIP)) / (2 * PIP);
const vegaPoint = S * dff * phi * sqrtT * 0.01;
const rhoDomestic = K * T * dfd * normCdf(d2) * 0.01;
const rhoForeign = -S * T * dff * normCdf(d1) * 0.01;
const thetaGammaDay = (-0.5 * vol * vol * S * S * gamma) / 365;
const thetaOneDay = priceAt(T - DAY) - priceAt(T);
const thetaCarryDay = (rf * S * dff * normCdf(d1) - rd * K * dfd * normCdf(d2)) / 365;
const breakEven = (vol * S) / Math.sqrt(365);

/** Raw values (quote currency per 1 USD unless noted) for quiz files and tests. */
export const M05 = {
  d1,
  d2,
  dff,
  phi,
  sqrtT,
  delta,
  deltaUp,
  deltaChangeApprox: gamma * BIG_FIGURE,
  deltaChangeActual: deltaUp - delta,
  gamma,
  gammaNumeric,
  /** CHF per vol point on the notional. */
  vegaPointChf: vegaPoint * N,
  /** CHF per +1 % CHF rate on the notional. */
  rhoDomesticChf: rhoDomestic * N,
  /** CHF per +1 % USD rate on the notional. */
  rhoForeignChf: rhoForeign * N,
  /** CHF per calendar day on the notional. */
  thetaGammaDayChf: thetaGammaDay * N,
  thetaCarryDayChf: thetaCarryDay * N,
  thetaOneDayChf: thetaOneDay * N,
  breakEvenPips: breakEven / PIP,
  /** CHF for a 10-pip move, delta only. */
  deltaPnl10PipsChf: delta * 10 * PIP * N,
  bigFigure: BIG_FIGURE,
  callChf: priceAt(T) * N,
} as const;

export const nums: NumTable = {
  'm05.T': { value: T, kind: 'num', digits: 2, note: 'T in years' },
  'm05.sqrtT': { value: sqrtT, kind: 'num', digits: 1, note: '√T' },
  'm05.volFrac': { value: vol, kind: 'num', digits: 2, note: 'σ as a fraction' },
  'm05.d1': { value: d1, kind: 'num', digits: 3 },
  'm05.nd1': { value: normCdf(d1), kind: 'num', digits: 3, note: 'N(d1)' },
  'm05.dff': { value: dff, kind: 'num', digits: 4, note: 'e^(−rf T)' },
  'm05.phiD1': { value: phi, kind: 'num', digits: 4, note: 'φ(d1)' },
  'm05.delta': { value: delta, kind: 'num', digits: 3, note: 'spot delta of the call' },
  'm05.deltaUp': { value: deltaUp, kind: 'num', digits: 2, note: 'delta at S + 1 big figure' },
  'm05.deltaChangeApprox': {
    value: M05.deltaChangeApprox,
    kind: 'num',
    digits: 3,
    sign: true,
    note: 'Γ · 0.01',
  },
  'm05.deltaChangeActual': {
    value: M05.deltaChangeActual,
    kind: 'num',
    digits: 3,
    sign: true,
    note: 'Δ(S + 0.01) − Δ(S)',
  },
  'm05.gamma': { value: gamma, kind: 'num', digits: 2 },
  'm05.gammaNumeric': { value: gammaNumeric, kind: 'num', digits: 2, note: 'central difference' },
  'm05.vegaPoint': { value: M05.vegaPointChf, kind: 'money', note: 'CHF per vol point' },
  'm05.rhoDomestic': { value: M05.rhoDomesticChf, kind: 'money', sign: true },
  'm05.rhoForeign': { value: M05.rhoForeignChf, kind: 'money', sign: true },
  'm05.thetaGammaDay': { value: M05.thetaGammaDayChf, kind: 'money', note: 'Θ_Γ per day' },
  'm05.thetaCarryDay': { value: M05.thetaCarryDayChf, kind: 'money', sign: true },
  'm05.thetaDay': { value: M05.thetaOneDayChf, kind: 'money', note: 'one-day difference' },
  'm05.breakEvenPips': { value: M05.breakEvenPips, kind: 'pips' },
  'm05.deltaPnl10Pips': { value: M05.deltaPnl10PipsChf, kind: 'money' },
  'm05.callChf': { value: M05.callChf, kind: 'money' },
};
