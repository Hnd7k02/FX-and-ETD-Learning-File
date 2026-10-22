import { describe, expect, it } from 'vitest';
import { EXAMPLE as E, EXAMPLE_FORWARD } from '@/lib/fx/example';
import {
  DAY_COUNT,
  DEFAULT_DAY_COUNT,
  basisOf,
  dayBasis,
  dayCountOf,
  yearFraction,
} from '@/lib/fx/daycount';
import {
  forward,
  forwardCarry,
  forwardContinuous,
  forwardMoneyMarket,
  forwardPoints,
  forwardPremium,
  forwardPremiumAnnualized,
  impliedQuoteRate,
  impliedRateDifferential,
} from '@/lib/fx/forward';

describe('day count', () => {
  it('uses ACT/360 for CHF, USD, EUR and ACT/365 for GBP, JPY', () => {
    expect(DAY_COUNT.CHF).toBe('ACT/360');
    expect(DAY_COUNT.USD).toBe('ACT/360');
    expect(DAY_COUNT.EUR).toBe('ACT/360');
    expect(DAY_COUNT.GBP).toBe('ACT/365');
    expect(DAY_COUNT.JPY).toBe('ACT/365');
  });

  it('maps conventions to bases and year fractions', () => {
    expect(dayBasis('ACT/360')).toBe(360);
    expect(dayBasis('ACT/365')).toBe(365);
    expect(yearFraction(90, 'ACT/360')).toBe(0.25);
    expect(yearFraction(73, 'ACT/365')).toBe(0.2);
  });

  it('looks up currencies case-insensitively and falls back to ACT/360', () => {
    expect(dayCountOf('gbp')).toBe('ACT/365');
    expect(dayCountOf('NOK')).toBe(DEFAULT_DAY_COUNT);
    expect(dayCountOf()).toBe('ACT/360');
    expect(basisOf('JPY')).toBe(365);
    expect(basisOf('CHF')).toBe(360);
    expect(basisOf()).toBe(360);
  });
});

describe('running example (docs/reference/gk_reference.py)', () => {
  it('continuous forward 0.79303, −69.7 pips', () => {
    const F = forwardContinuous(E.spot, E.rd, E.rf, E.T);
    expect(Math.abs(F - 0.79303)).toBeLessThan(1e-5);
    expect(F).toBe(EXAMPLE_FORWARD);
    expect(forwardPoints(F, E.spot)).toBeCloseTo(-69.7, 1);
  });

  it('money-market forward ACT/360, 90 days: 0.79306, −69.4 pips', () => {
    const F = forwardMoneyMarket(E.spot, E.rd, E.rf, E.mmDays);
    expect(Math.abs(F - 0.79306)).toBeLessThan(1e-5);
    expect(forwardPoints(F, E.spot, E.pair)).toBeCloseTo(-69.4, 1);
  });

  it('the two conventions differ by about 0.3 pips', () => {
    const cont = forward(E.spot, E.rd, E.rf, E.T);
    const mm = forward(E.spot, E.rd, E.rf, E.T, 'moneyMarket');
    const diff = forwardPoints(mm, E.spot) - forwardPoints(cont, E.spot);
    expect(diff).toBeGreaterThan(0.25);
    expect(diff).toBeLessThan(0.35);
    expect(diff).toBeCloseTo(0.302, 3);
  });
});

describe('forward()', () => {
  it('defaults to the continuous convention', () => {
    expect(forward(0.9, 0.01, 0.04, 0.5)).toBe(forwardContinuous(0.9, 0.01, 0.04, 0.5));
    expect(forward(0.9, 0.01, 0.04, 0.5, 'continuous')).toBe(
      forwardContinuous(0.9, 0.01, 0.04, 0.5),
    );
  });

  it('money market: days default to round(T · 360), bases ACT/360', () => {
    expect(forward(0.8, 0.01, 0.035, 0.25, 'moneyMarket')).toBe(
      forwardMoneyMarket(0.8, 0.01, 0.035, 90, 360, 360),
    );
    // 0.5 · 360 = 180 days
    expect(forward(0.8, 0.01, 0.035, 0.5, 'moneyMarket')).toBe(
      forwardMoneyMarket(0.8, 0.01, 0.035, 180),
    );
  });

  it('money market: explicit days and day count per currency (USD/JPY, GBP/CHF)', () => {
    const usdjpy = forward(150, 0.001, 0.05, 0.25, 'moneyMarket', {
      days: 91,
      quoteCcy: 'JPY',
      baseCcy: 'USD',
    });
    expect(usdjpy).toBeCloseTo((150 * (1 + (0.001 * 91) / 365)) / (1 + (0.05 * 91) / 360), 12);

    const gbpchf = forward(1.1, 0.005, 0.045, 0.25, 'moneyMarket', {
      quoteCcy: 'CHF',
      baseCcy: 'GBP',
    });
    expect(gbpchf).toBeCloseTo((1.1 * (1 + (0.005 * 90) / 360)) / (1 + (0.045 * 90) / 365), 12);
  });

  it('equal rates: continuous F = S, money market only if the day counts match', () => {
    expect(forwardContinuous(0.8, 0.03, 0.03, 1)).toBeCloseTo(0.8, 14);
    expect(forwardMoneyMarket(0.8, 0.03, 0.03, 180)).toBeCloseTo(0.8, 14);
    // GBP (ACT/365) vs USD (ACT/360): the same rate earns less in GBP, so F ≠ S.
    const F = forward(1.25, 0.03, 0.03, 0.5, 'moneyMarket', { baseCcy: 'GBP', quoteCcy: 'USD' });
    expect(F).toBeGreaterThan(1.25);
  });

  it('zero rates or zero time give F = S', () => {
    expect(forwardContinuous(0.8, 0, 0, 1)).toBe(0.8);
    expect(forwardMoneyMarket(0.8, 0.02, 0.05, 0)).toBe(0.8);
  });

  it('F rises with rd and falls with rf', () => {
    const f0 = forwardMoneyMarket(0.8, 0.0, 0.035, 90);
    expect(forwardMoneyMarket(0.8, 0.01, 0.035, 90)).toBeGreaterThan(f0);
    expect(forwardMoneyMarket(0.8, 0.0, 0.045, 90)).toBeLessThan(f0);
    const c0 = forwardContinuous(0.8, 0.0, 0.035, 0.25);
    expect(forwardContinuous(0.8, 0.01, 0.035, 0.25)).toBeGreaterThan(c0);
    expect(forwardContinuous(0.8, 0.0, 0.045, 0.25)).toBeLessThan(c0);
  });
});

