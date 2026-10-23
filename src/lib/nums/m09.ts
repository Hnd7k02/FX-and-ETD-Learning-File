/**
 * Numbers of module 09 (hedge, alpha, yield) for <Num of="m09.…" /> and the quiz. Nothing is
 * typed in:
 * - the importer's five strategies from src/lib/m09/hedge.ts (Garman-Kohlhagen, zero-cost
 *   strikes solved with the payoff builder of module 06),
 * - the matrix profiles and key numbers from src/lib/matrix.ts, with the precomputed fair
 *   strikes and coupons of module 08 (src/data/fx/mc-products.json, Monte Carlo),
 * - carry, discount certificate and dual currency from src/lib/m09/carry.ts (money market
 *   Act/360, options on the same forward),
 * - the one-fixing "where does the premium go" example from the core (gkPrice, digitalCash).
 * Every scenario level comes from M09_CONFIG (src/lib/m09/config.ts).
 * Units: rates in CHF per USD, pips = 0.0001, money in CHF unless stated.
 */
import { EXAMPLE as E } from '@/lib/fx/example';
import { gkPrice } from '@/lib/fx/vanilla';
import { digitalCash } from '@/lib/fx/exotics/digital';
import { MC_PRODUCTS } from '@/lib/fx/mc/fair';
import { MC_CONFIG } from '@/lib/fx/mc/products';
import { M09_CONFIG, PIP } from '@/lib/m09/config';
import { hedgeCosts, hedgeSetup } from '@/lib/m09/hedge';
import { CARRY_DEFAULTS, carryView, cushionPips, probLoss, yieldPnl } from '@/lib/m09/carry';
import { matrixParams, productResult } from '@/lib/matrix';
import type { NumTable } from './types';

const pips = (x: number): number => x / PIP;
const N = E.notional;
const S = E.spot;

/* ---------- section 1: same view, different result (matrix default rate ± 3 %) ---------- */
const mp = matrixParams();
const s1Move = M09_CONFIG.matrix.initialMove;
const s1Up = S * (1 + s1Move);
const s1Down = S * (1 - s1Move);
const res = (id: Parameters<typeof productResult>[0], x: number) => productResult(id, x, mp) ?? 0;

/* ---------- section 2: the importer's toolbox ---------- */
const hs = hedgeSetup();
const sc = M09_CONFIG.hedge.scenarios;
const hUp = S * (1 + sc.up);
const hDown = S * (1 + sc.down);
const costUp = hedgeCosts(hUp, hs);
const costDown = hedgeCosts(hDown, hs);

/* ---------- section 3: one fixing in 3 months, where the premium of the sold puts goes ---------- */
const T = E.T;
const tpfP = MC_CONFIG.products.tpf;
const rtpfP = MC_CONFIG.products.rtpf;
const kCoupon = S * tpfP.strikeFactor;
const lowR = S * rtpfP.lowerFactor;
const upR = S * rtpfP.upperFactor;
const put = (K: number) => gkPrice(S, K, T, E.vol, E.rd, E.rf, 'put');
const call = (K: number) => gkPrice(S, K, T, E.vol, E.rd, E.rf, 'call');
const dig = (K: number) => digitalCash(S, K, T, E.vol, E.rd, E.rf, 'call');
/** One-fixing TPF coupon without target: c · D(K) = 2 · P(K). */
const coupon1 = (2 * put(kCoupon)) / dig(kCoupon);
/** One-fixing RTPF coupon: c · [D(L) − D(U)] = 2 · [P(L) + C(U)]. */
const couponRange1 = (2 * (put(lowR) + call(upR))) / (dig(lowR) - dig(upR));
const P = MC_PRODUCTS.products;

/* ---------- section 4: yield and carry ---------- */
const yv = carryView(CARRY_DEFAULTS);
const y12 = carryView({ ...CARRY_DEFAULTS, months: 12 });
const y1 = carryView({ ...CARRY_DEFAULTS, months: 1 });
const yDownMove = sc.down;
const yDown = S * (1 + yDownMove);

