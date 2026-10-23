import { describe, expect, it } from 'vitest';
import { EXAMPLE, EXAMPLE_FORWARD } from '@/lib/fx/example';
import { MODULES } from '@/data/modules';
import {
  ALPHA_VIEW_IDS,
  DIR_VIEW_IDS,
  MATRIX,
  NEED_IDS,
  PRODUCTS,
  PRODUCT_IDS,
  alphaView,
  cellProducts,
  cellRiskSpread,
  cellSpreadAt,
  clippedBelow,
  defaultView,
  initialMatrixFixing,
  isAlphaView,
  isDirView,
  isNeed,
  keyFact,
  makeCell,
  matrixGrid,
  matrixParams,
  matrixRange,
  productCells,
  productCurve,
  productResult,
  productSeverity,
  profileGroups,
  riskChips,
  snapMatrixFixing,
  splitAlphaView,
  viewsOf,
  type Cell,
} from '@/lib/matrix';
import { M09_CONFIG, PIP } from '@/lib/m09/config';
import { productmatrix } from '@/i18n/dict/productmatrix';

const p = matrixParams();
const S = EXAMPLE.spot;

const allCells = (): Cell[] => [
  ...DIR_VIEW_IDS.map((view): Cell => ({ need: 'hedge', view })),
  ...ALPHA_VIEW_IDS.map((view): Cell => ({ need: 'alpha', view })),
  ...DIR_VIEW_IDS.map((view): Cell => ({ need: 'yield', view })),
];

describe('matrix table', () => {
  it('maps the alpha quadrants as in the brief (§10, module 09)', () => {
    expect(MATRIX.alpha['coupon-direct']).toEqual(['tpf']);
    expect(MATRIX.alpha['coupon-range']).toEqual(['rtpf']);
    expect(MATRIX.alpha['strike-direct']).toEqual(['tarf', 'accumulator']);
    expect(MATRIX.alpha['strike-range']).toEqual(['pivotTarf']);
  });

  it('covers every hedge tool of section 2 and every yield idea of section 4', () => {
    const hedge = new Set(DIR_VIEW_IDS.flatMap((v) => MATRIX.hedge[v]));
    for (const id of ['spot', 'forward', 'limit', 'stop', 'call', 'collar', 'structured'])
      expect(hedge.has(id as never), id).toBe(true);
    const y = new Set(DIR_VIEW_IDS.flatMap((v) => MATRIX.yield[v]));
    for (const id of ['dci', 'discount', 'carry', 'deposit'])
      expect(y.has(id as never), id).toBe(true);
  });

  it('uses every catalogued product and every cell has at least one product', () => {
    const used = productCells();
    for (const id of PRODUCT_IDS) expect(used.has(id), id).toBe(true);
    for (const c of allCells()) expect(cellProducts(c).length).toBeGreaterThan(0);
  });

  it('links every product to an existing module section', () => {
    for (const id of PRODUCT_IDS) {
      const { slug, section } = PRODUCTS[id].link;
      expect(
        MODULES.some((m) => m.slug === slug),
        `${id} → ${slug}`,
      ).toBe(true);
      expect(['1', '2', '3', '4']).toContain(section);
    }
  });

  it('has a name, building blocks and use for every product and a note for every cell', () => {
    for (const lang of ['de', 'en'] as const) {
      const d = productmatrix[lang] as Record<string, string>;
      for (const id of PRODUCT_IDS) {
        expect(d[`pm.p.${id}.name`], `${lang} ${id}`).toBeTruthy();
        expect(d[`pm.p.${id}.blocks`], `${lang} ${id}`).toBeTruthy();
        expect(d[`pm.p.${id}.use`], `${lang} ${id}`).toBeTruthy();
      }
      for (const c of allCells()) expect(d[`pm.cell.${c.need}.${c.view}`]).toBeTruthy();
      for (const id of PRODUCT_IDS)
        for (const chip of riskChips(id))
          expect(d[`pm.chip.${chip.value}`], chip.value).toBeTruthy();
    }
  });
});

