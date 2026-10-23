/**
 * Numbers of module 08 (structured products) for <Num of="m08.…" /> and the quiz. Nothing is
 * typed in:
 * - fair strikes, coupons, the pivot width, standard errors and the Monte Carlo statistics come
 *   from src/data/fx/mc-products.json (1’000’000 paths, `npm run data:mc`, D-28/D-29),
 * - the closed-form steps of the "better rate" story from src/lib/structures.ts,
 * - every scenario number from the path simulator logic (src/lib/pathsim.ts) with the same
 *   settings the figures use (MC_CONFIG.scenarios and PATHSIM_CONFIG.presets),
 * - the dual currency numbers from src/lib/dcicalc.ts (closed form, src/lib/fx/mc/dci.ts).
 * Units: rates in CHF per USD, pips = 0.0001, money in CHF unless stated.
 */
import { EXAMPLE as E } from '@/lib/fx/example';
import { MC_PRODUCTS, fairProduct } from '@/lib/fx/mc/fair';
import { MC_CONFIG, PIP } from '@/lib/fx/mc/products';
import { finiteChf, maxLoss } from '@/lib/fx/mc/maxloss';
import { gkPrice } from '@/lib/fx/vanilla';
import { digitalCash } from '@/lib/fx/exotics/digital';
import { DCI_CONFIG, dciOutcome, dciView, defaultFixing } from '@/lib/dcicalc';
import {
  PATHSIM_CONFIG,
  earlyEndFixings,
  forwardToDay,
  playState,
  simProduct,
  simulate,
  type ScenarioSettings,
  type SimKind,
} from '@/lib/pathsim';
import { storyStages } from '@/lib/structures';
import type { NumTable } from './types';

const P = MC_PRODUCTS.products;
const pips = (x: number): number => x / PIP;
const year = MC_CONFIG.conventions.daysPerYear;

/**
 * End facts of one simulated scenario (the simulator shows the same numbers). The difference
 * product − benchmark is taken from the whole-franc amounts, as the simulator shows it, so the
 * three numbers in the text add up on screen.
 */
function scenario(kind: SimKind, s: ScenarioSettings) {
  const sim = simulate(kind, s);
  const end = playState(sim, sim.days);
  return {
    reason: sim.reason,
    endedAt: sim.endIndex + 1,
    firstLeveraged: sim.firstLeveraged + 1,
    pnl: end.cumPnl,
    bench: end.cumBench,
    diff: Math.round(end.cumPnl) - Math.round(end.cumBench),
    base: Math.abs(end.base),
    need: Math.abs(end.need),
    coupons: sim.rows.filter((r) => r.kind === 'coupon').length,
    leveraged: sim.rows.filter((r) => r.leveraged).length,
  };
}

/**
 * Closed-form fair coupon of a coupon strip without target (Garman-Kohlhagen). `rf` defaults to
 * the USD rate of the example; rf = rd shows the coupon without the interest differential.
 */
function couponWithoutTarget(kind: 'tpf' | 'rtpf', rf: number = MC_CONFIG.market.rf): number {
  const { spot: S, vol, rd } = MC_CONFIG.market;
  let sold = 0;
  let digital = 0;
  if (kind === 'tpf') {
    const p = fairProduct('tpf');
    for (const d of p.fixingDays) {
      const T = d / year;
      sold += p.leverage * gkPrice(S, p.strike, T, vol, rd, rf, 'put');
      digital += digitalCash(S, p.strike, T, vol, rd, rf, 'call');
    }
  } else {
    const p = fairProduct('rtpf');
    for (const d of p.fixingDays) {
      const T = d / year;
      sold +=
        p.leverage *
        (gkPrice(S, p.lower, T, vol, rd, rf, 'put') + gkPrice(S, p.upper, T, vol, rd, rf, 'call'));
      digital +=
        digitalCash(S, p.lower, T, vol, rd, rf, 'call') -
        digitalCash(S, p.upper, T, vol, rd, rf, 'call');
    }
  }
  return sold / digital;
}

