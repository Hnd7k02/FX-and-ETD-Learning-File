/** Payoff logic of every product on hand-made paths (the logic the path simulator shows). */
import { describe, expect, it } from 'vitest';
import {
  accumulatorPayoff,
  decumulatorPayoff,
  discountFactors,
  doubleNoTouchPayoff,
  observationsFromPath,
  pivotTarfPayoff,
  productPayoff,
  rtpfPayoff,
  tarfPayoff,
  tpfPayoff,
  windowBarrierPayoff,
  type Cashflow,
} from '@/lib/fx/mc/payoffs';
import { buildProduct, DEFAULT_MARKET as m, type Product } from '@/lib/fx/mc/products';

/** Daily path at `fill` with the given spots on the product's first fixings. */
function pathWith(p: Product, fixings: readonly number[], fill = 0.8): Float64Array {
  const days = p.fixingDays;
  const path = new Float64Array(days[days.length - 1]! + 1).fill(fill);
  fixings.forEach((s, i) => (path[days[i]!] = s));
  return path;
}

const kinds = (cfs: Cashflow[]) => cfs.map((c) => c.kind);
const pnl = (cfs: Cashflow[]) => cfs.map((c) => Math.round(c.pnlQuote * 100) / 100);

describe('accumulator', () => {
  const acc = buildProduct('accumulator', m, { strike: 0.78 }); // B = 0.824, N = 40’000

  it('buys N at K above the strike, 2N below, and knocks out at S ≥ B without a trade', () => {
    const r = accumulatorPayoff(pathWith(acc, [0.79, 0.77, 0.78, 0.824]), acc, m);
    expect(kinds(r.cashflows)).toEqual(['buy', 'buy', 'buy', 'ko']);
    expect(r.cashflows.map((c) => c.amountBase)).toEqual([40_000, 80_000, 40_000, 0]);
    expect(pnl(r.cashflows)).toEqual([400, -800, 0, 0]);
    expect(r.cashflows[0]).toMatchObject({ fixing: 1, day: 7, spot: 0.79, rate: 0.78, df: 1 });
    expect(r.cashflows[0]!.amountQuote).toBeCloseTo(-0.78 * 40_000, 8);
    expect(r.cashflows[3]!.rate).toBeNull();
    expect([r.endedAt, r.endDay, r.reason]).toEqual([4, 28, 'knockout']);
    expect(r.totalBase).toBe(160_000);
    expect(r.totalPnlQuote).toBeCloseTo(-400, 8);
    expect(r.pvQuote).toBeCloseTo(-400, 8); // rd = 0
    expect(r.totalQuote).toBeCloseTo(-0.78 * 160_000, 6);
  });

  it('can trade N at K on the knock-out fixing (config switch)', () => {
    const p = { ...acc, tradeOnKnockOutFixing: true };
    const r = productPayoff(pathWith(p, [0.83]), p, m);
    expect(kinds(r.cashflows)).toEqual(['buy', 'ko']);
    expect(r.cashflows[0]!.pnlQuote).toBeCloseTo(0.05 * 40_000, 8);
  });

  it('runs to maturity: 26 fixings of N when the spot stays between K and B', () => {
    const r = productPayoff(pathWith(acc, []), acc, m);
    expect(r.cashflows).toHaveLength(26);
    expect([r.endedAt, r.reason, r.totalBase]).toEqual([26, 'maturity', 26 * 40_000]);
  });
});

describe('decumulator', () => {
  const dec = buildProduct('decumulator', m, { strike: 0.82 }); // B = 0.776

  it('sells N at K below the strike, 2N above, knocks out at S ≤ B', () => {
    const r = decumulatorPayoff(pathWith(dec, [0.81, 0.83, 0.776]), dec, m);
    expect(kinds(r.cashflows)).toEqual(['sell', 'sell', 'ko']);
    expect(r.cashflows.map((c) => c.amountBase)).toEqual([-40_000, -80_000, 0]);
    expect(pnl(r.cashflows)).toEqual([400, -800, 0]);
    expect(r.reason).toBe('knockout');
  });

  it('can trade on the knock-out fixing', () => {
    const p = { ...dec, tradeOnKnockOutFixing: true };
    const r = productPayoff(pathWith(p, [0.7]), p, m);
    expect(kinds(r.cashflows)).toEqual(['sell', 'ko']);
    expect(r.cashflows[0]!.pnlQuote).toBeCloseTo(0.12 * 40_000, 8);
  });
});

