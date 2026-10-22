import { describe, expect, it } from 'vitest';
import { EXAMPLE as E } from '@/lib/fx/example';
import { forwardMoneyMarket, impliedQuoteRate } from '@/lib/fx/forward';
import { fxSwap, rollHedge, type FxSwapResult, type RollCashflow } from '@/lib/fx/swap';

const N = E.notional;

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const flows = (r: FxSwapResult, ccy: string) =>
  sum(r.cashflows.filter((c) => c.ccy === ccy).map((c) => c.amount));

describe('fxSwap on the running example (USD/CHF, 90 days ACT/360)', () => {
  const r = fxSwap({
    S: E.spot,
    rd: E.rd,
    rf: E.rf,
    days: E.mmDays,
    notionalBase: N,
    side: 'buySellBase',
  });

  it('near at spot, far at the money-market forward 0.79306', () => {
    expect(r.pair).toBe('USD/CHF');
    expect(r.days).toBe(90);
    expect(r.near.rate).toBe(E.spot);
    expect(r.farRate).toBe(forwardMoneyMarket(E.spot, E.rd, E.rf, 90));
    expect(r.far.rate).toBe(r.farRate);
    expect(Math.abs(r.farRate - 0.79306)).toBeLessThan(1e-5);
  });

  it('swap points = (far − near) in pips = −69.4', () => {
    expect(r.swapPoints).toBeCloseTo((r.far.rate - r.near.rate) / 1e-4, 10);
    expect(r.swapPoints).toBeCloseTo(-69.4, 1);
  });

  it('buy/sell USD: receive USD near, pay it back far; CHF the other way', () => {
    expect(r.near.base).toBe(N);
    expect(r.near.quote).toBeCloseTo(-N * E.spot, 8);
    expect(r.far.base).toBe(-N);
    expect(r.far.quote).toBeCloseTo(N * r.farRate, 8);
    expect(r.cashflows).toEqual([
      { leg: 'near', ccy: 'USD', amount: r.near.base },
      { leg: 'near', ccy: 'CHF', amount: r.near.quote },
      { leg: 'far', ccy: 'USD', amount: r.far.base },
      { leg: 'far', ccy: 'CHF', amount: r.far.quote },
    ]);
  });

  it('base currency nets to zero; CHF nets to N · (F − S)', () => {
    expect(flows(r, 'USD')).toBe(0);
    expect(r.near.base + r.far.base).toBe(0);
    expect(flows(r, 'CHF')).toBeCloseTo(r.netQuote, 8);
    expect(r.netQuote).toBeCloseTo(N * (r.farRate - E.spot), 8);
    // CHF 6’939 less back: the price of holding USD at 3.5 % instead of CHF at 0 %
    expect(r.netQuote).toBeCloseTo(-6939.28, 2);
  });

  it('net quote equals the interest differential N · S · (rd·tq − rf·tb) / (1 + rf·tb)', () => {
    const tq = 90 / 360;
    const tb = 90 / 360;
    expect(r.netQuote).toBeCloseTo((N * E.spot * (E.rd * tq - E.rf * tb)) / (1 + E.rf * tb), 8);
  });

  it('the swap points imply the CHF rate back (collateralised borrowing)', () => {
    expect(impliedQuoteRate(r.near.rate, r.farRate, E.rf, r.days)).toBeCloseTo(E.rd, 14);
  });
});

describe('fxSwap sides and currencies', () => {
  const args = { S: 0.9, rd: 0.01, rf: 0.04, days: 182, notionalBase: 5_000_000 };

  it('sell/buy is the exact mirror of buy/sell', () => {
    const bs = fxSwap({ ...args, side: 'buySellBase' });
    const sb = fxSwap({ ...args, side: 'sellBuyBase' });
    expect(sb.farRate).toBe(bs.farRate);
    expect(sb.swapPoints).toBe(bs.swapPoints);
    expect(sb.near.base).toBe(-bs.near.base);
    expect(sb.near.quote).toBe(-bs.near.quote);
    expect(sb.far.base).toBe(-bs.far.base);
    expect(sb.far.quote).toBe(-bs.far.quote);
    expect(sb.netQuote).toBeCloseTo(-bs.netQuote, 8);
    expect(sb.near.base).toBeLessThan(0);
    expect(sb.far.base).toBeGreaterThan(0);
  });

  it('positive swap points when the quote rate is higher', () => {
    const r = fxSwap({ ...args, rd: 0.05, rf: 0.01, side: 'buySellBase' });
    expect(r.swapPoints).toBeGreaterThan(0);
    expect(r.netQuote).toBeGreaterThan(0);
  });

  it('USD/JPY: JPY pips (0.01) and JPY ACT/365 against USD ACT/360', () => {
    const r = fxSwap({
      S: 150,
      rd: 0.001,
      rf: 0.05,
      days: 30,
      notionalBase: 1_000_000,
      side: 'buySellBase',
      quoteCcy: 'JPY',
      baseCcy: 'USD',
    });
    expect(r.pair).toBe('USD/JPY');
    expect(r.farRate).toBeCloseTo((150 * (1 + (0.001 * 30) / 365)) / (1 + (0.05 * 30) / 360), 12);
    expect(r.swapPoints).toBeCloseTo((r.farRate - 150) / 0.01, 8);
    expect(r.cashflows.map((c) => c.ccy)).toEqual(['USD', 'JPY', 'USD', 'JPY']);
    expect(flows(r, 'USD')).toBe(0);
  });

  it('zero days: far = near, no swap points, quote nets to zero', () => {
    const r = fxSwap({ ...args, days: 0, side: 'buySellBase' });
    expect(r.farRate).toBe(r.near.rate);
    expect(r.swapPoints).toBe(0);
    expect(r.netQuote).toBeCloseTo(0, 8);
  });
});

