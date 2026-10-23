/**
 * Product matrix (module 09): Dario's product concept "Hedge, Alpha, Yield" as ONE documented
 * data table. Pure, no DOM. Used by the ProductMatrix island, the number registry
 * src/lib/nums/m09.ts and the quiz.
 *
 * How to change the matrix (D-22): edit MATRIX (which products answer which need and view, in
 * order of fit) and PRODUCTS (risk chips, family, link into the module that explains it).
 * Product names, building blocks and the notes per cell are UI strings in
 * src/i18n/dict/productmatrix.ts (keys pm.p.<id>.*, pm.cell.<need>.<view>).
 *
 * Needs and views, for USD/CHF (base USD, quote CHF):
 * - hedge: the Swiss importer must BUY USD 1 Mio. in 3 months (he is short USD). Views on the
 *   dollar: stronger, weaker, sideways, unsure (needs protection).
 * - alpha: turn a view into money. Two questions (MASTER_PROMPT §10, module 09):
 *   pay-off as coupon or as a better strike × directional (direct) or range view:
 *   coupon direct = TPF, coupon range = RTPF, strike direct = TARF and accumulator,
 *   strike range = pivot TARF.
 * - yield: a CHF investor wants more than the CHF money market for 1 to 3 months.
 *
 * Profiles ("shape"): result at expiry per USD in CHF per USD (one fixing for the multi-fixing
 * products) as a function of S_T, from the holder's point of view, with the parameters of the
 * running example and the precomputed fair strikes/coupons of module 08 (Monte Carlo). Orders
 * (limit, stop) have no fixed profile: they only become a spot trade when the level trades.
 */
import { EXAMPLE, EXAMPLE_FORWARD } from '@/lib/fx/example';
import { MC_PRODUCTS, fairProduct } from '@/lib/fx/mc/fair';
import { M09_CONFIG, PIP } from '@/lib/m09/config';
import { hedgeSetup, hedgeRate, type HedgeSetup } from '@/lib/m09/hedge';
import { carryView, yieldPnlPerUsd, type CarryView } from '@/lib/m09/carry';
import type { SectionKey } from '@/i18n/routes';

/* ---------- ids ---------- */

export type NeedId = 'hedge' | 'alpha' | 'yield';
export const NEED_IDS: readonly NeedId[] = ['hedge', 'alpha', 'yield'];

/** Views on the dollar (hedge and yield). */
export type DirViewId = 'up' | 'down' | 'sideways' | 'unsure';
export const DIR_VIEW_IDS: readonly DirViewId[] = ['up', 'down', 'sideways', 'unsure'];

/** Alpha: pay-off as coupon or strike × directional or range view. */
export type AlphaPay = 'coupon' | 'strike';
export type AlphaShape = 'direct' | 'range';
export type AlphaViewId = `${AlphaPay}-${AlphaShape}`;
export const ALPHA_PAYS: readonly AlphaPay[] = ['coupon', 'strike'];
export const ALPHA_SHAPES: readonly AlphaShape[] = ['direct', 'range'];
export const ALPHA_VIEW_IDS: readonly AlphaViewId[] = [
  'coupon-direct',
  'coupon-range',
  'strike-direct',
  'strike-range',
];

export type ViewId = DirViewId | AlphaViewId;

export type ProductId =
  | 'spot'
  | 'forward'
  | 'limit'
  | 'stop'
  | 'call'
  | 'collar'
  | 'structured'
  | 'accumulator'
  | 'tarf'
  | 'pivotTarf'
  | 'tpf'
  | 'rtpf'
  | 'dci'
  | 'discount'
  | 'carry'
  | 'deposit';

/* ---------- THE MATRIX: need × view → products (best fit first) ---------- */

