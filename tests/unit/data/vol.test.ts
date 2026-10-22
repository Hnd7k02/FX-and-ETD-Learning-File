import { describe, expect, it } from 'vitest';
import { isoFromDayNumber } from '@/lib/data/dates';
import type { Series } from '@/lib/data/series';
import { ANNUALISATION, VOL_WINDOW, logReturns, realisedVol } from '@/lib/data/vol';

/** Series from log returns, starting at 1.0, one point per calendar day. */
function fromReturns(returns: number[], start = 1): Series {
  const out: Series = [{ date: isoFromDayNumber(20000), value: start }];
  returns.forEach((r, i) =>
    out.push({ date: isoFromDayNumber(20001 + i), value: out[i]!.value * Math.exp(r) }),
  );
  return out;
}

describe('log returns', () => {
  it('are ln(S_t / S_t−1), dated with the later fixing', () => {
    const r = logReturns([
      { date: 'a', value: 1 },
      { date: 'b', value: Math.E },
      { date: 'c', value: 1 },
    ]);
    expect(r).toEqual([
      { date: 'b', value: 1 },
      { date: 'c', value: -1 },
    ]);
  });
});

describe('realised volatility', () => {
  it('uses 21 returns and √252', () => {
    expect(VOL_WINDOW).toBe(21);
    expect(ANNUALISATION).toBe(252);
  });

  it('alternating ±r returns give exactly r · √252 · 100', () => {
    const r = 0.005;
    const s = fromReturns(Array.from({ length: 60 }, (_, i) => (i % 2 ? -r : r)));
    const v = realisedVol(s);
    for (const p of v) expect(p.value).toBeCloseTo(r * Math.sqrt(252) * 100, 10);
    expect(v[0]!.value).toBeCloseTo(7.937253933193772, 10);
  });

  it('starts with the 22nd fixing and has one value per fixing after that', () => {
    const s = fromReturns(Array.from({ length: 30 }, () => 0.001));
    const v = realisedVol(s);
    expect(v).toHaveLength(s.length - 21);
    expect(v[0]!.date).toBe(s[21]!.date);
    expect(v[v.length - 1]!.date).toBe(s[s.length - 1]!.date);
    // zero mean: a constant drift of 0.1 % a day is counted fully as volatility
    expect(v[0]!.value).toBeCloseTo(0.001 * Math.sqrt(252) * 100, 10);
  });

  it('is zero for a flat series and empty for fewer than 22 fixings', () => {
    expect(realisedVol(fromReturns(Array(25).fill(0))).every((p) => p.value === 0)).toBe(true);
    expect(realisedVol(fromReturns(Array(20).fill(0.01)))).toEqual([]);
  });

  it('keeps a single jump in the window for exactly 21 returns', () => {
    const returns = Array<number>(60).fill(0);
    returns[30] = 0.1; // jump on fixing index 31
    const v = realisedVol(fromReturns(returns));
    const jump = 0.1 * Math.sqrt(252 / 21) * 100;
    const nonZero = v.filter((p) => p.value > 0);
    expect(nonZero).toHaveLength(21);
    for (const p of nonZero) expect(p.value).toBeCloseTo(jump, 10);
  });

  it('accepts another window and annualisation', () => {
    const s = fromReturns([0.01, -0.01, 0.01, -0.01]);
    const v = realisedVol(s, 2, 1);
    expect(v).toHaveLength(3);
    expect(v[0]!.value).toBeCloseTo(1, 12);
  });
});