describe('cells and views', () => {
  it('validates ids and builds cells from loose input', () => {
    expect(isNeed('alpha')).toBe(true);
    expect(isNeed('beta')).toBe(false);
    expect(isDirView('up')).toBe(true);
    expect(isDirView('coupon-direct')).toBe(false);
    expect(isAlphaView('strike-range')).toBe(true);
    expect(makeCell('alpha', 'strike-range')).toEqual({ need: 'alpha', view: 'strike-range' });
    expect(makeCell('alpha', 'up')).toEqual({ need: 'alpha', view: 'coupon-direct' });
    expect(makeCell('yield', 'sideways')).toEqual({ need: 'yield', view: 'sideways' });
    expect(makeCell('nope')).toEqual({ need: 'hedge', view: 'up' });
    expect(defaultView('alpha')).toBe('coupon-direct');
    expect(defaultView('hedge')).toBe('up');
    expect(viewsOf('alpha')).toBe(ALPHA_VIEW_IDS);
    expect(viewsOf('yield')).toBe(DIR_VIEW_IDS);
    expect(alphaView('strike', 'range')).toBe('strike-range');
    expect(splitAlphaView('coupon-direct')).toEqual({ pay: 'coupon', shape: 'direct' });
    expect(NEED_IDS).toEqual(['hedge', 'alpha', 'yield']);
  });

  it('shows the "same view, different risk" spread in the hedge cell "USD stronger"', () => {
    const s = cellRiskSpread({ need: 'hedge', view: 'up' });
    expect(s.min).toBe(1);
    expect(s.max).toBe(2);
    const a = cellRiskSpread({ need: 'alpha', view: 'coupon-direct' });
    expect(a.min).toBe(3);
    expect(a.max).toBe(3);
    const sw = cellRiskSpread({ need: 'hedge', view: 'sideways' });
    expect(sw.maxId).toBe('structured');
  });
});

describe('risk chips', () => {
  it('labels every chip and grades leveraged path-dependent products as high risk', () => {
    for (const id of PRODUCT_IDS) {
      const chips = riskChips(id);
      expect(chips.map((c) => c.kind)).toEqual(['leverage', 'path', 'loss', 'complexity']);
    }
    for (const id of ['tpf', 'rtpf', 'tarf', 'accumulator', 'pivotTarf', 'structured'] as const)
      expect(productSeverity(id)).toBe(3);
    expect(productSeverity('forward')).toBe(1);
    expect(productSeverity('deposit')).toBe(1);
    expect(riskChips('call').find((c) => c.kind === 'loss')?.value).toBe('loss.premium');
    expect(riskChips('stop').find((c) => c.kind === 'path')?.severity).toBe(2);
  });
});