export const MATRIX: {
  hedge: Record<DirViewId, ProductId[]>;
  alpha: Record<AlphaViewId, ProductId[]>;
  yield: Record<DirViewId, ProductId[]>;
} = {
  hedge: {
    /** The fear comes true: lock the rate now (forward, or spot and park the dollars) or cap it. */
    up: ['forward', 'spot', 'stop', 'call'],
    /** A weaker dollar would help: keep the chance, but cap the risk or wait for a level. */
    down: ['call', 'limit', 'collar'],
    /** Little movement: zero-cost ranges and structured hedges with a better rate. */
    sideways: ['collar', 'structured', 'forward'],
    /** No view, but the budget must hold: certainty or a cap. */
    unsure: ['forward', 'call', 'collar'],
  },
  alpha: {
    'coupon-direct': ['tpf'],
    'coupon-range': ['rtpf'],
    'strike-direct': ['tarf', 'accumulator'],
    'strike-range': ['pivotTarf'],
  },
  yield: {
    /** A stronger dollar: carry keeps the upside, the certificate and the DCI cap it. */
    up: ['carry', 'discount', 'dci'],
    /** Sideways: the sold option's premium is the extra yield. */
    sideways: ['dci', 'discount', 'carry'],
    /** A weaker dollar: every USD yield idea loses; the CHF deposit is the honest answer. */
    down: ['deposit'],
    /** No view, capital must stay in CHF: more yield is only available against more risk. */
    unsure: ['deposit'],
  },
};

/* ---------- product catalogue: risk chips and links ---------- */

export type Family = 'linear' | 'order' | 'option' | 'structured' | 'yield' | 'deposit';
export const FAMILY_IDS: readonly Family[] = [
  'linear',
  'order',
  'option',
  'structured',
  'yield',
  'deposit',
];
export type PathKind = 'none' | 'trigger' | 'knockout' | 'target';
export type LossKind =
  | 'none'
  | 'opportunity'
  | 'premium'
  | 'floor'
  | 'open'
  | 'gap'
  | 'conversion'
  | 'market'
  | 'unlimited';

export interface ProductDef {
  family: Family;
  /** 1 = no leverage, 2 = double amount on the wrong side. */
  leverage: 1 | 2;
  path: PathKind;
  /** Worst case from the holder's point of view. */
  loss: LossKind;
  /** 1 simple, 2 medium, 3 complex. */
  complexity: 1 | 2 | 3;
  /** Section that explains it. */
  link: { slug: string; section: SectionKey };
}

export const PRODUCTS: Record<ProductId, ProductDef> = {
  spot: {
    family: 'linear',
    leverage: 1,
    path: 'none',
    loss: 'opportunity',
    complexity: 1,
    link: { slug: '02-forward', section: '2' },
  },
  forward: {
    family: 'linear',
    leverage: 1,
    path: 'none',
    loss: 'opportunity',
    complexity: 1,
    link: { slug: '02-forward', section: '1' },
  },
  limit: {
    family: 'order',
    leverage: 1,
    path: 'trigger',
    loss: 'open',
    complexity: 1,
    link: { slug: '01-spot', section: '3' },
  },
  stop: {
    family: 'order',
    leverage: 1,
    path: 'trigger',
    loss: 'gap',
    complexity: 1,
    link: { slug: '01-spot', section: '3' },
  },
  call: {
    family: 'option',
    leverage: 1,
    path: 'none',
    loss: 'premium',
    complexity: 2,
    link: { slug: '04-vanilla-options', section: '1' },
  },
  collar: {
    family: 'option',
    leverage: 1,
    path: 'none',
    loss: 'floor',
    complexity: 2,
    link: { slug: '06-combos-smile', section: '2' },
  },
  structured: {
    family: 'structured',
    leverage: 2,
    path: 'knockout',
    loss: 'unlimited',
    complexity: 3,
    link: { slug: '08-structured-products', section: '2' },
  },
  accumulator: {
    family: 'structured',
    leverage: 2,
    path: 'knockout',
    loss: 'unlimited',
    complexity: 3,
    link: { slug: '08-structured-products', section: '2' },
  },
  tarf: {
    family: 'structured',
    leverage: 2,
    path: 'target',
    loss: 'unlimited',
    complexity: 3,
    link: { slug: '08-structured-products', section: '3' },
  },
  pivotTarf: {
    family: 'structured',
    leverage: 2,
    path: 'target',
    loss: 'unlimited',
    complexity: 3,
    link: { slug: '08-structured-products', section: '3' },
  },
  tpf: {
    family: 'structured',
    leverage: 2,
    path: 'target',
    loss: 'unlimited',
    complexity: 3,
    link: { slug: '08-structured-products', section: '4' },
  },
  rtpf: {
    family: 'structured',
    leverage: 2,
    path: 'target',
    loss: 'unlimited',
    complexity: 3,
    link: { slug: '08-structured-products', section: '4' },
  },
  dci: {
    family: 'yield',
    leverage: 1,
    path: 'none',
    loss: 'conversion',
    complexity: 2,
    link: { slug: '08-structured-products', section: '4' },
  },
  discount: {
    family: 'yield',
    leverage: 1,
    path: 'none',
    loss: 'market',
    complexity: 2,
    link: { slug: '09-hedge-alpha-yield', section: '4' },
  },
  carry: {
    family: 'linear',
    leverage: 1,
    path: 'none',
    loss: 'market',
    complexity: 1,
    link: { slug: '02-forward', section: '3' },
  },
  deposit: {
    family: 'deposit',
    leverage: 1,
    path: 'none',
    loss: 'none',
    complexity: 1,
    link: { slug: '02-forward', section: '2' },
  },
};

