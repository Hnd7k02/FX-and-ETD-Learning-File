/**
 * Building blocks of a structured product (module 08): the payoff of ONE fixing against the
 * fixing rate, split into its options. For the strike products a three-step story shows how a
 * "better rate than the forward" is built: forward → a second sold option (closed-form strike)
 * → knock-out or target (Monte Carlo strike with standard error). Lines morph between the
 * steps; a fixing marker can be dragged to read gains and leveraged losses.
 *
 * Props (serialisable, set on StructureBlocksFigure.astro):
 * - lang: 'de' | 'en'.
 * - products?: product kinds offered (accumulator, decumulator, tarf, pivotTarf, tpf, rtpf);
 *   default ['accumulator'].
 * - initial?: product shown first.
 * - step?: 1 | 2 | 3 first story step (default 1).
 * - autoplay?: false keeps the story still (it never plays under reduced motion).
 * - fixing?: initial fixing rate of the marker (default 7 % below spot).
 *
 * Maths in src/lib/structures.ts, strings in src/i18n/dict/structureblocks.ts.
 */
import type { JSX } from 'preact';
import { useEffect, useId, useMemo, useRef, useState } from 'preact/hooks';
import { GridY } from '@/components/ui/Chart';
import { Legend, type LegendItem } from '@/components/ui/Legend';
import { Slider } from '@/components/ui/Slider';
import {
  useElementWidth,
  useInView,
  usePrefersReducedMotion,
  useTween,
} from '@/components/ui/hooks';
import { structureblocks as dict } from '@/i18n/dict/structureblocks';
import { translator, type Lang } from '@/i18n/types';
import { clamp, linePath, niceTicks, scaleLinear, type Point } from '@/lib/chart';
import { EXAMPLE, EXAMPLE_LABEL } from '@/lib/fx/example';
import { MC_PRODUCTS } from '@/lib/fx/mc/fair';
import { PIP } from '@/lib/fx/mc/products';
import { fmtMoney, fmtNumber, fmtPips, fmtRate } from '@/lib/format';
import { isSimKind, type SimKind } from '@/lib/pathsim';
import {
  STORY_STEPS,
  blockValue,
  forwardAvg,
  fullStage,
  hasStory,
  lerpStage,
  stagePayoff,
  stageSamples,
  storyStages,
  type BlockLine,
  type Stage,
} from '@/lib/structures';

export interface StructureBlocksProps {
  lang: Lang;
  products?: string[];
  initial?: string;
  step?: number;
  autoplay?: boolean;
  fixing?: number;
}

const PAIR = EXAMPLE.pair;
/** Seconds per story step in autoplay (choice). */
const STEP_MS = 4200;
/** Fixing range of the chart, relative to spot (choice). */
const X_RANGE: [number, number] = [EXAMPLE.spot * 0.9, EXAMPLE.spot * 1.1];
const SAMPLES = 140;
/** Initial fixing of the readout marker: 7 % below spot, where the double amount hurts. */
const FIXING_DEFAULT = EXAMPLE.spot * 0.93;

function layoutFor(w: number) {
  const width = Math.max(280, Math.round(w));
  const compact = width < 560;
  return {
    width,
    compact,
    font: compact ? 11 : 12,
    left: compact ? 52 : 62,
    right: compact ? 12 : 18,
    top: 30,
    height: compact ? 280 : Math.round(clamp(width * 0.5, 300, 380)),
    axis: 46,
  };
}

