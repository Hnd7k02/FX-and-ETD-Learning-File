/**
 * Theoretical maximum loss (src/lib/fx/mc/maxloss.ts): the bound comes from the product
 * parameters, and the very kernels that price the products reach it on a path at S = 0
 * (finite downwards) or lose linearly without limit as S rises (unbounded upwards).
 */
import { describe, expect, it } from 'vitest';
import { fairProduct } from '@/lib/fx/mc/fair';
import { lossLevels, maxLoss, type ZeroCostProduct } from '@/lib/fx/mc/maxloss';
import { createRng } from '@/lib/fx/mc/rng';
import { productPayoff, runKernel, type CashflowSink } from '@/lib/fx/mc/payoffs';
import {
  buildProduct,
  DEFAULT_MARKET as m,
  SOLVED_PARAM,
  type ZeroCostKind,
} from '@/lib/fx/mc/products';
import { M08, nums as n08 } from '@/lib/nums/m08';
import { M09, nums as n09 } from '@/lib/nums/m09';

const KINDS = Object.keys(SOLVED_PARAM) as ZeroCostKind[];

/** Daily path with every observation at S (path[0] = spot today). */
function flatPath(p: ZeroCostProduct, S: number): Float64Array {
  const days = p.fixingDays;
  const path = new Float64Array(days[days.length - 1]! + 1).fill(S);
  path[0] = m.spot;
  return path;
}

/** Loss (CHF against the market, > 0 = loss) of the kernel on a flat path at S. */
const lossAt = (p: ZeroCostProduct, S: number): number =>
  -productPayoff(flatPath(p, S), p, m).totalPnlQuote;

/** Loss of the kernel on given observations (one per fixing). */
function lossOn(p: ZeroCostProduct, obs: ArrayLike<number>): number {
  let pnl = 0;
  const sink: CashflowSink = {
    flow: (_i, _k, _b, _q, x) => (pnl += x),
    end: () => undefined,
  };
  runKernel(p, obs, 0, sink);
  return -pnl;
}

describe('maxLoss: check values (CHF against the market, fair parameters)', () => {
  it('accumulator: 26 × 2 × 40’000 × fair strike → 1’609’922', () => {
    const p = fairProduct('accumulator');
    const b = maxLoss(p);
    expect(Math.round(b.down)).toBe(1_609_922);
    expect(b.down).toBeCloseTo(26 * 2 * 40_000 * p.strike, 6);
    expect([b.up, b.total, b.kind]).toEqual([0, b.down, 'finite']);
  });

  it('TARF 1’804’296 and TPF 1’872’000: finite', () => {
    const tarf = maxLoss(fairProduct('tarf'));
    expect(Math.round(tarf.down)).toBe(1_804_296);
    expect(tarf.kind).toBe('finite');
    expect(tarf.total).toBe(tarf.down);
    const tpf = maxLoss(fairProduct('tpf'));
    expect(Math.round(tpf.down)).toBe(1_872_000);
    expect(tpf.down).toBeCloseTo(12 * 2 * 100_000 * fairProduct('tpf').strike, 6);
    expect(tpf.kind).toBe('finite');
  });

  it('pivot TARF 1’800’595 and RTPF 1’852’800 downwards, unlimited upwards', () => {
    const piv = fairProduct('pivotTarf');
    const bp = maxLoss(piv);
    expect(Math.round(bp.down)).toBe(1_800_595);
    expect(bp.downLevel).toBe(piv.lowerStrike);
    expect(bp.upLevel).toBe(piv.upperStrike);
    expect([bp.up, bp.total, bp.kind]).toEqual([Infinity, Infinity, 'unbounded']);
    const rtpf = fairProduct('rtpf');
    const br = maxLoss(rtpf);
    expect(Math.round(br.down)).toBe(1_852_800);
    expect([br.downLevel, br.upLevel]).toEqual([rtpf.lower, rtpf.upper]);
    expect(br.kind).toBe('unbounded');
  });

  it('decumulator: no loss downwards (knock-out), unlimited upwards', () => {
    const p = fairProduct('decumulator');
    const b = maxLoss(p);
    expect([b.down, b.downLevel, b.upLevel, b.kind]).toEqual([0, null, p.strike, 'unbounded']);
    expect(b.total).toBe(Infinity);
  });

  it('derives the bound from the parameters (fixings, leverage, notional, strike)', () => {
    const p = buildProduct('tarf', m, { strike: 0.7, notional: 50_000, leverage: 3 });
    const b = maxLoss(p);
    expect(b.slope).toBe(12 * 3 * 50_000);
    expect(b.down).toBeCloseTo(12 * 3 * 50_000 * 0.7, 8);
    expect(lossLevels(buildProduct('accumulator', m, { strike: 0.75 }))).toEqual({
      down: 0.75,
      up: null,
    });
  });
});

