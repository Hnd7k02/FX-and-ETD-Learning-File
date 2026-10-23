/**
 * Numbers of module 05 (Greeks) for <Num of="m05.…" />, all computed from the running example
 * with the calculation core (src/lib/fx). Nothing is typed in.
 *
 * Call, S = 0.80, K = ATMF, T = 0.25, σ = 8 %, rd = 0, rf = 3.5 %:
 *   Δ   = e^(−rf T) · N(d1)
 *   Γ   = e^(−rf T) · φ(d1) / (S · σ · √T)
 *   ν   = S · e^(−rf T) · φ(d1) · √T              (per 1.00 vol; shown per vol point)
 *   ρ_d = K · T · e^(−rd T) · N(d2), ρ_f = −S · T · e^(−rf T) · N(d1)   (per 1.00; shown per 1 %)
 *   Θ_Γ = −½ · σ² · S² · Γ / 365                  (gamma share of theta per calendar day)
 *   Θ   = V(T − 1/365) − V(T)                     (one-day difference, the number the lab shows)
 *   break-even move of a delta-hedged call = σ · S / √365
 *
 * Theta split (DECISIONS D-26): the lab theta = gamma share + carry. The carry shown in the
 * texts is the lab theta minus the gamma share *after rounding both to the digits shown*, so
 * the three numbers on screen always add up (e.g. −69 + 38 = −31). The analytic carry term
 * (rf · S · e^(−rf T) · N(d1) − rd · K · e^(−rd T) · N(d2)) / 365 is registered separately for
 * the derivation; it differs from the one-day carry by the curvature of a whole day.
 */
import { EXAMPLE as E, EXAMPLE_STRIKE as K } from '@/lib/fx/example';
import { normCdf, normPdf } from '@/lib/fx/normal';
import { d1d2, gkPrice } from '@/lib/fx/vanilla';
import { greeks, numericGreeks, premiumAdjustedDelta, vannaVolga } from '@/lib/fx/greeks';
import { pipSize } from '@/lib/format';
import { gammaTheta, leverEffect } from '@/lib/greeksfigures';
import { LAB_CONFIG, gammaPeakSpot, vegaPeakSpot } from '@/lib/greekslab';
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
const F = S * Math.exp((rd - rf) * T);

const deltaAt = (s: number) => dff * normCdf(d1d2(s, K, T, vol, rd, rf).d1);
const priceAt = (t: number) => gkPrice(S, K, t, vol, rd, rf, 'call');
const g = greeks(S, K, T, vol, rd, rf, 'call');
const num = numericGreeks(S, K, T, vol, rd, rf, 'call');

const delta = deltaAt(S);
const gamma = (dff * phi) / (S * vol * sqrtT);
const deltaUp = deltaAt(S + BIG_FIGURE);
const gammaNumeric = (deltaAt(S + PIP) - deltaAt(S - PIP)) / (2 * PIP);
const vegaRaw = S * dff * phi * sqrtT;
const vegaPoint = vegaRaw * 0.01;
const rhoDomestic = K * T * dfd * normCdf(d2) * 0.01;
const rhoForeign = -S * T * dff * normCdf(d1) * 0.01;
const thetaGammaDay = (-0.5 * vol * vol * S * S * gamma) / 365;
const thetaOneDay = priceAt(T - DAY) - priceAt(T);
const thetaCarryAnalyticDay = (rf * S * dff * normCdf(d1) - rd * K * dfd * normCdf(d2)) / 365;
const breakEven = (vol * S) / Math.sqrt(365);

/** Rounds like the number formatter does (half away from zero is irrelevant here). */
const roundTo = (x: number, digits: number) => Number(x.toFixed(digits));
const thetaOneDayChf = thetaOneDay * N;
const thetaGammaDayChf = thetaGammaDay * N;

/** The same call with one input changed (scenarios in the texts). */
const SPOT_OTM = S - 2 * BIG_FIGURE;
const vv = vannaVolga(S, K, T, vol, rd, rf);
const vvOtm = vannaVolga(SPOT_OTM, K, T, vol, rd, rf);
const F1y = S * Math.exp((rd - rf) * 1);
const callVolUp = gkPrice(S, K, T, vol + 0.01, rd, rf, 'call');
const spotUp = leverEffect('spot', 'up');
const month = leverEffect('time', 'month');

