/**
 * Building blocks of the structured products (module 08, StructureBlocks island): payoff of
 * ONE fixing as a function of the fixing rate S_i, split into its option building blocks, and
 * the three-step story of the strike products ("how a better rate than the forward is built"):
 *
 *   1. forward    buy N at the forward F (= long call F + short put F, one each),
 *   2. leveraged  long call K₂ + 2 short puts K₂, K₂ solved in closed form so that the strip of
 *                 all fixings costs nothing (Garman-Kohlhagen, T = day / 365),
 *   3. full       the product of §8.7 with its knock-out or target, fair strike from the Monte
 *                 Carlo engine (mc-products.json).
 *
 * Amounts are CHF per fixing on the product's notional N (client view). Pure, no DOM.
 */
import { gkPrice } from '@/lib/fx/vanilla';
import { MC_PRODUCTS, fairProduct } from '@/lib/fx/mc/fair';
import {
  BUILDING_BLOCKS,
  DEFAULT_MARKET,
  MC_CONFIG,
  type BlockKey,
  type Market,
  type ProductOf,
} from '@/lib/fx/mc/products';
import type { SimKind } from './pathsim';

/** Products with the three-step story (they have a strike that can be compared to F). */
export const STORY_KINDS = ['accumulator', 'decumulator', 'tarf'] as const;
export type StoryKind = (typeof STORY_KINDS)[number];
export type StoryStep = 'forward' | 'leveraged' | 'full';
export const STORY_STEPS: readonly StoryStep[] = ['forward', 'leveraged', 'full'];

export function hasStory(kind: SimKind): kind is StoryKind {
  return (STORY_KINDS as readonly string[]).includes(kind);
}

/** Instrument of a block line. Features (knock-out, target) are not lines. */
export type BlockShape = 'call' | 'put' | 'digitalCall' | 'rangeDigital';

/** One building block as a payoff line: `ratio` × N of `shape` at `level` (sign = side). */
export interface BlockLine {
  key: BlockKey;
  shape: BlockShape;
  /** +1 bought by the client, −1 sold. */
  sign: 1 | -1;
  ratio: number;
  /** Strike (or lower bound of the range digital). */
  level: number;
  /** Upper bound of the range digital. */
  upper?: number;
  /** Cash amount per USD of N for digitals (the coupon). */
  cash?: number;
}

/** A stage of a product: its blocks, the strike, and the features that cut the payoff. */
export interface Stage {
  kind: SimKind;
  step: StoryStep;
  notional: number;
  /** Main strike shown on the axis (pivot TARF: the pivot; RTPF: the range middle). */
  strike: number;
  blocks: BlockLine[];
  /** Knock-out region (payoff of that fixing is 0 and the product ends), if any. */
  knockOut: { from: number; to: number } | null;
  /** Target in CHF per USD (TARF, pivot TARF) or in coupons (TPF, RTPF); null if none. */
  target: { kind: 'pips' | 'coupons'; value: number } | null;
}

/** Payoff of one block line at S, in CHF per USD of notional. */
export function blockValue(b: BlockLine, S: number): number {
  let v: number;
  switch (b.shape) {
    case 'call':
      v = Math.max(S - b.level, 0);
      break;
    case 'put':
      v = Math.max(b.level - S, 0);
      break;
    case 'digitalCall':
      v = S >= b.level ? (b.cash ?? 0) : 0;
      break;
    case 'rangeDigital':
      v = S >= b.level && S <= (b.upper ?? b.level) ? (b.cash ?? 0) : 0;
      break;
  }
  return b.sign * b.ratio * v;
}

/**
 * Payoff of one fixing at S (CHF on N): sum of the blocks, 0 inside the knock-out region.
 * A target in pips caps the gain of the fixing (one fixing can never earn more than the whole
 * target: the last gain is capped so that the sum is exactly the target); losses stay uncapped.
 */
export function stagePayoff(stage: Stage, S: number): number {
  if (stage.knockOut && S >= stage.knockOut.from && S <= stage.knockOut.to) return 0;
  let sum = 0;
  for (const b of stage.blocks) sum += blockValue(b, S);
  if (stage.target?.kind === 'pips') sum = Math.min(sum, stage.target.value);
  return sum * stage.notional;
}