describe('profiles and key numbers', () => {
  it('uses the example and the precomputed fair values', () => {
    expect(p.spot).toBe(S);
    expect(p.forward).toBe(EXAMPLE_FORWARD);
    expect(p.limit).toBeCloseTo(S * (1 - M09_CONFIG.orders.limitBelow), 12);
    expect(p.stop).toBeCloseTo(S * (1 + M09_CONFIG.orders.stopAbove), 12);
    expect(p.tarf.strike).toBeLessThan(p.tarf.forward);
    expect(p.accumulator.strike).toBeLessThan(p.accumulator.forward);
    expect(p.pivotTarf.lower).toBeLessThan(p.pivotTarf.pivot);
    expect(p.pivotTarf.upper).toBeGreaterThan(p.pivotTarf.pivot);
    expect(p.tpf.coupon).toBeGreaterThan(0);
    expect(p.rtpf.lower).toBeLessThan(p.rtpf.upper);
  });

  it('gives every product a key number', () => {
    for (const id of PRODUCT_IDS) {
      const k = keyFact(id, p);
      expect(Number.isFinite(k.value), id).toBe(true);
      if (k.kind === 'range') expect(k.value2!).toBeGreaterThan(k.value);
    }
    expect(keyFact('forward', p).value).toBe(EXAMPLE_FORWARD);
    expect(keyFact('call', p).value).toBeCloseTo(p.hedge.call.premium / PIP, 10);
    expect(keyFact('tarf', p).vsPips!).toBeLessThan(0);
    expect(keyFact('structured', p).vsPips!).toBeLessThan(0);
    expect(keyFact('accumulator', p).vsPips!).toBeLessThan(0);
    expect(keyFact('carry', p).value).toBeGreaterThan(0);
    expect(keyFact('deposit', p).value).toBe(EXAMPLE.rd);
  });

  it('computes the one-fixing profiles of the structured products', () => {
    const { strike: Kt } = p.tarf;
    expect(productResult('tarf', Kt + 0.01, p)).toBeCloseTo(0.01, 12);
    expect(productResult('tarf', Kt - 0.01, p)).toBeCloseTo(-0.02, 12);
    const { strike: Ka, barrier: B } = p.accumulator;
    expect(productResult('accumulator', B + 0.001, p)).toBe(0);
    expect(productResult('accumulator', Ka + 0.01, p)).toBeCloseTo(0.01, 12);
    expect(productResult('accumulator', Ka - 0.01, p)).toBeCloseTo(-0.02, 12);
    const v = p.pivotTarf;
    expect(productResult('pivotTarf', v.pivot, p)).toBeCloseTo(v.pivot - v.lower, 12);
    expect(productResult('pivotTarf', v.pivot + 0.01, p)).toBeCloseTo(v.upper - v.pivot - 0.01, 12);
    expect(productResult('pivotTarf', v.lower - 0.01, p)).toBeCloseTo(-0.02, 12);
    expect(productResult('pivotTarf', v.upper + 0.01, p)).toBeCloseTo(-0.02, 12);
    expect(productResult('tpf', p.tpf.strike, p)).toBe(p.tpf.coupon);
    expect(productResult('tpf', p.tpf.strike - 0.01, p)).toBeCloseTo(-0.02, 12);
    expect(productResult('rtpf', S, p)).toBe(p.rtpf.coupon);
    expect(productResult('rtpf', p.rtpf.lower - 0.01, p)).toBeCloseTo(-0.02, 12);
    expect(productResult('rtpf', p.rtpf.upper + 0.01, p)).toBeCloseTo(-0.02, 12);
  });

  it('computes the hedge instruments against the market and the yield results', () => {
    expect(productResult('forward', 0.84, p)).toBeCloseTo(0.84 - EXAMPLE_FORWARD, 12);
    expect(productResult('spot', 0.84, p)).toBe(productResult('forward', 0.84, p));
    expect(productResult('call', 0.7, p)).toBeCloseTo(-p.hedge.call.premiumAtExpiry, 12);
    expect(productResult('collar', S, p)).toBeCloseTo(0, 9);
    const kl = p.hedge.leveraged.strike;
    expect(productResult('structured', kl - 0.01, p)).toBeCloseTo(-0.02, 9);
    expect(productResult('limit', S, p)).toBeNull();
    expect(productResult('stop', S, p)).toBeNull();
    expect(productResult('deposit', 0.7, p)).toBe(0);
    expect(productResult('carry', p.yields.forward, p)).toBeCloseTo(0, 12);
    for (const x of [0.72, 0.78, 0.8, 0.86])
      expect(productResult('dci', x, p)).toBeCloseTo(productResult('discount', x, p)!, 12);
  });

  it('samples curves on a grid with the kinks, clipped to the chart', () => {
    const xs = matrixGrid(p);
    const [lo, hi] = matrixRange();
    expect(xs[0]).toBeCloseTo(lo, 12);
    expect(xs[xs.length - 1]).toBeCloseTo(hi, 12);
    expect(xs).toContain(p.tarf.strike);
    for (let i = 1; i < xs.length; i++) expect(xs[i]!).toBeGreaterThan(xs[i - 1]!);
    expect(productCurve('limit', xs, p)).toBeNull();
    const clip = M09_CONFIG.matrix.clipPips;
    const tpf = productCurve('tpf', xs, p)!;
    expect(Math.min(...tpf)).toBe(-clip);
    expect(clippedBelow('tpf', xs, p)).toBe(true);
    expect(clippedBelow('call', xs, p)).toBe(false);
    expect(productCurve('call', xs, p, 50)!.every((y) => Math.abs(y) <= 50)).toBe(true);
  });

  it('groups identical profiles (forward and spot, dual currency and certificate)', () => {
    const xs = matrixGrid(p);
    expect(profileGroups({ need: 'hedge', view: 'up' }, xs, p)).toEqual([
      ['forward', 'spot'],
      ['call'],
    ]);
    expect(profileGroups({ need: 'yield', view: 'up' }, xs, p)).toEqual([
      ['carry'],
      ['discount', 'dci'],
    ]);
  });

  it('finds the best and worst product of a cell at a rate at expiry', () => {
    const up = cellSpreadAt({ need: 'hedge', view: 'up' }, 0.84, p)!;
    expect(up.best).toBe('forward');
    expect(up.worst).toBe('call');
    expect(up.bestPips).toBeGreaterThan(up.worstPips);
    const down = cellSpreadAt({ need: 'hedge', view: 'down' }, 0.73, p)!;
    expect(down.best).toBe('call');
    expect(cellSpreadAt({ need: 'alpha', view: 'coupon-direct' }, S, p)).toBeNull();
  });

  it('snaps the rate at expiry to the grid and the range', () => {
    const [lo, hi] = matrixRange();
    expect(snapMatrixFixing(0.80013)).toBeCloseTo(0.8, 12);
    expect(snapMatrixFixing(0.1)).toBe(lo);
    expect(snapMatrixFixing(2)).toBe(hi);
    expect(initialMatrixFixing()).toBeCloseTo(S * (1 + M09_CONFIG.matrix.initialMove), 12);
  });
});
