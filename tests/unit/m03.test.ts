import { describe, expect, it } from 'vitest';
import { EXAMPLE as E } from '@/lib/fx/example';
import { forwardMoneyMarket } from '@/lib/fx/forward';
import { M03_CONFIG, PIP, tenorById } from '@/lib/m03/config';
import { compareSwaps, couponPeriods } from '@/lib/m03/compare';
import { snapRate, swapLegs } from '@/lib/m03/legs';
import {
  allInRange,
  crossedOldForward,
  rollCurves,
  rollView,
  snapSpot,
  tourAt,
} from '@/lib/m03/roll';
import { fitCentre, textWidth } from '@/lib/m03/text';
import {
  EXAMPLE_MARKET as M,
  pathAt,
  roundTripChf,
  spotPath,
  swapLineAt,
  tripSwap,
} from '@/lib/m03/trip';

const N = E.notional;

describe('M03_CONFIG', () => {
  it('uses the running example', () => {
    expect(M03_CONFIG.market.spot).toBe(E.spot);
    expect(M03_CONFIG.market.rd).toBe(E.rd);
    expect(M03_CONFIG.market.rf).toBe(E.rf);
    expect(M03_CONFIG.market.days).toBe(E.mmDays);
    expect(M03_CONFIG.market.basisQuote).toBe(360);
    expect(M03_CONFIG.market.basisBase).toBe(360);
  });

  it('the maturing forward is the money-market forward of module 02 (0.79306)', () => {
    expect(M03_CONFIG.roll.oldForward).toBe(forwardMoneyMarket(E.spot, E.rd, E.rf, 90));
    expect(M03_CONFIG.roll.oldForward).toBeCloseTo(0.79306, 5);
  });

  it('looks up tenors and rejects unknown ids', () => {
    expect(tenorById(M03_CONFIG.legs.tenors, '3M').days).toBe(90);
    expect(tenorById(M03_CONFIG.roll.slips, M03_CONFIG.roll.defaultSlip).days).toBe(30);
    expect(() => tenorById(M03_CONFIG.legs.tenors, '7Y')).toThrow(/7Y/);
  });
});

describe('trip (section 1): buy USD for one month', () => {
  const trip = tripSwap(M, 30);

  it('near: pay CHF 800’000 for USD 1 Mio.; far: receive N · F', () => {
    expect(trip.nearChf).toBeCloseTo(800_000, 6);
    const F = forwardMoneyMarket(E.spot, E.rd, E.rf, 30);
    expect(trip.swap.farRate).toBeCloseTo(F, 14);
    expect(trip.farChf).toBeCloseTo(N * F, 6);
    expect(trip.swap.near.base).toBe(N);
    expect(trip.swap.far.base).toBe(-N);
  });

  it('the price is the USD interest, converted at the far rate (CHF 2’327)', () => {
    expect(trip.costChf).toBeCloseTo(trip.nearChf - trip.farChf, 8);
    expect(trip.costChf).toBeCloseTo(2326.55, 2);
    expect(trip.usdInterest).toBeCloseTo((N * E.rf * 30) / 360, 8);
    expect(trip.costChf).toBeCloseTo(trip.usdInterest * trip.swap.farRate, 6);
    expect(trip.chfInterest).toBe(0);
  });

  it('swap points over one month ≈ −23.3 pips', () => {
    expect(trip.swap.swapPoints).toBeCloseTo(-23.27, 2);
  });

  it('the open round trip depends on the spot in a month', () => {
    expect(roundTripChf(M, 0.82)).toBeCloseTo(20_000, 6);
    expect(roundTripChf(M, 0.78)).toBeCloseTo(-20_000, 6);
    expect(roundTripChf(M, E.spot)).toBe(0);
  });

  it('spot paths are reproducible, start at spot and have days + 1 points', () => {
    const a = spotPath(M, 0.08, 30, 7);
    const b = spotPath(M, 0.08, 30, 7);
    const c = spotPath(M, 0.08, 30, 8);
    expect(a).toEqual(b);
    expect(a).not.toEqual(c);
    expect(a).toHaveLength(31);
    expect(a[0]).toBe(E.spot);
    for (const s of a) expect(s).toBeGreaterThan(0);
    // zero vol: deterministic drift at rd − rf
    const flat = spotPath(M, 0, 30, 1);
    expect(flat[30]).toBeCloseTo(E.spot * Math.exp(((E.rd - E.rf) * 30) / 365), 12);
  });

  it('interpolates paths and the swap line', () => {
    const p = [1, 2, 4];
    expect(pathAt(p, -1)).toBe(1);
    expect(pathAt(p, 0.5)).toBe(1.5);
    expect(pathAt(p, 1.25)).toBe(2.5);
    expect(pathAt(p, 9)).toBe(4);
    expect(pathAt([], 0)).toBeNaN();
    expect(swapLineAt(0.8, 0.79, 30, 15)).toBeCloseTo(0.795, 12);
    expect(swapLineAt(0.8, 0.79, 30, 60)).toBe(0.79);
    expect(swapLineAt(0.8, 0.79, 0, 5)).toBe(0.8);
  });
});

