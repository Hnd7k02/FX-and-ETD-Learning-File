import { describe, expect, it } from 'vitest';
import { EXAMPLE as E, EXAMPLE_FORWARD, EXAMPLE_STRIKE } from '@/lib/fx/example';
import {
  DAY,
  PIP,
  breakEvenMove,
  deltaGammaPnl,
  greeks,
  numericGreeks,
  perNotional,
  premiumAdjustedDelta,
  thetaGammaShare,
  thetaOneDay,
  thetaSplit,
  vannaVolga,
  type Greeks,
} from '@/lib/fx/greeks';
import { gkPrice, type OptionType } from '@/lib/fx/vanilla';

const K = EXAMPLE_STRIKE;
const N = E.notional;
const call = (S: number = E.spot, T: number = E.T, vol: number = E.vol): Greeks =>
  greeks(S, K, T, vol, E.rd, E.rf, 'call');

/** Relative difference, safe around zero. */
const rel = (a: number, b: number): number => Math.abs(a - b) / Math.max(Math.abs(b), 1e-12);

describe('reference values of the running example (docs/reference/gk_reference.py)', () => {
  const g = call();
  const onN = perNotional(g, N);

  it('matches the GK price: 126.69 pips = CHF 12’669', () => {
    expect(Math.abs(onN.pricePips - 126.69)).toBeLessThan(0.01);
    expect(Math.round(onN.price)).toBe(12669);
  });

  it('has spot delta 0.5039 and 0.6244 at S = 0.8100', () => {
    expect(Math.abs(g.delta - 0.5039)).toBeLessThan(1e-4);
    expect(Math.abs(call(0.81).delta - 0.6244)).toBeLessThan(1e-4);
  });

  it('has forward delta N(d1) = spot delta · e^(rf T)', () => {
    expect(g.deltaFwd).toBeCloseTo(g.delta * Math.exp(E.rf * E.T), 14);
    expect(Math.abs(g.deltaFwd - 0.508362)).toBeLessThan(1e-6);
  });

  it('has gamma 12.3556, i.e. +0.124 delta per big figure', () => {
    expect(Math.abs(g.gamma - 12.3556)).toBeLessThan(1e-3);
    expect(onN.gammaPerBigFigure).toBeCloseTo(0.124, 3);
    expect(onN.gamma).toBeCloseTo(g.gamma * 0.01 * N, 6);
  });

  it('has vega CHF 1’582 per vol point', () => {
    expect(Math.abs(onN.vega - 1582)).toBeLessThan(1);
  });

  it('has analytic theta / 365 = CHF −30.67 per calendar day', () => {
    expect(Math.abs(onN.theta - -30.67)).toBeLessThan(0.01);
    expect(g.thetaDay).toBeCloseTo(g.theta / 365, 15);
  });

  it('shows the one-day theta V(T − 1/365) − V(T) = CHF −30.82 (the lab number)', () => {
    const th = thetaOneDay(E.spot, K, E.T, E.vol, E.rd, E.rf, 'call') * N;
    expect(Math.abs(th - -30.82)).toBeLessThan(0.01);
  });

  it('has the gamma share of theta Θ_Γ = CHF −69.33 per day', () => {
    expect(Math.abs(thetaGammaShare(E.spot, E.vol, g.gamma) * N - -69.33)).toBeLessThan(0.01);
  });

  it('has rho CHF +976 and rho USD −1’008 per +1 %', () => {
    expect(Math.abs(onN.rhoD - 976)).toBeLessThan(1);
    expect(Math.abs(onN.rhoF - -1008)).toBeLessThan(1);
  });

  it('has a daily break-even move of 33.50 pips', () => {
    expect(Math.abs(breakEvenMove(E.spot, E.vol) / PIP - 33.5)).toBeLessThan(0.01);
  });

  it('scales delta to a USD hedge amount', () => {
    expect(onN.delta).toBeCloseTo(g.delta * N, 6);
    expect(onN.deltaFwd).toBeCloseTo(g.deltaFwd * N, 6);
  });
});

