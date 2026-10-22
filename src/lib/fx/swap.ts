/**
 * FX swap and hedge roll.
 *
 * An FX swap is two opposite trades in the same base notional: a near leg (here: spot) and a
 * far leg (forward). Its price is the swap points, far rate − near rate, which equal the
 * forward points of the money-market forward. Economically it is borrowing one currency
 * against lending the other, fully collateralised.
 *
 * Convention: pair Base/Quote (USD/CHF), rd = quote-currency rate (CHF), rf = base-currency rate
 * (USD), simple money-market rates with the day count of each currency (see ./daycount).
 * Amounts are signed from the client's view: + = receive, − = pay.
 */
import { basisOf } from './daycount';
import { forwardMoneyMarket, forwardPoints } from './forward';

/** Direction of the swap from the client's view, in the base currency. */
export type SwapSide = 'buySellBase' | 'sellBuyBase';

/** One leg of an FX swap: rate (quote per base) and signed amounts (+ receive, − pay). */
export interface Leg {
  rate: number;
  /** Base-currency amount, e.g. +1’000’000 USD received. */
  base: number;
  /** Quote-currency amount, e.g. −800’000 CHF paid. */
  quote: number;
}

/** One cash flow of a swap leg. */
export interface SwapCashflow {
  leg: 'near' | 'far';
  ccy: string;
  /** Signed amount: + = receive, − = pay. */
  amount: number;
}

/** Inputs of {@link fxSwap}. */
export interface FxSwapInput {
  /** Near rate (spot), quote per base. */
  S: number;
  /** Quote-currency rate, simple p.a. */
  rd: number;
  /** Base-currency rate, simple p.a. */
  rf: number;
  /** Calendar days from near to far date. */
  days: number;
  /** Base notional of both legs (positive). */
  notionalBase: number;
  /** 'buySellBase': buy base near, sell it far. 'sellBuyBase': the mirror image. */
  side: SwapSide;
  /** Quote currency code (default 'CHF'); sets day count and labels. */
  quoteCcy?: string;
  /** Base currency code (default 'USD'); sets day count and labels. */
  baseCcy?: string;
}

/** Result of {@link fxSwap}. */
export interface FxSwapResult {
  /** Pair label, e.g. 'USD/CHF'. */
  pair: string;
  days: number;
  near: Leg;
  far: Leg;
  /** Far rate (money-market forward). */
  farRate: number;
  /** Swap points in pips: (far − near) / pip. */
  swapPoints: number;
  /** Near and far cash flows in the order near base, near quote, far base, far quote. */
  cashflows: SwapCashflow[];
  /** Net quote-currency result of both legs: near.quote + far.quote (base nets to zero). */
  netQuote: number;
}

/**
 * Price an FX swap: near leg at S, far leg at the money-market forward
 * F = S · (1 + rd · days / basisQuote) / (1 + rf · days / basisBase).
 * Swap points = (F − S) / pip. For 'buySellBase' with notional N:
 * near = (+N base, −N·S quote), far = (−N base, +N·F quote); 'sellBuyBase' flips all signs.
 * The base amounts of the two legs always sum to zero; netQuote = ±N · (F − S).
 */
export function fxSwap(input: FxSwapInput): FxSwapResult {
  const { S, rd, rf, days, notionalBase, side } = input;
  const baseCcy = input.baseCcy ?? 'USD';
  const quoteCcy = input.quoteCcy ?? 'CHF';
  const pair = `${baseCcy}/${quoteCcy}`;
  const farRate = forwardMoneyMarket(S, rd, rf, days, basisOf(quoteCcy), basisOf(baseCcy));
  const sign = side === 'buySellBase' ? 1 : -1;
  const N = notionalBase;
  const near: Leg = { rate: S, base: sign * N, quote: -sign * N * S };
  const far: Leg = { rate: farRate, base: -sign * N, quote: sign * N * farRate };
  return {
    pair,
    days,
    near,
    far,
    farRate,
    swapPoints: forwardPoints(farRate, S, pair),
    cashflows: [
      { leg: 'near', ccy: baseCcy, amount: near.base },
      { leg: 'near', ccy: quoteCcy, amount: near.quote },
      { leg: 'far', ccy: baseCcy, amount: far.base },
      { leg: 'far', ccy: quoteCcy, amount: far.quote },
    ],
    netQuote: near.quote + far.quote,
  };
}

