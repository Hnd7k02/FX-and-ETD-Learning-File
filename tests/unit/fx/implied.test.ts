import { describe, expect, it } from 'vitest';
import { EXAMPLE as E, EXAMPLE_FORWARD, EXAMPLE_STRIKE } from '@/lib/fx/example';
import { greeks } from '@/lib/fx/greeks';
import {
  VOL_MAX,
  VOL_MIN,
  atmDnsStrike,
  atmfStrike,
  impliedVol,
  impliedVolDetail,
  noArbitrageBounds,
  strikeFromDelta,
} from '@/lib/fx/implied';
import { gkPrice, type OptionType } from '@/lib/fx/vanilla';

const K = EXAMPLE_STRIKE;
const ex = [E.spot, E.T, E.vol, E.rd, E.rf] as const;

describe('impliedVol', () => {
  it('recovers 8 % from the example call price (126.69 pips)', () => {
    const c = gkPrice(E.spot, K, E.T, E.vol, E.rd, E.rf, 'call');
    expect(impliedVol(c, E.spot, K, E.T, E.rd, E.rf, 'call')).toBeCloseTo(0.08, 9);
  });

  it('needs only a few Newton steps for the example and no bisection', () => {
    const c = gkPrice(E.spot, K, E.T, E.vol, E.rd, E.rf, 'call');
    const r = impliedVolDetail(c, E.spot, K, E.T, E.rd, E.rf, 'call');
    expect(r.iterations).toBeLessThanOrEqual(5);
    expect(r.bisections).toBe(0);
    expect(r.path).toHaveLength(r.iterations + 1);
    expect(r.path.at(-1)).toBe(r.vol);
  });

  const grid: [number, number, number, number, number, number, OptionType][] = [];
  for (const type of ['call', 'put'] as const) {
    for (const k of [0.74, 0.77, 0.793, 0.81, 0.85]) {
      for (const T of [7 / 365, 0.25, 1, 2]) {
        for (const vol of [0.03, 0.08, 0.2, 0.6]) {
          grid.push([0.8, k, T, vol, 0.01, 0.035, type]);
        }
      }
    }
  }
  it('round-trips price → vol → price on a grid of strikes, tenors and vols', () => {
    let checked = 0;
    for (const [S, k, T, vol, rd, rf, type] of grid) {
      const price = gkPrice(S, k, T, vol, rd, rf, type);
      const { lower } = noArbitrageBounds(S, k, T, rd, rf, type);
      // Skip options whose time value is lost in rounding (no information about vol).
      if (price - lower < 1e-9) continue;
      const iv = impliedVol(price, S, k, T, rd, rf, type);
      expect(Math.abs(gkPrice(S, k, T, iv, rd, rf, type) - price)).toBeLessThanOrEqual(1e-10);
      checked++;
    }
    expect(checked).toBeGreaterThan(120);
  });

  it('recovers the vol itself where vega is not tiny', () => {
    for (const type of ['call', 'put'] as const) {
      for (const vol of [0.04, 0.08, 0.16, 0.5, 1.5]) {
        const p = gkPrice(0.8, 0.8, 0.5, vol, 0.005, 0.035, type);
        expect(impliedVol(p, 0.8, 0.8, 0.5, 0.005, 0.035, type)).toBeCloseTo(vol, 8);
      }
    }
  });

  it('falls back to bisection from a bad start and still converges', () => {
    const p = gkPrice(0.8, 0.86, 0.25, 0.1, 0, 0.035, 'call');
    const r = impliedVolDetail(p, 0.8, 0.86, 0.25, 0, 0.035, 'call', { guess: 4.9 });
    expect(r.vol).toBeCloseTo(0.1, 8);
    expect(r.bisections).toBeGreaterThan(0);
  });

  it('honours guess, tol and maxIter', () => {
    const p = gkPrice(0.8, 0.8, 1, 0.12, 0, 0.035, 'put');
    expect(impliedVolDetail(p, 0.8, 0.8, 1, 0, 0.035, 'put', { guess: 0.12 }).iterations).toBe(0);
    const loose = impliedVol(p, 0.8, 0.8, 1, 0, 0.035, 'put', { tol: 1e-4 });
    expect(Math.abs(loose - 0.12)).toBeLessThan(0.01);
    expect(() => impliedVol(p, 0.8, 0.8, 1, 0, 0.035, 'put', { guess: 3, maxIter: 1 })).toThrow(
      /no convergence/,
    );
  });

  it('accepts a converged last step when maxIter is reached exactly', () => {
    const p = gkPrice(0.8, 0.8, 1, 0.12, 0, 0.035, 'call');
    const full = impliedVolDetail(p, 0.8, 0.8, 1, 0, 0.035, 'call');
    expect(full.iterations).toBeGreaterThan(0);
    const exact = impliedVolDetail(p, 0.8, 0.8, 1, 0, 0.035, 'call', { maxIter: full.iterations });
    expect(exact.vol).toBe(full.vol);
    expect(exact.iterations).toBe(full.iterations);
  });

  it('throws RangeError outside the no-arbitrage bounds', () => {
    const { lower, upper } = noArbitrageBounds(0.8, 0.75, 0.25, 0, 0.035, 'call');
    expect(lower).toBeCloseTo(0.8 * Math.exp(-0.035 * 0.25) - 0.75, 15);
    expect(upper).toBeCloseTo(0.8 * Math.exp(-0.035 * 0.25), 15);
    expect(() => impliedVol(lower - 1e-6, 0.8, 0.75, 0.25, 0, 0.035, 'call')).toThrow(RangeError);
    expect(() => impliedVol(upper, 0.8, 0.75, 0.25, 0, 0.035, 'call')).toThrow(RangeError);
    expect(() => impliedVol(-0.001, 0.8, 0.85, 0.25, 0, 0.035, 'put')).toThrow(/no-arbitrage/);
    const putBounds = noArbitrageBounds(0.8, 0.85, 0.25, 0.01, 0.035, 'put');
    expect(putBounds.upper).toBeCloseTo(0.85 * Math.exp(-0.01 * 0.25), 15);
    expect(() => impliedVol(putBounds.upper + 1e-6, 0.8, 0.85, 0.25, 0.01, 0.035, 'put')).toThrow(
      RangeError,
    );
  });

  it('throws RangeError for invalid inputs', () => {
    expect(() => impliedVol(0.01, 0.8, 0.8, 0, 0, 0, 'call')).toThrow(RangeError);
    expect(() => impliedVol(0.01, 0, 0.8, 1, 0, 0, 'call')).toThrow(RangeError);
    expect(() => impliedVol(0.01, 0.8, -1, 1, 0, 0, 'call')).toThrow(RangeError);
    expect(() => impliedVol(Number.NaN, 0.8, 0.8, 1, 0, 0, 'call')).toThrow(RangeError);
  });

  it('handles the edges of the search interval', () => {
    const [S, k, T] = [0.8, 0.8, 0.25];
    // Within tol of the price at VOL_MIN / VOL_MAX: return the edge.
    const pMin = gkPrice(S, k, T, VOL_MIN, 0, 0, 'call');
    expect(impliedVol(pMin, S, k, T, 0, 0, 'call')).toBe(VOL_MIN);
    const pMax = gkPrice(S, k, T, VOL_MAX, 0, 0, 'call');
    expect(impliedVol(pMax, S, k, T, 0, 0, 'call')).toBe(VOL_MAX);
    // Inside the no-arbitrage bounds but beyond the interval: RangeError.
    expect(() => impliedVol(pMin / 10, S, k, T, 0, 0, 'call')).toThrow(/below/);
    const { upper } = noArbitrageBounds(S, k, T, 0, 0, 'call');
    expect(() => impliedVol((pMax + upper) / 2, S, k, T, 0, 0, 'call')).toThrow(/above/);
  });
});

