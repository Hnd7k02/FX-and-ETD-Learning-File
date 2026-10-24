import { describe, expect, it } from 'vitest';
import { EXAMPLE as E } from '@/lib/fx/example';
import { forwardMoneyMarket } from '@/lib/fx/forward';
import {
  cashAndCarry,
  triangularArbitrage,
  type CarryStep,
  type CashAndCarryResult,
} from '@/lib/fx/arbitrage';

const N = E.notional;
const FAIR = forwardMoneyMarket(E.spot, E.rd, E.rf, E.mmDays);
const ex = { S: E.spot, rd: E.rd, rf: E.rf, days: E.mmDays };

/** Net cash per currency on one date, including the counter side of exchanges. */
function net(r: CashAndCarryResult, at: CarryStep['at'], ccy: string): number {
  let total = 0;
  for (const s of r.steps) {
    if (!s.cashflow || s.at !== at) continue;
    if (s.ccy === ccy) total += s.amount;
    if (s.counter?.ccy === ccy) total += s.counter.amount;
  }
  return total;
}

describe('cashAndCarry', () => {
  it('no arbitrage at the fair forward', () => {
    const r = cashAndCarry({ ...ex, marketForward: FAIR });
    expect(r.pair).toBe('USD/CHF');
    expect(r.fairForward).toBe(FAIR);
    expect(Math.abs(r.fairForward - 0.79306)).toBeLessThan(1e-5);
    expect(r.direction).toBe('none');
    expect(r.steps).toEqual([]);
    expect(r.mispricingPips).toBe(0);
    expect(r.profitQuote).toBe(0);
    expect(r.profitPerUnit).toBe(0);
    expect(r.profitPresentValue).toBe(0);
  });

  it('defaults: notional 1 million, ACT/360 for USD and CHF', () => {
    const r = cashAndCarry({ ...ex, marketForward: FAIR + 0.0005 });
    expect(r.baseToday).toBeCloseTo(N / (1 + (E.rf * 90) / 360), 8);
    expect(r.quoteToday).toBeCloseTo(E.spot * r.baseToday, 8);
  });

  describe('market forward 5 pips above fair: borrow CHF, buy USD', () => {
    const Fm = FAIR + 0.0005;
    const r = cashAndCarry({ ...ex, marketForward: Fm, notionalBase: N });

    it('signals the right direction and mispricing', () => {
      expect(r.direction).toBe('borrowQuoteBuyBase');
      expect(r.mispricingPips).toBeCloseTo(5, 8);
      expect(r.marketForward).toBe(Fm);
    });

    it('profit at maturity = N · (F_mkt − F_fair) = CHF 500', () => {
      expect(r.profitQuote).toBeCloseTo(N * (Fm - FAIR), 8);
      expect(r.profitQuote).toBeCloseTo(500, 6);
      expect(r.profitPerUnit).toBeCloseTo(0.0005, 12);
      // CHF rate 0 %: present value equals maturity value
      expect(r.profitPresentValue).toBeCloseTo(r.profitQuote, 8);
    });

    it('steps in order with stable keys', () => {
      expect(r.steps.map((s) => s.key)).toEqual([
        'borrowQuote',
        'buyBaseSpot',
        'investBase',
        'sellBaseForward',
        'withdrawBase',
        'deliverBase',
        'receiveQuote',
        'repayQuote',
        'profit',
      ]);
      expect(r.steps.filter((s) => s.at === 'today')).toHaveLength(4);
    });

    it('is self-financing today and leaves only CHF profit at maturity', () => {
      expect(net(r, 'today', 'CHF')).toBeCloseTo(0, 8);
      expect(net(r, 'today', 'USD')).toBeCloseTo(0, 8);
      expect(net(r, 'maturity', 'USD')).toBeCloseTo(0, 8);
      expect(net(r, 'maturity', 'CHF')).toBeCloseTo(r.profitQuote, 8);
    });

    it('amounts: USD deposit grows to N, CHF loan repays N · F_fair', () => {
      const step = (k: string) => r.steps.find((s) => s.key === k)!;
      expect(step('borrowQuote').amount).toBeCloseTo(r.quoteToday, 8);
      expect(step('buyBaseSpot').rate).toBe(E.spot);
      expect(step('buyBaseSpot').counter).toEqual({ ccy: 'CHF', amount: -r.quoteToday });
      expect(-step('investBase').amount * (1 + (E.rf * 90) / 360)).toBeCloseTo(N, 6);
      expect(step('sellBaseForward').cashflow).toBe(false);
      expect(step('sellBaseForward').counter!.amount).toBeCloseTo(N * Fm, 8);
      expect(step('withdrawBase').amount).toBe(N);
      expect(step('deliverBase').amount).toBe(-N);
      expect(step('receiveQuote').amount).toBeCloseTo(N * Fm, 8);
      expect(step('repayQuote').amount).toBeCloseTo(-N * FAIR, 8);
      expect(step('profit').cashflow).toBe(false);
      expect(step('profit').ccy).toBe('CHF');
    });
  });

  describe('market forward 8 pips below fair: borrow USD, sell USD', () => {
    const Fm = FAIR - 0.0008;
    const r = cashAndCarry({ ...ex, marketForward: Fm });

    it('direction, mispricing and profit N · (F_fair − F_mkt)', () => {
      expect(r.direction).toBe('borrowBaseSellBase');
      expect(r.mispricingPips).toBeCloseTo(-8, 8);
      expect(r.profitQuote).toBeCloseTo(N * (FAIR - Fm), 8);
      expect(r.profitQuote).toBeCloseTo(800, 6);
    });

    it('mirror steps, self-financing', () => {
      expect(r.steps.map((s) => s.key)).toEqual([
        'borrowBase',
        'sellBaseSpot',
        'investQuote',
        'buyBaseForward',
        'withdrawQuote',
        'payQuote',
        'receiveBase',
        'repayBase',
        'profit',
      ]);
      expect(net(r, 'today', 'CHF')).toBeCloseTo(0, 8);
      expect(net(r, 'today', 'USD')).toBeCloseTo(0, 8);
      expect(net(r, 'maturity', 'USD')).toBeCloseTo(0, 8);
      expect(net(r, 'maturity', 'CHF')).toBeCloseTo(r.profitQuote, 8);
      const buyFwd = r.steps.find((s) => s.key === 'buyBaseForward')!;
      expect(buyFwd).toMatchObject({ ccy: 'USD', amount: N, rate: Fm, cashflow: false });
    });
  });

  it('present value = profit / (1 + rd · tq) = N·F_mkt/(1 + rd·tq) − S·B0', () => {
    const args = { S: 0.9, rd: 0.02, rf: 0.045, days: 180, notionalBase: 2_500_000 };
    const fair = forwardMoneyMarket(0.9, 0.02, 0.045, 180);
    const Fm = fair + 0.0012;
    const r = cashAndCarry({ ...args, marketForward: Fm });
    const dfq = 1 / (1 + (0.02 * 180) / 360);
    expect(r.profitQuote).toBeCloseTo(2_500_000 * (Fm - fair), 8);
    expect(r.profitPresentValue).toBeCloseTo(r.profitQuote * dfq, 8);
    expect(r.profitPresentValue).toBeCloseTo(2_500_000 * Fm * dfq - r.quoteToday, 6);
    expect(net(r, 'maturity', 'CHF')).toBeCloseTo(r.profitQuote, 6);
  });

  it('tolerance: no trade signalled inside ±tolerancePips', () => {
    const inside = cashAndCarry({ ...ex, marketForward: FAIR + 0.0003, tolerancePips: 5 });
    expect(inside.direction).toBe('none');
    expect(inside.mispricingPips).toBeCloseTo(3, 8);
    expect(inside.profitQuote).toBe(0);
    const outside = cashAndCarry({ ...ex, marketForward: FAIR - 0.0006, tolerancePips: 5 });
    expect(outside.direction).toBe('borrowBaseSellBase');
  });

  it('day count from the currencies (GBP/USD) or explicit bases', () => {
    const fair = forwardMoneyMarket(1.25, 0.045, 0.04, 91, 360, 365);
    const r = cashAndCarry({
      S: 1.25,
      rd: 0.045,
      rf: 0.04,
      days: 91,
      marketForward: fair,
      baseCcy: 'GBP',
      quoteCcy: 'USD',
    });
    expect(r.pair).toBe('GBP/USD');
    expect(r.fairForward).toBe(fair);
    expect(r.direction).toBe('none');
    const explicit = cashAndCarry({
      S: 1.25,
      rd: 0.045,
      rf: 0.04,
      days: 91,
      marketForward: fair + 0.001,
      basisQuote: 365,
      basisBase: 365,
    });
    expect(explicit.fairForward).toBe(forwardMoneyMarket(1.25, 0.045, 0.04, 91, 365, 365));
  });

  it('JPY pairs measure the mispricing in 0.01 pips', () => {
    const fair = forwardMoneyMarket(150, 0.001, 0.05, 30, 365, 360);
    const r = cashAndCarry({
      S: 150,
      rd: 0.001,
      rf: 0.05,
      days: 30,
      marketForward: fair + 0.1,
      baseCcy: 'USD',
      quoteCcy: 'JPY',
    });
    expect(r.mispricingPips).toBeCloseTo(10, 8);
    expect(r.steps[0]).toMatchObject({ key: 'borrowQuote', ccy: 'JPY' });
  });
});