describe('forward points and premium', () => {
  it('pips are 0.0001, for JPY pairs 0.01', () => {
    expect(forwardPoints(0.8012, 0.8)).toBeCloseTo(12, 10);
    expect(forwardPoints(149.5, 150, 'USD/JPY')).toBeCloseTo(-50, 10);
    expect(forwardPoints(162.25, 162, 'eur/jpy')).toBeCloseTo(25, 10);
    expect(forwardPoints(1.0855, 1.085, 'EUR/USD')).toBeCloseTo(5, 10);
  });

  it('premium is F / S − 1', () => {
    expect(forwardPremium(0.8, 0.8)).toBe(0);
    expect(forwardPremium(0.808, 0.8)).toBeCloseTo(0.01, 14);
    expect(forwardPremium(EXAMPLE_FORWARD, E.spot)).toBeCloseTo(Math.exp(-0.035 * 0.25) - 1, 14);
  });

  it('annualised premium ≈ rate differential, exact when rf = 0', () => {
    const F = forwardMoneyMarket(0.8, 0.02, 0, 90);
    expect(forwardPremiumAnnualized(F, 0.8, 90)).toBeCloseTo(0.02, 14);
    const Fx = forwardMoneyMarket(E.spot, E.rd, E.rf, 90);
    // (1 / 1.00875 − 1) · 4 = −0.034696: close to −3.5 % but not equal
    expect(forwardPremiumAnnualized(Fx, E.spot, 90)).toBeCloseTo(-0.035 / 1.00875, 12);
    expect(forwardPremiumAnnualized(F, 0.8, 91, 365)).toBeCloseTo(
      (forwardPremium(F, 0.8) * 365) / 91,
      14,
    );
    expect(forwardPremiumAnnualized(F, 0.8, 0)).toBeNaN();
  });

  it('implied rate differential inverts the continuous forward', () => {
    expect(impliedRateDifferential(E.spot, EXAMPLE_FORWARD, E.T)).toBeCloseTo(E.rd - E.rf, 14);
    const F = forwardContinuous(1.08, 0.04, 0.015, 0.75);
    expect(impliedRateDifferential(1.08, F, 0.75)).toBeCloseTo(0.025, 14);
    expect(impliedRateDifferential(1.08, F, 0)).toBeNaN();
    expect(impliedRateDifferential(1.08, F, -1)).toBeNaN();
  });

  it('implied quote rate inverts the money-market forward', () => {
    const F = forwardMoneyMarket(E.spot, E.rd, E.rf, 90);
    expect(impliedQuoteRate(E.spot, F, E.rf, 90)).toBeCloseTo(E.rd, 14);
    const Fj = forwardMoneyMarket(150, 0.001, 0.05, 91, 365, 360);
    expect(impliedQuoteRate(150, Fj, 0.05, 91, 365, 360)).toBeCloseTo(0.001, 14);
    expect(impliedQuoteRate(150, Fj, 0.05, 0)).toBeNaN();
  });
});

describe('forward carry: Forward = Spot + Cost − Benefit', () => {
  it('reproduces the money-market forward exactly', () => {
    const c = forwardCarry(0.9, 0.012, 0.041, 120, 360, 365);
    expect(c.spot).toBe(0.9);
    expect(c.forward).toBeCloseTo(forwardMoneyMarket(0.9, 0.012, 0.041, 120, 360, 365), 15);
    expect(c.spot + c.cost - c.benefit).toBe(c.forward);
    expect(c.cost).toBeGreaterThan(0);
    expect(c.benefit).toBeGreaterThan(0);
  });

  it('running example: no cost (CHF 0 %), benefit 69.4 pips', () => {
    const c = forwardCarry(E.spot, E.rd, E.rf, E.mmDays);
    expect(c.cost).toBe(0);
    expect(c.benefit / 1e-4).toBeCloseTo(69.4, 1);
    expect(forwardPoints(c.forward, E.spot)).toBeCloseTo(-69.4, 1);
  });
});
