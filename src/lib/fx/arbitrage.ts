/**
 * Arbitrage calculators: cash-and-carry against the forward (module 02) and triangular
 * arbitrage between three spot quotes (module 01).
 *
 * Convention: pair Base/Quote (USD/CHF), rd = quote-currency rate (CHF), rf = base-currency
 * rate (USD), simple money-market rates. Amounts are signed from the arbitrageur's view:
 * + = receive, − = pay. No fees, no credit limits, no bid/ask on rates.
 */
import { pipSize } from '@/lib/format';
import { basisOf } from './daycount';
import { forwardMoneyMarket } from './forward';

/** Numerical noise guard for "market equals fair" comparisons, in price units. */
const EPS = 1e-12;

/** Which way the cash-and-carry runs. */
export type CarryDirection = 'none' | 'borrowQuoteBuyBase' | 'borrowBaseSellBase';

/** Stable step identifiers so the UI can translate them. */
export type CarryStepKey =
  // market forward above fair: borrow quote, buy base, invest base, sell base forward
  | 'borrowQuote'
  | 'buyBaseSpot'
  | 'investBase'
  | 'sellBaseForward'
  | 'withdrawBase'
  | 'deliverBase'
  | 'receiveQuote'
  | 'repayQuote'
  // market forward below fair: borrow base, sell base, invest quote, buy base forward
  | 'borrowBase'
  | 'sellBaseSpot'
  | 'investQuote'
  | 'buyBaseForward'
  | 'withdrawQuote'
  | 'payQuote'
  | 'receiveBase'
  | 'repayBase'
  // both
  | 'profit';

/** One step of the cash-and-carry. */
export interface CarryStep {
  key: CarryStepKey;
  at: 'today' | 'maturity';
  ccy: string;
  /** Signed amount in `ccy`: + = receive, − = pay (for a forward: the amount agreed). */
  amount: number;
  /** Rate used in this step: spot or forward (quote per base) or interest rate p.a. */
  rate?: number;
  /** Other side of an exchange (spot trade or forward agreement). */
  counter?: { ccy: string; amount: number };
  /**
   * true if cash moves. false for the forward agreement (signed today, settled at maturity) and
   * for the profit summary line.
   */
  cashflow: boolean;
}

/** Inputs of {@link cashAndCarry}. */
export interface CashAndCarryInput {
  /** Spot, quote per base. */
  S: number;
  /** Quote-currency rate, simple p.a. */
  rd: number;
  /** Base-currency rate, simple p.a. */
  rf: number;
  /** Calendar days to maturity. */
  days: number;
  /** Forward rate quoted in the market, quote per base. */
  marketForward: number;
  /** Base amount of the forward, delivered at maturity (default 1’000’000). */
  notionalBase?: number;
  /** Days-per-year of the quote currency (default from quoteCcy: CHF 360). */
  basisQuote?: number;
  /** Days-per-year of the base currency (default from baseCcy: USD 360). */
  basisBase?: number;
  /** Mispricing in pips up to which no trade is signalled (default 0). Threshold only. */
  tolerancePips?: number;
  /** Base currency code (default 'USD'). */
  baseCcy?: string;
  /** Quote currency code (default 'CHF'). */
  quoteCcy?: string;
}

/** Result of {@link cashAndCarry}. */
export interface CashAndCarryResult {
  pair: string;
  /** Fair (money-market) forward S · (1 + rd · tq) / (1 + rf · tb). */
  fairForward: number;
  marketForward: number;
  /** (marketForward − fairForward) / pip, signed. */
  mispricingPips: number;
  direction: CarryDirection;
  /** Ordered steps; empty when direction is 'none'. */
  steps: CarryStep[];
  /** Base amount moved today: N / (1 + rf · tb). */
  baseToday: number;
  /** Quote amount moved today: S · N / (1 + rf · tb). */
  quoteToday: number;
  /** Profit at maturity in quote currency: N · |marketForward − fairForward| (0 if 'none'). */
  profitQuote: number;
  /** Profit per 1 unit of base: |marketForward − fairForward| (0 if 'none'). */
  profitPerUnit: number;
  /** Profit discounted to today: profitQuote / (1 + rd · tq). */
  profitPresentValue: number;
}

/**
 * Cash-and-carry arbitrage between spot, the two money-market rates and a quoted forward.
 *
 * With tq = days / basisQuote, tb = days / basisBase and forward notional N (base delivered at
 * maturity), the arbitrageur moves B0 = N / (1 + rf · tb) base and Q0 = S · B0 quote today, so
 * the base leg grows to exactly N and the quote leg to Q0 · (1 + rd · tq) = N · F_fair.
 * - market > fair ('borrowQuoteBuyBase'): borrow Q0 quote, buy B0 base spot, invest at rf, sell
 *   N base forward at F_mkt. At maturity: N base in, N base delivered, N · F_mkt quote in,
 *   N · F_fair quote repaid.
 * - market < fair ('borrowBaseSellBase'): mirror image (borrow base, sell spot, invest quote,
 *   buy base forward).
 * Exact profit at maturity: profitQuote = N · |F_mkt − F_fair| (quote currency); present value
 * profitQuote / (1 + rd · tq). Both are 0 if |F_mkt − F_fair| ≤ tolerancePips · pip.
 */
