import { describe, expect, it } from 'vitest';
import { EXAMPLE as E, EXAMPLE_STRIKE as KATM } from '@/lib/fx/example';
import { gkPrice, type OptionType } from '@/lib/fx/vanilla';
import {
  barrierBreakdown,
  barrierDirection,
  barrierPrice,
  digitalAsset,
  digitalCash,
  dntBreakdown,
  dntDefaultTerms,
  dntSeries,
  dntTouchProbabilities,
  doubleNoTouch,
  doubleOneTouch,
  forwardPathHitTime,
  haugSetup,
  haugTerms,
  hitDiscountFactor,
  hitDiscountFactorByQuadrature,
  isBarrierTouched,
  isReverse,
  logNormCdf,
  noTouch,
  noTouchProbabilityRaw,
  oneTouch,
  powTimesCdf,
  touchProbability,
  type BarrierKind,
  type BarrierParams,
} from '@/lib/fx/exotics';

const S = E.spot;
const T = E.T;
const vol = E.vol;
const rd = E.rd;
const rf = E.rf;
const TYPES: OptionType[] = ['call', 'put'];
const KINDS: BarrierKind[] = ['down-and-out', 'down-and-in', 'up-and-out', 'up-and-in'];

function partner(kind: BarrierKind): BarrierKind {
  const [dir, , io] = kind.split('-') as [string, string, string];
  return `${dir}-and-${io === 'in' ? 'out' : 'in'}` as BarrierKind;
}

describe('digitals', () => {
  // Central difference in K with step 1e-5, as in the brief.
  const h = 1e-5;
  const params: [number, number, number, number, number, number][] = [
    [S, KATM, T, vol, rd, rf],
    [S, 0.77, 1, 0.1, 0.01, 0.04],
    [100, 110, 0.5, 0.25, 0.08, 0.04],
  ];

  it('cash digital call ≈ −∂C/∂K, put ≈ +∂P/∂K (times payout)', () => {
    for (const [s, k, t, v, d, f] of params) {
      for (const payout of [1, 1_000_000]) {
        const dC =
          (gkPrice(s, k + h, t, v, d, f, 'call') - gkPrice(s, k - h, t, v, d, f, 'call')) / (2 * h);
        const dP =
          (gkPrice(s, k + h, t, v, d, f, 'put') - gkPrice(s, k - h, t, v, d, f, 'put')) / (2 * h);
        expect(Math.abs(digitalCash(s, k, t, v, d, f, 'call', payout) - -dC * payout)).toBeLessThan(
          1e-7 * payout,
        );
        expect(Math.abs(digitalCash(s, k, t, v, d, f, 'put', payout) - dP * payout)).toBeLessThan(
          1e-7 * payout,
        );
      }
    }
  });

  it('call digital + put digital = e^(−rd T) · payout', () => {
    for (const [s, k, t, v, d, f] of params) {
      const sum =
        digitalCash(s, k, t, v, d, f, 'call', 250) + digitalCash(s, k, t, v, d, f, 'put', 250);
      expect(Math.abs(sum - 250 * Math.exp(-d * t))).toBeLessThan(1e-10);
      const assets = digitalAsset(s, k, t, v, d, f, 'call') + digitalAsset(s, k, t, v, d, f, 'put');
      expect(Math.abs(assets - s * Math.exp(-f * t))).toBeLessThan(1e-12);
    }
  });

  it('vanilla = asset-or-nothing − K · cash-or-nothing (building blocks)', () => {
    for (const [s, k, t, v, d, f] of params) {
      const call =
        digitalAsset(s, k, t, v, d, f, 'call') - k * digitalCash(s, k, t, v, d, f, 'call');
      const put = k * digitalCash(s, k, t, v, d, f, 'put') - digitalAsset(s, k, t, v, d, f, 'put');
      expect(Math.abs(call - gkPrice(s, k, t, v, d, f, 'call'))).toBeLessThan(1e-12);
      expect(Math.abs(put - gkPrice(s, k, t, v, d, f, 'put'))).toBeLessThan(1e-12);
    }
  });

  it('expiry and zero vol: indicator, ½ exactly at the strike', () => {
    expect(digitalCash(0.81, 0.8, 0, vol, rd, rf, 'call', 10)).toBe(10);
    expect(digitalCash(0.81, 0.8, 0, vol, rd, rf, 'put', 10)).toBe(0);
    expect(digitalCash(0.8, 0.8, 0, vol, rd, rf, 'call', 10)).toBe(5);
    expect(digitalAsset(0.79, 0.8, -1, vol, rd, rf, 'put')).toBe(0.79);
    expect(digitalAsset(0.79, 0.8, 0, vol, rd, rf, 'call')).toBe(0);
    // vol 0: the forward S·e^((rd − rf)T) = 0.79303 decides
    expect(digitalCash(S, 0.796, T, 0, 0.01, rf, 'put')).toBeCloseTo(Math.exp(-0.01 * T), 15);
    expect(digitalCash(S, 0.79, T, 0, 0.01, rf, 'put')).toBe(0);
    expect(digitalAsset(S, 0.79, T, 0, rd, rf, 'call')).toBeCloseTo(S * Math.exp(-rf * T), 15);
  });
});

