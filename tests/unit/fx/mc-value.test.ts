import { describe, expect, it } from 'vitest';
import {
  buildProduct,
  DEFAULT_MARKET as m,
  forwardAtAverageFixing,
  MC_CONFIG,
} from '@/lib/fx/mc/products';
import {
  brent,
  defaultBracket,
  expectation,
  price,
  priceOnObservations,
  simulateObservations,
  solveFairCoupon,
  solveFairStrike,
  solveParameter,
  solvePivotWidth,
  withParam,
} from '@/lib/fx/mc/value';

const FAST = { paths: 20_000, seed: 4242 };

describe('price', () => {
  it('streams the same numbers as a valuation on stored observations', () => {
    const acc = buildProduct('accumulator', m, { strike: 0.775 });
    const a = price(acc, m, FAST);
    const set = simulateObservations(m, acc.fixingDays, FAST);
    const b = priceOnObservations(acc, set, m);
    expect(b.pv).toBe(a.pv);
    expect(b.stdErr).toBe(a.stdErr);
    expect(b.stats).toEqual(a.stats);
    expect([a.paths, a.seed, a.antithetic]).toEqual([20_000, 4242, true]);
  });

  it('reports end probabilities that add up to 1 and a sensible distribution', () => {
    const r = price(buildProduct('accumulator', m, { strike: 0.775 }), m, FAST);
    const e = r.stats.endProbability;
    expect(e.maturity + e.knockout + e.target).toBeCloseTo(1, 12);
    expect(e.knockout).toBeGreaterThan(0.2);
    expect(r.stats.pvMin).toBeLessThanOrEqual(r.stats.pvQuantile05);
    expect(r.stats.pvQuantile05).toBeLessThan(r.pv);
    expect(r.stats.pvMax).toBeGreaterThan(r.pv);
    expect(r.stats.expectedFixings).toBeGreaterThan(1);
    expect(r.stats.expectedFixings).toBeLessThanOrEqual(26);
    expect(r.stats.expectedBase).toBeGreaterThan(0);
  });

  it('uses the interactive defaults of MC_CONFIG without options', () => {
    const r = price(buildProduct('doubleNoTouch', m, { expiryDay: 5 }));
    expect([r.paths, r.seed, r.antithetic]).toEqual([
      MC_CONFIG.engine.interactivePaths,
      MC_CONFIG.engine.seed,
      true,
    ]);
    expect(r.pv).toBeGreaterThan(0.99 * 100_000); // 5 days: almost surely no touch
  });

  it('computes the standard error from independent paths without antithetic pairs', () => {
    const r = price(buildProduct('accumulator', m, { strike: 0.775 }), m, { ...FAST, antithetic: false });
    expect(r.antithetic).toBe(false);
    expect(r.stdErr).toBeGreaterThan(0);
    const one = price(buildProduct('accumulator', m, { strike: 0.775 }), m, { paths: 1, antithetic: false });
    expect(one.stdErr).toBe(0);
  });

  it('rejects observation sets of another schedule', () => {
    const set = simulateObservations(m, [7, 14], { paths: 10 });
    expect(() => priceOnObservations(buildProduct('accumulator'), set)).toThrow(RangeError);
    expect(() => priceOnObservations(buildProduct('accumulator', m, { fixingDays: [7, 15] }), set)).toThrow(
      RangeError,
    );
  });

  it('expectation works with and without antithetic pairs', () => {
    const a = expectation(m, 30, (p) => p[30]!, { paths: 1000, seed: 1 });
    const b = expectation(m, 30, (p) => p[30]!, { paths: 1000, seed: 1, antithetic: false });
    expect(a.paths).toBe(1000);
    expect(Math.abs(a.mean - b.mean)).toBeLessThan(4 * b.stdErr);
    expect(expectation(m, 1, () => 1, { paths: 1, antithetic: false }).stdErr).toBe(0);
  });
});

