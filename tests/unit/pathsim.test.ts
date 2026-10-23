import { describe, expect, it } from 'vitest';
import {
  PATHSIM_CONFIG,
  defaultScenario,
  eventAt,
  fairInfo,
  forwardToDay,
  horizonDays,
  isScenario,
  isSimKind,
  monthTicks,
  paramOf,
  paramOverrides,
  paramRange,
  playState,
  pnlSteps,
  productLevels,
  productZones,
  rateDomain,
  scenarioFor,
  simEvents,
  earlyEndFixings,
  quoteCoupon,
  simProduct,
  simulate,
  simulateEnsemble,
  solvedParam,
  sortedByPnl,
  spotAt,
  summarizeEnsemble,
  toPips,
  type EnsemblePath,
  type SimKind,
} from '@/lib/pathsim';
import { MC_PRODUCTS, fairProduct } from '@/lib/fx/mc/fair';
import { DEFAULT_MARKET, MC_CONFIG, forwardAt } from '@/lib/fx/mc/products';
import { productPayoff } from '@/lib/fx/mc/payoffs';
import { scenarioPath } from '@/lib/fx/mc/scenarios';

/** A numeric field of the simulated product (the union type does not know them all). */
const num = (sim: { product: object }, field: string): number =>
  (sim.product as Record<string, number>)[field]!;

const KINDS: SimKind[] = ['accumulator', 'decumulator', 'tarf', 'pivotTarf', 'tpf', 'rtpf'];

describe('pathsim: products and parameters', () => {
  it('guards kinds and scenarios', () => {
    expect(isSimKind('tarf')).toBe(true);
    expect(isSimKind('windowBarrier')).toBe(false);
    expect(isSimKind(3)).toBe(false);
    expect(isScenario('shock')).toBe(true);
    expect(isScenario('crash')).toBe(false);
  });

  it('uses the fair parameter from mc-products.json by default', () => {
    for (const k of KINDS) {
      const p = simProduct(k);
      const fair =
        k === 'pivotTarf' ? MC_PRODUCTS.products.pivotTarf.value : MC_PRODUCTS.products[k].value;
      // coupons are quoted to 0.1 pip (PATHSIM_CONFIG.couponQuoteStep), the rest is exact
      if (k === 'tpf' || k === 'rtpf') {
        expect(paramOf(p)).toBe(quoteCoupon(fair));
        expect(Math.abs(paramOf(p) - fair)).toBeLessThanOrEqual(
          PATHSIM_CONFIG.couponQuoteStep / 2 + 1e-12,
        );
        // a whole CHF per coupon on USD 100’000, so coupon × count adds up on screen
        const chf = paramOf(p) * p.notional;
        expect(Math.abs(chf - Math.round(chf))).toBeLessThan(1e-6);
      } else {
        expect(paramOf(p)).toBeCloseTo(fair, 6);
      }
      expect(fairInfo(k).value).toBe(MC_PRODUCTS.products[k].value);
      expect(horizonDays(p)).toBe(p.fixingDays[p.fixingDays.length - 1]);
    }
    expect(solvedParam('accumulator')).toBe('strike');
    expect(solvedParam('pivotTarf')).toBe('width');
    expect(solvedParam('rtpf')).toBe('coupon');
  });

  it('sets the solved parameter through overrides', () => {
    expect(simProduct('accumulator', 0.78).strike).toBe(0.78);
    expect(simProduct('tpf', 0.01).coupon).toBe(0.01);
    const pv = simProduct('pivotTarf', 0.03);
    expect(pv.lowerStrike).toBeCloseTo(pv.pivot - 0.03, 10);
    expect(pv.upperStrike).toBeCloseTo(pv.pivot + 0.03, 10);
    expect(paramOf(pv)).toBeCloseTo(0.03, 10);
    expect(paramOverrides('rtpf', 0.02)).toEqual({ coupon: 0.02 });
    expect(paramOverrides('tarf', 0.76)).toEqual({ strike: 0.76 });
  });

  it('gives parameter ranges that contain the fair value (and the forward for strikes)', () => {
    for (const k of KINDS) {
      const [lo, hi, step] = paramRange(k);
      const f = fairInfo(k);
      expect(lo).toBeLessThan(f.value);
      expect(hi).toBeGreaterThan(f.value);
      expect(step).toBeGreaterThan(0);
      if (solvedParam(k) === 'strike') {
        expect(lo).toBeLessThan(f.forwardAvg);
        expect(hi).toBeGreaterThan(f.forwardAvg);
      }
    }
  });

  it('describes levels and zones of every product', () => {
    for (const k of KINDS) {
      const p = simProduct(k);
      const levels = productLevels(p);
      expect(levels.length).toBeGreaterThan(0);
      const zones = productZones(p);
      expect(zones.some((z) => z.kind === 'gain')).toBe(true);
      expect(zones.some((z) => z.kind === 'loss')).toBe(true);
    }
    const acc = simProduct('accumulator');
    expect(productZones(acc)[0]).toMatchObject({ kind: 'ko', from: acc.barrier });
    const dec = simProduct('decumulator');
    expect(productZones(dec).find((z) => z.kind === 'ko')?.to).toBe(dec.barrier);
  });
});