const SHAPE: Partial<Record<BlockKey, [BlockShape, 1 | -1]>> = {
  longCall: ['call', 1],
  shortCall: ['call', -1],
  longPut: ['put', 1],
  shortPut: ['put', -1],
  longDigitalCall: ['digitalCall', 1],
  longRangeDigital: ['rangeDigital', 1],
};

/** Block lines of a product from BUILDING_BLOCKS (src/lib/fx/mc/products.ts). */
export function productBlocks(product: ProductOf<SimKind>): BlockLine[] {
  const out: BlockLine[] = [];
  const fields = product as unknown as Record<string, number>;
  for (const b of BUILDING_BLOCKS[product.kind]) {
    const shape = SHAPE[b.key];
    if (!shape) continue;
    const level = fields[b.levels[0]!]!;
    const line: BlockLine = { key: b.key, shape: shape[0], sign: shape[1], ratio: b.ratio, level };
    if (shape[0] === 'rangeDigital') line.upper = fields[b.levels[1]!]!;
    if (shape[0] === 'digitalCall' || shape[0] === 'rangeDigital') line.cash = fields.coupon!;
    out.push(line);
  }
  return out;
}

/** The full (fair) product as a stage. */
export function fullStage(kind: SimKind): Stage {
  const p = fairProduct(kind) as ProductOf<SimKind>;
  let strike: number;
  let knockOut: Stage['knockOut'] = null;
  let target: Stage['target'] = null;
  switch (p.kind) {
    case 'accumulator':
      strike = p.strike;
      knockOut = { from: p.barrier, to: Number.POSITIVE_INFINITY };
      break;
    case 'decumulator':
      strike = p.strike;
      knockOut = { from: Number.NEGATIVE_INFINITY, to: p.barrier };
      break;
    case 'tarf':
      strike = p.strike;
      target = { kind: 'pips', value: p.target };
      break;
    case 'pivotTarf':
      strike = p.pivot;
      target = { kind: 'pips', value: p.target };
      break;
    case 'tpf':
      strike = p.strike;
      target = { kind: 'coupons', value: p.targetCoupons };
      break;
    case 'rtpf':
      strike = (p.lower + p.upper) / 2;
      target = { kind: 'coupons', value: p.targetCoupons };
      break;
  }
  return {
    kind,
    step: 'full',
    notional: p.notional,
    strike,
    blocks: productBlocks(p),
    knockOut,
    target,
  };
}

/**
 * Closed-form zero-cost strike of a leveraged forward strip without knock-out or target:
 * Σ_i [V_bought(K, t_i) − leverage · V_sold(K, t_i)] = 0 with Garman-Kohlhagen prices
 * (buyer: call bought, puts sold; seller: put bought, calls sold), t_i = day_i / 365.
 * Solved by bisection (the sum is monotone in K).
 */
