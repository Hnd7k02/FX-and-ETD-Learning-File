/**
 * Integration checks across the modules of the calculation core, through the public barrel.
 *
 * 1. Independent reference values for the exotics, computed offline by a separate stdlib
 *    Python implementation that uses DIFFERENT formulas from the TypeScript code:
 *    - single barriers by the method of images on the restricted European payoff,
 *      V_out(S) = V0(S) − (H/S)^(2ν/σ²) · V0(H²/S), ν = rd − rf − σ²/2;
 *    - one-touch paid at hit by quadrature of the first-passage density (Simpson in ln t);
 *    - double no-touch by the image sum (Kunitomo–Ikeda style) instead of Hui's sine series.
 *    Across ~3’000 cases (8 markets incl. negative rates and σ = 3 %) the largest gaps were:
 *    barriers 1.8e-13 (per unit spot), DNT 5.7e-12, touches 6e-13, digitals 1e-16.
 * 2. Cross-module consistency: the same quantity computed by two modules must agree.
 */
import { describe, expect, it } from 'vitest';
import {
  EXAMPLE,
  EXAMPLE_FORWARD,
  EXAMPLE_STRIKE,
  atmDnsStrike,
  atmfStrike,
  barrierPrice,
  black76,
  cashAndCarry,
  digitalCash,
  doubleNoTouch,
  forward,
  forwardCarry,
  forwardContinuous,
  forwardDelta,
  forwardMoneyMarket,
  fxSwap,
  gkPrice,
  greeks,
  haugSetup,
  hitDiscountFactor,
  hitDiscountFactorByQuadrature,
  impliedVol,
  noTouch,
  oneTouch,
  smilePillars,
  smileVol,
  strikeFromDelta,
  strikeFromForwardDelta,
  touchProbability,
  volAtStrike,
  type BarrierKind,
  type OptionType,
} from '@/lib/fx';

const { spot: S, rd, rf, T, vol } = EXAMPLE;
const K = EXAMPLE_STRIKE;
const ex = { S, T, vol, rd, rf };