describe('numerical check (central finite differences)', () => {
  const cases: [string, number, number, number, OptionType][] = [
    ['ATMF call', E.spot, K, E.T, 'call'],
    ['ATMF put', E.spot, K, E.T, 'put'],
    ['ITM call, 1Y', 0.82, 0.79, 1, 'call'],
    ['OTM put, 4 weeks', 0.81, 0.78, 4 / 52, 'put'],
  ];
  it.each(cases)('agrees with the analytic Greeks: %s', (_, S, k, T, type) => {
    const a = greeks(S, k, T, E.vol, E.rd, E.rf, type);
    const n = numericGreeks(S, k, T, E.vol, E.rd, E.rf, type);
    expect(rel(n.delta, a.delta)).toBeLessThan(1e-4);
    expect(rel(n.gamma, a.gamma)).toBeLessThan(1e-4);
    expect(rel(n.vega, a.vega)).toBeLessThan(1e-4);
    expect(rel(n.theta, a.theta)).toBeLessThan(1e-4);
    expect(rel(n.rhoD, a.rhoD)).toBeLessThan(1e-4);
    expect(rel(n.rhoF, a.rhoF)).toBeLessThan(1e-4);
  });

  it('agrees for non-zero domestic rates too', () => {
    const a = greeks(1.08, 1.1, 0.5, 0.07, 0.02, 0.045, 'put');
    const n = numericGreeks(1.08, 1.1, 0.5, 0.07, 0.02, 0.045, 'put');
    for (const key of ['delta', 'gamma', 'vega', 'theta', 'rhoD', 'rhoF'] as const) {
      expect(rel(n[key], a[key])).toBeLessThan(1e-4);
    }
  });

  it('reproduces the lab gamma check 12.3556 with h = 1 pip', () => {
    expect(
      Math.abs(numericGreeks(E.spot, K, E.T, E.vol, E.rd, E.rf, 'call').gamma - 12.3556),
    ).toBeLessThan(1e-3);
  });

  it('returns the one-day difference as thetaDay, close to but not equal to theta / 365', () => {
    const n = numericGreeks(E.spot, K, E.T, E.vol, E.rd, E.rf, 'call');
    const a = call();
    expect(n.thetaDay).toBe(thetaOneDay(E.spot, K, E.T, E.vol, E.rd, E.rf, 'call'));
    // A one-day step is not infinitesimal: about 0.5 % apart here.
    expect(rel(n.thetaDay, a.thetaDay)).toBeLessThan(0.01);
    expect(rel(n.thetaDay, a.thetaDay)).toBeGreaterThan(1e-4);
  });

  it('accepts a custom spot step (e.g. a JPY pip)', () => {
    const a = greeks(150, 151, 0.25, 0.1, 0.005, 0.045, 'call');
    const n = numericGreeks(150, 151, 0.25, 0.1, 0.005, 0.045, 'call', 0.01);
    expect(rel(n.delta, a.delta)).toBeLessThan(1e-6);
    expect(rel(n.gamma, a.gamma)).toBeLessThan(1e-4);
  });

  it('shrinks vol and time steps when vol or T are tiny', () => {
    const atmf = 0.8 * Math.exp(-0.035 * 1e-4);
    const a = greeks(0.8, atmf, 1e-4, 5e-5, 0, 0.035, 'call');
    const n = numericGreeks(0.8, atmf, 1e-4, 5e-5, 0, 0.035, 'call');
    expect(Number.isFinite(n.vega)).toBe(true);
    expect(Number.isFinite(n.theta)).toBe(true);
    expect(rel(n.vega, a.vega)).toBeLessThan(1e-3);
  });
});

