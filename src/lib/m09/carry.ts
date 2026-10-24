/**
 * CarryCushion (module 09, section 4): three yield ideas on one axis. Pure, no DOM.
 *
 * A CHF investor takes an exposure of N USD for n months and compares the result at maturity
 * with a CHF deposit of the same amount (all amounts in CHF, rates in CHF per USD):
 *
 *   1 carry     buy N · DF_f USD at spot S, deposit them at the USD rate → N USD at T.
 *               Result vs the deposit: N · (S_T − F). Break-even = the forward F.
 *   2 discount  carry + a sold USD call at the cap K (discount certificate: pays min(S_T, K),
 *               price S · DF_f − C(K)). Result: N · (min(S_T, K) − K + P(K) / DF_d).
 *   3 dci       CHF deposit of K + a sold USD put at K (dual currency): the same result.
 *               Put-call parity, C − P = S · DF_f − K · DF_d, makes 2 and 3 identical.
 *
 * Money market Act/360 with simple rates: DF_d = 1 / (1 + rd · τ), DF_f = 1 / (1 + rf · τ),
 * τ = days / 360, F = S · DF_f / DF_d. The options are priced with Garman-Kohlhagen on the same
 * discount factors (continuous-equivalent rates −ln(DF) / T), so carry, forward and options
 * share one forward. Option time T = months / 12. Convention: rd = CHF (quote), rf = USD (base).
 * In the model every product is fair: the expected result against the deposit is zero.
 * Settings in M09_CONFIG.carry and M09_CONFIG.yieldProducts (D-22).
 */
import { EXAMPLE } from '@/lib/fx/example';
import { gkPrice } from '@/lib/fx/vanilla';
import { normCdf } from '@/lib/fx/normal';
import { M09_CONFIG, PIP } from './config';

const C = M09_CONFIG.carry;

export type YieldStep = 'carry' | 'discount' | 'dci';
export const YIELD_STEPS: readonly YieldStep[] = ['carry', 'discount', 'dci'];

export function isYieldStep(x: unknown): x is YieldStep {
  return typeof x === 'string' && (YIELD_STEPS as readonly string[]).includes(x);
}

export interface CarryInputs {
  /** Tenor in months (money market: months · 30 days, option model: months / 12). */
  months: number;
  /** USD rate, simple p.a. (decimal). */
  usdRate: number;
  /** Implied vol (decimal). */
  vol: number;
  /** Strike / cap below spot (fraction, 0.01 = 1 %). */
  strikeBelow: number;
}

/** Inputs of the running example (3 months, USD 3.5 %, vol 8 %, strike 1 % below spot). */
export const CARRY_DEFAULTS: CarryInputs = {
  months: C.months.initial,
  usdRate: EXAMPLE.rf,
  vol: EXAMPLE.vol,
  strikeBelow: M09_CONFIG.yieldProducts.strikeBelow,
};

export interface CarryView {
  inputs: CarryInputs;
  spot: number;
  /** CHF rate (simple p.a.). */
  rd: number;
  /** USD rate (simple p.a.). */
  rf: number;
  vol: number;
  notional: number;
  days: number;
  /** Money-market year fraction days / 360. */
  tau: number;
  /** Option time months / 12. */
  T: number;
  dfd: number;
  dff: number;
  /** Money-market forward S · DF_f / DF_d. */
  forward: number;
  /** F − S in pips (negative: the dollar trades at a forward discount). */
  forwardPointsPips: number;
  /** Strike of the sold option (cap of the certificate), on the 1-pip grid. */
  strike: number;
  /** USD call and USD put at the strike, CHF per USD, paid today. */
  call: number;
  put: number;
  /** Price of one discount certificate today, S · DF_f − C(K) = K · DF_d − P(K). */
  certPrice: number;
  /** Discount of the certificate against spot, (S − price) / S. */
  certDiscount: number;
  /** Dual currency yield p.a.: money-market rate + premium carried to maturity / (K · τ). */
  dciYieldPa: number;
  /** CHF deposit rate p.a. (the benchmark). */
  depositRate: number;
  /** Break-even S_T per step (result against the deposit is zero). */
  breakEven: Record<YieldStep, number>;
  /** Largest result per USD (Infinity for carry: no cap). */
  maxGainPerUsd: Record<YieldStep, number>;
  /** CHF invested per USD of exposure: carry S · DF_f, certificate price, DCI capital K. */
  investedPerUsd: Record<YieldStep, number>;
  /** Typical move over the tenor, S · σ · √T (one standard deviation, approximately). */
  typicalMove: number;
  /** 1σ band of S_T in the model: F · exp(−½σ²T ∓ σ√T) (15.9 % and 84.1 % quantiles). */
  sigmaBand: [number, number];
}

const pipRound = (x: number) => Math.round(x / PIP) * PIP;

