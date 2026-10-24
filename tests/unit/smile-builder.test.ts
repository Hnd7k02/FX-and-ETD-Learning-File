import { describe, expect, it } from 'vitest';
import { EXAMPLE as E, EXAMPLE_FORWARD as F, EXAMPLE_SMILE as Q } from '@/lib/fx/example';
import { forwardDelta, smileVol, vol25Call, vol25Put } from '@/lib/fx/smile';
import { gkPrice } from '@/lib/fx/vanilla';
import {
  DELTA_TICKS,
  SMILE_GRID,
  SMILE_LIMITS,
  clampQuotes,
  dragPillar,
  higherWing,
  premiumEffect,
  sameQuotes,
  smileGeometry,
  smilePresets,
  smileShape,
  volDomain,
  baseVolRange,
  pickLabelSpot,
} from '@/lib/smile-builder';

describe('grid and geometry', () => {
  it('samples call delta 0.02 … 0.98 in steps of 0.01', () => {
    expect(SMILE_GRID).toHaveLength(97);
    expect(SMILE_GRID[0]).toBe(0.02);
    expect(SMILE_GRID[96]).toBe(0.98);
    expect(SMILE_GRID).toContain(0.25);
    expect(SMILE_GRID).toContain(0.5);
    expect(SMILE_GRID).toContain(0.75);
    expect(DELTA_TICKS.map((t) => t.delta)).toEqual([0.9, 0.75, 0.5, 0.25, 0.1]);
  });

  it('each point is consistent: vol from the formula, delta back from the strike', () => {
    const g = smileGeometry(Q, F, E.T);
    for (const p of g.points) {
      expect(p.vol).toBeCloseTo(smileVol(p.deltaFwd, Q), 14);
      expect(forwardDelta(p.K, F, E.T, p.vol)).toBeCloseTo(p.deltaFwd, 10);
    }
    // rising delta = falling strike
    expect(g.points[0]!.K).toBeGreaterThan(g.points[96]!.K);
  });

  it('pillars match σ25C = ATM + BF + RR/2 and σ25P = ATM + BF − RR/2', () => {
    const g = smileGeometry(Q, F, E.T);
    expect(g.pillars.call25.vol).toBeCloseTo(Q.atm + Q.bf25 + Q.rr25 / 2, 14);
    expect(g.pillars.put25.vol).toBeCloseTo(Q.atm + Q.bf25 - Q.rr25 / 2, 14);
    expect(g.pillars.atm.vol).toBeCloseTo(Q.atm, 14);
    expect(g.wingAverage - Q.atm).toBeCloseTo(Q.bf25, 14);
    expect(g.pillars.put25.K).toBeLessThan(g.pillars.atm.K);
    expect(g.pillars.atm.K).toBeLessThan(g.pillars.call25.K);
    expect(g.minVol).toBeLessThanOrEqual(g.pillars.call25.vol);
    expect(g.maxVol).toBeGreaterThanOrEqual(g.pillars.put25.vol);
  });

  it('domain covers the curve and at least ATM −2 / +3 vol points', () => {
    const g = smileGeometry(Q, F, E.T);
    const [lo, hi] = volDomain(g, baseVolRange(Q.atm));
    expect(lo).toBeCloseTo(0.06, 12);
    expect(hi).toBeCloseTo(0.11, 12);
    const steep = { atm: 0.04, rr25: -0.03, bf25: 0.015 };
    const gs = smileGeometry(steep, F, E.T);
    const [lo2, hi2] = volDomain(gs, baseVolRange(Q.atm));
    expect(lo2).toBeLessThanOrEqual(gs.minVol);
    expect(hi2).toBeGreaterThanOrEqual(gs.maxVol);
    expect(lo2).toBeGreaterThanOrEqual(0);
  });
});