describe('legs (section 2)', () => {
  const v = swapLegs({ ...M, days: 90, side: 'buySellBase' });

  it('far rate = money-market forward 0.79306; swap points −69.4 = forward points', () => {
    expect(v.rows[0].rate).toBe(E.spot);
    expect(v.rows[1].rate).toBeCloseTo(0.79306, 5);
    expect(v.points).toBeCloseTo(-69.4, 1);
    expect(v.points).toBeCloseTo(v.forwardPoints, 10);
    expect(v.shape).toBe('discount');
  });

  it('approximation S · (rd − rf) · t = −70.0 pips is close but not exact', () => {
    expect(v.approxPoints).toBeCloseTo(-70, 10);
    expect(Math.abs(v.approxPoints - v.points)).toBeGreaterThan(0.5);
    expect(v.diff).toBeCloseTo(-0.035, 12);
  });

  it('net: USD 0, CHF −6’939 = USD interest at the far rate', () => {
    expect(v.net.base).toBe(0);
    expect(v.net.quote).toBeCloseTo(-6939.28, 2);
    expect(v.baseInterest).toBeCloseTo(8750, 8);
    expect(-v.net.quote).toBeCloseTo(v.baseInterest * v.rows[1].rate, 6);
    expect(v.quoteInterest).toBe(0);
  });

  it('sell/buy mirrors all amounts', () => {
    const s = swapLegs({ ...M, days: 90, side: 'sellBuyBase' });
    expect(s.rows[0].base).toBe(-N);
    expect(s.rows[1].base).toBe(N);
    expect(s.net.quote).toBeCloseTo(-v.net.quote, 8);
    expect(s.points).toBe(v.points);
  });

  it('equal rates: no swap points; higher CHF rate: premium', () => {
    expect(swapLegs({ ...M, rd: 0.02, rf: 0.02, days: 90, side: 'buySellBase' }).shape).toBe(
      'flat',
    );
    const p = swapLegs({ ...M, rd: 0.05, rf: 0.01, days: 182, side: 'buySellBase' });
    expect(p.shape).toBe('premium');
    expect(p.points).toBeGreaterThan(0);
    expect(p.quoteInterest).toBeCloseTo((N * E.spot * 0.05 * 182) / 360, 8);
  });

  it('snaps rate slider values to the grid and the range', () => {
    expect(snapRate(0.0351)).toBe(0.035);
    expect(snapRate(0.1)).toBe(0.06);
    expect(snapRate(-0.01)).toBe(0);
  });
});

describe('roll (section 3)', () => {
  const base = {
    oldForward: M03_CONFIG.roll.oldForward,
    notional: N,
    rd: E.rd,
    rf: E.rf,
    extraDays: 30,
  };

  it('dollar stronger (0.8100): importer receives CHF, all-in = old forward + swap points', () => {
    const v = rollView({ ...base, spotAtRoll: 0.81 });
    expect(v.settlementSide).toBe('receive');
    expect(v.settlement).toBeCloseTo((0.81 - base.oldForward) * N, 6);
    expect(v.settlement).toBeCloseTo(16_939, 0);
    expect(v.points).toBeCloseTo(-23.56, 2);
    expect(v.allIn).toBeCloseTo(base.oldForward + v.points * PIP, 12);
    expect(v.allIn).toBeCloseTo(v.farRate - v.settlement / N, 12);
    expect(v.totalChf).toBeCloseTo(v.farChf - v.settlement, 6);
    expect(v.allInVsOldPips).toBeCloseTo(v.points, 10);
  });

  it('dollar weaker (0.7800): importer pays CHF at the roll date', () => {
    const v = rollView({ ...base, spotAtRoll: 0.78 });
    expect(v.settlementSide).toBe('pay');
    expect(v.settlement).toBeLessThan(0);
    expect(v.settlement).toBeCloseTo(-13_061, 0);
  });

  it('spot at the old forward: no settlement', () => {
    expect(rollView({ ...base, spotAtRoll: base.oldForward }).settlementSide).toBe('zero');
  });

  it('the all-in rate barely moves with the roll-date spot', () => {
    const r = allInRange(base, M03_CONFIG.roll.spotRange);
    expect(r.max).toBeGreaterThan(r.min);
    expect(r.spreadPips).toBeLessThan(5);
    const curves = rollCurves(base, M03_CONFIG.roll.spotRange, 10);
    expect(curves).toHaveLength(11);
    expect(curves[0]!.s).toBe(M03_CONFIG.roll.spotRange[0]);
    expect(curves[10]!.far).toBeGreaterThan(curves[0]!.far);
    for (const c of curves) expect(c.allIn).toBeCloseTo(c.far - (c.s - base.oldForward), 12);
  });

  it('tour, snapping and crossing helpers', () => {
    const w = [0.81, 0.75, 0.85];
    expect(tourAt(w, 0)).toBe(0.81);
    expect(tourAt(w, 0.5)).toBe(0.75);
    expect(tourAt(w, 1)).toBe(0.85);
    expect(tourAt(w, 0.25)).toBeCloseTo(0.78, 12);
    expect(tourAt([0.8], 0.4)).toBe(0.8);
    expect(tourAt([], 0.4)).toBeNaN();
    expect(snapSpot(0.81037)).toBe(0.8105);
    expect(snapSpot(0.5)).toBe(M03_CONFIG.roll.spotRange[0]);
    expect(crossedOldForward(0.8, 0.79, 0.793)).toBe(true);
    expect(crossedOldForward(0.8, 0.81, 0.793)).toBe(false);
    expect(crossedOldForward(0.8, 0.8, 0.793)).toBe(false);
  });
});