const acc = fairProduct('accumulator');
const dec = fairProduct('decumulator');
const tarf = fairProduct('tarf');
const piv = fairProduct('pivotTarf');
/**
 * Coupon products with the contractual coupon: the Monte Carlo fair coupon rounded to the quote
 * step (0.1 pip, PATHSIM_CONFIG.couponQuoteStep). Every paid coupon and every maximum gain in
 * modules 08 and 09 comes from it; the unrounded fair coupon is shown only as «fairer Coupon
 * (Monte Carlo) ± Standardfehler» (tpfFairCouponPips, tpfSePips).
 */
const tpf = simProduct('tpf');
const rtpf = simProduct('rtpf');
/**
 * The products behind every number of this module, exactly as the texts and the simulator use
 * them (tests check the maximum loss and the kernels on these very objects).
 */
export const M08_PRODUCTS = {
  accumulator: acc,
  decumulator: dec,
  tarf,
  pivotTarf: piv,
  tpf,
  rtpf,
} as const;
/** Theoretical maximum loss per side, typed (src/lib/fx/mc/maxloss.ts). */
export const M08_MAX_LOSS = {
  accumulator: maxLoss(acc),
  decumulator: maxLoss(dec),
  tarf: maxLoss(tarf),
  pivotTarf: maxLoss(piv),
  tpf: maxLoss(tpf),
  rtpf: maxLoss(rtpf),
} as const;
const ML = M08_MAX_LOSS;
const accStory = storyStages('accumulator');
const tarfStory = storyStages('tarf');
const decStory = storyStages('decumulator');
const presets = PATHSIM_CONFIG.presets;

const accUp = scenario('accumulator', { name: 'trendUp' });
const accSide = scenario('accumulator', { name: 'sideways' });
const accDown = scenario('accumulator', presets.strongDown);
const tarfUp = scenario('tarf', { name: 'trendUp' });
const tarfShock = scenario('tarf', presets.earlyShock);
const pivShock = scenario('pivotTarf', presets.earlyShock);
const tpfSide = scenario('tpf', { name: 'sideways' });
const tpfDown = scenario('tpf', presets.strongDown);
const rtpfUp = scenario('rtpf', { name: 'trendUp' });

/** Mean number of fixings of the paths that end early (knock-out or target), from MC. */
function earlyFix(kind: SimKind, pEarly: number): number {
  const st = P[kind].stats;
  const n = P[kind].product.fixingDays.length;
  return earlyEndFixings(st.expectedFixings, st.pMaturity, pEarly, n) ?? Number.NaN;
}

const tpfLastDay = tpf.fixingDays[tpf.fixingDays.length - 1]!;
const tpfForwardEnd = forwardToDay(tpfLastDay);
/** Day on which the forward falls to the TPF strike: ln(S / K) / (rf − rd) · 365. */
const tpfCrossDay = (Math.log(E.spot / tpf.strike) / (E.rf - E.rd)) * year;

const dci = dciView(DCI_CONFIG.capital.initial, 1, DCI_CONFIG.distance.initial);
const dciFixing = defaultFixing(dci);
const dciOut = dciOutcome(dci, dciFixing);
const dci3 = dciView(DCI_CONFIG.capital.initial, 3, DCI_CONFIG.distance.initial);

