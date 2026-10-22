import { describe, expect, it } from 'vitest';
import { getNum } from '@/lib/nums';
import { greeks } from '@/lib/fx/greeks';
import { EXAMPLE_STRIKE } from '@/lib/fx/example';
import {
  CHART_MIN,
  LAB_CONFIG,
  LAB_MODES,
  PANEL_X,
  aha,
  daysFromWeeks,
  gammaPeakSpot,
  labLayout,
  labNumbers,
  moneyness,
  niceDomain,
  panels,
  pctDigits,
  placeCallout,
  paramFromX,
  sameParams,
  sharedX,
  snap,
  vegaPeakSpot,
  weeksLabel,
  xTicks,
  xValue,
  yTicks,
  yearsFromWeeks,
  type LabParams,
} from '@/lib/greekslab';

const D: LabParams = { ...LAB_CONFIG.defaults };
const K = EXAMPLE_STRIKE;

describe('greeks lab: sliders and conversions', () => {
  it('starts at the running example (13 weeks = T 0.25)', () => {
    expect(D).toEqual({ spot: 0.8, weeks: 13, volPct: 8, rdPct: 0, rfPct: 3.5 });
    expect(yearsFromWeeks(13)).toBe(0.25);
    expect(daysFromWeeks(52)).toBe(365);
  });

  it('snaps to the slider step and clamps to the range', () => {
    const R = LAB_CONFIG.ranges;
    expect(snap(0.80037, R.spot)).toBe(0.8005);
    expect(snap(0.70, R.spot)).toBe(0.76);
    expect(snap(9, R.spot)).toBe(0.84);
    expect(snap(7.74, R.volPct)).toBe(7.5);
    expect(snap(-3, R.rdPct)).toBe(-1);
    expect(snap(3.6, R.rfPct)).toBe(3.5);
  });

  it('maps a point on each chart axis back to a slider', () => {
    expect(paramFromX('spot', 0.8123)).toEqual({ spot: 0.8125 });
    expect(paramFromX('volPct', 12.2)).toEqual({ volPct: 12 });
    expect(paramFromX('days', 91.25)).toEqual({ weeks: 13 });
    expect(paramFromX('days', 0)).toEqual({ weeks: 1 });
    expect(paramFromX('rdPct', 1.1)).toEqual({ rdPct: 1 });
    expect(paramFromX('rfPct', 5.9)).toEqual({ rfPct: 6 });
    expect(xValue('days', D)).toBeCloseTo(91.25, 10);
    expect(xValue('spot', D)).toBe(0.8);
    expect(xValue('rfPct', D)).toBe(3.5);
  });

  it('compares parameter sets', () => {
    expect(sameParams(D, { ...D })).toBe(true);
    expect(sameParams(D, { ...D, weeks: 14 })).toBe(false);
  });

  it('labels the maturity slider', () => {
    expect(weeksLabel(1)).toBe('one');
    expect(weeksLabel(13)).toBe('threeMonths');
    expect(weeksLabel(52)).toBe('year');
    expect(weeksLabel(20)).toBe('n');
  });
});