/**
 * Where gamma peaks (section 2): over spot, ∂Γ/∂S = −(Γ/S) · [d1/(σ√T) + 1] = 0 gives
 * d1 = −σ√T, i.e. F = K · e^(−1.5σ²T), slightly left of ATMF. For comparison the spot where
 * d1 = 0 (F = K · e^(−σ²T/2)), which is the peak across strikes. Vega peaks across spot at
 * d1 = +σ√T (d2 = 0), see vegaPeakSpot.
 */
const gammaAt = (s: number) => greeks(s, K, T, vol, rd, rf, 'call').gamma;
const gammaPeakS = gammaPeakSpot(LAB_CONFIG.defaults);
const spotD1Zero = K * Math.exp((rf - rd) * T - 0.5 * vol * vol * T);

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
  thetaGammaDayChf,
  /** Carry part of the lab theta as shown with whole francs (see the note above). */
  thetaCarryDayChf: roundTo(thetaOneDayChf, 0) - roundTo(thetaGammaDayChf, 0),
  thetaOneDayChf,
  breakEvenPips: breakEven / PIP,
  /** CHF for a 10-pip move, delta only. */
  deltaPnl10PipsChf: delta * 10 * PIP * N,
  bigFigure: BIG_FIGURE,
  /** CHF for +1 big figure: delta only, delta + ½ gamma, exact repricing. */
  spotUpDeltaChf: delta * BIG_FIGURE * N,
  spotUpDeltaGammaChf: spotUp.estimate,
  spotUpChf: spotUp.exact,
  callChf: priceAt(T) * N,
  /** Hedged one-day P&L for a 20-pip and a 50-pip move (CHF). */
  pnl20Chf: gammaTheta(20, vol * 100).pnlChf,
  pnl50Chf: gammaTheta(50, vol * 100).pnlChf,
  /** CHF per +1 % on both rates together: −T · V. */
  rhoSumChf: (rhoDomestic + rhoForeign) * N,
  /** Spot below which the levers figure shows "far out of the money" (S − 2 big figures). */
  spotOtm: SPOT_OTM,
  vegaOtmChf: (greeks(SPOT_OTM, K, T, vol, rd, rf, 'call').vega / 100) * N,
  /** Spot delta deep in the money: e^(−rf T), the spot delta of a forward (forward delta → 1). */
  spotDeltaLimit: dff,
  /** Spot where gamma peaks (d1 = −σ√T) and gamma there. */
  gammaPeakSpot: gammaPeakS,
  gammaPeak: gammaAt(gammaPeakS),
  /** Strike minus forward at the gamma peak, in pips (positive: forward below the strike). */
  gammaPeakFwdPips: (K - gammaPeakS * Math.exp((rd - rf) * T)) / PIP,
  /**
   * Spot where d1 = 0 (right of the gamma peak) and gamma there (a little below its peak value).
   */
  spotD1Zero,
  gammaD1Zero: gammaAt(spotD1Zero),
} as const;

