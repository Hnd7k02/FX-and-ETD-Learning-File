/**
 * Numbers of module 07 (Barrier & Binary) for <Num of="m07.…" />. Everything is computed here
 * from the calculation core (src/lib/fx), the Monte Carlo results (src/data/fx/mc-products.json)
 * and the ECB raw data (data/raw/ecb-eur-reference.csv); parameters live in M07_CONFIG
 * (src/lib/m07/config.ts). Nothing is typed in.
 *
 * Running example: USD call / CHF put, S = 0.8000, K = ATMF 0.7930, T = 0.25, σ = 8 %,
 * rd (CHF) = 0 %, rf (USD) = 3.5 %. Prices in CHF per USD, shown in pips (0.0001) or in CHF
 * on USD 1 Mio.; touch products pay CHF 100’000.
 */
import rawCsv from '../../../data/raw/ecb-eur-reference.csv?raw';
import { barrierPrice } from '@/lib/fx/exotics/barrier';
import { digitalCash } from '@/lib/fx/exotics/digital';
import { doubleNoTouch } from '@/lib/fx/exotics/doubleNoTouch';
import { noTouch, oneTouch, touchProbability } from '@/lib/fx/exotics/touch';
import { MC_PRODUCTS } from '@/lib/fx/mc/fair';
import { gkPrice } from '@/lib/fx/vanilla';
import { M07_CONFIG, PIP } from '@/lib/m07/config';
import { labNumbers, mirrorDecomposition, defaultLabState } from '@/lib/m07/barrierlab';
import { fixingsWindow, gapSummary } from '@/lib/m07/gap';
import { bgkFactor, dailyEquivalentBarrier } from '@/lib/m07/paths';
import { callSpreadDigital, touchMarket, defaultTouchState } from '@/lib/m07/touchlab';
import type { NumTable } from './types';

const C = M07_CONFIG;
const { spot: S, rd, rf, vol, T, notional: N } = C.market;
const K = C.strike;
const Hu = C.barriers.up;
const Hd = C.barriers.down;
const pips = (x: number) => x / PIP;
/** Difference of two CHF amounts as shown (rounded to whole CHF), so text sums add up. */
const shownDiff = (a: number, b: number) => Math.round(a) - Math.round(b);
const call = (
  kind: 'up-and-out' | 'up-and-in' | 'down-and-out' | 'down-and-in',
  H: number,
  extra: { rebate?: number; T?: number } = {},
) =>
  barrierPrice({
    S,
    K,
    H,
    T: extra.T ?? T,
    vol,
    rd,
    rf,
    type: 'call',
    kind,
    rebate: extra.rebate ?? 0,
  });

/* ---------- Section 1 ---------- */
const vanilla = gkPrice(S, K, T, vol, rd, rf, 'call');
const uoc = call('up-and-out', Hu);
const uic = call('up-and-in', Hu);
const doc = call('down-and-out', Hd);
const dic = call('down-and-in', Hd);
const touchUp = touchProbability({ S, H: Hu, T, vol, rd, rf });
const touchDown = touchProbability({ S, H: Hd, T, vol, rd, rf });
/** Risk-neutral P(S_T ≥ H_up) = N(d2) at K = H, the "end above" probability. */
const endAboveUp = digitalCash(S, Hu, T, vol, rd, rf, 'call') / Math.exp(-rd * T);
const lossSpot = Number((Hu + C.lossSpotPips * PIP).toFixed(4));

/* ---------- Section 2 ---------- */
const lab = labNumbers(defaultLabState());
const nearSpot = Hu - C.nearBarrierPips * PIP;
const labNear = labNumbers({ ...defaultLabState(), spot: nearSpot });
const shortWeeks = 2;
const labNearShort = labNumbers({ ...defaultLabState(), spot: nearSpot, weeks: shortWeeks });
const uocRebate = call('up-and-out', Hu, { rebate: C.rebatePips * PIP });
const bgk = bgkFactor(vol);
const hDaily = dailyEquivalentBarrier(Hu, 'up', vol);
const uocDaily = call('up-and-out', hDaily);
const mirror = mirrorDecomposition(S, K, Hd, T, vol, rd, rf);

