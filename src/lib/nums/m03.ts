/**
 * Numbers of module 03 (FX Swap) for <Num of="m03.…" />. Everything is computed from the
 * running example (src/lib/fx/example.ts) and the teaching choices in M03_CONFIG
 * (src/lib/m03/config.ts) with the calculation core; nothing is typed in.
 *
 * USD/CHF spot 0.8000, CHF rate (quote, rd) 0 %, USD rate (base, rf) 3.5 %, money market
 * Act/360, USD 1 Mio. `M03` holds the raw values for the quiz file and the tests.
 */
import { compareSwaps } from '@/lib/m03/compare';
import { M03_CONFIG, tenorById } from '@/lib/m03/config';
import { swapLegs } from '@/lib/m03/legs';
import { allInRange, rollView } from '@/lib/m03/roll';
import { EXAMPLE_MARKET as MK, roundTripChf, tripSwap } from '@/lib/m03/trip';
import type { NumTable } from './types';

const C = M03_CONFIG;
const N = C.market.notional;
const RD = C.rateDigits;
const T = C.trip;
const R = C.roll;

const trip = tripSwap(MK, T.days);
const legs = swapLegs({ ...MK, days: C.market.days, side: 'buySellBase' });
const mirror = swapLegs({ ...MK, days: C.market.days, side: 'sellBuyBase' });
const legsAt = (id: string) =>
  swapLegs({ ...MK, days: tenorById(C.legs.tenors, id).days, side: 'buySellBase' });
const w1 = legsAt('1W');
const y1 = legsAt('1Y');
const slip = tenorById(R.slips, R.defaultSlip).days;
const rollBase = { oldForward: R.oldForward, notional: N, rd: MK.rd, rf: MK.rf, extraDays: slip };
const up = rollView({ ...rollBase, spotAtRoll: R.scenarioUp });
const down = rollView({ ...rollBase, spotAtRoll: R.scenarioDown });
const spread = allInRange(rollBase, R.spotRange);
const cmp1y = compareSwaps(MK, tenorById(C.compare.tenors, '1Y').days);
const cmp5y = compareSwaps(MK, tenorById(C.compare.tenors, '5Y').days);

/** Raw values (CHF per USD for rates, CHF for money unless noted) for the quiz and tests. */
export const M03 = {
  trip,
  legs,
  mirror,
  w1,
  y1,
  up,
  down,
  spread,
  cmp1y,
  cmp5y,
  slipDays: slip,
  oldForward: R.oldForward,
} as const;

