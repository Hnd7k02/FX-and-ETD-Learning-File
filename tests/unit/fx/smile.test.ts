import { describe, expect, it } from 'vitest';
import { EXAMPLE as E, EXAMPLE_FORWARD as F } from '@/lib/fx/example';
import {
  DEFAULT_SMILE_DELTAS,
  forwardDelta,
  minSmileVol,
  quotesFromVols,
  smileCurve,
  smilePillars,
  smileRange,
  smileStrike,
  smileVol,
  solveVolAtStrike,
  strikeFromForwardDelta,
  vol25Call,
  vol25Put,
  volAtStrike,
  type SmileQuotes,
} from '@/lib/fx/smile';

const T = E.T;
/** USD/CHF-like test quotes: demand for CHF calls (USD puts) → RR < 0. */
const Q: SmileQuotes = { atm: E.vol, rr25: -0.01, bf25: 0.0025 };
const STRIKES = [0.72, 0.75, 0.77, 0.78, 0.79, 0.793, 0.8, 0.81, 0.82, 0.84, 0.87];

describe('smileVol: quote identities', () => {
  it('ATM at Δ = 0.5', () => {
    expect(smileVol(0.5, Q)).toBe(Q.atm);
  });

  it('σ25C = ATM + BF + RR/2 at Δ = 0.25, σ25P = ATM + BF − RR/2 at Δ = 0.75', () => {
    for (const q of [Q, { atm: 0.1, rr25: 0.02, bf25: 0.004 }, { atm: 0.07, rr25: 0, bf25: 0 }]) {
      expect(Math.abs(smileVol(0.25, q) - (q.atm + q.bf25 + q.rr25 / 2))).toBeLessThan(1e-12);
      expect(Math.abs(smileVol(0.75, q) - (q.atm + q.bf25 - q.rr25 / 2))).toBeLessThan(1e-12);
      expect(Math.abs(vol25Call(q) - smileVol(0.25, q))).toBeLessThan(1e-12);
      expect(Math.abs(vol25Put(q) - smileVol(0.75, q))).toBeLessThan(1e-12);
    }
  });

  it('RR = σ25C − σ25P and BF = (σ25C + σ25P)/2 − ATM', () => {
    expect(Math.abs(vol25Call(Q) - vol25Put(Q) - Q.rr25)).toBeLessThan(1e-12);
    expect(Math.abs((vol25Call(Q) + vol25Put(Q)) / 2 - Q.atm - Q.bf25)).toBeLessThan(1e-12);
  });

  it('quotesFromVols inverts vol25Call / vol25Put', () => {
    const back = quotesFromVols(Q.atm, vol25Call(Q), vol25Put(Q));
    expect(back.atm).toBe(Q.atm);
    expect(Math.abs(back.rr25 - Q.rr25)).toBeLessThan(1e-12);
    expect(Math.abs(back.bf25 - Q.bf25)).toBeLessThan(1e-12);
  });

  it('RR = 0: symmetric smile in delta around 0.5', () => {
    const sym = { atm: 0.08, rr25: 0, bf25: 0.003 };
    for (const d of [0.05, 0.15, 0.25, 0.4]) {
      expect(Math.abs(smileVol(0.5 + d, sym) - smileVol(0.5 - d, sym))).toBeLessThan(1e-15);
      expect(smileVol(0.5 + d, sym)).toBeGreaterThan(sym.atm);
    }
  });

  it('BF = 0: the smile is a straight line in delta (pure skew)', () => {
    const skew = { atm: 0.08, rr25: -0.01, bf25: 0 };
    expect(smileVol(0, skew) - smileVol(0.5, skew)).toBeCloseTo(
      smileVol(0.5, skew) - smileVol(1, skew),
      14,
    );
  });

  it('RR < 0: the 25Δ put (low strike) is dearer than the 25Δ call (high strike)', () => {
    const { put25, call25 } = smilePillars(F, T, Q);
    expect(put25.K).toBeLessThan(call25.K);
    expect(put25.vol).toBeGreaterThan(call25.vol);
    // and with strikes: vol at a low strike above vol at the mirror high strike
    const low = volAtStrike(F * Math.exp(-0.05), F, T, Q);
    const high = volAtStrike(F * Math.exp(0.05), F, T, Q);
    expect(low).toBeGreaterThan(high);
  });

  it('RR > 0: higher vols at high strikes', () => {
    const up = { ...Q, rr25: 0.01 };
    expect(volAtStrike(F * 1.05, F, T, up)).toBeGreaterThan(volAtStrike(F * 0.95, F, T, up));
  });
});