describe('rollHedge: payment slips by 30 days', () => {
  const base = { oldForward: 0.7931, notionalBase: N, rd: 0, rf: 0.035, extraDays: 30 };
  const atRoll = (cfs: RollCashflow[], ccy: string, at: RollCashflow['at']) =>
    sum(cfs.filter((c) => c.ccy === ccy && c.at === at).map((c) => c.amount));

  it('USD stronger at T1 (0.8100): importer receives CHF 16’900, new far at 0.80764', () => {
    const r = rollHedge({ ...base, spotAtRoll: 0.81 });
    expect(r.pair).toBe('USD/CHF');
    expect(r.nearRate).toBe(0.81);
    expect(r.farRate).toBeCloseTo(0.81 / (1 + (0.035 * 30) / 360), 14);
    expect(r.farRate).toBeCloseTo(0.80764437, 8);
    expect(r.swapPoints).toBeCloseTo(-23.56, 2);
    expect(r.settlementQuote).toBeCloseTo(16_900, 6);
    expect(r.settlementQuote).toBeGreaterThan(0);
  });

  it('all-in rate = old forward + swap points = far − settlement / N', () => {
    const r = rollHedge({ ...base, spotAtRoll: 0.81 });
    expect(r.allInRate).toBeCloseTo(base.oldForward + r.swapPoints * 1e-4, 12);
    expect(r.allInRate).toBeCloseTo(r.farRate - r.settlementQuote / N, 12);
    expect(r.allInRate).toBeCloseTo(0.79074437, 8);
  });

  it('USD weaker at T1 (0.7800): importer pays CHF at the roll (liquidity need)', () => {
    const r = rollHedge({ ...base, spotAtRoll: 0.78 });
    expect(r.settlementQuote).toBeCloseTo(-13_100, 6);
    expect(r.settlementQuote).toBeLessThan(0);
    // the all-in rate depends only on the old forward and the swap points, not on the spot level
    expect(r.allInRate).toBeCloseTo(base.oldForward + (r.farRate - 0.78), 12);
  });

  it('cash flows: USD nets to zero at T1, CHF at T1 = settlement, USD arrives at T2', () => {
    const r = rollHedge({ ...base, spotAtRoll: 0.81 });
    expect(r.cashflows).toHaveLength(6);
    expect(atRoll(r.cashflows, 'USD', 'roll')).toBe(0);
    expect(atRoll(r.cashflows, 'CHF', 'roll')).toBeCloseTo(r.settlementQuote, 6);
    expect(atRoll(r.cashflows, 'USD', 'newMaturity')).toBe(N);
    expect(atRoll(r.cashflows, 'CHF', 'newMaturity')).toBeCloseTo(-N * r.farRate, 6);
    // total CHF paid over both dates = N · all-in rate
    expect(sum(r.cashflows.filter((c) => c.ccy === 'CHF').map((c) => c.amount))).toBeCloseTo(
      -N * r.allInRate,
      6,
    );
    expect(r.cashflows[0]).toEqual({ at: 'roll', source: 'oldForward', ccy: 'USD', amount: N });
  });

  it('the roll is a sell/buy USD swap at spot', () => {
    const r = rollHedge({ ...base, spotAtRoll: 0.81 });
    expect(r.swap.near.base).toBe(-N);
    expect(r.swap.far.base).toBe(N);
    expect(r.swap.near.rate).toBe(0.81);
    expect(r.swap.swapPoints).toBe(r.swapPoints);
    expect(r.swap.days).toBe(30);
  });

  it('rolling by zero days keeps the hedged rate', () => {
    const r = rollHedge({ ...base, spotAtRoll: 0.83, extraDays: 0 });
    expect(r.farRate).toBe(0.83);
    expect(r.allInRate).toBeCloseTo(base.oldForward, 14);
  });

  it('passes currencies through (GBP/USD: GBP ACT/365, USD ACT/360)', () => {
    const r = rollHedge({
      oldForward: 1.25,
      notionalBase: 2_000_000,
      spotAtRoll: 1.26,
      rd: 0.045,
      rf: 0.04,
      extraDays: 60,
      baseCcy: 'GBP',
      quoteCcy: 'USD',
    });
    expect(r.pair).toBe('GBP/USD');
    expect(r.farRate).toBeCloseTo((1.26 * (1 + (0.045 * 60) / 360)) / (1 + (0.04 * 60) / 365), 12);
    expect(r.cashflows.map((c) => c.ccy)).toEqual(['GBP', 'USD', 'GBP', 'USD', 'GBP', 'USD']);
  });
});