describe('put-call relations', () => {
  const S = 0.805;
  const c = greeks(S, K, E.T, E.vol, E.rd, E.rf, 'call');
  const p = greeks(S, K, E.T, E.vol, E.rd, E.rf, 'put');
  const dff = Math.exp(-E.rf * E.T);
  const dfd = Math.exp(-E.rd * E.T);

  it('has Δc − Δp = e^(−rf T) and Δ_F,c − Δ_F,p = 1', () => {
    expect(c.delta - p.delta).toBeCloseTo(dff, 14);
    expect(c.deltaFwd - p.deltaFwd).toBeCloseTo(1, 14);
    expect(p.delta).toBeLessThan(0);
  });

  it('has equal gamma and vega', () => {
    expect(p.gamma).toBeCloseTo(c.gamma, 12);
    expect(p.vega).toBeCloseTo(c.vega, 14);
  });

  it('has theta and rho differences of the forward C − P = S e^(−rf T) − K e^(−rd T)', () => {
    expect(c.theta - p.theta).toBeCloseTo(E.rf * S * dff - E.rd * K * dfd, 12);
    expect(c.rhoD - p.rhoD).toBeCloseTo(K * E.T * dfd, 12);
    expect(c.rhoF - p.rhoF).toBeCloseTo(-S * E.T * dff, 12);
  });

  it('works with rd ≠ 0 as well', () => {
    const [rd, rf, T] = [0.02, 0.045, 0.5];
    const cc = greeks(1.1, 1.08, T, 0.07, rd, rf, 'call');
    const pp = greeks(1.1, 1.08, T, 0.07, rd, rf, 'put');
    expect(cc.theta - pp.theta).toBeCloseTo(
      rf * 1.1 * Math.exp(-rf * T) - rd * 1.08 * Math.exp(-rd * T),
      12,
    );
  });
});

describe('theta decomposition (gamma versus carry)', () => {
  it('splits the example theta into Θ_Γ = −69.33 and a carry of about +38.66 CHF per day', () => {
    const s = thetaSplit(E.spot, K, E.T, E.vol, E.rd, E.rf, 'call');
    expect(Math.abs(s.gamma * N - -69.33)).toBeLessThan(0.01);
    expect(s.carry * N).toBeGreaterThan(38);
    expect(s.carry * N).toBeLessThan(39);
    expect(s.total).toBeCloseTo(call().thetaDay, 15);
  });

  it('satisfies the GK PDE Θ + ½σ²S²Γ + (rd − rf)SΔ − rd V = 0 for calls and puts', () => {
    for (const type of ['call', 'put'] as const) {
      const [S, k, T, v, rd, rf] = [1.09, 1.1, 0.4, 0.075, 0.025, 0.04];
      const g = greeks(S, k, T, v, rd, rf, type);
      const pde = g.theta + 0.5 * v * v * S * S * g.gamma + (rd - rf) * S * g.delta - rd * g.price;
      expect(Math.abs(pde)).toBeLessThan(1e-14);
      const s = thetaSplit(S, k, T, v, rd, rf, type);
      expect(s.total).toBeCloseTo(g.thetaDay, 15);
    }
  });
});

describe('gamma against theta', () => {
  const g = call();

  it('makes zero P&L at the break-even move, a gain beyond and a loss inside', () => {
    const be = breakEvenMove(E.spot, E.vol);
    expect(Math.abs(deltaGammaPnl(g.gamma, E.spot, E.vol, be, DAY))).toBeLessThan(1e-18);
    expect(deltaGammaPnl(g.gamma, E.spot, E.vol, -be, DAY)).toBeCloseTo(0, 18);
    expect(deltaGammaPnl(g.gamma, E.spot, E.vol, 2 * be, DAY)).toBeGreaterThan(0);
    expect(deltaGammaPnl(g.gamma, E.spot, E.vol, 0.5 * be, DAY)).toBeLessThan(0);
  });

  it('loses exactly Θ_Γ on a day without a spot move', () => {
    expect(deltaGammaPnl(g.gamma, E.spot, E.vol, 0, DAY)).toBeCloseTo(
      thetaGammaShare(E.spot, E.vol, g.gamma),
      18,
    );
  });

  it('earns ½ Γ (dS)² when no time passes', () => {
    expect(deltaGammaPnl(g.gamma, E.spot, E.vol, 0.01, 0)).toBeCloseTo(0.5 * g.gamma * 1e-4, 15);
  });

  it('scales the break-even move with √dt (one week = √7 days)', () => {
    expect(breakEvenMove(E.spot, E.vol, 7 / 365)).toBeCloseTo(
      Math.sqrt(7) * breakEvenMove(E.spot, E.vol),
      15,
    );
  });

  it('approximates the real one-day P&L of a delta-hedged call', () => {
    const v0 = gkPrice(E.spot, K, E.T, E.vol, E.rd, E.rf, 'call');
    for (const dS of [-0.01, -0.005, 0.001, 0.005, 0.01]) {
      const v1 = gkPrice(E.spot + dS, K, E.T - DAY, E.vol, E.rd, E.rf, 'call');
      // Short Δ USD as hedge: pay USD interest rf·S·Δ·dt; with rd = 0 the CHF cash earns nothing.
      const hedged = v1 - v0 - g.delta * dS - E.rf * E.spot * g.delta * DAY;
      const approx = deltaGammaPnl(g.gamma, E.spot, E.vol, dS, DAY);
      // Left out: third-order terms (speed, charm, gamma decay over the day). Allow 5 % of
      // the gross gamma gain plus theta cost.
      const gross = 0.5 * g.gamma * (dS * dS + E.vol * E.vol * E.spot * E.spot * DAY);
      expect(Math.abs(hedged - approx)).toBeLessThan(0.05 * gross);
      expect(Math.sign(hedged)).toBe(Math.sign(approx));
    }
  });
});