describe('barrier: Haug table (S = 100, T = 0.5, r = 0.08, b = 0.04, rebate 3)', () => {
  // Haug, "The Complete Guide to Option Pricing Formulas", standard barrier option values.
  // rd = r = 0.08, rf = r − b = 0.04. Columns: K, H, value at σ = 0.25, value at σ = 0.30.
  // The σ = 0.30 column differs from the printed table by 1e-4 in a few cells (rounding of
  // Haug's normal CDF approximation), hence the looser tolerance there.
  const TABLE: Record<string, [OptionType, BarrierKind, [number, number, number, number][]]> = {
    doc: [
      'call',
      'down-and-out',
      [
        [90, 95, 9.0246, 8.8334],
        [100, 95, 6.7924, 7.0285],
        [110, 95, 4.8759, 5.4137],
        [90, 100, 3, 3],
        [100, 100, 3, 3],
        [110, 100, 3, 3],
      ],
    ],
    uoc: [
      'call',
      'up-and-out',
      [
        [90, 105, 2.6789, 2.6341],
        [100, 105, 2.358, 2.4389],
        [110, 105, 2.3453, 2.4315],
      ],
    ],
    dic: [
      'call',
      'down-and-in',
      [
        [90, 95, 7.7627, 9.0093],
        [100, 95, 4.0109, 5.137],
        [110, 95, 2.0576, 2.8517],
        [90, 100, 13.8333, 14.8816],
        [100, 100, 7.8494, 9.2045],
        [110, 100, 3.9795, 5.3043],
      ],
    ],
    uic: [
      'call',
      'up-and-in',
      [
        [90, 105, 14.1112, 15.2098],
        [100, 105, 8.4482, 9.7278],
        [110, 105, 4.591, 5.835],
      ],
    ],
    dop: [
      'put',
      'down-and-out',
      [
        [90, 95, 2.2798, 2.417],
        [100, 95, 2.2947, 2.4258],
        [110, 95, 2.6252, 2.6246],
        [90, 100, 3, 3],
        [100, 100, 3, 3],
        [110, 100, 3, 3],
      ],
    ],
    uop: [
      'put',
      'up-and-out',
      [
        [90, 105, 3.776, 4.2293],
        [100, 105, 5.4932, 5.8032],
        [110, 105, 7.5187, 7.5649],
      ],
    ],
    dip: [
      'put',
      'down-and-in',
      [
        [90, 95, 2.9586, 3.8769],
        [100, 95, 6.5677, 7.7989],
        [110, 95, 11.9752, 13.3078],
        [90, 100, 2.2845, 3.3328],
        [100, 100, 5.9085, 7.2636],
        [110, 100, 11.6465, 12.9713],
      ],
    ],
    uip: [
      'put',
      'up-and-in',
      [
        [90, 105, 1.4653, 2.0658],
        [100, 105, 3.3721, 4.4226],
        [110, 105, 7.0846, 8.3686],
      ],
    ],
  };

  for (const [name, [type, kind, rows]] of Object.entries(TABLE)) {
    it(`${name}: ${kind} ${type}`, () => {
      for (const [K, H, v25, v30] of rows) {
        const base = { S: 100, K, H, T: 0.5, rd: 0.08, rf: 0.04, type, kind, rebate: 3 };
        expect(Math.abs(barrierPrice({ ...base, vol: 0.25 }) - v25)).toBeLessThan(5.1e-5);
        expect(Math.abs(barrierPrice({ ...base, vol: 0.3 }) - v30)).toBeLessThan(1.6e-4);
      }
    });
  }
});