export function cashAndCarry(input: CashAndCarryInput): CashAndCarryResult {
  const { S, rd, rf, days, marketForward: Fm } = input;
  const baseCcy = input.baseCcy ?? 'USD';
  const quoteCcy = input.quoteCcy ?? 'CHF';
  const pair = `${baseCcy}/${quoteCcy}`;
  const N = input.notionalBase ?? 1_000_000;
  const basisQuote = input.basisQuote ?? basisOf(quoteCcy);
  const basisBase = input.basisBase ?? basisOf(baseCcy);
  const pip = pipSize(pair);
  const tq = days / basisQuote;
  const tb = days / basisBase;

  const Ff = forwardMoneyMarket(S, rd, rf, days, basisQuote, basisBase);
  const diff = Fm - Ff;
  const B0 = N / (1 + rf * tb);
  const Q0 = S * B0;
  const threshold = (input.tolerancePips ?? 0) * pip + EPS;

  const common = {
    pair,
    fairForward: Ff,
    marketForward: Fm,
    mispricingPips: diff / pip,
    baseToday: B0,
    quoteToday: Q0,
  };

  if (Math.abs(diff) <= threshold) {
    return {
      ...common,
      direction: 'none',
      steps: [],
      profitQuote: 0,
      profitPerUnit: 0,
      profitPresentValue: 0,
    };
  }

  const profitPerUnit = Math.abs(diff);
  const profitQuote = N * profitPerUnit;
  const q = stepIn(quoteCcy);
  const b = stepIn(baseCcy);

  const steps: CarryStep[] =
    diff > 0
      ? [
          q('borrowQuote', 'today', Q0, rd),
          { ...b('buyBaseSpot', 'today', B0, S), counter: { ccy: quoteCcy, amount: -Q0 } },
          b('investBase', 'today', -B0, rf),
          {
            ...b('sellBaseForward', 'today', -N, Fm),
            counter: { ccy: quoteCcy, amount: N * Fm },
            cashflow: false,
          },
          b('withdrawBase', 'maturity', N, rf),
          b('deliverBase', 'maturity', -N, Fm),
          q('receiveQuote', 'maturity', N * Fm, Fm),
          q('repayQuote', 'maturity', -N * Ff, rd),
          { ...q('profit', 'maturity', profitQuote), cashflow: false },
        ]
      : [
          b('borrowBase', 'today', B0, rf),
          { ...b('sellBaseSpot', 'today', -B0, S), counter: { ccy: quoteCcy, amount: Q0 } },
          q('investQuote', 'today', -Q0, rd),
          {
            ...b('buyBaseForward', 'today', N, Fm),
            counter: { ccy: quoteCcy, amount: -N * Fm },
            cashflow: false,
          },
          q('withdrawQuote', 'maturity', N * Ff, rd),
          q('payQuote', 'maturity', -N * Fm, Fm),
          b('receiveBase', 'maturity', N, Fm),
          b('repayBase', 'maturity', -N, rf),
          { ...q('profit', 'maturity', profitQuote), cashflow: false },
        ];

  return {
    ...common,
    direction: diff > 0 ? 'borrowQuoteBuyBase' : 'borrowBaseSellBase',
    steps,
    profitQuote,
    profitPerUnit,
    profitPresentValue: profitQuote / (1 + rd * tq),
  };
}

/** Step factory bound to one currency; creates a cash-flow step. */
function stepIn(ccy: string) {
  return (key: CarryStepKey, at: CarryStep['at'], amount: number, rate?: number): CarryStep =>
    rate === undefined
      ? { key, at, ccy, amount, cashflow: true }
      : { key, at, ccy, amount, rate, cashflow: true };
}

/** A quote: a single (mid) rate or a two-way price. */
export type TwoWay = number | { bid: number; ask: number };

/** Inputs of {@link triangularArbitrage}: EUR/USD, USD/CHF and the direct EUR/CHF quote. */
export interface TriangularInput {
  eurusd: TwoWay;
  usdchf: TwoWay;
  eurchf: TwoWay;
}

/**
 * 'sellDirectBuyCross': sell EUR for CHF directly, buy it back via USD (direct EUR/CHF too high).
 * 'buyDirectSellCross': sell EUR via USD into CHF, buy it back directly (direct EUR/CHF too low).
 */
export type TriangularDirection = 'none' | 'sellDirectBuyCross' | 'buyDirectSellCross';

/**
 * One trade of the round trip; `side` refers to the base currency of `pair`. `pay` and
 * `receive` amounts are positive magnitudes (unlike the signed cash-and-carry steps).
 */
