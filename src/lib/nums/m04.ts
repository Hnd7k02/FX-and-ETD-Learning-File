/**
 * Numbers of module 04 (Vanilla Options) for <Num of="m04.…" />. Everything is computed from the
 * running example (src/lib/fx/example.ts) with the calculation core; nothing is typed in.
 * Scenario rates (0.8400, 0.7600, 0.8200, 0.7990) and the strikes of the moneyness examples
 * are teaching choices, kept in M04_SCENARIOS so they are easy to change (D-22).
 *
 * USD call / CHF put, S = 0.8000, K = 0.7930 (ATMF rounded), T = 0.25, σ = 8 %, rd = 0, rf = 3.5 %.
 */
import { EXAMPLE as E, EXAMPLE_FORWARD as F, EXAMPLE_STRIKE as K } from '@/lib/fx/example';
import { normCdf } from '@/lib/fx/normal';
import { d1d2, gkPrice, probItm, type OptionType } from '@/lib/fx/vanilla';
import { greeks } from '@/lib/fx/greeks';
import { atmDnsStrike, strikeFromDelta } from '@/lib/fx/implied';
import { pipSize } from '@/lib/format';
import {
  FORWARD_DIGITS,
  hedgeCosts,
  hedgeFacts,
  savingChf,
  type HedgeSetup,
} from '@/lib/hedge-cost';
import { roundStrike } from '@/lib/payoff';
import type { NumTable } from './types';

const { spot: S, T, vol, rd, rf, notional: N } = E;
const PIP = pipSize(E.pair);
const pips = (x: number) => x / PIP;

/** Teaching scenarios (rates at expiry and strikes of the examples). */
export const M04_SCENARIOS = {
  /** Strong dollar at expiry (the importer's fear). */
  stUp: 0.84,
  /** Weak dollar at expiry. */
  stDown: 0.76,
  /** Rate at expiry for the long-call P&L example. */
  stPnl: 0.82,
  /** A strike between forward and spot: below spot, above forward. */
  kMid: 0.799,
  /** Arbitrage example: call quoted this many pips too high. */
  arbPips: 5,
} as const;
const SC = M04_SCENARIOS;

const call = gkPrice(S, K, T, vol, rd, rf, 'call');
const put = gkPrice(S, K, T, vol, rd, rf, 'put');
const growth = Math.exp(rd * T);
const dfd = Math.exp(-rd * T);
const { d1, d2 } = d1d2(S, K, T, vol, rd, rf);
const call25 = strikeFromDelta(0.25, S, T, vol, rd, rf, 'call');
const put25 = strikeFromDelta(-0.25, S, T, vol, rd, rf, 'put');
const call10 = strikeFromDelta(0.1, S, T, vol, rd, rf, 'call');
const put10 = strikeFromDelta(-0.1, S, T, vol, rd, rf, 'put');
const dns = atmDnsStrike(S, T, vol, rd, rf);
const kItm = roundStrike(put25);
const kOtm = roundStrike(call25);
const atmf = gkPrice(S, F, T, vol, rd, rf, 'call');
const itm = gkPrice(S, kItm, T, vol, rd, rf, 'call');
const itmIntrinsic = dfd * Math.max(F - kItm, 0);
/** Classic intrinsic value max(S − K, 0): the value of immediate exercise (C8). */
const itmSpotIntrinsic = Math.max(S - kItm, 0);
const otm = gkPrice(S, kOtm, T, vol, rd, rf, 'call');

/**
 * Delta is a price sensitivity, not a probability (supplement point 12). At the exact delta
 * strikes: spot delta, and the risk-neutral chance to expire in the money, N(d2) / N(−d2).
 */
const deltaAt = (k: number, type: OptionType) => greeks(S, k, T, vol, rd, rf, type).delta;
const probAt = (k: number, type: OptionType) => probItm(S, k, T, vol, rd, rf, type);
/** N(d1) at the 25Δ call strike = N(−d1) at the 25Δ put strike = 0.25 · e^(rf T). */
const nd1At25 = normCdf(d1d2(S, call25, T, vol, rd, rf).d1);

