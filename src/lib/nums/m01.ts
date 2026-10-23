/**
 * Numbers of module 01 (FX market & spot) for <Num of="m01.…" />. Everything is computed from
 * the running example (src/lib/fx/example.ts), the calculation core, the module logic in
 * src/lib/m01 and the ECB raw data (data/raw/ecb-eur-reference.csv); nothing is typed in.
 * Scenario rates (as in module 04), the spread model, the order levels and EUR/USD are teaching
 * choices kept in their config objects (M01_SCENARIOS, SPREAD_MODEL, ORDER_DEMO, TRI_CONFIG,
 * APRIL_2025) so they are easy to change (D-22).
 */
import rawCsv from '../../../data/raw/ecb-eur-reference.csv?raw';
import { parseRawCsv } from '@/lib/data/csv';
import { pairSeries } from '@/lib/data/series';
import { EXAMPLE as E } from '@/lib/fx/example';
import {
  BIG_FIGURE,
  M01_SCENARIOS,
  PIP,
  costChf,
  exposure,
  inverseRate,
  probBeyond,
  sigmaRange,
} from '@/lib/m01/exposure';
import { pairConvention } from '@/lib/m01/g10';
import { APRIL_2025, windowMove } from '@/lib/m01/history';
import { SPREAD_MODEL, spreadCost, spreadPips, twoWayQuote } from '@/lib/m01/quote';
import { ORDER_DEMO, buildPath, fillBuy } from '@/lib/m01/orders';
import { TRI_CONFIG, directAt, triState } from '@/lib/m01/triangle';
import type { NumTable } from './types';

const { spot: S, notional: N, vol, T, rd, rf, mmDays } = E;

export { M01_SCENARIOS };
const SC = M01_SCENARIOS;

const up = exposure(SC.stUp);
const down = exposure(SC.stDown);
const [lo, hi] = sigmaRange(S, vol, T);

// Section 3: two-way price
const base = twoWayQuote(SPREAD_MODEL.mid, SPREAD_MODEL.basePips);
const allOn = { liquidity: true, time: true, size: true, vol: true, event: true };
const maxSpread = spreadPips(allOn);
const eveningSpread = spreadPips({ time: true });

// Section 3: orders
const calm = buildPath('calm');
const gap = buildPath('gap');
const stopGap = fillBuy(gap, 'stop', ORDER_DEMO.stop.level);
const stopCalm = fillBuy(calm, 'stop', ORDER_DEMO.stop.level);
const limitCalm = fillBuy(calm, 'limit', ORDER_DEMO.limit.level);
const limitGap = fillBuy(gap, 'limit', ORDER_DEMO.limit.level);
const market = fillBuy(calm, 'market', null);

// Section 3: triangular arbitrage (direct EUR/CHF a few pips above the implied cross)
const triMids = {
  eurusd: TRI_CONFIG.eurusd,
  usdchf: TRI_CONFIG.usdchf,
  eurchf: directAt(TRI_CONFIG.eurusd, TRI_CONFIG.usdchf, TRI_CONFIG.examplePips),
};
const tri = triState(triMids, true);
const triFlat = triState(triMids, false);

// Section 4: April 2025 from the ECB reference rates (USD/CHF and EUR/USD)
const ecb = parseRawCsv(rawCsv);
const aprUsdChf = windowMove(pairSeries(ecb, 'USD/CHF'), APRIL_2025.anchor, APRIL_2025.to);
const aprEurUsd = windowMove(pairSeries(ecb, 'EUR/USD'), APRIL_2025.anchor, APRIL_2025.to);

// Section 4: carry with the example rates (borrow CHF, invest USD, money market Act/360)
const tMM = mmDays / 360;
const usdEnd = N * (1 + rf * tMM);
const chfDebt = costChf(S, N) * (1 + rd * tMM);
const breakEven = chfDebt / usdEnd;