describe('quotes', () => {
  it('clamps to the slider ranges', () => {
    const q = clampQuotes({ atm: 0.2, rr25: -0.05, bf25: -0.01 });
    expect(q).toEqual({
      atm: SMILE_LIMITS.atm.max,
      rr25: SMILE_LIMITS.rr.min,
      bf25: SMILE_LIMITS.bf.min,
    });
    expect(clampQuotes(Q)).toEqual(Q);
  });

  it('dragging ATM shifts the smile in parallel', () => {
    const q = dragPillar(Q, 'atm', 0.1);
    expect(q.atm).toBeCloseTo(0.1, 12);
    expect(q.rr25).toBeCloseTo(Q.rr25, 12);
    expect(q.bf25).toBeCloseTo(Q.bf25, 12);
  });

  it('dragging a wing keeps ATM and the other wing', () => {
    const q = dragPillar(Q, 'put25', 0.09);
    expect(vol25Put(q)).toBeCloseTo(0.09, 12);
    expect(vol25Call(q)).toBeCloseTo(vol25Call(Q), 12);
    expect(q.atm).toBe(Q.atm);
    const c = dragPillar(Q, 'call25', 0.085);
    expect(vol25Call(c)).toBeCloseTo(0.085, 6);
    expect(vol25Put(c)).toBeCloseTo(vol25Put(Q), 6);
  });

  it('snaps RR to zero when both wings are almost level', () => {
    const start = { atm: 0.08, rr25: -0.01, bf25: 0.01 };
    const q = dragPillar(start, 'put25', vol25Call(start) + 0.0005);
    expect(q.rr25).toBe(0);
    expect(q.bf25).toBeCloseTo(0.005, 12);
    expect(smileShape(q)).toBe('symmetric');
  });

  it('snaps BF to zero when the wings average ATM', () => {
    // put wing 8.75 %: the wings average ATM when the call wing is at 7.25 %
    const q = dragPillar(Q, 'call25', 0.0726);
    expect(q.bf25).toBe(0);
    expect(q.rr25).toBeCloseTo(0.0725 - 0.0875, 12);
    expect(smileShape(q)).toBe('skew');
  });

  it('classifies shapes and wings', () => {
    expect(smileShape(Q)).toBe('smile');
    expect(smileShape({ atm: 0.08, rr25: 0, bf25: 0 })).toBe('flat');
    expect(higherWing(Q)).toBe('left');
    expect(higherWing({ ...Q, rr25: 0.01 })).toBe('right');
    expect(higherWing({ ...Q, rr25: 0 })).toBe('none');
  });

  it('presets and equality', () => {
    const p = smilePresets(Q);
    expect(sameQuotes(p.example, Q)).toBe(true);
    expect(p.symmetric.rr25).toBe(0);
    expect(p.flat).toEqual({ atm: Q.atm, rr25: 0, bf25: 0 });
    expect(sameQuotes(p.flat, p.symmetric)).toBe(false);
  });
});

describe('premium effect', () => {
  it('prices the wing options on the smile and flat', () => {
    const e = premiumEffect(Q, E.spot, E.T, E.rd, E.rf);
    expect(e.put25.volSmile).toBeCloseTo(vol25Put(Q), 14);
    expect(e.call25.volSmile).toBeCloseTo(vol25Call(Q), 14);
    expect(e.put25.flat).toBeCloseTo(gkPrice(E.spot, e.put25.K, E.T, Q.atm, E.rd, E.rf, 'put'), 14);
    // RR < 0: the USD put is dearer on the smile, the USD call cheaper
    expect(e.put25.smile).toBeGreaterThan(e.put25.flat);
    expect(e.call25.smile).toBeLessThan(e.call25.flat);
  });
});

describe('label placement', () => {
  const box = (x0: number, y0: number) => ({ x0, x1: x0 + 60, y0, y1: y0 + 12 });
  it('avoids the curve', () => {
    // a flat curve at y = 100: the box above (y 70–82) beats the box crossing it (y 95–107)
    const curve = Array.from({ length: 21 }, (_, i) => [i * 10, 100] as const);
    expect(pickLabelSpot([box(50, 95), box(50, 70)], curve)).toBe(1);
  });

  it('keeps clear of lines and placed boxes', () => {
    const curve = [[0, 300] as const];
    expect(pickLabelSpot([box(0, 95), box(0, 40)], curve, [100])).toBe(1);
    expect(pickLabelSpot([box(0, 40), box(0, 140)], curve, [], [box(20, 38)])).toBe(1);
    // a placed box elsewhere does not matter; ties keep the first candidate
    expect(pickLabelSpot([box(0, 40), box(0, 140)], curve, [], [box(200, 38)])).toBe(0);
  });
});
