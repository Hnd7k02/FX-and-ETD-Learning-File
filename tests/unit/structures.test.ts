import { describe, expect, it } from 'vitest';
import {
  STORY_STEPS,
  blockValue,
  forwardAvg,
  fullStage,
  hasStory,
  lerpStage,
  leveragedStrike,
  productBlocks,
  stageLevels,
  stagePayoff,
  stageSamples,
  storyStages,
  type BlockLine,
} from '@/lib/structures';
import { fairProduct } from '@/lib/fx/mc/fair';
import { DEFAULT_MARKET } from '@/lib/fx/mc/products';
import { gkPrice } from '@/lib/fx/vanilla';
import type { SimKind } from '@/lib/pathsim';

const KINDS: SimKind[] = ['accumulator', 'decumulator', 'tarf', 'pivotTarf', 'tpf', 'rtpf'];

/** Per-fixing payoff written out from §8.7 (without target / knock-out end). */
function reference(kind: SimKind, S: number): number {
  const p = fairProduct(kind) as never as Record<string, number>;
  const N = p.notional!;
  switch (kind) {
    case 'accumulator':
      return S >= p.barrier! ? 0 : (S >= p.strike! ? 1 : 2) * (S - p.strike!) * N;
    case 'decumulator':
      return S <= p.barrier! ? 0 : (S <= p.strike! ? 1 : 2) * (p.strike! - S) * N;
    case 'tarf':
      return (S >= p.strike! ? 1 : 2) * (S - p.strike!) * N;
    case 'pivotTarf': {
      const { lowerStrike: k1, upperStrike: k2, pivot: P } = p as Record<string, number>;
      if (S <= k1!) return 2 * (S - k1!) * N;
      if (S <= P!) return (S - k1!) * N;
      if (S < k2!) return (k2! - S) * N;
      return 2 * (k2! - S) * N;
    }
    case 'tpf':
      return S >= p.strike! ? p.coupon! * N : -2 * (p.strike! - S) * N;
    case 'rtpf':
      if (S >= p.lower! && S <= p.upper!) return p.coupon! * N;
      return -2 * (S < p.lower! ? p.lower! - S : S - p.upper!) * N;
  }
}

describe('structures: building blocks', () => {
  it('sums the blocks to the §8.7 payoff of one fixing', () => {
    for (const k of KINDS) {
      const stage = fullStage(k);
      for (let S = 0.7; S <= 0.9; S += 0.0037) {
        expect(stagePayoff(stage, S), `${k} at ${S}`).toBeCloseTo(reference(k, S), 6);
      }
    }
  });

  it('values each block shape', () => {
    const call: BlockLine = { key: 'longCall', shape: 'call', sign: 1, ratio: 1, level: 0.8 };
    const put: BlockLine = { key: 'shortPut', shape: 'put', sign: -1, ratio: 2, level: 0.8 };
    const dig: BlockLine = {
      key: 'longDigitalCall',
      shape: 'digitalCall',
      sign: 1,
      ratio: 1,
      level: 0.8,
      cash: 0.01,
    };
    const rng: BlockLine = {
      key: 'longRangeDigital',
      shape: 'rangeDigital',
      sign: 1,
      ratio: 1,
      level: 0.78,
      upper: 0.82,
      cash: 0.02,
    };
    expect(blockValue(call, 0.81)).toBeCloseTo(0.01, 12);
    expect(blockValue(put, 0.79)).toBeCloseTo(-0.02, 12);
    expect(blockValue(dig, 0.8)).toBe(0.01);
    expect(blockValue(dig, 0.79)).toBe(0);
    expect(blockValue(rng, 0.8)).toBe(0.02);
    expect(blockValue(rng, 0.83)).toBe(0);
    expect(blockValue({ ...dig, cash: undefined }, 0.9)).toBe(0);
    expect(blockValue({ ...rng, upper: undefined, cash: undefined }, 0.78)).toBe(0);
  });

  it('reads the blocks of every product from BUILDING_BLOCKS', () => {
    expect(productBlocks(fairProduct('accumulator')).map((b) => [b.key, b.ratio])).toEqual([
      ['longCall', 1],
      ['shortPut', 2],
    ]);
    expect(productBlocks(fairProduct('pivotTarf'))).toHaveLength(4);
    const rtpf = productBlocks(fairProduct('rtpf'));
    expect(rtpf[0]).toMatchObject({ shape: 'rangeDigital', upper: fairProduct('rtpf').upper });
  });

  it('knows the features of every full stage', () => {
    expect(fullStage('accumulator').knockOut?.from).toBe(fairProduct('accumulator').barrier);
    expect(fullStage('decumulator').knockOut?.to).toBe(fairProduct('decumulator').barrier);
    expect(fullStage('tarf').target).toEqual({ kind: 'pips', value: fairProduct('tarf').target });
    expect(fullStage('pivotTarf').strike).toBe(fairProduct('pivotTarf').pivot);
    expect(fullStage('tpf').target).toEqual({ kind: 'coupons', value: 6 });
    const r = fairProduct('rtpf');
    expect(fullStage('rtpf').strike).toBeCloseTo((r.lower + r.upper) / 2, 12);
  });
});