export const PRODUCT_IDS = Object.keys(PRODUCTS) as ProductId[];

/* ---------- risk chips: label key + severity (never colour alone) ---------- */

export type Severity = 1 | 2 | 3;
export type ChipKind = 'leverage' | 'path' | 'loss' | 'complexity';
export const CHIP_KINDS: readonly ChipKind[] = ['leverage', 'path', 'loss', 'complexity'];

export interface RiskChip {
  kind: ChipKind;
  /** Dictionary key suffix of the value, e.g. 'loss.unlimited'. */
  value: string;
  severity: Severity;
}

const LOSS_SEVERITY: Record<LossKind, Severity> = {
  none: 1,
  opportunity: 1,
  premium: 1,
  floor: 1,
  open: 2,
  gap: 2,
  conversion: 2,
  market: 2,
  unlimited: 3,
};
const PATH_SEVERITY: Record<PathKind, Severity> = {
  none: 1,
  trigger: 2,
  knockout: 3,
  target: 3,
};

/** The four risk chips of a product, in display order. */
export function riskChips(id: ProductId): RiskChip[] {
  const p = PRODUCTS[id];
  return [
    { kind: 'leverage', value: `leverage.${p.leverage}`, severity: p.leverage === 2 ? 3 : 1 },
    { kind: 'path', value: `path.${p.path}`, severity: PATH_SEVERITY[p.path] },
    { kind: 'loss', value: `loss.${p.loss}`, severity: LOSS_SEVERITY[p.loss] },
    { kind: 'complexity', value: `complexity.${p.complexity}`, severity: p.complexity },
  ];
}

/** Overall severity of a product: the highest of its chips. */
export function productSeverity(id: ProductId): Severity {
  return Math.max(...riskChips(id).map((c) => c.severity)) as Severity;
}

/* ---------- cells ---------- */

export type Cell =
  | { need: 'hedge'; view: DirViewId }
  | { need: 'alpha'; view: AlphaViewId }
  | { need: 'yield'; view: DirViewId };

export function isNeed(x: unknown): x is NeedId {
  return typeof x === 'string' && (NEED_IDS as readonly string[]).includes(x);
}
export function isDirView(x: unknown): x is DirViewId {
  return typeof x === 'string' && (DIR_VIEW_IDS as readonly string[]).includes(x);
}
export function isAlphaView(x: unknown): x is AlphaViewId {
  return typeof x === 'string' && (ALPHA_VIEW_IDS as readonly string[]).includes(x);
}

/** Default view of a need (the first one). */
export function defaultView(need: NeedId): ViewId {
  return need === 'alpha' ? ALPHA_VIEW_IDS[0]! : DIR_VIEW_IDS[0]!;
}

/** A valid cell from loose input (props from MDX): unknown values fall back to defaults. */
export function makeCell(need: unknown, view?: unknown): Cell {
  const n: NeedId = isNeed(need) ? need : 'hedge';
  if (n === 'alpha') return { need: n, view: isAlphaView(view) ? view : ALPHA_VIEW_IDS[0]! };
  return { need: n, view: isDirView(view) ? view : DIR_VIEW_IDS[0]! };
}

/** Views offered for a need. */
export function viewsOf(need: NeedId): readonly ViewId[] {
  return need === 'alpha' ? ALPHA_VIEW_IDS : DIR_VIEW_IDS;
}

/** Products of a cell, best fit first. */
export function cellProducts(cell: Cell): ProductId[] {
  if (cell.need === 'alpha') return [...MATRIX.alpha[cell.view]];
  return [...MATRIX[cell.need][cell.view]];
}

export function alphaView(pay: AlphaPay, shape: AlphaShape): AlphaViewId {
  return `${pay}-${shape}`;
}