describe('barrier: in-out parity and limits', () => {
  const KS = [0.72, 0.76, KATM, 0.8, 0.82, 0.86];
  const DOWN_H = [0.7, 0.76, 0.79, 0.7999];
  const UP_H = [0.8001, 0.81, 0.84, 0.9];

  it('KI + KO = vanilla for all 8 types, strikes above and below the barrier', () => {
    const sets = [
      { T, vol, rd, rf },
      { T: 1, vol: 0.15, rd: 0.02, rf: 0.005 },
      { T: 0.05, vol: 0.05, rd: -0.0075, rf: 0.01 },
    ];
    let checked = 0;
    for (const m of sets) {
      for (const type of TYPES) {
        const vanilla = (K: number) => gkPrice(S, K, m.T, m.vol, m.rd, m.rf, type);
        for (const K of KS) {
          for (const H of DOWN_H) {
            const p = { S, K, H, ...m, type };
            const sum =
              barrierPrice({ ...p, kind: 'down-and-in' }) +
              barrierPrice({ ...p, kind: 'down-and-out' });
            expect(Math.abs(sum - vanilla(K))).toBeLessThan(1e-12);
            checked++;
          }
          for (const H of UP_H) {
            const p = { S, K, H, ...m, type };
            const sum =
              barrierPrice({ ...p, kind: 'up-and-in' }) +
              barrierPrice({ ...p, kind: 'up-and-out' });
            expect(Math.abs(sum - vanilla(K))).toBeLessThan(1e-12);
            checked++;
          }
        }
      }
    }
    expect(checked).toBe(3 * 2 * KS.length * 8);
  });

  it('parity also holds when the barrier is already touched', () => {
    for (const type of TYPES) {
      const p = { S, K: KATM, H: 0.81, T, vol, rd, rf, type };
      expect(barrierPrice({ ...p, kind: 'down-and-out' })).toBe(0);
      expect(barrierPrice({ ...p, kind: 'down-and-in' })).toBe(
        gkPrice(S, KATM, T, vol, rd, rf, type),
      );
    }
  });

  it('far barrier: knock-out → vanilla, knock-in → 0', () => {
    for (const type of TYPES) {
      for (const K of KS) {
        const vanilla = gkPrice(S, K, T, vol, rd, rf, type);
        for (const [H, out, inn] of [
          [0.3, 'down-and-out', 'down-and-in'],
          [3, 'up-and-out', 'up-and-in'],
        ] as const) {
          const p = { S, K, H, T, vol, rd, rf, type };
          expect(Math.abs(barrierPrice({ ...p, kind: out }) - vanilla)).toBeLessThan(1e-12);
          expect(Math.abs(barrierPrice({ ...p, kind: inn }))).toBeLessThan(1e-12);
        }
      }
    }
  });

  it('0 ≤ KO ≤ vanilla and KI ≥ 0 (no rebate)', () => {
    for (const type of TYPES) {
      for (const K of KS) {
        const vanilla = gkPrice(S, K, T, vol, rd, rf, type);
        for (const kind of KINDS) {
          for (const H of kind.startsWith('down') ? DOWN_H : UP_H) {
            const v = barrierPrice({ S, K, H, T, vol, rd, rf, type, kind });
            expect(v).toBeGreaterThanOrEqual(-1e-14);
            if (kind.endsWith('out')) expect(v).toBeLessThanOrEqual(vanilla + 1e-14);
          }
        }
      }
    }
  });

  it('KO → 0 as the spot approaches the barrier (no rebate), → rebate with rebate', () => {
    for (const type of TYPES) {
      for (const K of KS) {
        for (const [kind, H, side] of [
          ['down-and-out', 0.78, 1],
          ['up-and-out', 0.82, -1],
        ] as const) {
          const near = { S: H * (1 + side * 1e-9), K, H, T, vol, rd, rf, type, kind };
          expect(Math.abs(barrierPrice(near))).toBeLessThan(1e-6);
          expect(Math.abs(barrierPrice({ ...near, rebate: 0.01 }) - 0.01)).toBeLessThan(1e-6);
          // further away the option is worth more (unless the barrier kills every payoff)
          const dead =
            type === 'call' ? kind === 'up-and-out' && K >= H : kind === 'down-and-out' && K <= H;
          const away = { ...near, S: H * (1 + side * 0.01) };
          if (!dead) expect(barrierPrice(away)).toBeGreaterThan(barrierPrice(near));
        }
      }
    }
  });

  it('rebates are touches: E = rebate × no-touch, F = rebate × one-touch paid at hit', () => {
    const R = 0.004;
    for (const type of TYPES) {
      for (const [kind, H] of [
        ['down-and-out', 0.77],
        ['down-and-in', 0.77],
        ['up-and-out', 0.83],
        ['up-and-in', 0.83],
      ] as const) {
        const p = { S, K: KATM, H, T, vol, rd: 0.01, rf, type, kind };
        const diff = barrierPrice({ ...p, rebate: R }) - barrierPrice(p);
        const touch = kind.endsWith('out')
          ? oneTouch({ S, H, T, vol, rd: 0.01, rf, payout: R, payAt: 'hit' })
          : noTouch({ S, H, T, vol, rd: 0.01, rf, payout: R });
        expect(Math.abs(diff - touch)).toBeLessThan(1e-15);
      }
    }
  });

  it('K = H: both columns of the recipe table agree (continuity in K)', () => {
    for (const type of TYPES) {
      for (const [kind, H] of [
        ['down-and-out', 0.78],
        ['down-and-in', 0.78],
        ['up-and-out', 0.82],
        ['up-and-in', 0.82],
      ] as const) {
        const p = { S, H, T, vol, rd, rf, type, kind, rebate: 0.002 };
        const at = barrierPrice({ ...p, K: H });
        expect(Math.abs(barrierPrice({ ...p, K: H * (1 - 1e-10) }) - at)).toBeLessThan(1e-9);
        expect(Math.abs(barrierPrice({ ...p, K: H * (1 + 1e-10) }) - at)).toBeLessThan(1e-9);
      }
    }
  });

  it('up-and-out call with H ≤ K is only its rebate; down-and-out put with H ≥ K likewise', () => {
    const uoc = barrierBreakdown({
      S,
      K: 0.85,
      H: 0.82,
      T,
      vol,
      rd,
      rf,
      type: 'call',
      kind: 'up-and-out',
    });
    expect(uoc.formula).toBe('F');
    expect(uoc.price).toBe(0);
    const dop = barrierBreakdown({
      S,
      K: 0.76,
      H: 0.78,
      T,
      vol,
      rd,
      rf,
      type: 'put',
      kind: 'down-and-out',
      rebate: 1,
    });
    expect(dop.formula).toBe('F');
    expect(dop.price).toBeCloseTo(oneTouch({ S, H: 0.78, T, vol, rd, rf, payAt: 'hit' }), 15);
  });

  it('reverse knock-out is much cheaper than the vanilla (the barrier cuts the payoff)', () => {
    const p: BarrierParams = {
      S,
      K: KATM,
      H: 0.83,
      T,
      vol,
      rd,
      rf,
      type: 'call',
      kind: 'up-and-out',
    };
    expect(isReverse(p.kind, p.type, p.K, p.H)).toBe(true);
    expect(barrierPrice(p)).toBeLessThan(0.5 * gkPrice(S, KATM, T, vol, rd, rf, 'call'));
  });
});