/**
 * Section 1 uses the same maths as the OptionVsForward figure: the forward as dealt (5 decimals,
 * 0.79303), whole-franc amounts, and savings computed from the amounts shown, so they add up.
 */
const HEDGE: HedgeSetup = { S, K, T, vol, rd, rf, notional: N, forwardDigits: FORWARD_DIGITS };
const HF = hedgeFacts(HEDGE);
const up = hedgeCosts(SC.stUp, HEDGE, HF);
const down = hedgeCosts(SC.stDown, HEDGE, HF);

/** Raw values for the quiz file and tests (quote currency per 1 USD unless noted). */
export const M04 = {
  call,
  put,
  callPips: pips(call),
  putPips: pips(put),
  callChf: call * N,
  putChf: put * N,
  F,
  K,
  /** Forward as dealt by the importer (5 decimals). */
  Fdeal: HF.F,
  /** Option cap per USD: K + premium carried to expiry. */
  cap: HF.cap,
  /** Below this rate at expiry the call beats the forward: F − premium. */
  beatFwd: HF.optionBeatsForwardBelow,
  /** Long put / short put break-even: K − put premium. */
  bePut: K - put * growth,
  costUp: up.option,
  costDown: down.option,
  fwdChf: down.forward,
  parityPips: pips(call - put),
  /** ITM / OTM call examples of section 3 (strikes = rounded 25Δ strikes). */
  kItm,
  itmPips: pips(itm),
  itmIntrinsicPips: pips(itmIntrinsic),
  itmTimePips: pips(itm - itmIntrinsic),
  /** Classic intrinsic value of the ITM call against spot, max(S − K, 0) (immediate exercise). */
  itmVsSpotPips: pips(itmSpotIntrinsic),
  /** Time value if the intrinsic value were measured against spot: negative. */
  itmSpotTimePips: pips(itm - itmSpotIntrinsic),
  deltaCall: greeks(S, K, T, vol, rd, rf, 'call').delta,
  deltaPut: greeks(S, K, T, vol, rd, rf, 'put').delta,
  dff: Math.exp(-rf * T),
  dns,
  call25,
  put25,
} as const;

