/**
 * Theoretical maximum loss (src/lib/fx/mc/maxloss.ts): the bound comes from the product
 * parameters, typed per side ({ kind: 'finite', chf } or { kind: 'unbounded' }), and the very
 * kernels that price the products reach it on a path at S = 0 (finite downwards) or lose
 * linearly without limit as S rises (unbounded upwards).
 *
 * Same parameters and kernels as the app: the products of module 08 (M08_PRODUCTS, the TPF and
 * RTPF with the quoted coupon of the texts and the path simulator) and the fair products of the
 * product matrix and module 09 (fairProduct), run through productPayoff and runKernel.
 */
import { describe, expect, it } from 'vitest';
import { fairProduct } from '@/lib/fx/mc/fair';
import {
  finiteChf,
  lossLevels,
  maxLoss,
  type MaxLoss,
  type SideLoss,
  type ZeroCostProduct,
} from '@/lib/fx/mc/maxloss';
import { createRng } from '@/lib/fx/mc/rng';
import { productPayoff, runKernel, type CashflowSink } from '@/lib/fx/mc/payoffs';
import {
  buildProduct,
  DEFAULT_MARKET as m,
  SOLVED_PARAM,
  type ZeroCostKind,
} from '@/lib/fx/mc/products';
import { simProduct } from '@/lib/pathsim';
import { formatNum } from '@/lib/nums/format';
import { M08, M08_MAX_LOSS, M08_PRODUCTS, nums as n08 } from '@/lib/nums/m08';
import { M09, nums as n09 } from '@/lib/nums/m09';
import type { Lang } from '@/i18n/types';

const KINDS = Object.keys(SOLVED_PARAM) as ZeroCostKind[];
const LANGS: Lang[] = ['de', 'en'];

/**
 * Every product set the app uses: module 08 texts and path simulator (M08_PRODUCTS), the path
 * simulator's own constructor (simProduct) and the matrix / module 09 (fairProduct).
 */
const SETS: Array<[string, (k: ZeroCostKind) => ZeroCostProduct]> = [
  ['m08', (k) => M08_PRODUCTS[k]],
  ['pathsim', (k) => simProduct(k)],
  ['matrix/m09', (k) => fairProduct(k)],
];
const CASES = SETS.flatMap(([set, get]) => KINDS.map((k) => [set, k, get(k)] as const));

/** Daily path with every observation at S (path[0] = spot today). */
function flatPath(p: ZeroCostProduct, S: number): Float64Array {
  const days = p.fixingDays;
  const path = new Float64Array(days[days.length - 1]! + 1).fill(S);
  path[0] = m.spot;
  return path;
}

/** Loss (CHF against the market, > 0 = loss) of the kernel on a flat path at S. */
const lossAt = (p: ZeroCostProduct, S: number): number =>
  -productPayoff(flatPath(p, S), p, m).totalPnlQuote;

/** Loss of the kernel on given observations (one per fixing). */
function lossOn(p: ZeroCostProduct, obs: ArrayLike<number>): number {
  let pnl = 0;
  const sink: CashflowSink = {
    flow: (_i, _k, _b, _q, x) => (pnl += x),
    end: () => undefined,
  };
  runKernel(p, obs, 0, sink);
  return -pnl;
}

/** Every number a MaxLoss carries (an unbounded side carries none). */
const numbersOf = (b: MaxLoss): number[] =>
  [b.down, b.up]
    .filter((s): s is Extract<SideLoss, { kind: 'finite' }> => s.kind === 'finite')
    .map((s) => s.chf)
    .concat(b.slope, b.downLevel ?? 0, b.upLevel ?? 0);

/** A displayed CHF amount (no-break space after the currency, as fmtMoney writes it). */
const C = (n: string) => `CHF\u00a0${n}`;
/** The displayed check value: formatNum de and en of a CHF amount. */
const shown = (chf: number, lang: Lang) => formatNum({ value: chf, kind: 'money' }, lang);