describe('exotics against an independent implementation (method of images)', () => {
  it.each([
    ['down-and-out', 'call', K, 0.77, 0.01215038110966616],
    ['up-and-out', 'call', K, 0.83, 0.002962654666929901],
    ['up-and-in', 'call', K, 0.83, 0.009706468311269487],
    ['down-and-in', 'put', K, 0.77, 0.011568314571671533],
    ['up-and-out', 'put', 0.84, 0.83, 0.04310959073137613],
    ['down-and-out', 'call', 0.76, 0.78, 0.0234566508445292],
  ] as [BarrierKind, OptionType, number, number, number][])(
    'running example: %s %s K = %f, H = %f',
    (kind, type, strike, H, ref) => {
      const v = barrierPrice({ ...ex, K: strike, H, type, kind });
      expect(Math.abs(v - ref)).toBeLessThan(1e-13);
    },
  );

  it('Haug table cells with rebate 3 (S = 100, T = 0.5, rd = 8 %, rf = 4 %, σ = 25 %)', () => {
    const m = { S: 100, T: 0.5, vol: 0.25, rd: 0.08, rf: 0.04, K: 90, rebate: 3 };
    const doc = barrierPrice({ ...m, H: 95, type: 'call', kind: 'down-and-out' });
    const uoc = barrierPrice({ ...m, H: 105, type: 'call', kind: 'up-and-out' });
    expect(Math.abs(doc - 9.024567694966859)).toBeLessThan(1e-11);
    expect(Math.abs(uoc - 2.6789125048401106)).toBeLessThan(1e-11);
  });

  it('double no-touch: Hui series = image sum', () => {
    for (const [L, U, t, ref] of [
      [0.77, 0.83, T, 0.3070061362442423],
      [0.78, 0.82, T, 0.05285982515371548],
      [0.75, 0.85, 1, 0.15492017920153814],
    ] as const) {
      expect(Math.abs(doubleNoTouch({ ...ex, L, U, T: t }) - ref)).toBeLessThan(1e-12);
    }
  });

  it('one-touch at expiry and cash digital', () => {
    expect(Math.abs(oneTouch({ ...ex, H: 0.83 }) - 0.2828505046369518)).toBeLessThan(1e-13);
    expect(Math.abs(oneTouch({ ...ex, H: 0.76 }) - 0.26662037779115)).toBeLessThan(1e-13);
    expect(Math.abs(digitalCash(S, 0.8, T, vol, rd, rf, 'call') - 0.40564972163029)).toBeLessThan(
      1e-13,
    );
  });

  it('pay-at-hit quadrature (λ² < 0) is accurate for barriers close to the spot', () => {
    // First-passage density quadrature in Python. The former Simpson rule in t was off by
    // 9e-8 (1 % away) and 6e-6 (1 pip away); Simpson in √t fixes that with the same 400 steps.
    for (const [s, H, t, v, d, f, eta, ref, tol] of [
      [1.08, 1.0692, 2, 0.06, -0.0075, -0.0075, 1, 0.9114313246567667, 1e-12],
      [1.2, 1.1999, 1, 0.1, -0.0075, -0.0075, 1, 0.9993808661245224, 1e-8],
      [1.2, 1.2012, 3, 0.04, -0.0075, -0.0075, -1, 0.9882441602741815, 1e-9],
      [1.08, 1.0, 1, 0.1, -0.0075, -0.005, 1, 0.4687368324669852, 1e-12],
    ] as const) {
      expect(haugSetup(t, v, d, f).lambda2).toBeLessThan(0);
      expect(Math.abs(hitDiscountFactor(s, H, t, v, d, f, eta) - ref)).toBeLessThan(tol);
      expect(
        Math.abs(oneTouch({ S: s, H, T: t, vol: v, rd: d, rf: f, payAt: 'hit' }) - ref),
      ).toBeLessThan(tol);
    }
  });

  it('quadrature and closed form agree for a barrier 10 pips away (λ² > 0)', () => {
    const closed = hitDiscountFactor(0.8, 0.799, 0.25, 0.08, 0.01, 0.035, 1);
    expect(haugSetup(0.25, 0.08, 0.01, 0.035).lambda2).toBeGreaterThan(0);
    expect(
      Math.abs(hitDiscountFactorByQuadrature(0.8, 0.799, 0.25, 0.08, 0.01, 0.035, 1) - closed),
    ).toBeLessThan(1e-9);
  });
});

