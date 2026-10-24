/**
 * The six Greeks of a European FX option (Garman-Kohlhagen), their numerical check and the
 * gamma-theta trade-off of a delta-hedged option.
 *
 * Convention: pair Base/Quote (e.g. USD/CHF), rd = continuously compounded rate of the
 * quote currency (domestic, CHF), rf = rate of the base currency (foreign, USD).
 * Prices in quote currency per 1 unit of base currency. T in years (days/365 or weeks/52).
 * Unless stated otherwise, Greeks are raw derivatives: per 1.00 change of the input
 * (vega per 1.00 = 100 vol points, rho per 1.00 = 100 %), theta per year.
 */
import { normCdf, normPdf } from './normal';
import { d1d2, gkPrice, type OptionType } from './vanilla';

/** One pip of USD/CHF (and most pairs): 0.0001. JPY pairs use 0.01. */
export const PIP = 1e-4;
/** One calendar day in the option model, in years. */
export const DAY = 1 / 365;

export interface Greeks {
  /** Garman-Kohlhagen price, quote currency per 1 unit base. */
  price: number;
  /** Spot delta ∂V/∂S: call e^(−rf T)·N(d1), put −e^(−rf T)·N(−d1). */
  delta: number;
  /**
   * Forward delta: call N(d1), put −N(−d1). The delta of the undiscounted (forward-value)
   * price with respect to F, i.e. the number of forwards that hedge the option. Market
   * convention for delta quotes (25Δ, 10Δ); equals spot delta · e^(rf T).
   */
  deltaFwd: number;
  /** Gamma ∂²V/∂S² = e^(−rf T)·φ(d1) / (S·σ·√T), same for call and put. */
  gamma: number;
  /** Vega ∂V/∂σ = S·e^(−rf T)·φ(d1)·√T per 1.00 vol, same for call and put. */
  vega: number;
  /** Theta ∂V/∂t (time passing) per year, analytic. */
  theta: number;
  /** Analytic theta per calendar day: theta / 365. */
  thetaDay: number;
  /** Rho domestic ∂V/∂rd per 1.00: call K·T·e^(−rd T)·N(d2), put −K·T·e^(−rd T)·N(−d2). */
  rhoD: number;
  /** Rho foreign ∂V/∂rf per 1.00: call −S·T·e^(−rf T)·N(d1), put S·T·e^(−rf T)·N(−d1). */
  rhoF: number;
}

/**
 * The six Greeks (plus price and forward delta) in closed form.
 *
 * Call: Δ = e^(−rf T) N(d1); Γ = e^(−rf T) φ(d1)/(S σ √T); ν = S e^(−rf T) φ(d1) √T;
 * Θ = −S e^(−rf T) φ(d1) σ/(2√T) + rf S e^(−rf T) N(d1) − rd K e^(−rd T) N(d2);
 * ρ_d = K T e^(−rd T) N(d2); ρ_f = −S T e^(−rf T) N(d1).
 * Put: replace N(d1), N(d2) by N(−d1), N(−d2) and flip the sign of every term with them.
 *
 * Degenerate inputs: T ≤ 0 gives the payoff with a step delta (½ exactly at the strike) and
 * all other Greeks 0; vol ≤ 0 gives the deterministic limit (discounted forward intrinsic),
 * with gamma and vega 0.
 */
export function greeks(
  S: number,
  K: number,
  T: number,
  vol: number,
  rd: number,
  rf: number,
  type: OptionType,
): Greeks {
  const price = gkPrice(S, K, T, vol, rd, rf, type);
  const sign = type === 'call' ? 1 : -1;
  if (T <= 0) {
    const m = itmWeight(S, K, sign);
    const step = m === 0 ? 0 : sign * m;
    return {
      price,
      delta: step,
      deltaFwd: step,
      gamma: 0,
      vega: 0,
      theta: 0,
      thetaDay: 0,
      rhoD: 0,
      rhoF: 0,
    };
  }
  const dff = Math.exp(-rf * T);
  const dfd = Math.exp(-rd * T);
  const sqrtT = Math.sqrt(T);
  // n1 = N(±d1), n2 = N(±d2) (+ for calls, − for puts), phi = φ(d1).
  let n1: number;
  let n2: number;
  let phi: number;
  if (vol > 0) {
    const { d1, d2 } = d1d2(S, K, T, vol, rd, rf);
    n1 = normCdf(sign * d1);
    n2 = normCdf(sign * d2);
    phi = normPdf(d1);
  } else {
    n1 = n2 = itmWeight(S * Math.exp((rd - rf) * T), K, sign);
    phi = 0;
  }
  const theta =
    -(S * dff * phi * vol) / (2 * sqrtT) + sign * (rf * S * dff * n1 - rd * K * dfd * n2);
  return {
    price,
    delta: sign * dff * n1,
    deltaFwd: sign * n1,
    gamma: vol > 0 ? (dff * phi) / (S * vol * sqrtT) : 0,
    vega: S * dff * phi * sqrtT,
    theta,
    thetaDay: theta / 365,
    rhoD: sign * K * T * dfd * n2,
    rhoF: -sign * S * T * dff * n1,
  };
}

