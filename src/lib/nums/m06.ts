/**
 * Numbers of module 06 (Combos & Vol Smile) for <Num of="m06.…" />. Everything is computed from
 * the running example (src/lib/fx/example.ts, EXAMPLE_SMILE) with the calculation core and the
 * payoff builder templates (src/lib/payoff.ts); nothing is typed in. Scenario rates at expiry and
 * the size of the vol shock are teaching choices, kept in M06_SCENARIOS (D-22).
 *
 * USD/CHF, S = 0.8000, T = 0.25, σ = 8 %, rd = 0 (CHF), rf = 3.5 % (USD), N = USD 1 Mio.
 * Smile (section 4): ATM 8 %, 25Δ RR −1.00, 25Δ BF 0.25 (example values, not market data).
 */
import {
  EXAMPLE as E,
  EXAMPLE_FORWARD as F,
  EXAMPLE_SMILE as Q,
  EXAMPLE_STRIKE as K,
} from '@/lib/fx/example';
import { normInv } from '@/lib/fx/normal';
import { smilePillars, vol25Call, vol25Put, volAtStrike } from '@/lib/fx/smile';
import { gkPrice } from '@/lib/fx/vanilla';
import { pipSize } from '@/lib/format';
import {
  shaperFacts,
  shaperPosition,
  shaperStrikes,
  effectiveRate,
  type ShaperId,
} from '@/lib/hedge-shaper';
import {
  breakEvens,
  buildTemplate,
  expiryExtremes,
  netGreeks,
  netPremium,
  positionValue,
  solveZeroCostStrike,
  templateStrikes,
  type Leg,
  type PayoffMarket,
  type TemplateId,
} from '@/lib/payoff';
import { premiumEffect } from '@/lib/smile-builder';
import type { NumTable } from './types';

const { spot: S, T, vol, rd, rf, notional: N } = E;
const PIP = pipSize(E.pair);
const pips = (x: number) => x / PIP;

/** Teaching scenarios (D-22): rates at expiry and the vol shock of section 3. */
export const M06_SCENARIOS = {
  /** Strong dollar at expiry (the importer's fear). */
  stUp: 0.84,
  /** Weak dollar at expiry. */
  stDown: 0.76,
  /** Parallel shift of the implied vol in section 3 (decimal, +2 vol points). */
  volShock: 0.02,
} as const;
const SC = M06_SCENARIOS;

export const MARKET: PayoffMarket = {
  S,
  T,
  vol,
  rd,
  rf,
  notional: N,
  pair: E.pair,
};
const SMILE_MARKET: PayoffMarket = { ...MARKET, smile: Q };
const growth = Math.exp(rd * T);

/* ---------- section 1: building blocks ---------- */
const shK = shaperStrikes(MARKET);
const sh = (id: ShaperId) => {
  const pos = shaperPosition(id, MARKET);
  return { pos, f: shaperFacts(pos, MARKET, PIP) };
};
const shCall = sh('call');
const shSpread = sh('call-spread');
const shCollar = sh('collar');
const shSeagull = sh('seagull');
const payAt = (id: ShaperId, st: number) =>
  effectiveRate(shaperPosition(id, MARKET).legs, MARKET, st) * N;

/* ---------- sections 2 and 3: payoff builder templates ---------- */
const tpl = (id: TemplateId, m: PayoffMarket = MARKET) => {
  const legs = buildTemplate(id, m).legs;
  return {
    legs,
    prem: netPremium(legs, m),
    greeks: netGreeks(legs, m),
    be: breakEvens(legs, m),
    ext: expiryExtremes(legs, m),
  };
};
const ks = templateStrikes(MARKET);
const cs = tpl('call-spread');
const ps = tpl('put-spread');
const rr = tpl('risk-reversal');
const straddle = tpl('straddle');
const strangle = tpl('strangle');
const fly = tpl('butterfly');
const seagull = tpl('seagull');
const legPips = (l: Leg) => pips(gkPrice(S, l.strike, T, vol, rd, rf, l.kind as 'call' | 'put'));
const shocked: PayoffMarket = { ...MARKET, vol: vol + SC.volShock };
/** P&L today from the vol shock, spot unchanged: value at σ + shock − value at σ (CHF). */
const shockPnl = (legs: readonly Leg[]) =>
  positionValue(legs, shocked) - positionValue(legs, MARKET);