/** Inputs of {@link rollHedge}. */
export interface RollHedgeInput {
  /** Rate of the maturing forward (the importer bought base at this rate for date T1). */
  oldForward: number;
  /** Base notional of the hedge (positive). */
  notionalBase: number;
  /** Spot at the roll date T1; the near leg of the roll swap is dealt at this rate. */
  spotAtRoll: number;
  /** Quote-currency rate, simple p.a. */
  rd: number;
  /** Base-currency rate, simple p.a. */
  rf: number;
  /** Days the payment slips: new maturity T2 = T1 + extraDays. */
  extraDays: number;
  /** Quote currency code (default 'CHF'). */
  quoteCcy?: string;
  /** Base currency code (default 'USD'). */
  baseCcy?: string;
}

/** One cash flow of the roll; `at` is the old maturity T1 ('roll') or the new one T2. */
export interface RollCashflow {
  at: 'roll' | 'newMaturity';
  /** Which trade produces it: the maturing forward or one of the two swap legs. */
  source: 'oldForward' | 'near' | 'far';
  ccy: string;
  /** Signed amount: + = receive, − = pay. */
  amount: number;
}

/** Result of {@link rollHedge}. */
export interface RollHedgeResult {
  pair: string;
  /** The roll swap itself (sell base near, buy base far). */
  swap: FxSwapResult;
  /** Near rate = spot at the roll date. */
  nearRate: number;
  /** Far rate = new forward for T2. */
  farRate: number;
  /** Swap points in pips, (farRate − nearRate) / pip. */
  swapPoints: number;
  /**
   * Cash settlement in quote currency at T1: (nearRate − oldForward) · notionalBase.
   * + = the importer receives quote currency (base rose above the hedged rate, the hedge is in
   * the money); − = the importer must pay it (base fell below the hedged rate).
   */
  settlementQuote: number;
  /**
   * All-in rate for T2: oldForward + (farRate − nearRate) = farRate − settlementQuote / N.
   * Ignores interest on the settlement between T1 and T2.
   */
  allInRate: number;
  /** All cash flows: maturing forward and near leg at T1, far leg at T2. */
  cashflows: RollCashflow[];
}

/**
 * Roll a forward hedge whose payment slips by `extraDays` (convention: near leg at current
 * spot). At T1 the maturing forward delivers +N base against −N · oldForward quote; the roll
 * swap sells the N base near at spot (+N · S1 quote) and buys them back far at
 * F2 = forwardMoneyMarket(S1, rd, rf, extraDays). Net at T1: base 0, quote N · (S1 − oldForward).
 * At T2: +N base against −N · F2 quote. All-in rate = oldForward + (F2 − S1).
 * (Desks can also roll at the historical rate, i.e. near leg at oldForward without a cash
 * settlement and the difference with interest moved into the far rate; this is text only.)
 */
export function rollHedge(input: RollHedgeInput): RollHedgeResult {
  const { oldForward, notionalBase: N, spotAtRoll, rd, rf, extraDays } = input;
  const baseCcy = input.baseCcy ?? 'USD';
  const quoteCcy = input.quoteCcy ?? 'CHF';
  const swap = fxSwap({
    S: spotAtRoll,
    rd,
    rf,
    days: extraDays,
    notionalBase: N,
    side: 'sellBuyBase',
    quoteCcy,
    baseCcy,
  });
  const settlementQuote = (swap.near.rate - oldForward) * N;
  return {
    pair: swap.pair,
    swap,
    nearRate: swap.near.rate,
    farRate: swap.farRate,
    swapPoints: swap.swapPoints,
    settlementQuote,
    allInRate: oldForward + (swap.farRate - swap.near.rate),
    cashflows: [
      { at: 'roll', source: 'oldForward', ccy: baseCcy, amount: N },
      { at: 'roll', source: 'oldForward', ccy: quoteCcy, amount: -N * oldForward },
      { at: 'roll', source: 'near', ccy: baseCcy, amount: swap.near.base },
      { at: 'roll', source: 'near', ccy: quoteCcy, amount: swap.near.quote },
      { at: 'newMaturity', source: 'far', ccy: baseCcy, amount: swap.far.base },
      { at: 'newMaturity', source: 'far', ccy: quoteCcy, amount: swap.far.quote },
    ],
  };
}