describe('cross-module consistency', () => {
  it('forward: example constant = forward() = atmfStrike(); money market = swap far = fair', () => {
    expect(forward(S, rd, rf, T)).toBe(EXAMPLE_FORWARD);
    expect(atmfStrike(S, T, rd, rf)).toBeCloseTo(EXAMPLE_FORWARD, 15);
    const mm = forwardMoneyMarket(S, rd, rf, EXAMPLE.mmDays);
    const swap = fxSwap({
      S,
      rd,
      rf,
      days: EXAMPLE.mmDays,
      notionalBase: 1e6,
      side: 'buySellBase',
    });
    expect(swap.farRate).toBe(mm);
    expect(cashAndCarry({ S, rd, rf, days: EXAMPLE.mmDays, marketForward: mm }).fairForward).toBe(
      mm,
    );
    expect(forwardCarry(S, rd, rf, EXAMPLE.mmDays).forward).toBeCloseTo(mm, 15);
    expect(forward(S, rd, rf, T, 'moneyMarket')).toBe(mm); // default days = round(T · 360) = 90
  });

  it('Garman-Kohlhagen = Black-76 on the forward, discounted with e^(−rd T)', () => {
    for (const type of ['call', 'put'] as const) {
      for (const strike of [0.75, K, 0.85]) {
        const F = forwardContinuous(S, 0.01, rf, T);
        const b = black76(F, strike, T, vol, type, Math.exp(-0.01 * T));
        expect(b).toBeCloseTo(gkPrice(S, strike, T, vol, 0.01, rf, type), 14);
      }
    }
    // zero vol: discounted forward intrinsic in both models
    expect(black76(0.8, 0.79, T, 0, 'call', 0.99)).toBeCloseTo(0.99 * 0.01, 15);
  });

  it('forward delta: greeks().deltaFwd = smile forwardDelta(); strikes from delta agree', () => {
    const F = EXAMPLE_FORWARD;
    expect(greeks(S, K, T, vol, rd, rf, 'call').deltaFwd).toBeCloseTo(
      forwardDelta(K, F, T, vol),
      14,
    );
    for (const d of [0.1, 0.25, 0.5, 0.75, 0.9]) {
      expect(strikeFromDelta(d, S, T, vol, rd, rf, 'call', 'forward')).toBeCloseTo(
        strikeFromForwardDelta(d, F, T, vol),
        13,
      );
    }
    // a 25Δ put (forward delta −0.25) is the call with forward delta 0.75
    expect(strikeFromDelta(-0.25, S, T, vol, rd, rf, 'put', 'forward')).toBeCloseTo(
      strikeFromForwardDelta(0.75, F, T, vol),
      13,
    );
    expect(atmDnsStrike(S, T, vol, rd, rf)).toBeCloseTo(strikeFromForwardDelta(0.5, F, T, vol), 13);
  });

  it('smile: pillar strikes return their quoted vols; implied vol recovers them', () => {
    const q = { atm: vol, rr25: -0.01, bf25: 0.0025 };
    const F = EXAMPLE_FORWARD;
    const p = smilePillars(F, T, q);
    for (const pt of [p.put25, p.atm, p.call25]) {
      expect(volAtStrike(pt.K, F, T, q)).toBeCloseTo(pt.vol, 12);
      expect(smileVol(pt.deltaFwd, q)).toBe(pt.vol);
      const price = gkPrice(S, pt.K, T, pt.vol, rd, rf, 'call');
      expect(impliedVol(price, S, pt.K, T, rd, rf, 'call')).toBeCloseTo(pt.vol, 9);
    }
    expect(p.put25.vol).toBeGreaterThan(p.call25.vol); // RR < 0: CHF calls (USD puts) dearer
  });

  it('touches: one-touch at expiry = e^(−rd T) · touch probability = e^(−rd T) − no-touch', () => {
    for (const H of [0.76, 0.84]) {
      const ot = oneTouch({ ...ex, H, payout: 1e6 });
      expect(ot).toBeCloseTo(1e6 * Math.exp(-rd * T) * touchProbability({ ...ex, H }), 6);
      expect(ot + noTouch({ ...ex, H, payout: 1e6 })).toBeCloseTo(1e6 * Math.exp(-rd * T), 6);
    }
  });

  it('DNT with one barrier far away = single no-touch on the near one', () => {
    const dnt = doubleNoTouch({ ...ex, L: 0.77, U: 5 });
    expect(dnt).toBeCloseTo(noTouch({ ...ex, H: 0.77 }), 12);
  });

  it('knock-out with a far barrier = vanilla; knock-in = vanilla − knock-out', () => {
    const vanilla = gkPrice(S, K, T, vol, rd, rf, 'call');
    expect(barrierPrice({ ...ex, K, H: 0.3, type: 'call', kind: 'down-and-out' })).toBeCloseTo(
      vanilla,
      14,
    );
    const ko = barrierPrice({ ...ex, K, H: 0.83, type: 'call', kind: 'up-and-out' });
    const ki = barrierPrice({ ...ex, K, H: 0.83, type: 'call', kind: 'up-and-in' });
    expect(ki + ko).toBeCloseTo(vanilla, 14);
  });
});