describe('maxLoss: typed per side, check values (CHF against the market)', () => {
  it('accumulator: 26 × 2 × 40’000 × fair strike → CHF 1’609’878, upwards no loss', () => {
    const p = M08_PRODUCTS.accumulator;
    const b = maxLoss(p);
    expect(b.down.kind).toBe('finite');
    expect(finiteChf(b.down)).toBeCloseTo(26 * 2 * 40_000 * p.strike, 6);
    expect(finiteChf(b.down)).toBeCloseTo(1_609_878, -1);
    expect(shown(finiteChf(b.down), 'de')).toBe(C('1’609’878'));
    expect(shown(finiteChf(b.down), 'en')).toBe(C('1,609,878'));
    expect(b.up).toEqual({ kind: 'finite', chf: 0 });
    expect(b.kind).toBe('finite');
  });

  it('TARF CHF 1’804’349 and TPF CHF 1’872’000: finite on both sides', () => {
    const tarf = maxLoss(M08_PRODUCTS.tarf);
    expect(finiteChf(tarf.down)).toBeCloseTo(12 * 2 * 100_000 * M08_PRODUCTS.tarf.strike, 6);
    expect(finiteChf(tarf.down)).toBeCloseTo(1_804_349, -1);
    expect(shown(finiteChf(tarf.down), 'de')).toBe(C('1’804’349'));
    expect(shown(finiteChf(tarf.down), 'en')).toBe(C('1,804,349'));
    expect([tarf.up, tarf.kind]).toEqual([{ kind: 'finite', chf: 0 }, 'finite']);
    const tpf = maxLoss(M08_PRODUCTS.tpf);
    expect(finiteChf(tpf.down)).toBeCloseTo(12 * 2 * 100_000 * M08_PRODUCTS.tpf.strike, 6);
    expect(finiteChf(tpf.down)).toBeCloseTo(1_872_000, -1);
    expect(shown(finiteChf(tpf.down), 'de')).toBe(C('1’872’000'));
    expect(shown(finiteChf(tpf.down), 'en')).toBe(C('1,872,000'));
    expect([tpf.up, tpf.kind]).toEqual([{ kind: 'finite', chf: 0 }, 'finite']);
  });

  it('pivot TARF CHF 1’800’770 and RTPF CHF 1’852’800 downwards, unbounded upwards', () => {
    const piv = M08_PRODUCTS.pivotTarf;
    const bp = maxLoss(piv);
    expect(finiteChf(bp.down)).toBeCloseTo(12 * 2 * 100_000 * piv.lowerStrike, 6);
    expect(finiteChf(bp.down)).toBeCloseTo(1_800_770, -1);
    expect(shown(finiteChf(bp.down), 'de')).toBe(C('1’800’770'));
    expect(shown(finiteChf(bp.down), 'en')).toBe(C('1,800,770'));
    expect([bp.downLevel, bp.upLevel]).toEqual([piv.lowerStrike, piv.upperStrike]);
    expect([bp.up, bp.kind]).toEqual([{ kind: 'unbounded' }, 'unbounded']);
    const rtpf = M08_PRODUCTS.rtpf;
    const br = maxLoss(rtpf);
    expect(finiteChf(br.down)).toBeCloseTo(12 * 2 * 100_000 * rtpf.lower, 6);
    expect(finiteChf(br.down)).toBeCloseTo(1_852_800, -1);
    expect(shown(finiteChf(br.down), 'de')).toBe(C('1’852’800'));
    expect(shown(finiteChf(br.down), 'en')).toBe(C('1,852,800'));
    expect([br.downLevel, br.upLevel]).toEqual([rtpf.lower, rtpf.upper]);
    expect([br.up, br.kind]).toEqual([{ kind: 'unbounded' }, 'unbounded']);
  });

  it('decumulator: no loss downwards (knock-out), unbounded upwards', () => {
    const p = M08_PRODUCTS.decumulator;
    const b = maxLoss(p);
    expect(b.down).toEqual({ kind: 'finite', chf: 0 });
    expect(b.up).toEqual({ kind: 'unbounded' });
    expect([b.downLevel, b.upLevel, b.kind]).toEqual([null, p.strike, 'unbounded']);
  });

  it('derives the bound from the parameters (fixings, leverage, notional, strike)', () => {
    const p = buildProduct('tarf', m, { strike: 0.7, notional: 50_000, leverage: 3 });
    const b = maxLoss(p);
    expect(b.slope).toBe(12 * 3 * 50_000);
    expect(finiteChf(b.down)).toBeCloseTo(12 * 3 * 50_000 * 0.7, 8);
    expect(lossLevels(buildProduct('accumulator', m, { strike: 0.75 }))).toEqual({
      down: 0.75,
      up: null,
    });
  });

  it('module 08 exposes the typed bounds of exactly the products it shows', () => {
    for (const k of KINDS) expect(M08_MAX_LOSS[k], k).toEqual(maxLoss(M08_PRODUCTS[k]));
    // the coupon is quoted for the texts and the simulator; the bound does not depend on it
    expect(M08_PRODUCTS.tpf).toEqual(simProduct('tpf'));
    expect(M08_PRODUCTS.rtpf).toEqual(simProduct('rtpf'));
    for (const k of KINDS) expect(maxLoss(M08_PRODUCTS[k]), k).toEqual(maxLoss(fairProduct(k)));
  });
});