describe('strikeFromDelta', () => {
  const F = EXAMPLE_FORWARD;

  it('puts 25Δ and 10Δ call strikes above the forward and put strikes below', () => {
    const c25 = strikeFromDelta(0.25, ...ex, 'call');
    const c10 = strikeFromDelta(0.1, ...ex, 'call');
    const p25 = strikeFromDelta(-0.25, ...ex, 'put');
    const p10 = strikeFromDelta(-0.1, ...ex, 'put');
    expect(p10).toBeLessThan(p25);
    expect(p25).toBeLessThan(F);
    expect(F).toBeLessThan(c25);
    expect(c25).toBeLessThan(c10);
  });

  it('matches an independent Python check (statistics.NormalDist)', () => {
    // python3: K = F·exp(−d1·σ√T + ½σ²T), d1 = ±N⁻¹(|Δ|·e^(rf T)) (spot) or ±N⁻¹(|Δ|) (forward)
    expect(strikeFromDelta(0.25, ...ex, 'call')).toBeCloseTo(0.815145, 6);
    expect(strikeFromDelta(0.25, ...ex, 'put')).toBeCloseTo(0.772752, 6);
    expect(strikeFromDelta(0.1, ...ex, 'call')).toBeCloseTo(0.835244, 6);
    expect(strikeFromDelta(0.1, ...ex, 'put')).toBeCloseTo(0.754156, 6);
    expect(strikeFromDelta(0.25, ...ex, 'call', 'forward')).toBeCloseTo(0.815369, 6);
    expect(strikeFromDelta(-0.1, ...ex, 'put', 'forward')).toBeCloseTo(0.754006, 6);
  });

  it('gives back the input delta (spot and forward, call and put)', () => {
    for (const d of [0.05, 0.1, 0.25, 0.4, 0.5, 0.75, 0.9]) {
      const kc = strikeFromDelta(d, ...ex, 'call');
      expect(greeks(E.spot, kc, E.T, E.vol, E.rd, E.rf, 'call').delta).toBeCloseTo(d, 12);
      const kp = strikeFromDelta(-d, ...ex, 'put');
      expect(greeks(E.spot, kp, E.T, E.vol, E.rd, E.rf, 'put').delta).toBeCloseTo(-d, 12);
      const kcf = strikeFromDelta(d, ...ex, 'call', 'forward');
      expect(greeks(E.spot, kcf, E.T, E.vol, E.rd, E.rf, 'call').deltaFwd).toBeCloseTo(d, 12);
      const kpf = strikeFromDelta(-d, ...ex, 'put', 'forward');
      expect(greeks(E.spot, kpf, E.T, E.vol, E.rd, E.rf, 'put').deltaFwd).toBeCloseTo(-d, 12);
    }
  });

  it('accepts put deltas as negative or absolute values', () => {
    expect(strikeFromDelta(0.25, ...ex, 'put')).toBe(strikeFromDelta(-0.25, ...ex, 'put'));
  });

  it('pushes the strikes outward with higher vol and longer tenor', () => {
    const c25 = strikeFromDelta(0.25, E.spot, E.T, 0.08, E.rd, E.rf, 'call');
    expect(strikeFromDelta(0.25, E.spot, E.T, 0.12, E.rd, E.rf, 'call')).toBeGreaterThan(c25);
    expect(strikeFromDelta(0.25, E.spot, 1, 0.08, E.rd, E.rf, 'call')).toBeGreaterThan(c25);
  });

  it('throws RangeError for deltas that cannot be reached', () => {
    // Spot call delta is capped at e^(−rf T) < 1.
    expect(() => strikeFromDelta(0.995, ...ex, 'call')).toThrow(RangeError);
    expect(strikeFromDelta(0.99, ...ex, 'call', 'forward')).toBeLessThan(EXAMPLE_FORWARD);
    expect(() => strikeFromDelta(-0.25, ...ex, 'call')).toThrow(RangeError);
    expect(() => strikeFromDelta(0, ...ex, 'put')).toThrow(RangeError);
    expect(() => strikeFromDelta(1, ...ex, 'put', 'forward')).toThrow(RangeError);
    expect(() => strikeFromDelta(0.25, E.spot, 0, E.vol, E.rd, E.rf, 'call')).toThrow(RangeError);
    expect(() => strikeFromDelta(0.25, E.spot, E.T, 0, E.rd, E.rf, 'call')).toThrow(RangeError);
  });
});