export function splitAlphaView(v: AlphaViewId): { pay: AlphaPay; shape: AlphaShape } {
  const [pay, shape] = v.split('-') as [AlphaPay, AlphaShape];
  return { pay, shape };
}

/**
 * Range of the worst-case severity within a cell: the "same view, very different risk"
 * annotation shows when it spans more than one level.
 */
export function cellRiskSpread(cell: Cell): {
  min: Severity;
  max: Severity;
  minId: ProductId;
  maxId: ProductId;
} {
  const ids = cellProducts(cell);
  let minId = ids[0]!;
  let maxId = ids[0]!;
  for (const id of ids) {
    const s = LOSS_SEVERITY[PRODUCTS[id].loss];
    if (s < LOSS_SEVERITY[PRODUCTS[minId].loss]) minId = id;
    if (s > LOSS_SEVERITY[PRODUCTS[maxId].loss]) maxId = id;
  }
  return {
    min: LOSS_SEVERITY[PRODUCTS[minId].loss],
    max: LOSS_SEVERITY[PRODUCTS[maxId].loss],
    minId,
    maxId,
  };
}

/** Every product that appears somewhere in the matrix, with the cells it appears in. */
export function productCells(): Map<ProductId, Cell[]> {
  const out = new Map<ProductId, Cell[]>();
  const add = (id: ProductId, c: Cell) => out.set(id, [...(out.get(id) ?? []), c]);
  for (const v of DIR_VIEW_IDS) {
    for (const id of MATRIX.hedge[v]) add(id, { need: 'hedge', view: v });
    for (const id of MATRIX.yield[v]) add(id, { need: 'yield', view: v });
  }
  for (const v of ALPHA_VIEW_IDS)
    for (const id of MATRIX.alpha[v]) add(id, { need: 'alpha', view: v });
  return out;
}

/* ---------- parameters and key numbers (from the core and the Monte Carlo JSON) ---------- */

export interface MatrixParams {
  spot: number;
  forward: number;
  limit: number;
  stop: number;
  hedge: HedgeSetup;
  yields: CarryView;
  accumulator: { strike: number; barrier: number; forward: number };
  tarf: { strike: number; forward: number };
  pivotTarf: { pivot: number; lower: number; upper: number };
  tpf: { strike: number; coupon: number };
  rtpf: { lower: number; upper: number; coupon: number };
}

/** All product parameters of the running example, solved once. */
export function matrixParams(): MatrixParams {
  const S = EXAMPLE.spot;
  const acc = fairProduct('accumulator');
  const tarf = fairProduct('tarf');
  const piv = fairProduct('pivotTarf');
  const tpf = fairProduct('tpf');
  const rtpf = fairProduct('rtpf');
  const P = MC_PRODUCTS.products;
  const yp = M09_CONFIG.yieldProducts;
  return {
    spot: S,
    forward: EXAMPLE_FORWARD,
    limit: S * (1 - M09_CONFIG.orders.limitBelow),
    stop: S * (1 + M09_CONFIG.orders.stopAbove),
    hedge: hedgeSetup(),
    yields: carryView({
      months: yp.months,
      usdRate: EXAMPLE.rf,
      vol: EXAMPLE.vol,
      strikeBelow: yp.strikeBelow,
    }),
    accumulator: { strike: acc.strike, barrier: acc.barrier, forward: P.accumulator.forwardAvg },
    tarf: { strike: tarf.strike, forward: P.tarf.forwardAvg },
    pivotTarf: { pivot: piv.pivot, lower: piv.lowerStrike, upper: piv.upperStrike },
    tpf: { strike: tpf.strike, coupon: tpf.coupon },
    rtpf: { lower: rtpf.lower, upper: rtpf.upper, coupon: rtpf.coupon },
  };
}

/** Key number of a product card: a dictionary key for the label and the values to format. */
export interface KeyFact {
  /** Dictionary key suffix (pm.key.<label>). */
  label: string;
  kind: 'rate' | 'range' | 'pips' | 'pct';
  value: number;
  value2?: number;
  /** Optional comparison in pips (e.g. strike − forward). */
  vsPips?: number;
}