/** Everything the figure, the matrix and the number registry need for one set of inputs. */
export function carryView(i: CarryInputs = CARRY_DEFAULTS): CarryView {
  const S = M09_CONFIG.market.spot;
  const rd = M09_CONFIG.market.rd;
  const rf = i.usdRate;
  const days = i.months * C.daysPerMonth;
  const tau = days / 360;
  const T = i.months / 12;
  const dfd = 1 / (1 + rd * tau);
  const dff = 1 / (1 + rf * tau);
  const F = (S * dff) / dfd;
  const rdc = -Math.log(dfd) / T;
  const rfc = -Math.log(dff) / T;
  const K = Number(pipRound(S * (1 - i.strikeBelow)).toFixed(4));
  const call = gkPrice(S, K, T, i.vol, rdc, rfc, 'call');
  const put = gkPrice(S, K, T, i.vol, rdc, rfc, 'put');
  const certPrice = S * dff - call;
  const premiumAtT = put / dfd;
  const sq = i.vol * Math.sqrt(T);
  return {
    inputs: i,
    spot: S,
    rd,
    rf,
    vol: i.vol,
    notional: C.notionalBase,
    days,
    tau,
    T,
    dfd,
    dff,
    forward: F,
    forwardPointsPips: (F - S) / PIP,
    strike: K,
    call,
    put,
    certPrice,
    certDiscount: (S - certPrice) / S,
    dciYieldPa: rd + premiumAtT / (K * tau),
    depositRate: rd,
    breakEven: { carry: F, discount: K - premiumAtT, dci: K - premiumAtT },
    maxGainPerUsd: { carry: Infinity, discount: premiumAtT, dci: premiumAtT },
    investedPerUsd: { carry: S * dff, discount: certPrice, dci: K },
    typicalMove: S * sq,
    sigmaBand: [F * Math.exp(-0.5 * sq * sq - sq), F * Math.exp(-0.5 * sq * sq + sq)],
  };
}

/** Result against the CHF deposit per USD of exposure at maturity, CHF per USD. */
export function yieldPnlPerUsd(step: YieldStep, ST: number, v: CarryView): number {
  if (step === 'carry') return ST - v.forward;
  return Math.min(ST, v.strike) - v.strike + v.put / v.dfd;
}

/**
 * Building blocks per USD, each against the deposit: long USD with interest (= carry), the sold
 * call and the sold put with their premiums carried to maturity. long + shortCall = discount
 * certificate; deposit (0) + shortPut = dual currency.
 */
export type YieldBlock = 'long' | 'shortCall' | 'shortPut';

export function yieldBlockPerUsd(b: YieldBlock, ST: number, v: CarryView): number {
  if (b === 'long') return ST - v.forward;
  if (b === 'shortCall') return v.call / v.dfd - Math.max(ST - v.strike, 0);
  return v.put / v.dfd - Math.max(v.strike - ST, 0);
}

/** Result against the CHF deposit on the whole exposure (N USD), in CHF. */
export function yieldPnl(step: YieldStep, ST: number, v: CarryView): number {
  return yieldPnlPerUsd(step, ST, v) * v.notional;
}

/** Results in CHF on a grid of S_T. */
export function yieldCurve(step: YieldStep, xs: readonly number[], v: CarryView): number[] {
  return xs.map((x) => yieldPnl(step, x, v));
}

/** Annualised return against the amount invested (simple, Act/360) at S_T. */
export function yieldReturnPa(step: YieldStep, ST: number, v: CarryView): number {
  const invested = v.investedPerUsd[step];
  const deposit = invested / v.dfd;
  return v.rd + yieldPnlPerUsd(step, ST, v) / deposit / v.tau;
}

/**
 * Model probability that S_T ends below x (lognormal, mean = forward, risk-neutral; not a
 * forecast): N((ln(x / F) + ½σ²T) / (σ√T)).
 */
export function probBelow(x: number, v: CarryView): number {
  if (!(x > 0)) return 0;
  const sq = v.vol * Math.sqrt(v.T);
  return normCdf((Math.log(x / v.forward) + 0.5 * sq * sq) / sq);
}

/** Model probability of a result below the deposit (S_T below the break-even). */
export function probLoss(step: YieldStep, v: CarryView): number {
  return probBelow(v.breakEven[step], v);
}

/**
 * Expected result against the deposit in the model, per USD: carry E[S_T] − F = 0; the capped
 * products F − C/DF_d − K + P/DF_d = 0 by put-call parity. Closed form, for the tests.
 */
export function expectedPnlPerUsd(step: YieldStep, v: CarryView): number {
  if (step === 'carry') return 0;
  const callAtT = v.call / v.dfd;
  return v.forward - callAtT - v.strike + v.put / v.dfd;
}

/** Cushion: how far S_T can fall from spot before the result turns negative, in pips. */
export function cushionPips(step: YieldStep, v: CarryView): number {
  return (v.spot - v.breakEven[step]) / PIP;
}

/** Chart range of S_T: spot · (1 + xRange). */
export function carryRange(): [number, number] {
  const S = M09_CONFIG.market.spot;
  return [S * (1 + C.xRange[0]), S * (1 + C.xRange[1])];
}

/** S_T snapped to the 5-pip grid and clamped to the chart range. */
export function snapCarryFixing(x: number): number {
  const [lo, hi] = carryRange();
  const snapped = Number((Math.round(x / C.fixingStep) * C.fixingStep).toFixed(6));
  return Math.min(hi, Math.max(lo, snapped));
}

/** S_T shown first (2 % below spot). */
export function initialCarryFixing(): number {
  return snapCarryFixing(M09_CONFIG.market.spot * (1 + C.initialMove));
}

/** Clamps and snaps the slider inputs to their grids. */
export function clampCarryInputs(i: CarryInputs): CarryInputs {
  const snap = (x: number, r: { min: number; max: number; step: number }) =>
    Math.min(r.max, Math.max(r.min, Number((Math.round(x / r.step) * r.step).toFixed(6))));
  return {
    months: snap(i.months, C.months),
    usdRate: snap(i.usdRate, C.usdRate),
    vol: snap(i.vol, C.vol),
    strikeBelow: snap(i.strikeBelow, C.strikeBelow),
  };
}
