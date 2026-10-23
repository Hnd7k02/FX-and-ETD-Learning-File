/**
 * Numbers of module 02 (Forward) for <Num of="m02.…" />. Everything is computed from the
 * running example (src/lib/fx/example.ts) and the teaching choices in M02_CONFIG
 * (src/lib/m02/config.ts) with the calculation core; nothing is typed in.
 *
 * USD/CHF spot 0.8000, CHF rate (quote, rd) 0 %, USD rate (base, rf) 3.5 %, 90 days Act/360,
 * USD 1 Mio. The forward the importer deals is the money-market forward (M02_CONFIG).
 * `M02` holds the raw values for the quiz file and the tests.
 */
import { dayBasis, yearFraction } from '@/lib/fx/daycount';
import { forwardContinuous } from '@/lib/fx/forward';
import { M02_CONFIG, PIP } from '@/lib/m02/config';
import { carryFor, startMarket } from '@/lib/m02/carry';
import { curvePoint, pointsApprox } from '@/lib/m02/curve';
import { dealForward, defaultScenarios, scenarioStats } from '@/lib/m02/hedge';
import { parity } from '@/lib/m02/parity';
import type { NumTable } from './types';

const M = M02_CONFIG.market;
const H = M02_CONFIG.hedge;
const C = M02_CONFIG.curve;
const N = M.notional;
const FD = M02_CONFIG.forwardDigits;

const F = dealForward();
const par = parity({
  spot: M.spot,
  rd: M.rd,
  rf: M.rf,
  days: M.days,
  notional: N,
  basisQuote: M.basisQuote,
  basisBase: M.basisBase,
});
const fCont = forwardContinuous(M.spot, M.rd, M.rf, M.T);
/**
 * "3 months" is stylised: the money market counts 90/360, the option model T = 0.25 years
 * (= 91.25 days at Act/365). For the exact same 90 days the option model has T = 90/365.
 */
const daysT = M.T * dayBasis('ACT/365');
const fCont90 = forwardContinuous(M.spot, M.rd, M.rf, yearFraction(M.days, 'ACT/365'));
const scn = scenarioStats(defaultScenarios(F), F, N);
const curveMarket = {
  spot: M.spot,
  rd: M.rd,
  rf: M.rf,
  basisQuote: M.basisQuote,
  basisBase: M.basisBase,
};
const tenor = (id: string) => {
  const t = C.tenors.find((x) => x.id === id);
  if (!t) throw new Error(`m02: tenor ${id} missing in M02_CONFIG.curve.tenors`);
  return curvePoint(curveMarket, t);
};
const p3m = curvePoint(curveMarket, { id: '3M', days: M.days });
const p1y = tenor('1Y');
const what = curvePoint({ ...curveMarket, rd: C.whatIfRd }, { id: '3M', days: M.days });
const arbHigh = carryFor(startMarket(F));
const arbLow = carryFor(F - M02_CONFIG.arbitrage.mispricingPips * PIP);

/** Raw values (quote currency per 1 USD unless noted) for the quiz file and tests. */
export const M02 = {
  F,
  fCont,
  fCont90,
  daysT,
  fwdChf: N * F,
  spotChf: N * M.spot,
  upChf: N * H.stUp,
  downChf: N * H.stDown,
  usdToday: par.usdToday,
  chfLoan: par.chfLoan,
  points: p3m.points,
  costPips: p3m.costPips,
  benefitPips: p3m.benefitPips,
  points1Y: p1y.points,
  fwd1Y: p1y.forward,
  whatIf: what,
  arbMarket: arbHigh.marketForward,
  arbMarketLow: arbLow.marketForward,
  arbGapPips: arbHigh.mispricingPips,
  arbProfit: arbHigh.profitQuote,
  arbChfIn: N * arbHigh.marketForward,
  scn,
} as const;

