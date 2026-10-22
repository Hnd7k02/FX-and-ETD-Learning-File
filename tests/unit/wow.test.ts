import { describe, expect, it } from 'vitest';
import { EXAMPLE, EXAMPLE_STRIKE } from '@/lib/fx/example';
import { black76 } from '@/lib/fx/vanilla';
import {
  CLOCK_DELAY_MS,
  CLOCK_MS,
  DAYS_MAX,
  DAYS_TARGET,
  MORPH_MS,
  PHASE_MS,
  STRIKE,
  X_DOMAIN,
  clockDays,
  curvePips,
  curvePoints,
  daysLabelKind,
  daysToT,
  forwardPointsRounded,
  frame,
  layoutFor,
  morphPips,
  phaseWeights,
  scalesFor,
  shortPutPips,
  timeValuePips,
  xTicks,
  yTicks,
} from '@/lib/wow';

describe('wow: constants from the brief (§8.1)', () => {
  it('uses the timings of the prototype', () => {
    expect(PHASE_MS).toEqual([5200, 5200, 6400, 5200]);
    expect(MORPH_MS).toBe(900);
    expect(CLOCK_DELAY_MS + CLOCK_MS).toBeLessThan(PHASE_MS[2]!);
  });

  it('takes the strike from the example and runs the clock to T = 0.25', () => {
    expect(STRIKE).toBe(EXAMPLE_STRIKE);
    expect(DAYS_TARGET).toBeCloseTo(91.25, 10);
    expect(daysToT(DAYS_TARGET)).toBeCloseTo(EXAMPLE.T, 12);
    expect(daysToT(DAYS_MAX)).toBe(1);
  });

  it('rounds the forward discount to 70 pips for the caption', () => {
    expect(forwardPointsRounded()).toBe(70);
  });
});

describe('wow: curves', () => {
  it('forward and parity sum are linear through the strike with delta 1', () => {
    expect(curvePips(0, STRIKE, 1)).toBeCloseTo(0, 9);
    expect(curvePips(0, STRIKE + 0.01, 1)).toBeCloseTo(100, 9);
    expect(curvePips(3, STRIKE - 0.02, 0.25)).toBeCloseTo(-200, 9);
  });

  it('call at expiry is the kinked payoff', () => {
    expect(curvePips(1, STRIKE - 0.05, 1)).toBe(0);
    expect(curvePips(1, STRIKE + 0.03, 1)).toBeCloseTo(300, 9);
  });

  it('long call + short put = forward (put-call parity) at every point', () => {
    for (let S = X_DOMAIN[0]; S <= X_DOMAIN[1]; S += 0.005) {
      expect(curvePips(1, S, 1) + shortPutPips(S)).toBeCloseTo(curvePips(0, S, 1), 9);
    }
  });

  it('value before expiry lies above the payoff and converges to it at T = 0', () => {
    for (const S of [0.75, STRIKE, 0.83]) {
      expect(curvePips(2, S, 1)).toBeGreaterThanOrEqual(curvePips(1, S, 1));
      expect(curvePips(2, S, 0)).toBeCloseTo(curvePips(1, S, 0), 9);
    }
  });

  it('time value at the strike is 126.5 pips at 3 months and 253.0 at 1 year (reference)', () => {
    expect(Math.abs(timeValuePips(0.25) - 126.5)).toBeLessThan(0.1);
    expect(Math.abs(timeValuePips(1) - 253.0)).toBeLessThan(0.1);
    expect(timeValuePips(0.25)).toBeCloseTo(
      black76(STRIKE, STRIKE, 0.25, EXAMPLE.vol, 'call') * 1e4,
      9,
    );
    expect(timeValuePips(0)).toBe(0);
  });

  it('morphs pointwise between two phases', () => {
    const S = STRIKE + 0.02;
    const half = morphPips(0, 1, 0.5, 1)(S);
    expect(half).toBeCloseTo((curvePips(0, S, 1) + curvePips(1, S, 1)) / 2, 9);
    expect(morphPips(0, 1, 0, 1)(S)).toBeCloseTo(curvePips(0, S, 1), 9);
    expect(morphPips(0, 1, 1, 1)(S)).toBeCloseTo(curvePips(1, S, 1), 9);
  });

  it('fades comparison layers in and out with the phase', () => {
    expect(phaseWeights(0, 1, 1)).toEqual({ ghost: 0.45, timeValue: 0, parity: 0 });
    expect(phaseWeights(1, 2, 0.5)).toEqual({ ghost: 0.225, timeValue: 0.5, parity: 0 });
    expect(phaseWeights(2, 3, 1)).toEqual({ ghost: 0, timeValue: 0, parity: 1 });
    expect(phaseWeights(3, 0, 1)).toEqual({ ghost: 0, timeValue: 0, parity: 0 });
  });
});

