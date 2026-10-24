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

  it('trend up and trend down end exactly at spot · (1 ± 8 %), with noise in between', () => {
    for (const days of [182, 365]) {
      const up = scenarioPath('trendUp', days);
      const down = scenarioPath('trendDown', days);
      expect(up[days]).toBeCloseTo(m.spot * 1.08, 12);
      expect(down[days]).toBeCloseTo(m.spot * 0.92, 12);
      expect(up[100]).not.toBeCloseTo(m.spot * 1.08 ** (100 / days), 4);
    }
  });

  it('sideways stays within ±3 % of the spot and returns to it', () => {
    for (const days of [182, 365]) {
      const s = scenarioPath('sideways', days);
      for (const x of s) expect(Math.abs(x / m.spot - 1)).toBeLessThan(0.03);
      expect(s[days]).toBeCloseTo(m.spot, 12);
    }
  });

  it('shock has a gap of the configured size on the shock day and ends at spot · (1 + gap)', () => {
    const days = 100;
    const s = scenarioPath('shock', days);
    const d = shockDay(days);
    expect(d).toBe(40);
    const jump = s[d]! / s[d - 1]! - 1;
    expect(jump).toBeLessThan(MC_CONFIG.scenarios.shock.gap + 0.01);
    expect(s[days]).toBeCloseTo(m.spot * (1 + MC_CONFIG.scenarios.shock.gap), 12);
    const custom = scenarioPath('shock', days, m, { gap: 0.05, gapAt: 0.5 });
    expect(custom[50]! / custom[49]! - 1).toBeGreaterThan(0.04);
    expect(shockDay(10, 0)).toBe(1);
    expect(shockDay(10, 2)).toBe(10);
  });

  it('accepts overrides and rejects invalid horizons', () => {
    const flat = scenarioPath('trendUp', 30, m, { move: 0, vol: 0 });
    expect(flat.every((x) => x === m.spot)).toBe(true);
    expect(() => scenarioPath('trendUp', 0)).toThrow(RangeError);
  });

  it('random is a risk-neutral GBM path from its seed', () => {
    const r = scenarioPath('random', 30);
    const src = new GbmPathSource(m, {
      paths: 1,
      days: 30,
      seed: MC_CONFIG.scenarios.random.seed,
      antithetic: false,
    });
    expect(Array.from(r)).toEqual(Array.from(src.next()!));
    expect(Array.from(scenarioPath('random', 30, m, { seed: 7 }))).toEqual(
      Array.from(randomPath(30, m, 7)),
    );
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