describe('compare (section 4): FX swap vs cross-currency swap', () => {
  it('splits tenors into coupon periods', () => {
    expect(couponPeriods(90, 365)).toEqual([90]);
    expect(couponPeriods(730, 365)).toEqual([365, 365]);
    expect(couponPeriods(800, 365)).toEqual([365, 365, 70]);
    expect(couponPeriods(0, 365)).toEqual([]);
  });

  it('3 months: the FX swap equals the example swap (−69.4 pips)', () => {
    const c = compareSwaps(M, 90);
    expect(c.fxSwap.endRate).toBeCloseTo(forwardMoneyMarket(E.spot, E.rd, E.rf, 90), 14);
    expect(c.swapPoints).toBeCloseTo(-69.4, 1);
    expect(c.fxSwapUnusual).toBe(false);
    expect(c.ccs.endRate).toBe(E.spot);
  });

  it('1 year: USD coupon × forward = FX swap shortfall (CHF 27’416)', () => {
    const c = compareSwaps(M, 365);
    expect(c.ccsCouponBase).toBeCloseTo((N * E.rf * 365) / 360, 8);
    expect(c.ccsCouponQuote).toBe(0);
    expect(c.fxCostChf).toBeCloseTo(27_416, 0);
    expect(c.ccsCouponBase * c.fxSwap.endRate).toBeCloseTo(c.fxCostChf, 6);
  });

  it('present values agree for every tenor and for non-zero CHF rates', () => {
    for (const t of M03_CONFIG.compare.tenors) {
      const c = compareSwaps(M, t.days);
      expect(c.pvCcsChf).toBeCloseTo(c.pvFxChf, 6);
      expect(c.pvFxChf).toBeCloseTo(N * E.spot * (c.dfQuote - c.dfBase), 6);
    }
    const m2 = { ...M, rd: 0.015, rf: 0.04 };
    const c = compareSwaps(m2, 1825);
    expect(c.pvCcsChf).toBeCloseTo(c.pvFxChf, 6);
    expect(c.ccsCouponQuote).toBeGreaterThan(0);
    expect(c.fxSwapUnusual).toBe(true);
  });

  it('flows: notional both ways in both instruments, coupons only in the CCS', () => {
    const c = compareSwaps(M, 1825);
    expect(c.periods).toHaveLength(5);
    expect(c.fxSwap.flows).toHaveLength(4);
    expect(c.ccs.flows.filter((f) => f.kind === 'coupon')).toHaveLength(10);
    const sum = (fs: typeof c.ccs.flows, ccy: 'base' | 'quote', kind: 'notional' | 'coupon') =>
      fs.filter((f) => f.ccy === ccy && f.kind === kind).reduce((a, f) => a + f.amount, 0);
    expect(sum(c.ccs.flows, 'base', 'notional')).toBe(0);
    expect(sum(c.ccs.flows, 'quote', 'notional')).toBeCloseTo(0, 8);
    expect(sum(c.fxSwap.flows, 'base', 'notional')).toBe(0);
    expect(sum(c.fxSwap.flows, 'quote', 'notional')).toBeCloseTo(-c.fxCostChf, 6);
  });
});

describe('text helpers', () => {
  it('estimates widths and keeps labels inside', () => {
    expect(textWidth('abcd', 10)).toBeCloseTo(22.4, 10);
    expect(fitCentre(5, 20, 0, 100)).toBe(10);
    expect(fitCentre(98, 20, 0, 100)).toBe(90);
    expect(fitCentre(50, 20, 0, 100)).toBe(50);
    expect(fitCentre(50, 200, 0, 100)).toBe(50);
  });
});