describe('TARF', () => {
  const tarf = buildProduct('tarf', m, { strike: 0.75 }); // target 0.05, N = 100’000

  it('counts gains, not losses, and caps the last gain at the target', () => {
    const r = tarfPayoff(pathWith(tarf, [0.78, 0.74, 0.79, 0.9]), tarf, m);
    expect(kinds(r.cashflows)).toEqual(['buy', 'buy', 'buy', 'target']);
    expect(r.cashflows.map((c) => c.amountBase)).toEqual([100_000, 200_000, 100_000, 0]);
    expect(pnl(r.cashflows)).toEqual([3000, -2000, 2000, 0]);
    // Capped: the gain counted on fixing 3 is the remaining 0.02, traded at S − 0.02 = 0.77.
    expect(r.cashflows[2]!.rate).toBeCloseTo(0.77, 12);
    expect(r.cashflows.map((c) => c.targetProgress)).toEqual([
      expect.closeTo(0.03, 12),
      expect.closeTo(0.03, 12),
      0.05,
      0.05,
    ]);
    expect([r.endedAt, r.reason]).toEqual([3, 'target']);
  });

  it("variants of the last fixing: 'full' pays the whole gain, 'none' trades nothing", () => {
    const path = pathWith(tarf, [0.78, 0.74, 0.79]);
    const full = productPayoff(path, { ...tarf, lastFixing: 'full' }, m);
    expect(full.cashflows[2]!.pnlQuote).toBeCloseTo(4000, 8);
    expect(full.cashflows[2]!.rate).toBeCloseTo(0.75, 12);
    const none = productPayoff(path, { ...tarf, lastFixing: 'none' }, m);
    expect(kinds(none.cashflows)).toEqual(['buy', 'buy', 'target']);
  });

  it('runs to maturity if the target is not reached', () => {
    const r = productPayoff(pathWith(tarf, [], 0.752), tarf, m);
    expect([r.endedAt, r.reason]).toEqual([12, 'maturity']);
    expect(r.cashflows.at(-1)!.targetProgress).toBeCloseTo(12 * 0.002, 12);
  });
});

describe('Pivot TARF', () => {
  const pv = buildProduct('pivotTarf', m, { lowerStrike: 0.79, upperStrike: 0.81 }); // P 0.80, target 0.03

  it('buys at K1 below the pivot, sells at K2 above it, doubles outside, caps at the target', () => {
    const fixings = [0.795, 0.805, 0.78, 0.83, 0.8, 0.805, 0.8];
    const r = pivotTarfPayoff(pathWith(pv, fixings), pv, m);
    expect(kinds(r.cashflows)).toEqual([
      'buy',
      'sell',
      'buy',
      'sell',
      'buy',
      'sell',
      'buy',
      'target',
    ]);
    expect(r.cashflows.map((c) => c.amountBase)).toEqual([
      100_000, -100_000, 200_000, -200_000, 100_000, -100_000, 100_000, 0,
    ]);
    expect(pnl(r.cashflows)).toEqual([500, 500, -2000, -4000, 1000, 500, 500, 0]);
    expect(r.cashflows[6]!.rate).toBeCloseTo(0.795, 12); // capped: remaining 0.005
    expect([r.endedAt, r.reason]).toEqual([7, 'target']);
  });

  it('caps a sell on the target fixing above the market rate', () => {
    const p = { ...pv, target: 0.004 };
    const r = productPayoff(pathWith(p, [0.805]), p, m);
    expect(r.cashflows[0]).toMatchObject({ kind: 'sell', amountBase: -100_000 });
    expect(r.cashflows[0]!.rate).toBeCloseTo(0.809, 12);
    expect(r.cashflows[0]!.pnlQuote).toBeCloseTo(400, 8);
  });

  it('runs to maturity without reaching the target', () => {
    const r = productPayoff(pathWith(pv, [], 0.85), pv, m);
    expect([r.endedAt, r.reason]).toEqual([12, 'maturity']);
    expect(r.totalPnlQuote).toBeCloseTo(12 * -8000, 6);
  });
});

describe('TPF', () => {
  const tpf = buildProduct('tpf', m, { coupon: 0.001 }); // K = 0.78, 6 coupons, N = 100’000

  it('pays a coupon above the strike, leveraged loss below, ends after six coupons', () => {
    const r = tpfPayoff(pathWith(tpf, [0.79, 0.77, 0.8, 0.8, 0.78, 0.8, 0.8, 0.8]), tpf, m);
    expect(kinds(r.cashflows)).toEqual([
      'coupon',
      'payment',
      'coupon',
      'coupon',
      'coupon',
      'coupon',
      'coupon',
      'target',
    ]);
    expect(pnl(r.cashflows)).toEqual([100, -2000, 100, 100, 100, 100, 100, 0]);
    expect(r.cashflows.at(-1)!.targetProgress).toBe(6);
    expect([r.endedAt, r.reason]).toEqual([7, 'target']);
    expect(r.totalBase).toBe(0);
  });

  it('keeps paying below the strike until maturity', () => {
    const r = productPayoff(pathWith(tpf, [], 0.7), tpf, m);
    expect([r.endedAt, r.reason]).toEqual([12, 'maturity']);
    expect(r.totalPnlQuote).toBeCloseTo(12 * -2 * 0.08 * 100_000, 6);
  });
});

