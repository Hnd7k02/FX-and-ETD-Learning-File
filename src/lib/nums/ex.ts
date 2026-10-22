/**
 * Numbers of the running example (MASTER_PROMPT §6) for <Num of="ex.…" />.
 * Inputs come from src/lib/fx/example.ts; every derived value is computed by the core here,
 * no typed-in results. Units: rates in CHF per USD, pips = 0.0001, money in CHF on the USD 1 Mio.
 * notional, theta per calendar day, vega per vol point, rho per +1 %.
 */
import {
  EXAMPLE,
  EXAMPLE_FORWARD,
  EXAMPLE_STRIKE,
  black76,
  breakEvenMove,
  d1d2,
  forward,
  forwardPoints,
  gkPrice,
  greeks,
  perNotional,
  thetaGammaShare,
  thetaOneDay,
} from '@/lib/fx';
import type { NumTable } from './types';

const { spot: S, rd, rf, T, vol, notional: N, mmDays } = EXAMPLE;
const K = EXAMPLE_STRIKE;
const PIP = 1e-4;
const pips = (x: number): number => x / PIP;

const forwardMM = forward(S, rd, rf, T, 'moneyMarket', {
  days: mmDays,
  quoteCcy: EXAMPLE.quote,
  baseCcy: EXAMPLE.base,
});
const { d1, d2 } = d1d2(S, K, T, vol, rd, rf);
const call = gkPrice(S, K, T, vol, rd, rf, 'call');
const put = gkPrice(S, K, T, vol, rd, rf, 'put');
const g = greeks(S, K, T, vol, rd, rf, 'call');
const onN = perNotional(g, N, PIP);
const thetaDay = thetaOneDay(S, K, T, vol, rd, rf, 'call') * N;
const thetaGamma = thetaGammaShare(S, vol, g.gamma) * N;

export const nums: NumTable = {
  // Inputs
  'ex.spot': { value: S, kind: 'rate' },
  'ex.rd': { value: rd, kind: 'pct' },
  'ex.rf': { value: rf, kind: 'pct' },
  'ex.vol': { value: vol, kind: 'pct', digits: 0 },
  'ex.vol1': { value: vol, kind: 'pct', digits: 1 },
  'ex.notional': { value: N, kind: 'money', ccy: 'USD' },
  'ex.notionalM': { value: N / 1e6, kind: 'num', digits: 0, note: 'Notional in millions' },
  'ex.T': { value: T, kind: 'num', digits: 2, note: 'Years in the option model' },
  'ex.mmDays': { value: mmDays, kind: 'num', digits: 0, note: 'Days, money market Act/360' },
  'ex.strike': { value: K, kind: 'rate' },

  // Forward (module 02)
  'ex.forward': { value: EXAMPLE_FORWARD, kind: 'rate', digits: 5 },
  'ex.forwardMM': {
    value: forwardMM,
    kind: 'rate',
    digits: 5,
    note: 'Money-market forward S·(1 + rd·90/360)/(1 + rf·90/360)',
  },
  'ex.fwdPoints': {
    value: forwardPoints(EXAMPLE_FORWARD, S, EXAMPLE.pair),
    kind: 'pips',
    note: 'Continuous forward points',
  },
  'ex.fwdPointsMM': { value: forwardPoints(forwardMM, S, EXAMPLE.pair), kind: 'pips' },
  'ex.fwdDiffPips': {
    value: Math.abs(pips(EXAMPLE_FORWARD - forwardMM)),
    kind: 'pips',
    note: 'Absolute gap continuous vs money-market forward (continuous is lower)',
  },

  // Vanilla (module 04)
  'ex.d1': { value: d1, kind: 'num', digits: 4 },
  'ex.d2': { value: d2, kind: 'num', digits: 4 },
  'ex.dff': { value: Math.exp(-rf * T), kind: 'num', digits: 4, note: 'e^(−rf·T)' },
  'ex.callPips': { value: pips(call), kind: 'pips', digits: 2 },
  'ex.callChf': { value: call * N, kind: 'money' },
  'ex.putPips': { value: pips(put), kind: 'pips', digits: 2 },
  'ex.putChf': { value: put * N, kind: 'money' },
  'ex.parityPips': {
    value: pips(call - put),
    kind: 'pips',
    digits: 2,
    note: 'C − P = DF_d·(F − K), in pips',
  },
  'ex.tv3m': {
    value: pips(black76(K, K, T, vol, 'call')),
    kind: 'pips',
    note: 'ATMF time value, Black-76 undiscounted, 3M',
  },
  'ex.tv1y': {
    value: pips(black76(K, K, 1, vol, 'call')),
    kind: 'pips',
    note: 'ATMF time value, Black-76 undiscounted, 1Y',
  },

  // Greeks (module 05)
  'ex.delta': { value: g.delta, kind: 'num', digits: 4 },
  'ex.deltaUp': {
    value: greeks(S + 100 * PIP, K, T, vol, rd, rf, 'call').delta,
    kind: 'num',
    digits: 4,
    note: 'Spot delta at S + 0.0100',
  },
  'ex.gamma': { value: g.gamma, kind: 'num', digits: 2 },
  'ex.gamma4': { value: g.gamma, kind: 'num', digits: 4 },
  'ex.gammaBigFig': {
    value: onN.gammaPerBigFigure,
    kind: 'num',
    digits: 3,
    sign: true,
    note: 'Change of delta per big figure (0.01)',
  },
  'ex.vegaChf': { value: onN.vega, kind: 'money', note: 'Per vol point' },
  'ex.thetaDayChf': {
    value: thetaDay,
    kind: 'money',
    digits: 2,
    note: 'One-day difference V(T − 1/365) − V(T); the value the UI shows',
  },
  'ex.thetaAnalyticChf': {
    value: onN.theta,
    kind: 'money',
    digits: 2,
    note: 'Analytic theta / 365',
  },
  'ex.thetaGammaChf': {
    value: thetaGamma,
    kind: 'money',
    digits: 2,
    note: 'Gamma share −½σ²S²Γ/365',
  },
  'ex.thetaCarryChf': {
    value: thetaDay - thetaGamma,
    kind: 'money',
    digits: 2,
    note:
      'One-day theta minus the gamma share, so that gamma share + carry = the UI theta. ' +
      'The analytic carry (rd·V − (rd − rf)·S·Δ)/365 is slightly larger; the gap is the ' +
      'curvature of time decay over one day (difference vs derivative).',
  },
  'ex.rhoDChf': { value: onN.rhoD, kind: 'money', sign: true, note: 'Per +1 % CHF rate' },
  'ex.rhoFChf': { value: onN.rhoF, kind: 'money', sign: true, note: 'Per +1 % USD rate' },
  'ex.breakEvenPips': {
    value: pips(breakEvenMove(S, vol)),
    kind: 'pips',
    digits: 2,
    note: 'σ·S/√365',
  },
  'ex.breakEvenPips1': { value: pips(breakEvenMove(S, vol)), kind: 'pips', digits: 1 },
};