describe('shape and monotonicity', () => {
  it('has a call delta that rises with the spot, between 0 and e^(−rf T)', () => {
    let prev = -Infinity;
    for (let S = 0.76; S <= 0.84 + 1e-12; S += 0.0005) {
      const d = call(S).delta;
      expect(d).toBeGreaterThan(prev);
      expect(d).toBeGreaterThan(0);
      expect(d).toBeLessThan(Math.exp(-E.rf * E.T));
      prev = d;
    }
  });

  it('has positive gamma and vega and negative theta for a long ATMF call', () => {
    const g = call();
    expect(g.gamma).toBeGreaterThan(0);
    expect(g.vega).toBeGreaterThan(0);
    expect(g.theta).toBeLessThan(0);
  });

  it('has vega largest near ATMF on a strike grid', () => {
    let best = { k: 0, vega: -Infinity };
    for (let k = 0.75; k <= 0.84 + 1e-12; k += 0.0005) {
      const v = greeks(E.spot, k, E.T, E.vol, E.rd, E.rf, 'call').vega;
      if (v > best.vega) best = { k, vega: v };
    }
    expect(Math.abs(best.k - EXAMPLE_FORWARD)).toBeLessThan(0.001);
  });

  it('has vega largest near ATMF on a spot grid (exactly where d2 = 0)', () => {
    let best = { S: 0, v: -Infinity };
    for (let S = 0.76; S <= 0.84 + 1e-12; S += 0.0005) {
      const v = call(S).vega;
      if (v > best.v) best = { S, v };
    }
    // ATMF in spot terms: S·e^((rd − rf)T) = K. The exact maximum of S·φ(d1) is at d2 = 0.
    const sAtmf = K * Math.exp((E.rf - E.rd) * E.T);
    const sMax = sAtmf * Math.exp(0.5 * E.vol * E.vol * E.T);
    expect(Math.abs(best.S - sMax)).toBeLessThanOrEqual(0.00025 + 1e-12);
    expect(Math.abs(best.S - sAtmf)).toBeLessThan(0.001);
  });

  it('has vega growing with time to expiry at ATMF', () => {
    expect(call(E.spot, 1).vega).toBeGreaterThan(call(E.spot, 0.25).vega);
    expect(call(E.spot, 0.25).vega).toBeGreaterThan(call(E.spot, 1 / 52).vega);
  });
});

