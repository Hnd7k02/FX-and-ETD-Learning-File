import { describe, expect, it } from 'vitest';
import { gkPrice } from '@/lib/fx/vanilla';
import {
  buildDualCurrency,
  dualCurrencyPayoff,
  dualCurrencyQuote,
} from '@/lib/fx/mc/dci';
import { DEFAULT_MARKET as m, MC_CONFIG } from '@/lib/fx/mc/products';
import { expectation } from '@/lib/fx/mc/value';

describe('dual currency investment (CHF)', () => {
  const dci = buildDualCurrency();

  it('uses the §8.7 defaults: CHF 100’000, 30 days, K = spot − 1 %, ACT/360', () => {
    expect(dci).toEqual({
      kind: 'dualCurrency',
      capital: 100_000,
      days: 30,
      strike: 0.792,
      interestBasis: 360,
      convertInterest: false,
    });
  });

  it('pays a yield above the money-market rate, from the premium of the sold USD put', () => {
    const q = dualCurrencyQuote(dci);
    const T = 30 / 365;
    const put = gkPrice(0.8, 0.792, T, 0.08, 0, 0.035, 'put');
    expect(q.putPerUnit).toBeCloseTo(put, 15);
    expect(q.conversionAmountBase).toBeCloseTo(100_000 / 0.792, 9);
    expect(q.premium).toBeCloseTo((100_000 / 0.792) * put, 9);
    expect(q.moneyMarketRate).toBe(0); // CHF rate 0 in the running example
    expect(q.premiumYield).toBeCloseTo((q.premium / 100_000) * (360 / 30), 12);
    expect(q.yieldPa).toBeGreaterThan(q.moneyMarketRate);
    expect(q.yieldPa).toBeGreaterThan(0.01);
    expect(q.interest).toBeCloseTo(100_000 * q.yieldPa * (30 / 360), 8);
    expect([q.T, q.tau]).toEqual([T, 30 / 360]);
  });

  it('is fair: PV = capital, also with a positive CHF rate and with converted interest', () => {
    for (const rd of [0, 0.02]) {
      for (const convertInterest of [false, true]) {
        const mk = { ...m, rd };
        const p = buildDualCurrency(mk, { convertInterest });
        const q = dualCurrencyQuote(p, mk);
        expect(q.pv).toBeCloseTo(p.capital, 8);
        if (rd > 0) expect(q.yieldPa).toBeGreaterThan(q.moneyMarketRate);
        expect(q.moneyMarketRate).toBeCloseTo((Math.exp(rd * (30 / 365)) - 1) / (30 / 360), 14);
      }
    }
  });

  it('pays CHF capital plus interest at or above the strike, converts below it', () => {
    const q = dualCurrencyQuote(dci);
    const up = dualCurrencyPayoff(0.8, dci, q);
    expect(up).toMatchObject({ converted: false, amountBase: 0, amountQuote: 100_000 + q.interest });
    expect(up.vsDepositQuote).toBeCloseTo(q.interest, 9);
    expect(dualCurrencyPayoff(0.792, dci, q).converted).toBe(false);
    const down = dualCurrencyPayoff(0.77, dci, q);
    expect(down.converted).toBe(true);
    expect(down.amountBase).toBeCloseTo(100_000 / 0.792, 9);
    expect(down.amountQuote).toBeCloseTo(q.interest, 9);
    expect(down.valueQuote).toBeCloseTo((100_000 / 0.792) * 0.77 + q.interest, 8);
    expect(down.vsDepositQuote).toBeLessThan(0);
  });

  it('break-even: the converted outcome equals a plain deposit there', () => {
    for (const convertInterest of [false, true]) {
      const p = buildDualCurrency(m, { convertInterest });
      const q = dualCurrencyQuote(p);
      expect(q.breakEven).toBeLessThan(p.strike);
      expect(dualCurrencyPayoff(q.breakEven, p, q).vsDepositQuote).toBeCloseTo(0, 6);
    }
    const p = buildDualCurrency(m, { convertInterest: true });
    const q = dualCurrencyQuote(p);
    const down = dualCurrencyPayoff(0.7, p, q);
    expect(down.amountQuote).toBe(0);
    expect(down.amountBase).toBeCloseTo((100_000 + q.interest) / p.strike, 8);
  });

  it('Monte Carlo of the payoff confirms PV = capital within 3 SE', () => {
    const q = dualCurrencyQuote(dci);
    const r = expectation(m, dci.days, (path) => dualCurrencyPayoff(path[dci.days]!, dci, q).valueQuote, {
      paths: 40_000,
      seed: 99,
    });
    expect(Math.abs(r.mean - dci.capital)).toBeLessThan(3 * r.stdErr);
  });

  it('follows MC_CONFIG for the annualisation and rejects invalid terms', () => {
    const act365 = dualCurrencyQuote(buildDualCurrency(m, { interestBasis: 365 }));
    expect(act365.premiumYield).toBeCloseTo(dualCurrencyQuote(dci).premiumYield * (365 / 360), 12);
    expect(MC_CONFIG.products.dualCurrency.interestBasis).toBe(360);
    expect(() => dualCurrencyQuote(buildDualCurrency(m, { days: 0 }))).toThrow(RangeError);
  });
});
