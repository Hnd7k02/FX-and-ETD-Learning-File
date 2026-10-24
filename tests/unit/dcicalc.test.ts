import { describe, expect, it } from 'vitest';
import {
  DCI_CONFIG,
  dciCurve,
  dciOutcome,
  dciRange,
  dciValueAt,
  dciView,
  defaultFixing,
  snapFixing,
  tenorDays,
} from '@/lib/dcicalc';
import { MC_PRODUCTS } from '@/lib/fx/mc/fair';
import { DEFAULT_MARKET } from '@/lib/fx/mc/products';
import { normCdf } from '@/lib/fx/normal';
import { d1d2 } from '@/lib/fx/vanilla';

describe('DCI calculator', () => {
  it('maps tenors to calendar days like the monthly fixings', () => {
    expect(DCI_CONFIG.months.map(tenorDays)).toEqual([30, 61, 91]);
  });

  it('reproduces the §8.7 default stored in mc-products.json', () => {
    const v = dciView(DCI_CONFIG.capital.initial, 1, DCI_CONFIG.distance.initial);
    const ref = MC_PRODUCTS.dualCurrency;
    expect(v.days).toBe(ref.days);
    expect(v.product.strike).toBeCloseTo(ref.strike, 10);
    expect(v.quote.premium).toBeCloseTo(ref.premium, 2);
    expect(v.quote.yieldPa).toBeCloseTo(ref.yieldPa, 6);
    expect(v.quote.breakEven).toBeCloseTo(ref.breakEven, 6);
    expect(v.quote.pv).toBeCloseTo(v.capital, 6);
  });

  it('pays more for a strike closer to spot and for a longer tenor in CHF', () => {
    const near = dciView(100_000, 1, 0.005);
    const far = dciView(100_000, 1, 0.02);
    expect(near.quote.yieldPa).toBeGreaterThan(far.quote.yieldPa);
    expect(near.pConversion).toBeGreaterThan(far.pConversion);
    const long = dciView(100_000, 3, 0.01);
    expect(long.quote.interest).toBeGreaterThan(dciView(100_000, 1, 0.01).quote.interest);
  });

  it('compares the strike with spot and forward and gives the conversion probability', () => {
    const v = dciView(100_000, 1, 0.01);
    expect(v.strikeVsSpotPips).toBeCloseTo(-80, 6);
    expect(v.forward).toBeLessThan(DEFAULT_MARKET.spot);
    expect(v.strikeVsForwardPips).toBeCloseTo((v.product.strike - v.forward) / 1e-4, 6);
    const { spot, vol, rd, rf } = DEFAULT_MARKET;
    const { d2 } = d1d2(spot, v.product.strike, v.quote.T, vol, rd, rf);
    expect(v.pConversion).toBeCloseTo(normCdf(-d2), 12);
    expect(v.extraInterest).toBeCloseTo(v.quote.interest - v.depositInterest, 9);
    expect(v.depositValue).toBeCloseTo(v.capital + v.depositInterest, 9);
  });

  it('converts the capital at the strike below K and breaks even at the break-even rate', () => {
    const v = dciView(100_000, 1, 0.01);
    const K = v.product.strike;
    const above = dciOutcome(v, K + 0.01);
    expect(above.converted).toBe(false);
    expect(above.amountQuote).toBeCloseTo(v.capital + v.quote.interest, 9);
    const below = dciOutcome(v, K - 0.01);
    expect(below.converted).toBe(true);
    expect(below.amountBase).toBeCloseTo(v.capital / K, 6);
    expect(dciValueAt(v, v.quote.breakEven)).toBeCloseTo(v.depositValue, 6);
    // continuous at the strike
    expect(dciValueAt(v, K - 1e-9)).toBeCloseTo(dciValueAt(v, K), 3);
  });

  it('builds the chart curves and range', () => {
    const v = dciView(100_000, 2, 0.01);
    const [x0, x1] = dciRange();
    expect(x0).toBeLessThan(v.product.strike);
    expect(x1).toBeGreaterThan(DEFAULT_MARKET.spot);
    const c = dciCurve(v, x0, x1, 20);
    expect(c.dci.length).toBeGreaterThanOrEqual(22);
    expect(c.deposit).toEqual([
      [x0, v.depositValue],
      [x1, v.depositValue],
    ]);
    expect(c.dci.some(([x]) => x === v.product.strike)).toBe(true);
    const outside = dciCurve(v, 0.9, 0.95, 4);
    expect(outside.dci).toHaveLength(5);
  });

  it('snaps fixings to the slider grid inside the chart range', () => {
    const [x0, x1] = dciRange();
    expect(snapFixing(0.77617)).toBeCloseTo(0.776, 10);
    expect(snapFixing(0.1)).toBe(x0);
    expect(snapFixing(9)).toBe(x1);
    const v = dciView(100_000, 1, 0.01);
    const f = defaultFixing(v);
    expect(f).toBeLessThan(v.product.strike);
    expect(dciOutcome(v, f).vsDepositQuote).toBeLessThan(0);
  });
});
