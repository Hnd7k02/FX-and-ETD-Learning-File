/**
 * Path simulator (MASTER_PROMPT §8.4), module 08. Plays a USD/CHF path day by day through a
 * structured product: fixings light up as dots, events (gap, first leveraged fixing,
 * knock-out, target, maturity) are announced exactly when they happen, the cash-flow table
 * fills fixing by fixing, and the cumulative P&L of the product runs against a plain forward
 * hedge of the planned amounts (coupon products: against the coupons received). A second
 * view plays 100 risk-neutral paths at once and sorts their results: the asymmetry of a
 * target (D-29) becomes visible.
 *
 * Props (serialisable, set on PathSimulatorFigure.astro):
 * - lang: 'de' | 'en'.
 * - products?: product kinds offered (accumulator, decumulator, tarf, pivotTarf, tpf, rtpf);
 *   default all six. Unknown kinds are ignored.
 * - initial?: product shown first (default the first of `products`).
 * - scenario?: 'trendUp' | 'trendDown' | 'sideways' | 'shock' | 'random' (default 'trendDown').
 * - preset?: a named start scenario from PATHSIM_CONFIG.presets ('strongDown', 'earlyShock');
 *   scenario, move, gap and gapDay given explicitly override it.
 * - move?: total move of the trend scenarios over the horizon (fraction, e.g. −0.12).
 * - gap?: one-day gap of the shock (fraction, e.g. −0.10); gapDay?: day of the gap.
 * - view?: 'path' | 'ensemble' (default 'path'); ensemble?: false hides the 100-path view.
 * - adjustable?: false hides the strike / coupon slider and the live Monte Carlo value.
 * - autoplay?: false starts paused (always paused under prefers-reduced-motion).
 *
 * Interaction: play/pause, restart, speed, scrub by slider or by dragging on the chart; drag
 * the end of a trend path, the shock (day and depth) and the strike; every drag has a slider
 * as its accessible twin. Logic in src/lib/pathsim.ts; the Monte Carlo valuation of an
 * adjusted parameter runs in the Web Worker (src/lib/fx/mc/mc.worker.ts).
 */
import type { JSX } from 'preact';
import { useEffect, useId, useMemo, useRef, useState } from 'preact/hooks';
import { GridY } from '@/components/ui/Chart';
import { Legend, type LegendItem } from '@/components/ui/Legend';
import { Segmented } from '@/components/ui/Segmented';
import { Slider } from '@/components/ui/Slider';
import { StatHero, StatRow, StatTable } from '@/components/ui/Stat';
import {
  useElementWidth,
  useInView,
  usePrefersReducedMotion,
  useTween,
} from '@/components/ui/hooks';
import { pathsimulator as dict } from '@/i18n/dict/pathsimulator';
import { translator, type Lang } from '@/i18n/types';
import { clamp, linePath, niceTicks, scaleLinear, type Point } from '@/lib/chart';
import { EXAMPLE, EXAMPLE_LABEL } from '@/lib/fx/example';
import { MC_CONFIG, PIP } from '@/lib/fx/mc/products';
import { createMcClient, type McClient, type WorkerLike } from '@/lib/fx/mc/protocol';
import type { PriceResult } from '@/lib/fx/mc/value';
import type { ScenarioName } from '@/lib/fx/mc/scenarios';
import { fmtMoney, fmtNumber, fmtPct, fmtPips, fmtRate } from '@/lib/format';
import {
  PATHSIM_CONFIG,
  defaultScenario,
  earlyEndFixings,
  eventAt,
  fairInfo,
  forwardToDay,
  horizonDays,
  isPreset,
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
  simEvents,
  simProduct,
  simulate,
  simulateEnsemble,
  solvedParam,
  sortedByPnl,
  summarizeEnsemble,
  type FixingRow,
  type LevelKey,
  type ScenarioSettings,
  type SimEvent,
  type SimKind,
  type Simulation,
} from '@/lib/pathsim';

export interface PathSimulatorProps {
  lang: Lang;
  products?: string[];
  initial?: string;
  scenario?: string;
  preset?: string;
  move?: number;
  gap?: number;
  gapDay?: number;
  view?: 'path' | 'ensemble';
  ensemble?: boolean;
  adjustable?: boolean;
  autoplay?: boolean;
}

type View = 'path' | 'ensemble';
type Drag = 'end' | 'shock' | 'scrub' | 'level' | null;

interface Scen {
  name: ScenarioName;
  move: number;
  gap: number;
  /** Day of the gap as a fraction of the horizon (survives a change of product). */
  gapFrac: number;
  seed: number;
}

const PAIR = EXAMPLE.pair;
const CFG = PATHSIM_CONFIG;
const TREND: readonly ScenarioName[] = ['trendUp', 'trendDown', 'sideways'];
const snap = (x: number, step: number) => Number((Math.round(x / step) * step).toFixed(6));

function resolveProducts(ids?: string[]): SimKind[] {
  const list = (ids ?? []).filter(isSimKind);
  return list.length ? list : [...CFG.products];
}

function initialScen(p: PathSimulatorProps, kind: SimKind): Scen {
  const preset: ScenarioSettings = isPreset(p.preset)
    ? CFG.presets[p.preset]
    : { name: 'trendDown' };
  const name: ScenarioName = isScenario(p.scenario) ? p.scenario : preset.name;
  const days = horizonDays(simProduct(kind));
  const d = defaultScenario(name, days);
  const shock = defaultScenario('shock', days);
  const gapDay = p.gapDay ?? preset.gapDay;
  return {
    name,
    move: p.move ?? (name === preset.name ? preset.move : undefined) ?? d.move,
    gap: p.gap ?? preset.gap ?? shock.gap,
    gapFrac: gapDay !== undefined ? gapDay / days : shock.gapDay / days,
    seed: CFG.random.seed,
  };
}

/** Layout of both charts for a container width (viewBox = CSS pixels, labels stay sharp). */
function layoutFor(w: number) {
  const width = Math.max(280, Math.round(w));
  const compact = width < 560;
  return {
    width,
    compact,
    font: compact ? 11 : 12,
    left: compact ? 50 : 62,
    right: compact ? 20 : 26,
    top: 22,
    hPath: compact ? 250 : Math.round(clamp(width * 0.46, 270, 340)),
    hPnl: compact ? 150 : 172,
    axis: 22,
  };
}

/** Decimals that show a tick step exactly (0.02 → 2, 0.025 → 3), at least 2, at most 4. */
/** Reads prefers-reduced-motion synchronously (false outside the browser). */
function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  );
}

const ratioDigits = (step: number) => {
  for (let d = 2; d < 4; d++)
    if (Math.abs(Math.round(step * 10 ** d) - step * 10 ** d) < 1e-6) return d;
  return 4;
};