/** Raw values for the quiz file and tests. */
export const M01 = {
  up,
  down,
  range: [lo, hi] as const,
  quote: base,
  maxSpread,
  eveningSpread,
  stopGap,
  stopCalm,
  limitCalm,
  limitGap,
  market,
  gapFridayAsk: gap.ask[ORDER_DEMO.weekendAt - 1]!,
  gapMondayAsk: gap.ask[ORDER_DEMO.weekendAt]!,
  tri: { mids: triMids, state: tri, profit: tri.profitPerEurMillion, flat: triFlat },
  carry: { usdEnd, chfDebt, breakEven, interestUsd: usdEnd - N },
  probUp: probBeyond(SC.stUp),
  probDown: probBeyond(SC.stDown),
  april2025: { usdchf: aprUsdChf, eurusd: aprEurUsd },
} as const;

export const nums: NumTable = {
  // Section 1: exposure
  'm01.costToday': { value: costChf(S, N), kind: 'money', note: 'N · S' },
  'm01.pipChf': { value: PIP * N, kind: 'money', note: 'CHF per pip on USD 1 Mio.' },
  'm01.bigFigChf': { value: BIG_FIGURE * N, kind: 'money', note: 'CHF per big figure' },
  'm01.sBf': { value: S + BIG_FIGURE, kind: 'rate', note: 'Spot + 1 big figure' },
  'm01.costBf': { value: costChf(S + BIG_FIGURE, N), kind: 'money' },
  'm01.stUp': { value: SC.stUp, kind: 'rate' },
  'm01.stDown': { value: SC.stDown, kind: 'rate' },
  'm01.costUp': { value: up.cost, kind: 'money' },
  'm01.costDown': { value: down.cost, kind: 'money' },
  'm01.diffUp': { value: up.diff, kind: 'money', sign: true },
  'm01.diffDown': { value: down.diff, kind: 'money', sign: true },
  'm01.bfUp': { value: up.bigFigures, kind: 'num', digits: 0, note: 'Big figures to stUp' },
  'm01.pctUp': { value: up.pct, kind: 'pct', sign: true },
  'm01.inverse': { value: inverseRate(S), kind: 'rate', note: 'CHF/USD = 1/S' },
  'm01.inverseUp': { value: up.inverse, kind: 'rate' },
  'm01.inversePctUp': { value: up.inversePct, kind: 'pct', digits: 2, sign: true },
  'm01.sigmaSqrtT': { value: vol * Math.sqrt(T), kind: 'pct', note: 'σ√T' },
  'm01.rangeLo': { value: lo, kind: 'rate' },
  'm01.rangeHi': { value: hi, kind: 'rate' },
  'm01.rangeLoChf': { value: costChf(lo, N) - costChf(S, N), kind: 'money', sign: true },
  'm01.rangeHiChf': { value: costChf(hi, N) - costChf(S, N), kind: 'money', sign: true },
  'm01.probUp': { value: probBeyond(SC.stUp), kind: 'pct', digits: 0, note: 'P(S_T ≥ stUp)' },
  'm01.probDown': { value: probBeyond(SC.stDown), kind: 'pct', digits: 0, note: 'P(S_T ≤ stDown)' },

  // Section 2 (link to section 3): spread at a quiet hour
  'm01.spreadBase': { value: SPREAD_MODEL.basePips, kind: 'pips', digits: 0 },
  'm01.spreadEvening': { value: eveningSpread, kind: 'pips', digits: 0 },
  'm01.halfCostBase': { value: spreadCost(SPREAD_MODEL.basePips, N), kind: 'money' },
  'm01.halfCostEvening': { value: spreadCost(eveningSpread, N), kind: 'money' },

  // Section 3: two-way price
  'm01.bid': { value: base.bid, kind: 'rate' },
  'm01.ask': { value: base.ask, kind: 'rate' },
  'm01.fullCostBase': { value: spreadCost(SPREAD_MODEL.basePips, N, 'full'), kind: 'money' },
  'm01.spreadMax': { value: maxSpread, kind: 'pips', digits: 0 },
  'm01.halfCostMax': { value: spreadCost(maxSpread, N), kind: 'money' },
  'm01.costAsk': { value: base.ask * N, kind: 'money', note: 'USD 1 Mio. bought on the ask' },
  'm01.pipJpy': {
    value: pairConvention('JPY').pipValuePerMillion,
    kind: 'money',
    ccy: 'JPY',
    note: 'USD/JPY: 1 pip (0.01) on USD 1 Mio.',
  },

  // Section 3: orders
  'm01.limitLevel': { value: ORDER_DEMO.limit.level, kind: 'rate' },
  'm01.stopLevel': { value: ORDER_DEMO.stop.level, kind: 'rate' },
  'm01.gapFriday': { value: M01.gapFridayAsk, kind: 'rate', note: 'Last ask before the weekend' },
  'm01.gapMonday': { value: M01.gapMondayAsk, kind: 'rate', note: 'First ask after the gap' },
  'm01.gapFill': { value: stopGap.price, kind: 'rate' },
  'm01.gapSlipPips': { value: stopGap.slippagePips, kind: 'pips', digits: 0 },
  'm01.gapSlipChf': { value: stopGap.slippagePips * PIP * N, kind: 'money' },
  'm01.limitGapEnd': { value: limitGap.price, kind: 'rate', note: 'Unfilled limit: last ask' },

  // Section 3: triangular arbitrage
  'm01.eurusd': { value: TRI_CONFIG.eurusd, kind: 'rate' },
  'm01.implied': { value: tri.implied, kind: 'rate', note: 'EUR/USD · USD/CHF (mids)' },
  'm01.impliedBid': { value: tri.impliedBid, kind: 'rate', digits: 5 },
  'm01.impliedAsk': { value: tri.impliedAsk, kind: 'rate', digits: 5 },
  'm01.eurusdAsk': { value: tri.quotes.eurusd.ask, kind: 'rate' },
  'm01.usdchfAsk': { value: tri.quotes.usdchf.ask, kind: 'rate' },
  'm01.eurchfMid': { value: triMids.eurchf, kind: 'rate' },
  'm01.eurchfBid': { value: tri.quotes.eurchf.bid, kind: 'rate' },
  'm01.eurchfAsk': { value: tri.quotes.eurchf.ask, kind: 'rate' },
  'm01.triGapPips': { value: tri.gapPips, kind: 'pips', digits: 0 },
  'm01.triBandPips': { value: tri.noArbPips[1], kind: 'pips', note: 'Half-width of the band' },
  'm01.triLeg1Chf': { value: tri.legs[0]!.receive.amount, kind: 'money' },
  'm01.triLeg2Usd': { value: tri.legs[1]!.receive.amount, kind: 'money', ccy: 'USD' },
  'm01.triLeg3Eur': { value: tri.legs[2]!.receive.amount, kind: 'money', ccy: 'EUR' },
  'm01.triProfit': { value: tri.profitPerEurMillion, kind: 'money', ccy: 'EUR' },
  'm01.triProfitFlat': { value: triFlat.profitPerEurMillion, kind: 'money', ccy: 'EUR' },

  // Section 4: carry with CHF as funding currency
  'm01.carryInterestUsd': { value: usdEnd - N, kind: 'money', ccy: 'USD' },
  'm01.carryUsdEnd': { value: usdEnd, kind: 'money', ccy: 'USD' },
  'm01.carryBreakEven': {
    value: breakEven,
    kind: 'rate',
    digits: 5,
    note: 'CHF debt / USD at maturity = money-market forward',
  },
  'm01.carryPnlFlat': { value: usdEnd * S - chfDebt, kind: 'money', sign: true },
  'm01.carryPnlDown': { value: usdEnd * SC.stDown - chfDebt, kind: 'money', sign: true },
  'm01.rateDiff': { value: rf - rd, kind: 'pct', note: 'rf − rd' },
  'm01.carryChfDebt': { value: chfDebt, kind: 'money', note: 'CHF borrowed plus CHF interest' },

  // Section 4: April 2025 (ECB reference rates)
  'm01.apr25UsdChfStart': {
    value: aprUsdChf.start.value,
    kind: 'rate',
    note: 'USD/CHF on 2 April 2025',
  },
  'm01.apr25UsdChfLow': { value: aprUsdChf.low.value, kind: 'rate', note: 'April 2025 low' },
  'm01.apr25UsdChfPct': { value: aprUsdChf.lowPct, kind: 'pct', sign: true },
  'm01.apr25EurUsdStart': { value: aprEurUsd.start.value, kind: 'rate' },
  'm01.apr25EurUsdHigh': { value: aprEurUsd.high.value, kind: 'rate', note: 'April 2025 high' },
  'm01.apr25EurUsdPct': { value: aprEurUsd.highPct, kind: 'pct', sign: true },
};