/** 1 if in the money against x (spot or forward), 0 if out, ½ exactly at the strike. */
function itmWeight(x: number, K: number, sign: number): number {
  if (x === K) return 0.5;
  return sign * (x - K) > 0 ? 1 : 0;
}

/**
 * Theta as a one-day difference V(T − 1/365) − V(T), quote currency per 1 unit base per
 * calendar day. This is the number the Greeks lab shows. If less than a day is left, the
 * option is valued at expiry (payoff against the spot).
 */
export function thetaOneDay(
  S: number,
  K: number,
  T: number,
  vol: number,
  rd: number,
  rf: number,
  type: OptionType,
): number {
  return (
    gkPrice(S, K, Math.max(T - DAY, 0), vol, rd, rf, type) - gkPrice(S, K, T, vol, rd, rf, type)
  );
}

/**
 * Gamma share of theta per calendar day: Θ_Γ = −½ · σ² · S² · Γ / 365, quote currency per
 * 1 unit base. What a delta-hedged long option pays per day for its gamma.
 */
export function thetaGammaShare(S: number, vol: number, gamma: number): number {
  return (-0.5 * vol * vol * S * S * gamma) / 365;
}

export interface ThetaSplit {
  /** Gamma share Θ_Γ = −½ σ² S² Γ / 365 per calendar day. */
  gamma: number;
  /** Rate carry (rd · V − (rd − rf) · S · Δ) / 365 per calendar day. */
  carry: number;
  /** Analytic theta per calendar day = gamma + carry. */
  total: number;
}

/**
 * Splits the analytic daily theta with the Garman-Kohlhagen PDE
 * Θ + ½σ²S²Γ + (rd − rf)·S·Δ − rd·V = 0 into the gamma share −½σ²S²Γ and the rate carry
 * rd·V − (rd − rf)·S·Δ (call: rf S e^(−rf T) N(d1) − rd K e^(−rd T) N(d2)).
 * All per calendar day, quote currency per 1 unit base.
 */
export function thetaSplit(
  S: number,
  K: number,
  T: number,
  vol: number,
  rd: number,
  rf: number,
  type: OptionType,
): ThetaSplit {
  const g = greeks(S, K, T, vol, rd, rf, type);
  const gamma = thetaGammaShare(S, vol, g.gamma);
  const carry = (rd * g.price - (rd - rf) * S * g.delta) / 365;
  return { gamma, carry, total: gamma + carry };
}

/**
 * Break-even move of a delta-hedged option over dt (default one calendar day):
 * |ΔS| = σ · S · √dt, in price units (× 1e4 for pips). Larger moves earn more on gamma
 * than theta costs, smaller ones less.
 */
export function breakEvenMove(S: number, vol: number, dt = DAY): number {
  return vol * S * Math.sqrt(dt);
}

/**
 * Approximate P&L of a delta-hedged option over dt (years) after a spot move dS:
 * ½ · Γ · [(dS)² − σ² · S² · dt], quote currency per 1 unit base. Zero at the break-even move.
 */
export function deltaGammaPnl(
  gamma: number,
  S: number,
  vol: number,
  dS: number,
  dt: number,
): number {
  return 0.5 * gamma * (dS * dS - vol * vol * S * S * dt);
}

export interface NumericGreeks {
  /** [V(S + h) − V(S − h)] / 2h. */
  delta: number;
  /** [Δ(S + h) − Δ(S − h)] / 2h from the analytic spot delta (as in the lab). */
  gamma: number;
  /** [V(σ + 1e-4) − V(σ − 1e-4)] / 2e-4, per 1.00 vol. */
  vega: number;
  /** −[V(T + 1e-4) − V(T − 1e-4)] / 2e-4, per year. */
  theta: number;
  /** One-day difference V(T − 1/365) − V(T) (see thetaOneDay). */
  thetaDay: number;
  /** [V(rd + 1e-4) − V(rd − 1e-4)] / 2e-4, per 1.00. */
  rhoD: number;
  /** [V(rf + 1e-4) − V(rf − 1e-4)] / 2e-4, per 1.00. */
  rhoF: number;
}

/**
 * Central finite differences of the Garman-Kohlhagen price: the "numerischer Check" of the
 * lab. Spot step h (default 1 pip = 1e-4, quote currency per 1 unit base); vol, rate and
 * time steps 1e-4 (shrunk to half of vol or T if those are smaller). Same units as greeks().
 */