describe('solvers (common random numbers)', () => {
  it('accumulator: PV ≈ 0 at the fair strike, which is below the forward of the average fixing date', () => {
    const acc = buildProduct('accumulator');
    const r = solveFairStrike(acc, m, FAST);
    expect(r.param).toBe('strike');
    expect(Math.abs(r.pvAtValue)).toBeLessThan(0.01 * r.pvStdErr);
    expect(Math.abs(priceOnObservations(r.product, simulateObservations(m, acc.fixingDays, FAST)).pv)).toBeLessThan(
      0.01 * r.pvStdErr,
    );
    expect(r.value).toBeLessThan(forwardAtAverageFixing(acc) - 0.01); // > 100 pips better
    expect(r.stdErr).toBeCloseTo(r.pvStdErr / Math.abs(r.slope), 15);
    expect(r.slope).toBeLessThan(0); // a higher strike is worse for the buyer
    expect(r.stdErr).toBeLessThan(3e-4); // a few pips with 20’000 paths
    expect(r.priced.pv).toBe(r.pvAtValue);
    expect([r.paths, r.seed, r.antithetic]).toEqual([20_000, 4242, true]);
  });

  it('the standard error is consistent with the spread across seeds', () => {
    const acc = buildProduct('accumulator');
    const a = solveFairStrike(acc, m, { paths: 10_000, seed: 1 });
    const b = solveFairStrike(acc, m, { paths: 10_000, seed: 2 });
    expect(Math.abs(a.value - b.value)).toBeLessThan(4 * Math.hypot(a.stdErr, b.stdErr));
  });

  it('decumulator: fair strike above the forward (better for the USD seller)', () => {
    const dec = buildProduct('decumulator');
    const r = solveFairStrike(dec, m, FAST);
    expect(Math.abs(r.pvAtValue)).toBeLessThan(0.01 * r.pvStdErr);
    expect(r.value).toBeGreaterThan(forwardAtAverageFixing(dec) + 0.01);
    expect(r.slope).toBeGreaterThan(0);
  });

  it('TARF: fair strike below the forward, PV ≈ 0', () => {
    const tarf = buildProduct('tarf');
    const r = solveFairStrike(tarf, m, FAST);
    expect(Math.abs(r.pvAtValue)).toBeLessThan(0.01 * r.pvStdErr);
    expect(r.value).toBeLessThan(forwardAtAverageFixing(tarf));
  });

  it('Pivot TARF: positive width, symmetric strikes, PV ≈ 0', () => {
    const r = solvePivotWidth(buildProduct('pivotTarf'), m, FAST);
    expect(r.value).toBeGreaterThan(0);
    expect(Math.abs(r.pvAtValue)).toBeLessThan(0.01 * r.pvStdErr);
    const p = r.product as ReturnType<typeof buildProduct<'pivotTarf'>>;
    expect(p.lowerStrike).toBeCloseTo(0.8 - r.value, 12);
    expect(p.upperStrike).toBeCloseTo(0.8 + r.value, 12);
  });

  it('TPF and RTPF: positive fair coupons, PV linear in the coupon so PV ≈ 0 exactly', () => {
    for (const kind of ['tpf', 'rtpf'] as const) {
      const r = solveFairCoupon(buildProduct(kind), m, FAST);
      expect(r.value).toBeGreaterThan(0);
      expect(Math.abs(r.pvAtValue)).toBeLessThan(1e-6 * r.pvStdErr);
      expect(r.iterations).toBeLessThan(10);
    }
  });

  it('reuses given observations and widens a bracket without a sign change', () => {
    const acc = buildProduct('accumulator');
    const set = simulateObservations(m, acc.fixingDays, FAST);
    const a = solveFairStrike(acc, m, { observations: set });
    const b = solveFairStrike(acc, m, { observations: set, bracket: [0.79, 0.8] });
    expect(b.value).toBeCloseTo(a.value, 8);
    expect(b.iterations).toBeGreaterThan(0);
    const c = solveFairCoupon(buildProduct('tpf'), m, { ...FAST, bracket: [0.2, 0.3] });
    expect(c.value).toBeGreaterThan(0);
  });

  it('throws if PV never changes sign', () => {
    // A TPF whose strike is never reached pays no coupon: PV < 0 for every coupon.
    const tpf = buildProduct('tpf', m, { strike: 10 });
    expect(() => solveFairCoupon(tpf, m, { paths: 200 })).toThrow(RangeError);
  });

  it('withParam sets the solved field and rejects unknown parameters', () => {
    const pv = withParam(buildProduct('pivotTarf'), 'width', 0.01);
    expect([pv.lowerStrike, pv.upperStrike]).toEqual([0.79, 0.81]);
    expect(withParam(buildProduct('tpf'), 'coupon', 0.002).coupon).toBe(0.002);
    expect(withParam(buildProduct('tarf'), 'strike', 0.77).strike).toBe(0.77);
    expect(() => withParam(buildProduct('doubleNoTouch'), 'strike', 1)).toThrow(RangeError);
    expect(() => withParam(buildProduct('tarf'), 'coupon', 1)).toThrow(RangeError);
    expect(() => withParam(buildProduct('accumulator'), 'width', 1)).toThrow(RangeError);
    expect(() => solveParameter(buildProduct('doubleNoTouch'), 'strike', m, { paths: 10 })).toThrow(
      RangeError,
    );
  });

  it('default brackets: strikes relative to spot, coupon and width absolute', () => {
    expect(defaultBracket('strike', m)).toEqual([0.85 * 0.8, 1.15 * 0.8]);
    expect(defaultBracket('coupon', m)).toEqual([0, 0.05]);
    expect(defaultBracket('width', m)).toEqual([0, 0.1]);
  });
});

describe('brent', () => {
  it('finds roots, returns exact endpoint roots and rejects brackets without a sign change', () => {
    const r = brent((x) => x * x - 2, 0, 2, 1e-12, 100);
    expect(r.root).toBeCloseTo(Math.SQRT2, 11);
    expect(brent((x) => x - 1, 1, 2, 1e-9, 10)).toEqual({ root: 1, iterations: 0 });
    expect(brent((x) => x - 2, 1, 2, 1e-9, 10)).toEqual({ root: 2, iterations: 0 });
    expect(() => brent((x) => x * x + 1, -1, 1, 1e-9, 10)).toThrow(RangeError);
    const capped = brent((x) => Math.atan(x - 0.3), -10, 10, 1e-15, 3);
    expect(capped.iterations).toBe(3);
    // A step function: bisection-like convergence to the jump.
    const step = brent((x) => (x < 0.123 ? -1 : 1), 0, 1, 1e-10, 200);
    expect(step.root).toBeCloseTo(0.123, 8);
  });
});