export function leveragedStrike(
  fixingDays: readonly number[],
  buyer: boolean,
  leverage = 2,
  market: Market = DEFAULT_MARKET,
): number {
  const year = MC_CONFIG.conventions.daysPerYear;
  const { spot: S, vol, rd, rf } = market;
  const pv = (K: number) => {
    let sum = 0;
    for (const d of fixingDays) {
      const T = d / year;
      const call = gkPrice(S, K, T, vol, rd, rf, 'call');
      const put = gkPrice(S, K, T, vol, rd, rf, 'put');
      sum += buyer ? call - leverage * put : put - leverage * call;
    }
    return sum;
  };
  let lo = S * 0.5;
  let hi = S * 1.5;
  // Buyer: pv falls with K; seller: pv rises with K.
  for (let i = 0; i < 200 && hi - lo > 1e-12; i++) {
    const mid = (lo + hi) / 2;
    const v = pv(mid);
    if (buyer ? v > 0 : v < 0) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

/** Forward to the average fixing day of a product (the "better than forward" benchmark). */
export function forwardAvg(kind: SimKind): number {
  return MC_PRODUCTS.products[kind].forwardAvg;
}

/**
 * The three stages of a strike product: forward → leveraged forward strip (closed form) →
 * full product (Monte Carlo). For the buyer the forward stage is long call F + short put F,
 * for the seller (decumulator) long put F + short call F.
 */
export function storyStages(kind: StoryKind): Stage[] {
  const full = fullStage(kind);
  const p = fairProduct(kind);
  const buyer = kind !== 'decumulator';
  const F = forwardAvg(kind);
  const K2 = leveragedStrike(p.fixingDays, buyer, p.leverage);
  const pair = (K: number, soldRatio: number): BlockLine[] =>
    buyer
      ? [
          { key: 'longCall', shape: 'call', sign: 1, ratio: 1, level: K },
          { key: 'shortPut', shape: 'put', sign: -1, ratio: soldRatio, level: K },
        ]
      : [
          { key: 'longPut', shape: 'put', sign: 1, ratio: 1, level: K },
          { key: 'shortCall', shape: 'call', sign: -1, ratio: soldRatio, level: K },
        ];
  const base = { kind, notional: p.notional, knockOut: null, target: null };
  return [
    { ...base, step: 'forward', strike: F, blocks: pair(F, 1) },
    { ...base, step: 'leveraged', strike: K2, blocks: pair(K2, p.leverage) },
    full,
  ];
}

/**
 * Interpolates two stages with the same block structure (strike, levels and ratios), for the
 * morph between story steps. `k` in [0, 1]. Features come from `b` once k ≥ 0.5.
 */
export function lerpStage(a: Stage, b: Stage, k: number): Stage {
  if (a.blocks.length !== b.blocks.length) return k < 0.5 ? a : b;
  const mix = (x: number, y: number) => x + (y - x) * k;
  return {
    ...(k < 0.5 ? a : b),
    strike: mix(a.strike, b.strike),
    blocks: a.blocks.map((x, i) => {
      const y = b.blocks[i]!;
      return { ...y, level: mix(x.level, y.level), ratio: mix(x.ratio, y.ratio) };
    }),
  };
}

/** Breakpoints of a stage's payoff (strikes, range bounds, knock-out edges). */
export function stageLevels(stage: Stage): number[] {
  const out = new Set<number>();
  for (const b of stage.blocks) {
    out.add(b.level);
    if (b.upper !== undefined) out.add(b.upper);
  }
  if (stage.knockOut) {
    if (Number.isFinite(stage.knockOut.from)) out.add(stage.knockOut.from);
    if (Number.isFinite(stage.knockOut.to)) out.add(stage.knockOut.to);
  }
  // Kinks where the gain reaches a target in pips (the payoff is linear between block levels).
  if (stage.target?.kind === 'pips' && out.size) {
    const cap = stage.target.value;
    const raw = (S: number) => stage.blocks.reduce((s, b) => s + blockValue(b, S), 0) - cap;
    const lv = [...out].sort((x, y) => x - y);
    const xs = [lv[0]! - 1, ...lv, lv[lv.length - 1]! + 1];
    for (let i = 1; i < xs.length; i++) {
      const a = xs[i - 1]!;
      const b = xs[i]!;
      const fa = raw(a);
      const fb = raw(b);
      if (fa * fb < 0) out.add(a + ((b - a) * fa) / (fa - fb));
    }
  }
  return [...out].sort((x, y) => x - y);
}

/**
 * Sample points of a stage payoff on [x0, x1]: a regular grid plus both sides of every
 * breakpoint, so kinks and the jumps of digitals and knock-outs stay sharp.
 */
export function stageSamples(
  stage: Stage,
  x0: number,
  x1: number,
  n = 120,
): Array<[number, number]> {
  const xs = new Set<number>();
  for (let i = 0; i <= n; i++) xs.add(x0 + ((x1 - x0) * i) / n);
  const eps = (x1 - x0) * 1e-6;
  for (const l of stageLevels(stage)) {
    if (l > x0 && l < x1) {
      xs.add(l - eps);
      xs.add(l);
      xs.add(l + eps);
    }
  }
  return [...xs].sort((a, b) => a - b).map((x) => [x, stagePayoff(stage, x)]);
}