export const nums: NumTable = {
  // Section 1: a firm needs USD for one month (buy/sell USD 1 Mio., 30 days)
  'm03.tripDays': { value: T.days, kind: 'num', digits: 0, note: 'Days of the trip swap' },
  'm03.nearChf': {
    value: trip.nearChf,
    kind: 'money',
    note: 'CHF paid in the near leg, N · S (same for every tenor)',
  },
  'm03.tripFar': { value: trip.swap.farRate, kind: 'rate', digits: RD, note: '1M far rate' },
  'm03.tripFarChf': { value: trip.farChf, kind: 'money', note: 'CHF back after one month' },
  'm03.tripCostChf': { value: trip.costChf, kind: 'money', note: 'Price of the 1M swap' },
  'm03.tripPoints': { value: trip.swap.swapPoints, kind: 'pips', note: '1M swap points' },
  'm03.tripUsdInterest': {
    value: trip.usdInterest,
    kind: 'money',
    ccy: 'USD',
    note: 'USD interest for 30 days on USD 1 Mio.',
  },
  'm03.tripUp': { value: T.scenarioUp, kind: 'rate', note: 'Scenario: spot in one month' },
  'm03.tripUpChf': {
    value: roundTripChf(MK, T.scenarioUp),
    kind: 'money',
    sign: true,
    note: 'Open round trip result at the up scenario',
  },
  'm03.tripDown': { value: T.scenarioDown, kind: 'rate', note: 'Scenario: spot in one month' },
  'm03.tripDownChf': {
    value: roundTripChf(MK, T.scenarioDown),
    kind: 'money',
    note: 'Open round trip result at the down scenario',
  },

  // Section 2: near and far leg (3M, the example)
  'm03.farChf': { value: legs.rows[1].quote, kind: 'money', note: 'CHF received in the far leg' },
  'm03.netChf': { value: legs.net.quote, kind: 'money', note: 'Net CHF of buy/sell, 3M' },
  'm03.costChf': { value: -legs.net.quote, kind: 'money', note: 'Price of the 3M buy/sell' },
  'm03.mirrorNetChf': {
    value: mirror.net.quote,
    kind: 'money',
    sign: true,
    note: 'Net CHF of sell/buy, 3M',
  },
  'm03.usdInterest': {
    value: legs.baseInterest,
    kind: 'money',
    ccy: 'USD',
    note: 'USD interest for 90 days',
  },
  'm03.diff': { value: legs.diff, kind: 'pct', note: 'Rate differential rd − rf' },
  'm03.approxPoints': {
    value: legs.approxPoints,
    kind: 'pips',
    note: 'Linear approximation S · (rd − rf) · 90/360',
  },
  'm03.points1w': { value: w1.points, kind: 'pips', note: 'Swap points 1 week' },
  'm03.points1y': { value: y1.points, kind: 'pips', note: 'Swap points 1 year (365 days)' },

  // Section 3: rolling the importer's forward by one month
  'm03.oldFwd': { value: R.oldForward, kind: 'rate', digits: RD, note: 'Maturing forward' },
  'm03.oldFwdChf': { value: N * R.oldForward, kind: 'money', note: 'CHF due under the forward' },
  'm03.slipDays': { value: slip, kind: 'num', digits: 0, note: 'Days the payment slips' },
  'm03.rollUp': { value: R.scenarioUp, kind: 'rate', note: 'Spot at the roll date (up)' },
  'm03.rollNearChfUp': { value: N * R.scenarioUp, kind: 'money', note: 'Near leg CHF (up)' },
  'm03.rollPointsUp': { value: up.points, kind: 'pips', note: 'Roll swap points (up)' },
  'm03.rollFarUp': { value: up.farRate, kind: 'rate', digits: RD, note: 'New far rate (up)' },
  'm03.rollFarChfUp': { value: up.farChf, kind: 'money', note: 'CHF at the new date (up)' },
  'm03.rollSettleUp': {
    value: up.settlement,
    kind: 'money',
    sign: true,
    note: 'Cash settlement at the roll date (up): importer receives',
  },
  'm03.rollAllInUp': { value: up.allIn, kind: 'rate', digits: RD, note: 'All-in rate (up)' },
  'm03.rollTotalUp': { value: up.totalChf, kind: 'money', note: 'CHF in total (up)' },
  'm03.rollDown': { value: R.scenarioDown, kind: 'rate', note: 'Spot at the roll date (down)' },
  'm03.rollNearChfDown': { value: N * R.scenarioDown, kind: 'money', note: 'Near leg CHF (down)' },
  'm03.rollPointsDown': { value: down.points, kind: 'pips', note: 'Roll swap points (down)' },
  'm03.rollFarDown': { value: down.farRate, kind: 'rate', digits: RD, note: 'New far (down)' },
  'm03.rollFarChfDown': { value: down.farChf, kind: 'money', note: 'CHF at the new date (down)' },
  'm03.rollSettleDown': {
    value: down.settlement,
    kind: 'money',
    note: 'Cash settlement at the roll date (down): importer pays',
  },
  'm03.rollSettleDownAbs': {
    value: -down.settlement,
    kind: 'money',
    note: 'Amount the importer pays at the roll (down)',
  },
  'm03.rollAllInDown': { value: down.allIn, kind: 'rate', digits: RD, note: 'All-in (down)' },
  'm03.rollTotalDown': { value: down.totalChf, kind: 'money', note: 'CHF in total (down)' },
  'm03.rollAllInGap': {
    value: (down.allIn - up.allIn) / 1e-4,
    kind: 'pips',
    note: 'All-in difference between the two scenarios',
  },
  'm03.rollSpreadPips': {
    value: spread.spreadPips,
    kind: 'pips',
    note: 'All-in range over the whole slider range of the roll-date spot',
  },
  'm03.rollRangeLo': { value: R.spotRange[0], kind: 'rate', note: 'Slider range low' },
  'm03.rollRangeHi': { value: R.spotRange[1], kind: 'rate', note: 'Slider range high' },

  // Section 4: FX swap vs cross-currency swap
  'm03.fwd1y': { value: cmp1y.fxSwap.endRate, kind: 'rate', digits: RD, note: '1Y far rate' },
  'm03.fxCost1y': { value: cmp1y.fxCostChf, kind: 'money', note: '1Y FX swap: CHF shortfall' },
  'm03.ccsCoupon': {
    value: cmp1y.ccsCouponBase,
    kind: 'money',
    ccy: 'USD',
    note: 'Annual USD coupon of the CCS (365 days Act/360)',
  },
  'm03.ccsCouponChf': {
    value: cmp1y.ccsCouponQuote,
    kind: 'money',
    note: 'Annual CHF coupon of the CCS (zero at a CHF rate of 0 %)',
  },
  'm03.fwd5y': { value: cmp5y.fxSwap.endRate, kind: 'rate', digits: RD, note: '5Y far rate' },
  'm03.pv5y': { value: cmp5y.pvFxChf, kind: 'money', note: '5Y: PV of the differential' },
};