describe('barrier: breakdown, special cases, helpers', () => {
  const base = { S, K: KATM, T, vol, rd, rf };

  it('breakdown names the Haug recipe and returns all six terms', () => {
    const b = barrierBreakdown({ ...base, H: 0.77, type: 'call', kind: 'down-and-in' });
    expect(b.case).toBe('formula');
    expect(b.formula).toBe('C + E');
    expect(b.eta).toBe(1);
    expect(b.phi).toBe(1);
    expect(b.terms).not.toBeNull();
    expect(b.price).toBeCloseTo(b.terms!.C + b.terms!.E, 16);
    // term A is the vanilla
    expect(b.terms!.A).toBeCloseTo(gkPrice(S, KATM, T, vol, rd, rf, 'call'), 15);
    const up = barrierBreakdown({ ...base, H: 0.82, type: 'put', kind: 'up-and-out' });
    expect(up.eta).toBe(-1);
    expect(up.phi).toBe(-1);
    expect(up.formula).toBe('A − C + F');
  });

  it('haugTerms: rebate 0 gives E = F = 0; A is the vanilla for both types', () => {
    for (const phi of [1, -1] as const) {
      const t = haugTerms(S, KATM, 0.77, T, vol, rd, rf, 1, phi);
      expect(t.E).toBe(0);
      expect(t.F).toBe(0);
      expect(t.A).toBeCloseTo(gkPrice(S, KATM, T, vol, rd, rf, phi === 1 ? 'call' : 'put'), 15);
    }
  });

  it('touched: knock-out = rebate, knock-in = vanilla', () => {
    const ko = barrierBreakdown({
      ...base,
      H: 0.79,
      type: 'call',
      kind: 'up-and-out',
      rebate: 0.003,
    });
    expect(ko).toMatchObject({ case: 'touched', price: 0.003, terms: null });
    const ki = barrierBreakdown({ ...base, H: 0.8, type: 'put', kind: 'down-and-in' });
    expect(ki.case).toBe('touched');
    expect(ki.price).toBe(gkPrice(S, KATM, T, vol, rd, rf, 'put'));
  });

  it('expired: knock-out = payoff, knock-in = rebate', () => {
    const p = { S: 0.81, K: 0.79, H: 0.75, T: 0, vol, rd, rf, type: 'call' as const };
    expect(barrierBreakdown({ ...p, kind: 'down-and-out' })).toMatchObject({ case: 'expired' });
    expect(barrierPrice({ ...p, kind: 'down-and-out' })).toBeCloseTo(0.02, 15);
    expect(barrierPrice({ ...p, kind: 'down-and-in', rebate: 0.001 })).toBe(0.001);
  });

  it('zero vol: the forward path decides (b = rd − rf < 0, spot drifts down)', () => {
    const m = { S, K: 0.78, T, vol: 0, rd: 0.01, rf: 0.045, type: 'put' as const };
    const tHit = forwardPathHitTime(S, 0.795, T, m.rd, m.rf)!;
    expect(tHit).toBeCloseTo(Math.log(0.795 / S) / (m.rd - m.rf), 15);
    expect(tHit).toBeGreaterThan(0);
    expect(tHit).toBeLessThan(T);
    const fwd = S * Math.exp((m.rd - m.rf) * T);
    const vanilla = Math.exp(-m.rd * T) * Math.max(m.K - fwd, 0);
    // H = 0.795 is reached at t*, H = 0.7 is not
    expect(barrierPrice({ ...m, H: 0.795, kind: 'down-and-out', rebate: 1 })).toBeCloseTo(
      Math.exp(-m.rd * tHit),
      15,
    );
    expect(barrierPrice({ ...m, H: 0.795, kind: 'down-and-in' })).toBeCloseTo(vanilla, 15);
    expect(barrierPrice({ ...m, H: 0.7, kind: 'down-and-out' })).toBeCloseTo(vanilla, 15);
    expect(barrierPrice({ ...m, H: 0.7, kind: 'down-and-in', rebate: 1 })).toBeCloseTo(
      Math.exp(-m.rd * T),
      15,
    );
  });

  it('forwardPathHitTime: no hit when moving away, with zero carry or beyond T', () => {
    expect(forwardPathHitTime(S, 0.81, T, 0, 0.035)).toBeNull(); // drifts down, barrier above
    expect(forwardPathHitTime(S, 0.79, T, 0.02, 0.02)).toBeNull(); // b = 0
    expect(forwardPathHitTime(S, 0.7, T, 0, 0.035)).toBeNull(); // too far for 3 months
    expect(forwardPathHitTime(S, S, T, 0, 0.035)).toBe(0);
  });

  it('isReverse: barrier in the money', () => {
    expect(isReverse('up-and-out', 'call', 0.8, 0.85)).toBe(true);
    expect(isReverse('up-and-in', 'call', 0.8, 0.85)).toBe(true);
    expect(isReverse('up-and-out', 'call', 0.86, 0.85)).toBe(false);
    expect(isReverse('down-and-out', 'call', 0.8, 0.75)).toBe(false);
    expect(isReverse('down-and-out', 'put', 0.8, 0.75)).toBe(true);
    expect(isReverse('down-and-out', 'put', 0.7, 0.75)).toBe(false);
    expect(isReverse('up-and-out', 'put', 0.8, 0.85)).toBe(false);
  });

  it('isBarrierTouched', () => {
    expect(isBarrierTouched('down-and-out', 0.8, 0.8)).toBe(true);
    expect(isBarrierTouched('down-and-in', 0.81, 0.8)).toBe(false);
    expect(isBarrierTouched('up-and-out', 0.8, 0.8)).toBe(true);
    expect(isBarrierTouched('up-and-in', 0.79, 0.8)).toBe(false);
  });

  it('rejects non-positive S, K or H', () => {
    const p: BarrierParams = {
      S,
      K: KATM,
      H: 0.77,
      T,
      vol,
      rd,
      rf,
      type: 'call',
      kind: 'down-and-out',
    };
    expect(() => barrierPrice({ ...p, S: 0 })).toThrow(RangeError);
    expect(() => barrierPrice({ ...p, K: -1 })).toThrow(RangeError);
    expect(() => barrierPrice({ ...p, H: Number.NaN })).toThrow(RangeError);
  });

  it('partner() pairs every kind with its in/out twin', () => {
    expect(KINDS.map(partner)).toEqual(['down-and-in', 'down-and-out', 'up-and-in', 'up-and-out']);
  });
});

