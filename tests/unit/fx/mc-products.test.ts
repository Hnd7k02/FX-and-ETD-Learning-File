import { describe, expect, it } from 'vitest';
import { EXAMPLE, EXAMPLE_STRIKE } from '@/lib/fx/example';
import {
  averageFixingDay,
  BUILDING_BLOCKS,
  buildProduct,
  dailyDays,
  DEFAULT_MARKET,
  fixingSchedule,
  forwardAt,
  forwardAtAverageFixing,
  level,
  MC_CONFIG,
  PRODUCT_DEFAULTS,
  PRODUCT_KINDS,
  windowObservationDays,
  type ProductKind,
} from '@/lib/fx/mc/products';

describe('MC_CONFIG and §8.7 defaults', () => {
  it('uses the running example market', () => {
    expect(DEFAULT_MARKET).toEqual({
      spot: EXAMPLE.spot,
      rd: EXAMPLE.rd,
      rf: EXAMPLE.rf,
      vol: EXAMPLE.vol,
    });
    expect(MC_CONFIG.conventions.dt).toBe(1 / 365);
    expect(PRODUCT_DEFAULTS).toBe(MC_CONFIG.products);
  });

  it('schedules weekly fixings every 7 days and monthly fixings on round(i · 365/12)', () => {
    expect(fixingSchedule('weekly', 3)).toEqual([7, 14, 21]);
    expect(fixingSchedule('monthly', 12)).toEqual([
      30, 61, 91, 122, 152, 183, 213, 243, 274, 304, 335, 365,
    ]);
    expect(() => fixingSchedule('weekly', 0)).toThrow(RangeError);
    expect(() => fixingSchedule('monthly', 1.5)).toThrow(RangeError);
    expect(dailyDays(0, 3)).toEqual([1, 2, 3]);
    expect(windowObservationDays(1, 3, 10)).toEqual([1, 2, 3, 10]);
    expect(windowObservationDays(5, 20, 10)).toEqual([5, 6, 7, 8, 9, 10]);
  });

  it('accumulator: 26 weekly fixings, N = USD 40’000, B = spot + 3 %', () => {
    const p = buildProduct('accumulator');
    expect(p.fixingDays).toHaveLength(26);
    expect(p.fixingDays[25]).toBe(182);
    expect(p.notional).toBe(40_000);
    expect(p.leverage).toBe(2);
    expect(p.barrier).toBe(0.824);
    expect(p.tradeOnKnockOutFixing).toBe(false);
    // Start value of the strike: forward to the average fixing day (94.5 days).
    expect(averageFixingDay(p)).toBe(94.5);
    expect(p.strike).toBeCloseTo(forwardAtAverageFixing(p), 8);
  });

  it('decumulator mirrors the accumulator with B = spot − 3 %', () => {
    const p = buildProduct('decumulator');
    expect(p.barrier).toBe(0.776);
    expect(p.fixingDays).toEqual(buildProduct('accumulator').fixingDays);
  });

  it('TARF: 12 monthly fixings, N = USD 100’000, target 500 pips, capped last fixing', () => {
    const p = buildProduct('tarf');
    expect(p.fixingDays).toHaveLength(12);
    expect(p.notional).toBe(100_000);
    expect(p.target).toBe(0.05);
    expect(p.lastFixing).toBe('capped');
  });

  it('Pivot TARF: P = spot, target 300 pips; TPF: K = spot − 2.5 %; RTPF: spot ∓ 3.5 %', () => {
    const pv = buildProduct('pivotTarf');
    expect([pv.pivot, pv.target]).toEqual([0.8, 0.03]);
    const tpf = buildProduct('tpf');
    expect([tpf.strike, tpf.targetCoupons, tpf.coupon]).toEqual([0.78, 6, 0]);
    const rtpf = buildProduct('rtpf');
    expect([rtpf.lower, rtpf.upper, rtpf.targetCoupons]).toEqual([0.772, 0.828, 6]);
  });

  it('window barrier and double no-touch observe daily', () => {
    const wb = buildProduct('windowBarrier');
    expect(wb.strike).toBe(EXAMPLE_STRIKE);
    expect(wb.barrier).toBe(0.824);
    expect(wb.direction).toBe('up');
    expect(wb.fixingDays).toEqual([...dailyDays(1, 30), 91]);
    const dnt = buildProduct('doubleNoTouch');
    expect(dnt.fixingDays).toEqual(dailyDays(1, 91));
    expect([dnt.lower, dnt.upper, dnt.payout]).toEqual([0.768, 0.832, 100_000]);
  });

  it('applies overrides and keeps observation days consistent', () => {
    const acc = buildProduct('accumulator', DEFAULT_MARKET, { strike: 0.77, notional: 1 });
    expect([acc.strike, acc.notional]).toEqual([0.77, 1]);
    const wb = buildProduct('windowBarrier', DEFAULT_MARKET, { windowEndDay: 10, expiryDay: 20 });
    expect(wb.fixingDays).toEqual([...dailyDays(1, 10), 20]);
    const dnt = buildProduct('doubleNoTouch', DEFAULT_MARKET, { expiryDay: 5 });
    expect(dnt.fixingDays).toEqual([1, 2, 3, 4, 5]);
    const fixed = buildProduct('doubleNoTouch', DEFAULT_MARKET, { expiryDay: 5, fixingDays: [5] });
    expect(fixed.fixingDays).toEqual([5]);
    const other = buildProduct('tarf', { ...DEFAULT_MARKET, spot: 0.9 });
    expect(other.strike).toBeCloseTo(
      forwardAt({ ...DEFAULT_MARKET, spot: 0.9 }, averageFixingDay(other)),
      7,
    );
    expect(() => buildProduct('nope' as ProductKind)).toThrow(RangeError);
  });

  it('rounds derived levels to 8 decimals only', () => {
    expect(0.8 * 1.03).not.toBe(0.824);
    expect(level(0.8 * 1.03)).toBe(0.824);
    expect(level(0.123456789)).toBe(0.12345679);
  });
});