/** Raw values for the quiz and tests (rates in CHF per USD, money in CHF unless noted). */
export const M09 = {
  spot: S,
  forward: hs.forward,
  // section 1
  s1Move,
  s1Up,
  s1Down,
  s1FwdUpPips: pips(res('forward', s1Up)),
  s1CallUpPips: pips(res('call', s1Up)),
  s1FwdDownPips: pips(res('forward', s1Down)),
  s1CallDownPips: pips(res('call', s1Down)),
  stop: mp.stop,
  limit: mp.limit,
  // section 2
  callStrike: hs.call.strike,
  callPremiumPips: pips(hs.call.premium),
  callPremiumChf: hs.call.premium * N,
  callCap: hs.call.cap,
  collarPut: hs.collar.putStrike,
  collarCall: hs.collar.callStrike,
  levStrike: hs.leveraged.strike,
  levBetterPips: pips(hs.leveraged.better),
  levWorse: hs.leveraged.worseThanForwardBelow,
  levSecondPutPips: pips(hs.leveraged.secondPut),
  hUp,
  hDown,
  costUp,
  costDown,
  // section 3
  tpfStrike: mp.tpf.strike,
  tpfCouponPips: pips(mp.tpf.coupon),
  tpfNotional: MC_CONFIG.products.tpf.notional,
  tpfTargetCoupons: MC_CONFIG.products.tpf.targetCoupons,
  tpfFixings: MC_CONFIG.products.tpf.fixings,
  tpfQ05: P.tpf.stats.pvQuantile05,
  rtpfLower: mp.rtpf.lower,
  rtpfUpper: mp.rtpf.upper,
  rtpfCouponPips: pips(mp.rtpf.coupon),
  rtpfQ05: P.rtpf.stats.pvQuantile05,
  tarfStrike: mp.tarf.strike,
  tarfFwd: mp.tarf.forward,
  tarfBetterPips: -pips(mp.tarf.strike - mp.tarf.forward),
  tarfTargetPips: pips(mp.tarf.target),
  tarfQ05: P.tarf.stats.pvQuantile05,
  accStrike: mp.accumulator.strike,
  accFwd: mp.accumulator.forward,
  accBetterPips: -pips(mp.accumulator.strike - mp.accumulator.forward),
  accBarrier: mp.accumulator.barrier,
  accQ05: P.accumulator.stats.pvQuantile05,
  pivPivot: mp.pivotTarf.pivot,
  pivLower: mp.pivotTarf.lower,
  pivUpper: mp.pivotTarf.upper,
  pivTargetPips: pips(mp.pivotTarf.target),
  pivWorst: P.pivotTarf.stats.pvMin,
  tpfWorst: P.tpf.stats.pvMin,
  rtpfWorst: P.rtpf.stats.pvMin,
  tarfWorst: P.tarf.stats.pvMin,
  accWorst: P.accumulator.stats.pvMin,
  paths: MC_PRODUCTS.engine.paths,
  accNotional: MC_CONFIG.products.accumulator.notional,
  accFixings: MC_CONFIG.products.accumulator.fixings,
  structNotional: MC_CONFIG.products.tarf.notional,
  kCoupon,
  lowR,
  upR,
  coupon1Pips: pips(coupon1),
  couponRange1Pips: pips(couponRange1),
  put1Pips: pips(put(kCoupon)),
  // section 4
  yMonths: CARRY_DEFAULTS.months,
  yDays: yv.days,
  carryForward: yv.forward,
  carryPips: cushionPips('carry', yv),
  carryChf: yieldPnl('carry', S, yv),
  carryPLoss: probLoss('carry', yv),
  yStrike: yv.strike,
  yStrikeBelow: CARRY_DEFAULTS.strikeBelow,
  yCallPips: pips(yv.call),
  yPutPips: pips(yv.put),
  yBreakEven: yv.breakEven.dci,
  yCushionPips: cushionPips('dci', yv),
  yMaxChf: yv.maxGainPerUsd.dci * N,
  yPLoss: probLoss('dci', yv),
  dciYield: yv.dciYieldPa,
  certPrice: yv.certPrice,
  certDiscount: yv.certDiscount,
  certDiscountPips: pips(S - yv.certPrice),
  certUsdInterestPips: pips(S * (1 - yv.dff)),
  sigmaPips: pips(yv.typicalMove),
  carry12Pips: cushionPips('carry', y12),
  sigma12Pips: pips(y12.typicalMove),
  carry1Pips: cushionPips('carry', y1),
  sigma1Pips: pips(y1.typicalMove),
  yDownMove,
  yDown,
  carryDownChf: yieldPnl('carry', yDown, yv),
  dciDownChf: yieldPnl('dci', yDown, yv),
} as const;