export const nums: NumTable = {
  // Section 1: intuition
  'm02.fwd': { value: F, kind: 'rate', digits: FD, note: 'Deal forward (money market)' },
  'm02.fwdChf': { value: N * F, kind: 'money', note: 'CHF cost of USD 1 Mio. with the forward' },
  'm02.spotChf': { value: N * M.spot, kind: 'money', note: 'USD 1 Mio. at spot today' },
  'm02.discountPips': {
    value: Math.abs(p3m.points),
    kind: 'pips',
    note: 'Forward below spot, in pips (absolute)',
  },
  'm02.belowSpotChf': { value: N * (M.spot - F), kind: 'money', note: 'Spot cost − forward cost' },
  'm02.stUp': { value: H.stUp, kind: 'rate', note: 'Strong dollar at expiry (choice)' },
  'm02.stDown': { value: H.stDown, kind: 'rate', note: 'Weak dollar at expiry (choice)' },
  'm02.upChf': { value: N * H.stUp, kind: 'money' },
  'm02.downChf': { value: N * H.stDown, kind: 'money' },
  'm02.saveUpChf': { value: N * (H.stUp - F), kind: 'money', note: 'Forward saves vs unhedged' },
  'm02.missDownChf': { value: N * (F - H.stDown), kind: 'money', note: 'Chance given up' },
  'm02.fwdValueUp': {
    value: N * (H.stUp - F),
    kind: 'money',
    sign: true,
    note: 'Value of the long USD forward at expiry if S_T = stUp',
  },
  'm02.fwdValueDown': {
    value: N * (H.stDown - F),
    kind: 'money',
    sign: true,
    note: 'Value of the long USD forward at expiry if S_T = stDown',
  },
  'm02.scnCount': { value: scn.n, kind: 'num', digits: 0, note: 'Model scenarios in figure (a)' },
  'm02.scnMin': { value: scn.min, kind: 'money' },
  'm02.scnMax': { value: scn.max, kind: 'money' },
  'm02.scnSpread': { value: scn.spread, kind: 'money' },
  'm02.scnCheaper': { value: scn.forwardCheaper, kind: 'num', digits: 0 },
  'm02.scnDearer': { value: scn.forwardDearer, kind: 'num', digits: 0 },
  'm02.scnMean': { value: scn.mean, kind: 'money', note: 'Average unhedged cost (model)' },

  // Section 2: interest rate parity
  'm02.t': { value: par.tq, kind: 'num', digits: 2, note: 'Year fraction 90/360' },
  'm02.growthUsd': { value: par.growthBase, kind: 'num', digits: 5, note: '1 + rf · 90/360' },
  'm02.growthChf': { value: par.growthQuote, kind: 'num', digits: 5, note: '1 + rd · 90/360' },
  'm02.usdToday': { value: par.usdToday, kind: 'money', ccy: 'USD', note: 'B0 = N / (1 + rf·t)' },
  'm02.usdInterest': { value: par.usdInterest, kind: 'money', ccy: 'USD' },
  'm02.chfLoan': { value: par.chfLoan, kind: 'money', note: 'Q0 = S · B0' },
  'm02.chfInterest': { value: par.chfInterest, kind: 'money' },
  'm02.chfRepay': { value: par.chfRepay, kind: 'money', note: 'Q0 · (1 + rd·t) = N · F' },
  'm02.dfMM': {
    value: 1 / par.growthBase,
    kind: 'num',
    digits: 6,
    note: 'USD discount factor, money market',
  },
  'm02.dfCont': {
    value: Math.exp(-M.rf * M.T),
    kind: 'num',
    digits: 6,
    note: 'USD discount factor, continuous',
  },
  'm02.rfCont': {
    value: Math.log(par.growthBase) / M.T,
    kind: 'pct',
    digits: 3,
    note: 'Continuous rate equivalent to the simple USD rate over 90 days',
  },
  'm02.fwdDiffChf': {
    value: N * Math.abs(F - fCont),
    kind: 'money',
    note: 'Gap money market vs continuous on USD 1 Mio. (same T = 0.25 in both)',
  },
  'm02.daysT': {
    value: daysT,
    kind: 'num',
    digits: 2,
    note: 'Days behind the option model T = 0.25 at Act/365 (stylised "3 months")',
  },
  'm02.fwdCont90': {
    value: fCont90,
    kind: 'rate',
    digits: FD,
    note: 'Continuous forward for the exact 90 days, T = 90/365',
  },
  'm02.fwdCont90DiffPips': {
    value: (fCont90 - F) / PIP,
    kind: 'pips',
    digits: 2,
    note: 'Continuous forward at T = 90/365 minus money-market forward 90/360 (above it)',
  },

  // Section 3: forward points and carry
  'm02.costPips': { value: p3m.costPips, kind: 'pips', note: 'Cost: CHF financing, 3M' },
  'm02.benefitPips': { value: p3m.benefitPips, kind: 'pips', note: 'Benefit: USD interest, 3M' },
  'm02.pointsRate': {
    value: p3m.points * PIP,
    kind: 'rate',
    digits: FD,
    note: 'Forward points 3M in rate units (F − S), signed',
  },
  'm02.cost': { value: p3m.costPips * PIP, kind: 'rate', digits: FD },
  'm02.benefit': { value: p3m.benefitPips * PIP, kind: 'rate', digits: FD },
  'm02.pointsApprox': {
    value: pointsApprox(curveMarket, M.days),
    kind: 'pips',
    note: 'S · (rd − rf) · t',
  },
  'm02.premPa': {
    value: p3m.premiumPa,
    kind: 'pct',
    digits: 2,
    sign: true,
    note: 'Annualised forward premium (F/S − 1)·360/90',
  },
  'm02.rateDiff': { value: M.rd - M.rf, kind: 'pct', digits: 1, sign: true, note: 'rd − rf' },
  'm02.discountPa': {
    value: Math.abs(p3m.premiumPa),
    kind: 'pct',
    digits: 2,
    note: 'Annualised forward discount, absolute (text: "der Abschlag beträgt …")',
  },
  'm02.usdLead': {
    value: M.rf - M.rd,
    kind: 'pct',
    digits: 1,
    note: 'Rate advantage of the dollar, rf − rd (positive in the example)',
  },
  'm02.points1W': { value: tenor('1W').points, kind: 'pips' },
  'm02.points1M': { value: tenor('1M').points, kind: 'pips' },
  'm02.points6M': { value: tenor('6M').points, kind: 'pips' },
  'm02.points1Y': { value: p1y.points, kind: 'pips' },
  'm02.points1YAbs': { value: Math.abs(p1y.points), kind: 'pips' },
  'm02.fwd1Y': { value: p1y.forward, kind: 'rate', digits: FD },
  'm02.days1Y': { value: p1y.days, kind: 'num', digits: 0 },
  'm02.whatIfRd': { value: C.whatIfRd, kind: 'pct', digits: 1, note: 'What-if CHF rate (choice)' },
  'm02.whatIfCostPips': { value: what.costPips, kind: 'pips' },
  'm02.whatIfPoints': { value: what.points, kind: 'pips' },
  'm02.whatIfFwd': { value: what.forward, kind: 'rate', digits: FD },

  // Section 4: arbitrage
  'm02.arbGapPips': { value: arbHigh.mispricingPips, kind: 'pips', note: 'Market − fair (choice)' },
  'm02.arbMarket': { value: arbHigh.marketForward, kind: 'rate', digits: FD },
  'm02.arbMarketLow': { value: arbLow.marketForward, kind: 'rate', digits: FD },
  'm02.arbChfIn': { value: N * arbHigh.marketForward, kind: 'money', note: 'N · F_market' },
  'm02.arbChfPayLow': { value: N * arbLow.marketForward, kind: 'money', note: 'N · F_market low' },
  'm02.arbProfit': { value: arbHigh.profitQuote, kind: 'money', note: 'N · |F_mkt − F_fair|' },
  'm02.arbProfitPv': { value: arbHigh.profitPresentValue, kind: 'money' },
};