describe('second-order and desk Greeks', () => {
  const [S, k, T, v, rd, rf] = [0.81, 0.79, 0.5, 0.09, 0.01, 0.035];

  it('has vanna = ∂Δ/∂σ = ∂ν/∂S and volga = ∂ν/∂σ', () => {
    const { vanna, volga } = vannaVolga(S, k, T, v, rd, rf);
    const h = 1e-5;
    const dDelta =
      (greeks(S, k, T, v + h, rd, rf, 'call').delta -
        greeks(S, k, T, v - h, rd, rf, 'call').delta) /
      (2 * h);
    const dVegaS =
      (greeks(S + h, k, T, v, rd, rf, 'put').vega - greeks(S - h, k, T, v, rd, rf, 'put').vega) /
      (2 * h);
    const dVegaV =
      (greeks(S, k, T, v + h, rd, rf, 'call').vega - greeks(S, k, T, v - h, rd, rf, 'call').vega) /
      (2 * h);
    expect(rel(dDelta, vanna)).toBeLessThan(1e-6);
    expect(rel(dVegaS, vanna)).toBeLessThan(1e-6);
    expect(rel(dVegaV, volga)).toBeLessThan(1e-6);
  });

  it('has premium-adjusted delta = ±K e^(−rd T) N(±d2) / S, below the plain delta', () => {
    const c = greeks(S, k, T, v, rd, rf, 'call');
    const pc = premiumAdjustedDelta(S, k, T, v, rd, rf, 'call');
    const pp = premiumAdjustedDelta(S, k, T, v, rd, rf, 'put');
    const p = greeks(S, k, T, v, rd, rf, 'put');
    // K e^(−rd T) N(d2) = rhoD / T for calls.
    expect(pc).toBeCloseTo(c.rhoD / T / S, 14);
    expect(pp).toBeCloseTo(p.rhoD / T / S, 14);
    expect(pc).toBeLessThan(c.delta);
    expect(pp).toBeLessThan(p.delta);
  });
});

describe('degenerate inputs', () => {
  it('returns payoff and step delta at expiry', () => {
    const itm = greeks(0.81, 0.8, 0, 0.08, 0, 0.035, 'call');
    expect(itm.price).toBeCloseTo(0.01, 14);
    expect(itm.delta).toBe(1);
    expect(itm.deltaFwd).toBe(1);
    expect([itm.gamma, itm.vega, itm.theta, itm.thetaDay, itm.rhoD, itm.rhoF]).toEqual([
      0, 0, 0, 0, 0, 0,
    ]);
    expect(greeks(0.81, 0.8, -1, 0.08, 0, 0.035, 'put').delta).toBe(0);
    expect(greeks(0.79, 0.8, 0, 0.08, 0, 0.035, 'put').delta).toBe(-1);
    expect(greeks(0.8, 0.8, 0, 0.08, 0, 0.035, 'call').delta).toBe(0.5);
  });

  it('returns the deterministic forward limit at zero vol', () => {
    const [S, T, rd, rf] = [0.8, 0.5, 0.01, 0.035];
    const F = S * Math.exp((rd - rf) * T);
    const itm = greeks(S, F - 0.01, T, 0, rd, rf, 'call');
    expect(itm.delta).toBeCloseTo(Math.exp(-rf * T), 15);
    expect(itm.gamma).toBe(0);
    expect(itm.vega).toBe(0);
    // ∂/∂t of S e^(−rf T) − K e^(−rd T).
    expect(itm.theta).toBeCloseTo(
      rf * S * Math.exp(-rf * T) - rd * (F - 0.01) * Math.exp(-rd * T),
      15,
    );
    const otm = greeks(S, F + 0.01, T, 0, rd, rf, 'call');
    expect(otm.delta).toBe(0);
    expect(otm.rhoD).toBe(0);
    const atm = greeks(S, F, T, 0, rd, rf, 'put');
    expect(atm.deltaFwd).toBe(-0.5);
  });

  it('values the last day at expiry in thetaOneDay', () => {
    const th = thetaOneDay(0.8, 0.79, 0.5 / 365, 0.08, 0, 0.035, 'call');
    const v = gkPrice(0.8, 0.79, 0.5 / 365, 0.08, 0, 0.035, 'call');
    expect(th).toBeCloseTo(0.01 - v, 15);
  });
});

describe('perNotional', () => {
  it('uses a custom pip for JPY pairs (big figure = 1.00)', () => {
    const g = greeks(150, 150, 0.25, 0.1, 0.005, 0.045, 'call');
    const s = perNotional(g, 1e6, 0.01);
    expect(s.pricePips).toBeCloseTo(g.price / 0.01, 10);
    expect(s.gammaPerBigFigure).toBeCloseTo(g.gamma, 14);
  });
});
