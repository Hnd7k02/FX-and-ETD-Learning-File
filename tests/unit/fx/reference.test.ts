/**
 * MASTER_PROMPT §6: the reference table of the running example, one test per row, each with
 * exactly the tolerance stated there. Values come from docs/reference/gk_reference.py
 * (python3 -I docs/reference/gk_reference.py). Everything goes through the public barrel
 * '@/lib/fx', so the test also checks that the barrel exports what the modules need.
 *
 * The second block compares with the unrounded output of the same script (printed with
 * repr), to make sure the TypeScript core and the Python reference are the same model and
 * not merely within the table's rounding.
 */
import { describe, expect, it } from 'vitest';
import {
  DAY,
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
  numericGreeks,
  parityResidual,
  perNotional,
  thetaGammaShare,
  thetaOneDay,
} from '@/lib/fx';

const { spot: S, rd, rf, T, vol, notional: N, mmDays } = EXAMPLE;
const K = EXAMPLE_STRIKE;
const pips = (x: number): number => x * 1e4;

/** |actual − expected| ≤ tol (absolute), with a readable failure message. */
function within(actual: number, expected: number, tol: number, label: string): void {
  expect(
    Math.abs(actual - expected),
    `${label}: ${actual} vs ${expected} (tol ${tol})`,
  ).toBeLessThanOrEqual(tol);
}

const call = gkPrice(S, K, T, vol, rd, rf, 'call');
const put = gkPrice(S, K, T, vol, rd, rf, 'put');
const g = greeks(S, K, T, vol, rd, rf, 'call');
const onN = perNotional(g, N);

describe('MASTER_PROMPT §6 reference table (stated tolerances)', () => {
  it('Forward stetig: 0.79303 (−69.7 pips), tol 1e-5', () => {
    const F = forward(S, rd, rf, T, 'continuous');
    within(F, 0.79303, 1e-5, 'forward');
    expect(F).toBe(EXAMPLE_FORWARD);
    within(forwardPoints(F, S), -69.7, 0.05, 'forward points (1 decimal)');
  });

  it('Forward Geldmarkt (Act/360, 90 Tage): 0.79306 (−69.4 pips), tol 1e-5', () => {
    const F = forward(S, rd, rf, T, 'moneyMarket', {
      days: mmDays,
      quoteCcy: 'CHF',
      baseCcy: 'USD',
    });
    within(F, 0.79306, 1e-5, 'money-market forward');
    within(forwardPoints(F, S), -69.4, 0.05, 'forward points (1 decimal)');
  });

  it('Call: 126.69 pips = CHF 12’669, tol 0.01 pips', () => {
    expect(K).toBe(0.793);
    within(pips(call), 126.69, 0.01, 'call in pips');
    expect(Math.round(call * N)).toBe(12_669);
    expect(onN.price).toBeCloseTo(call * N, 9);
  });

  it('Put-Call-Parität: C − P = DF_d · (F − K), tol 1e-10', () => {
    const dfd = Math.exp(-rd * T);
    within(parityResidual(call, put, EXAMPLE_FORWARD, K, dfd), 0, 1e-10, 'parity residual');
    within(call - put, dfd * (EXAMPLE_FORWARD - K), 1e-10, 'C − P');
  });

  it('Delta (Spot): 0.5039; at S = 0.8100: 0.6244, tol 1e-4', () => {
    within(g.delta, 0.5039, 1e-4, 'spot delta');
    within(greeks(0.81, K, T, vol, rd, rf, 'call').delta, 0.6244, 1e-4, 'delta at 0.8100');
  });

  it('Gamma: 12.3556 (+0.124 delta per big figure), tol 1e-3', () => {
    within(g.gamma, 12.3556, 1e-3, 'gamma');
    within(onN.gammaPerBigFigure, 0.124, 1e-3, 'gamma per big figure');
    within(numericGreeks(S, K, T, vol, rd, rf, 'call').gamma, 12.3556, 1e-3, 'numeric gamma');
  });

  it('Vega: CHF 1’582 per vol point, tol CHF 1', () => {
    within(onN.vega, 1582, 1, 'vega per vol point');
  });

  it('Theta analytisch (annual theta / 365): CHF −30.67 per calendar day, tol CHF 0.01', () => {
    within(onN.theta, -30.67, 0.01, 'analytic theta per day');
    within(g.thetaDay * N, -30.67, 0.01, 'thetaDay · N');
  });

  it('Theta as one-day difference V(T − 1/365) − V(T) (UI value): CHF −30.82, tol CHF 0.01', () => {
    const oneDay = thetaOneDay(S, K, T, vol, rd, rf, 'call');
    within(oneDay * N, -30.82, 0.01, 'one-day theta');
    expect(oneDay).toBe(gkPrice(S, K, T - DAY, vol, rd, rf, 'call') - call);
  });

  it('Gamma share of theta Θ_Γ = −½σ²S²Γ/365: CHF −69.33 per day, tol CHF 0.01', () => {
    within(thetaGammaShare(S, vol, g.gamma) * N, -69.33, 0.01, 'gamma share of theta');
  });

  it('Rho CHF / Rho USD: CHF +976 / CHF −1’008 per +1 %, tol CHF 1', () => {
    within(onN.rhoD, 976, 1, 'rho CHF');
    within(onN.rhoF, -1008, 1, 'rho USD');
  });

  it('Zeitwert ATMF (Black-76): 126.5 pips (3M), 253.0 pips (1Y), tol 0.1 pips', () => {
    within(pips(black76(K, K, 0.25, vol, 'call')), 126.5, 0.1, 'time value 3M');
    within(pips(black76(K, K, 1, vol, 'call')), 253.0, 0.1, 'time value 1Y');
  });

  it('Break-even daily move σ · S / √365: 33.50 pips, tol 0.01 pips', () => {
    within(pips(breakEvenMove(S, vol)), 33.5, 0.01, 'break-even move');
    within(pips(breakEvenMove(S, vol)), pips((vol * S) / Math.sqrt(365)), 1e-12, 'formula');
  });
});