describe('greeks lab: numbers on USD 1 Mio.', () => {
  const n = labNumbers(D);

  it('matches the reference values of the running example', () => {
    expect(n.pricePips).toBeCloseTo(getNum('ex.callPips').value, 8);
    expect(n.priceChf).toBeCloseTo(getNum('ex.callChf').value, 6);
    expect(n.delta).toBeCloseTo(0.5039, 4);
    expect(n.gamma).toBeCloseTo(12.3556, 3);
    expect(n.gammaBigFigure).toBeCloseTo(0.1236, 4);
    expect(n.vegaChf).toBeCloseTo(1582, 0);
    expect(n.thetaDayChf).toBeCloseTo(-30.82, 2);
    expect(n.thetaAnalyticChf).toBeCloseTo(-30.67, 2);
    expect(n.rhoDChf).toBeCloseTo(976, 0);
    expect(n.rhoFChf).toBeCloseTo(-1008, 0);
    expect(n.vegaPips * 100).toBeCloseTo(n.vegaChf, 8);
    expect(n.rhoDPips * 100).toBeCloseTo(n.rhoDChf, 8);
    expect(n.rhoFPips * 100).toBeCloseTo(n.rhoFChf, 8);
    expect(n.thetaPips * 100).toBeCloseTo(n.thetaAnalyticChf, 8);
  });

  it('numeric check agrees with the formulas', () => {
    expect(n.check.gamma).toBeCloseTo(n.gamma, 3);
    expect(n.check.vegaChf).toBeCloseTo(n.vegaChf, 4);
    expect(n.check.thetaChf).toBeCloseTo(n.thetaAnalyticChf, 4);
    expect(n.check.rhoDChf).toBeCloseTo(n.rhoDChf, 4);
    expect(n.check.rhoFChf).toBeCloseTo(n.rhoFChf, 4);
  });

  it('classifies moneyness against the forward', () => {
    expect(moneyness(n.forward)).toEqual({ kind: 'ATMF', pips: 0 });
    expect(moneyness(K + 0.0001)).toEqual({ kind: 'ATMF', pips: 0 });
    expect(moneyness(K + 0.00012)).toEqual({ kind: 'ITM', pips: 1 });
    expect(moneyness(K + 0.0123)).toEqual({ kind: 'ITM', pips: 123 });
    expect(moneyness(K - 0.005)).toEqual({ kind: 'OTM', pips: 50 });
    const up = labNumbers({ ...D, spot: 0.81 });
    expect(moneyness(up.forward).kind).toBe('ITM');
  });

  it('finds the spot of maximal gamma and vega', () => {
    const at = (S: number) => greeks(S, K, 0.25, 0.08, 0, 0.035, 'call');
    const sG = gammaPeakSpot(D);
    const sV = vegaPeakSpot(D);
    for (const h of [-0.002, 0.002]) {
      expect(at(sG).gamma).toBeGreaterThan(at(sG + h).gamma);
      expect(at(sV).vega).toBeGreaterThan(at(sV + h).vega);
    }
    // vega peaks a few pips above ATMF, gamma a few pips below
    expect(sV).toBeGreaterThan(0.8);
    expect(sG).toBeLessThan(0.8);
  });
});

