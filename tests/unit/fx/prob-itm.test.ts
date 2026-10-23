import { describe, expect, it } from 'vitest';
import { EXAMPLE as E } from '@/lib/fx/example';
import { digitalCash } from '@/lib/fx/exotics';
import { greeks } from '@/lib/fx/greeks';
import { strikeFromDelta } from '@/lib/fx/implied';
import { normCdf } from '@/lib/fx/normal';
import { d1d2, gkPrice, probItm, type OptionType } from '@/lib/fx/vanilla';

const { spot: S, T, vol, rd, rf } = E;
const strike = (delta: number, type: OptionType) => strikeFromDelta(delta, S, T, vol, rd, rf, type);

describe('probItm: risk-neutral chance of expiring in the money (N(d2) / N(−d2))', () => {
  // Check values of the product owner's supplement (point 12), at the exact delta strikes.
  const cases = [
    { name: '25Δ call', delta: 0.25, type: 'call', K: 0.815145, p: 0.2396 },
    { name: '25Δ put', delta: -0.25, type: 'put', K: 0.772752, p: 0.2651 },
    { name: '10Δ call', delta: 0.1, type: 'call', K: 0.835244, p: 0.094 },
    { name: '10Δ put', delta: -0.1, type: 'put', K: 0.754156, p: 0.1081 },
  ] as const;

  it.each(cases)('$name: delta and probability are two different values', (c) => {
    const K = strike(c.delta, c.type);
    expect(K).toBeCloseTo(c.K, 6);
    const delta = greeks(S, K, T, vol, rd, rf, c.type).delta;
    const p = probItm(S, K, T, vol, rd, rf, c.type);
    expect(delta).toBeCloseTo(c.delta, 12);
    expect(p).toBeCloseTo(c.p, 4);
    expect(Math.abs(p - Math.abs(delta))).toBeGreaterThan(0.005);
  });

  it('the call chance lies below |delta|, the put chance above it', () => {
    for (const d of [0.1, 0.25]) {
      expect(probItm(S, strike(d, 'call'), T, vol, rd, rf, 'call')).toBeLessThan(d);
      expect(probItm(S, strike(-d, 'put'), T, vol, rd, rf, 'put')).toBeGreaterThan(d);
    }
  });

  it('is N(d2) for the call and N(−d2) for the put; both add up to 1', () => {
    for (const K of [0.75, 0.793, 0.8, 0.85]) {
      const { d2 } = d1d2(S, K, T, vol, rd, rf);
      const c = probItm(S, K, T, vol, rd, rf, 'call');
      const p = probItm(S, K, T, vol, rd, rf, 'put');
      expect(c).toBeCloseTo(normCdf(d2), 14);
      expect(p).toBeCloseTo(normCdf(-d2), 14);
      expect(c + p).toBeCloseTo(1, 14);
    }
  });

  it('matches the digital (undiscounted) and −∂C/∂K from the vanilla price', () => {
    const r = 0.01;
    for (const K of [0.77, 0.8, 0.83]) {
      const df = Math.exp(-r * T);
      expect(probItm(S, K, T, vol, r, rf, 'call')).toBeCloseTo(
        digitalCash(S, K, T, vol, r, rf, 'call') / df,
        12,
      );
      const h = 1e-5;
      const dCdK =
        (gkPrice(S, K + h, T, vol, r, rf, 'call') - gkPrice(S, K - h, T, vol, r, rf, 'call')) /
        (2 * h);
      expect(probItm(S, K, T, vol, r, rf, 'call')).toBeCloseTo(-dCdK / df, 6);
    }
  });

  it('handles expiry and zero vol as an in-the-money test (½ at the strike)', () => {
    expect(probItm(0.81, 0.8, 0, vol, rd, rf, 'call')).toBe(1);
    expect(probItm(0.81, 0.8, -1, vol, rd, rf, 'put')).toBe(0);
    expect(probItm(0.8, 0.8, 0, vol, rd, rf, 'put')).toBe(0.5);
    // vol = 0: the forward 0.79303 decides, not the spot
    expect(probItm(S, 0.799, T, 0, rd, rf, 'call')).toBe(0);
    expect(probItm(S, 0.799, T, 0, rd, rf, 'put')).toBe(1);
    expect(probItm(0.8, 0.8, T, 0, 0, 0, 'call')).toBe(0.5);
  });
});