describe('wow: clock and labels', () => {
  it('runs 365 days → 91.25 days after the morph, monotonically', () => {
    expect(clockDays(0)).toBe(DAYS_MAX);
    expect(clockDays(CLOCK_DELAY_MS)).toBe(DAYS_MAX);
    let prev = DAYS_MAX;
    for (let t = CLOCK_DELAY_MS; t <= CLOCK_DELAY_MS + CLOCK_MS; t += 100) {
      const d = clockDays(t);
      expect(d).toBeLessThanOrEqual(prev);
      prev = d;
    }
    expect(clockDays(CLOCK_DELAY_MS + CLOCK_MS)).toBeCloseTo(DAYS_TARGET, 9);
    expect(clockDays(10_000)).toBeCloseTo(DAYS_TARGET, 9);
  });

  it('labels expiry, one year, three months and plain days', () => {
    expect(daysLabelKind(0)).toBe('expiry');
    expect(daysLabelKind(365)).toBe('year');
    expect(daysLabelKind(DAYS_TARGET)).toBe('months3');
    expect(daysLabelKind(91)).toBe('months3');
    expect(daysLabelKind(90)).toBe('days');
    expect(daysLabelKind(200)).toBe('days');
  });
});

describe('wow: layout and frame', () => {
  it('reproduces the prototype geometry at 1000 px (strike at x = 520, zero at y = 198)', () => {
    const l = layoutFor(1000);
    expect(l).toMatchObject({ width: 1000, height: 410, left: 64, top: 24, compact: false });
    const sc = scalesFor(l);
    expect(sc.x(STRIKE)).toBeCloseTo(520, 6);
    expect(sc.y(0)).toBeCloseTo(198, 6);
    expect(sc.y(800)).toBeCloseTo(24, 6);
    expect(sc.y(-800)).toBeCloseTo(372, 6);
    // the prototype rounds its hard-coded tick positions (103.9 → 104)
    expect(sc.x(0.72)).toBeCloseTo(104, 0);
  });

  it('switches to a compact layout with readable labels under 640 px', () => {
    const l = layoutFor(318);
    expect(l.compact).toBe(true);
    expect(l.font).toBeGreaterThanOrEqual(11);
    expect(l.height).toBe(260);
    expect(layoutFor(639).height).toBe(262);
    expect(layoutFor(640).height).toBe(262);
    expect(xTicks(l)).toEqual([0.72, 0.76, 0.8, 0.84]);
    expect(layoutFor(100).width).toBe(280);
  });

  it('has the prototype ticks', () => {
    expect(xTicks(layoutFor(1000))).toEqual([0.72, 0.74, 0.76, 0.78, 0.8, 0.82, 0.84, 0.86]);
    expect(yTicks()).toEqual([800, 400, 0, -400, -800]);
  });

  it('clamps curves to the y domain', () => {
    const sc = scalesFor(layoutFor(1000));
    const pts = curvePoints((S) => (S - STRIKE) * 1e6, sc);
    for (const [, y] of pts) {
      expect(y).toBeGreaterThanOrEqual(24 - 1e-9);
      expect(y).toBeLessThanOrEqual(372 + 1e-9);
    }
    expect(pts).toHaveLength(121);
  });

  it('builds all paths of a frame', () => {
    const sc = scalesFor(layoutFor(1000));
    const f = frame(1, 2, 1, 0.25, sc);
    expect(f.main.startsWith('M')).toBe(true);
    expect(f.area.endsWith('Z')).toBe(true);
    expect(f.mainBlue).toBe(true);
    expect(f.strikeX).toBeCloseTo(520, 6);
    expect(f.zeroY).toBeCloseTo(198, 6);
    expect(Math.round(f.tvPips)).toBe(127);
    expect(f.tvY).toBeLessThan(f.zeroY);
    expect(f.weights.timeValue).toBe(1);
    expect(frame(3, 0, 1, 1, sc).mainBlue).toBe(false);
    expect(frame(2, 3, 1, 1, sc).longCall).toBe(f.pay);
  });
});