export function keyFact(id: ProductId, p: MatrixParams): KeyFact {
  switch (id) {
    case 'spot':
      return { label: 'spot', kind: 'rate', value: p.spot };
    case 'forward':
      return { label: 'forward', kind: 'rate', value: p.forward };
    case 'limit':
      return { label: 'limit', kind: 'rate', value: p.limit };
    case 'stop':
      return { label: 'stop', kind: 'rate', value: p.stop };
    case 'call':
      return { label: 'premium', kind: 'pips', value: p.hedge.call.premium / PIP };
    case 'collar':
      return {
        label: 'band',
        kind: 'range',
        value: p.hedge.collar.putStrike,
        value2: p.hedge.collar.callStrike,
      };
    case 'structured':
      return {
        label: 'strike',
        kind: 'rate',
        value: p.hedge.leveraged.strike,
        vsPips: (p.hedge.leveraged.strike - p.hedge.forward) / PIP,
      };
    case 'accumulator':
      return {
        label: 'strike',
        kind: 'rate',
        value: p.accumulator.strike,
        vsPips: (p.accumulator.strike - p.accumulator.forward) / PIP,
      };
    case 'tarf':
      return {
        label: 'strike',
        kind: 'rate',
        value: p.tarf.strike,
        vsPips: (p.tarf.strike - p.tarf.forward) / PIP,
      };
    case 'pivotTarf':
      return {
        label: 'strikes',
        kind: 'range',
        value: p.pivotTarf.lower,
        value2: p.pivotTarf.upper,
      };
    case 'tpf':
      return { label: 'coupon', kind: 'pips', value: p.tpf.coupon / PIP };
    case 'rtpf':
      return { label: 'coupon', kind: 'pips', value: p.rtpf.coupon / PIP };
    case 'dci':
      return { label: 'yield', kind: 'pct', value: p.yields.dciYieldPa };
    case 'discount':
      return { label: 'discount', kind: 'pct', value: p.yields.certDiscount };
    case 'carry':
      return { label: 'carry', kind: 'pips', value: -p.yields.forwardPointsPips };
    case 'deposit':
      return { label: 'deposit', kind: 'pct', value: p.yields.depositRate };
  }
}

/* ---------- profiles at expiry ---------- */

/**
 * Result at expiry per USD (CHF per USD) of a product for S_T, holder's view; null for orders.
 * Hedges: the instrument alone (it offsets the importer's higher cost when the dollar rises),
 * premium carried to expiry. Multi-fixing products: one fixing. Yield products: the result
 * against a CHF deposit of the same amount (src/lib/m09/carry.ts).
 */
export function productResult(id: ProductId, ST: number, p: MatrixParams): number | null {
  const h = p.hedge;
  switch (id) {
    case 'limit':
    case 'stop':
      return null;
    case 'spot':
    case 'forward':
      return ST - h.forward;
    case 'call':
    case 'collar':
    case 'structured': {
      const kind = id === 'structured' ? 'leveraged' : id;
      /* instrument result = market rate − effective rate */
      return ST - hedgeRate(kind, ST, h);
    }
    case 'accumulator': {
      const { strike: K, barrier: B } = p.accumulator;
      if (ST >= B) return 0;
      return ST >= K ? ST - K : 2 * (ST - K);
    }
    case 'tarf': {
      const K = p.tarf.strike;
      return ST >= K ? ST - K : 2 * (ST - K);
    }
    case 'pivotTarf': {
      const { pivot: P, lower: K1, upper: K2 } = p.pivotTarf;
      if (ST <= K1) return 2 * (ST - K1);
      if (ST <= P) return ST - K1;
      if (ST < K2) return K2 - ST;
      return 2 * (K2 - ST);
    }
    case 'tpf': {
      const { strike: K, coupon: c } = p.tpf;
      return ST >= K ? c : -2 * (K - ST);
    }
    case 'rtpf': {
      const { lower: L, upper: U, coupon: c } = p.rtpf;
      if (ST < L) return -2 * (L - ST);
      if (ST > U) return -2 * (ST - U);
      return c;
    }
    case 'dci':
      return yieldPnlPerUsd('dci', ST, p.yields);
    case 'discount':
      return yieldPnlPerUsd('discount', ST, p.yields);
    case 'carry':
      return yieldPnlPerUsd('carry', ST, p.yields);
    case 'deposit':
      return 0;
  }
}

/** Chart range of S_T for the matrix: spot · (1 + xRange). */
export function matrixRange(): [number, number] {
  const [a, b] = M09_CONFIG.matrix.xRange;
  return [EXAMPLE.spot * (1 + a), EXAMPLE.spot * (1 + b)];
}