describe('ATM strikes', () => {
  it('has ATMF = forward 0.79303 and the example strike rounds it', () => {
    const f = atmfStrike(E.spot, E.T, E.rd, E.rf);
    expect(f).toBeCloseTo(EXAMPLE_FORWARD, 15);
    expect(Math.round(f * 1e4) / 1e4).toBe(K);
  });

  it('puts the delta-neutral straddle strike F·e^(½σ²T) slightly above the forward', () => {
    const dns = atmDnsStrike(...ex);
    expect(dns).toBeCloseTo(0.79366521, 8);
    expect(dns).toBeGreaterThan(EXAMPLE_FORWARD);
    // That is the 50Δ forward strike of both call and put.
    expect(strikeFromDelta(0.5, ...ex, 'call', 'forward')).toBeCloseTo(dns, 12);
    expect(strikeFromDelta(-0.5, ...ex, 'put', 'forward')).toBeCloseTo(dns, 12);
  });

  it('makes a delta-neutral straddle at the DNS strike', () => {
    const dns = atmDnsStrike(...ex);
    const c = greeks(E.spot, dns, E.T, E.vol, E.rd, E.rf, 'call');
    const p = greeks(E.spot, dns, E.T, E.vol, E.rd, E.rf, 'put');
    expect(c.delta + p.delta).toBeCloseTo(0, 14);
    expect(c.deltaFwd).toBeCloseTo(0.5, 14);
  });

  it('has the largest vega across strikes exactly at the DNS strike', () => {
    const dns = atmDnsStrike(...ex);
    const vegaAt = (k: number): number => greeks(E.spot, k, E.T, E.vol, E.rd, E.rf, 'call').vega;
    for (const dk of [-0.002, -0.0005, -1e-5, 1e-5, 0.0005, 0.002]) {
      expect(vegaAt(dns)).toBeGreaterThan(vegaAt(dns + dk));
    }
  });
});
