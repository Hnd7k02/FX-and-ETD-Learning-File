/**
 * The precomputed fair values (src/data/fx/mc-products.json) and the precompute builder.
 * If a test here fails after a change of MC_CONFIG, run `npm run data:mc` again.
 */
import { describe, expect, it } from 'vitest';
import { fairProduct, isZeroCost, MC_PRODUCTS } from '@/lib/fx/mc/fair';
import { precomputeMcProducts, roundTo } from '@/lib/fx/mc/precompute';
import {
  buildProduct,
  DEFAULT_MARKET,
  forwardAtAverageFixing,
  MC_CONFIG,
  PRODUCT_KINDS,
  SOLVED_PARAM,
  type ZeroCostKind,
} from '@/lib/fx/mc/products';
import { price, withParam } from '@/lib/fx/mc/value';
import * as mc from '@/lib/fx/mc';

const ZERO_COST = Object.keys(SOLVED_PARAM) as ZeroCostKind[];

describe('mc-products.json', () => {
  it('was generated with the current market, paths and seed', () => {
    expect(MC_PRODUCTS.market).toEqual(DEFAULT_MARKET);
    expect(MC_PRODUCTS.engine.paths).toBe(MC_CONFIG.engine.precomputePaths);
    expect(MC_PRODUCTS.engine.seed).toBe(MC_CONFIG.engine.seed);
    expect(MC_PRODUCTS.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('stores products that match PRODUCT_DEFAULTS (else: npm run data:mc)', () => {
    for (const kind of ZERO_COST) {
      const stored = MC_PRODUCTS.products[kind];
      const expected = withParam(buildProduct(kind), stored.param, stored.value);
      const {
        lowerStrike: _l,
        upperStrike: _u,
        ...rest
      } = expected as unknown as Record<string, number>;
      expect(stored.product).toMatchObject(kind === 'pivotTarf' ? rest : expected);
      expect(stored.param).toBe(SOLVED_PARAM[kind]);
    }
    expect(MC_PRODUCTS.products.windowBarrier.product).toEqual(buildProduct('windowBarrier'));
    expect(MC_PRODUCTS.products.doubleNoTouch.product).toEqual(buildProduct('doubleNoTouch'));
  });

  it('has standard errors well below 1 pip on the strikes', () => {
    for (const kind of ['accumulator', 'decumulator', 'tarf'] as const) {
      expect(MC_PRODUCTS.products[kind].stdErrPips).toBeLessThan(0.6);
    }
    expect(MC_PRODUCTS.products.pivotTarf.stdErrPips).toBeLessThan(1);
  });

  it('gives better rates than the forward for accumulator, decumulator and TARF', () => {
    const acc = MC_PRODUCTS.products.accumulator;
    expect(acc.fairStrike).toBeLessThan(acc.forwardAvg);
    expect(acc.forwardAvg).toBeCloseTo(forwardAtAverageFixing(buildProduct('accumulator')), 6);
    expect(acc.vsForwardPips).toBeLessThan(-100);
    expect(MC_PRODUCTS.products.decumulator.vsForwardPips).toBeGreaterThan(100);
    expect(MC_PRODUCTS.products.tarf.vsForwardPips).toBeLessThan(-100);
    expect(MC_PRODUCTS.products.tpf.couponPips).toBeGreaterThan(0);
    expect(MC_PRODUCTS.products.rtpf.couponPips).toBeGreaterThan(0);
    const pv = MC_PRODUCTS.products.pivotTarf;
    expect(pv.lowerStrike).toBeCloseTo(0.8 - pv.fairWidth!, 6);
    expect(pv.upperStrike).toBeCloseTo(0.8 + pv.fairWidth!, 6);
  });

  it('stored fair values give PV ≈ 0 on fresh paths (another seed, out of sample)', () => {
    // The solver's own PV ≈ 0 is in-sample (same paths). Here every stored product is priced on
    // independent paths; the bound combines the fresh SE and the stored parameter's error
    // (pvStdErr = slope · SE of the parameter). Seed and paths are fixed: deterministic.
    for (const kind of ZERO_COST) {
      const r = price(fairProduct(kind), DEFAULT_MARKET, { paths: 40_000, seed: 987_654 });
      const bound = 4 * Math.hypot(r.stdErr, MC_PRODUCTS.products[kind].pvStdErr);
      expect(Math.abs(r.pv), kind).toBeLessThan(bound);
    }
  });

  it('double no-touch by Monte Carlo agrees with the BGK-shifted closed form', () => {
    const d = MC_PRODUCTS.products.doubleNoTouch;
    expect(Math.abs(d.pv - d.compare.continuousBgk!)).toBeLessThan(3 * d.stdErr);
    expect(MC_PRODUCTS.products.windowBarrier.pv).toBeLessThan(
      MC_PRODUCTS.products.windowBarrier.compare.vanilla!,
    );
    expect(MC_PRODUCTS.dualCurrency.yieldPa).toBeGreaterThan(
      MC_PRODUCTS.dualCurrency.moneyMarketRate,
    );
  });

  it('fairProduct returns the stored products, with overrides', () => {
    expect(fairProduct('accumulator').strike).toBe(MC_PRODUCTS.products.accumulator.fairStrike);
    expect(fairProduct('tpf', { notional: 1 })).toMatchObject({
      notional: 1,
      coupon: MC_PRODUCTS.products.tpf.fairCoupon,
    });
    expect(fairProduct('doubleNoTouch')).toEqual(buildProduct('doubleNoTouch'));
    expect(PRODUCT_KINDS.filter(isZeroCost)).toEqual(ZERO_COST);
  });
});

describe('precomputeMcProducts', () => {
  it('builds the whole JSON deterministically with few paths', () => {
    const logs: string[] = [];
    const a = precomputeMcProducts({
      paths: 2000,
      seed: 5,
      date: '2026-01-02',
      log: (s) => logs.push(s),
    });
    const b = precomputeMcProducts({ paths: 2000, seed: 5, date: '2026-01-02' });
    expect(a).toEqual(b);
    expect(a.generatedAt).toBe('2026-01-02');
    expect(a.engine).toMatchObject({ paths: 2000, seed: 5, antithetic: true, stepDays: 1 });
    expect(Object.keys(a.products)).toEqual([...ZERO_COST, 'windowBarrier', 'doubleNoTouch']);
    expect(a.products.accumulator.fairStrike).toBe(a.products.accumulator.value);
    expect(a.products.tpf.couponPips).toBeCloseTo(a.products.tpf.value * 1e4, 2);
    expect(a.products.pivotTarf.fairWidth).toBe(a.products.pivotTarf.value);
    expect(a.dualCurrency.strike).toBe(0.792);
    expect(logs).toHaveLength(8);
    expect(precomputeMcProducts({ paths: 200, date: '2026-01-02' }).engine.seed).toBe(
      MC_CONFIG.engine.seed,
    );
  });

  it('rounds deterministically', () => {
    expect(roundTo(0.1 + 0.2, 6)).toBe(0.3);
    expect(roundTo(-0.0000001, 4)).toBe(0);
    expect(Object.is(roundTo(-0.0000001, 4), -0)).toBe(false);
  });

  it('is re-exported by the index barrel', () => {
    expect(mc.price).toBeTypeOf('function');
    expect(mc.MC_PRODUCTS).toBe(MC_PRODUCTS);
    expect('precomputeMcProducts' in mc).toBe(false);
  });
});