describe('one-touch / no-touch', () => {
  const sets = [
    { S, T, vol, rd, rf },
    { S, T: 1, vol: 0.12, rd: 0.02, rf: 0.005 },
    { S: 100, T: 0.5, vol: 0.25, rd: 0.08, rf: 0.04 },
  ];

  it('pay at expiry: one-touch + no-touch = e^(−rd T) · payout (up and down)', () => {
    for (const m of sets) {
      for (const H of [m.S * 0.9, m.S * 0.97, m.S * 1.03, m.S * 1.1]) {
        const ot = oneTouch({ ...m, H, payout: 7 });
        const nt = noTouch({ ...m, H, payout: 7 });
        expect(Math.abs(ot + nt - 7 * Math.exp(-m.rd * m.T))).toBeLessThan(1e-12);
        expect(ot).toBeGreaterThan(0);
        expect(nt).toBeGreaterThan(0);
      }
    }
  });

  it('independent PDE reference values (one-touch paid at hit)', () => {
    // Crank-Nicolson finite differences in ln S (2000 nodes, 4000 steps), computed offline.
    const ref: [number, number, number, number, number, number, number][] = [
      [0.8, 0.84, 0.25, 0.08, 0.0, 0.035, 0.163558],
      [0.8, 0.76, 0.25, 0.08, 0.0, 0.035, 0.266622],
      [100, 105, 0.5, 0.25, 0.08, 0.04, 0.781783],
      [100, 95, 0.5, 0.25, 0.08, 0.04, 0.759946],
      // negative CHF-style rate with λ² < 0: the quadrature fallback
      [1.0, 0.95, 1.0, 0.1, -0.0075, -0.002, 0.642059],
    ];
    for (const [s, H, t, v, d, f, value] of ref) {
      expect(
        Math.abs(oneTouch({ S: s, H, T: t, vol: v, rd: d, rf: f, payAt: 'hit' }) - value),
      ).toBeLessThan(5e-6);
    }
    expect(haugSetup(1, 0.1, -0.0075, -0.002).lambda2).toBeLessThan(0);
  });

  it('closed form and quadrature agree where both apply', () => {
    for (const [s, H, t, v, d, f] of [
      [0.8, 0.84, 0.25, 0.08, 0.0, 0.035],
      [0.8, 0.76, 1, 0.1, 0.02, 0.01],
      [1.0, 0.95, 1.0, 0.1, -0.005, -0.04],
    ] as const) {
      const eta = H < s ? 1 : -1;
      const closed = hitDiscountFactor(s, H, t, v, d, f, eta);
      expect(Math.abs(hitDiscountFactorByQuadrature(s, H, t, v, d, f, eta) - closed)).toBeLessThan(
        1e-8,
      );
      expect(
        Math.abs(hitDiscountFactorByQuadrature(s, H, t, v, d, f, eta, 401) - closed),
      ).toBeLessThan(1e-8);
    }
  });

  it('rd = 0 (CHF in the example): paying at hit or at expiry is worth the same', () => {
    for (const H of [0.76, 0.84]) {
      const hit = oneTouch({ S, H, T, vol, rd, rf, payAt: 'hit' });
      expect(Math.abs(hit - oneTouch({ S, H, T, vol, rd, rf }))).toBeLessThan(1e-12);
    }
  });

  it('rd > 0: paying at hit is worth more (paid earlier)', () => {
    const m = sets[2]!;
    expect(oneTouch({ ...m, H: 105, payAt: 'hit' })).toBeGreaterThan(oneTouch({ ...m, H: 105 }));
  });

  it('zero log drift: touch probability = 2 × probability of finishing beyond H', () => {
    // b = σ²/2 makes ln S driftless; the reflection principle gives exactly a factor 2.
    const v = 0.1;
    const m = { S, T: 0.5, vol: v, rd: 0.5 * v * v, rf: 0 };
    for (const [H, type] of [
      [0.84, 'call'],
      [0.76, 'put'],
    ] as const) {
      const digitalProb = digitalCash(S, H, m.T, v, m.rd, m.rf, type) / Math.exp(-m.rd * m.T);
      expect(Math.abs(touchProbability({ ...m, H }) - 2 * digitalProb)).toBeLessThan(1e-12);
    }
  });

  it('touchProbability = 1 − no-touch / (payout · e^(−rd T))', () => {
    const m = sets[1]!;
    for (const H of [0.75, 0.86]) {
      const p = touchProbability({ ...m, H });
      expect(Math.abs(p - (1 - noTouch({ ...m, H }) / Math.exp(-m.rd * m.T)))).toBeLessThan(1e-12);
    }
  });

  it('direction: inferred from H vs S, or explicit', () => {
    expect(barrierDirection(0.8, 0.85)).toBe('up');
    expect(barrierDirection(0.8, 0.75)).toBe('down');
    expect(barrierDirection(0.8, 0.8)).toBe('down');
    expect(barrierDirection(0.8, 0.75, 'up')).toBe('up');
    // explicit 'up' with H below spot: already touched
    expect(noTouch({ S, H: 0.75, T, vol, rd, rf, direction: 'up' })).toBe(0);
    expect(oneTouch({ S, H: 0.75, T, vol, rd, rf, direction: 'up', payAt: 'hit', payout: 3 })).toBe(
      3,
    );
    expect(touchProbability({ S, H: 0.75, T, vol, rd, rf, direction: 'up' })).toBe(1);
  });

  it('special cases: touched, expired, zero vol', () => {
    const m = { S, T, vol, rd: 0.01, rf: 0.045 };
    expect(oneTouch({ ...m, H: S })).toBeCloseTo(Math.exp(-0.01 * T), 15);
    expect(oneTouch({ ...m, H: 0.84, T: 0 })).toBe(0);
    expect(noTouch({ ...m, H: 0.84, T: 0, payout: 2 })).toBe(2);
    expect(touchProbability({ ...m, H: 0.84, T: 0 })).toBe(0);
    // vol 0: forward drifts down from 0.80; reaches 0.795 at t*, never reaches 0.85
    const tHit = forwardPathHitTime(S, 0.795, T, m.rd, m.rf)!;
    expect(oneTouch({ ...m, vol: 0, H: 0.795, payAt: 'hit' })).toBeCloseTo(
      Math.exp(-0.01 * tHit),
      15,
    );
    expect(oneTouch({ ...m, vol: 0, H: 0.795 })).toBeCloseTo(Math.exp(-0.01 * T), 15);
    expect(oneTouch({ ...m, vol: 0, H: 0.85 })).toBe(0);
    expect(noTouch({ ...m, vol: 0, H: 0.795 })).toBe(0);
    expect(noTouch({ ...m, vol: 0, H: 0.85 })).toBeCloseTo(Math.exp(-0.01 * T), 15);
    expect(touchProbability({ ...m, vol: 0, H: 0.795 })).toBe(1);
    expect(touchProbability({ ...m, vol: 0, H: 0.85 })).toBe(0);
  });

  it('far barrier: no-touch → e^(−rd T), one-touch → 0', () => {
    const m = sets[1]!;
    expect(Math.abs(noTouch({ ...m, H: 2 }) - Math.exp(-m.rd * m.T))).toBeLessThan(1e-12);
    expect(oneTouch({ ...m, H: 0.2, payAt: 'hit' })).toBeLessThan(1e-12);
  });

  it('rejects non-positive spot or barrier', () => {
    expect(() => oneTouch({ S: 0, H: 0.8, T, vol, rd, rf })).toThrow(RangeError);
    expect(() => noTouch({ S, H: -1, T, vol, rd, rf })).toThrow(RangeError);
    expect(() => touchProbability({ S, H: 0, T, vol, rd, rf })).toThrow(RangeError);
  });
});

