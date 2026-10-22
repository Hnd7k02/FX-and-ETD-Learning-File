import { describe, expect, it } from 'vitest';
import { GbmPathSource } from '@/lib/fx/mc/gbm';
import { productPayoff } from '@/lib/fx/mc/payoffs';
import { buildProduct, DEFAULT_MARKET as m, MC_CONFIG } from '@/lib/fx/mc/products';
import { randomPath, SCENARIO_NAMES, scenarioPath, shockDay } from '@/lib/fx/mc/scenarios';

describe('scenario paths', () => {
  it('are deterministic, start at the spot and have days + 1 points', () => {
    for (const name of SCENARIO_NAMES) {
      const a = scenarioPath(name, 182);
      expect(a).toHaveLength(183);
      expect(a[0]).toBe(m.spot);
      expect(Array.from(scenarioPath(name, 182))).toEqual(Array.from(a));
      expect(a.every((x) => x > 0)).toBe(true);
    }
    expect(Array.from(scenarioPath('trendUp', 50, m, { seed: 1 }))).not.toEqual(
      Array.from(scenarioPath('trendUp', 50, m, { seed: 2 })),
    );
  });

  it('trend up ends clearly higher, trend down clearly lower', () => {
    const up = scenarioPath('trendUp', 365);
    const down = scenarioPath('trendDown', 365);
    expect(up[365]! / m.spot).toBeGreaterThan(1.05);
    expect(down[365]! / m.spot).toBeLessThan(0.95);
  });

  it('sideways stays within a band around the spot', () => {
    const s = scenarioPath('sideways', 365);
    for (const x of s) expect(Math.abs(x / m.spot - 1)).toBeLessThan(0.05);
  });

  it('shock has a gap of the configured size on the shock day', () => {
    const days = 100;
    const s = scenarioPath('shock', days);
    const d = shockDay(days);
    expect(d).toBe(40);
    const jump = s[d]! / s[d - 1]! - 1;
    expect(jump).toBeLessThan(MC_CONFIG.scenarios.shock.gap + 0.02);
    const custom = scenarioPath('shock', days, m, { gap: 0.05, gapAt: 0.5 });
    expect(custom[50]! / custom[49]! - 1).toBeGreaterThan(0.03);
    expect(shockDay(10, 0)).toBe(1);
    expect(shockDay(10, 2)).toBe(10);
  });

  it('accepts overrides and rejects invalid horizons', () => {
    const flat = scenarioPath('trendUp', 30, m, { driftPa: 0, vol: 0 });
    expect(flat.every((x) => x === m.spot)).toBe(true);
    const mr = scenarioPath('sideways', 30, m, { meanReversion: 0, vol: 0 });
    expect(mr.every((x) => x === m.spot)).toBe(true);
    expect(() => scenarioPath('trendUp', 0)).toThrow(RangeError);
  });

  it('random is a risk-neutral GBM path from its seed', () => {
    const r = scenarioPath('random', 30);
    const src = new GbmPathSource(m, { paths: 1, days: 30, seed: MC_CONFIG.scenarios.random.seed, antithetic: false });
    expect(Array.from(r)).toEqual(Array.from(src.next()!));
    expect(Array.from(scenarioPath('random', 30, m, { seed: 7 }))).toEqual(Array.from(randomPath(30, m, 7)));
    expect(Array.from(randomPath(30))).toEqual(Array.from(r));
  });

  it('drive the payoff of a product: trend up knocks the accumulator out, trend down doubles it', () => {
    const acc = buildProduct('accumulator', m, { strike: 0.775 });
    expect(productPayoff(scenarioPath('trendUp', 182), acc, m).reason).toBe('knockout');
    const down = productPayoff(scenarioPath('trendDown', 182), acc, m);
    expect(down.reason).toBe('maturity');
    expect(down.totalBase).toBeGreaterThan(26 * 40_000);
    expect(down.totalPnlQuote).toBeLessThan(0);
  });
});
