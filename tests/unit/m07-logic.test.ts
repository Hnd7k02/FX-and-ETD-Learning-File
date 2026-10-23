/**
 * Module 07 (Barrier & Binary): pure logic of the four figures (src/lib/m07/*) and the
 * numbers of the texts (src/lib/nums/m07.ts).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { barrierPrice, gkPrice, oneTouch, touchProbability } from '@/lib/fx';
import { M07_CONFIG, PIP, chartLayout, onGrid } from '@/lib/m07/config';
import {
  M07_MARKET,
  beyond,
  bgkFactor,
  dailyEquivalentBarrier,
  directionOf,
  firstHit,
  hitDays,
  pathStatus,
  pathsSummary,
  seededPaths,
} from '@/lib/m07/paths';
import {
  defaultLabState,
  effectiveBarrier,
  kindOf,
  labAha,
  labCurves,
  labNumbers,
  mirrorBarrier,
  mirrorDecomposition,
  numericGreeks,
  priceAt,
  spotGrid,
  yearsOf,
  type LabState,
} from '@/lib/m07/barrierlab';
import {
  callSpreadDigital,
  callSpreadPayoff,
  clampBarrier,
  clampCorridor,
  defaultTouchState,
  forwardAt,
  pathExitDay,
  pathPays,
  quantileAt,
  terminalDensity,
  touchCurves,
  touchMarket,
  touchAha,
  touchNumbers,
} from '@/lib/m07/touchlab';
import {
  biggestDrop,
  fixingsWindow,
  gapOrders,
  gapSummary,
  indexOfDate,
  riskometerLink,
} from '@/lib/m07/gap';
import { M07, nums } from '@/lib/nums/m07';

const { spot: S, rd, rf, vol, T } = M07_CONFIG.market;
const K = M07_CONFIG.strike;

describe('m07 config', () => {
  it('rounds to the slider grid and mirrors the barriers around the spot', () => {
    expect(onGrid(0.82401)).toBe(0.824);
    expect(onGrid(0.8 * 1.03)).toBe(0.824);
    expect(M07_CONFIG.barriers.up).toBe(0.824);
    expect(M07_CONFIG.barriers.down).toBe(0.776);
    expect(M07_CONFIG.touch.defaults.lower).toBe(0.768);
    expect(M07_CONFIG.touch.defaults.upper).toBe(0.832);
  });

  it('lays out charts 1:1 with a phone variant', () => {
    const wide = chartLayout(700, 0.5, 200);
    expect(wide).toMatchObject({ width: 700, height: 350, compact: false });
    const phone = chartLayout(300, 0.5, 220);
    expect(phone).toMatchObject({ width: 300, height: 220, compact: true });
    expect(chartLayout(100, 0.5, 10).width).toBe(260);
  });
});

describe('m07 paths (figure a)', () => {
  it('finds directions, first hits and statuses', () => {
    expect(directionOf(0.8, 0.82)).toBe('up');
    expect(directionOf(0.8, 0.78)).toBe('down');
    expect(beyond(0.83, 0.82, 'up')).toBe(true);
    expect(beyond(0.81, 0.82, 'up')).toBe(false);
    expect(beyond(0.77, 0.78, 'down')).toBe(true);
    expect(firstHit([0.8, 0.81, 0.825, 0.83], 0.824, 'up')).toBe(2);
    expect(firstHit([0.8, 0.79, 0.775], 0.776, 'down')).toBe(2);
    expect(firstHit([0.8, 0.81], 0.824, 'up')).toBeNull();
    expect(pathStatus(null, 50, 'out')).toBe('alive');
    expect(pathStatus(10, 5, 'out')).toBe('alive');
    expect(pathStatus(10, 10, 'out')).toBe('dead');
    expect(pathStatus(10, 5, 'in')).toBe('waiting');
    expect(pathStatus(10, 20, 'in')).toBe('alive');
  });

  it('simulates reproducible, independent daily paths', () => {
    const a = seededPaths(M07_MARKET, 5, 91, 7);
    const b = seededPaths(M07_MARKET, 5, 91, 7);
    expect(a).toEqual(b);
    expect(a).toHaveLength(5);
    expect(a[0]).toHaveLength(92);
    expect(a[0]![0]).toBe(S);
    // no antithetic mirror images: path 1 is not the reflection of path 0
    const r0 = Math.log(a[0]![1]! / S);
    const r1 = Math.log(a[1]![1]! / S);
    expect(Math.abs(r0 + r1)).toBeGreaterThan(1e-6);
    expect(seededPaths(M07_MARKET, 5, 91, 8)).not.toEqual(a);
    const hits = hitDays(a, 0.824, 'up');
    expect(hits).toHaveLength(5);
    for (const [i, h] of hits.entries()) {
      if (h !== null) expect(a[i]![h]).toBeGreaterThanOrEqual(0.824);
    }
  });

  it('touch frequency of many paths matches the BGK-adjusted model probability', () => {
    const paths = seededPaths(M07_MARKET, 4000, 91, 123);
    const share = hitDays(paths, 0.824, 'up').filter((h) => h !== null).length / paths.length;
    const sum = pathsSummary(0.824, 'out');
    expect(Math.abs(share - sum.touchProbDaily)).toBeLessThan(0.025);
    // The figure shows the continuous probability, the same as the table in section 1.
    expect(sum.touchProb).toBeCloseTo(touchProbability({ S, H: 0.824, T, vol, rd, rf }), 14);
    expect(sum.touchProbDaily).toBeLessThan(sum.touchProb);
  });

  it('prices the importer call with a barrier (KO + KI = vanilla)', () => {
    const ko = pathsSummary(0.824, 'out');
    const ki = pathsSummary(0.824, 'in');
    expect(ko.kind).toBe('up-and-out');
    expect(ki.kind).toBe('up-and-in');
    expect(ko.price + ki.price).toBeCloseTo(ko.vanilla, 12);
    expect(ko.discount).toBeGreaterThan(0.8);
    const down = pathsSummary(0.776, 'out');
    expect(down.dir).toBe('down');
    expect(down.discount).toBeLessThan(0.15);
    const atSpot = pathsSummary(S, 'out');
    expect(atSpot.touchProb).toBe(1);
    expect(atSpot.touchProbDaily).toBe(1);
    expect(atSpot.price).toBe(0);
  });

  it('shifts daily barriers away from the spot (BGK)', () => {
    const f = bgkFactor(vol);
    expect(f).toBeCloseTo(Math.exp(0.5826 * 0.08 * Math.sqrt(1 / 365)), 14);
    expect(dailyEquivalentBarrier(0.824, 'up', vol)).toBeCloseTo(0.824 * f, 14);
    expect(dailyEquivalentBarrier(0.776, 'down', vol)).toBeCloseTo(0.776 / f, 14);
  });
});

describe('m07 barrier lab (figure b)', () => {
  const s0 = defaultLabState();

  it('maps the state to the core', () => {
    expect(kindOf(s0)).toBe('up-and-out');
    expect(yearsOf(13)).toBe(0.25);
    expect(effectiveBarrier(s0)).toBe(0.824);
    expect(effectiveBarrier({ ...s0, monitoring: 'daily' })).toBeCloseTo(
      0.824 * bgkFactor(vol),
      14,
    );
    expect(priceAt(s0, S)).toBeCloseTo(
      barrierPrice({ S, K, H: 0.824, T, vol, rd, rf, type: 'call', kind: 'up-and-out' }),
      14,
    );
    // touched: knock-out = rebate, knock-in = vanilla
    expect(priceAt({ ...s0, rebatePips: 20 }, 0.83)).toBeCloseTo(20 * PIP, 14);
    expect(priceAt({ ...s0, io: 'in' }, 0.83)).toBeCloseTo(
      gkPrice(0.83, K, T, vol, rd, rf, 'call'),
      14,
    );
  });

  it('holds in-out parity and flags the reverse knock-out', () => {
    const n = labNumbers(s0);
    expect(n.reverse).toBe(true);
    expect(n.touched).toBe(false);
    expect(Math.abs(n.parityGap)).toBeLessThan(1e-12);
    expect(n.discount).toBeGreaterThan(0.8);
    expect(n.delta).toBeLessThan(0);
    expect(n.vanillaDelta).toBeGreaterThan(0.45);
    const regular: LabState = { ...s0, dir: 'down', barrier: 0.776 };
    const r = labNumbers(regular);
    expect(r.reverse).toBe(false);
    expect(r.delta).toBeGreaterThan(r.vanillaDelta);
    for (const type of ['call', 'put'] as const) {
      for (const dir of ['up', 'down'] as const) {
        for (const monitoring of ['continuous', 'daily'] as const) {
          const st: LabState = {
            ...s0,
            type,
            dir,
            monitoring,
            barrier: dir === 'up' ? 0.83 : 0.77,
          };
          expect(Math.abs(labNumbers(st).parityGap)).toBeLessThan(1e-12);
        }
      }
    }
  });

  it('values the rebate and the touched state', () => {
    const n = labNumbers({ ...s0, rebatePips: 20 });
    expect(n.rebateValue).toBeGreaterThan(0);
    expect(n.rebateValue).toBeLessThan(20 * PIP);
    const t = labNumbers({ ...s0, spot: 0.83 });
    expect(t.touched).toBe(true);
    expect(t.delta).toBe(0);
    expect(t.gamma).toBe(0);
    expect(t.touchProb).toBe(1);
    const ti = labNumbers({ ...s0, spot: 0.83, io: 'in' });
    expect(ti.price).toBeCloseTo(ti.vanilla, 14);
  });

  it('computes one-sided greeks at the barrier', () => {
    const f = (x: number) => x * x;
    const c = numericGreeks(f, 1, 10, 'up', 1e-3);
    expect(c.delta).toBeCloseTo(2, 8);
    expect(c.gamma).toBeCloseTo(2, 6);
    const up = numericGreeks(f, 1, 1.0005, 'up', 1e-3);
    expect(up.delta).toBeCloseTo(2, 5);
    const down = numericGreeks(f, 1, 0.9995, 'down', 1e-3);
    expect(down.delta).toBeCloseTo(2, 5);
    expect(down.gamma).toBeCloseTo(2, 6);
  });

  it('builds the curves with the cliff and the knocked region', () => {
    const grid = spotGrid(0.74, 0.86, 5, 0.824, 'up');
    expect(grid).toContain(0.824);
    expect(grid).toContain(0.8239);
    expect(grid[0]).toBe(0.74);
    expect(grid[grid.length - 1]).toBe(0.86);
    const c = labCurves(s0);
    expect(c.region).toEqual([0.824, 0.86]);
    expect(c.option.length).toBe(c.vanilla.length);
    const atBarrier = c.option.find(([x]) => x === 0.824)!;
    expect(atBarrier[1]).toBe(0);
    expect(c.payoff).not.toBeNull();
    const cliff = c.payoff!.filter(([x]) => x === 0.824);
    expect(cliff).toHaveLength(2);
    expect(cliff[0]![1]).toBeCloseTo((0.824 - K) / PIP, 8);
    expect(cliff[1]![1]).toBe(0);
    for (const [, d] of c.delta) {
      expect(d).toBeGreaterThanOrEqual(M07_CONFIG.lab.deltaClip[0]);
      expect(d).toBeLessThanOrEqual(M07_CONFIG.lab.deltaClip[1]);
    }
    const down = labCurves({ ...s0, dir: 'down', barrier: 0.776, io: 'out' });
    expect(down.region).toEqual([0.74, 0.776]);
    expect(down.payoff![0]).toEqual([0.74, 0]);
    const ki = labCurves({ ...s0, io: 'in' });
    expect(ki.payoff).toBeNull();
    const beyondPt = ki.option.find(([x]) => x > 0.83)!;
    const v = ki.vanilla.find(([x]) => x === beyondPt[0])!;
    expect(beyondPt[1]).toBeCloseTo(v[1], 10);
  });

  it('mirrors the barrier and picks the annotation', () => {
    expect(mirrorBarrier(0.824, 0.8)).toBe(0.776);
    expect(mirrorBarrier(0.86, 0.7)).toBe(0.74);
    expect(labAha(s0, labNumbers(s0))).toBe('cheap');
    const near = { ...s0, spot: 0.82 };
    expect(labAha(near, labNumbers(near))).toBe('reverseNear');
    const reg = { ...s0, dir: 'down' as const, barrier: 0.776, spot: 0.78 };
    expect(labAha(reg, labNumbers(reg))).toBe('regularNear');
    const t = { ...s0, spot: 0.83 };
    expect(labAha(t, labNumbers(t))).toBe('touched');
    const ki = { ...s0, io: 'in' as const };
    expect(labAha(ki, labNumbers(ki))).toBeNull();
    // A regular knock-out is cheap only because a touch is likely, not because it loses the best
    // scenarios: the up-and-out put with the barrier 60 pips above spot.
    const reg2 = { ...s0, type: 'put' as const, barrier: 0.806 };
    const n2 = labNumbers(reg2);
    expect(n2.reverse).toBe(false);
    expect(n2.discount).toBeGreaterThan(0.5);
    expect(labAha(reg2, n2)).toBe('likely');
  });

  it('decomposes the down-and-out call by the method of images', () => {
    const m = mirrorDecomposition(S, K, 0.776, T, vol, rd, rf);
    const doc = barrierPrice({
      S,
      K,
      H: 0.776,
      T,
      vol,
      rd,
      rf,
      type: 'call',
      kind: 'down-and-out',
    });
    expect(m.price).toBeCloseTo(doc, 12);
    const atH = mirrorDecomposition(0.776, K, 0.776, T, vol, rd, rf);
    expect(atH.price).toBeCloseTo(0, 12);
  });
});

describe('m07 touch lab (figure c)', () => {
  const s0 = defaultTouchState();
  const m0 = touchMarket(s0);

  it('builds the market and the cone', () => {
    expect(m0).toEqual({ S, T, vol, rd, rf });
    expect(forwardAt(m0, 0)).toBe(S);
    expect(forwardAt(m0, T)).toBeCloseTo(S * Math.exp((rd - rf) * T), 14);
    expect(quantileAt(m0, T, 0)).toBeLessThan(forwardAt(m0, T));
    expect(quantileAt(m0, T, 1)).toBeGreaterThan(quantileAt(m0, T, -1));
    // density integrates to 1
    let sum = 0;
    for (let x = 0.6; x < 1.05; x += 1e-4) sum += terminalDensity(m0, x) * 1e-4;
    expect(sum).toBeCloseTo(1, 4);
  });

  it('turns a call spread into the digital as the width shrinks', () => {
    const exact = touchNumbers({ ...s0, mode: 'digital' }).price;
    const wide = callSpreadDigital(m0, K, 0.02);
    const narrow = callSpreadDigital(m0, K, 0.0002);
    expect(Math.abs(narrow - exact)).toBeLessThan(Math.abs(wide - exact));
    expect(Math.abs(narrow - exact)).toBeLessThan(1e-6);
    expect(callSpreadPayoff(K - 0.01, K, 0.005)).toBe(0);
    expect(callSpreadPayoff(K, K, 0.005)).toBeCloseTo(0.5, 12);
    expect(callSpreadPayoff(K + 0.01, K, 0.005)).toBe(1);
  });

  it('prices every mode around the discounted probability', () => {
    const d = touchNumbers({ ...s0, mode: 'digital' });
    expect(d.price).toBeCloseTo(d.prob * d.df, 14);
    const ot = touchNumbers(s0);
    expect(ot.price).toBeCloseTo(oneTouch({ S, H: 0.824, T, vol, rd, rf }), 14);
    expect(ot.prob).toBeCloseTo(touchProbability({ S, H: 0.824, T, vol, rd, rf }), 14);
    expect(ot.price).toBeCloseTo(ot.prob * ot.df, 12);
    // at rd = 0 paid at hit = paid at expiry; at rd > 0 the hit is worth more
    expect(ot.compare).toBeCloseTo(ot.price, 10);
    const hit = touchNumbers({ ...s0, rdPct: 1, payAt: 'hit' });
    expect(hit.price).toBeGreaterThan(hit.compare);
    const nt = touchNumbers({ ...s0, mode: 'noTouch' });
    expect(nt.price + nt.compare).toBeCloseTo(nt.df, 12);
    const dnt = touchNumbers({ ...s0, mode: 'dnt' });
    expect(dnt.price).toBeGreaterThan(0);
    expect(dnt.compare).toBeLessThan(dnt.price); // more vol, cheaper
  });

  it('draws the curves of the lower chart', () => {
    for (const mode of ['digital', 'oneTouch', 'noTouch', 'dnt'] as const) {
      const c = touchCurves({ ...s0, mode }, 40);
      expect(c.price.length).toBeGreaterThan(30);
      expect(c.prob.length).toBe(c.price.length);
      expect(c.x).toBe(mode === 'dnt' ? 'vol' : 'level');
      expect(c.second === null).toBe(mode === 'dnt');
      for (const [, y] of c.price) expect(y).toBeGreaterThanOrEqual(0);
    }
    const ot = touchCurves(s0, 40);
    expect(ot.at).toEqual([0.824, touchNumbers(s0).price]);
    expect(ot.price.every(([x]) => Math.abs(x - S) > 0)).toBe(true);
  });

  it('keeps barriers away from the spot and decides which paths pay', () => {
    expect(clampBarrier(0.8005)).toBeCloseTo(0.801, 12);
    expect(clampBarrier(0.7995)).toBeCloseTo(0.799, 12);
    expect(clampBarrier(0.83)).toBe(0.83);
    expect(clampCorridor(0.8, 0.8)).toEqual([0.799, 0.801].map((x) => expect.closeTo(x, 12)));
    const p = [0.8, 0.81, 0.83, 0.79];
    expect(pathPays(p, { ...s0, mode: 'digital' })).toBe(false);
    expect(pathPays(p, s0)).toBe(true);
    expect(pathPays(p, { ...s0, mode: 'noTouch' })).toBe(false);
    expect(pathPays(p, { ...s0, mode: 'dnt' })).toBe(true);
    expect(pathPays([0.8, 0.84], { ...s0, mode: 'dnt' })).toBe(false);
    expect(pathPays([0.8, 0.77], { ...s0, mode: 'oneTouch', barrier: 0.776 })).toBe(true);
    expect(pathExitDay(p, s0)).toBe(2);
    expect(pathExitDay([0.8, 0.84], { ...s0, mode: 'dnt' })).toBe(1);
    expect(pathExitDay(p, { ...s0, mode: 'digital' })).toBeNull();
  });
});

describe('m07 touch lab annotations', () => {
  const s0 = defaultTouchState();
  it('picks the right moment', () => {
    expect(touchAha({ ...s0, mode: 'digital', spreadPips: 50 })).toBeNull();
    expect(touchAha({ ...s0, mode: 'digital', spreadPips: 4 })).toBe('digital');
    expect(touchAha(s0)).toBeNull();
    expect(touchAha({ ...s0, barrier: 0.802 })).toBe('near');
    expect(touchAha({ ...s0, payAt: 'hit' })).toBe('same');
    expect(touchAha({ ...s0, payAt: 'hit', rdPct: 1 })).toBe('hit');
    expect(touchAha({ ...s0, payAt: 'hit', rdPct: -0.5 })).toBeNull();
    expect(touchAha({ ...s0, mode: 'noTouch', barrier: 0.798 })).toBe('near');
    expect(touchAha({ ...s0, mode: 'noTouch' })).toBeNull();
    expect(touchAha({ ...s0, mode: 'dnt' })).toBeNull();
    expect(touchAha({ ...s0, mode: 'dnt', lower: 0.79, upper: 0.81 })).toBe('narrow');
  });
});

describe('m07 gap replay (figure d)', () => {
  const raw = readFileSync(join(process.cwd(), 'data/raw/ecb-eur-reference.csv'), 'utf8');
  const g = M07_CONFIG.gap;
  const series = fixingsWindow(raw, g.pair, g.from, g.to);

  it('reads the ECB window', () => {
    expect(series[0]!.date >= g.from).toBe(true);
    expect(series[series.length - 1]!.date <= g.to).toBe(true);
    expect(series.length).toBeGreaterThan(55);
    expect(indexOfDate(series, g.shockDate)).toBeGreaterThan(0);
    expect(indexOfDate(series, '2015-01-17')).toBe(-1); // a Saturday
  });

  it('triggers every order below the floor on the shock day at the same fixing', () => {
    const s = gapSummary(series);
    expect(s.before).toBeGreaterThan(g.putStrike);
    expect(s.shock).toBeLessThan(Math.min(...g.knockOuts));
    expect(s.dayMove).toBeLessThan(-0.1);
    expect(s.stop.index).toBe(s.shockIndex);
    expect(s.stop.fill).toBe(s.shock);
    expect(s.stop.before).toBe(s.before);
    expect(s.stop.gapPips).toBeCloseTo((g.stop - s.shock) / PIP, 8);
    expect(s.stopSlipChf).toBeCloseTo((g.stop - s.shock) * g.notional, 6);
    for (const k of s.knockOuts) {
      expect(k.index).toBe(s.shockIndex);
      expect(k.fill).toBe(s.shock);
    }
    expect(s.putLostChf).toBeCloseTo((g.putStrike - s.shock) * g.notional, 6);
    expect(s.low).toBeLessThanOrEqual(s.shock);
    expect(biggestDrop(series).index).toBe(s.shockIndex);
  });

  it('handles levels that are never reached and an empty window', () => {
    const o = gapOrders(series, [0.5]);
    expect(o[0]!.index).toBeNull();
    expect(o[0]!.gapPips).toBe(0);
    const first = gapOrders([{ date: '2015-01-01', value: 1 }], [1.1])[0]!;
    expect(first.index).toBe(0);
    expect(Number.isNaN(first.before)).toBe(true);
    const empty = gapSummary([]);
    expect(empty.shockIndex).toBe(-1);
    expect(empty.stopSlipChf).toBe(0);
    expect(empty.putLostChf).toBe(0);
    expect(biggestDrop([]).index).toBe(-1);
  });

  it('links to the Riskometer event', () => {
    expect(riskometerLink('/riskometer/')).toBe('/riskometer/?event=chf-shock-2015&pair=EUR%2FCHF');
  });
});

describe('m07 numbers', () => {
  it('holds the parity and the reference facts of the texts', () => {
    expect(M07.uoc + M07.uic).toBeCloseTo(M07.vanilla, 12);
    expect(M07.doc + M07.dic).toBeCloseTo(M07.vanilla, 12);
    expect(M07.mirror.price).toBeCloseTo(M07.doc, 12);
    expect(M07.mirror.mirror).toBeCloseTo(M07.dic, 12);
    expect(M07.ot + M07.nt).toBeCloseTo(Math.exp(-rd * T), 12);
    expect(M07.otHitRd).toBeGreaterThan(M07.otExpRd);
    expect(M07.dntVolUp).toBeLessThan(M07.dnt);
    expect(M07.dntVolDown).toBeGreaterThan(M07.dnt);
    // the closed form with BGK-shifted barriers matches the daily Monte Carlo
    expect(Math.abs(M07.dntMc.pv - (M07.dntMc.compare.continuousBgk ?? 0))).toBeLessThan(
      3 * M07.dntMc.stdErr,
    );
    // window barrier between the full-period knock-out and the vanilla
    expect(M07.uocFull91 * 1e6).toBeLessThan(M07.window.pv);
    expect(M07.window.pv).toBeLessThan(M07.window.compare.vanilla ?? 0);
    expect(M07.labNearShort.gamma).toBeLessThan(-10 * Math.abs(M07.labNearShort.vanillaGamma));
    expect(Object.keys(nums).every((k) => k.startsWith('m07.'))).toBe(true);
  });
});
