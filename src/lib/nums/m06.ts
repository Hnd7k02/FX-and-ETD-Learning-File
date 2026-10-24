/**
 * Numbers of module 06 (Combos & Vol Smile) for <Num of="m06.…" />. Everything is computed from
 * the running example (src/lib/fx/example.ts, EXAMPLE_SMILE) with the calculation core and the
 * payoff builder templates (src/lib/payoff.ts); nothing is typed in. Scenario rates at expiry and
 * the size of the vol shock are teaching choices, kept in M06_SCENARIOS (D-22).
 *
 * USD/CHF, S = 0.8000, T = 0.25, σ = 8 %, rd = 0 (CHF), rf = 3.5 % (USD), N = USD 1 Mio.
 * Smile (section 4): ATM 8 %, 25Δ RR −1.00, 25Δ BF 0.25 (example values, not market data).
 *
 * Delta conventions: the 25Δ strikes of sections 2 and 3 are spot-delta strikes without
 * premium adjustment at the flat vol, on the 5-pip grid of the payoff builder; the grid is part
 * of their definition (templateStrikes, src/lib/payoff.ts). Section 4 places the smile pillars
 * by forward delta (smilePillars, src/lib/fx/smile.ts). Premiums, net premiums and solved
 * strikes are computed unrounded; only the display rounds.
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
  type ShaperFacts,
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
  STRIKE_STEP,
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
  /**
   * Rate at expiry close to forward and strike (06.1): there a structure with a premium costs
   * more than both yardsticks, staying unhedged and the forward.
   */
  stMid: 0.795,
  /** Parallel shift of the implied vol in section 3 (decimal, +2 vol points). */
  volShock: 0.02,
} as const;
const SC = M06_SCENARIOS;

/**
 * Decimals of the solved zero-cost put strike wherever an amount is derived from it (06.2 text,
 * quiz m06-q2). On USD 1 Mio. the strike shown to 6 decimals times the notional is the amount in
 * whole francs, so strike × notional adds up on screen (D-26); elsewhere the strike is rounded
 * to the usual 4 decimals. A display choice (D-22), not a check value.
 */
export const M06_SOLVED_DIGITS = 6;

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
/** CHF paid for the USD notional at S_T with a structure of the hedge shaper, premium included. */
export const payAt = (id: ShaperId, st: number) =>
  effectiveRate(shaperPosition(id, MARKET).legs, MARKET, st) * N;
/**
 * Lower end of the band where a structure with a premium costs more than both yardsticks: the
 * forward minus the premium carried to expiry. The upper end is its cap, strike plus premium
 * (shaperFacts.capRate), as long as the cap holds there.
 */
const bandLow = (f: ShaperFacts) => F - f.premiumPips * PIP * growth;

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
/**
 * The 25Δ risk reversal itself: both strikes fixed by the delta convention (call25, put25),
 * nothing solved. Its net premium is rarely zero; in the example the importer receives a
 * little. The template 'risk-reversal' (zero-cost collar) keeps the call and solves the put.
 */