describe('pathsim: scenarios', () => {
  it('builds the scenario defaults from MC_CONFIG', () => {
    const s = MC_CONFIG.scenarios;
    expect(defaultScenario('trendUp', 182).move).toBe(s.trendUp.move);
    expect(defaultScenario('shock', 100)).toMatchObject({ gap: s.shock.gap, gapDay: 40 });
    expect(defaultScenario('random', 100).seed).toBe(s.random.seed);
  });

  it('reproduces scenarios.ts for default settings and moves the end with `move`', () => {
    const p = scenarioFor({ name: 'trendDown' }, 182);
    expect([...p]).toEqual([...scenarioPath('trendDown', 182, DEFAULT_MARKET)]);
    const moved = scenarioFor({ name: 'trendDown', move: -0.12 }, 182);
    expect(moved[182]).toBeCloseTo(DEFAULT_MARKET.spot * 0.88, 10);
    const rnd = scenarioFor({ name: 'random', seed: 7 }, 30);
    expect([...rnd]).toEqual([...scenarioPath('random', 30, DEFAULT_MARKET, { seed: 7 })]);
  });

  it('puts the shock gap exactly on the chosen day', () => {
    const p = scenarioFor({ name: 'shock', gapDay: 20, gap: -0.1, move: 0 }, 365);
    const jump = p[20]! / p[19]!;
    expect(jump).toBeLessThan(0.92);
    expect(p[21]! / p[20]!).toBeGreaterThan(0.97);
  });
});