export function numericGreeks(
  S: number,
  K: number,
  T: number,
  vol: number,
  rd: number,
  rf: number,
  type: OptionType,
  h = PIP,
): NumericGreeks {
  const V = (s: number, t: number, v: number, d: number, f: number): number =>
    gkPrice(s, K, t, v, d, f, type);
  const D = (s: number): number => greeks(s, K, T, vol, rd, rf, type).delta;
  const hv = Math.min(1e-4, vol / 2);
  const hr = 1e-4;
  const ht = Math.min(1e-4, T / 2);
  return {
    delta: (V(S + h, T, vol, rd, rf) - V(S - h, T, vol, rd, rf)) / (2 * h),
    gamma: (D(S + h) - D(S - h)) / (2 * h),
    vega: (V(S, T, vol + hv, rd, rf) - V(S, T, vol - hv, rd, rf)) / (2 * hv),
    theta: -(V(S, T + ht, vol, rd, rf) - V(S, T - ht, vol, rd, rf)) / (2 * ht),
    thetaDay: thetaOneDay(S, K, T, vol, rd, rf, type),
    rhoD: (V(S, T, vol, rd + hr, rf) - V(S, T, vol, rd - hr, rf)) / (2 * hr),
    rhoF: (V(S, T, vol, rd, rf + hr) - V(S, T, vol, rd, rf - hr)) / (2 * hr),
  };
}

/**
 * Second-order Greeks for the desk outlook, same for call and put (T > 0, vol > 0):
 * vanna ∂Δ/∂σ = ∂ν/∂S = −e^(−rf T)·φ(d1)·d2/σ (spot delta per 1.00 vol);
 * volga ∂ν/∂σ = ν·d1·d2/σ (quote currency per 1 unit base per 1.00 vol²).
 */
export function vannaVolga(
  S: number,
  K: number,
  T: number,
  vol: number,
  rd: number,
  rf: number,
): { vanna: number; volga: number } {
  const { d1, d2 } = d1d2(S, K, T, vol, rd, rf);
  const dffPhi = Math.exp(-rf * T) * normPdf(d1);
  const vega = S * dffPhi * Math.sqrt(T);
  return { vanna: (-dffPhi * d2) / vol, volga: (vega * d1 * d2) / vol };
}

/**
 * Premium-adjusted spot delta (premium paid in base currency): Δ − V/S.
 * Closed form call K·e^(−rd T)·N(d2)/S, put −K·e^(−rd T)·N(−d2)/S. Units as spot delta.
 */
export function premiumAdjustedDelta(
  S: number,
  K: number,
  T: number,
  vol: number,
  rd: number,
  rf: number,
  type: OptionType,
): number {
  const g = greeks(S, K, T, vol, rd, rf, type);
  return g.delta - g.price / S;
}

export interface GreeksOnNotional {
  /** Premium in quote currency (CHF): price · N. */
  price: number;
  /** Premium in pips: price / pip. */
  pricePips: number;
  /** Spot delta hedge in base currency (USD): Δ · N. */
  delta: number;
  /** Forward delta hedge in base currency (USD): Δ_F · N. */
  deltaFwd: number;
  /** Change of delta per big figure (100 pips): Γ · 100 · pip, e.g. +0.124. */
  gammaPerBigFigure: number;
  /** Change of the base-currency delta per big figure: Γ · 100 · pip · N (USD). */
  gamma: number;
  /** Quote currency per vol point (+1 %): ν / 100 · N. */
  vega: number;
  /** Analytic theta in quote currency per calendar day: Θ/365 · N. The lab shows thetaOneDay · N. */
  theta: number;
  /** Quote currency per +1 % quote-currency rate: ρ_d / 100 · N. */
  rhoD: number;
  /** Quote currency per +1 % base-currency rate: ρ_f / 100 · N. */
  rhoF: number;
}

/**
 * Scales Greeks to a notional N in base currency (e.g. USD 1 million) for the UI: vega per
 * vol point, rho per 1 %, theta per calendar day, premium in quote currency and in pips.
 */
export function perNotional(g: Greeks, N: number, pip = PIP): GreeksOnNotional {
  const bigFigure = 100 * pip;
  return {
    price: g.price * N,
    pricePips: g.price / pip,
    delta: g.delta * N,
    deltaFwd: g.deltaFwd * N,
    gammaPerBigFigure: g.gamma * bigFigure,
    gamma: g.gamma * bigFigure * N,
    vega: (g.vega / 100) * N,
    theta: g.thetaDay * N,
    rhoD: (g.rhoD / 100) * N,
    rhoF: (g.rhoF / 100) * N,
  };
}