/* ---------- Section 3 ---------- */
const P = C.touch.payout;
const m0 = touchMarket(defaultTouchState());
const dfd = Math.exp(-rd * T);
const digital = digitalCash(S, K, T, vol, rd, rf, 'call');
const spread = callSpreadDigital(m0, K, C.touch.spreadExamplePips * PIP);
const ot = oneTouch({ S, H: Hu, T, vol, rd, rf });
const nt = noTouch({ S, H: Hu, T, vol, rd, rf });
const rdX = C.touch.rdExample;
const otHitRd = oneTouch({ S, H: Hu, T, vol, rd: rdX, rf, payAt: 'hit' });
const otExpRd = oneTouch({ S, H: Hu, T, vol, rd: rdX, rf, payAt: 'expiry' });
const L = C.touch.defaults.lower;
const U = C.touch.defaults.upper;
const dnt = doubleNoTouch({ S, L, U, T, vol, rd, rf });
const dbump = C.touch.volBumpPct / 100;
const dntVolUp = doubleNoTouch({ S, L, U, T, vol: vol + dbump, rd, rf });
const dntVolDown = doubleNoTouch({ S, L, U, T, vol: vol - dbump, rd, rf });
const dntMc = MC_PRODUCTS.products.doubleNoTouch;

/* ---------- Section 4 ---------- */
const w = MC_PRODUCTS.products.windowBarrier;
const T91 = C.window.expiryDay / 365;
const uocFull91 = call('up-and-out', hDaily, { T: T91 });
const gap = gapSummary(fixingsWindow(rawCsv, C.gap.pair, C.gap.from, C.gap.to));

/** Raw values for the quiz file and the tests (CHF per USD unless noted). */
export const M07 = {
  vanilla,
  uoc,
  uic,
  doc,
  dic,
  touchUp,
  touchDown,
  endAboveUp,
  lab,
  labNear,
  labNearShort,
  nearSpot,
  shortWeeks,
  uocRebate,
  bgk,
  hDaily,
  uocDaily,
  mirror,
  digital,
  spread,
  ot,
  nt,
  otHitRd,
  otExpRd,
  dnt,
  dntVolUp,
  dntVolDown,
  dntMc,
  window: w,
  uocFull91,
  gap,
} as const;