/** Raw values for the quiz and tests (rates in CHF per USD, money in CHF unless noted). */
export const M08 = {
  paths: MC_PRODUCTS.engine.paths,
  // accumulator
  accStrike: acc.strike,
  accSePips: P.accumulator.stdErrPips,
  accFwd: P.accumulator.forwardAvg,
  accBetterPips: -pips(acc.strike - P.accumulator.forwardAvg),
  accBarrier: acc.barrier,
  accFixings: acc.fixingDays.length,
  accNotional: acc.notional,
  accAvgDay: P.accumulator.avgFixingDay,
  accK2: accStory[1]!.strike,
  accK2Pips: -pips(accStory[1]!.strike - accStory[0]!.strike),
  accKoPips: -pips(accStory[2]!.strike - accStory[1]!.strike),
  /** Fixing below which a leveraged fixing loses more than the forward: 2K − F. */
  accBreakLev: 2 * acc.strike - P.accumulator.forwardAvg,
  accPKo: P.accumulator.stats.pKnockOut,
  accExpFix: P.accumulator.stats.expectedFixings,
  /** Mean fixing of the knock-out among the paths that are knocked out. */
  accKoFix: earlyFix('accumulator', P.accumulator.stats.pKnockOut),
  accQ05: P.accumulator.stats.pvQuantile05,
  accWorst: P.accumulator.stats.pvMin,
  /** Theoretical maximum loss (CHF, > 0): every fixing at S = 0, fixings × 2 × N × K. */
  accMaxLoss: finiteChf(ML.accumulator.down),
  accUp,
  accSide,
  accDown,
  accDownMove: presets.strongDown.move,
  // decumulator
  decStrike: dec.strike,
  decBetterPips: pips(dec.strike - P.decumulator.forwardAvg),
  decBarrier: dec.barrier,
  decK2: decStory[1]!.strike,
  decSePips: P.decumulator.stdErrPips,
  decPKo: P.decumulator.stats.pKnockOut,
  decKoFix: earlyFix('decumulator', P.decumulator.stats.pKnockOut),
  /** Distance spot → barrier and forward → barrier in pips (why the decumulator gains more). */
  accFwdToBarrierPips: pips(acc.barrier - P.accumulator.forwardAvg),
  decFwdToBarrierPips: pips(P.decumulator.forwardAvg - dec.barrier),
  // TARF
  tarfStrike: tarf.strike,
  tarfSePips: P.tarf.stdErrPips,
  tarfFwd: P.tarf.forwardAvg,
  tarfBetterPips: -pips(tarf.strike - P.tarf.forwardAvg),
  tarfK2: tarfStory[1]!.strike,
  tarfTargetPips: pips(tarf.target),
  tarfTargetChf: tarf.target * tarf.notional,
  tarfFixings: tarf.fixingDays.length,
  tarfNotional: tarf.notional,
  tarfPTarget: P.tarf.stats.pTarget,
  tarfExpFix: P.tarf.stats.expectedFixings,
  /** Mean fixing at which the target is reached, among the paths that reach it. */
  tarfTargetFix: earlyFix('tarf', P.tarf.stats.pTarget),
  tarfQ05: P.tarf.stats.pvQuantile05,
  tarfWorst: P.tarf.stats.pvMin,
  /** Theoretical maximum loss (CHF, > 0): every fixing at S = 0, fixings × 2 × N × K. */
  tarfMaxLoss: finiteChf(ML.tarf.down),
  /**
   * Back-of-the-envelope loss of the paths without target: with PV = 0 (rd = 0, no discounting)
   * and every target path earning the full target, P(target) · target · N + P(maturity) · L = 0.
   */
  tarfImpliedLoss: (-P.tarf.stats.pTarget * tarf.target * tarf.notional) / P.tarf.stats.pMaturity,
  tarfPMaturity: P.tarf.stats.pMaturity,
  tarfUp,
  tarfShock,
  shockGap: presets.earlyShock.gap,
  shockDay: presets.earlyShock.gapDay,
  // pivot TARF
  pivPivot: piv.pivot,
  pivK1: piv.lowerStrike,
  pivK2: piv.upperStrike,
  pivWidthPips: pips(P.pivotTarf.value),
  pivSePips: P.pivotTarf.stdErrPips,
  pivTargetPips: pips(piv.target),
  pivTargetChf: piv.target * piv.notional,
  pivPTarget: P.pivotTarf.stats.pTarget,
  pivExpFix: P.pivotTarf.stats.expectedFixings,
  pivTargetFix: earlyFix('pivotTarf', P.pivotTarf.stats.pTarget),
  pivQ05: P.pivotTarf.stats.pvQuantile05,
  pivWorst: P.pivotTarf.stats.pvMin,
  /** Theoretical loss downwards (every fixing at S = 0, × K1); upwards above K2 it is unlimited. */
  pivMaxLossDown: finiteChf(ML.pivotTarf.down),
  pivShock,
  // TPF
  tpfStrike: tpf.strike,
  tpfStrikeVsSpot: tpf.strike / E.spot - 1,
  /** Contractual coupon per fixing (fair coupon rounded to the quote step). */
  tpfCouponPips: pips(tpf.coupon),
  /** Unrounded Monte Carlo fair coupon; shown only with its standard error. */
  tpfFairCouponPips: pips(P.tpf.value),
  tpfSePips: P.tpf.stdErrPips,
  tpfCouponChf: tpf.coupon * tpf.notional,
  tpfMaxChf: tpf.coupon * tpf.notional * tpf.targetCoupons,
  tpfTargetCoupons: tpf.targetCoupons,
  tpfNotional: tpf.notional,
  tpfFixings: tpf.fixingDays.length,
  tpfCouponNoTargetPips: pips(couponWithoutTarget('tpf')),
  /** Same strip if the USD rate equalled the CHF rate: no interest differential, flat forward. */
  tpfCouponNoDriftPips: pips(couponWithoutTarget('tpf', MC_CONFIG.market.rd)),
  tpfFwdAvg: P.tpf.forwardAvg,
  tpfFwdEnd: tpfForwardEnd,
  tpfStrikeOverFwdEndPips: pips(tpf.strike - tpfForwardEnd),
  tpfCrossDay,
  tpfCrossMonth: (tpfCrossDay * 12) / year,
  tpfFwdDropPips: -pips(tpfForwardEnd - E.spot),
  tpfPTarget: P.tpf.stats.pTarget,
  tpfExpFix: P.tpf.stats.expectedFixings,
  tpfQ05: P.tpf.stats.pvQuantile05,
  tpfWorst: P.tpf.stats.pvMin,
  /** Theoretical maximum loss (CHF, > 0): every fixing at S = 0, fixings × 2 × N × K. */
  tpfMaxLoss: finiteChf(ML.tpf.down),
  tpfSide,
  tpfDown,
  // RTPF
  rtpfLower: rtpf.lower,
  rtpfUpper: rtpf.upper,
  rtpfCouponPips: pips(rtpf.coupon),
  rtpfFairCouponPips: pips(P.rtpf.value),
  rtpfSePips: P.rtpf.stdErrPips,
  rtpfCouponChf: rtpf.coupon * rtpf.notional,
  rtpfMaxChf: rtpf.coupon * rtpf.notional * rtpf.targetCoupons,
  rtpfCouponNoTargetPips: pips(couponWithoutTarget('rtpf')),
  rtpfPTarget: P.rtpf.stats.pTarget,
  rtpfQ05: P.rtpf.stats.pvQuantile05,
  rtpfWorst: P.rtpf.stats.pvMin,
  /** Theoretical loss downwards (every fixing at S = 0, × L); upwards above U it is unlimited. */
  rtpfMaxLossDown: finiteChf(ML.rtpf.down),
  rtpfUp,
  // dual currency
  dciCapital: dci.capital,
  dciDays: dci.days,
  dciStrike: dci.product.strike,
  dciDistance: dci.distance,
  dciForward: dci.forward,
  dciStrikeVsFwdPips: dci.strikeVsForwardPips,
  dciPremium: dci.quote.premium,
  dciYield: dci.quote.yieldPa,
  dciMm: dci.quote.moneyMarketRate,
  dciInterest: dci.quote.interest,
  dciBreakEven: dci.quote.breakEven,
  dciUsd: dci.quote.conversionAmountBase,
  dciPConv: dci.pConversion,
  dciFixing,
  dciOutValue: dciOut.valueQuote,
  dciOutDiff: dciOut.vsDepositQuote,
  dci3Yield: dci3.quote.yieldPa,
  dci3Interest: dci3.quote.interest,
} as const;