export const nums: NumTable = {
  // Section 1: intuition
  'm04.strikeInv': {
    value: 1 / K,
    kind: 'rate',
    note: 'Strike of the CHF put in USD per CHF, 1/K',
  },
  'm04.chfNotional': { value: K * N, kind: 'money', note: 'CHF notional of the CHF put, K·N' },
  'm04.fwdDeal': {
    value: HF.F,
    kind: 'rate',
    digits: FORWARD_DIGITS,
    note: 'Forward as dealt by the importer (continuous forward, 5 decimals)',
  },
  'm04.fwdChf': { value: down.forward, kind: 'money', note: 'CHF paid with the forward, F·N' },
  'm04.capRate': { value: M04.cap, kind: 'rate', note: 'Worst rate with the call: K + premium' },
  'm04.capChf': { value: M04.cap * N, kind: 'money', note: 'Worst case with the call in CHF' },
  'm04.beatFwdRate': {
    value: M04.beatFwd,
    kind: 'rate',
    note: 'Below this rate the call beats the forward: F − premium',
  },
  'm04.stUp': { value: SC.stUp, kind: 'rate', note: 'Scenario: strong dollar' },
  'm04.stDown': { value: SC.stDown, kind: 'rate', note: 'Scenario: weak dollar' },
  'm04.unhedgedUpChf': { value: up.unhedged, kind: 'money' },
  'm04.unhedgedDownChf': { value: down.unhedged, kind: 'money' },
  'm04.optionDownChf': { value: down.option, kind: 'money' },
  'm04.saveUpChf': {
    value: savingChf(up, 'option', 'unhedged'),
    kind: 'money',
    note: 'Saving of the call against unhedged at the strong-dollar scenario (shown amounts)',
  },
  'm04.saveDownChf': {
    value: savingChf(down, 'option', 'forward'),
    kind: 'money',
    note: 'Saving of the call against the forward at the weak-dollar scenario (shown amounts)',
  },
  'm04.fwdVsStrikePips': {
    value: pips(F - K),
    kind: 'pips',
    note: 'The rounded strike sits this far below the forward',
  },

  // Section 2: four positions
  'm04.stPnl': { value: SC.stPnl, kind: 'rate' },
  'm04.payoffPnlPips': {
    value: pips(SC.stPnl - K),
    kind: 'pips',
    digits: 0,
    note: 'Long call payoff at expiry at stPnl (a whole number of pips)',
  },
  'm04.pnlPips': {
    value: pips(SC.stPnl - K - call * growth),
    kind: 'pips',
    digits: 2,
    note: 'Long call P&L after premium at stPnl; 2 digits like ex.callPips, so they add up',
  },
  'm04.pnlChf': { value: (SC.stPnl - K - call * growth) * N, kind: 'money' },
  'm04.beCall': { value: M04.cap, kind: 'rate', note: 'Long call break-even K + premium' },
  'm04.bePut': { value: M04.bePut, kind: 'rate', note: 'Put break-even K − premium' },
  'm04.shortPutMaxLossChf': {
    value: M04.bePut * N,
    kind: 'money',
    note: 'Short put loss if the rate fell to zero: (K − premium)·N',
  },

  // Section 3: moneyness and premium
  'm04.kMid': { value: SC.kMid, kind: 'rate' },
  'm04.kMidOtmPips': {
    value: pips(SC.kMid - F),
    kind: 'pips',
    note: 'How far the kMid call is out of the money against the forward',
  },
  'm04.kMidSpotPips': {
    value: pips(S - SC.kMid),
    kind: 'pips',
    digits: 0,
    note: 'How far kMid sits below spot (in the money in spot moneyness)',
  },
  'm04.atmfPips': { value: pips(atmf), kind: 'pips', note: 'Call at K = F: pure time value' },
  'm04.atmfApproxPips': {
    value: pips((dfd * F * vol * Math.sqrt(T)) / Math.sqrt(2 * Math.PI)),
    kind: 'pips',
    note: 'Rule of thumb DF·F·σ√T/√(2π) ≈ 0.4·F·σ√T',
  },
  'm04.sigmaSqrtT': { value: vol * Math.sqrt(T), kind: 'num', digits: 2, note: 'σ√T' },
  'm04.kItm': {
    value: kItm,
    kind: 'rate',
    note: 'ITM call example strike (25Δ put strike rounded)',
  },
  'm04.itmPips': { value: pips(itm), kind: 'pips' },
  'm04.itmIntrinsicPips': { value: pips(itmIntrinsic), kind: 'pips' },
  'm04.itmTimePips': { value: pips(itm - itmIntrinsic), kind: 'pips' },
  'm04.itmSpotIntrinsicPips': {
    value: pips(itmSpotIntrinsic),
    kind: 'pips',
    note: 'Classic intrinsic value of the ITM call against spot, max(S − K, 0): immediate exercise',
  },
  'm04.itmSpotTimePips': {
    value: pips(itm - itmSpotIntrinsic),
    kind: 'pips',
    note: 'Time value of the ITM call if measured against spot: negative, hence the forward',
  },
  'm04.itmSpotGapPips': {
    value: pips(itmSpotIntrinsic - itmIntrinsic),
    kind: 'pips',
    note: 'Intrinsic value against spot minus against the forward; = S − F here (DF = 1, rd = 0)',
  },
  'm04.kOtm': {
    value: kOtm,
    kind: 'rate',
    note: 'OTM call example strike (25Δ call strike rounded)',
  },
  'm04.otmPips': { value: pips(otm), kind: 'pips' },
  'm04.otmChf': { value: otm * N, kind: 'money' },
  'm04.dnsPa': {
    value: F * Math.exp(-0.5 * vol * vol * T),
    kind: 'rate',
    note: 'ATM DNS strike with premium-adjusted delta, F·e^(−½σ²T) (below the forward)',
  },
  'm04.call25': { value: call25, kind: 'rate' },
  'm04.put25': { value: put25, kind: 'rate' },
  'm04.call10': { value: call10, kind: 'rate' },
  'm04.put10': { value: put10, kind: 'rate' },
  'm04.call25Delta': {
    value: deltaAt(call25, 'call'),
    kind: 'num',
    digits: 2,
    note: 'Spot delta at the 25Δ call strike (0.25 by construction): a price sensitivity',
  },
  'm04.put25Delta': { value: deltaAt(put25, 'put'), kind: 'num', digits: 2 },
  'm04.call10Delta': { value: deltaAt(call10, 'call'), kind: 'num', digits: 2 },
  'm04.put10Delta': { value: deltaAt(put10, 'put'), kind: 'num', digits: 2 },
  'm04.call25Prob': {
    value: probAt(call25, 'call'),
    kind: 'pct',
    digits: 2,
    note: 'Risk-neutral P(S_T > K) = N(d2) at the 25Δ call strike; not a forecast, not delta',
  },
  'm04.put25Prob': {
    value: probAt(put25, 'put'),
    kind: 'pct',
    digits: 2,
    note: 'Risk-neutral P(S_T < K) = N(−d2) at the 25Δ put strike',
  },
  'm04.call10Prob': {
    value: probAt(call10, 'call'),
    kind: 'pct',
    digits: 2,
    note: 'Risk-neutral N(d2) at the 10Δ call strike',
  },
  'm04.put10Prob': {
    value: probAt(put10, 'put'),
    kind: 'pct',
    digits: 2,
    note: 'Risk-neutral N(−d2) at the 10Δ put strike',
  },
  'm04.nd1At25': {
    value: nd1At25,
    kind: 'num',
    digits: 4,
    note: 'N(d1) at the 25Δ call strike = N(−d1) at the 25Δ put strike = 0.25·e^(rf T)',
  },
  'm04.dns': { value: dns, kind: 'rate', note: 'ATM delta-neutral straddle strike F·e^(½σ²T)' },
  'm04.dnsGapPips': { value: pips(dns - F), kind: 'pips', note: 'DNS strike above the forward' },
  'm04.dnsDelta': {
    value: greeks(S, dns, T, vol, rd, rf, 'call').delta,
    kind: 'num',
    digits: 4,
    note: 'Call spot delta at the DNS strike, = ½·e^(−rf T)',
  },
  'm04.callUsd': { value: (call * N) / S, kind: 'money', ccy: 'USD', note: 'Premium in USD' },
  'm04.callPctUsd': {
    value: call / S,
    kind: 'pct',
    digits: 2,
    note: 'Premium in % of the USD notional',
  },
  'm04.deltaPut': { value: M04.deltaPut, kind: 'num', digits: 3 },
  'm04.deltaCall': { value: M04.deltaCall, kind: 'num', digits: 3 },

  // Section 4: pricing and parity
  'm04.nd1': { value: normCdf(d1), kind: 'num', digits: 4, note: 'N(d1)' },
  'm04.nd2': { value: normCdf(d2), kind: 'num', digits: 4, note: 'N(d2)' },
  'm04.dfd': { value: dfd, kind: 'num', digits: 4, note: 'e^(−rd T)' },
  'm04.parityGapPips': {
    value: pips(F - K),
    kind: 'pips',
    note: 'F − K in pips (forward above the rounded strike); 1 digit, like m04.parityPips',
  },
  'm04.parityPips': {
    value: pips(call - put),
    kind: 'pips',
    note: 'C − P in pips, 1 digit so that 126.69 − 126.39 matches on screen',
  },
  'm04.arbPips': { value: SC.arbPips, kind: 'pips', digits: 0 },
  'm04.arbChf': { value: SC.arbPips * PIP * N, kind: 'money' },
  'm04.synthDelta': {
    value: M04.deltaCall - M04.deltaPut,
    kind: 'num',
    digits: 4,
    note: 'Spot delta of long call + short put = e^(−rf T)',
  },
};