export default function StructureBlocks(props: StructureBlocksProps): JSX.Element {
  const { lang } = props;
  const t = translator(dict, lang);
  const uid = useId().replace(/[^A-Za-z0-9_-]/g, '');
  const rm = usePrefersReducedMotion();
  const products = useMemo<SimKind[]>(() => {
    const list = (props.products ?? []).filter(isSimKind);
    return list.length ? list : ['accumulator'];
  }, [props.products?.join()]);
  const [kind, setKind] = useState<SimKind>(
    isSimKind(props.initial) && products.includes(props.initial) ? props.initial : products[0]!,
  );
  const story = hasStory(kind);
  const stages: Stage[] = useMemo(
    () => (hasStory(kind) ? storyStages(kind) : [fullStage(kind)]),
    [kind],
  );
  const last = stages.length - 1;
  const [step, setStep] = useState(() => clamp(Math.round((props.step ?? 1) - 1), 0, 2));
  const [blocks, setBlocks] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [started, setStarted] = useState(false);
  const [fixing, setFixing] = useState(() =>
    clamp(props.fixing ?? FIXING_DEFAULT, X_RANGE[0], X_RANGE[1]),
  );
  const [drag, setDrag] = useState(false);
  const dragId = useRef<number | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const L = layoutFor(useElementWidth(box, 640));
  const inView = useInView(root);
  const stepNow = Math.min(step, last);

  /* ---------- autoplay through the story (once, when first visible) ---------- */
  useEffect(() => {
    if (started || !inView) return;
    setStarted(true);
    if (story && !rm && props.autoplay !== false && stepNow < last) setPlaying(true);
  }, [inView, rm]);
  useEffect(() => {
    if (!playing || !inView) return;
    const id = setTimeout(() => {
      setStep((s) => {
        const next = Math.min(last, s + 1);
        if (next >= last) setPlaying(false);
        return next;
      });
    }, STEP_MS);
    return () => clearTimeout(id);
  }, [playing, inView, step, last]);

  const pos = useTween(stepNow, 700, rm);
  const lo = Math.floor(clamp(pos, 0, last));
  const hi = Math.min(last, lo + 1);
  const stage = lerpStage(stages[lo]!, stages[hi]!, clamp(pos - lo, 0, 1));
  const full = stages[last]!;
  const featureAlpha = story ? clamp(pos - (last - 1), 0, 1) : 1;
  const N = stage.notional;
  const buyer = kind !== 'decumulator';
  const F = forwardAvg(kind);
  const fwdValue = (S: number) => (buyer ? S - F : F - S) * N;

  /* ---------- scales (y fixed per product so the steps compare) ---------- */
  const domain = useMemo<[number, number]>(() => {
    let lo2 = 0;
    let hi2 = 0;
    for (const st of stages) {
      for (const [x, y] of stageSamples(st, X_RANGE[0], X_RANGE[1], 60)) {
        lo2 = Math.min(lo2, y);
        hi2 = Math.max(hi2, y);
        if (story) {
          lo2 = Math.min(lo2, fwdValue(x));
          hi2 = Math.max(hi2, fwdValue(x));
        }
      }
    }
    const span = hi2 - lo2 || 1;
    return [lo2 - span * 0.06, hi2 + span * 0.1];
  }, [stages]);
  const xs = scaleLinear(X_RANGE, [L.left, L.width - L.right]);
  const plotBottom = L.height - L.axis;
  const ys = scaleLinear(domain, [plotBottom, L.top]);
  const yTicks = niceTicks(domain[0], domain[1], L.compact ? 4 : 6).filter(
    (v) => v >= domain[0] && v <= domain[1],
  );
  const xTicks = niceTicks(X_RANGE[0], X_RANGE[1], L.compact ? 4 : 6).filter(
    (v) => v > X_RANGE[0] && v < X_RANGE[1],
  );

  /* ---------- formatting ---------- */
  const chf = (x: number, sign = true) => fmtMoney(x, EXAMPLE.quote, lang, 0, sign);
  const rate = (x: number) => fmtRate(x, PAIR);
  const pipsTxt = (x: number, d = 1) => fmtPips(x, lang, d);
  const productName = t(`sb.p.${kind}`);
  const fullKind = kind === 'tarf' ? 'target' : 'ko';
  const stepLabel = (i: number) =>
    t(i === 0 ? 'sb.step.forward' : i === 1 ? 'sb.step.leveraged' : `sb.step.full.${fullKind}`);

  /* ---------- texts ---------- */
  const se = fmtNumber(MC_PRODUCTS.products[kind].stdErrPips, lang, { digits: 1 });
  const nText = fmtMoney(N, EXAMPLE.base, lang);
  const text = (() => {
    if (!story) {
      const p = full as Stage;
      const prod = MC_PRODUCTS.products[kind].product as unknown as Record<string, number>;
      if (kind === 'pivotTarf') {
        return t('sb.text.pivotTarf', {
          k1: rate(prod.lowerStrike!),
          k2: rate(prod.upperStrike!),
          p: rate(prod.pivot!),
          target: pipsTxt(prod.target! / PIP, 0),
        });
      }
      if (kind === 'tpf') {
        return t('sb.text.tpf', { c: pipsTxt(prod.coupon! / PIP), k: rate(p.strike) });
      }
      return t('sb.text.rtpf', {
        c: pipsTxt(prod.coupon! / PIP),
        l: rate(prod.lower!),
        u: rate(prod.upper!),
      });
    }
    const st = stages[stepNow]!;
    const side = buyer ? 'buy' : 'sell';
    if (stepNow === 0) return t(`sb.text.forward.${side}`, { n: nText, f: rate(F) });
    if (stepNow === 1) {
      return t(`sb.text.leveraged.${side}`, {
        k: rate(st.strike),
        d: pipsTxt(Math.abs(st.strike - F) / PIP),
      });
    }
    const prod = MC_PRODUCTS.products[kind].product as unknown as Record<string, number>;
    return fullKind === 'ko'
      ? t('sb.text.full.ko', { b: rate(prod.barrier!), k: rate(st.strike), se })
      : t('sb.text.full.target', {
          target: pipsTxt(prod.target! / PIP, 0),
          k: rate(st.strike),
          se,
        });
  })();

  /* ---------- drawing ---------- */
  const productD = linePath(
    stageSamples(stage, X_RANGE[0], X_RANGE[1], SAMPLES).map(([x, y]): Point => [xs(x), ys(y)]),
  );
  const forwardD = linePath([
    [xs(X_RANGE[0]), ys(fwdValue(X_RANGE[0]))],
    [xs(X_RANGE[1]), ys(fwdValue(X_RANGE[1]))],
  ]);
  const blockD = (b: BlockLine) =>
    linePath(
      stageSamples({ ...stage, blocks: [b], knockOut: null }, X_RANGE[0], X_RANGE[1], 80).map(
        ([x]): Point => [xs(x), ys(blockValue(b, x) * N)],
      ),
    );
  const ko = full.knockOut;
  const koX0 = ko ? xs(clamp(ko.from, X_RANGE[0], X_RANGE[1])) : 0;
  const koX1 = ko ? xs(clamp(ko.to, X_RANGE[0], X_RANGE[1])) : 0;
  const targetY = full.target?.kind === 'pips' ? ys(full.target.value * N) : null;
  const fs = `${L.font}px`;
  const halo = {
    paintOrder: 'stroke',
    stroke: '#fff',
    strokeWidth: 4,
    strokeLinejoin: 'round',
  } as const;
  const clipId = `sb-clip-${uid}`;

  const prodAt = stagePayoff(stage, fixing);
  const inKo = !!stage.knockOut && fixing >= stage.knockOut.from && fixing <= stage.knockOut.to;
  const readout = inKo
    ? t('sb.readoutKo', { s: rate(fixing), product: productName })
    : story
      ? t('sb.readout', {
          s: rate(fixing),
          f: chf(fwdValue(fixing)),
          product: productName,
          p: chf(prodAt),
        })
      : t('sb.readoutNoFwd', { s: rate(fixing), product: productName, p: chf(prodAt) });
  const aria = t('sb.aria', {
    product: productName,
    step: story ? `${stepNow + 1} · ${stepLabel(stepNow)}` : '–',
    k: rate(stages[stepNow]!.strike),
    s: rate(fixing),
    p: inKo ? t('sb.ko') : chf(prodAt),
  });

  const legend: LegendItem[] = [
    { label: t('sb.lg.product'), color: 'var(--ff-forward)' },
    ...(story
      ? [{ label: t('sb.lg.forward'), color: 'var(--ff-ref)', kind: 'dashed' as const, width: 2 }]
      : []),
    ...(blocks
      ? [
          { label: t('sb.lg.bought'), color: 'rgba(37, 99, 235, 0.6)', width: 2 },
          { label: t('sb.lg.sold'), color: 'rgba(234, 88, 12, 0.65)', width: 2 },
        ]
      : []),
  ];

  /* ---------- pointer: drag the fixing ---------- */
  const toRate = (clientX: number) => {
    const el = svgRef.current;
    if (!el) return fixing;
    const r = el.getBoundingClientRect();
    const x = xs.invert(((clientX - r.left) * L.width) / Math.max(1, r.width));
    return clamp(Math.round(x / 0.0005) * 0.0005, X_RANGE[0], X_RANGE[1]);
  };
  const onDown = (e: PointerEvent) => {
    e.preventDefault();
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    dragId.current = e.pointerId;
    setDrag(true);
    setFixing(toRate(e.clientX));
  };
  const onMove = (e: PointerEvent) => {
    if (dragId.current === e.pointerId) setFixing(toRate(e.clientX));
  };
  const onUp = (e: PointerEvent) => {
    if (dragId.current !== e.pointerId) return;
    dragId.current = null;
    setDrag(false);
  };

  const goStep = (i: number) => {
    setPlaying(false);
    setStep(i);
  };
  const ladderValue = (i: number) => {
    const st = stages[i]!;
    const d = (st.strike - F) / PIP;
    if (i === 0) return rate(st.strike);
    const base = `${rate(st.strike)} · ${t('sb.pipsDiff', { v: pipsTxt(d, 1) })}`;
    return i === last ? `${base} · ± ${se}` : base;
  };
  const blockLabelPos = (b: BlockLine): [number, number, 'start' | 'end'] => {
    // calls rise to the right, puts to the left: label at the end where the line is away from 0
    const right = b.shape === 'call' || b.shape === 'digitalCall' || b.shape === 'rangeDigital';
    const xr = right
      ? X_RANGE[1] - (X_RANGE[1] - X_RANGE[0]) * 0.02
      : X_RANGE[0] + (X_RANGE[1] - X_RANGE[0]) * 0.02;
    const xm = b.shape === 'rangeDigital' ? (b.level + (b.upper ?? b.level)) / 2 : xr;
    const y = blockValue(b, xm) * N;
    return [
      xs(xm),
      ys(y) + (b.sign > 0 ? -8 : 16),
      b.shape === 'rangeDigital' ? 'start' : right ? 'end' : 'start',
    ];
  };

  return (
    <div class="sb" ref={root} data-sb data-product={kind} data-step={stepNow + 1}>
      <div class="ff-lab-head">
        <div class="sb-head-text">
          <div class="ff-lab-title">
            {story ? t('sb.title') : t('sb.titleBlocks', { product: productName })}
          </div>
          <div class="ff-lab-sub">{t('sb.sub', { n: nText, label: EXAMPLE_LABEL[lang] })}</div>
        </div>
        {products.length > 1 && (
          <div class="sb-chips" role="group" aria-label={t('sb.products')}>
            {products.map((k) => (
              <button
                key={k}
                type="button"
                class="sb-chip"
                aria-pressed={k === kind}
                onClick={() => {
                  setKind(k);
                  setPlaying(false);
                  setStep(hasStory(k) ? 0 : 0);
                }}
              >
                {t(`sb.p.${k}`)}
              </button>
            ))}
          </div>
        )}
      </div>

      {story && (
        <div class="sb-steps-row">
          <button
            type="button"
            class="sb-round"
            onClick={() => {
              if (playing) setPlaying(false);
              else {
                if (stepNow >= last) setStep(0);
                setPlaying(true);
              }
            }}
            aria-label={playing ? t('sb.pause') : t('sb.play')}
            aria-pressed={playing}
            data-play
          >
            {playing ? (
              <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
                <path d="M5 3.5V12.5M11 3.5V12.5" class="sb-icon-stroke" />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
                <path d="M5 3.2L12.5 8L5 12.8Z" class="sb-icon-fill" />
              </svg>
            )}
          </button>
          <ol class="sb-steps" aria-label={t('sb.steps')}>
            {STORY_STEPS.map((_, i) => (
              <li key={`s${i}`}>
                <button
                  type="button"
                  class="sb-step"
                  aria-pressed={i === stepNow}
                  aria-current={i === stepNow ? 'step' : undefined}
                  onClick={() => goStep(i)}
                  data-step-btn={i + 1}
                >
                  <span class="sb-step-n" aria-hidden="true">
                    {i + 1}
                  </span>
                  <span class="sb-step-text">
                    <span class="sb-step-label">{stepLabel(i)}</span>
                    <span class="sb-step-value mono">{ladderValue(i)}</span>
                  </span>
                  {playing && i === stepNow + 1 && (
                    <span class="sb-progress" aria-hidden="true" key={`p${stepNow}`} />
                  )}
                </button>
              </li>
            ))}
          </ol>
        </div>
      )}
      <p class="sb-text" key={`${kind}-${stepNow}`} data-step-text>
        {text}
      </p>

      <div class="sb-legend-row">
        <Legend items={legend} />
        <label class="sb-toggle">
          <input
            type="checkbox"
            checked={blocks}
            onChange={(e) => setBlocks((e.currentTarget as HTMLInputElement).checked)}
          />
          <span>{t('sb.blocks')}</span>
        </label>
      </div>

      <div ref={box} class="sb-chart">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${L.width} ${L.height}`}
          role="img"
          aria-label={aria}
          class={`sb-svg${drag ? ' is-dragging' : ''}`}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
          data-sb-chart
        >
          <defs>
            <clipPath id={clipId}>
              <rect
                x={L.left}
                y={L.top - 4}
                width={L.width - L.left - L.right}
                height={plotBottom - L.top + 8}
              />
            </clipPath>
          </defs>
          {ko && (
            <g style={{ opacity: featureAlpha }}>
              <rect
                x={koX0}
                y={L.top}
                width={Math.max(0, koX1 - koX0)}
                height={plotBottom - L.top}
                class="sb-ko"
              />
              <text
                x={buyer ? koX0 + 6 : koX1 - 6}
                y={L.top + L.font + 4}
                class="sb-ko-label"
                style={{ fontSize: fs, textAnchor: buyer ? 'start' : 'end', ...halo }}
              >
                {t('sb.ko')}
              </text>
            </g>
          )}
          <GridY
            y={ys}
            ticks={yTicks}
            x0={L.left}
            x1={L.width - L.right}
            format={(v) => fmtNumber(v, lang, { sign: true })}
            fontSize={L.font}
          />
          <text x={L.left} y={L.top - 14} class="sb-axis-title" style={{ fontSize: fs }}>
            {t('sb.y')}
          </text>
          {targetY !== null && (
            <g style={{ opacity: featureAlpha }}>
              <path d={`M${L.left},${targetY.toFixed(1)}H${L.width - L.right}`} class="sb-target" />
              <text
                x={L.left + 6}
                y={targetY - 6}
                class="sb-target-label"
                style={{ fontSize: fs, ...halo }}
              >
                {t('sb.targetLine')}
              </text>
            </g>
          )}
          <g clip-path={`url(#${clipId})`}>
            {story && <path d={forwardD} class="sb-forward" />}
            {blocks &&
              stage.blocks.map((b, i) => (
                <path
                  key={`b${i}`}
                  d={blockD(b)}
                  class={b.sign > 0 ? 'sb-block sb-block--long' : 'sb-block sb-block--short'}
                />
              ))}
            <path d={productD} class="sb-product" />
          </g>
          {blocks &&
            stage.blocks.map((b, i) => {
              const [bx, by, anchor] = blockLabelPos(b);
              const name = t(`sb.b.${b.key}` as Parameters<typeof t>[0]);
              const label =
                Math.abs(b.ratio - 1) < 0.05
                  ? name
                  : t('sb.ratio', {
                      r: fmtNumber(b.ratio, lang, {
                        digits: Math.abs(b.ratio - Math.round(b.ratio)) < 0.05 ? 0 : 1,
                      }),
                      name,
                    });
              return (
                <text
                  key={`bl${i}`}
                  x={bx}
                  y={clamp(by, L.top + L.font, plotBottom - 4)}
                  class={
                    b.sign > 0
                      ? 'sb-block-label sb-block-label--long'
                      : 'sb-block-label sb-block-label--short'
                  }
                  style={{ fontSize: fs, textAnchor: anchor, ...halo }}
                >
                  {label}
                </text>
              );
            })}

          {/* strike and forward markers on the x axis */}
          {story && (
            <g>
              <path d={`M${xs(F).toFixed(1)},${L.top}V${plotBottom}`} class="sb-ref sb-ref--fwd" />
              <rect
                x={xs(F) - 34}
                y={L.top - 10}
                width={68}
                height={20}
                rx={10}
                class="sb-pill sb-pill--fwd"
              />
              <text
                x={xs(F)}
                y={L.top + L.font * 0.36}
                class="sb-pill-text"
                style={{ fontSize: fs, textAnchor: 'middle' }}
              >
                {`F ${rate(F)}`}
              </text>
            </g>
          )}
          <path d={`M${xs(stage.strike).toFixed(1)},${L.top}V${plotBottom}`} class="sb-ref" />
          <g>
            <rect
              x={xs(stage.strike) - 34}
              y={plotBottom + 4}
              width={68}
              height={20}
              rx={10}
              class="sb-pill"
            />
            <text
              x={xs(stage.strike)}
              y={plotBottom + 14 + L.font * 0.36}
              class="sb-pill-text sb-pill-text--k"
              style={{ fontSize: fs, textAnchor: 'middle' }}
            >
              {`${kind === 'pivotTarf' ? 'P' : 'K'} ${rate(stage.strike)}`}
            </text>
          </g>

          {/* fixing marker */}
          <g class="sb-marker">
            <path d={`M${xs(fixing).toFixed(1)},${L.top}V${plotBottom}`} class="sb-marker-line" />
            {story && (
              <circle cx={xs(fixing)} cy={ys(fwdValue(fixing))} r={4.5} class="sb-dot-fwd" />
            )}
            <circle cx={xs(fixing)} cy={ys(prodAt)} r={6} class="sb-dot" />
          </g>
          {xTicks.map((v) =>
            Math.abs(xs(v) - xs(stage.strike)) < 56 ? null : (
              <text
                key={`x${v}`}
                x={xs(v)}
                y={L.height - 6}
                style={{ fontSize: fs, fill: 'var(--ff-muted)', textAnchor: 'middle' }}
              >
                {fmtRate(v, PAIR, 2)}
              </text>
            ),
          )}
        </svg>
      </div>
      <p class="sb-readout" data-readout aria-live="polite">
        {readout}
      </p>
      <div class="sb-fixing">
        <Slider
          id={`sb-${uid}-fix`}
          label={t('sb.fixing')}
          value={fixing}
          min={X_RANGE[0]}
          max={X_RANGE[1]}
          step={0.0005}
          valueText={rate(fixing)}
          onInput={(v) => setFixing(v)}
        />
        <span class="sb-hint">{t('sb.dragHint')}</span>
      </div>
    </div>
  );
}