describe('greeks lab: panels', () => {
  const near = (pts: [number, number][], x: number) =>
    pts.reduce((b, p) => (Math.abs(p[0] - x) < Math.abs(b[0] - x) ? p : b));

  it.each(LAB_MODES)('%s: tangent touches the curve at the dot with the right slope', (mode) => {
    const [top, bottom] = panels(mode, D);
    expect(top.x).toBe(PANEL_X[mode][0]);
    expect(bottom.x).toBe(PANEL_X[mode][1]);
    for (const pnl of [top, bottom]) {
      expect(pnl.points).toHaveLength(LAB_CONFIG.samples + 1);
      if (pnl.slope === null) {
        expect(pnl.tangent).toBeNull();
        continue;
      }
      const [x0, y0, x1, y1] = pnl.tangent!;
      expect((y1 - y0) / (x1 - x0)).toBeCloseTo(pnl.slope, 6);
      // the line goes through the current point
      expect(y0 + pnl.slope * (pnl.at[0] - x0)).toBeCloseTo(pnl.at[1], 6);
      // and the curve has that slope there (central difference on the sampled curve)
      const dx = (pnl.xDomain[1] - pnl.xDomain[0]) / LAB_CONFIG.samples;
      const a = near(pnl.points, pnl.at[0] - dx);
      const b = near(pnl.points, pnl.at[0] + dx);
      const rel = Math.abs((b[1] - a[1]) / (b[0] - a[0]) - pnl.slope) / Math.abs(pnl.slope);
      expect(rel).toBeLessThan(0.05);
      // clipped to the plot
      const [lo, hi] = [Math.min(...pnl.yDomain), Math.max(...pnl.yDomain)];
      expect(Math.min(y0, y1)).toBeGreaterThanOrEqual(lo - 1e-9);
      expect(Math.max(y0, y1)).toBeLessThanOrEqual(hi + 1e-9);
    }
  });

  it('delta-gamma: price curve over the payoff, delta between 0 and 1, strike line', () => {
    const [top, bottom] = panels('delta-gamma', D);
    expect(top.yDomain).toEqual([0, 800]);
    expect(bottom.yDomain).toEqual([0, 1]);
    top.points.forEach(([, v], i) => expect(v).toBeGreaterThanOrEqual(top.payoff![i]![1] - 80));
    expect(top.refs).toEqual([{ x: K, kind: 'strike' }]);
    expect(bottom.points.every(([, d]) => d >= 0 && d <= 1)).toBe(true);
    expect(sharedX('delta-gamma')).toBe(true);
  });

  it('delta-gamma: tangent is clipped at the top of the plot deep in the money', () => {
    const [top] = panels('delta-gamma', { ...D, spot: 0.84, weeks: 52, volPct: 16 });
    expect(Math.max(top.tangent![1], top.tangent![3])).toBeLessThanOrEqual(800);
  });

  it('vega: price rises with vol, vega peak marked, example as ghost only when changed', () => {
    const [top, bottom] = panels('vega', D);
    for (let i = 1; i < top.points.length; i++)
      expect(top.points[i]![1]).toBeGreaterThanOrEqual(top.points[i - 1]![1] - 1e-9);
    expect(bottom.ghost).toBeNull();
    expect(bottom.peak![0]).toBeCloseTo(vegaPeakSpot(D), 12);
    const longer = panels('vega', { ...D, weeks: 52 })[1];
    expect(longer.ghost).not.toBeNull();
    // vega grows with √T: 52 weeks vs 13 weeks ≈ 2×
    expect(longer.peak![1] / bottom.peak![1]).toBeGreaterThan(1.85);
    expect(longer.peak![1] / bottom.peak![1]).toBeLessThan(2.05);
    expect(sharedX('vega')).toBe(false);
  });

  it('vega: no peak marker when the peak lies outside the spot axis', () => {
    // a very high USD rate moves the peak spot far up
    const far = panels('vega', { ...D, weeks: 52, rdPct: -1, rfPct: 6, volPct: 16 })[1];
    expect(vegaPeakSpot({ ...D, weeks: 52, rdPct: -1, rfPct: 6, volPct: 16 })).toBeGreaterThan(
      0.86,
    );
    expect(far.peak).toBeNull();
  });

  it('theta: price at expiry equals the payoff; one-day theta axis contains zero', () => {
    const [top, bottom] = panels('theta', D);
    const last = top.points[top.points.length - 1]!;
    expect(last[0]).toBe(0);
    expect(last[1]).toBeCloseTo((0.8 - K) / 1e-4, 8);
    expect(top.payoff![0]![1]).toBeCloseTo(last[1], 8);
    expect(bottom.yDomain[0]).toBeLessThan(0);
    expect(bottom.yDomain[1]).toBeGreaterThanOrEqual(0);
    expect(bottom.at[1]).toBeCloseTo(-30.82, 2);
    // acceleration: theta one week before expiry is several times theta at 3 months
    const firstWeek = bottom.points[bottom.points.length - 1]!;
    expect(firstWeek[1] / bottom.at[1]).toBeGreaterThan(3);
    // deep in the money the carry wins: theta turns positive
    const itm = panels('theta', { ...D, spot: 0.84 })[1];
    expect(itm.at[1]).toBeGreaterThan(0);
    expect(itm.yDomain[1]).toBeGreaterThan(0);
  });

  it('rho: CHF rate up lifts the price, USD rate up lowers it; shared y domain', () => {
    const [top, bottom] = panels('rho', D);
    expect(top.slope!).toBeGreaterThan(0);
    expect(bottom.slope!).toBeLessThan(0);
    expect(top.yDomain).toEqual(bottom.yDomain);
    expect(top.refs).toEqual([{ x: 3.5, kind: 'equalRates' }]);
    expect(bottom.refs).toEqual([{ x: 0, kind: 'equalRates' }]);
    // short maturity: rho is tiny and the axis keeps at least 100 pips
    const short = panels('rho', { ...D, weeks: 1 })[0];
    expect(short.yDomain[1] - short.yDomain[0]).toBeGreaterThanOrEqual(LAB_CONFIG.rhoMinSpan);
    // a CHF rate outside the USD axis has no reference line there
    const neg = panels('rho', { ...D, rdPct: -1 })[1];
    expect(neg.refs).toEqual([]);
  });
});