describe('pathsim: one simulated path', () => {
  it('matches productPayoff and counts every scheduled fixing', () => {
    for (const k of KINDS) {
      for (const name of PATHSIM_CONFIG.scenarios) {
        const sim = simulate(k, { name });
        const ref = productPayoff(sim.path, simProduct(k), DEFAULT_MARKET);
        expect(sim.rows.length).toBe(sim.product.fixingDays.length);
        expect(sim.rows[sim.rows.length - 1]!.cumPnl).toBeCloseTo(ref.totalPnlQuote, 6);
        expect(sim.reason).toBe(ref.reason);
        expect(sim.endIndex).toBe(ref.endedAt - 1);
        expect(sim.rows.filter((r) => r.active).length).toBe(ref.endedAt);
        for (const r of sim.rows.filter((x) => !x.active)) {
          expect(r.kind).toBe('none');
          expect(r.pnl).toBe(0);
        }
      }
    }
  });

  it('values the forward hedge at the forward of each fixing date', () => {
    const sim = simulate('accumulator', { name: 'sideways' });
    const N = sim.product.notional;
    for (const r of sim.rows) {
      expect(r.forward).toBeCloseTo(forwardAt(DEFAULT_MARKET, r.day), 12);
      expect(r.bench).toBeCloseTo((r.spot - r.forward) * N, 6);
      expect(r.needBase).toBe(N);
    }
    expect(forwardToDay(0)).toBe(DEFAULT_MARKET.spot);
    const dec = simulate('decumulator', { name: 'sideways' });
    expect(dec.rows[0]!.bench).toBeCloseTo((dec.rows[0]!.forward - dec.rows[0]!.spot) * 40_000, 6);
    expect(dec.rows[0]!.needBase).toBe(-dec.product.notional);
  });

  it('knocks the accumulator out in the up-trend and leaves it under-hedged', () => {
    const sim = simulate('accumulator', { name: 'trendUp' });
    expect(sim.reason).toBe('knockout');
    const ko = sim.rows[sim.endIndex]!;
    expect(ko.event).toBe('ko');
    expect(ko.kind).toBe('ko');
    expect(ko.spot).toBeGreaterThanOrEqual(num(sim, 'barrier'));
    const end = playState(sim, sim.days);
    expect(end.ended).toBe(true);
    expect(end.base).toBeLessThan(end.need);
    expect(end.diff).toBeLessThan(0);
    expect(simEvents(sim).map((e) => e.type)).toEqual(['ko']);
  });

  it('marks the leveraged fixings of the accumulator in a down-trend', () => {
    const sim = simulate('accumulator', { name: 'trendDown', move: -0.15 });
    expect(sim.reason).toBe('maturity');
    expect(sim.firstLeveraged).toBeGreaterThanOrEqual(0);
    const lev = sim.rows[sim.firstLeveraged]!;
    expect(lev.kind).toBe('buyLev');
    expect(lev.leveraged).toBe(true);
    expect(lev.amountBase).toBe(2 * sim.product.notional);
    expect(lev.spot).toBeLessThan(num(sim, 'strike'));
    const ev = simEvents(sim);
    expect(ev[0]!.type).toBe('leverage');
    expect(ev[ev.length - 1]!.type).toBe('maturity');
    expect(playState(sim, sim.days).base).toBeGreaterThan(playState(sim, sim.days).need);
  });

  it('ends the TARF at the target with a capped gain', () => {
    const sim = simulate('tarf', { name: 'trendUp' });
    expect(sim.reason).toBe('target');
    const last = sim.rows[sim.endIndex]!;
    expect(last.event).toBe('target');
    expect(last.kind).toBe('buy');
    expect(last.cumPnl).toBeCloseTo(num(sim, 'target') * sim.product.notional, 6);
    expect(last.targetProgress).toBeCloseTo(num(sim, 'target'), 10);
  });

  it('runs the TARF to maturity when an early shock hits before the target', () => {
    const sim = simulate('tarf', { name: 'shock', gapDay: 20, gap: -0.1 });
    expect(sim.gapDay).toBe(20);
    expect(sim.reason).toBe('maturity');
    expect(sim.rows.some((r) => r.kind === 'buyLev')).toBe(true);
    expect(sim.rows[sim.rows.length - 1]!.cumPnl).toBeLessThan(-20_000);
    const ev = simEvents(sim);
    expect(ev[0]).toMatchObject({ type: 'gap', day: 20, fixing: 0 });
  });

  it('tracks coupons and payments of TPF and RTPF with the gains benchmark', () => {
    const good = simulate('tpf', { name: 'sideways' });
    expect(good.reason).toBe('target');
    expect(good.rows.filter((r) => r.kind === 'coupon').length).toBe(num(good, 'targetCoupons'));
    expect(good.rows[good.endIndex]!.targetProgress).toBe(num(good, 'targetCoupons'));
    const bad = simulate('rtpf', { name: 'trendUp' });
    expect(bad.reason).toBe('maturity');
    const end = playState(bad, bad.days);
    expect(end.cumBench).toBeGreaterThan(0);
    expect(end.cumPnl).toBeLessThan(0);
    expect(end.diff).toBeLessThan(0);
    expect(bad.rows.some((r) => r.kind === 'payment' && r.leveraged)).toBe(true);
    expect(end.need).toBe(0);
  });

  it('covers sell rows of the decumulator and the pivot TARF', () => {
    const dec = simulate('decumulator', { name: 'trendUp' });
    expect(dec.rows.some((r) => r.kind === 'sellLev')).toBe(true);
    expect(dec.rows.some((r) => r.kind === 'sell')).toBe(true);
    const piv = simulate('pivotTarf', { name: 'sideways' });
    expect(['buy', 'sell']).toContain(piv.rows[0]!.kind);
    const pivBad = simulate('pivotTarf', { name: 'shock', gapDay: 10, gap: -0.12 });
    expect(pivBad.rows.some((r) => r.kind === 'buyLev')).toBe(true);
  });
});

describe('pathsim: playback', () => {
  const sim = simulate('accumulator', { name: 'trendDown', move: -0.12 });

  it('interpolates the spot between days and clamps to the horizon', () => {
    expect(spotAt(sim.path, 0)).toBe(sim.path[0]);
    expect(spotAt(sim.path, 1.5)).toBeCloseTo((sim.path[1]! + sim.path[2]!) / 2, 12);
    expect(spotAt(sim.path, 1e9)).toBe(sim.path[sim.path.length - 1]);
    expect(spotAt(sim.path, -3)).toBe(sim.path[0]);
  });

  it('counts the fixings passed and the cumulated P&L at time t', () => {
    const before = playState(sim, 6.9);
    expect(before.passed).toBe(0);
    expect(before.last).toBeNull();
    expect(before.cumPnl).toBe(0);
    const at = playState(sim, 14);
    expect(at.passed).toBe(2);
    expect(at.cumPnl).toBeCloseTo(sim.rows[1]!.cumPnl, 9);
    expect(at.need).toBe(2 * sim.product.notional);
    expect(at.ended).toBe(false);
    expect(at.targetProgress).toBe(0);
  });

  it('builds P&L step series and cuts them at t and at the end of the product', () => {
    const full = pnlSteps(sim, 'product');
    expect(full[0]).toEqual([0, 0]);
    expect(full[full.length - 1]![1]).toBeCloseTo(sim.rows[sim.rows.length - 1]!.cumPnl, 9);
    const cut = pnlSteps(sim, 'bench', 20);
    expect(cut[cut.length - 1]![0]).toBe(20);
    const ko = simulate('accumulator', { name: 'trendUp' });
    const prod = pnlSteps(ko, 'product');
    expect(prod[prod.length - 1]![0]).toBe(ko.endDay);
    const bench = pnlSteps(ko, 'bench');
    expect(bench[bench.length - 1]![0]).toBe(ko.days);
  });

  it('returns the latest event at or before t', () => {
    const ev = simEvents(sim);
    expect(eventAt(ev, 0)).toBeNull();
    expect(eventAt(ev, sim.days)?.type).toBe('maturity');
  });
});