describe('structures: the three-step story', () => {
  it('has a story for the strike products only', () => {
    expect(hasStory('accumulator')).toBe(true);
    expect(hasStory('tarf')).toBe(true);
    expect(hasStory('tpf')).toBe(false);
    expect(STORY_STEPS).toEqual(['forward', 'leveraged', 'full']);
  });

  it('solves the leveraged strip strike so that it costs nothing (closed form)', () => {
    const p = fairProduct('accumulator');
    const K = leveragedStrike(p.fixingDays, true, 2);
    const { spot: S, vol, rd, rf } = DEFAULT_MARKET;
    let pv = 0;
    for (const d of p.fixingDays) {
      const T = d / 365;
      pv += gkPrice(S, K, T, vol, rd, rf, 'call') - 2 * gkPrice(S, K, T, vol, rd, rf, 'put');
    }
    expect(Math.abs(pv)).toBeLessThan(1e-9);
    const Ks = leveragedStrike(p.fixingDays, false, 2);
    expect(Ks).toBeGreaterThan(forwardAvg('decumulator'));
  });

  it('improves the strike at every step (buyer lower, seller higher)', () => {
    for (const k of ['accumulator', 'tarf'] as const) {
      const [f, l, full] = storyStages(k);
      expect(f!.strike).toBeCloseTo(forwardAvg(k), 9);
      expect(l!.strike).toBeLessThan(f!.strike);
      expect(full!.strike).toBeLessThan(l!.strike);
      // forward stage: long call F + short put F is a plain forward
      expect(stagePayoff(f!, 0.83)).toBeCloseTo((0.83 - f!.strike) * f!.notional, 6);
      expect(stagePayoff(f!, 0.75)).toBeCloseTo((0.75 - f!.strike) * f!.notional, 6);
      // leveraged stage: double amount below the strike
      expect(stagePayoff(l!, l!.strike - 0.01)).toBeCloseTo(-0.02 * l!.notional, 6);
    }
    const [f, l, full] = storyStages('decumulator');
    expect(l!.strike).toBeGreaterThan(f!.strike);
    expect(full!.strike).toBeGreaterThan(l!.strike);
    expect(stagePayoff(f!, 0.75)).toBeCloseTo((f!.strike - 0.75) * f!.notional, 6);
  });

  it('morphs between stages with the same structure', () => {
    const [f, l, full] = storyStages('accumulator');
    const mid = lerpStage(f!, l!, 0.5);
    expect(mid.strike).toBeCloseTo((f!.strike + l!.strike) / 2, 12);
    expect(mid.blocks[1]!.ratio).toBeCloseTo(1.5, 12);
    expect(lerpStage(l!, full!, 0.2).knockOut).toBeNull();
    expect(lerpStage(l!, full!, 0.8).knockOut).not.toBeNull();
    const other = { ...full!, blocks: full!.blocks.slice(0, 1) };
    expect(lerpStage(l!, other, 0.3)).toBe(l);
    expect(lerpStage(l!, other, 0.7)).toBe(other);
  });

  it('samples kinks, knock-out edges and range bounds', () => {
    const acc = fullStage('accumulator');
    expect(stageLevels(acc)).toEqual([acc.strike, fairProduct('accumulator').barrier]);
    const dec = fullStage('decumulator');
    expect(stageLevels(dec)).toContain(fairProduct('decumulator').barrier);
    const rtpf = fullStage('rtpf');
    expect(stageLevels(rtpf)).toContain(fairProduct('rtpf').upper);
    const pts = stageSamples(acc, 0.72, 0.88, 40);
    expect(pts.length).toBeGreaterThan(41);
    const xs = pts.map((p) => p[0]);
    expect(xs).toEqual([...xs].sort((a, b) => a - b));
    expect(pts.some(([x, y]) => x > acc.knockOut!.from && y === 0)).toBe(true);
  });
});