describe('double no-touch (Hui series)', () => {
  it('independent PDE reference values', () => {
    // Crank-Nicolson finite differences in ln S (1600 nodes, 4000 steps), computed offline.
    const ref: [number, number, number, number, number, number, number, number][] = [
      [0.8, 0.76, 0.84, 0.25, 0.08, 0.0, 0.035, 0.570196],
      [0.8, 0.75, 0.85, 0.5, 0.08, 0.0, 0.035, 0.448977],
      [100, 90, 110, 0.5, 0.25, 0.08, 0.04, 0.02646],
      [1.1, 1.05, 1.2, 1.0, 0.1, 0.02, 0.01, 0.070294],
      [0.8, 0.7, 0.9, 0.1, 0.08, 0.0, 0.035, 0.999998],
    ];
    for (const [s, L, U, t, v, d, f, value] of ref) {
      expect(
        Math.abs(doubleNoTouch({ S: s, L, U, T: t, vol: v, rd: d, rf: f }) - value),
      ).toBeLessThan(2e-6);
    }
  });

  it('lies in [0, e^(−rd T) · payout] and is 0 at the barriers', () => {
    const L = 0.76;
    const U = 0.84;
    for (const t of [0.01, 0.25, 1, 3]) {
      for (const s of [0.7601, 0.77, 0.79, 0.8, 0.82, 0.8399]) {
        const v = doubleNoTouch({ S: s, L, U, T: t, vol, rd: 0.02, rf, payout: 5 });
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(5 * Math.exp(-0.02 * t));
      }
    }
    expect(doubleNoTouch({ S: L, L, U, T, vol, rd, rf })).toBe(0);
    expect(doubleNoTouch({ S: U, L, U, T, vol, rd, rf })).toBe(0);
    expect(doubleNoTouch({ S: L * (1 + 1e-9), L, U, T, vol, rd, rf })).toBeLessThan(1e-6);
    expect(doubleNoTouch({ S: U * (1 - 1e-9), L, U, T, vol, rd, rf })).toBeLessThan(1e-6);
    // the raw series vanishes at the corridor ends (sin 0 = sin iπ = 0)
    expect(Math.abs(dntSeries(L, L, U, T, vol, rd, rf, 1, 200).value)).toBeLessThan(1e-12);
    expect(Math.abs(dntSeries(U, L, U, T, vol, rd, rf, 1, 200).value)).toBeLessThan(1e-12);
  });

  it('wide corridor and short T → e^(−rd T); narrow corridor or long T → 0', () => {
    const wide = doubleNoTouch({ S, L: 0.4, U: 1.6, T: 1 / 365, vol, rd: 0.02, rf, payout: 1 });
    expect(Math.abs(wide - Math.exp(-0.02 / 365))).toBeLessThan(1e-12);
    expect(doubleNoTouch({ S, L: 0.799, U: 0.801, T, vol, rd, rf })).toBeLessThan(1e-12);
    expect(doubleNoTouch({ S, L: 0.7, U: 0.9, T: 30, vol, rd, rf })).toBeLessThan(1e-6);
  });

  it('falls with longer T and with higher vol', () => {
    const p = { S, L: 0.76, U: 0.84, T, vol, rd, rf };
    expect(doubleNoTouch({ ...p, T: 0.5 })).toBeLessThan(doubleNoTouch(p));
    expect(doubleNoTouch({ ...p, vol: 0.1 })).toBeLessThan(doubleNoTouch(p));
  });

  it('one barrier far away → single no-touch on the other barrier', () => {
    const m = { S, T, vol, rd: 0.01, rf };
    const lowOnly = doubleNoTouch({ ...m, L: 0.77, U: 5 });
    expect(Math.abs(lowOnly - noTouch({ ...m, H: 0.77 }))).toBeLessThan(1e-10);
    const highOnly = doubleNoTouch({ ...m, L: 0.1, U: 0.83 });
    expect(Math.abs(highOnly - noTouch({ ...m, H: 0.83 }))).toBeLessThan(1e-10);
  });

  it('double one-touch + DNT = e^(−rd T) · payout', () => {
    const p = { S, L: 0.77, U: 0.83, T, vol, rd: 0.01, rf, payout: 3 };
    expect(Math.abs(doubleOneTouch(p) + doubleNoTouch(p) - 3 * Math.exp(-0.01 * T))).toBeLessThan(
      1e-14,
    );
    expect(doubleOneTouch({ ...p, S: 0.9 })).toBeCloseTo(3 * Math.exp(-0.01 * T), 15);
    expect(doubleOneTouch({ ...p, T: 0 })).toBe(0);
  });

  it('driftless log spot (b = σ²/2) and a symmetric corridor: symmetric in ln S', () => {
    const m = { L: 0.75, U: 0.85, T: 0.5, vol: 0.1, rd: 0.005, rf: 0 };
    const mid = Math.sqrt(m.L * m.U);
    for (const k of [0.01, 0.03]) {
      const a = doubleNoTouch({ ...m, S: mid * Math.exp(k) });
      const b = doubleNoTouch({ ...m, S: mid * Math.exp(-k) });
      expect(Math.abs(a - b)).toBeLessThan(1e-12);
    }
  });

  it('series terms: adaptive default, explicit count, clamping', () => {
    const p = { S, L: 0.76, U: 0.84, T, vol, rd, rf };
    expect(Math.abs(doubleNoTouch(p) - doubleNoTouch({ ...p, terms: 50 }))).toBeLessThan(1e-12);
    expect(dntDefaultTerms(Math.log(0.84 / 0.76), vol, T)).toBe(50);
    expect(dntDefaultTerms(Math.log(4), vol, 1 / 365)).toBeGreaterThan(50);
    expect(dntDefaultTerms(Math.log(1e6), 0.01, 1e-6)).toBe(20_000);
    // a 1-term series is a poor approximation, but the result stays inside the bounds
    const one = doubleNoTouch({ ...p, L: 0.5, U: 1.3, T: 0.01, terms: 1 });
    expect(one).toBeGreaterThanOrEqual(0);
    expect(one).toBeLessThanOrEqual(1);
  });

  it('special cases: expired, zero vol, invalid corridor', () => {
    const p = { S, L: 0.79, U: 0.81, T, vol, rd: 0.01, rf, payout: 2 };
    expect(doubleNoTouch({ ...p, T: 0 })).toBe(2);
    // vol 0: the forward drifts from 0.8000 down to 0.7950 (b = −2.5 %), so L = 0.79 is
    // never reached but L = 0.796 is.
    expect(doubleNoTouch({ ...p, vol: 0 })).toBeCloseTo(2 * Math.exp(-0.01 * T), 15);
    expect(doubleNoTouch({ ...p, vol: 0, L: 0.796 })).toBe(0);
    expect(doubleNoTouch({ ...p, vol: 0, rf: -0.05, U: 0.805 })).toBe(0);
    expect(() => doubleNoTouch({ ...p, L: 0.81, U: 0.79 })).toThrow(RangeError);
    expect(() => doubleNoTouch({ ...p, L: 0 })).toThrow(RangeError);
  });

  it('breakdown: method, terms and error estimate', () => {
    const series = dntBreakdown({ S, L: 0.76, U: 0.84, T, vol, rd, rf });
    expect(series.method).toBe('series');
    expect(series.terms).toBe(50);
    expect(series.errorEstimate).toBeLessThan(1e-14);
    // a wide corridor for one day: no path touches both barriers → inclusion–exclusion
    const wide = dntBreakdown({ S, L: 0.4, U: 1.6, T: 1 / 365, vol, rd, rf });
    expect(wide).toMatchObject({ method: 'independent', terms: 0 });
    const p = { S, L: 0.79, U: 0.81, T, vol, rd, rf };
    expect(dntBreakdown({ ...p, S: 0.9 }).method).toBe('touched');
    expect(dntBreakdown({ ...p, T: 0 }).method).toBe('expired');
    expect(dntBreakdown({ ...p, vol: 0 }).method).toBe('no-vol');
    expect(dntBreakdown({ ...p, terms: 7 })).toMatchObject({ method: 'series', terms: 7 });
  });

  it('inclusion–exclusion: 1 − P(touch L) − P(touch U), exact when both cannot be touched', () => {
    const m = { S, L: 0.7, U: 0.9, T: 0.05, vol, rd: 0.01, rf };
    const { touchL, touchU, bothBound } = dntTouchProbabilities(
      m.S,
      m.L,
      m.U,
      m.T,
      m.vol,
      m.rd,
      m.rf,
    );
    expect(bothBound).toBeLessThan(1e-16);
    const indep = Math.exp(-m.rd * m.T) * (1 - touchL - touchU);
    expect(Math.abs(doubleNoTouch(m) - indep)).toBeLessThan(1e-15);
    // the forced series agrees
    expect(Math.abs(doubleNoTouch({ ...m, terms: 2000 }) - indep)).toBeLessThan(1e-12);
    // narrow corridor: touching both is likely, the bound is large
    expect(dntTouchProbabilities(S, 0.79, 0.81, T, vol, rd, rf).bothBound).toBeGreaterThan(0.5);
  });

  it('low vol with large carry: the cancelling series is replaced by inclusion–exclusion', () => {
    // σ = 1 %, b = −10.75 %: the series terms reach 1e65 and cancel
    const m = { S, L: 0.6, U: 0.801, T: 2, vol: 0.01, rd: -0.0075, rf: 0.1 };
    const s = dntSeries(m.S, m.L, m.U, m.T, m.vol, m.rd, m.rf, 1, 200);
    expect(s.errorEstimate).toBeGreaterThan(1);
    const b = dntBreakdown(m);
    expect(b.method).toBe('independent');
    expect(b.errorEstimate).toBeLessThan(1e-8);
    expect(
      Math.abs(
        b.price - (noTouch({ ...m, H: m.L }) + noTouch({ ...m, H: m.U }) - Math.exp(-m.rd * m.T)),
      ),
    ).toBeLessThan(1e-15);
    // σ = 0.2 %: the series even overflows to NaN
    const n = { S, L: 0.4, U: 0.801, T: 2, vol: 0.002, rd: 0, rf: 0.1 };
    expect(Number.isNaN(dntSeries(n.S, n.L, n.U, n.T, n.vol, n.rd, n.rf, 1, 100).value)).toBe(true);
    expect(doubleNoTouch(n)).toBeCloseTo(1, 12);
  });
});