/** S_T grid of the matrix chart, with every kink added so corners stay sharp. */
export function matrixGrid(p: MatrixParams, n: number = M09_CONFIG.matrix.samples): number[] {
  const [lo, hi] = matrixRange();
  const xs = new Set<number>();
  for (let i = 0; i <= n; i++) xs.add(lo + ((hi - lo) * i) / n);
  const kinks = [
    p.forward,
    p.hedge.call.strike,
    p.hedge.collar.putStrike,
    p.hedge.collar.callStrike,
    p.hedge.leveraged.strike,
    p.accumulator.strike,
    p.accumulator.barrier,
    p.tarf.strike,
    p.pivotTarf.lower,
    p.pivotTarf.pivot,
    p.pivotTarf.upper,
    p.tpf.strike,
    p.rtpf.lower,
    p.rtpf.upper,
    p.yields.strike,
  ];
  const eps = (hi - lo) * 1e-6;
  for (const k of kinks) {
    if (k > lo && k < hi) {
      xs.add(k);
      /* jumps (knock-out, coupon edges): a point just before the level */
      xs.add(k - eps);
    }
  }
  return [...xs].sort((a, b) => a - b);
}

/** Profile of a product in pips per USD on a grid, clipped to ±clipPips; null for orders. */
export function productCurve(
  id: ProductId,
  xs: readonly number[],
  p: MatrixParams,
  clip: number = M09_CONFIG.matrix.clipPips,
): number[] | null {
  if (productResult(id, xs[0] ?? EXAMPLE.spot, p) === null) return null;
  return xs.map((x) => {
    const r = (productResult(id, x, p) ?? 0) / PIP;
    return Math.max(-clip, Math.min(clip, r));
  });
}

/** True if the unclipped profile leaves the chart below −clipPips (loss not limited). */
export function clippedBelow(
  id: ProductId,
  xs: readonly number[],
  p: MatrixParams,
  clip: number = M09_CONFIG.matrix.clipPips,
): boolean {
  return xs.some((x) => (productResult(id, x, p) ?? 0) / PIP < -clip);
}

/** S_T snapped to the 5-pip grid and clamped to the matrix range. */
export function snapMatrixFixing(x: number): number {
  const [lo, hi] = matrixRange();
  const step = M09_CONFIG.matrix.fixingStep;
  const snapped = Number((Math.round(x / step) * step).toFixed(6));
  return Math.min(hi, Math.max(lo, snapped));
}

/** S_T shown first (a dollar 3 % stronger). */
export function initialMatrixFixing(): number {
  return snapMatrixFixing(EXAMPLE.spot * (1 + M09_CONFIG.matrix.initialMove));
}

/**
 * Best and worst product of a cell at S_T (orders excluded), for the "same view, different
 * result" readout. Null when fewer than two products have a profile.
 */
export function cellSpreadAt(
  cell: Cell,
  ST: number,
  p: MatrixParams,
): { best: ProductId; worst: ProductId; bestPips: number; worstPips: number } | null {
  const rows = cellProducts(cell)
    .map((id) => ({ id, r: productResult(id, ST, p) }))
    .filter((x): x is { id: ProductId; r: number } => x.r !== null);
  if (rows.length < 2) return null;
  let best = rows[0]!;
  let worst = rows[0]!;
  for (const x of rows) {
    if (x.r > best.r + 1e-12) best = x;
    if (x.r < worst.r - 1e-12) worst = x;
  }
  return { best: best.id, worst: worst.id, bestPips: best.r / PIP, worstPips: worst.r / PIP };
}

/**
 * Groups the products of a cell whose profiles coincide on the grid (forward and spot plus
 * deposit, dual currency and discount certificate): one curve, one combined label. Products
 * without a profile (orders) are left out. Order follows the cell.
 */
export function profileGroups(cell: Cell, xs: readonly number[], p: MatrixParams): ProductId[][] {
  const groups: Array<{ ids: ProductId[]; ys: number[] }> = [];
  for (const id of cellProducts(cell)) {
    const ys = xs.map((x) => productResult(id, x, p));
    if (ys.some((y) => y === null)) continue;
    const vals = ys as number[];
    const g = groups.find((gr) => gr.ys.every((y, i) => Math.abs(y - vals[i]!) < 1e-9));
    if (g) g.ids.push(id);
    else groups.push({ ids: [id], ys: vals });
  }
  return groups.map((g) => g.ids);
}