describe('the kernels reach the bound', () => {
  it.each(KINDS)('%s: every fixing at S = 0 loses exactly the bound downwards', (kind) => {
    const p = fairProduct(kind);
    const b = maxLoss(p);
    expect(lossAt(p, 0)).toBeCloseTo(b.down, 6);
    // S near 0: the bound is the limit, approached linearly and never exceeded
    const eps = 1e-6;
    const near = lossAt(p, eps);
    expect(near).toBeLessThanOrEqual(b.down);
    expect(near).toBeCloseTo(b.down - (b.downLevel === null ? 0 : b.slope * eps), 6);
  });

  it.each(['pivotTarf', 'rtpf', 'decumulator'] as const)(
    '%s: the loss grows linearly without limit as S rises',
    (kind) => {
      const p = fairProduct(kind);
      const b = maxLoss(p);
      const K = b.upLevel!;
      for (const S of [1, 2, 10, 1000]) {
        expect(lossAt(p, S)).toBeCloseTo(b.slope * (S - K), 4);
      }
      // equal steps in S give equal steps in the loss, and it passes any finite bound
      expect(lossAt(p, 3) - lossAt(p, 2)).toBeCloseTo(lossAt(p, 2) - lossAt(p, 1), 4);
      expect(lossAt(p, 1e6)).toBeGreaterThan(1e3 * maxLoss(fairProduct('tpf')).down);
    },
  );

  it.each(['accumulator', 'tarf', 'tpf'] as const)(
    '%s: no loss when S rises (knock-out, target or coupons)',
    (kind) => {
      const p = fairProduct(kind);
      for (const S of [1, 10, 1000]) expect(lossAt(p, S)).toBeLessThanOrEqual(0);
    },
  );

  it('no path loses more than the finite bound (random fixings, S ≥ 0)', () => {
    const rng = createRng(7);
    const rnd = () => rng.uniform();
    for (const kind of ['accumulator', 'tarf', 'tpf'] as const) {
      const p = fairProduct(kind);
      const b = maxLoss(p);
      const n = p.fixingDays.length;
      for (let k = 0; k < 500; k++) {
        const obs = Float64Array.from({ length: n }, () => (rnd() < 0.5 ? rnd() * 0.05 : rnd()));
        expect(lossOn(p, obs)).toBeLessThanOrEqual(b.down + 1e-6);
      }
    }
  });

  it('the theoretical bound is far beyond the worst simulated path', () => {
    expect(M08.accMaxLoss).toBeGreaterThan(-M08.accWorst);
    expect(M08.tarfMaxLoss).toBeGreaterThan(-M08.tarfWorst);
    expect(M08.tpfMaxLoss).toBeGreaterThan(-M08.tpfWorst);
    expect(M08.pivMaxLossDown).toBeGreaterThan(-M08.pivWorst);
    expect(M08.rtpfMaxLossDown).toBeGreaterThan(-M08.rtpfWorst);
  });
});

describe('number registry (m08, m09)', () => {
  it('registers the check values as CHF amounts', () => {
    const chf = (v: { value: number; kind: string; ccy?: string }) => {
      expect(v.kind).toBe('money');
      expect(v.ccy ?? 'CHF').toBe('CHF');
      return Math.round(v.value);
    };
    expect(chf(n08['m08.accMaxLoss']!)).toBe(1_609_922);
    expect(chf(n08['m08.tarfMaxLoss']!)).toBe(1_804_296);
    expect(chf(n08['m08.pivMaxLossDown']!)).toBe(1_800_595);
    expect(chf(n08['m08.tpfMaxLoss']!)).toBe(1_872_000);
    expect(chf(n08['m08.rtpfMaxLossDown']!)).toBe(1_852_800);
    expect(chf(n09['m09.accMaxLoss']!)).toBe(1_609_922);
    expect(chf(n09['m09.tarfMaxLoss']!)).toBe(1_804_296);
    expect(chf(n09['m09.tpfMaxLoss']!)).toBe(1_872_000);
  });

  it('module 08 and 09 show the same bounds', () => {
    expect(M09.accMaxLoss).toBe(M08.accMaxLoss);
    expect(M09.tarfMaxLoss).toBe(M08.tarfMaxLoss);
    expect(M09.tpfMaxLoss).toBe(M08.tpfMaxLoss);
  });
});