const M = M09;
const hedgeRow = (id: keyof typeof M.costUp, label: string): NumTable => ({
  [`m09.up.${id}`]: { value: M.costUp[id], kind: 'money', note: `${label} at +5 %, USD 1 Mio.` },
  [`m09.down.${id}`]: { value: M.costDown[id], kind: 'money', note: `${label} at −5 %` },
  [`m09.upVsFwd.${id}`]: {
    value: M.costUp[id] - M.costUp.forward,
    kind: 'money',
    sign: true,
    note: `${label} minus forward at +5 %`,
  },
  [`m09.downVsFwd.${id}`]: {
    value: M.costDown[id] - M.costDown.forward,
    kind: 'money',
    sign: true,
    note: `${label} minus forward at −5 %`,
  },
});

export const nums: NumTable = {
  // section 1
  'm09.s1Move': { value: M.s1Move, kind: 'pct', digits: 0, note: 'Matrix scenario ± move' },
  'm09.s1Up': { value: M.s1Up, kind: 'rate' },
  'm09.s1Down': { value: M.s1Down, kind: 'rate' },
  'm09.s1FwdUp': { value: M.s1FwdUpPips, kind: 'pips', digits: 0, sign: true },
  'm09.s1FwdUpChf': {
    value: M.s1FwdUpPips * PIP * N,
    kind: 'money',
    sign: true,
    note: 'Forward result on USD 1 Mio. at +3 %',
  },
  'm09.s1CallUp': { value: M.s1CallUpPips, kind: 'pips', digits: 0, sign: true },
  'm09.s1FwdDown': { value: M.s1FwdDownPips, kind: 'pips', digits: 0, sign: true },
  'm09.s1CallDown': { value: M.s1CallDownPips, kind: 'pips', digits: 0, sign: true },
  'm09.stop': { value: M.stop, kind: 'rate', note: 'Stop-loss level, spot + 1 %' },
  'm09.limit': { value: M.limit, kind: 'rate', note: 'Limit level, spot − 1 %' },
  'm09.orderDist': {
    value: M09_CONFIG.orders.stopAbove,
    kind: 'pct',
    digits: 0,
    note: 'Distance of the example orders from spot',
  },

  // section 2
  'm09.callPremiumPips': { value: M.callPremiumPips, kind: 'pips', digits: 0 },
  'm09.callCap': { value: M.callCap, kind: 'rate', note: 'K + premium carried to expiry' },
  'm09.collarPut': { value: M.collarPut, kind: 'rate', note: 'Zero-cost put strike' },
  'm09.collarCall': { value: M.collarCall, kind: 'rate', note: '25Δ call strike' },
  'm09.levStrike': { value: M.levStrike, kind: 'rate', note: 'C(K) = 2·P(K), 3 months' },
  'm09.levBetter': { value: M.levBetterPips, kind: 'pips', digits: 0, note: 'F − K_L' },
  'm09.levSecondPut': {
    value: M.levSecondPutPips,
    kind: 'pips',
    digits: 0,
    note: 'Value of the second sold put (= F − K_L with rd = 0)',
  },
  'm09.levWorse': { value: M.levWorse, kind: 'rate', note: '2K_L − F' },
  'm09.hUp': { value: M.hUp, kind: 'rate', note: 'Scenario +5 %' },
  'm09.hDown': { value: M.hDown, kind: 'rate', note: 'Scenario −5 %' },
  'm09.hMove': {
    value: M09_CONFIG.hedge.scenarios.up,
    kind: 'pct',
    digits: 0,
    note: 'Size of the worked-example scenarios',
  },
  ...hedgeRow('unhedged', 'Unhedged'),
  ...hedgeRow('forward', 'Forward'),
  ...hedgeRow('call', 'Call'),
  ...hedgeRow('collar', 'Collar'),
  ...hedgeRow('leveraged', 'Structured hedge'),

  // section 3
  'm09.tpfStrike': { value: M.tpfStrike, kind: 'rate' },
  'm09.tpfBelowSpot': {
    value: 1 - M.tpfStrike / S,
    kind: 'pct',
    note: 'Strike below spot (§8.7)',
  },
  'm09.tpfCoupon': { value: M.tpfCouponPips, kind: 'pips', digits: 0 },
  'm09.tpfCouponChf': {
    value: M.tpfCouponPips * PIP * M.tpfNotional,
    kind: 'money',
    note: 'Coupon per fixing on USD 100’000',
  },
  'm09.structNotional': { value: M.structNotional, kind: 'money', ccy: 'USD' },
  'm09.tpfTargetCoupons': { value: M.tpfTargetCoupons, kind: 'num', digits: 0 },
  'm09.tpfMaxChf': {
    value: M.tpfCouponPips * PIP * M.tpfNotional * M.tpfTargetCoupons,
    kind: 'money',
    note: 'Coupon × target coupons: the largest possible gain',
  },
  'm09.fixings': { value: M.tpfFixings, kind: 'num', digits: 0 },
  'm09.tpfQ05': { value: M.tpfQ05, kind: 'money', note: '5 % quantile of path PV (MC)' },
  'm09.rtpfLower': { value: M.rtpfLower, kind: 'rate' },
  'm09.rtpfUpper': { value: M.rtpfUpper, kind: 'rate' },
  'm09.rtpfCoupon': { value: M.rtpfCouponPips, kind: 'pips', digits: 0 },
  'm09.rtpfQ05': { value: M.rtpfQ05, kind: 'money' },
  'm09.tarfStrike': { value: M.tarfStrike, kind: 'rate' },
  'm09.tarfFwd': { value: M.tarfFwd, kind: 'rate', note: 'Forward at the average fixing day' },
  'm09.tarfBetter': { value: M.tarfBetterPips, kind: 'pips', digits: 0 },
  'm09.tarfTarget': { value: M.tarfTargetPips, kind: 'pips', digits: 0 },
  'm09.tarfQ05': { value: M.tarfQ05, kind: 'money' },
  'm09.accStrike': { value: M.accStrike, kind: 'rate' },
  'm09.accFwd': { value: M.accFwd, kind: 'rate' },
  'm09.accBetter': { value: M.accBetterPips, kind: 'pips', digits: 0 },
  'm09.accBarrier': { value: M.accBarrier, kind: 'rate' },
  'm09.accQ05': { value: M.accQ05, kind: 'money' },
  'm09.pivPivot': { value: M.pivPivot, kind: 'rate' },
  'm09.pivLower': { value: M.pivLower, kind: 'rate' },
  'm09.pivUpper': { value: M.pivUpper, kind: 'rate' },
  'm09.pivTarget': { value: M.pivTargetPips, kind: 'pips', digits: 0 },
  'm09.pivWorst': { value: M.pivWorst, kind: 'money', note: 'Worst path PV (MC)' },
  'm09.tpfWorst': { value: M.tpfWorst, kind: 'money' },
  'm09.rtpfWorst': { value: M.rtpfWorst, kind: 'money' },
  'm09.tarfWorst': { value: M.tarfWorst, kind: 'money' },
  'm09.accWorst': { value: M.accWorst, kind: 'money' },
  'm09.paths': { value: M.paths, kind: 'num', digits: 0, note: 'Monte Carlo paths' },
  'm09.accNotional': { value: M.accNotional, kind: 'money', ccy: 'USD' },
  'm09.accFixings': { value: M.accFixings, kind: 'num', digits: 0 },
  'm09.kCoupon': { value: M.kCoupon, kind: 'rate', note: 'One-fixing coupon strike' },
  'm09.lowR': { value: M.lowR, kind: 'rate' },
  'm09.upR': { value: M.upR, kind: 'rate' },
  'm09.coupon1': {
    value: M.coupon1Pips,
    kind: 'pips',
    digits: 0,
    note: 'One fixing in 3 months: c·D(K) = 2·P(K)',
  },
  'm09.couponRange1': {
    value: M.couponRange1Pips,
    kind: 'pips',
    digits: 0,
    note: 'One fixing in 3 months: c·[D(L) − D(U)] = 2·[P(L) + C(U)]',
  },
  'm09.put1': { value: M.put1Pips, kind: 'pips', digits: 1, note: 'P(K) one fixing' },

  // section 4
  'm09.yMonths': { value: M.yMonths, kind: 'num', digits: 0 },
  'm09.yDays': { value: M.yDays, kind: 'num', digits: 0 },
  'm09.carryFwd': { value: M.carryForward, kind: 'rate', note: 'Money-market forward = BE' },
  'm09.carryPips': { value: M.carryPips, kind: 'pips', digits: 0, note: 'Carry cushion S − F' },
  'm09.carryChf': {
    value: M.carryChf,
    kind: 'money',
    note: 'Carry at unchanged spot on USD 1 Mio.',
  },
  'm09.carryPLoss': { value: M.carryPLoss, kind: 'pct', digits: 0, note: 'Model, not a forecast' },
  'm09.yStrike': { value: M.yStrike, kind: 'rate', note: 'Strike / cap 1 % below spot' },
  'm09.yStrikeBelow': { value: M.yStrikeBelow, kind: 'pct', digits: 0 },
  'm09.yCall': { value: M.yCallPips, kind: 'pips', digits: 0 },
  'm09.yPut': { value: M.yPutPips, kind: 'pips', digits: 0 },
  'm09.yBe': { value: M.yBreakEven, kind: 'rate', note: 'K − P/DF_d' },
  'm09.yCushion': { value: M.yCushionPips, kind: 'pips', digits: 0 },
  'm09.yMaxChf': { value: M.yMaxChf, kind: 'money', note: 'Largest extra return, USD 1 Mio.' },
  'm09.yPLoss': { value: M.yPLoss, kind: 'pct', digits: 0 },
  'm09.dciYield': { value: M.dciYield, kind: 'pct', note: 'DCI yield p.a., 3 months' },
  'm09.certPrice': { value: M.certPrice, kind: 'rate', note: 'Certificate price per USD' },
  'm09.certDiscount': { value: M.certDiscount, kind: 'pct', note: 'Discount to spot' },
  'm09.certDiscountPips': {
    value: M.certDiscountPips,
    kind: 'pips',
    digits: 0,
    note: 'Discount to spot in pips = USD interest forgone + call premium',
  },
  'm09.certUsdInterest': {
    value: M.certUsdInterestPips,
    kind: 'pips',
    digits: 0,
    note: 'USD interest forgone in the certificate price, S · (1 − DF_USD)',
  },
  'm09.sigmaPips': { value: M.sigmaPips, kind: 'pips', digits: 0, note: 'S·σ·√T' },
  'm09.carry12': { value: M.carry12Pips, kind: 'pips', digits: 0 },
  'm09.sigma12': { value: M.sigma12Pips, kind: 'pips', digits: 0 },
  'm09.carry1': { value: M.carry1Pips, kind: 'pips', digits: 0 },
  'm09.sigma1': { value: M.sigma1Pips, kind: 'pips', digits: 0 },
  'm09.yDownMove': { value: M.yDownMove, kind: 'pct', digits: 0, sign: true },
  'm09.yDown': { value: M.yDown, kind: 'rate' },
  'm09.carryDownChf': { value: M.carryDownChf, kind: 'money', sign: true },
  'm09.dciDownChf': { value: M.dciDownChf, kind: 'money', sign: true },
};
