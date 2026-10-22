/**
 * Dual currency investment (DCI) in CHF, closed form (Garman-Kohlhagen). Pure, no DOM.
 *
 * Building blocks: CHF deposit + sold USD put / CHF call with strike K on the USD amount
 * capital / K. The option premium is paid to the client as extra interest.
 *
 * At maturity (one fixing S_T):
 * - S_T ≥ K: the client gets the CHF capital plus the enhanced interest.
 * - S_T < K: the capital is converted at K into USD (capital / K USD), plus the interest
 *   (paid in CHF; with convertInterest = true it is converted as well).
 *
 * Time and rates: the option uses T = days / 365 and the continuous rates of the market.
 * The interest is quoted as a simple rate p.a. on the money-market basis (MC_CONFIG: ACT/360):
 *   τ = days / basis,  money-market rate = (e^(rd · T) − 1) / τ  (same growth as rd),
 *   premium yield = premium · e^(rd · T) / capital / τ  (premium received today, invested),
 *   yield p.a. = money-market rate + premium yield.
 * With these definitions the DCI is fair: PV = capital (tested).
 */
import { gkPrice } from '../vanilla';
import { DEFAULT_MARKET, MC_CONFIG, type Market } from './products';

/** A dual currency investment in CHF (quote currency). */
export interface DualCurrencyProduct {
  kind: 'dualCurrency';
  /** Invested CHF amount. */
  capital: number;
  /** Calendar days to maturity. */
  days: number;
  /** Conversion strike (CHF per USD). */
  strike: number;
  /** Money-market day basis of the interest: 360 (ACT/360) or 365. */
  interestBasis: 360 | 365;
  /** Convert the interest as well when S_T < K (default false: only the capital). */
  convertInterest: boolean;
}

/** Terms of a DCI on a market. All amounts in CHF unless stated. */
export interface DualCurrencyQuote {
  /** Option time T = days / 365. */
  T: number;
  /** Interest year fraction τ = days / interestBasis. */
  tau: number;
  strike: number;
  /** USD amount the client receives on conversion. */
  conversionAmountBase: number;
  /** Price of one USD put / CHF call (CHF per USD). */
  putPerUnit: number;
  /** Premium received today (CHF) for the sold option on conversionAmountBase. */
  premium: number;
  /** Money-market rate p.a. (simple, basis interestBasis). */
  moneyMarketRate: number;
  /** Annualised premium p.a. (simple, basis interestBasis). */
  premiumYield: number;
  /** Enhanced yield p.a. = moneyMarketRate + premiumYield. */
  yieldPa: number;
  /** Interest paid at maturity (CHF). */
  interest: number;
  /**
   * Break-even fixing: below it the client ends with less than a plain deposit would give
   * (value of the converted amount at S_T plus interest < deposit at the money-market rate).
   */
  breakEven: number;
  /** PV of the DCI to the client (= capital when fair). */
  pv: number;
}

/** Builds the default DCI of §8.7 (CHF 100’000, 30 days, K = spot · 0.99) with overrides. */
export function buildDualCurrency(
  market: Market = DEFAULT_MARKET,
  overrides: Partial<Omit<DualCurrencyProduct, 'kind'>> = {},
): DualCurrencyProduct {
  const d = MC_CONFIG.products.dualCurrency;
  return {
    kind: 'dualCurrency',
    capital: d.capital,
    days: d.days,
    strike: market.spot * d.strikeFactor,
    interestBasis: d.interestBasis,
    convertInterest: d.convertInterest,
    ...overrides,
  };
}

/** Closed-form terms of a DCI (premium, enhanced yield, break-even). */
export function dualCurrencyQuote(
  product: DualCurrencyProduct,
  market: Market = DEFAULT_MARKET,
): DualCurrencyQuote {
  const { capital: C, days, strike: K, interestBasis } = product;
  if (!(C > 0 && K > 0 && days > 0)) {
    throw new RangeError('dualCurrencyQuote: capital, strike and days must be positive');
  }
  const T = days / MC_CONFIG.conventions.daysPerYear;
  const tau = days / interestBasis;
  const growth = Math.exp(market.rd * T);
  const put = gkPrice(market.spot, K, T, market.vol, market.rd, market.rf, 'put');
  const mmInterest = C * (growth - 1);
  // Converted USD amount and premium; with convertInterest the interest is converted too, so
  // the notional depends on the interest: I = mm + (C + I)/K · put · growth, solved for I.
  let interest: number;
  let conversionAmountBase: number;
  if (product.convertInterest) {
    const k = (put * growth) / K;
    interest = (mmInterest + C * k) / (1 - k);
    conversionAmountBase = (C + interest) / K;
  } else {
    conversionAmountBase = C / K;
    interest = mmInterest + conversionAmountBase * put * growth;
  }
  const premium = conversionAmountBase * put;
  const moneyMarketRate = (growth - 1) / tau;
  const premiumYield = (premium * growth) / C / tau;
  // Converted: value C·S/K (+ I·S/K if interest converted) + I (if not); deposit: C · growth.
  const breakEven = product.convertInterest
    ? (K * C * growth) / (C + interest)
    : (K * (C * growth - interest)) / C;
  const df = 1 / growth;
  const pv = df * (C + interest) - conversionAmountBase * put;
  return {
    T,
    tau,
    strike: K,
    conversionAmountBase,
    putPerUnit: put,
    premium,
    moneyMarketRate,
    premiumYield,
    yieldPa: moneyMarketRate + premiumYield,
    interest,
    breakEven,
    pv,
  };
}

/** Outcome of a DCI at maturity for a fixing S_T. */
export interface DualCurrencyOutcome {
  /** True if the capital was converted into USD (S_T < K). */
  converted: boolean;
  /** USD received. */
  amountBase: number;
  /** CHF received. */
  amountQuote: number;
  /** Total value in CHF at S_T. */
  valueQuote: number;
  /** Value minus a plain deposit at the money-market rate (CHF; negative = worse). */
  vsDepositQuote: number;
}

/** What the client receives at maturity for the fixing S_T. */
export function dualCurrencyPayoff(
  ST: number,
  product: DualCurrencyProduct,
  quote: DualCurrencyQuote,
): DualCurrencyOutcome {
  const C = product.capital;
  const converted = ST < product.strike;
  let amountBase = 0;
  let amountQuote = C + quote.interest;
  if (converted) {
    amountBase = quote.conversionAmountBase;
    amountQuote = product.convertInterest ? 0 : quote.interest;
  }
  const valueQuote = amountBase * ST + amountQuote;
  const deposit = C * (1 + quote.moneyMarketRate * quote.tau);
  return { converted, amountBase, amountQuote, valueQuote, vsDepositQuote: valueQuote - deposit };
}