const maxGain = (x: number | 'unlimited') => (x === 'unlimited' ? NaN : x);

/* ---------- section 4: smile ---------- */
const pil = smilePillars(F, T, Q);
const eff = premiumEffect(Q, S, T, rd, rf);
const rrSmileLegs = rr.legs.map((l) => ({ ...l }));
const rrPutSmile = solveZeroCostStrike(rrSmileLegs, 1, SMILE_MARKET) ?? NaN;
const rrOnSmile = netPremium(rr.legs, SMILE_MARKET);
const sqrt2pi = Math.sqrt(2 / Math.PI);

/** Raw values for the quiz file and tests (quote currency per 1 USD unless noted). */
export const M06 = {
  shK,
  shCall: shCall.f,
  shSpread: shSpread.f,
  shCollar: shCollar.f,
  shSeagull: shSeagull.f,
  csK1: cs.legs[0]!.strike,
  csK2: cs.legs[1]!.strike,
  csPips: cs.prem.pips,
  csCallPips: legPips(cs.legs[0]!),
  csSoldPips: legPips(cs.legs[1]!),
  csMaxGain: maxGain(cs.ext.maxGain),
  csBe: cs.be[0]!,
  psPips: ps.prem.pips,
  rrCallK: rr.legs[0]!.strike,
  rrPutK: rr.legs[1]!.strike,
  rrCallPips: legPips(rr.legs[0]!),
  rrPutSmile,
  forward: F,
  stUp: SC.stUp,
  stDown: SC.stDown,
  volShock: SC.volShock,
  dns: ks.dns,
  straddlePips: straddle.prem.pips,
  straddleBe: straddle.be,
  straddleVega: straddle.greeks.vega,
  straddleShock: shockPnl(straddle.legs),
  flyVega: fly.greeks.vega,
  flyShock: shockPnl(fly.legs),
  seagullVega: seagull.greeks.vega,
  seagullShock: shockPnl(seagull.legs),
  strangleVega: strangle.greeks.vega,
  vol25C: vol25Call(Q),
  vol25P: vol25Put(Q),
  atm: Q.atm,
  rr25: Q.rr25,
  bf25: Q.bf25,
} as const;