describe('Infinity and NaN never appear formatted', () => {
  it.each(CASES)('%s %s: every number is finite, an unbounded side has none', (_s, _k, p) => {
    const b = maxLoss(p);
    for (const x of numbersOf(b)) expect(Number.isFinite(x)).toBe(true);
    for (const side of [b.down, b.up]) {
      if (side.kind === 'unbounded') {
        expect(Object.keys(side)).toEqual(['kind']);
        expect(() => finiteChf(side)).toThrow(RangeError);
      } else {
        for (const lang of LANGS) expect(shown(finiteChf(side), lang)).not.toMatch(/∞|NaN|–/);
      }
    }
  });

  it('the maximum-loss numbers of modules 08 and 09 format without ∞ or NaN', () => {
    const keys = [
      ...Object.keys(n08).filter((k) => /MaxLoss/.test(k)),
      ...Object.keys(n09).filter((k) => /MaxLoss/.test(k)),
    ];
    expect(keys.length).toBe(8);
    for (const k of keys) {
      const d = (n08[k] ?? n09[k])!;
      expect(Number.isFinite(d.value), k).toBe(true);
      for (const lang of LANGS) expect(formatNum(d, lang), k).toMatch(/^CHF\u00a0[0-9’,]+$/);
    }
  });

  it('finiteChf refuses an unbounded side', () => {
    expect(() => finiteChf({ kind: 'unbounded' })).toThrow(/theoretically unlimited/);
    expect(finiteChf({ kind: 'finite', chf: 12 })).toBe(12);
  });
});