const M = M08;

export const nums: NumTable = {
  'm08.paths': {
    value: M.paths,
    kind: 'num',
    digits: 0,
    note: 'Monte Carlo paths of the fair values',
  },

  // Accumulator
  'm08.accStrike': { value: M.accStrike, kind: 'rate', note: 'Fair accumulator strike (MC)' },
  'm08.accSe': { value: M.accSePips, kind: 'pips', note: 'Standard error of the fair strike' },
  'm08.accFwd': { value: M.accFwd, kind: 'rate', note: 'Forward at the average fixing day' },
  'm08.accBetter': {
    value: M.accBetterPips,
    kind: 'pips',
    digits: 0,
    note: 'Forward − fair strike, whole pips like the 4-decimal rates it compares',
  },
  'm08.accBarrier': { value: M.accBarrier, kind: 'rate' },
  'm08.barrierDist': {
    value: Math.abs(M.accBarrier / E.spot - 1),
    kind: 'pct',
    digits: 0,
    note: 'Distance of both barriers from spot (§8.7: spot ± 3 %)',
  },
  'm08.accFixings': { value: M.accFixings, kind: 'num', digits: 0 },
  'm08.accNotional': { value: M.accNotional, kind: 'money', ccy: 'USD' },
  'm08.accTotal': {
    value: M.accNotional * M.accFixings,
    kind: 'money',
    ccy: 'USD',
    note: 'N × fixings',
  },
  'm08.accTotalMax': {
    value: 2 * M.accNotional * M.accFixings,
    kind: 'money',
    ccy: 'USD',
    note: '2N × fixings',
  },
  'm08.accAvgDay': { value: M.accAvgDay, kind: 'num', digits: 1, note: 'Average fixing day' },
  'm08.accK2': {
    value: M.accK2,
    kind: 'rate',
    note: 'Zero-cost strike of call + 2 puts, no KO (closed form)',
  },
  'm08.accK2Pips': { value: M.accK2Pips, kind: 'pips', note: 'Forward − K2' },
  'm08.accKoPips': {
    value: M.accKoPips,
    kind: 'pips',
    note: 'K2 − fair strike (effect of the KO)',
  },
  'm08.accBreakLev': { value: M.accBreakLev, kind: 'rate', note: '2K − F' },
  'm08.accPKo': { value: M.accPKo, kind: 'pct', note: 'P(knock-out), MC' },
  'm08.accExpFix': { value: M.accExpFix, kind: 'num', digits: 1, note: 'Mean life, all paths' },
  'm08.accKoFix': {
    value: M.accKoFix,
    kind: 'num',
    digits: 1,
    note: 'Mean knock-out fixing of the knocked-out paths',
  },
  'm08.accQ05': { value: M.accQ05, kind: 'money', note: '5 % quantile of path PV' },
  'm08.accWorst': { value: M.accWorst, kind: 'money', note: 'Worst path PV' },
  'm08.accMaxLoss': {
    value: M.accMaxLoss,
    kind: 'money',
    note: 'Theoretical maximum loss, every fixing at S = 0 (src/lib/fx/mc/maxloss.ts)',
  },
  'm08.accUpKo': {
    value: M.accUp.endedAt,
    kind: 'num',
    digits: 0,
    note: 'Knock-out fixing, trend up',
  },
  'm08.accUpUsd': { value: M.accUp.base, kind: 'money', ccy: 'USD' },
  'm08.accUpPnl': { value: M.accUp.pnl, kind: 'money', sign: true },
  'm08.accUpFwd': { value: M.accUp.bench, kind: 'money', sign: true },
  'm08.accUpDiff': { value: M.accUp.diff, kind: 'money', sign: true },
  'm08.accSidePnl': { value: M.accSide.pnl, kind: 'money', sign: true },
  'm08.accSideFwd': { value: M.accSide.bench, kind: 'money', sign: true },
  'm08.accSideDiff': { value: M.accSide.diff, kind: 'money', sign: true },
  'm08.accDownMove': { value: M.accDownMove, kind: 'pct', digits: 0, note: 'Preset strongDown' },
  'm08.accDownFirstLev': {
    value: M.accDown.firstLeveraged,
    kind: 'num',
    digits: 0,
    note: 'First leveraged fixing, preset strongDown',
  },
  'm08.accDownUsd': { value: M.accDown.base, kind: 'money', ccy: 'USD' },
  'm08.accDownLev': {
    value: M.accDown.leveraged,
    kind: 'num',
    digits: 0,
    note: 'Leveraged fixings',
  },
  'm08.accDownPnl': { value: M.accDown.pnl, kind: 'money', sign: true },
  'm08.accDownFwd': { value: M.accDown.bench, kind: 'money', sign: true },
  'm08.accDownDiff': { value: M.accDown.diff, kind: 'money', sign: true },

  // Decumulator
  'm08.decStrike': { value: M.decStrike, kind: 'rate' },
  'm08.decBetter': { value: M.decBetterPips, kind: 'pips', digits: 0 },
  'm08.decSe': { value: M.decSePips, kind: 'pips' },
  'm08.decKoFix': { value: M.decKoFix, kind: 'num', digits: 1 },
  'm08.accFwdToBarrier': {
    value: M.accFwdToBarrierPips,
    kind: 'pips',
    digits: 0,
    note: 'Barrier − forward at the average fixing day',
  },
  'm08.decFwdToBarrier': {
    value: M.decFwdToBarrierPips,
    kind: 'pips',
    digits: 0,
    note: 'Forward at the average fixing day − barrier',
  },
  'm08.decBarrier': { value: M.decBarrier, kind: 'rate' },
  'm08.decPKo': { value: M.decPKo, kind: 'pct' },

  // TARF
  'm08.tarfStrike': { value: M.tarfStrike, kind: 'rate' },
  'm08.tarfSe': { value: M.tarfSePips, kind: 'pips' },
  'm08.tarfFwd': { value: M.tarfFwd, kind: 'rate' },
  'm08.tarfBetter': { value: M.tarfBetterPips, kind: 'pips', digits: 0 },
  'm08.tarfK2': { value: M.tarfK2, kind: 'rate', note: 'Strip without target (closed form)' },
  'm08.tarfTargetPips': { value: M.tarfTargetPips, kind: 'pips', digits: 0 },
  'm08.tarfTargetChf': { value: M.tarfTargetChf, kind: 'money' },
  'm08.tarfFixings': { value: M.tarfFixings, kind: 'num', digits: 0 },
  'm08.tarfNotional': { value: M.tarfNotional, kind: 'money', ccy: 'USD' },
  'm08.tarfTotal': { value: M.tarfNotional * M.tarfFixings, kind: 'money', ccy: 'USD' },
  'm08.tarfPTarget': { value: M.tarfPTarget, kind: 'pct' },
  'm08.tarfExpFix': { value: M.tarfExpFix, kind: 'num', digits: 1, note: 'Mean life, all paths' },
  'm08.tarfTargetFix': {
    value: M.tarfTargetFix,
    kind: 'num',
    digits: 1,
    note: 'Mean fixing of the target among the paths that reach it',
  },
  'm08.tarfQ05': { value: M.tarfQ05, kind: 'money' },
  'm08.tarfWorst': { value: M.tarfWorst, kind: 'money' },
  'm08.tarfMaxLoss': {
    value: M.tarfMaxLoss,
    kind: 'money',
    note: 'Theoretical maximum loss, every fixing at S = 0',
  },
  'm08.tarfPMaturity': { value: M.tarfPMaturity, kind: 'pct' },
  'm08.tarfImpliedLoss': {
    value: M.tarfImpliedLoss,
    kind: 'money',
    note: 'Implied mean loss of the paths without target (PV = 0)',
  },
  'm08.tarfUpEnd': { value: M.tarfUp.endedAt, kind: 'num', digits: 0 },
  'm08.tarfUpUsd': { value: M.tarfUp.base, kind: 'money', ccy: 'USD' },
  'm08.tarfUpPnl': { value: M.tarfUp.pnl, kind: 'money', sign: true },
  'm08.tarfUpFwd': { value: M.tarfUp.bench, kind: 'money', sign: true },
  'm08.tarfUpDiff': { value: M.tarfUp.diff, kind: 'money', sign: true },
  'm08.shockGap': { value: M.shockGap, kind: 'pct', digits: 0 },
  'm08.shockGapAbs': {
    value: Math.abs(M.shockGap),
    kind: 'pct',
    digits: 0,
    note: 'Size of the gap',
  },
  'm08.shockDay': { value: M.shockDay, kind: 'num', digits: 0 },
  'm08.tarfShockUsd': { value: M.tarfShock.base, kind: 'money', ccy: 'USD' },
  'm08.tarfShockLev': { value: M.tarfShock.leveraged, kind: 'num', digits: 0 },
  'm08.tarfShockPnl': { value: M.tarfShock.pnl, kind: 'money', sign: true },
  'm08.tarfShockFwd': { value: M.tarfShock.bench, kind: 'money', sign: true },
  'm08.tarfShockDiff': { value: M.tarfShock.diff, kind: 'money', sign: true },

  // Pivot TARF
  'm08.pivPivot': { value: M.pivPivot, kind: 'rate' },
  'm08.pivK1': { value: M.pivK1, kind: 'rate' },
  'm08.pivK2': { value: M.pivK2, kind: 'rate' },
  'm08.pivWidth': { value: M.pivWidthPips, kind: 'pips', digits: 0 },
  'm08.pivSe': { value: M.pivSePips, kind: 'pips' },
  'm08.pivTargetPips': { value: M.pivTargetPips, kind: 'pips', digits: 0 },
  'm08.pivTargetChf': { value: M.pivTargetChf, kind: 'money' },
  'm08.pivPTarget': { value: M.pivPTarget, kind: 'pct' },
  'm08.pivExpFix': { value: M.pivExpFix, kind: 'num', digits: 1, note: 'Mean life, all paths' },
  'm08.pivTargetFix': { value: M.pivTargetFix, kind: 'num', digits: 1 },
  'm08.pivQ05': { value: M.pivQ05, kind: 'money', sign: true },
  'm08.pivWorst': { value: M.pivWorst, kind: 'money' },
  'm08.pivMaxLossDown': {
    value: M.pivMaxLossDown,
    kind: 'money',
    note: 'Theoretical loss downwards, every fixing at S = 0 (upwards unlimited)',
  },
  'm08.pivShockPnl': { value: M.pivShock.pnl, kind: 'money', sign: true },

  // TPF
  'm08.tpfStrike': { value: M.tpfStrike, kind: 'rate' },
  'm08.tpfStrikeVsSpot': { value: M.tpfStrikeVsSpot, kind: 'pct', note: 'K / S − 1' },
  'm08.tpfBelowSpot': {
    value: Math.abs(M.tpfStrikeVsSpot),
    kind: 'pct',
    note: 'Distance of the strike below spot',
  },
  'm08.tpfCoupon': {
    value: M.tpfCouponPips,
    kind: 'pips',
    note: 'Contractual coupon: fair coupon rounded to the quote step; paid per fixing',
  },
  'm08.tpfFairCoupon': {
    value: M.tpfFairCouponPips,
    kind: 'pips',
    digits: 2,
    note: 'Fair coupon (Monte Carlo), unrounded; only shown with ± m08.tpfSe',
  },
  'm08.tpfSe': {
    value: M.tpfSePips,
    kind: 'pips',
    digits: 2,
    note: 'Standard error of the fair coupon',
  },
  'm08.couponQuote': {
    value: PATHSIM_CONFIG.couponQuoteStep / PIP,
    kind: 'pips',
    note: 'Quote step of the coupons (PATHSIM_CONFIG.couponQuoteStep)',
  },
  'm08.tpfCouponChf': { value: M.tpfCouponChf, kind: 'money' },
  'm08.tpfMaxChf': { value: M.tpfMaxChf, kind: 'money' },
  'm08.tpfTargetCoupons': { value: M.tpfTargetCoupons, kind: 'num', digits: 0 },
  'm08.tpfNotional': { value: M.tpfNotional, kind: 'money', ccy: 'USD' },
  'm08.tpfFixings': { value: M.tpfFixings, kind: 'num', digits: 0 },
  'm08.tpfCouponNoTarget': {
    value: M.tpfCouponNoTargetPips,
    kind: 'pips',
    note: 'Closed form without target',
  },
  'm08.tpfCouponNoDrift': {
    value: M.tpfCouponNoDriftPips,
    kind: 'pips',
    note: 'Closed form without target and without interest differential (rf = rd)',
  },
  'm08.tpfFwdAvg': { value: M.tpfFwdAvg, kind: 'rate' },
  'm08.tpfFwdEnd': { value: M.tpfFwdEnd, kind: 'rate', note: 'Forward to the last fixing' },
  'm08.tpfStrikeOverFwdEnd': { value: M.tpfStrikeOverFwdEndPips, kind: 'pips' },
  'm08.tpfFwdDrop': {
    value: M.tpfFwdDropPips,
    kind: 'pips',
    digits: 0,
    note: 'Spot − forward to the last fixing',
  },
  'm08.tpfCrossMonth': {
    value: M.tpfCrossMonth,
    kind: 'num',
    digits: 1,
    note: 'Month in which F = K',
  },
  'm08.tpfPTarget': { value: M.tpfPTarget, kind: 'pct' },
  'm08.tpfExpFix': { value: M.tpfExpFix, kind: 'num', digits: 1 },
  'm08.tpfQ05': { value: M.tpfQ05, kind: 'money' },
  'm08.tpfWorst': { value: M.tpfWorst, kind: 'money' },
  'm08.tpfMaxLoss': {
    value: M.tpfMaxLoss,
    kind: 'money',
    note: 'Theoretical maximum loss, every fixing at S = 0',
  },
  'm08.tpfSidePnl': { value: M.tpfSide.pnl, kind: 'money', sign: true },
  'm08.tpfDownCoupons': { value: M.tpfDown.coupons, kind: 'num', digits: 0 },
  'm08.tpfDownReceived': { value: M.tpfDown.bench, kind: 'money' },
  'm08.tpfDownPnl': { value: M.tpfDown.pnl, kind: 'money', sign: true },

  // RTPF
  'm08.rtpfLower': { value: M.rtpfLower, kind: 'rate' },
  'm08.rtpfUpper': { value: M.rtpfUpper, kind: 'rate' },
  'm08.rtpfCoupon': {
    value: M.rtpfCouponPips,
    kind: 'pips',
    note: 'Contractual coupon: fair coupon rounded to the quote step; paid per fixing',
  },
  'm08.rtpfFairCoupon': {
    value: M.rtpfFairCouponPips,
    kind: 'pips',
    digits: 2,
    note: 'Fair coupon (Monte Carlo), unrounded; only shown with ± m08.rtpfSe',
  },
  'm08.rtpfSe': {
    value: M.rtpfSePips,
    kind: 'pips',
    digits: 2,
    note: 'Standard error of the fair coupon',
  },
  'm08.rtpfCouponChf': { value: M.rtpfCouponChf, kind: 'money' },
  'm08.rtpfMaxChf': { value: M.rtpfMaxChf, kind: 'money' },
  'm08.rtpfCouponNoTarget': { value: M.rtpfCouponNoTargetPips, kind: 'pips' },
  'm08.rtpfPTarget': { value: M.rtpfPTarget, kind: 'pct' },
  'm08.rtpfQ05': { value: M.rtpfQ05, kind: 'money' },
  'm08.rtpfWorst': { value: M.rtpfWorst, kind: 'money' },
  'm08.rtpfMaxLossDown': {
    value: M.rtpfMaxLossDown,
    kind: 'money',
    note: 'Theoretical loss downwards, every fixing at S = 0 (upwards unlimited)',
  },
  'm08.rtpfUpCoupons': { value: M.rtpfUp.coupons, kind: 'num', digits: 0 },
  'm08.rtpfUpReceived': { value: M.rtpfUp.bench, kind: 'money' },
  'm08.rtpfUpPnl': { value: M.rtpfUp.pnl, kind: 'money', sign: true },

  // Dual currency
  'm08.dciCapital': { value: M.dciCapital, kind: 'money' },
  'm08.dciDays': { value: M.dciDays, kind: 'num', digits: 0 },
  'm08.dciStrike': { value: M.dciStrike, kind: 'rate' },
  'm08.dciDistance': { value: M.dciDistance, kind: 'pct', digits: 0 },
  'm08.dciForward': { value: M.dciForward, kind: 'rate' },
  'm08.dciStrikeVsFwd': { value: M.dciStrikeVsFwdPips, kind: 'pips', digits: 0 },
  'm08.dciStrikeVsFwdAbs': {
    value: Math.abs(M.dciStrikeVsFwdPips),
    kind: 'pips',
    digits: 0,
    note: 'Distance strike to forward',
  },
  'm08.dciFixBelow': {
    value: DCI_CONFIG.initialFixingBelowStrike,
    kind: 'pct',
    digits: 0,
    note: 'Fixing below the strike in the example outcome',
  },
  'm08.dciPremium': { value: M.dciPremium, kind: 'money' },
  'm08.dciYield': { value: M.dciYield, kind: 'pct', digits: 2 },
  'm08.dciMm': { value: M.dciMm, kind: 'pct', digits: 2 },
  'm08.dciInterest': { value: M.dciInterest, kind: 'money' },
  'm08.dciBreakEven': { value: M.dciBreakEven, kind: 'rate' },
  'm08.dciUsd': { value: M.dciUsd, kind: 'money', ccy: 'USD' },
  'm08.dciPConv': { value: M.dciPConv, kind: 'pct' },
  'm08.dciFixing': { value: M.dciFixing, kind: 'rate' },
  'm08.dciOutValue': { value: M.dciOutValue, kind: 'money' },
  'm08.dciOutDiff': { value: M.dciOutDiff, kind: 'money', sign: true },
  'm08.dci3Yield': { value: M.dci3Yield, kind: 'pct', digits: 2 },
  'm08.dci3Interest': { value: M.dci3Interest, kind: 'money' },
};