describe('numerical robustness (extreme but valid inputs)', () => {
  it('logNormCdf and powTimesCdf', () => {
    expect(logNormCdf(0)).toBeCloseTo(Math.log(0.5), 15);
    expect(logNormCdf(-10)).toBeCloseTo(Math.log(7.619853024160527e-24), 7);
    // continuous across the switch to the asymptotic series at x = −37 (N to 1e-6 relative)
    expect(Math.abs(logNormCdf(-37 - 1e-9) - logNormCdf(-37 + 1e-9))).toBeLessThan(1e-6);
    expect(logNormCdf(-60)).toBeCloseTo(
      -1800 - Math.log(60) - 0.5 * Math.log(2 * Math.PI) + Math.log1p(-1 / 3600 + 3 / 3600 ** 2),
      9,
    );
    expect(powTimesCdf(2, 3, 0)).toBe(4);
    // 2^2000 overflows on its own, the product does not
    const v = powTimesCdf(2, 2000, -50);
    expect(Number.isFinite(v)).toBe(true);
    expect(Math.log(v)).toBeCloseTo(2000 * Math.log(2) + logNormCdf(-50), 9);
  });

  it('no NaN, parity and bounds across a grid down to σ = 0.1 % and negative rates', () => {
    let checked = 0;
    for (const v of [0.001, 0.005, 0.03, 0.3]) {
      for (const t of [1 / 365, 2]) {
        for (const [d, f] of [
          [-0.0075, 0],
          [0, 0.1],
          [0.05, -0.0075],
        ] as const) {
          const dfd = Math.exp(-d * t);
          for (const H of [0.4, 0.78, 0.82, 1.6]) {
            const dir = H < S ? 'down' : 'up';
            const nt = noTouch({ S, H, T: t, vol: v, rd: d, rf: f });
            const hit = oneTouch({ S, H, T: t, vol: v, rd: d, rf: f, payAt: 'hit' });
            expect(nt).toBeGreaterThanOrEqual(0);
            expect(nt).toBeLessThanOrEqual(dfd + 1e-12);
            expect(Number.isFinite(hit) && hit >= 0).toBe(true);
            for (const type of TYPES) {
              const p = { S, K: KATM, H, T: t, vol: v, rd: d, rf: f, type, rebate: 0 };
              const ko = barrierPrice({ ...p, kind: `${dir}-and-out` as BarrierKind });
              const ki = barrierPrice({ ...p, kind: `${dir}-and-in` as BarrierKind });
              const van = gkPrice(S, KATM, t, v, d, f, type);
              expect(Math.abs(ko + ki - van)).toBeLessThan(1e-10);
              checked++;
            }
          }
          for (const [L, U] of [
            [0.79, 0.81],
            [0.4, 1.6],
            [0.6, 0.801],
          ] as const) {
            const dnt = doubleNoTouch({ S, L, U, T: t, vol: v, rd: d, rf: f });
            const nL = noTouch({ S, H: L, T: t, vol: v, rd: d, rf: f });
            const nU = noTouch({ S, H: U, T: t, vol: v, rd: d, rf: f });
            // Bonferroni: nL + nU − dfd ≤ DNT ≤ min(nL, nU)
            expect(dnt).toBeLessThanOrEqual(Math.min(nL, nU) + 1e-9);
            expect(dnt).toBeGreaterThanOrEqual(nL + nU - dfd - 1e-9);
          }
        }
      }
    }
    expect(checked).toBe(4 * 2 * 3 * 4 * 2);
  });

  it('noTouchProbabilityRaw stays in [0, 1]', () => {
    for (const v of [0.001, 0.08]) {
      const p = noTouchProbabilityRaw(S, 0.4, 2, v, 0, 0.1, 1);
      expect(p).toBeGreaterThanOrEqual(0);
      expect(p).toBeLessThanOrEqual(1);
    }
  });
});