export interface TriangularLeg {
  pair: 'EUR/USD' | 'USD/CHF' | 'EUR/CHF';
  side: 'buy' | 'sell';
  /** Rate dealt: the bid when selling the base, the ask when buying it. */
  rate: number;
  pay: { ccy: string; amount: number };
  receive: { ccy: string; amount: number };
}

/** Result of {@link triangularArbitrage}. */
export interface TriangularResult {
  /** Implied EUR/CHF from mids: EUR/USD · USD/CHF. */
  implied: number;
  /** Implied bid EUR/USD bid · USD/CHF bid (selling EUR via USD). */
  impliedBid: number;
  /** Implied ask EUR/USD ask · USD/CHF ask (buying EUR via USD). */
  impliedAsk: number;
  /** (mid EUR/CHF − implied) / pip, signed. */
  gapPips: number;
  /**
   * Exploitable edge after spreads in pips: max(EURCHF bid − impliedAsk, impliedBid − EURCHF ask)
   * / pip. ≤ 0 means no arbitrage. Equals |gapPips| without bid/ask.
   */
  edgePips: number;
  direction: TriangularDirection;
  /** Profit in EUR of a round trip that starts and ends with EUR 1’000’000 (0 if 'none'). */
  profitPerEurMillion: number;
  /** The three trades of the round trip (empty if 'none'). */
  legs: TriangularLeg[];
}

function twoWay(q: TwoWay, name: string): { bid: number; ask: number; mid: number } {
  if (typeof q === 'number') return { bid: q, ask: q, mid: q };
  if (q.bid > q.ask) throw new RangeError(`${name}: bid ${q.bid} above ask ${q.ask}`);
  return { bid: q.bid, ask: q.ask, mid: (q.bid + q.ask) / 2 };
}

/**
 * Triangular arbitrage EUR/USD × USD/CHF against EUR/CHF, no fees.
 * Implied cross: EUR/CHF = EUR/USD · USD/CHF; with two-way prices the cross bid is
 * bid · bid and the cross ask is ask · ask (you always deal on the worse side).
 * - EUR/CHF bid > impliedAsk → 'sellDirectBuyCross', profit = 1e6 · (EURCHF bid / impliedAsk − 1) EUR.
 * - EUR/CHF ask < impliedBid → 'buyDirectSellCross', profit = 1e6 · (impliedBid / EURCHF ask − 1) EUR.
 * Throws RangeError if a bid is above its ask.
 */
export function triangularArbitrage(input: TriangularInput): TriangularResult {
  const eu = twoWay(input.eurusd, 'eurusd');
  const uc = twoWay(input.usdchf, 'usdchf');
  const ec = twoWay(input.eurchf, 'eurchf');
  const pip = pipSize('EUR/CHF');
  const implied = eu.mid * uc.mid;
  const impliedBid = eu.bid * uc.bid;
  const impliedAsk = eu.ask * uc.ask;
  const edgeSellDirect = ec.bid - impliedAsk;
  const edgeBuyDirect = impliedBid - ec.ask;
  const common = {
    implied,
    impliedBid,
    impliedAsk,
    gapPips: (ec.mid - implied) / pip,
    edgePips: Math.max(edgeSellDirect, edgeBuyDirect) / pip,
  };
  const M = 1_000_000;

  if (edgeSellDirect > EPS) {
    const chf = M * ec.bid;
    const usd = chf / uc.ask;
    const eur = usd / eu.ask;
    return {
      ...common,
      direction: 'sellDirectBuyCross',
      profitPerEurMillion: eur - M,
      legs: [
        leg('EUR/CHF', 'sell', ec.bid, 'EUR', M, 'CHF', chf),
        leg('USD/CHF', 'buy', uc.ask, 'CHF', chf, 'USD', usd),
        leg('EUR/USD', 'buy', eu.ask, 'USD', usd, 'EUR', eur),
      ],
    };
  }
  if (edgeBuyDirect > EPS) {
    const usd = M * eu.bid;
    const chf = usd * uc.bid;
    const eur = chf / ec.ask;
    return {
      ...common,
      direction: 'buyDirectSellCross',
      profitPerEurMillion: eur - M,
      legs: [
        leg('EUR/USD', 'sell', eu.bid, 'EUR', M, 'USD', usd),
        leg('USD/CHF', 'sell', uc.bid, 'USD', usd, 'CHF', chf),
        leg('EUR/CHF', 'buy', ec.ask, 'CHF', chf, 'EUR', eur),
      ],
    };
  }
  return { ...common, direction: 'none', profitPerEurMillion: 0, legs: [] };
}

function leg(
  pair: TriangularLeg['pair'],
  side: TriangularLeg['side'],
  rate: number,
  payCcy: string,
  payAmount: number,
  receiveCcy: string,
  receiveAmount: number,
): TriangularLeg {
  return {
    pair,
    side,
    rate,
    pay: { ccy: payCcy, amount: payAmount },
    receive: { ccy: receiveCcy, amount: receiveAmount },
  };
}