describe('pathsim: 100 paths', () => {
  it('is deterministic and reproduces the asymmetry of the TARF', () => {
    const a = simulateEnsemble('tarf', 60, 11);
    const b = simulateEnsemble('tarf', 60, 11);
    expect(a.map((p) => p.pnl)).toEqual(b.map((p) => p.pnl));
    const s = summarizeEnsemble(a);
    expect(s.n).toBe(60);
    expect(s.count.target + s.count.maturity + s.count.knockout).toBe(60);
    expect(s.count.target).toBeGreaterThan(40);
    expect(s.best).toBeCloseTo(fairProduct('tarf').target * 100_000, 6);
    expect(s.meanFixings).toBeLessThan(6);
    expect(s.stdErr).toBeGreaterThan(0);
  });

  it('computes benchmarks for every kind', () => {
    for (const k of KINDS) {
      const e = simulateEnsemble(k, 8, 3);
      expect(e).toHaveLength(8);
      for (const p of e) {
        expect(Number.isFinite(p.bench)).toBe(true);
        expect(p.endDay).toBe(fairProduct(k).fixingDays[p.endIndex]);
      }
    }
    const tpf = simulateEnsemble('tpf', 10, 5, 0.01);
    expect(tpf.every((p) => p.bench >= 0)).toBe(true);
  });

  it('summarises edge cases and sorts by P&L', () => {
    const empty = summarizeEnsemble([]);
    expect(empty).toMatchObject({ n: 0, meanPnl: 0, stdErr: 0, worst: 0, best: 0 });
    expect(empty.meanEarly).toBeNull();
    expect(empty.meanMaturity).toBeNull();
    expect(empty.meanLoss).toBeNull();
    expect(empty.meanFixingsEarly).toBeNull();
    const mk = (pnl: number, reason: EnsemblePath['reason'], endIndex = 0): EnsemblePath => ({
      path: new Float64Array(2),
      endIndex,
      endDay: 1,
      reason,
      pnl,
      bench: 0,
    });
    const paths = [mk(5, 'target', 1), mk(-20, 'maturity', 11), mk(1, 'knockout', 3)];
    const s = summarizeEnsemble(paths);
    expect(s.meanEarly).toBe(3);
    expect(s.meanFixings).toBe(6);
    expect(s.meanFixingsEarly).toBe(3);
    expect(s.meanMaturity).toBe(-20);
    expect(s.losses).toBe(1);
    expect(s.meanLoss).toBe(-20);
    expect(sortedByPnl(paths)).toEqual([1, 2, 0]);
  });
});

describe('pathsim: mean life of the paths that end early', () => {
  it('recovers the conditional mean from the mean over all paths', () => {
    // 3 early paths ending after 2, 3 and 4 fixings, 1 path running all 12 fixings
    expect(earlyEndFixings((2 + 3 + 4 + 12) / 4, 0.25, 0.75, 12)).toBeCloseTo(3, 12);
    expect(earlyEndFixings(12, 1, 0, 12)).toBeNull();
    const s = MC_PRODUCTS.products.accumulator.stats;
    const early = earlyEndFixings(s.expectedFixings, s.pMaturity, s.pKnockOut, 26)!;
    expect(early).toBeGreaterThan(1);
    expect(early).toBeLessThan(s.expectedFixings);
  });
});

describe('pathsim: chart helpers', () => {
  it('pads the rate domain and keeps a minimum span', () => {
    const [lo, hi] = rateDomain([[0.8, 0.81]], [0.79]);
    expect(lo).toBeLessThan(0.79);
    expect(hi).toBeGreaterThan(0.81);
    const [a, b] = rateDomain([[0.8, 0.8]], [], 0, 0.04);
    expect(b - a).toBeCloseTo(0.04, 12);
    expect(rateDomain([], [])).toEqual([0, 1]);
  });

  it('gives month ticks for 6 and 12 months', () => {
    expect(monthTicks(182).map((t) => t.month)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(monthTicks(365).map((t) => t.month)).toEqual([0, 3, 6, 9, 12]);
    expect(monthTicks(365)[4]!.day).toBe(365);
    expect(toPips(0.0123)).toBeCloseTo(123, 9);
  });
});