describe('triangularArbitrage', () => {
  it('implied EUR/CHF = EUR/USD · USD/CHF; no gap, no trade (float noise ignored)', () => {
    const r = triangularArbitrage({ eurusd: 1.1, usdchf: 0.8, eurchf: 0.88 });
    expect(r.implied).toBeCloseTo(0.88, 14);
    expect(r.impliedBid).toBe(r.implied);
    expect(r.impliedAsk).toBe(r.implied);
    expect(r.gapPips).toBeCloseTo(0, 8);
    expect(r.direction).toBe('none');
    expect(r.profitPerEurMillion).toBe(0);
    expect(r.legs).toEqual([]);
  });

  it('direct EUR/CHF 10 pips too high: sell EUR direct, buy back via USD', () => {
    const r = triangularArbitrage({ eurusd: 1.1, usdchf: 0.8, eurchf: 0.881 });
    expect(r.direction).toBe('sellDirectBuyCross');
    expect(r.gapPips).toBeCloseTo(10, 8);
    expect(r.edgePips).toBeCloseTo(10, 8);
    expect(r.profitPerEurMillion).toBeCloseTo(1e6 * (0.881 / 0.88 - 1), 6);
    expect(r.profitPerEurMillion).toBeCloseTo(1136.36, 2);
    expect(r.legs.map((l) => [l.pair, l.side])).toEqual([
      ['EUR/CHF', 'sell'],
      ['USD/CHF', 'buy'],
      ['EUR/USD', 'buy'],
    ]);
  });

  it('direct EUR/CHF 10 pips too low: sell EUR via USD, buy back direct', () => {
    const r = triangularArbitrage({ eurusd: 1.1, usdchf: 0.8, eurchf: 0.879 });
    expect(r.direction).toBe('buyDirectSellCross');
    expect(r.gapPips).toBeCloseTo(-10, 8);
    expect(r.edgePips).toBeCloseTo(10, 8);
    expect(r.profitPerEurMillion).toBeCloseTo(1e6 * (0.88 / 0.879 - 1), 6);
    expect(r.legs.map((l) => [l.pair, l.side])).toEqual([
      ['EUR/USD', 'sell'],
      ['USD/CHF', 'sell'],
      ['EUR/CHF', 'buy'],
    ]);
  });

  it('legs chain: each receive is the next pay; start and end in EUR', () => {
    for (const eurchf of [0.881, 0.879]) {
      const r = triangularArbitrage({ eurusd: 1.1, usdchf: 0.8, eurchf });
      expect(r.legs[0]!.pay).toEqual({ ccy: 'EUR', amount: 1_000_000 });
      for (let i = 0; i < 2; i++) expect(r.legs[i]!.receive).toEqual(r.legs[i + 1]!.pay);
      const last = r.legs[2]!.receive;
      expect(last.ccy).toBe('EUR');
      expect(last.amount - 1_000_000).toBeCloseTo(r.profitPerEurMillion, 8);
    }
  });

  it('bid/ask: a 2-pip mid gap disappears inside the spreads', () => {
    const r = triangularArbitrage({
      eurusd: { bid: 1.0999, ask: 1.1001 },
      usdchf: { bid: 0.7999, ask: 0.8001 },
      eurchf: { bid: 0.88, ask: 0.8804 },
    });
    expect(r.impliedBid).toBeCloseTo(1.0999 * 0.7999, 14);
    expect(r.impliedAsk).toBeCloseTo(1.1001 * 0.8001, 14);
    expect(r.impliedBid).toBeLessThan(r.implied);
    expect(r.implied).toBeLessThan(r.impliedAsk);
    expect(r.gapPips).toBeCloseTo((0.8802 - 1.1 * 0.8) / 1e-4, 8);
    expect(r.edgePips).toBeLessThan(0);
    expect(r.direction).toBe('none');
    expect(r.profitPerEurMillion).toBe(0);
  });

  it('bid/ask: deals on the bid when selling and on the ask when buying', () => {
    const high = triangularArbitrage({
      eurusd: { bid: 1.0999, ask: 1.1001 },
      usdchf: { bid: 0.7999, ask: 0.8001 },
      eurchf: { bid: 0.8806, ask: 0.8808 },
    });
    expect(high.direction).toBe('sellDirectBuyCross');
    expect(high.legs.map((l) => l.rate)).toEqual([0.8806, 0.8001, 1.1001]);
    expect(high.edgePips).toBeCloseTo((0.8806 - 1.1001 * 0.8001) / 1e-4, 8);
    expect(high.profitPerEurMillion).toBeCloseTo(1e6 * (0.8806 / (1.1001 * 0.8001) - 1), 6);

    const low = triangularArbitrage({
      eurusd: { bid: 1.0999, ask: 1.1001 },
      usdchf: { bid: 0.7999, ask: 0.8001 },
      eurchf: { bid: 0.879, ask: 0.8792 },
    });
    expect(low.direction).toBe('buyDirectSellCross');
    expect(low.legs.map((l) => l.rate)).toEqual([1.0999, 0.7999, 0.8792]);
    expect(low.profitPerEurMillion).toBeCloseTo(1e6 * ((1.0999 * 0.7999) / 0.8792 - 1), 6);
  });

  it('mixes mid and two-way quotes', () => {
    const r = triangularArbitrage({
      eurusd: 1.1,
      usdchf: { bid: 0.7998, ask: 0.8002 },
      eurchf: 0.88,
    });
    expect(r.implied).toBeCloseTo(0.88, 14);
    expect(r.direction).toBe('none');
  });

  it('rejects a bid above the ask', () => {
    expect(() =>
      triangularArbitrage({ eurusd: { bid: 1.1002, ask: 1.1 }, usdchf: 0.8, eurchf: 0.88 }),
    ).toThrow(RangeError);
  });
});