export const nums: NumTable = {
  // Section 1: levels and prices of the importer's barrier calls
  'm07.barrierUp': { value: Hu, kind: 'rate', note: 'Up barrier = spot · 1.03' },
  'm07.barrierDown': { value: Hd, kind: 'rate', note: 'Down barrier = spot · 0.97' },
  'm07.barrierPct': {
    value: Hu / S - 1,
    kind: 'pct',
    digits: 0,
    note: 'Distance of both barriers from the spot',
  },
  'm07.vanillaPips': { value: pips(vanilla), kind: 'pips', digits: 1 },
  'm07.uocPips': { value: pips(uoc), kind: 'pips', digits: 1, note: 'Up-and-out call, H 0.8240' },
  'm07.uocChf': { value: uoc * N, kind: 'money' },
  'm07.uicPips': { value: pips(uic), kind: 'pips', digits: 1, note: 'Up-and-in call, H 0.8240' },
  'm07.uicChf': { value: uic * N, kind: 'money' },
  'm07.docPips': { value: pips(doc), kind: 'pips', digits: 1, note: 'Down-and-out call, H 0.7760' },
  'm07.docChf': { value: doc * N, kind: 'money' },
  'm07.dicPips': { value: pips(dic), kind: 'pips', digits: 1 },
  'm07.uocDiscount': { value: 1 - uoc / vanilla, kind: 'pct', digits: 0 },
  'm07.docDiscount': { value: 1 - doc / vanilla, kind: 'pct', digits: 0 },
  'm07.touchUp': { value: touchUp, kind: 'pct', digits: 0, note: 'P(touch 0.8240) continuous' },
  'm07.touchDown': { value: touchDown, kind: 'pct', digits: 0 },
  'm07.endAboveUp': { value: endAboveUp, kind: 'pct', digits: 1, note: 'P(S_T ≥ 0.8240)' },
  'm07.touchMirrorTerm': {
    value: touchUp - endAboveUp,
    kind: 'pct',
    digits: 1,
    note: 'Reflection term of the touch probability: paths that touch and end below',
  },
  'm07.driftLog': {
    value: rd - rf - 0.5 * vol * vol,
    kind: 'pct',
    digits: 2,
    note: 'Drift of ln S p.a.: rd − rf − σ²/2',
  },
  'm07.endAboveUp2': { value: 2 * endAboveUp, kind: 'pct', digits: 1, note: '2 · P(S_T ≥ H)' },
  'm07.touchUp1': { value: touchUp, kind: 'pct', digits: 1 },
  'm07.lossSpot': { value: lossSpot, kind: 'rate', note: 'Loss scenario: spot at expiry' },
  'm07.lossChf': {
    value: (lossSpot - K) * N,
    kind: 'money',
    note: 'Extra cost vs the strike on USD 1 Mio. once the call is knocked out',
  },
  'm07.uocSavingChf': {
    value: shownDiff(vanilla * N, uoc * N),
    kind: 'money',
    note: 'Premium saved, vanilla − UOC as shown',
  },
  'm07.lossNetChf': {
    value: shownDiff((lossSpot - K) * N, shownDiff(vanilla * N, uoc * N)),
    kind: 'money',
    note: 'Loss scenario: worse off than with the vanilla call = extra cost − premium saved',
  },

  // Section 2: parity, rebate, monitoring, Greeks near the barrier, method of images
  'm07.paritySumPips': { value: pips(uoc + uic), kind: 'pips', digits: 1, note: 'UOC + UIC' },
  'm07.vanillaPips2': { value: pips(vanilla), kind: 'pips', digits: 2 },
  'm07.rebatePips': { value: C.rebatePips, kind: 'pips', digits: 0 },
  // Rebate sentence with 2 decimals so that 17.23 + 7.62 = 24.85 adds up on screen.
  'm07.uocPips2': { value: pips(uoc), kind: 'pips', digits: 2 },
  'm07.uocRebatePips': { value: pips(uocRebate), kind: 'pips', digits: 2 },
  'm07.rebateValuePips': { value: pips(uocRebate - uoc), kind: 'pips', digits: 2 },
  'm07.bgkFactor': { value: bgk, kind: 'num', digits: 5, note: 'e^(0.5826·σ·√(1/365))' },
  'm07.bgkBarrier': { value: hDaily, kind: 'rate', note: 'Continuous equivalent of daily 0.8240' },
  'm07.bgkShiftPips': { value: pips(hDaily - Hu), kind: 'pips', digits: 0 },
  'm07.uocDailyPips': { value: pips(uocDaily), kind: 'pips', digits: 1 },
  'm07.bgkBeta': { value: C.monitoring.beta, kind: 'num', digits: 4 },
  'm07.uocDelta': { value: lab.delta, kind: 'num', digits: 3, sign: true, note: 'Numeric, S 0.80' },
  'm07.nearSpot': { value: nearSpot, kind: 'rate', note: '40 pips below the barrier' },
  'm07.uocNearPips': { value: pips(labNear.price), kind: 'pips', digits: 1 },
  'm07.uocDeltaNear': { value: labNear.delta, kind: 'num', digits: 3, sign: true },
  'm07.vanillaDeltaNear': { value: labNear.vanillaDelta, kind: 'num', digits: 3 },
  'm07.shortWeeks': { value: shortWeeks, kind: 'num', digits: 0 },
  'm07.uocNearShortPips': { value: pips(labNearShort.price), kind: 'pips', digits: 1 },
  'm07.uocDeltaNearShort': { value: labNearShort.delta, kind: 'num', digits: 2, sign: true },
  'm07.uocGammaNearShort': { value: labNearShort.gamma, kind: 'num', digits: 0, sign: true },
  'm07.uocDeltaNearShortUsd': {
    value: -labNearShort.delta * N,
    kind: 'money',
    ccy: 'USD',
    note: 'Short USD equivalent of the UOC delta at 0.8200, 2 weeks, on USD 1 Mio.',
  },
  'm07.vanillaGammaNearShort': { value: labNearShort.vanillaGamma, kind: 'num', digits: 0 },
  'm07.mirrorSpot': { value: mirror.mirrorSpot, kind: 'rate', note: 'H²/S for H 0.7760' },
  'm07.mirrorMu': { value: mirror.mu, kind: 'num', digits: 2 },
  'm07.mirrorWeight': { value: mirror.weight, kind: 'num', digits: 3 },
  // 2 decimals: 8.57 · 1.439 = 12.33 must match the mirror term (8.6 · 1.439 would give 12.4).
  'm07.mirrorCallPips': { value: pips(mirror.mirrorCall), kind: 'pips', digits: 2 },
  'm07.mirrorPips': { value: pips(mirror.mirror), kind: 'pips', digits: 1 },

  // Section 3: digital, touch, double no-touch (payout CHF 100’000)
  'm07.payout': { value: P, kind: 'money' },
  'm07.digitalChf': { value: digital * P, kind: 'money' },
  'm07.digitalProb': { value: digital / dfd, kind: 'pct', digits: 1, note: 'N(d2) at K' },
  'm07.spreadPips': { value: C.touch.spreadExamplePips, kind: 'pips', digits: 0 },
  'm07.spreadChf': { value: spread * P, kind: 'money' },
  'm07.spreadDiffChf': { value: (spread - digital) * P, kind: 'money', digits: 2 },
  'm07.otChf': { value: ot * P, kind: 'money', note: 'One-touch 0.8240, paid at expiry' },
  'm07.ntChf': { value: nt * P, kind: 'money' },
  'm07.otNtSumChf': { value: (ot + nt) * P, kind: 'money', note: '= payout · e^(−rd T)' },
  'm07.otVsDigitalH': {
    value: ot / (endAboveUp * dfd),
    kind: 'num',
    digits: 2,
    note: 'One-touch over the digital struck at the barrier',
  },
  'm07.rdExample': { value: rdX, kind: 'pct', digits: 0 },
  'm07.otHitRdChf': { value: otHitRd * P, kind: 'money' },
  'm07.otExpRdChf': { value: otExpRd * P, kind: 'money' },
  'm07.dntLower': { value: L, kind: 'rate' },
  'm07.dntUpper': { value: U, kind: 'rate' },
  'm07.dntWidth': { value: U / S - 1, kind: 'pct', digits: 0, note: 'Corridor ± around spot' },
  'm07.dntChf': { value: dnt * P, kind: 'money' },
  'm07.dntProb': { value: dnt / dfd, kind: 'pct', digits: 0 },
  'm07.volBump': { value: dbump, kind: 'pct', digits: 0, note: 'Vol bump (points)' },
  'm07.volUp': { value: vol + dbump, kind: 'pct', digits: 0 },
  'm07.volDown': { value: vol - dbump, kind: 'pct', digits: 0 },
  'm07.dntVolUpChf': { value: dntVolUp * P, kind: 'money' },
  'm07.dntVolDownChf': { value: dntVolDown * P, kind: 'money' },
  'm07.dntMcChf': { value: dntMc.pv, kind: 'money', note: 'MC, daily fixings, 1 Mio. paths' },
  'm07.dntMcSe': { value: dntMc.stdErr, kind: 'money' },
  'm07.dntBgkChf': {
    value: dntMc.compare?.continuousBgk ?? Number.NaN,
    kind: 'money',
    note: 'Closed form with BGK-shifted barriers',
  },

  // Section 4: window barrier (Monte Carlo) and the franc shock (ECB data)
  'm07.windowStart': { value: C.window.startDay, kind: 'num', digits: 0 },
  'm07.windowEnd': { value: C.window.endDay, kind: 'num', digits: 0 },
  'm07.windowExpiry': { value: C.window.expiryDay, kind: 'num', digits: 0 },
  'm07.windowPvChf': { value: w.pv, kind: 'money' },
  'm07.windowSeChf': { value: w.stdErr, kind: 'money' },
  'm07.windowVanillaChf': { value: w.compare?.vanilla ?? Number.NaN, kind: 'money' },
  'm07.windowKo': { value: w.stats.pKnockOut, kind: 'pct', digits: 1 },
  'm07.windowPaths': { value: w.paths / 1e6, kind: 'num', digits: 0, note: 'Paths in millions' },
  'm07.uocFull91Chf': { value: uocFull91 * N, kind: 'money', note: 'UOC 91 days, daily (BGK)' },
  'm07.windowSavingChf': {
    value: shownDiff(w.compare?.vanilla ?? Number.NaN, w.pv),
    kind: 'money',
    note: 'Window barrier cheaper than the vanilla (as shown)',
  },
  'm07.windowExtraChf': {
    value: shownDiff(w.pv, uocFull91 * N),
    kind: 'money',
    note: 'Window barrier dearer than the full-life barrier (as shown)',
  },
  'm07.gapBefore': { value: gap.before, kind: 'rate', note: 'ECB EUR/CHF fixing the day before' },
  'm07.gapShock': { value: gap.shock, kind: 'rate', note: 'ECB EUR/CHF fixing on 15.01.2015' },
  'm07.gapDayMove': { value: gap.dayMove, kind: 'pct', digits: 1 },
  'm07.gapLow': { value: gap.low, kind: 'rate', note: 'Lowest fixing in the window' },
  'm07.gapStop': { value: C.gap.stop, kind: 'rate' },
  'm07.gapStopPips': { value: gap.stop.gapPips, kind: 'pips', digits: 0 },
  'm07.gapStopChf': { value: gap.stopSlipChf, kind: 'money' },
  'm07.gapNotionalEur': { value: C.gap.notional, kind: 'money', ccy: 'EUR' },
  'm07.gapPutStrike': { value: C.gap.putStrike, kind: 'rate' },
  'm07.gapKoHigh': { value: Math.max(...C.gap.knockOuts), kind: 'rate' },
  'm07.gapKoLow': { value: Math.min(...C.gap.knockOuts), kind: 'rate' },
  'm07.gapKoCount': { value: C.gap.knockOuts.length, kind: 'num', digits: 0 },
  'm07.gapPutLostChf': { value: gap.putLostChf, kind: 'money' },
};
