import { describe, expect, it } from 'vitest';
import { EXAMPLE as E, EXAMPLE_FORWARD, EXAMPLE_STRIKE } from '@/lib/fx/example';
import {
  black76,
  d1d2,
  gkPrice,
  intrinsicForward,
  parityResidual,
  payoff,
  putFromCall,
  timeValue,
} from '@/lib/fx/vanilla';

const K = EXAMPLE_STRIKE;

describe('running example (docs/reference/gk_reference.py)', () => {
  it('has forward 0.79303 and strike 0.7930', () => {
    expect(EXAMPLE_FORWARD).toBeCloseTo(0.79303, 5);
    expect(Math.abs(EXAMPLE_FORWARD - 0.79303)).toBeLessThan(1e-5);
    expect((EXAMPLE_FORWARD - E.spot) * 1e4).toBeCloseTo(-69.7, 1);
    expect(K).toBe(0.793);
  });

  it('prices the call at 126.69 pips = CHF 12’669', () => {
    const c = gkPrice(E.spot, K, E.T, E.vol, E.rd, E.rf, 'call');
    expect(Math.abs(c * 1e4 - 126.69)).toBeLessThan(0.01);
    expect(Math.round(c * E.notional)).toBe(12669);
  });

  it('satisfies put-call parity to 1e-10', () => {
    const c = gkPrice(E.spot, K, E.T, E.vol, E.rd, E.rf, 'call');
    const p = gkPrice(E.spot, K, E.T, E.vol, E.rd, E.rf, 'put');
    const dfd = Math.exp(-E.rd * E.T);
    expect(Math.abs(parityResidual(c, p, EXAMPLE_FORWARD, K, dfd))).toBeLessThan(1e-10);
    expect(putFromCall(c, EXAMPLE_FORWARD, K, dfd)).toBeCloseTo(p, 12);
  });

  it('has ATMF time value 126.5 pips (3M) and 253.0 pips (1Y) under Black-76', () => {
    expect(Math.abs(black76(K, K, 0.25, E.vol, 'call') * 1e4 - 126.5)).toBeLessThan(0.1);
    expect(Math.abs(black76(K, K, 1, E.vol, 'call') * 1e4 - 253.0)).toBeLessThan(0.1);
  });

  it('computes d1 and d2', () => {
    const { d1, d2, F } = d1d2(E.spot, K, E.T, E.vol, E.rd, E.rf);
    expect(F).toBeCloseTo(EXAMPLE_FORWARD, 14);
    expect(d1).toBeCloseTo(0.021, 3);
    expect(d1 - d2).toBeCloseTo(E.vol * Math.sqrt(E.T), 14);
  });
});

describe('edge cases', () => {
  it('returns the payoff at or after expiry', () => {
    expect(gkPrice(0.81, 0.8, 0, 0.1, 0, 0, 'call')).toBeCloseTo(0.01, 14);
    expect(gkPrice(0.79, 0.8, -1, 0.1, 0, 0, 'put')).toBeCloseTo(0.01, 14);
    expect(black76(0.81, 0.8, 0, 0.1, 'call', 0.5)).toBeCloseTo(0.005, 14);
    expect(payoff(0.7, 0.8, 'call')).toBe(0);
  });

  it('handles zero volatility as discounted forward intrinsic', () => {
    const v = gkPrice(0.8, 0.79, 0.5, 0, 0.01, 0.03, 'call');
    const F = 0.8 * Math.exp((0.01 - 0.03) * 0.5);
    expect(v).toBeCloseTo(Math.exp(-0.01 * 0.5) * Math.max(F - 0.79, 0), 14);
    expect(black76(0.8, 0.79, 1, 0, 'put')).toBe(0);
  });

  it('splits the premium into intrinsic (vs forward) and time value', () => {
    const S = 0.82;
    const T = 0.25;
    const price = gkPrice(S, K, T, E.vol, E.rd, E.rf, 'call');
    const F = S * Math.exp((E.rd - E.rf) * T);
    const iv = intrinsicForward(F, K, 'call', Math.exp(-E.rd * T));
    expect(timeValue(S, K, T, E.vol, E.rd, E.rf, 'call')).toBeCloseTo(price - iv, 14);
    expect(timeValue(S, K, T, E.vol, E.rd, E.rf, 'put')).toBeGreaterThan(0);
  });

  it('increases with spot and volatility (call)', () => {
    let prev = -1;
    for (const S of [0.76, 0.78, 0.8, 0.82, 0.84]) {
      const v = gkPrice(S, K, E.T, E.vol, E.rd, E.rf, 'call');
      expect(v).toBeGreaterThan(prev);
      prev = v;
    }
    prev = -1;
    for (const vol of [0.04, 0.08, 0.12, 0.16]) {
      const v = gkPrice(E.spot, K, E.T, vol, E.rd, E.rf, 'call');
      expect(v).toBeGreaterThan(prev);
      prev = v;
    }
  });
});