/** Unrounded output of docs/reference/gk_reference.py (repr of the script's variables). */
const PY = {
  F: 0.7930305358721359,
  fwdMM: 0.7930607187112764,
  d1: 0.020962650826984,
  d2: -0.019037349173016,
  callPips: 126.69122978199387,
  putPips: 126.38587106063525,
  delta: 0.5039335094749062,
  deltaUp: 0.6243888904987892,
  gamma: 12.355621313635904,
  vegaChf: 1581.5195281453962,
  thetaFdChf: -30.824791704076038,
  thetaAnChf: -30.66897036994235,
  thetaGammaChf: -69.3268834255516,
  rhoDChf: 976.1942115043141,
  rhoFChf: -1007.8670189498126,
  tv3m: 126.53605555006553,
  tv1y: 253.0215084858961,
  breakEven: 33.49913104577368,
} as const;

describe('agreement with the unrounded Python reference', () => {
  const rel = (a: number, b: number): number => Math.abs(a - b) / Math.max(1, Math.abs(b));

  it('forwards, d1/d2 and prices agree to ~1e-12', () => {
    expect(rel(EXAMPLE_FORWARD, PY.F)).toBeLessThan(1e-14);
    const mm = forward(S, rd, rf, T, 'moneyMarket', { days: mmDays });
    expect(rel(mm, PY.fwdMM)).toBeLessThan(1e-14);
    const { d1, d2 } = d1d2(S, K, T, vol, rd, rf);
    expect(Math.abs(d1 - PY.d1)).toBeLessThan(1e-12);
    expect(Math.abs(d2 - PY.d2)).toBeLessThan(1e-12);
    // Python uses math.erf, the core uses Hart/West: both near double precision.
    expect(Math.abs(pips(call) - PY.callPips)).toBeLessThan(1e-9);
    expect(Math.abs(pips(put) - PY.putPips)).toBeLessThan(1e-9);
  });

  it('Greeks agree to ~1e-9 relative', () => {
    expect(rel(g.delta, PY.delta)).toBeLessThan(1e-12);
    expect(rel(greeks(0.81, K, T, vol, rd, rf, 'call').delta, PY.deltaUp)).toBeLessThan(1e-12);
    expect(rel(g.gamma, PY.gamma)).toBeLessThan(1e-12);
    expect(rel(onN.vega, PY.vegaChf)).toBeLessThan(1e-12);
    expect(rel(thetaOneDay(S, K, T, vol, rd, rf, 'call') * N, PY.thetaFdChf)).toBeLessThan(1e-9);
    expect(rel(onN.theta, PY.thetaAnChf)).toBeLessThan(1e-12);
    expect(rel(thetaGammaShare(S, vol, g.gamma) * N, PY.thetaGammaChf)).toBeLessThan(1e-12);
    expect(rel(onN.rhoD, PY.rhoDChf)).toBeLessThan(1e-12);
    expect(rel(onN.rhoF, PY.rhoFChf)).toBeLessThan(1e-12);
  });

  it('time values and break-even agree to ~1e-9 pips', () => {
    expect(Math.abs(pips(black76(K, K, 0.25, vol, 'call')) - PY.tv3m)).toBeLessThan(1e-9);
    expect(Math.abs(pips(black76(K, K, 1, vol, 'call')) - PY.tv1y)).toBeLessThan(1e-9);
    expect(Math.abs(pips(breakEvenMove(S, vol)) - PY.breakEven)).toBeLessThan(1e-9);
  });
});