export const nums: NumTable = {
  // Section 1: building blocks (call at the spot, call sold 300 pips higher, put solved)
  'm06.shCallK': { value: shK.call, kind: 'rate', note: 'Bought USD call at the spot' },
  'm06.shSellCallK': { value: shK.sellCall, kind: 'rate', note: 'Sold USD call, spot + 300 pips' },
  'm06.shCallPips': { value: shCall.f.premiumPips, kind: 'pips' },
  'm06.shCallChf': { value: shCall.f.premiumQuote, kind: 'money' },
  'm06.shCallCap': { value: shCall.f.capRate, kind: 'rate', note: 'K + premium' },
  'm06.shSpreadPips': { value: shSpread.f.premiumPips, kind: 'pips' },
  'm06.shSpreadChf': { value: shSpread.f.premiumQuote, kind: 'money' },
  'm06.shSpreadSavePips': {
    value: shCall.f.premiumPips - shSpread.f.premiumPips,
    kind: 'pips',
    note: 'Premium of the sold call',
  },
  'm06.shSpreadCap': { value: shSpread.f.capRate, kind: 'rate' },
  'm06.shSpreadDiscPips': {
    value: pips(shSpread.f.discountAbove ?? NaN),
    kind: 'pips',
    note: 'Above the sold call: market minus this',
  },
  'm06.shCollarPut': { value: shCollar.pos.putStrike ?? NaN, kind: 'rate' },
  'm06.shSeagullPut': { value: shSeagull.pos.putStrike ?? NaN, kind: 'rate' },
  'm06.shSeagullDiscPips': {
    value: pips(shSeagull.f.discountAbove ?? NaN),
    kind: 'pips',
    digits: 0,
    note: 'Seagull above the sold call: market minus the call spread width',
  },
  'm06.stUp': { value: SC.stUp, kind: 'rate', note: 'Scenario: strong dollar' },
  'm06.stDown': { value: SC.stDown, kind: 'rate', note: 'Scenario: weak dollar' },
  'm06.upUnhedgedChf': { value: SC.stUp * N, kind: 'money' },
  'm06.downUnhedgedChf': { value: SC.stDown * N, kind: 'money' },
  'm06.upCallChf': { value: payAt('call', SC.stUp), kind: 'money' },
  'm06.downCallChf': { value: payAt('call', SC.stDown), kind: 'money' },
  'm06.upSpreadChf': { value: payAt('call-spread', SC.stUp), kind: 'money' },
  'm06.downSpreadChf': { value: payAt('call-spread', SC.stDown), kind: 'money' },
  'm06.upCollarChf': { value: payAt('collar', SC.stUp), kind: 'money' },
  'm06.downCollarChf': { value: payAt('collar', SC.stDown), kind: 'money' },
  'm06.upSeagullChf': { value: payAt('seagull', SC.stUp), kind: 'money' },
  'm06.downSeagullChf': { value: payAt('seagull', SC.stDown), kind: 'money' },
  'm06.downCollarMissChf': {
    value: payAt('collar', SC.stDown) - SC.stDown * N,
    kind: 'money',
    note: 'What the collar costs against unhedged in the weak-dollar scenario',
  },

  // Section 2: spreads and risk reversal (payoff builder templates, flat vol)
  'm06.csK1': { value: cs.legs[0]!.strike, kind: 'rate', note: 'ATMF rounded' },
  'm06.csK2': { value: cs.legs[1]!.strike, kind: 'rate', note: '25Δ call strike, 5-pip grid' },
  'm06.csWidthPips': {
    value: pips(cs.legs[1]!.strike - cs.legs[0]!.strike),
    kind: 'pips',
    digits: 0,
  },
  'm06.csPips': { value: cs.prem.pips, kind: 'pips', digits: 1 },
  'm06.csChf': { value: cs.prem.quote, kind: 'money' },
  'm06.csSoldPips': { value: legPips(cs.legs[1]!), kind: 'pips', digits: 1 },
  'm06.csSavePct': {
    value: legPips(cs.legs[1]!) / legPips(cs.legs[0]!),
    kind: 'pct',
    digits: 0,
    note: 'Share of the call premium financed by the sold call',
  },
  'm06.csMaxGainPips': { value: pips(maxGain(cs.ext.maxGain) / N), kind: 'pips', digits: 1 },
  'm06.csMaxGainChf': { value: maxGain(cs.ext.maxGain), kind: 'money' },
  'm06.csBe': { value: cs.be[0]!, kind: 'rate' },
  'm06.psK1': { value: ps.legs[0]!.strike, kind: 'rate' },
  'm06.psK2': { value: ps.legs[1]!.strike, kind: 'rate', note: '25Δ put strike, 5-pip grid' },
  'm06.psPips': { value: ps.prem.pips, kind: 'pips', digits: 1 },
  'm06.psBe': { value: ps.be[0]!, kind: 'rate' },
  'm06.psMaxGainChf': { value: maxGain(ps.ext.maxGain), kind: 'money' },
  'm06.rrCallK': { value: rr.legs[0]!.strike, kind: 'rate', note: '25Δ USD call' },
  'm06.rrPutK': { value: rr.legs[1]!.strike, kind: 'rate', note: 'Solved for zero cost' },
  'm06.rrCallPips': { value: legPips(rr.legs[0]!), kind: 'pips', digits: 1 },
  'm06.rrCallChf': { value: legPips(rr.legs[0]!) * PIP * N, kind: 'money' },
  'm06.rrBandPips': {
    value: pips(rr.legs[0]!.strike - rr.legs[1]!.strike),
    kind: 'pips',
    digits: 0,
    note: 'Width of the collar band',
  },
  'm06.rrDelta': { value: rr.greeks.delta / N, kind: 'num', digits: 3 },
  'm06.rrVegaChf': { value: rr.greeks.vega, kind: 'money' },
  'm06.callVegaChf': {
    value: netGreeks([rr.legs[0]!], MARKET).vega,
    kind: 'money',
    note: 'Vega of the 25Δ call alone',
  },
  'm06.upRrChf': { value: rr.legs[0]!.strike * N, kind: 'money', note: 'Collar at stUp' },
  'm06.downRrChf': { value: rr.legs[1]!.strike * N, kind: 'money', note: 'Collar at stDown' },
  'm06.fwdChf': { value: F * N, kind: 'money' },
  'm06.discountRate': {
    value: Math.exp(-rd * T),
    kind: 'num',
    digits: 4,
    note: 'DF_d = e^(−rd T)',
  },

  // Section 3: straddle, strangle, butterfly, seagull
  'm06.dns': { value: ks.dns, kind: 'rate', note: 'Delta-neutral straddle strike F·e^(½σ²T)' },
  'm06.straddlePips': { value: straddle.prem.pips, kind: 'pips' },
  'm06.straddleChf': { value: straddle.prem.quote, kind: 'money' },
  'm06.straddleBeLo': { value: straddle.be[0]!, kind: 'rate' },
  'm06.straddleBeHi': { value: straddle.be[1]!, kind: 'rate' },
  'm06.straddleMovePct': {
    value: (straddle.prem.pips * PIP * growth) / ks.dns,
    kind: 'pct',
    note: 'Move needed by expiry, premium / strike',
  },
  'm06.straddleVegaChf': { value: straddle.greeks.vega, kind: 'money' },
  'm06.straddleThetaChf': { value: straddle.greeks.theta, kind: 'money' },
  'm06.straddleApproxPips': {
    value: pips(sqrt2pi * vol * Math.sqrt(T) * F * Math.exp(-rd * T)),
    kind: 'pips',
    note: '√(2/π)·σ√T·F·DF_d',
  },
  'm06.sqrt2pi': { value: sqrt2pi, kind: 'num', digits: 4, note: '√(2/π)' },
  'm06.sigmaSqrtT': { value: vol * Math.sqrt(T), kind: 'num', digits: 2, note: 'σ√T' },
  'm06.shockPts': {
    value: SC.volShock * 100,
    kind: 'num',
    digits: 0,
    note: 'Vol shock in vol points',
  },
  'm06.shockVol': { value: vol + SC.volShock, kind: 'pct', digits: 0 },
  'm06.straddleShockChf': { value: shockPnl(straddle.legs), kind: 'money', sign: true },
  'm06.put25K': { value: ks.put25, kind: 'rate' },
  'm06.call25K': { value: ks.call25, kind: 'rate' },
  'm06.strPips': { value: strangle.prem.pips, kind: 'pips' },
  'm06.strChf': { value: strangle.prem.quote, kind: 'money' },
  'm06.strBeLo': { value: strangle.be[0]!, kind: 'rate' },
  'm06.strBeHi': { value: strangle.be[1]!, kind: 'rate' },
  'm06.strVegaChf': { value: strangle.greeks.vega, kind: 'money' },
  'm06.strShockChf': { value: shockPnl(strangle.legs), kind: 'money', sign: true },
  'm06.flyLow': { value: fly.legs[0]!.strike, kind: 'rate' },
  'm06.flyMid': { value: fly.legs[1]!.strike, kind: 'rate' },
  'm06.flyHigh': { value: fly.legs[2]!.strike, kind: 'rate' },
  'm06.flyWingPips': { value: pips(ks.wing), kind: 'pips', digits: 0 },
  'm06.flyPips': { value: fly.prem.pips, kind: 'pips' },
  'm06.flyChf': { value: fly.prem.quote, kind: 'money' },
  'm06.flyMaxGainChf': { value: maxGain(fly.ext.maxGain), kind: 'money' },
  'm06.flyBeLo': { value: fly.be[0]!, kind: 'rate' },
  'm06.flyBeHi': { value: fly.be[1]!, kind: 'rate' },
  'm06.flyVegaChf': { value: fly.greeks.vega, kind: 'money' },
  'm06.flyThetaChf': { value: fly.greeks.theta, kind: 'money', sign: true },
  'm06.flyShockChf': { value: shockPnl(fly.legs), kind: 'money', sign: true },
  'm06.sgK1': { value: seagull.legs[0]!.strike, kind: 'rate' },
  'm06.sgK2': { value: seagull.legs[1]!.strike, kind: 'rate' },
  'm06.sgPut': { value: seagull.legs[2]!.strike, kind: 'rate' },
  'm06.sgVegaChf': { value: seagull.greeks.vega, kind: 'money' },
  'm06.sgShockChf': { value: shockPnl(seagull.legs), kind: 'money', sign: true },
  'm06.sgShockLossChf': {
    value: -shockPnl(seagull.legs),
    kind: 'money',
    note: 'Loss of the seagull from the vol shock, as a positive amount',
  },
  'm06.sgDelta': { value: seagull.greeks.delta / N, kind: 'num', digits: 3 },

  // Section 4: smile (example values)
  'm06.smAtm': { value: Q.atm, kind: 'pct', digits: 2 },
  'm06.smRr': { value: Q.rr25, kind: 'pct', digits: 2, sign: true },
  'm06.smBf': { value: Q.bf25, kind: 'pct', digits: 2, sign: true },
  'm06.smRrHalf': { value: Q.rr25 / 2, kind: 'pct', digits: 2, sign: true, note: 'RR/2' },
  'm06.sm25c': { value: vol25Call(Q), kind: 'pct', digits: 2 },
  'm06.sm25p': { value: vol25Put(Q), kind: 'pct', digits: 2 },
  'm06.smWingAvg': { value: 0.5 * (vol25Call(Q) + vol25Put(Q)), kind: 'pct', digits: 2 },
  'm06.smK25p': { value: pil.put25.K, kind: 'rate' },
  'm06.smKatm': { value: pil.atm.K, kind: 'rate' },
  'm06.smK25c': { value: pil.call25.K, kind: 'rate' },
  'm06.smVolAtStrike': {
    value: volAtStrike(K, F, T, Q),
    kind: 'pct',
    digits: 2,
    note: 'Smile vol at the example strike',
  },
  'm06.ninv25': { value: -normInv(0.25), kind: 'num', digits: 4, note: '−N⁻¹(0.25)' },
  'm06.sd25c': { value: vol25Call(Q) * Math.sqrt(T), kind: 'num', digits: 5, note: 'σ25C·√T' },
  'm06.put25SmilePips': { value: pips(eff.put25.smile), kind: 'pips' },
  'm06.put25FlatPips': { value: pips(eff.put25.flat), kind: 'pips' },
  'm06.put25DiffPips': {
    value: pips(eff.put25.smile - eff.put25.flat),
    kind: 'pips',
    sign: true,
  },
  'm06.call25SmilePips': { value: pips(eff.call25.smile), kind: 'pips' },
  'm06.call25FlatPips': { value: pips(eff.call25.flat), kind: 'pips' },
  'm06.call25DiffPips': {
    value: pips(eff.call25.smile - eff.call25.flat),
    kind: 'pips',
    sign: true,
  },
  'm06.rrSmileCreditPips': {
    value: -rrOnSmile.pips,
    kind: 'pips',
    note: 'The flat zero-cost collar valued on the smile: the importer receives this',
  },
  'm06.rrSmileCreditChf': { value: -rrOnSmile.quote, kind: 'money' },
  'm06.rrPutKSmile': { value: rrPutSmile, kind: 'rate', note: 'Zero-cost put strike on the smile' },
};