describe('building blocks', () => {
  it('describe every product, with levels that exist on the product', () => {
    for (const kind of PRODUCT_KINDS) {
      const blocks = BUILDING_BLOCKS[kind];
      expect(blocks.length).toBeGreaterThan(0);
      const p = buildProduct(kind) as unknown as Record<string, unknown>;
      for (const b of blocks) for (const l of b.levels) expect(p).toHaveProperty(l);
    }
    expect(BUILDING_BLOCKS.dualCurrency.map((b) => b.key)).toEqual(['deposit', 'shortPut']);
  });

  it('accumulator = long call K (N) + short put K (2N) with knock-out at B', () => {
    expect(BUILDING_BLOCKS.accumulator).toEqual([
      { key: 'longCall', ratio: 1, levels: ['strike'], perFixing: true },
      { key: 'shortPut', ratio: 2, levels: ['strike'], perFixing: true },
      { key: 'knockOutUp', ratio: 0, levels: ['barrier'], perFixing: true },
    ]);
  });

  it('the Pivot TARF decomposition reproduces the per-fixing payoff', () => {
    const K1 = 0.79;
    const P = 0.8;
    const K2 = 0.81;
    const call = (S: number, K: number) => Math.max(S - K, 0);
    const put = (S: number, K: number) => Math.max(K - S, 0);
    const blocks = (S: number) => call(S, K1) - 2 * call(S, P) - call(S, K2) - 2 * put(S, K1);
    const rule = (S: number) =>
      S <= K1 ? 2 * (S - K1) : S <= P ? S - K1 : S < K2 ? K2 - S : 2 * (K2 - S);
    for (const S of [0.75, 0.79, 0.795, 0.8, 0.805, 0.81, 0.85]) {
      expect(blocks(S)).toBeCloseTo(rule(S), 12);
    }
  });
});