describe('smileRange / minSmileVol', () => {
  it('convex smile with vertex inside [0, 1]', () => {
    const r = smileRange(Q);
    const vertex = 0.5 + Q.rr25 / (16 * Q.bf25);
    expect(r.min).toBeCloseTo(smileVol(vertex, Q), 15);
    expect(r.min).toBeCloseTo(Q.atm - (Q.rr25 * Q.rr25) / (16 * Q.bf25), 15);
    expect(r.max).toBe(Math.max(smileVol(0, Q), smileVol(1, Q)));
    expect(minSmileVol(Q)).toBe(r.min);
  });

  it('flat and linear smiles take their extremes at the ends', () => {
    expect(smileRange({ atm: 0.08, rr25: 0, bf25: 0 })).toEqual({ min: 0.08, max: 0.08 });
    const r = smileRange({ atm: 0.08, rr25: -0.01, bf25: 0 });
    expect(r.min).toBeCloseTo(0.07, 15);
    expect(r.max).toBeCloseTo(0.09, 15);
  });

  it('concave smile (BF < 0): maximum at the vertex', () => {
    const q = { atm: 0.08, rr25: 0.002, bf25: -0.002 };
    const vertex = 0.5 + q.rr25 / (16 * q.bf25);
    expect(smileRange(q).max).toBeCloseTo(smileVol(vertex, q), 15);
  });

  it('flags quotes with a negative wing', () => {
    expect(minSmileVol({ atm: 0.05, rr25: -0.2, bf25: 0 })).toBeLessThan(0);
  });
});

describe('forwardDelta / strikeFromForwardDelta', () => {
  it('round trip strike → delta → strike', () => {
    for (const d of [0.1, 0.25, 0.5, 0.75, 0.9]) {
      const K = strikeFromForwardDelta(d, F, T, 0.08);
      expect(Math.abs(forwardDelta(K, F, T, 0.08) - d)).toBeLessThan(1e-12);
    }
  });

  it('Δ = 0.5 is the delta-neutral straddle strike F · e^(½σ²T)', () => {
    const K = strikeFromForwardDelta(0.5, F, T, 0.08);
    expect(K / (F * Math.exp(0.5 * 0.08 * 0.08 * T)) - 1).toBeCloseTo(0, 14);
  });
});