describe('the kernels reach the bound (same products as the app)', () => {
  it.each(CASES)('%s %s: every fixing at S = 0 loses exactly the bound downwards', (_s, _k, p) => {
    const b = maxLoss(p);
    const down = finiteChf(b.down);
    expect(lossAt(p, 0)).toBeCloseTo(down, 6);
    // S near 0: the bound is the limit, approached linearly and never exceeded
    const eps = 1e-6;
    const near = lossAt(p, eps);
    expect(near).toBeLessThanOrEqual(down);
    expect(near).toBeCloseTo(down - (b.downLevel === null ? 0 : b.slope * eps), 6);
  });

  it.each(CASES.filter(([, k]) => ['pivotTarf', 'rtpf', 'decumulator'].includes(k)))(
    '%s %s: unbounded upwards, the loss grows linearly without limit as S rises',
    (_s, _k, p) => {
      const b = maxLoss(p);
      expect(b.up.kind).toBe('unbounded');
      const K = b.upLevel!;
      for (const S of [1, 2, 10, 1000]) {
        expect(lossAt(p, S)).toBeCloseTo(b.slope * (S - K), 4);
      }
      // equal steps in S give equal steps in the loss, and it passes any finite bound
      expect(lossAt(p, 3) - lossAt(p, 2)).toBeCloseTo(lossAt(p, 2) - lossAt(p, 1), 4);
      expect(lossAt(p, 1e6)).toBeGreaterThan(1e3 * finiteChf(maxLoss(M08_PRODUCTS.tpf).down));
    },
  );

  it.each(CASES.filter(([, k]) => ['accumulator', 'tarf', 'tpf'].includes(k)))(
    '%s %s: finite upwards, no loss when S rises (knock-out, target or coupons)',
    (_s, _k, p) => {
      expect(maxLoss(p).up).toEqual({ kind: 'finite', chf: 0 });
      for (const S of [1, 10, 1000]) expect(lossAt(p, S)).toBeLessThanOrEqual(0);
    },
  );

  it('no path loses more than the finite bound (random fixings, S ≥ 0)', () => {
    const rng = createRng(7);
    const rnd = () => rng.uniform();
    for (const kind of ['accumulator', 'tarf', 'tpf'] as const) {
      const p = M08_PRODUCTS[kind];
      const down = finiteChf(maxLoss(p).down);
      const n = p.fixingDays.length;
      for (let k = 0; k < 500; k++) {
        const obs = Float64Array.from({ length: n }, () => (rnd() < 0.5 ? rnd() * 0.05 : rnd()));
        expect(lossOn(p, obs)).toBeLessThanOrEqual(down + 1e-6);
      }
    }
  });

  it('the theoretical bound is far beyond the worst simulated path', () => {
    expect(M08.accMaxLoss).toBeGreaterThan(-M08.accWorst);
    expect(M08.tarfMaxLoss).toBeGreaterThan(-M08.tarfWorst);
    expect(M08.tpfMaxLoss).toBeGreaterThan(-M08.tpfWorst);
    expect(M08.pivMaxLossDown).toBeGreaterThan(-M08.pivWorst);
    expect(M08.rtpfMaxLossDown).toBeGreaterThan(-M08.rtpfWorst);
  });
});

describe('number registry (m08, m09)', () => {
  it('registers the check values as CHF amounts, shown in de and en', () => {
    const cases: Array<[typeof n08, string, number, string, string]> = [
      [n08, 'm08.accMaxLoss', 1_609_878, C('1’609’878'), C('1,609,878')],
      [n08, 'm08.tarfMaxLoss', 1_804_349, C('1’804’349'), C('1,804,349')],
      [n08, 'm08.pivMaxLossDown', 1_800_770, C('1’800’770'), C('1,800,770')],
      [n08, 'm08.tpfMaxLoss', 1_872_000, C('1’872’000'), C('1,872,000')],
      [n08, 'm08.rtpfMaxLossDown', 1_852_800, C('1’852’800'), C('1,852,800')],
      [n09, 'm09.accMaxLoss', 1_609_878, C('1’609’878'), C('1,609,878')],
      [n09, 'm09.tarfMaxLoss', 1_804_349, C('1’804’349'), C('1,804,349')],
      [n09, 'm09.tpfMaxLoss', 1_872_000, C('1’872’000'), C('1,872,000')],
    ];
    for (const [table, key, chf, de, en] of cases) {
      const d = table[key]!;
      expect(d.kind, key).toBe('money');
      expect(d.ccy ?? 'CHF', key).toBe('CHF');
      expect(d.value, key).toBeCloseTo(chf, -1);
      expect(formatNum(d, 'de'), key).toBe(de);
      expect(formatNum(d, 'en'), key).toBe(en);
    }
  });

  it('the registered bounds are the typed finite sides of the app products', () => {
    expect(M08.accMaxLoss).toBe(finiteChf(M08_MAX_LOSS.accumulator.down));
    expect(M08.tarfMaxLoss).toBe(finiteChf(M08_MAX_LOSS.tarf.down));
    expect(M08.pivMaxLossDown).toBe(finiteChf(M08_MAX_LOSS.pivotTarf.down));
    expect(M08.tpfMaxLoss).toBe(finiteChf(M08_MAX_LOSS.tpf.down));
    expect(M08.rtpfMaxLossDown).toBe(finiteChf(M08_MAX_LOSS.rtpf.down));
  });

  it('module 08 and 09 show the same bounds', () => {
    expect(M09.accMaxLoss).toBe(M08.accMaxLoss);
    expect(M09.tarfMaxLoss).toBe(M08.tarfMaxLoss);
    expect(M09.tpfMaxLoss).toBe(M08.tpfMaxLoss);
  });
});