describe('RTPF', () => {
  const rtpf = buildProduct('rtpf', m, { coupon: 0.002 }); // L 0.772, U 0.828

  it('pays inside the range (bounds included), leveraged losses on both sides', () => {
    const r = rtpfPayoff(pathWith(rtpf, [0.8, 0.76, 0.84, 0.772, 0.828], 0.75), rtpf, m);
    expect(kinds(r.cashflows).slice(0, 5)).toEqual([
      'coupon',
      'payment',
      'payment',
      'coupon',
      'coupon',
    ]);
    expect(pnl(r.cashflows).slice(0, 5)).toEqual([200, -2400, -2400, 200, 200]);
    expect([r.endedAt, r.reason]).toEqual([12, 'maturity']);
    expect(r.cashflows.at(-1)!.targetProgress).toBe(3);
  });

  it('ends after six coupons', () => {
    const r = productPayoff(pathWith(rtpf, []), rtpf, m);
    expect([r.endedAt, r.reason, r.cashflows.length]).toEqual([6, 'target', 7]);
  });
});

describe('window barrier', () => {
  const wb = buildProduct('windowBarrier'); // up-and-out call K 0.793, H 0.824, window days 1–30

  it('knocks out on a touch inside the window', () => {
    const path = new Float64Array(92).fill(0.8);
    path[15] = 0.83;
    const r = windowBarrierPayoff(path, wb, m);
    expect(kinds(r.cashflows)).toEqual(['ko']);
    expect([r.endedAt, r.endDay, r.reason]).toEqual([15, 15, 'knockout']);
  });

  it('ignores touches outside the window and exercises at expiry', () => {
    const path = new Float64Array(92).fill(0.8);
    path[40] = 0.9;
    path[91] = 0.81;
    const r = productPayoff(path, wb, m);
    expect(kinds(r.cashflows)).toEqual(['buy']);
    expect(r.cashflows[0]!.pnlQuote).toBeCloseTo(0.017 * 1_000_000, 6);
    expect([r.endDay, r.reason]).toEqual([91, 'maturity']);
  });

  it('expires worthless out of the money; a put with a down barrier works the same way', () => {
    const path = new Float64Array(92).fill(0.78);
    expect(productPayoff(path, wb, m).cashflows).toEqual([]);
    const put = buildProduct('windowBarrier', m, {
      type: 'put',
      direction: 'down',
      strike: 0.8,
      barrier: 0.77,
    });
    const r = productPayoff(path, put, m);
    expect(r.cashflows[0]).toMatchObject({ kind: 'sell', amountBase: -1_000_000 });
    expect(r.cashflows[0]!.pnlQuote).toBeCloseTo(20_000, 6);
    path[10] = 0.77;
    expect(productPayoff(path, put, m).reason).toBe('knockout');
    path[10] = 0.78;
    path[91] = 0.81;
    expect(productPayoff(path, put, m).cashflows).toEqual([]);
  });

  it('monitors the expiry day when the window reaches it', () => {
    const p = buildProduct('windowBarrier', m, { windowStartDay: 60, windowEndDay: 91 });
    expect(p.fixingDays[0]).toBe(60);
    const path = new Float64Array(92).fill(0.8);
    path[91] = 0.83;
    expect(productPayoff(path, p, m).reason).toBe('knockout');
    // Kernel safety net: observation days without the expiry day end at maturity.
    const odd = { ...p, fixingDays: [60, 61] };
    expect(productPayoff(path, odd, m)).toMatchObject({ reason: 'maturity', endedAt: 2 });
  });
});

describe('double no-touch', () => {
  const dnt = buildProduct('doubleNoTouch'); // L 0.768, U 0.832, CHF 100’000

  it('pays at expiry if no daily fixing touches a barrier', () => {
    const r = doubleNoTouchPayoff(new Float64Array(92).fill(0.8), dnt, m);
    expect(r.cashflows).toHaveLength(1);
    expect(r.cashflows[0]).toMatchObject({ kind: 'payment', fixing: 91, amountQuote: 100_000 });
    expect(r.reason).toBe('maturity');
  });

  it('ends without payment on a touch (barrier included)', () => {
    const path = new Float64Array(92).fill(0.8);
    path[50] = 0.768;
    const r = productPayoff(path, dnt, m);
    expect([kinds(r.cashflows), r.endedAt, r.reason]).toEqual([['ko'], 50, 'knockout']);
    path[50] = 0.8;
    path[20] = 0.832;
    expect(productPayoff(path, dnt, m).endedAt).toBe(20);
  });
});

describe('helpers', () => {
  it('discounts with e^(−rd · day/365) and rejects paths that are too short', () => {
    expect(Array.from(discountFactors([0, 365], 0.02))).toEqual([1, Math.exp(-0.02)]);
    const acc = buildProduct('accumulator', m, { strike: 0.78 });
    const r = productPayoff(pathWith(acc, [], 0.79), acc, { rd: 0.05 });
    expect(r.pvQuote).toBeLessThan(r.totalPnlQuote);
    expect(r.cashflows[0]!.df).toBeCloseTo(Math.exp((-0.05 * 7) / 365), 14);
    expect(() => observationsFromPath(new Float64Array(10), acc)).toThrow(RangeError);
    expect(Array.from(observationsFromPath(pathWith(acc, [0.7]), acc)).slice(0, 2)).toEqual([
      0.7, 0.8,
    ]);
  });
});