describe('greeks lab: annotations', () => {
  it('points at the gamma and vega peak in the example', () => {
    expect(aha('delta-gamma', D)).toEqual({ key: 'gammaPeak', panel: 'bottom' });
    expect(aha('vega', D)).toEqual({ key: 'vegaPeak', panel: 'bottom' });
  });

  it('delta near 1 or 0 at the ends of the spot axis', () => {
    expect(aha('delta-gamma', { ...D, spot: 0.84 })?.key).toBe('deltaHigh');
    expect(aha('delta-gamma', { ...D, spot: 0.76 })?.key).toBe('deltaLow');
    expect(aha('delta-gamma', { ...D, spot: 0.815 })).toBeNull();
    expect(aha('vega', { ...D, spot: 0.82 })).toBeNull();
  });

  it('theta: acceleration close to expiry, positive theta deep in the money', () => {
    expect(aha('theta', D)).toBeNull();
    expect(aha('theta', { ...D, weeks: 2 })?.key).toBe('thetaAccel');
    expect(aha('theta', { ...D, spot: 0.84 })?.key).toBe('thetaPositive');
    expect(aha('theta', { ...D, weeks: 2, spot: 0.77 })).toBeNull();
  });

  it('rho: equal rates mean forward = spot', () => {
    expect(aha('rho', D)).toBeNull();
    expect(aha('rho', { ...D, rdPct: 3.5 })).toEqual({ key: 'equalRates', panel: 'top' });
  });
});

describe('greeks lab: layout and ticks', () => {
  it('uses a 1:1 viewBox with phone minimum heights', () => {
    const wide = labLayout(640);
    expect(wide.compact).toBe(false);
    expect(wide.top.height).toBe(250);
    expect(wide.bottom.height).toBe(200);
    const phone = labLayout(326);
    expect(phone.compact).toBe(true);
    expect(phone.top.height).toBe(CHART_MIN.top);
    expect(phone.bottom.height).toBe(CHART_MIN.bottom);
    expect(phone.font).toBeGreaterThanOrEqual(11);
    expect(labLayout(10).width).toBe(260);
  });

  it('has ticks for every axis, fewer on phones', () => {
    for (const x of ['spot', 'volPct', 'days', 'rdPct', 'rfPct'] as const) {
      expect(xTicks(x, true).length).toBeLessThan(xTicks(x, false).length);
    }
    expect(xTicks('days', false)).toEqual([365, 273.75, 182.5, 91.25, 0]);
  });

  it('builds y ticks from a step inside a (tweened) domain', () => {
    expect(yTicks([0, 800], 200)).toEqual([0, 200, 400, 600, 800]);
    expect(yTicks([-130, 10], 50)).toEqual([-100, -50, 0]);
    expect(yTicks([0, 1], 0)).toEqual([]);
  });

  it('finds nice domains', () => {
    expect(niceDomain(-135, -4, { withZero: true })).toEqual({ domain: [-150, 0], step: 50 });
    expect(niceDomain(65, 73, { minSpan: 100 }).domain[1] - niceDomain(65, 73, { minSpan: 100 }).domain[0]).toBeGreaterThanOrEqual(100);
    expect(niceDomain(5, 5).domain[1]).toBeGreaterThan(5);
    expect(niceDomain(10, 20, { withZero: true, minSpan: 40 }).domain).toEqual([0, 40]);
  });
});

describe('greeks lab: callout placement and percent digits', () => {
  const plot = { x0: 0, x1: 400, y0: 0, y1: 200 };
  it('prefers right-below and avoids the curve', () => {
    expect(placeCallout([100, 50], { w: 120, h: 40 }, plot, [])).toEqual({
      x: 112,
      y: 62,
      w: 120,
      h: 40,
    });
    // a curve running right-below pushes the box to the right-above
    const curve: [number, number][] = Array.from({ length: 50 }, (_, i) => [100 + i * 4, 50 + i * 2]);
    const b = placeCallout([100, 50], { w: 120, h: 30 }, plot, curve);
    expect(b.y + b.h).toBeLessThanOrEqual(50);
  });
  it('stays inside the plot near the edges', () => {
    const b = placeCallout([395, 195], { w: 120, h: 40 }, plot, []);
    expect(b.x + b.w).toBeLessThanOrEqual(400);
    expect(b.y + b.h).toBeLessThanOrEqual(200);
    const tight = placeCallout([10, 10], { w: 500, h: 300 }, plot, []);
    expect(tight.x).toBe(0);
    expect(tight.y).toBe(0);
  });
  it('picks decimals for percent values', () => {
    expect(pctDigits(0)).toBe(0);
    expect(pctDigits(3.5)).toBe(1);
    expect(pctDigits(3.25)).toBe(2);
  });
});
