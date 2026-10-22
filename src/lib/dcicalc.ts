/**
 * Dual currency investment calculator (DciCalculator island, modules 08 and 09). Pure, no DOM.
 * Wraps the closed-form DCI of src/lib/fx/mc/dci.ts for a CHF deposit with a tenor of 1 to 3
 * months and a conversion strike set below spot:
 *
 *   building blocks: CHF deposit + sold USD put / CHF call with strike K on capital / K USD,
 *   yield p.a. = money-market rate + annualised premium (simple, ACT/360),
 *   at maturity: S_T ≥ K → CHF capital + interest; S_T < K → capital / K USD + interest (CHF).
 *
 * Uncertain choices live in DCI_CONFIG (D-22).
 */
import { d1d2 } from '@/lib/fx/vanilla';
import { normCdf } from '@/lib/fx/normal';
import { forwardContinuous } from '@/lib/fx/forward';
import {
  buildDualCurrency,
  dualCurrencyPayoff,
  dualCurrencyQuote,
  type DualCurrencyOutcome,
  type DualCurrencyProduct,
  type DualCurrencyQuote,
} from '@/lib/fx/mc/dci';
import { DEFAULT_MARKET, MC_CONFIG, PIP, level, type Market } from '@/lib/fx/mc/products';

const DCI = MC_CONFIG.products.dualCurrency;

/** Calculator settings (D-22). Defaults follow §8.7 (MC_CONFIG.products.dualCurrency). */
export const DCI_CONFIG = {
  /** Tenors offered, in months (§10: 1 to 3 months). */
  months: [1, 2, 3] as const,
  /** CHF deposit slider. */
  capital: { min: 10_000, max: 1_000_000, step: 10_000, initial: DCI.capital },
  /** Strike distance below spot (fraction), slider. Choice: 0 to 3 % in 0.25 % steps. */
  distance: { min: 0, max: 0.03, step: 0.0025, initial: Number((1 - DCI.strikeFactor).toFixed(6)) },
  /** Chart range of the fixing at maturity, relative to spot. Choice. */
  xRange: [-0.06, 0.04] as const,
  /** Fixing slider step (CHF per USD). */
  fixingStep: 0.0005,
} as const;

export type DciMonths = (typeof DCI_CONFIG.months)[number];

/** Calendar days of a tenor in months: round(m · 365 / 12) → 30, 61, 91 (as the fixings). */
export function tenorDays(months: number): number {
  const c = MC_CONFIG.conventions;
  return Math.round((months * c.daysPerYear) / c.monthsPerYear);
}

/** Everything the calculator shows for one set of inputs. */
export interface DciView {
  months: number;
  days: number;
  capital: number;
  distance: number;
  product: DualCurrencyProduct;
  quote: DualCurrencyQuote;
  /** Forward to maturity (continuous, T = days / 365). */
  forward: number;
  /** Strike minus forward in pips (− = strike below the forward). */
  strikeVsForwardPips: number;
  /** Strike minus spot in pips. */
  strikeVsSpotPips: number;
  /** Plain deposit at the money-market rate: interest and value at maturity (CHF). */
  depositInterest: number;
  depositValue: number;
  /** Extra interest of the DCI over the plain deposit (CHF). */
  extraInterest: number;
  /** Risk-neutral probability of conversion, P(S_T < K) = N(−d2) (model, not a forecast). */
  pConversion: number;
}

/** Builds the view for capital (CHF), tenor (months) and strike distance below spot. */
export function dciView(
  capital: number,
  months: number,
  distance: number,
  market: Market = DEFAULT_MARKET,
): DciView {
  const days = tenorDays(months);
  const strike = level(market.spot * (1 - distance));
  const product = buildDualCurrency(market, { capital, days, strike });
  const quote = dualCurrencyQuote(product, market);
  const T = quote.T;
  const forward = forwardContinuous(market.spot, market.rd, market.rf, T);
  const depositInterest = capital * quote.moneyMarketRate * quote.tau;
  const { d2 } = d1d2(market.spot, strike, T, market.vol, market.rd, market.rf);
  return {
    months,
    days,
    capital,
    distance,
    product,
    quote,
    forward,
    strikeVsForwardPips: (strike - forward) / PIP,
    strikeVsSpotPips: (strike - market.spot) / PIP,
    depositInterest,
    depositValue: capital + depositInterest,
    extraInterest: quote.interest - depositInterest,
    pConversion: normCdf(-d2),
  };
}

/** What the client receives at maturity for the fixing S_T (see dualCurrencyPayoff). */
export function dciOutcome(view: DciView, ST: number): DualCurrencyOutcome {
  return dualCurrencyPayoff(ST, view.product, view.quote);
}

/** Value at maturity in CHF of the DCI for the fixing S_T. */
export function dciValueAt(view: DciView, ST: number): number {
  return dciOutcome(view, ST).valueQuote;
}

/** Chart range [lo, hi] of S_T for the view's market. */
export function dciRange(market: Market = DEFAULT_MARKET): [number, number] {
  return [market.spot * (1 + DCI_CONFIG.xRange[0]), market.spot * (1 + DCI_CONFIG.xRange[1])];
}

/**
 * Value curve at maturity on [x0, x1]: points of the DCI (kink at K, with the step to the
 * converted value just below K) and of the plain deposit (flat).
 */
export function dciCurve(
  view: DciView,
  x0: number,
  x1: number,
  n = 80,
): { dci: Array<[number, number]>; deposit: Array<[number, number]> } {
  const xs = new Set<number>();
  for (let i = 0; i <= n; i++) xs.add(x0 + ((x1 - x0) * i) / n);
  const K = view.product.strike;
  if (K > x0 && K < x1) {
    xs.add(K);
    xs.add(K - (x1 - x0) * 1e-6);
  }
  const sorted = [...xs].sort((a, b) => a - b);
  return {
    dci: sorted.map((x) => [x, dciValueAt(view, x)]),
    deposit: [
      [x0, view.depositValue],
      [x1, view.depositValue],
    ],
  };
}