const rr25Legs: Leg[] = [rr.legs[0]!, { ...rr.legs[1]!, strike: ks.put25 }];
const rr25 = netPremium(rr25Legs, MARKET);
/** Rounds to the 0.01-pip display grid of the risk reversal legs (D-26). */
const r2 = (x: number) => Math.round(x * 100) / 100;
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
/** Rounds to the 0.1-pip display grid, so that displayed differences add up (D-26, D-38). */
const r1 = (x: number) => Math.round(x * 10) / 10;

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
  rr25PutK: ks.put25,
  rr25PutPips: legPips(rr25Legs[1]!),
  /** Net premium of the 25Δ risk reversal, call − put (< 0: the importer receives). */
  rr25NetPips: rr25.pips,
  rr25NetChf: rr25.quote,
  /** Net value of the zero-cost collar at the unrounded solved put strike (CHF, ≈ 0). */
  rrResidualChf: positionValue(rr.legs, MARKET),
  rrPutSmile,
  forward: F,
  stUp: SC.stUp,
  stDown: SC.stDown,
  stMid: SC.stMid,
  callBandLo: bandLow(shCall.f),
  spreadBandLo: bandLow(shSpread.f),
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
  'm06.stMid': { value: SC.stMid, kind: 'rate', note: 'Scenario: close to forward and strike' },
  'm06.midUnhedgedChf': { value: SC.stMid * N, kind: 'money' },
  'm06.midCallChf': { value: payAt('call', SC.stMid), kind: 'money' },
  'm06.midSpreadChf': { value: payAt('call-spread', SC.stMid), kind: 'money' },
  'm06.callBandLo': {
    value: bandLow(shCall.f),
    kind: 'rate',
    note: 'F − premium: from here up to the cap the call costs more than unhedged and forward',
  },
  'm06.spreadBandLo': {
    value: bandLow(shSpread.f),
    kind: 'rate',
    note: 'F − net premium: from here up to the cap the call spread costs more than both',
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
  'm06.rrPutK': {
    value: rr.legs[1]!.strike,
    kind: 'rate',
    note: 'Solved for zero cost, unrounded; shown to M06_SOLVED_DIGITS where an amount is derived from it',
  },
  'm06.rr25PutK': { value: ks.put25, kind: 'rate', note: '25Δ USD put, 5-pip grid' },
  'm06.strikeStepPips': {
    value: pips(STRIKE_STEP),
    kind: 'pips',
    digits: 0,
    note: 'Strike grid of the payoff builder; the 25Δ strikes of sections 2 and 3 sit on it',
  },
  'm06.rr25CallPips': {
    value: legPips(rr25Legs[0]!),
    kind: 'pips',
    digits: 2,
    note: '25Δ USD call premium, unrounded (shown with 2 decimals in the net calculation)',
  },
  'm06.rr25PutPips': {
    value: legPips(rr25Legs[1]!),
    kind: 'pips',
    digits: 2,
    note: '25Δ USD put premium, unrounded (shown with 2 decimals in the net calculation)',
  },
  'm06.rr25NetPips': {
    value: rr25.pips,
    kind: 'pips',
    digits: 4,
    note: '25Δ risk reversal (call25 long, put25 short): net premium call − put, unrounded, < 0 = received',
  },
  'm06.rr25NetShownPips': {
    value: r2(legPips(rr25Legs[0]!)) - r2(legPips(rr25Legs[1]!)),
    kind: 'pips',
    digits: 2,
    note: 'Difference of the two displayed (rounded) leg premiums, so the text adds up (D-26)',
  },
  'm06.rr25NetChf': {
    value: rr25.quote,
    kind: 'money',
    digits: 2,
    note: '25Δ risk reversal: net premium on USD 1 Mio., unrounded, < 0 = received',
  },
  'm06.rrPutGapPips': {
    value: pips(ks.put25 - rr.legs[1]!.strike),
    kind: 'pips',
    digits: 2,
    note: 'Zero-cost put strike below the 25Δ put strike; 2 decimals, so that it adds up with the put strike shown to M06_SOLVED_DIGITS (D-26)',
  },
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
  'm06.straddleAtFPips': {
    value: 2 * pips(gkPrice(S, F, T, vol, rd, rf, 'call')),
    kind: 'pips',
    digits: 1,
    note: 'Exact Black-76 straddle with K = F (call = put there)',
  },
  'm06.expMovePct': {
    value: sqrt2pi * vol * Math.sqrt(T),
    kind: 'pct',
    note: 'Expected absolute move by expiry relative to F: √(2/π)·σ√T',
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
    value: r1(pips(eff.put25.smile)) - r1(pips(eff.put25.flat)),
    kind: 'pips',
    sign: true,
    note: 'Difference of the two displayed (rounded) prices, so the text adds up',
  },
  'm06.call25SmilePips': { value: pips(eff.call25.smile), kind: 'pips' },
  'm06.call25FlatPips': { value: pips(eff.call25.flat), kind: 'pips' },
  'm06.call25DiffPips': {
    value: r1(pips(eff.call25.smile)) - r1(pips(eff.call25.flat)),
    kind: 'pips',
    sign: true,
    note: 'Difference of the two displayed (rounded) prices, so the text adds up',
  },
  'm06.rrSmileCreditPips': {
    value: -rrOnSmile.pips,
    kind: 'pips',
    note: 'The flat zero-cost collar valued on the smile: the importer receives this',
  },
  'm06.rrSmileCreditChf': { value: -rrOnSmile.quote, kind: 'money' },
  'm06.rrPutKSmile': { value: rrPutSmile, kind: 'rate', note: 'Zero-cost put strike on the smile' },
};