export const nums: NumTable = {
  'm05.T': { value: T, kind: 'num', digits: 2, note: 'T in years' },
  'm05.sqrtT': { value: sqrtT, kind: 'num', digits: 1, note: '√T' },
  'm05.volFrac': { value: vol, kind: 'num', digits: 2, note: 'σ as a fraction' },
  'm05.d1': { value: d1, kind: 'num', digits: 3 },
  'm05.d2': { value: d2, kind: 'num', digits: 3 },
  'm05.nd1': { value: normCdf(d1), kind: 'num', digits: 3, note: 'N(d1)' },
  'm05.nd2': { value: normCdf(d2), kind: 'num', digits: 3, note: 'N(d2)' },
  'm05.dff': { value: dff, kind: 'num', digits: 4, note: 'e^(−rf T)' },
  'm05.phiD1': { value: phi, kind: 'num', digits: 4, note: 'φ(d1)' },
  'm05.forward': { value: F, kind: 'rate', note: 'continuous forward, 4 decimals' },

  // Section 1: five levers
  'm05.deltaUsd': {
    value: delta * N,
    kind: 'money',
    ccy: 'USD',
    note: 'spot delta × notional: the USD amount that behaves like a spot position',
  },
  'm05.spotUpChf': {
    value: spotUp.exact,
    kind: 'money',
    sign: true,
    note: 'exact premium change for spot +1 big figure',
  },
  'm05.spotUpDeltaChf': {
    value: M05.spotUpDeltaChf,
    kind: 'money',
    sign: true,
    note: 'delta-only estimate for +1 big figure',
  },
  'm05.spotUpDeltaGammaChf': {
    value: spotUp.estimate,
    kind: 'money',
    sign: true,
    note: 'delta + ½ gamma estimate for +1 big figure',
  },
  'm05.monthChf': {
    value: month.exact,
    kind: 'money',
    note: 'exact premium change over one month (365/12 days)',
  },
  'm05.monthThetaChf': {
    value: month.estimate,
    kind: 'money',
    note: 'analytic theta per day × 365/12',
  },

  // Section 2: delta and gamma
  'm05.delta': { value: delta, kind: 'num', digits: 3, note: 'spot delta of the call' },
  'm05.deltaFwd': { value: g.deltaFwd, kind: 'num', digits: 3, note: 'forward delta N(d1)' },
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
  'm05.spotDeltaLimit': {
    value: M05.spotDeltaLimit,
    kind: 'num',
    digits: 3,
    note: 'e^(−rf T): spot delta of the call deep in the money = spot delta of a forward',
  },
  'm05.gammaPeakSpot': {
    value: M05.gammaPeakSpot,
    kind: 'rate',
    note: 'spot where gamma (fixed strike) peaks: d1 = −σ√T',
  },
  'm05.gammaPeak': { value: M05.gammaPeak, kind: 'num', digits: 2, note: 'gamma at its peak' },
  'm05.gammaPeakFwdPips': {
    value: M05.gammaPeakFwdPips,
    kind: 'pips',
    digits: 0,
    note: 'strike minus forward at the gamma peak, in pips',
  },
  'm05.spotD1Zero': { value: M05.spotD1Zero, kind: 'rate', note: 'spot where d1 = 0' },
  'm05.gammaD1Zero': {
    value: M05.gammaD1Zero,
    kind: 'num',
    digits: 2,
    note: 'gamma at d1 = 0 (right of the peak), a little below its peak value',
  },
  'm05.deltaPnl10Pips': { value: M05.deltaPnl10PipsChf, kind: 'money' },
  'm05.callChf': { value: M05.callChf, kind: 'money' },

  // Section 3: vega
  'm05.vegaRaw': { value: vegaRaw, kind: 'num', digits: 4, note: 'ν per 1.00 vol' },
  'm05.vegaPoint': { value: M05.vegaPointChf, kind: 'money', note: 'CHF per vol point' },
  'm05.vegaPips': { value: vegaPoint / PIP, kind: 'pips', note: 'pips per vol point' },
  'm05.vegaNumeric': {
    value: (num.vega / 100) * N,
    kind: 'money',
    digits: 2,
    note: 'central difference, CHF per vol point',
  },
  'm05.volUp': { value: vol + 0.01, kind: 'pct', digits: 0, note: 'vol + 1 point' },
  'm05.callChfVolUp': { value: callVolUp * N, kind: 'money', note: 'premium at vol + 1 point' },
  'm05.callChfVegaApprox': {
    value: M05.callChf + M05.vegaPointChf,
    kind: 'money',
    note: 'premium + vega',
  },
  'm05.vegaAtmf1y': {
    value: (greeks(S, F1y, 1, vol, rd, rf, 'call').vega / 100) * N,
    kind: 'money',
    note: 'ATMF vega for 1 year (strike = 1Y forward), CHF per vol point',
  },
  'm05.vegaRatio1y': {
    value: greeks(S, F1y, 1, vol, rd, rf, 'call').vega / vegaRaw,
    kind: 'num',
    digits: 2,
    note: 'ATMF vega 1Y / 3M',
  },
  'm05.vegaPeakSpot': {
    value: vegaPeakSpot(LAB_CONFIG.defaults),
    kind: 'rate',
    note: 'spot where vega (fixed strike) peaks: d2 = 0',
  },
  'm05.vegaPeakSpot1y': {
    value: vegaPeakSpot({ ...LAB_CONFIG.defaults, weeks: 52 }),
    kind: 'rate',
    note: 'spot where vega (strike 0.7930) peaks with one year to expiry, as in the lab',
  },
  'm05.fwdPoints1y': {
    value: (F1y - S) / PIP,
    kind: 'pips',
    digits: 0,
    note: '1-year forward points (continuous), negative: the forward sits below spot',
  },
  'm05.spotOtm': { value: SPOT_OTM, kind: 'rate', note: 'spot two big figures lower' },
  'm05.fwdOtmPips': {
    value: (K - SPOT_OTM * Math.exp((rd - rf) * T)) / PIP,
    kind: 'pips',
    digits: 0,
    note: 'strike minus forward at the lower spot',
  },
  'm05.vegaOtm': { value: M05.vegaOtmChf, kind: 'money', note: 'vega at the lower spot' },

  // Section 4: theta
  'm05.thetaGammaDay': { value: thetaGammaDayChf, kind: 'money', note: 'Θ_Γ per day' },
  'm05.thetaCarryDay': {
    value: M05.thetaCarryDayChf,
    kind: 'money',
    sign: true,
    note: 'lab theta − Θ_Γ, both rounded to whole francs, so the shown numbers add up',
  },
  'm05.thetaCarryDay2': {
    value: roundTo(thetaOneDayChf, 2) - roundTo(thetaGammaDayChf, 2),
    kind: 'money',
    digits: 2,
    sign: true,
    note: 'lab theta − Θ_Γ, both rounded to cents, so the shown numbers add up',
  },
  'm05.thetaCarryAnalytic': {
    value: thetaCarryAnalyticDay * N,
    kind: 'money',
    digits: 2,
    sign: true,
    note: 'analytic carry term per day',
  },
  'm05.thetaDay': { value: thetaOneDayChf, kind: 'money', note: 'one-day difference' },
  'm05.thetaNumeric': {
    value: (num.theta / 365) * N,
    kind: 'money',
    digits: 2,
    note: 'central difference of V in T, per day',
  },
  'm05.breakEvenPips': { value: M05.breakEvenPips, kind: 'pips' },
  'm05.fwdDriftPips': {
    value: (F * (rf - rd)) / 365 / PIP,
    kind: 'pips',
    digits: 2,
    note: 'daily roll of the forward towards spot, F · (rf − rd) / 365, in pips',
  },
  'm05.pnl20': { value: M05.pnl20Chf, kind: 'money', sign: true, note: 'hedged P&L, 20-pip day' },
  'm05.pnl50': { value: M05.pnl50Chf, kind: 'money', sign: true, note: 'hedged P&L, 50-pip day' },

  // Section 4: rho
  'm05.fwdPerPct': {
    value: F * T * 0.01 * 1e4,
    kind: 'pips',
    note: 'forward move in pips for +1 % rate difference, F · T · 1 %',
  },
  'm05.rhoFwdEffect': {
    value: F * T * dfd * normCdf(d1) * 0.01 * N,
    kind: 'money',
    note: 'forward channel of rho per 1 %: e^(−rd T) · N(d1) · F · T',
  },
  'm05.rhoDiscount': {
    value: -T * M05.callChf * 0.01,
    kind: 'money',
    note: 'discount channel of rho domestic per 1 %: −T · V',
  },
  'm05.rhoSum': { value: M05.rhoSumChf, kind: 'money', note: 'ρ_d + ρ_f per 1 % = −T · V' },
  'm05.rhoD1y': {
    value: (greeks(S, K, 1, vol, rd, rf, 'call').rhoD / 100) * N,
    kind: 'money',
    sign: true,
    note: 'rho CHF for 1 year, same strike',
  },
  'm05.rhoF1y': {
    value: (greeks(S, K, 1, vol, rd, rf, 'call').rhoF / 100) * N,
    kind: 'money',
    sign: true,
    note: 'rho USD for 1 year, same strike',
  },

  // Desk: second-order Greeks and premium-adjusted delta
  'm05.vannaPt': {
    value: vv.vanna * 0.01,
    kind: 'num',
    digits: 4,
    sign: true,
    note: 'delta change per vol point at ATMF',
  },
  'm05.vannaOtmPt': {
    value: vvOtm.vanna * 0.01,
    kind: 'num',
    digits: 3,
    sign: true,
    note: 'delta change per vol point at the lower spot',
  },
  'm05.volgaOtmChf': {
    value: vvOtm.volga * 1e-4 * N,
    kind: 'money',
    sign: true,
    note: 'vega change (CHF) per vol point at the lower spot',
  },
  'm05.deltaPA': {
    value: premiumAdjustedDelta(S, K, T, vol, rd, rf, 'call'),
    kind: 'num',
    digits: 3,
    note: 'premium-adjusted delta Δ − V/S',
  },
  'm05.premiumInUsd': {
    value: M05.callChf / S / N,
    kind: 'num',
    digits: 3,
    note: 'V / S: premium as a share of the USD notional',
  },
};