describe('volAtStrike: σ = σ(N(d1(K, σ)))', () => {
  it('is consistent with the delta of the strike', () => {
    for (const K of STRIKES) {
      const r = solveVolAtStrike(K, F, T, Q);
      expect(r.method).toBe('fixed-point');
      expect(r.iterations).toBeLessThan(25);
      expect(Math.abs(r.vol - smileVol(forwardDelta(K, F, T, r.vol), Q))).toBeLessThan(1e-12);
      expect(Math.abs(r.deltaFwd - forwardDelta(K, F, T, r.vol))).toBeLessThan(1e-15);
      expect(r.path[0]).toBe(Q.atm);
      expect(r.path.at(-1)).toBe(r.vol);
      expect(volAtStrike(K, F, T, Q)).toBe(r.vol);
    }
  });

  it('gives ATM at the ATM (DNS) strike and the pillar vols at the pillar strikes', () => {
    const { put25, atm, call25 } = smilePillars(F, T, Q);
    expect(Math.abs(volAtStrike(atm.K, F, T, Q) - Q.atm)).toBeLessThan(1e-12);
    expect(Math.abs(volAtStrike(put25.K, F, T, Q) - vol25Put(Q))).toBeLessThan(1e-12);
    expect(Math.abs(volAtStrike(call25.K, F, T, Q) - vol25Call(Q))).toBeLessThan(1e-12);
    expect(put25.deltaFwd).toBe(0.75);
    expect(atm.deltaFwd).toBe(0.5);
    expect(call25.deltaFwd).toBe(0.25);
  });

  it('flat smile: every strike has the ATM vol', () => {
    const flat = { atm: 0.09, rr25: 0, bf25: 0 };
    for (const K of STRIKES) expect(volAtStrike(K, F, T, flat)).toBe(0.09);
  });

  it('far wings tend to the smile at Δ → 0 and Δ → 1', () => {
    expect(volAtStrike(F * 0.5, F, T, Q)).toBeCloseTo(smileVol(1, Q), 10);
    expect(volAtStrike(F * 2, F, T, Q)).toBeCloseTo(smileVol(0, Q), 10);
  });

  it('falls back to bisection where the fixed point does not converge', () => {
    const steep = { atm: 0.08, rr25: -0.15, bf25: 0.1 };
    const r = solveVolAtStrike(0.88, 0.8, 0.25, steep);
    expect(r.method).toBe('bisection');
    expect(r.iterations).toBe(r.path.length);
    expect(Math.abs(r.vol - smileVol(forwardDelta(0.88, 0.8, 0.25, r.vol), steep))).toBeLessThan(
      1e-11,
    );
  });

  it('throws for invalid inputs or quotes without a positive solution', () => {
    expect(() => volAtStrike(0, F, T, Q)).toThrow(RangeError);
    expect(() => volAtStrike(0.8, F, 0, Q)).toThrow(RangeError);
    expect(() => volAtStrike(0.8, F, T, { atm: -0.1, rr25: 0, bf25: 0 })).toThrow(RangeError);
  });
});

describe('smileStrike / smileCurve', () => {
  it('smileStrike puts the strike where the smile delta says', () => {
    for (const d of [0.1, 0.25, 0.5, 0.75, 0.9]) {
      const K = smileStrike(d, F, T, Q);
      expect(Math.abs(forwardDelta(K, F, T, smileVol(d, Q)) - d)).toBeLessThan(1e-12);
    }
  });

  it('smileStrike rejects deltas outside (0, 1) and non-positive vols', () => {
    expect(() => smileStrike(0, F, T, Q)).toThrow(RangeError);
    expect(() => smileStrike(1, F, T, Q)).toThrow(RangeError);
    expect(() => smileStrike(0.9, F, T, { atm: 0.05, rr25: 0.2, bf25: 0 })).toThrow(RangeError);
  });

  it('delta grid and strike grid describe the same curve', () => {
    const byDelta = smileCurve(F, T, Q, { deltas: [0.1, 0.25, 0.5, 0.75, 0.9] });
    const byStrike = smileCurve(F, T, Q, { strikes: byDelta.map((p) => p.K) });
    byDelta.forEach((p, i) => {
      const s = byStrike[i]!;
      expect(s.K).toBe(p.K);
      expect(Math.abs(s.vol - p.vol)).toBeLessThan(1e-12);
      expect(Math.abs(s.deltaFwd - p.deltaFwd)).toBeLessThan(1e-12);
    });
  });

  it('a delta grid runs from high to low strikes; RR < 0 lifts the low-strike end', () => {
    const curve = smileCurve(F, T, Q, { deltas: DEFAULT_SMILE_DELTAS });
    expect(curve).toHaveLength(19);
    for (let i = 1; i < curve.length; i++) expect(curve[i]!.K).toBeLessThan(curve[i - 1]!.K);
    expect(curve.at(-1)!.vol).toBeGreaterThan(curve[0]!.vol);
  });

  it('DEFAULT_SMILE_DELTAS = 0.05 … 0.95', () => {
    expect(DEFAULT_SMILE_DELTAS[0]).toBe(0.05);
    expect(DEFAULT_SMILE_DELTAS[9]).toBe(0.5);
    expect(DEFAULT_SMILE_DELTAS.at(-1)).toBe(0.95);
  });
});