export default function PathSimulator(props: PathSimulatorProps): JSX.Element {
  const { lang } = props;
  const t = translator(dict, lang);
  const uid = useId().replace(/[^A-Za-z0-9_-]/g, '');
  const rm = usePrefersReducedMotion();
  const products = useMemo(() => resolveProducts(props.products), [props.products?.join()]);
  const firstKind: SimKind =
    isSimKind(props.initial) && products.includes(props.initial) ? props.initial : products[0]!;
  const adjustable = props.adjustable !== false;
  const allowEnsemble = props.ensemble !== false;

  const [kind, setKind] = useState<SimKind>(firstKind);
  const [scen, setScen] = useState<Scen>(() => initialScen(props, firstKind));
  const [param, setParam] = useState<number | undefined>(undefined);
  const [view, setView] = useState<View>(
    allowEnsemble && props.view === 'ensemble' ? 'ensemble' : 'path',
  );
  const [ensSeed, setEnsSeed] = useState<number>(CFG.ensemble.seed);
  const [tDay, setTDay] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speedIx, setSpeedIx] = useState(1);
  const [drag, setDrag] = useState<Drag>(null);
  const [started, setStarted] = useState(false);
  const dragRef = useRef<{ kind: Drag; pointerId: number; level?: string } | null>(null);

  const root = useRef<HTMLDivElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const pathSvg = useRef<SVGSVGElement>(null);
  const width = useElementWidth(box, 640);
  const L = layoutFor(width);
  const inView = useInView(root);

  /* ---------- simulation ---------- */
  const product = useMemo(() => simProduct(kind, param), [kind, param]);
  const days = horizonDays(product);
  const gapDay = clamp(Math.round(scen.gapFrac * days), 1, days - 1);
  const sim: Simulation = useMemo(
    () =>
      simulate(
        kind,
        { name: scen.name, move: scen.move, gap: scen.gap, gapDay, seed: scen.seed },
        param,
      ),
    [kind, scen.name, scen.move, scen.gap, gapDay, scen.seed, param],
  );
  const events = useMemo(() => simEvents(sim), [sim]);
  const ens = useMemo(
    () => (view === 'ensemble' ? simulateEnsemble(kind, CFG.ensemble.paths, ensSeed, param) : []),
    [view, kind, ensSeed, param],
  );
  const ensSum = useMemo(() => summarizeEnsemble(ens), [ens]);
  const ensOrder = useMemo(() => sortedByPnl(ens).reverse(), [ens]);
  const fair = fairInfo(kind);
  const pState = playState(sim, tDay);
  const N = product.notional;
  const buyer = kind !== 'decumulator';
  const isHedge = sim.benchmark !== 'gains';
  const isCoupon = kind === 'tpf' || kind === 'rtpf';

  /* ---------- playback ---------- */
  const tRef = useRef(tDay);
  tRef.current = tDay;
  useEffect(() => {
    if (!playing || !inView) return;
    let raf = 0;
    let last = performance.now();
    let holdUntil = 0;
    const evDays = view === 'path' ? events.map((e) => e.day) : [];
    const speed = CFG.speeds[speedIx] ?? 1;
    const step = (now: number) => {
      const dt = Math.min(80, now - last);
      last = now;
      if (now < holdUntil) {
        raf = requestAnimationFrame(step);
        return;
      }
      const cur = tRef.current;
      let next = cur + (dt * speed * sim.days) / (CFG.playSeconds * 1000);
      const hit = evDays.find((d) => d > cur + 1e-9 && next >= d && sim.days > d);
      if (hit !== undefined) {
        next = hit;
        holdUntil = now + (rm ? 0 : CFG.eventHoldMs);
      }
      if (next >= sim.days) {
        tRef.current = sim.days;
        setTDay(sim.days);
        setPlaying(false);
        return;
      }
      tRef.current = next;
      setTDay(next);
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [playing, inView, sim, speedIx, view, events, rm]);

  // First view: autoplay once (never under reduced motion; then show the full path). The media
  // query is read directly: the hook's value arrives one render late.
  useEffect(() => {
    if (started || !inView) return;
    setStarted(true);
    if (prefersReducedMotion() || props.autoplay === false) {
      setTDay(sim.days);
    } else {
      setTDay(0);
      setPlaying(true);
    }
  }, [inView]);
  // Reduced motion switched on while an autoplay runs: stop and show the result.
  useEffect(() => {
    if (rm && playing) {
      setPlaying(false);
      setTDay(sim.days);
    }
  }, [rm]);

  const restart = () => {
    setTDay(0);
    tRef.current = 0;
    setPlaying(true);
  };
  const togglePlay = () => {
    if (playing) setPlaying(false);
    else if (tDay >= sim.days - 1e-9) restart();
    else setPlaying(true);
  };
  /** A new path or product: replay from the start (or show the end under reduced motion). */
  const replay = (d: number) => {
    if (rm) {
      setPlaying(false);
      setTDay(d);
    } else {
      setTDay(0);
      tRef.current = 0;
      setPlaying(true);
    }
  };
  /** A drag or slider change: show the full result at once. */
  const showEnd = (d: number) => {
    setPlaying(false);
    setTDay(d);
  };

  const pickProduct = (k: SimKind) => {
    if (k === kind) return;
    setKind(k);
    setParam(undefined);
    replay(horizonDays(simProduct(k)));
  };
  const pickScenario = (name: ScenarioName) => {
    const d = defaultScenario(name, days);
    setScen((s) => ({
      ...s,
      name,
      move: d.move,
      gap: name === 'shock' ? d.gap : s.gap,
      gapFrac: name === 'shock' ? d.gapDay / days : s.gapFrac,
    }));
    replay(days);
  };
  const reseed = () => {
    if (view === 'ensemble') setEnsSeed((s) => s + 1);
    else setScen((s) => ({ ...s, name: 'random', seed: s.seed + CFG.random.step }));
    replay(days);
  };
  const setMove = (m: number) =>
    setScen((s) => ({ ...s, move: clamp(snap(m, CFG.move.step), CFG.move.min, CFG.move.max) }));
  const setGap = (g: number) =>
    setScen((s) => ({ ...s, gap: clamp(snap(g, CFG.gap.step), CFG.gap.min, CFG.gap.max) }));
  const setGapDay = (d: number) =>
    setScen((s) => ({ ...s, gapFrac: clamp(Math.round(d), 1, days - 1) / days }));

  /* ---------- live Monte Carlo value of an adjusted parameter (Web Worker) ---------- */
  const [pv, setPv] = useState<{ status: 'idle' | 'busy' | 'done' | 'error'; res?: PriceResult }>({
    status: 'idle',
  });
  const client = useRef<McClient | null>(null);
  const reqKey = useRef('');
  const alive = useRef(true);
  useEffect(
    () => () => {
      alive.current = false;
      client.current?.terminate();
    },
    [],
  );
  useEffect(() => {
    if (param === undefined || !adjustable) {
      reqKey.current = '';
      setPv({ status: 'idle' });
      return;
    }
    const key = `${kind}:${param}`;
    reqKey.current = key;
    setPv((p) => ({ ...p, status: 'busy' }));
    const timer = setTimeout(() => {
      if (!client.current && typeof Worker !== 'undefined') {
        try {
          client.current = createMcClient(
            () =>
              new Worker(new URL('../../lib/fx/mc/mc.worker.ts', import.meta.url), {
                type: 'module',
              }) as unknown as WorkerLike,
          );
        } catch {
          client.current = null;
        }
      }
      if (!client.current) {
        setPv({ status: 'error' });
        return;
      }
      client.current
        .price(kind, paramOverrides(kind, param), { paths: MC_CONFIG.engine.interactivePaths })
        .then((res) => {
          if (alive.current && reqKey.current === key) setPv({ status: 'done', res });
        })
        .catch(() => {
          if (alive.current && reqKey.current === key) setPv({ status: 'error' });
        });
    }, 220);
    return () => clearTimeout(timer);
  }, [kind, param, adjustable]);

  /* ---------- formatting ---------- */
  const chf = (x: number, sign = false) => fmtMoney(x, EXAMPLE.quote, lang, 0, sign);
  const usd = (x: number) => fmtMoney(x, EXAMPLE.base, lang);
  const rate = (x: number) => fmtRate(x, PAIR);
  const pipsTxt = (x: number, d = 1) => fmtPips(x, lang, d);
  const count = (x: number) => fmtNumber(x, lang);
  const months = (m: number) => t('ps.monthTick', { m });
  /** P&L axis ticks in CHF thousands. */
  const kFmt = (v: number) =>
    fmtNumber(v / 1000, lang, { digits: Math.abs(v) % 1000 > 1e-6 ? 1 : 0, sign: true });

  /* ---------- scales ---------- */
  const levels = productLevels(product);
  const zones = productZones(product);
  const xs = scaleLinear([0, days], [L.left, L.width - L.right]);
  const plotBottom = L.hPath - L.axis;
  const domTarget = useMemo<[number, number]>(() => {
    const lv = levels.map((l) => l.value);
    lv.push(forwardToDay(days));
    return view === 'ensemble'
      ? rateDomain(
          ens.map((p) => p.path),
          lv,
          0.04,
        )
      : rateDomain([sim.path], lv);
  }, [sim, ens, view]);
  const instant = rm || drag !== null || view === 'ensemble';
  const dom = useTween(domTarget, 300, instant);
  const ys = scaleLinear([dom[0]!, dom[1]!], [plotBottom, L.top]);
  const yStep = niceTicks(dom[0]!, dom[1]!, L.compact ? 4 : 5);
  const yTicks = yStep.filter((v) => v >= dom[0]! && dom[1]! >= v);
  const yDigits = ratioDigits(yTicks.length > 1 ? yTicks[1]! - yTicks[0]! : 0.01);
  const xT = xs(Math.min(tDay, days));

  /* ---------- strings of the path chart (memoised; playback only moves a clip) ---------- */
  const pathD = useMemo(() => {
    const pts: Point[] = [];
    for (let d = 0; d <= days; d++) pts.push([xs(d), ys(sim.path[d]!)]);
    return linePath(pts);
  }, [sim, dom[0], dom[1], L.width]);
  const fwdD = useMemo(() => {
    const pts: Point[] = [];
    for (let d = 0; d <= days; d += 7) pts.push([xs(d), ys(forwardToDay(d))]);
    pts.push([xs(days), ys(forwardToDay(days))]);
    return linePath(pts);
  }, [days, dom[0], dom[1], L.width]);
  const ensD = useMemo(
    () =>
      ens.map((p) => {
        const pts: Point[] = [];
        for (let d = 0; d < p.endDay; d += 2) pts.push([xs(d), ys(p.path[d]!)]);
        pts.push([xs(p.endDay), ys(p.path[p.endDay]!)]);
        return linePath(pts);
      }),
    [ens, dom[0], dom[1], L.width],
  );

  /* ---------- P&L chart ---------- */
  const pnlTop = 18;
  const pnlBottom = L.hPnl - L.axis;
  const pnlDomTarget = useMemo<[number, number]>(() => {
    let lo = 0;
    let hi = 0;
    for (const r of sim.rows) {
      lo = Math.min(lo, r.cumPnl, r.cumBench);
      hi = Math.max(hi, r.cumPnl, r.cumBench);
    }
    const span = Math.max(hi - lo, 4000);
    return [lo - span * 0.12, hi + span * 0.12];
  }, [sim]);
  const pnlDom = useTween(pnlDomTarget, 300, rm || drag !== null);
  const yp = scaleLinear([pnlDom[0]!, pnlDom[1]!], [pnlBottom, pnlTop]);
  const pnlTicks = niceTicks(pnlDom[0]!, pnlDom[1]!, L.compact ? 3 : 4).filter(
    (v) => v >= pnlDom[0]! && pnlDom[1]! >= v,
  );
  const stepD = (pts: Array<[number, number]>) => linePath(pts.map(([d, v]) => [xs(d), yp(v)]));
  const prodD = stepD(pnlSteps(sim, 'product'));
  const benchD = stepD(pnlSteps(sim, 'bench'));
  const endFlat = linePath([
    [xs(sim.endDay), yp(sim.rows[sim.endIndex]!.cumPnl)],
    [xs(days), yp(sim.rows[sim.endIndex]!.cumPnl)],
  ]);

  /* ---------- outcome bars (ensemble) ---------- */
  const outDom = useMemo<[number, number]>(() => {
    if (!ens.length) return [-1, 1];
    const lo = Math.min(0, ensSum.worst);
    const hi = Math.max(0, ensSum.best);
    const span = Math.max(hi - lo, 4000);
    return [lo - span * 0.08, hi + span * 0.12];
  }, [ens, ensSum]);
  const yo = scaleLinear(outDom, [pnlBottom, pnlTop]);
  const outTicks = niceTicks(outDom[0], outDom[1], L.compact ? 3 : 4).filter(
    (v) => v >= outDom[0] && outDom[1] >= v,
  );
  const ended = ens.filter((p) => p.reason !== 'maturity' && tDay + 1e-9 >= p.endDay).length;
  const ensDone = tDay >= days - 1e-9;
  /** Class of an ensemble path: neutral while it runs, then coloured by the sign of its P&L. */
  const ensClass = (endDay: number, pnl: number) =>
    endDay > tDay + 1e-9 ? 'ps-ens--run' : pnl >= 0 ? 'ps-ens--gain' : 'ps-ens--loss';

  /* ---------- tweened numbers ---------- */
  const numInstant = rm || drag !== null;
  // product − forward from the whole-franc amounts shown beside it, so the three numbers add up
  const heroTarget = isHedge
    ? Math.round(pState.cumPnl) - Math.round(pState.cumBench)
    : pState.cumPnl;
  const heroTw = useTween(heroTarget, 300, numInstant);
  const prodTw = useTween(pState.cumPnl, 300, numInstant);
  const benchTw = useTween(pState.cumBench, 300, numInstant);

  /* ---------- texts ---------- */
  const productName = t(`ps.p.${kind}`);
  const scenarioName = t(`ps.s.${scen.name}`);
  const freq = t(
    product.fixingDays[1]! - product.fixingDays[0]! === 7 ? 'ps.freq.weekly' : 'ps.freq.monthly',
  );
  const desc = (() => {
    const p = product;
    switch (p.kind) {
      case 'accumulator':
      case 'decumulator':
        return t(`ps.d.${p.kind}`, { freq, n: usd(N), k: rate(p.strike), b: rate(p.barrier) });
      case 'tarf':
        return t('ps.d.tarf', {
          freq,
          n: usd(N),
          k: rate(p.strike),
          target: pipsTxt(p.target / PIP, 0),
        });
      case 'pivotTarf':
        return t('ps.d.pivotTarf', {
          k1: rate(p.lowerStrike),
          k2: rate(p.upperStrike),
          p: rate(p.pivot),
          target: pipsTxt(p.target / PIP, 0),
        });
      case 'tpf':
        return t('ps.d.tpf', {
          k: rate(p.strike),
          c: pipsTxt(p.coupon / PIP),
          n: usd(N),
          target: count(p.targetCoupons),
        });
      case 'rtpf':
        return t('ps.d.rtpf', {
          l: rate(p.lower),
          u: rate(p.upper),
          c: pipsTxt(p.coupon / PIP),
          n: usd(N),
          target: count(p.targetCoupons),
        });
    }
  })();

  const evText = (e: SimEvent | null): string => {
    if (!e) return '';
    const row = e.fixing > 0 ? sim.rows[e.fixing - 1] : undefined;
    const k = row?.rate !== null && row?.rate !== undefined ? rate(row.rate) : '';
    switch (e.type) {
      case 'gap':
        return t('ps.ev.gap', { pair: PAIR, gap: fmtPct(Math.abs(scen.gap), lang, 1) });
      case 'leverage':
        if (kind === 'pivotTarf') return t('ps.ev.leverage.pivot', { i: e.fixing });
        if (isCoupon) return t('ps.ev.leverage.pay', { i: e.fixing });
        return t(buyer ? 'ps.ev.leverage.buy' : 'ps.ev.leverage.sell', { i: e.fixing, k });
      case 'ko':
        return t(buyer ? 'ps.ev.ko.buy' : 'ps.ev.ko.sell', { i: e.fixing });
      case 'target':
        return t('ps.ev.target');
      case 'maturity':
        return sim.rows[sim.endIndex]!.cumPnl < 0
          ? t('ps.ev.maturityLoss', { n: sim.rows.length })
          : t('ps.ev.maturity', { n: sim.rows.length });
    }
  };
  const ev = view === 'path' ? eventAt(events, tDay) : null;
  const evTone = !ev
    ? ''
    : ev.type === 'gap' || ev.type === 'leverage'
      ? 'warn'
      : ev.type === 'maturity'
        ? sim.rows[sim.endIndex]!.cumPnl < 0
          ? 'bad'
          : 'good'
        : 'event';
  const earlyKey = kind === 'accumulator' || kind === 'decumulator' ? 'ko' : 'target';
  const earlyCount = earlyKey === 'ko' ? ensSum.count.knockout : ensSum.count.target;
  const ensText = !ens.length
    ? ''
    : ensDone
      ? t(`ps.ens.done.${earlyCount ? earlyKey : 'none'}`, {
          early: earlyCount,
          maturity: ensSum.count.maturity,
          n: ensSum.n,
        })
      : t('ps.ens.running', { ended, open: ensSum.n - ended, n: ensSum.n });
  const liveText = view === 'path' ? evText(ev) : ensDone ? ensText : '';

  const statusText = (() => {
    if (pState.passed === 0) return t('ps.st.notStarted');
    if (!pState.ended) return t('ps.st.running');
    const i = sim.endIndex + 1;
    if (sim.reason === 'knockout') return t('ps.st.endKo', { i });
    if (sim.reason === 'target') return t('ps.st.endTarget', { i });
    return t('ps.st.endMaturity');
  })();
  const levelText = (key: LevelKey, v: number) => t(`ps.lv.${key}`, { v: rate(v) });
  const levelsAria = levels.map((l) => levelText(l.key, l.value)).join(', ');
  const levCount = sim.rows.filter((r) => tDay + 1e-9 >= r.day && r.leveraged).length;
  const pathAria = t('ps.aria.path', {
    pair: PAIR,
    scenario: scenarioName,
    product: productName,
    levels: levelsAria,
    d: Math.round(tDay),
    total: days,
    spot: rate(pState.spot),
    passed: pState.passed,
    n: sim.rows.length,
    lev: levCount,
    status: statusText,
  });
  const benchLabel = t(isHedge ? 'ps.lg.fwdHedge' : isCoupon ? 'ps.lg.coupons' : 'ps.lg.gains');
  const pnlAria = t('ps.aria.pnl', {
    d: Math.round(tDay),
    p: chf(pState.cumPnl),
    benchLabel,
    b: chf(pState.cumBench),
  });
  const ensAria = t('ps.aria.ens', {
    n: ensSum.n,
    product: productName,
    d: Math.round(tDay),
    ended,
    early: earlyCount,
    maturity: ensSum.count.maturity,
    mean: chf(ensSum.meanPnl),
    worst: chf(ensSum.worst),
  });
  const outAria = t('ps.aria.outcome', {
    n: ensSum.n,
    best: chf(ensSum.best),
    worst: chf(ensSum.worst),
    mean: chf(ensSum.meanPnl),
  });

  /* ---------- pointer interaction on the path chart ---------- */
  const toSvg = (e: PointerEvent): [number, number] => {
    const el = pathSvg.current;
    if (!el) return [0, 0];
    const r = el.getBoundingClientRect();
    return [
      ((e.clientX - r.left) * L.width) / Math.max(1, r.width),
      ((e.clientY - r.top) * L.hPath) / Math.max(1, r.height),
    ];
  };
  const [lo, hi, pStep] = paramRange(kind);
  const pVal = paramOf(product);
  const setParamClamped = (v: number) => {
    const x = clamp(snap(v, pStep), lo, hi);
    setParam(Math.abs(x - fair.value) < pStep / 2 ? undefined : x);
  };
  const applyDrag = (d: NonNullable<Drag>, e: PointerEvent, level?: string) => {
    const [px, py] = toSvg(e);
    const r = ys.invert(py);
    if (d === 'scrub') {
      setTDay(clamp(xs.invert(px), 0, days));
    } else if (d === 'end') {
      setMove(r / EXAMPLE.spot - 1);
      showEnd(days);
    } else if (d === 'shock') {
      const day = clamp(Math.round(xs.invert(px)), 1, days - 1);
      setGapDay(day);
      setGap(r / sim.path[Math.max(0, day - 1)]! - 1);
      showEnd(days);
    } else if (d === 'level') {
      if (kind === 'pivotTarf') {
        const pivot = (product as { pivot: number }).pivot;
        setParamClamped(Math.abs(r - pivot));
      } else if (level === 'strike') {
        setParamClamped(r);
      }
      showEnd(days);
    }
  };
  const onDown = (d: NonNullable<Drag>, level?: string) => (e: PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    dragRef.current = { kind: d, pointerId: e.pointerId, level };
    setDrag(d);
    if (d === 'scrub') setPlaying(false);
    applyDrag(d, e, level);
  };
  const onMove = (e: PointerEvent) => {
    const d = dragRef.current;
    if (!d || d.pointerId !== e.pointerId || !d.kind) return;
    applyDrag(d.kind, e, d.level);
  };
  const onUp = (e: PointerEvent) => {
    const d = dragRef.current;
    if (!d || d.pointerId !== e.pointerId) return;
    dragRef.current = null;
    setDrag(null);
  };
  const dragHandlers = { onPointerMove: onMove, onPointerUp: onUp, onPointerCancel: onUp };

  /* ---------- legends ---------- */
  const legendPath: LegendItem[] =
    view === 'path'
      ? [
          { label: t('ps.lg.path'), color: 'var(--ff-ink)', width: 2 },
          { label: t('ps.lg.forward'), color: 'var(--ff-forward)', kind: 'dashed', width: 2 },
          { label: t('ps.lg.fixGain'), color: 'var(--ff-long)', width: 6 },
          { label: t('ps.lg.fixLoss'), color: 'var(--ff-short)', width: 6 },
        ]
      : [
          { label: t('ps.lg.pathGain'), color: 'rgba(37, 99, 235, 0.55)', width: 2 },
          { label: t('ps.lg.pathLoss'), color: 'rgba(234, 88, 12, 0.7)', width: 2 },
        ];
  const legendPnl: LegendItem[] = [
    { label: t('ps.lg.product'), color: 'var(--ff-long)' },
    { label: benchLabel, color: 'var(--ff-forward)', kind: 'dashed', width: 2 },
  ];

  /* ---------- side stats ---------- */
  const fairStats = (() => {
    const adj = param !== undefined && pv.status === 'done' && pv.res;
    if (adj && pv.res) {
      const s = pv.res.stats;
      const pEnd = earlyKey === 'ko' ? s.endProbability.knockout : s.endProbability.target;
      return {
        pEnd,
        earlyFixings: earlyEndFixings(
          s.expectedFixings,
          s.endProbability.maturity,
          pEnd,
          product.fixingDays.length,
        ),
        q05: s.pvQuantile05,
        worst: s.pvMin,
        paths: pv.res.paths,
        note: t('ps.st.mcNoteAdj', { paths: count(pv.res.paths) }),
      };
    }
    const pEnd = earlyKey === 'ko' ? fair.pKnockOut : fair.pTarget;
    return {
      pEnd,
      earlyFixings: earlyEndFixings(
        fair.expectedFixings,
        fair.pMaturity,
        pEnd,
        product.fixingDays.length,
      ),
      q05: fair.pvQuantile05,
      worst: fair.pvMin,
      paths: fair.paths,
      note: t('ps.st.mcNote', { paths: count(fair.paths) }),
    };
  })();
  const solved = solvedParam(kind);
  const paramLabel = t(`ps.param.${solved}`);
  const paramText =
    solved === 'strike' ? rate(pVal) : t('ps.param.pips', { v: pipsTxt(pVal / PIP) });
  const fairRow = (() => {
    const se = fmtNumber(fair.stdErrPips, lang, { digits: 1 });
    const sub = t('ps.st.fairSub', { se, paths: count(fair.paths) });
    if (solved === 'strike') {
      return { label: t('ps.st.fairStrike'), value: rate(fair.value), sub };
    }
    if (solved === 'coupon') {
      return {
        label: t('ps.st.fairCoupon'),
        value: t('ps.param.pips', { v: pipsTxt(fair.value / PIP) }),
        sub,
      };
    }
    return {
      label: t('ps.st.fairWidth'),
      value: t('ps.param.pips', { v: pipsTxt(fair.value / PIP) }),
      sub,
    };
  })();
  const secondRow = (() => {
    if (solved === 'strike') {
      const d = (fair.value - fair.forwardAvg) / PIP;
      return {
        label: t('ps.st.forward'),
        value: rate(fair.forwardAvg),
        sub: t('ps.st.forwardSub', {
          d: pipsTxt(Math.abs(d)),
          side: t(d < 0 ? 'ps.st.better.below' : 'ps.st.better.above'),
        }),
      };
    }
    if (solved === 'coupon') {
      return {
        label: t('ps.st.fairCoupon'),
        value: chf(fair.value * N),
        sub: t('ps.st.couponChf', { chf: chf(fair.value * N), n: usd(N) }),
      };
    }
    const piv = simProduct('pivotTarf');
    return {
      label: t('ps.st.fairWidth'),
      value: rate(piv.pivot),
      sub: t('ps.st.widthSub', { k1: rate(piv.lowerStrike), k2: rate(piv.upperStrike) }),
    };
  })();

  /* ---------- table ---------- */
  const tableRows = sim.rows.filter((r) => tDay + 1e-9 >= r.day);
  const tableBox = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = tableBox.current;
    if (el && playing) el.scrollTop = el.scrollHeight;
  }, [tableRows.length]);
  const eventCell = (r: FixingRow): JSX.Element => {
    const n = usd(N);
    const k = r.rate !== null ? rate(r.rate) : '';
    let text: string;
    switch (r.kind) {
      case 'buy':
      case 'buyLev':
      case 'sell':
      case 'sellLev':
        text =
          r.event === 'target'
            ? t(r.kind.startsWith('buy') ? 'ps.k.targetTrade' : 'ps.k.targetSell')
            : t(`ps.k.${r.kind}`, { n, k });
        break;
      case 'coupon':
      case 'payment':
        text = t(`ps.k.${r.kind}`);
        break;
      case 'none':
        text = t('ps.k.none');
        break;
      default:
        text = '';
    }
    return (
      <span class="ps-evcell">
        {text && <span>{text}</span>}
        {r.event && <span class={`ps-tag ps-tag--${r.event}`}>{t(`ps.k.${r.event}`)}</span>}
      </span>
    );
  };

  /* ---------- render helpers ---------- */
  const fs = `${L.font}px`;
  const clipPlayed = `ps-played-${uid}`;
  const clipFuture = `ps-future-${uid}`;
  const clipPlot = `ps-plot-${uid}`;
  const clipPnl = `ps-pnlclip-${uid}`;
  const ticks = monthTicks(days);
  const zoneFill = {
    gain: 'rgba(37, 99, 235, 0.06)',
    loss: 'rgba(234, 88, 12, 0.07)',
    ko: 'rgba(14, 17, 22, 0.045)',
  };
  const zoneLabel = (z: 'gain' | 'loss' | 'ko') =>
    t(
      z === 'ko'
        ? 'ps.zone.ko'
        : isCoupon
          ? z === 'gain'
            ? 'ps.zone.coupon'
            : 'ps.zone.payment'
          : z === 'gain'
            ? 'ps.zone.gain'
            : 'ps.zone.loss',
    );
  const canDragEnd = view === 'path' && TREND.includes(scen.name);
  const canDragShock = view === 'path' && scen.name === 'shock';
  const canDragLevel = adjustable && view === 'path' && solved !== 'coupon';
  const halo = {
    paintOrder: 'stroke',
    stroke: '#fff',
    strokeWidth: 4,
    strokeLinejoin: 'round',
  } as const;

  const endRow = sim.rows[sim.endIndex]!;
  const evDot = ev && (ev.type === 'ko' || ev.type === 'target') ? endRow : null;

  return (
    <div
      ref={root}
      class="ps"
      data-ps
      data-product={kind}
      data-scenario={scen.name}
      data-view={view}
      data-playing={playing ? 'true' : 'false'}
      data-day={Math.round(tDay)}
      data-reason={sim.reason}
      data-ended-at={sim.endIndex + 1}
    >
      <div class="ff-lab-head">
        <div class="ps-head-text">
          <div class="ff-lab-title">{t('ps.title')}</div>
          <div class="ff-lab-sub">
            {t('ps.sub', {
              pair: PAIR,
              spot: rate(EXAMPLE.spot),
              vol: fmtPct(EXAMPLE.vol, lang, 0),
              label: EXAMPLE_LABEL[lang],
            })}
          </div>
        </div>
        <span class="ff-pill-note ps-generic">{t('ps.generic')}</span>
      </div>

      <div class="ps-pickers">
        {products.length > 1 && (
          <div class="ps-chips" role="group" aria-label={t('ps.products')}>
            {products.map((k) => (
              <button
                key={k}
                type="button"
                class="ps-chip"
                aria-pressed={k === kind}
                data-product-chip={k}
                onClick={() => pickProduct(k)}
              >
                {t(`ps.p.${k}`)}
              </button>
            ))}
          </div>
        )}
        <div class="ps-chips" role="group" aria-label={t('ps.scenarios')}>
          {CFG.scenarios.map((s) => (
            <button
              key={s}
              type="button"
              class="ps-chip ps-chip--light"
              aria-pressed={view === 'path' && s === scen.name}
              disabled={view === 'ensemble'}
              data-scenario-chip={s}
              onClick={() => pickScenario(s)}
            >
              {t(`ps.s.${s}`)}
            </button>
          ))}
        </div>
      </div>
      <p class="ps-desc" data-desc>
        {desc}
      </p>

      <div class="ff-lab ps-lab">
        <div class="ff-lab-main ps-main">
          <div class="ps-legend-row">
            <Legend items={legendPath} />
            {allowEnsemble && (
              <Segmented
                label={t('ps.view')}
                value={view}
                onChange={(v) => {
                  setView(v);
                  replay(days);
                }}
                options={[
                  { value: 'path', label: t('ps.view.path') },
                  { value: 'ensemble', label: t('ps.view.ensemble', { n: CFG.ensemble.paths }) },
                ]}
              />
            )}
          </div>

          <div
            class={`ps-banner ps-banner--${view === 'path' ? evTone || 'idle' : ensDone ? 'event' : 'idle'}`}
            key={
              view === 'path'
                ? ev
                  ? `${ev.type}-${ev.day}`
                  : 'none'
                : ensDone
                  ? 'ens-done'
                  : 'ens'
            }
            data-banner={
              view === 'path' ? (ev?.type ?? 'none') : ensDone ? 'ensemble-done' : 'ensemble'
            }
            aria-hidden="true"
          >
            {view === 'path'
              ? evText(ev) || t('ps.idle', { scenario: scenarioName, n: sim.rows.length })
              : ensText}
          </div>

          <div ref={box} class="ps-chart">
            <svg
              ref={pathSvg}
              viewBox={`0 0 ${L.width} ${L.hPath}`}
              role="img"
              aria-label={view === 'path' ? pathAria : ensAria}
              class={`ps-svg${drag ? ' is-dragging' : ''}`}
              data-path-chart
              {...dragHandlers}
            >
              <defs>
                <clipPath id={clipPlot}>
                  <rect
                    x={L.left}
                    y={L.top - 4}
                    width={L.width - L.left - L.right}
                    height={plotBottom - L.top + 8}
                  />
                </clipPath>
                <clipPath id={clipPlayed}>
                  <rect x={0} y={0} width={Math.max(0, xT)} height={L.hPath} />
                </clipPath>
                <clipPath id={clipFuture}>
                  <rect x={xT} y={0} width={Math.max(0, L.width - xT)} height={L.hPath} />
                </clipPath>
              </defs>

              {/* zones */}
              <g clip-path={`url(#${clipPlot})`}>
                {zones.map((z, i) => {
                  const y0 = ys(Math.min(z.to, dom[1]!));
                  const y1 = ys(Math.max(z.from, dom[0]!));
                  if (y1 <= y0) return null;
                  return (
                    <rect
                      key={`z${i}`}
                      x={L.left}
                      y={y0}
                      width={L.width - L.left - L.right}
                      height={y1 - y0}
                      style={{ fill: zoneFill[z.kind] }}
                    />
                  );
                })}
              </g>
              <GridY
                y={ys}
                ticks={yTicks}
                x0={L.left}
                x1={L.width - L.right}
                format={(v) => fmtRate(v, PAIR, yDigits)}
                axisAt={null}
                fontSize={L.font}
              />
              {!L.compact &&
                zones.map((z, i) => {
                  const top = Math.min(z.to, dom[1]!);
                  const bottom = Math.max(z.from, dom[0]!);
                  if (ys(bottom) - ys(top) < L.font + 10) return null;
                  return (
                    <text
                      key={`zl${i}`}
                      x={L.left + 8}
                      y={ys(top) + L.font + 4}
                      class="ps-zone-label"
                      style={{ fontSize: fs }}
                    >
                      {zoneLabel(z.kind)}
                    </text>
                  );
                })}

              {/* month axis and scheduled fixings */}
              {ticks.map((tk) => (
                <text
                  key={`mt${tk.month}`}
                  x={xs(tk.day)}
                  y={L.hPath - 5}
                  style={{ fontSize: fs, fill: 'var(--ff-muted)', textAnchor: 'middle' }}
                >
                  {months(tk.month)}
                </text>
              ))}
              {sim.rows.map((r) => (
                <path
                  key={`ft${r.fixing}`}
                  d={`M${xs(r.day).toFixed(1)},${plotBottom}v5`}
                  class={`ps-fixtick${r.day <= tDay + 1e-9 ? ' is-passed' : ''}`}
                />
              ))}

              {/* levels */}
              {levels.map((l) => {
                const y = ys(l.value);
                if (y < L.top - 2 || y > plotBottom + 2) return null;
                const draggable =
                  canDragLevel && (kind === 'pivotTarf' ? l.key !== 'pivot' : l.key === 'strike');
                const label = levelText(l.key, l.value);
                const w = label.length * (L.font * 0.62) + (draggable ? 26 : 14);
                const x1 = L.width - L.right - 14;
                return (
                  <g key={`lv${l.key}`} data-level={l.key}>
                    <path
                      d={`M${L.left},${y.toFixed(1)}H${L.width - L.right}`}
                      class={l.key === 'barrier' ? 'ps-barrier' : 'ps-level'}
                    />
                    <g
                      class={draggable ? 'ps-level-handle' : undefined}
                      onPointerDown={draggable ? onDown('level', l.key) : undefined}
                      data-level-handle={draggable ? l.key : undefined}
                    >
                      {draggable && (
                        <rect
                          x={x1 - w}
                          y={y - 22}
                          width={w}
                          height={44}
                          style={{ fill: 'transparent' }}
                        />
                      )}
                      <rect
                        x={x1 - w}
                        y={y - 11}
                        width={w}
                        height={22}
                        rx={11}
                        class={draggable ? 'ps-pill ps-pill--drag' : 'ps-pill'}
                      />
                      {draggable && (
                        <path
                          d={`M${x1 - w + 9},${y - 3}h7M${x1 - w + 9},${y + 1}h7`}
                          style={{
                            stroke: 'currentColor',
                            strokeWidth: 1.4,
                            strokeLinecap: 'round',
                          }}
                          class="ps-grip"
                        />
                      )}
                      <text
                        x={x1 - 7}
                        y={y + L.font * 0.36}
                        style={{ fontSize: fs, textAnchor: 'end' }}
                        class="ps-pill-text"
                      >
                        {label}
                      </text>
                    </g>
                  </g>
                );
              })}

              {/* scrub surface */}
              <rect
                x={L.left}
                y={L.top}
                width={L.width - L.left - L.right}
                height={plotBottom - L.top}
                style={{ fill: 'transparent' }}
                class="ps-scrub"
                onPointerDown={onDown('scrub')}
              />

              {view === 'path' ? (
                <g>
                  {/* forward curve, future path (faint) and played path */}
                  <path d={fwdD} class="ps-fwd" />
                  <path d={pathD} class="ps-path-future" clip-path={`url(#${clipFuture})`} />
                  <path d={pathD} class="ps-path" clip-path={`url(#${clipPlayed})`} />
                  {sim.gapDay !== null && (
                    <path
                      d={`M${xs(sim.gapDay).toFixed(1)},${L.top}V${plotBottom}`}
                      class="ps-gapline"
                    />
                  )}

                  {/* fixings */}
                  {sim.rows.map((r) => {
                    if (r.day > tDay + 1e-9) return null;
                    const cx = xs(r.day);
                    const cy = ys(r.spot);
                    if (!r.active) {
                      return (
                        <circle
                          key={`f${r.fixing}`}
                          cx={cx}
                          cy={cy}
                          r={3.2}
                          class="ps-fix ps-fix--off"
                        />
                      );
                    }
                    if (r.kind === 'ko' || (r.kind === 'target' && !r.pnl)) {
                      return (
                        <circle
                          key={`f${r.fixing}`}
                          cx={cx}
                          cy={cy}
                          r={5}
                          class="ps-fix ps-fix--event"
                        />
                      );
                    }
                    const loss = r.pnl < 0;
                    return (
                      <circle
                        key={`f${r.fixing}`}
                        cx={cx}
                        cy={cy}
                        r={r.leveraged ? 6 : 4.5}
                        class={`ps-fix ${loss ? 'ps-fix--loss' : 'ps-fix--gain'}${r.leveraged ? ' is-lev' : ''}`}
                        data-fix={r.fixing}
                      />
                    );
                  })}

                  {/* event marker: knock-out or target, lit up exactly when it happens */}
                  {evDot && (
                    <g class="ps-eventmark" key={`em-${evDot.fixing}-${sim.reason}`}>
                      <circle cx={xs(evDot.day)} cy={ys(evDot.spot)} r={9} class="ps-pulse" />
                      <circle cx={xs(evDot.day)} cy={ys(evDot.spot)} r={7} class="ps-ring" />
                      {(() => {
                        const label = t(sim.reason === 'knockout' ? 'ps.k.ko' : 'ps.k.target');
                        const w = label.length * (L.font * 0.62) + 18;
                        const ex = xs(evDot.day);
                        const toLeft = ex + 14 + w > L.width - L.right;
                        const above = ys(evDot.spot) - 34 > L.top;
                        const bx = toLeft ? ex - 14 - w : ex + 14;
                        const by = above ? ys(evDot.spot) - 34 : ys(evDot.spot) + 12;
                        return (
                          <g>
                            <rect x={bx} y={by} width={w} height={22} rx={11} class="ps-evpill" />
                            <text
                              x={bx + w / 2}
                              y={by + 11 + L.font * 0.36}
                              style={{ fontSize: fs, textAnchor: 'middle' }}
                              class="ps-evpill-text"
                            >
                              {label}
                            </text>
                          </g>
                        );
                      })()}
                    </g>
                  )}

                  {/* handles: path end (trend) and shock */}
                  {canDragEnd && (
                    <g class="ps-handle" data-handle="end" onPointerDown={onDown('end')}>
                      <rect
                        x={xs(days) - 22}
                        y={ys(sim.path[days]!) - 22}
                        width={44}
                        height={44}
                        style={{ fill: 'transparent' }}
                      />
                      <circle cx={xs(days)} cy={ys(sim.path[days]!)} r={10} class="ps-handle-dot" />
                      <path
                        d={`M${xs(days) - 3.5},${ys(sim.path[days]!) - 2}l3.5,-3.5l3.5,3.5M${xs(days) - 3.5},${ys(sim.path[days]!) + 2}l3.5,3.5l3.5,-3.5`}
                        class="ps-handle-icon"
                      />
                    </g>
                  )}
                  {canDragShock && (
                    <g class="ps-handle" data-handle="shock" onPointerDown={onDown('shock')}>
                      <rect
                        x={xs(gapDay) - 22}
                        y={ys(sim.path[gapDay]!) - 22}
                        width={44}
                        height={44}
                        style={{ fill: 'transparent' }}
                      />
                      <circle
                        cx={xs(gapDay)}
                        cy={ys(sim.path[gapDay]!)}
                        r={10}
                        class="ps-handle-dot ps-handle-dot--shock"
                      />
                      <path
                        d={`M${xs(gapDay) + 1.5},${ys(sim.path[gapDay]!) - 5}l-4,5.5h4l-2,5`}
                        class="ps-handle-icon"
                      />
                    </g>
                  )}
                </g>
              ) : (
                <g clip-path={`url(#${clipPlayed})`}>
                  {ens.map((p, i) => (
                    <path key={`e${i}`} d={ensD[i]} class={`ps-ens ${ensClass(p.endDay, p.pnl)}`} />
                  ))}
                  {ens.map((p, i) =>
                    p.reason !== 'maturity' ? (
                      <circle
                        key={`ee${i}`}
                        cx={xs(p.endDay)}
                        cy={ys(p.path[p.endDay]!)}
                        r={2.4}
                        class="ps-ens-end"
                      />
                    ) : null,
                  )}
                </g>
              )}

              {/* playhead */}
              <path d={`M${xT.toFixed(1)},${L.top - 6}V${plotBottom}`} class="ps-playhead" />
              {view === 'path' && <circle cx={xT} cy={ys(pState.spot)} r={5} class="ps-head-dot" />}
              <text
                x={clamp(xT, L.left + 24, L.width - L.right - 24)}
                y={L.top - 9}
                style={{ fontSize: fs, textAnchor: 'middle', ...halo }}
                class="ps-day-label"
              >
                {t('ps.dayLabel', { d: Math.round(tDay) })}
                {view === 'path' ? ` · ${rate(pState.spot)}` : ''}
              </text>
            </svg>
          </div>

          <div class="ps-transport">
            <button
              type="button"
              class="ps-round"
              onClick={togglePlay}
              aria-label={playing ? t('ps.pause') : t('ps.play')}
              aria-pressed={playing}
              data-play
            >
              {playing ? (
                <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
                  <path d="M5 3.5V12.5M11 3.5V12.5" class="ps-icon-stroke" />
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
                  <path d="M5 3.2L12.5 8L5 12.8Z" class="ps-icon-fill" />
                </svg>
              )}
            </button>
            <button
              type="button"
              class="ps-round"
              onClick={restart}
              aria-label={t('ps.restart')}
              data-restart
            >
              <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
                <path d="M3.5 8a4.5 4.5 0 1 0 1.4-3.3M3.5 2.8v2.6h2.6" class="ps-icon-stroke" />
              </svg>
            </button>
            <div class="ps-scrub-slider">
              <Slider
                id={`ps-${uid}-t`}
                label={t('ps.time')}
                value={Math.round(tDay)}
                min={0}
                max={days}
                step={1}
                valueText={t('ps.timeValue', { d: Math.round(tDay), total: days })}
                onInput={(v) => {
                  setPlaying(false);
                  setTDay(v);
                }}
              />
            </div>
            <Segmented
              label={t('ps.speed')}
              value={String(speedIx)}
              onChange={(v) => setSpeedIx(Number(v))}
              options={CFG.speeds.map((s, i) => ({
                value: String(i),
                label: t('ps.speedValue', { x: fmtNumber(s, lang, { digits: s < 1 ? 1 : 0 }) }),
              }))}
            />
          </div>

          <div class="ps-legend-row ps-legend-row--pnl">
            {view === 'path' ? (
              <Legend items={legendPnl} />
            ) : (
              <span class="ps-axis-title">{t('ps.yOutcome')}</span>
            )}
          </div>
          <svg
            viewBox={`0 0 ${L.width} ${L.hPnl}`}
            role="img"
            aria-label={view === 'path' ? pnlAria : outAria}
            class="ps-svg ps-svg--pnl"
            data-pnl-chart
          >
            {view === 'path' ? (
              <g>
                <defs>
                  <clipPath id={clipPnl}>
                    <rect x={0} y={0} width={Math.max(0, xT + 1)} height={L.hPnl} />
                  </clipPath>
                </defs>
                <GridY
                  y={yp}
                  ticks={pnlTicks}
                  x0={L.left}
                  x1={L.width - L.right}
                  format={kFmt}
                  fontSize={L.font}
                />
                <text
                  x={L.left}
                  y={11}
                  style={{ fontSize: fs, fontWeight: 600, fill: 'var(--ff-muted)' }}
                >
                  {t('ps.yPnl')}
                </text>
                {ticks.map((tk) => (
                  <text
                    key={`pt${tk.month}`}
                    x={xs(tk.day)}
                    y={L.hPnl - 5}
                    style={{ fontSize: fs, fill: 'var(--ff-muted)', textAnchor: 'middle' }}
                  >
                    {months(tk.month)}
                  </text>
                ))}
                <g clip-path={`url(#${clipPnl})`}>
                  <path d={benchD} class="ps-bench" />
                  {sim.endDay < days && <path d={endFlat} class="ps-prod-after" />}
                  <path d={prodD} class="ps-prod" />
                </g>
                <path d={`M${xT.toFixed(1)},${pnlTop - 4}V${pnlBottom}`} class="ps-playhead" />
                <circle cx={xT} cy={yp(pState.cumBench)} r={4} class="ps-bench-dot" />
                <circle cx={xT} cy={yp(pState.cumPnl)} r={5} class="ps-prod-dot" />
              </g>
            ) : (
              <g>
                <GridY
                  y={yo}
                  ticks={outTicks}
                  x0={L.left}
                  x1={L.width - L.right}
                  format={kFmt}
                  fontSize={L.font}
                />
                {ensOrder.map((idx, rank) => {
                  const p = ens[idx]!;
                  const bw = (L.width - L.left - L.right) / Math.max(1, ens.length);
                  const shown = p.endDay <= tDay + 1e-9;
                  const y0 = yo(0);
                  const y1 = yo(p.pnl);
                  return (
                    <rect
                      key={`b${idx}`}
                      x={L.left + rank * bw + 0.5}
                      y={Math.min(y0, y1)}
                      width={Math.max(1, bw - 1)}
                      height={Math.max(1, Math.abs(y1 - y0))}
                      class={`ps-bar ${p.pnl < 0 ? 'ps-bar--loss' : 'ps-bar--gain'}${shown ? ' is-shown' : ''}`}
                    />
                  );
                })}
                {ensDone && ens.length > 0 && (
                  <g class="ps-mean">
                    <path
                      d={`M${L.left},${yo(ensSum.meanPnl).toFixed(1)}H${L.width - L.right}`}
                      class="ps-mean-line"
                    />
                    <text
                      x={L.width - L.right - 4}
                      y={yo(ensSum.meanPnl) - 6}
                      style={{ fontSize: fs, textAnchor: 'end', ...halo }}
                      class="ps-mean-text"
                    >
                      {t('ps.lg.mean')} {chf(ensSum.meanPnl)}
                    </text>
                  </g>
                )}
              </g>
            )}
          </svg>
          <p class="sr-only" data-summary>
            {view === 'path' ? `${pathAria} ${pnlAria}` : `${ensAria} ${outAria}`}
          </p>
          <div class="sr-only" aria-live="polite" aria-atomic="true">
            {t('ps.live.event', { text: liveText })}
          </div>
        </div>

        <div class="ff-lab-side ps-side">
          {view === 'path' && (canDragEnd || canDragShock || scen.name === 'random') && (
            <div class="panel ps-panel">
              {canDragEnd && (
                <Slider
                  id={`ps-${uid}-move`}
                  label={t('ps.move')}
                  value={scen.move}
                  min={CFG.move.min}
                  max={CFG.move.max}
                  step={CFG.move.step}
                  valueText={fmtPct(scen.move, lang, 1, true)}
                  onInput={(v) => {
                    setMove(v);
                    showEnd(days);
                  }}
                />
              )}
              {canDragShock && (
                <>
                  <Slider
                    id={`ps-${uid}-gapday`}
                    label={t('ps.gapDay')}
                    value={gapDay}
                    min={1}
                    max={days - 1}
                    step={1}
                    valueText={t('ps.dayValue', { d: gapDay })}
                    onInput={(v) => {
                      setGapDay(v);
                      showEnd(days);
                    }}
                  />
                  <Slider
                    id={`ps-${uid}-gap`}
                    label={t('ps.gapSize')}
                    value={scen.gap}
                    min={CFG.gap.min}
                    max={CFG.gap.max}
                    step={CFG.gap.step}
                    valueText={fmtPct(scen.gap, lang, 1, true)}
                    onInput={(v) => {
                      setGap(v);
                      showEnd(days);
                    }}
                  />
                </>
              )}
              {(canDragEnd || canDragShock) && (
                <p class="ps-hint">{t(canDragEnd ? 'ps.dragEnd' : 'ps.dragShock')}</p>
              )}
              {scen.name === 'random' && (
                <div class="ps-reseed-row">
                  <button type="button" class="ps-btn" onClick={reseed} data-reseed>
                    <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
                      <path
                        d="M3.5 8a4.5 4.5 0 1 0 1.4-3.3M3.5 2.8v2.6h2.6"
                        class="ps-icon-stroke"
                      />
                    </svg>
                    {t('ps.reseed')}
                  </button>
                  <span class="ps-seed">{t('ps.seed', { seed: scen.seed })}</span>
                </div>
              )}
            </div>
          )}

          {view === 'path' ? (
            <StatTable>
              <StatHero
                label={t(isHedge ? 'ps.st.vsForward' : 'ps.st.net')}
                value={chf(heroTw, true)}
                sub={
                  isHedge
                    ? t('ps.st.vsForwardSub', { p: chf(prodTw, true), f: chf(benchTw, true) })
                    : t(isCoupon ? 'ps.st.netSubCoupons' : 'ps.st.netSubGains', {
                        g: chf(benchTw),
                      })
                }
              />
              <StatRow
                label={t('ps.st.fixing')}
                sub={statusText}
                value={t('ps.st.fixingValue', { i: pState.passedActive, n: sim.rows.length })}
              />
              {isHedge && (
                <StatRow
                  label={t(buyer ? 'ps.st.bought' : 'ps.st.sold')}
                  sub={t('ps.st.needSub', {
                    need: usd(Math.abs(pState.need)),
                    ratio: pState.need ? fmtPct(Math.abs(pState.base / pState.need), lang, 0) : '–',
                  })}
                  value={usd(Math.abs(pState.base))}
                  highlight={Math.abs(pState.base) !== Math.abs(pState.need)}
                />
              )}
              {(kind === 'tarf' || kind === 'pivotTarf') && (
                <StatRow
                  label={t('ps.st.target')}
                  value={t('ps.st.targetValue', {
                    v: pipsTxt(pState.targetProgress / PIP, 0),
                    t: pipsTxt((product as { target: number }).target / PIP, 0),
                  })}
                  sub={statusText}
                />
              )}
              {isCoupon && (
                <StatRow
                  label={t('ps.st.coupons')}
                  value={t('ps.st.couponsValue', {
                    v: pState.targetProgress,
                    t: (product as { targetCoupons: number }).targetCoupons,
                  })}
                  sub={statusText}
                />
              )}
            </StatTable>
          ) : (
            <StatTable>
              <StatHero
                label={t('ps.ens.mean')}
                value={chf(ensSum.meanPnl, true)}
                sub={t('ps.ens.meanSub', { se: chf(ensSum.stdErr) })}
              />
              <StatRow
                label={t(`ps.ens.early.${earlyKey}`)}
                value={t('ps.ens.ofN', { v: earlyCount, n: ensSum.n })}
                sub={
                  ensSum.meanFixingsEarly !== null
                    ? t('ps.st.pEndSub', {
                        f: fmtNumber(ensSum.meanFixingsEarly, lang, { digits: 1 }),
                      })
                    : undefined
                }
              />
              <StatRow label={t('ps.ens.best')} value={chf(ensSum.best, true)} />
              <StatRow
                label={t('ps.ens.losses')}
                value={t('ps.ens.ofN', { v: ensSum.losses, n: ensSum.n })}
                sub={
                  ensSum.meanLoss !== null
                    ? t('ps.ens.lossesSub', { v: chf(ensSum.meanLoss) })
                    : undefined
                }
              />
              <StatRow label={t('ps.ens.worst')} value={chf(ensSum.worst, true)} highlight />
            </StatTable>
          )}

          <div class="ps-fair">
            <div class="ps-fair-title">{t('ps.st.fair')}</div>
            <StatTable>
              <StatRow label={fairRow.label} sub={fairRow.sub} value={fairRow.value} />
              <StatRow label={secondRow.label} sub={secondRow.sub} value={secondRow.value} />
              <StatRow
                label={t(`ps.st.pEnd.${earlyKey}`)}
                sub={
                  fairStats.earlyFixings !== null
                    ? t('ps.st.pEndSub', {
                        f: fmtNumber(fairStats.earlyFixings, lang, { digits: 1 }),
                      })
                    : undefined
                }
                value={fmtPct(fairStats.pEnd, lang, 1)}
              />
              <StatRow
                label={t('ps.st.q05')}
                sub={t('ps.st.q05Sub')}
                value={chf(fairStats.q05, true)}
                highlight
              />
              <StatRow
                label={t('ps.st.worst')}
                sub={t('ps.st.worstSub', { paths: count(fairStats.paths) })}
                value={chf(fairStats.worst, true)}
                highlight
              />
            </StatTable>
            <p class="ps-note">{fairStats.note}</p>
          </div>

          {adjustable && (
            <div class="panel ps-panel" data-param-panel>
              <div class="ps-param-row">
                <div class="ps-param-slider">
                  <Slider
                    id={`ps-${uid}-param`}
                    label={paramLabel}
                    value={pVal}
                    min={lo}
                    max={hi}
                    step={pStep}
                    valueText={paramText}
                    onInput={(v) => {
                      setParamClamped(v);
                      showEnd(days);
                    }}
                  />
                </div>
                <button
                  type="button"
                  class="ps-btn ps-btn--small"
                  disabled={param === undefined}
                  onClick={() => {
                    setParam(undefined);
                    showEnd(days);
                  }}
                  data-param-reset
                >
                  {t('ps.param.reset')}
                </button>
              </div>
              <div class="ps-pv" data-pv={pv.status}>
                <span class="ps-pv-label">{t('ps.pv')}</span>
                <span class="ps-pv-value mono">
                  {param === undefined
                    ? t('ps.pvFair')
                    : pv.status === 'done' && pv.res
                      ? chf(pv.res.pv, true)
                      : pv.status === 'error'
                        ? t('ps.pvError')
                        : t('ps.pvBusy')}
                </span>
                {param !== undefined && pv.status === 'done' && pv.res && (
                  <span class="ps-pv-sub">
                    {t('ps.pvSub', { se: chf(pv.res.stdErr), paths: count(pv.res.paths) })}
                  </span>
                )}
              </div>
              <p class="ps-hint">{t('ps.param.hint')}</p>
            </div>
          )}
          {view === 'ensemble' && (
            <div class="ps-reseed-row">
              <button type="button" class="ps-btn" onClick={reseed} data-reseed>
                <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
                  <path d="M3.5 8a4.5 4.5 0 1 0 1.4-3.3M3.5 2.8v2.6h2.6" class="ps-icon-stroke" />
                </svg>
                {t('ps.reseedEnsemble', { n: CFG.ensemble.paths })}
              </button>
              <span class="ps-seed">{t('ps.seed', { seed: ensSeed })}</span>
            </div>
          )}
          {view === 'ensemble' && (
            <p class="ps-note">{t('ps.ens.fairNote', { paths: count(fair.paths) })}</p>
          )}
        </div>
      </div>

      {view === 'path' && (
        <div class="ps-table-wrap">
          <div class="ps-table-title">{t('ps.tbl.title')}</div>
          <div
            ref={tableBox}
            class="ps-table-box ff-scroll-x"
            tabIndex={0}
            role="region"
            aria-label={t('ps.tbl.title')}
          >
            <table class="ff-table ps-table" data-cashflows>
              <caption class="sr-only">{t('ps.tbl.caption', { d: Math.round(tDay) })}</caption>
              <thead>
                <tr>
                  <th scope="col">{t('ps.tbl.fixing')}</th>
                  <th scope="col" class="num">
                    {t('ps.tbl.day')}
                  </th>
                  <th scope="col" class="num">
                    {t('ps.tbl.spot')}
                  </th>
                  <th scope="col">{t('ps.tbl.event')}</th>
                  <th scope="col" class="num">
                    {t('ps.tbl.usd')}
                  </th>
                  <th scope="col" class="num">
                    {t('ps.tbl.chf')}
                  </th>
                  <th scope="col" class="num">
                    {t('ps.tbl.pnl')}
                  </th>
                  <th scope="col" class="num">
                    {t(isHedge ? 'ps.tbl.bench.forward' : 'ps.tbl.bench.gains')}
                  </th>
                  <th scope="col" class="num">
                    {t('ps.tbl.cum')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {tableRows.length === 0 ? (
                  <tr>
                    <td colSpan={9} class="ps-empty">
                      {t('ps.tbl.empty')}
                    </td>
                  </tr>
                ) : (
                  tableRows.map((r) => (
                    <tr
                      key={`r${r.fixing}`}
                      class={`ps-row${r.active ? '' : ' is-off'}${r.leveraged ? ' is-lev' : ''}${r.event ? ` is-${r.event}` : ''}`}
                      data-row={r.fixing}
                    >
                      <td>{r.fixing}</td>
                      <td class="num">{r.day}</td>
                      <td class="num">{rate(r.spot)}</td>
                      <td>{eventCell(r)}</td>
                      <td class="num">
                        {r.amountBase ? fmtNumber(r.amountBase, lang, { sign: true }) : '–'}
                      </td>
                      <td class="num">
                        {r.amountQuote ? fmtNumber(r.amountQuote, lang, { sign: true }) : '–'}
                      </td>
                      <td class={`num ${r.pnl < 0 ? 'is-neg' : r.pnl > 0 ? 'is-pos' : ''}`}>
                        {r.active ? fmtNumber(r.pnl, lang, { sign: true }) : '–'}
                      </td>
                      <td class="num">
                        {r.bench ? fmtNumber(r.bench, lang, { sign: true }) : '–'}
                      </td>
                      <td class="num">{fmtNumber(r.cumPnl, lang, { sign: true })}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
