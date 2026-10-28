import { describe, expect, it } from 'vitest';
import { normCdf, normInv, normPdf } from '@/lib/fx/normal';

describe('normal distribution', () => {
  it('matches known values of N(x)', () => {
    expect(normCdf(0)).toBeCloseTo(0.5, 15);
    expect(normCdf(1)).toBeCloseTo(0.8413447460685429, 14);
    expect(normCdf(-1.96)).toBeCloseTo(0.024997895148220435, 14);
    expect(normCdf(3)).toBeCloseTo(0.9986501019683699, 14);
    expect(normCdf(-8)).toBeCloseTo(6.220960574271785e-16, 20);
    expect(normCdf(40)).toBe(1);
    expect(normCdf(-40)).toBe(0);
  });

  it('is symmetric: N(x) + N(−x) = 1', () => {
    for (const x of [0.021, 0.5, 1.3, 2.7, 5, 7.5, 10]) {
      expect(normCdf(x) + normCdf(-x)).toBeCloseTo(1, 15);
    }
  });

  it('has the standard density', () => {
    expect(normPdf(0)).toBeCloseTo(0.3989422804014327, 15);
    expect(normPdf(1)).toBeCloseTo(0.24197072451914337, 15);
  });

  it('inverts N(x)', () => {
    for (const p of [1e-10, 0.001, 0.02, 0.25, 0.5, 0.75, 0.975, 0.999, 1 - 1e-10]) {
      expect(normCdf(normInv(p))).toBeCloseTo(p, 12);
    }
    expect(normInv(0.5)).toBeCloseTo(0, 14);
    expect(normInv(0.975)).toBeCloseTo(1.959963984540054, 12);
    expect(normInv(0)).toBe(-Infinity);
    expect(normInv(1)).toBe(Infinity);
    expect(() => normInv(1.5)).toThrow(RangeError);
  });
});
