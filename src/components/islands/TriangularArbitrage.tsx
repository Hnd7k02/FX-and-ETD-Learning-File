/**
 * Triangular arbitrage (module 01, section 3): EUR/USD × USD/CHF against the direct EUR/CHF.
 *
 * A triangle of the three currencies with the quotes on its edges. Move a rate (sliders, or drag
 * the direct EUR/CHF quote on the zoomed ruler) until the direct quote leaves the band of the
 * cross rate via USD: the round trip appears, the money flows around the triangle and the profit
 * per EUR 1 Mio. counts up. Toggle bid/ask off to see that without spreads every gap pays.
 * Maths: triangularArbitrage in src/lib/fx/arbitrage.ts; setup in src/lib/m01/triangle.ts.
 */
import type { JSX } from 'preact';
import { useId, useRef, useState } from 'preact/hooks';
import { Segmented } from '@/components/ui/Segmented';
import { Slider } from '@/components/ui/Slider';
import { StatHero, StatTable } from '@/components/ui/Stat';
import { useElementWidth, usePrefersReducedMotion, useTween } from '@/components/ui/hooks';
import { triangular as dict } from '@/i18n/dict/triangular';
import { translator, type Lang } from '@/i18n/types';
import { clamp, scaleLinear } from '@/lib/chart';
import { fmtMillions, fmtMoney, fmtNumber, fmtRate } from '@/lib/format';
import { TRI_CONFIG as C, defaultMids, triState, type TriMids } from '@/lib/m01/triangle';
import { snap, useSvgDrag } from './m01-shared';

export interface TriangularArbitrageProps {
  lang: Lang;
}

const PIP = 1e-4;
const M = 1_000_000;
type Ccy = 'EUR' | 'USD' | 'CHF';

export default function TriangularArbitrage({ lang }: TriangularArbitrageProps): JSX.Element {
  const t = translator(dict, lang);
  const uid = useId().replace(/[^A-Za-z0-9_-]/g, '');
  const rm = usePrefersReducedMotion();
  const [mids, setMids] = useState<TriMids>(defaultMids());
  const [withSpread, setWithSpread] = useState(true);
  const box = useRef<HTMLDivElement>(null);
  const rulerRef = useRef<SVGSVGElement>(null);
  const W = Math.max(280, Math.round(useElementWidth(box, 600)));
  const compact = W < 520;

  const st = triState(mids, withSpread);
  const arb = st.direction !== 'none';
  const [profitShown] = useTween([st.profitPerEurMillion], 300, rm);
  const notional = fmtMillions(M, '', lang).trim();
  const money = (x: number, ccy: string) => fmtMoney(x, ccy, lang);
  const r4 = (x: number) => fmtRate(x, 'EUR/CHF');
  const q = st.quotes;
  const fs = compact ? 11 : 12;
  /** Room for an edge label ("0.8798 / 0.8802" in mono) so it never leaves the SVG. */
  const labelW = Math.ceil(15 * fs * 0.62) + 4;

  // ---------- triangle ----------
  const H = compact ? 250 : 290;
  const R = compact ? 24 : 28;
  const pos: Record<Ccy, [number, number]> = {
    EUR: [W / 2, R + 22],
    USD: [W * (compact ? 0.17 : 0.2), H - R - 30],
    CHF: [W * (compact ? 0.83 : 0.8), H - R - 30],
  };
  const edge = (a: Ccy, b: Ccy, shorten: number) => {
    const [x1, y1] = pos[a];
    const [x2, y2] = pos[b];
    const d = Math.hypot(x2 - x1, y2 - y1);
    const ux = (x2 - x1) / d;
    const uy = (y2 - y1) / d;
    return `M${(x1 + ux * shorten).toFixed(1)},${(y1 + uy * shorten).toFixed(1)}L${(x2 - ux * shorten).toFixed(1)},${(y2 - uy * shorten).toFixed(1)}`;
  };
  const cycle: Array<[Ccy, Ccy]> =
    st.direction === 'sellDirectBuyCross'
      ? [
          ['EUR', 'CHF'],
          ['CHF', 'USD'],
          ['USD', 'EUR'],
        ]
      : [
          ['EUR', 'USD'],
          ['USD', 'CHF'],
          ['CHF', 'EUR'],
        ];
  const amountAt: Partial<Record<Ccy, number>> = {};
  for (const leg of st.legs) amountAt[leg.receive.ccy as Ccy] = leg.receive.amount;
  const quoteText = (b: number, a: number, mid: number) =>
    withSpread ? t('quote', { bid: r4(b), ask: r4(a) }) : t('quoteMid', { mid: r4(mid) });

  // ---------- ruler ----------
  const RH = 108;
  const rl = 14;
  const rr = W - 14;
  const span = C.rulerPips;
  const rx = scaleLinear([-span, span], [rl, rr]);
  const pipsOf = (x: number) => (x - st.implied) / PIP;
  const ib = pipsOf(st.impliedBid);
  const ia = pipsOf(st.impliedAsk);
  const db = pipsOf(q.eurchf.bid);
  const da = pipsOf(q.eurchf.ask);
  const cx = (p: number) => rx(clamp(p, -span, span));
  const setDirect = (v: number) =>
    setMids((m) => ({ ...m, eurchf: snap(v, C.step, C.ranges.eurchf[0], C.ranges.eurchf[1]) }));
  const { dragging, handlers } = useSvgDrag(rulerRef, { width: W, height: RH }, 'x', (x) =>
    setDirect(st.implied + rx.invert(x) * PIP),
  );
  const gapLo =
    st.direction === 'sellDirectBuyCross' ? ia : st.direction === 'buyDirectSellCross' ? da : 0;
  const gapHi =
    st.direction === 'sellDirectBuyCross' ? db : st.direction === 'buyDirectSellCross' ? ib : 0;

  const aria = t('aria', {
    eurusd: r4(mids.eurusd),
    usdchf: r4(mids.usdchf),
    eurchf: r4(mids.eurchf),
    implied: fmtRate(st.implied, 'EUR/CHF', 5),
    result: arb ? t('ariaProfit', { profit: money(st.profitPerEurMillion, 'EUR') }) : t('ariaNone'),
  });
  const note = t(`note.${st.direction}`, {
    end: money(M + st.profitPerEurMillion, 'EUR'),
  });

  const sliders: Array<{ key: keyof TriMids; label: string }> = [
    { key: 'eurusd', label: t('eurusd') },
    { key: 'usdchf', label: t('usdchf') },
    { key: 'eurchf', label: t('eurchf') },
  ];

  return (
    <div
      class="tri"
      data-tri
      data-direction={st.direction}
      data-profit={st.profitPerEurMillion.toFixed(2)}
    >
      <div class="ff-lab-head">
        <div class="tri-head-text">
          <div class="ff-lab-title">{t('title')}</div>
          <div class="ff-lab-sub">{t('sub', { notional })}</div>
        </div>
        <span class="ff-pill-note tri-chip">{t('chip')}</span>
      </div>
      <div class="ff-lab">
        <div class="ff-lab-main" ref={box}>
          <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={aria} class="tri-svg">
            {/* edges */}
            {(
              [
                ['EUR', 'USD'],
                ['USD', 'CHF'],
                ['EUR', 'CHF'],
              ] as Array<[Ccy, Ccy]>
            ).map(([a, b]) => (
              <path
                key={a + b}
                d={edge(a, b, R + 4)}
                style={{ fill: 'none', stroke: 'var(--ff-axis)', strokeWidth: 2 }}
              />
            ))}
            {arb &&
              cycle.map(([a, b], i) => (
                <path
                  key={`${st.direction}-${a}${b}`}
                  d={edge(a, b, R + 8)}
                  class="tri-flow"
                  style={{
                    fill: 'none',
                    stroke: 'var(--ff-good)',
                    strokeWidth: 3,
                    strokeLinecap: 'round',
                    animationDelay: `${i * 120}ms`,
                  }}
                  marker-end={`url(#tri-arrow-${uid})`}
                />
              ))}
            <defs>
              <marker
                id={`tri-arrow-${uid}`}
                viewBox="0 0 10 10"
                refX="8"
                refY="5"
                markerWidth="5"
                markerHeight="5"
                orient="auto-start-reverse"
              >
                <path d="M0,0L10,5L0,10z" style={{ fill: 'var(--ff-good)' }} />
              </marker>
            </defs>
            {/* edge labels */}
            {(() => {
              const mid = (a: Ccy, b: Ccy): [number, number] => [
                (pos[a][0] + pos[b][0]) / 2,
                (pos[a][1] + pos[b][1]) / 2,
              ];
              const [lx, ly] = mid('EUR', 'USD');
              const [rx2, ry] = mid('EUR', 'CHF');
              const [bx, by] = mid('USD', 'CHF');
              const lbl = (
                x: number,
                y: number,
                anchor: string,
                title: string,
                val: string,
                sub?: string,
              ) => (
                <text x={x} y={y} style={{ fontSize: `${fs}px`, textAnchor: anchor }}>
                  <tspan x={x} style={{ fontWeight: 800, fill: 'var(--ff-ink)' }}>
                    {title}
                    {sub ? ` · ${sub}` : ''}
                  </tspan>
                  <tspan
                    x={x}
                    dy={fs + 5}
                    style={{
                      fontFamily: 'var(--ff-font-mono)',
                      fontWeight: 600,
                      fill: 'var(--ff-ink-2)',
                    }}
                  >
                    {val}
                  </tspan>
                </text>
              );
              return (
                <g>
                  {lbl(
                    Math.max(lx - 14, labelW),
                    ly - 4,
                    'end',
                    t('eurusd'),
                    quoteText(q.eurusd.bid, q.eurusd.ask, mids.eurusd),
                  )}
                  {lbl(
                    Math.min(rx2 + 14, W - labelW),
                    ry - 4,
                    'start',
                    'EUR/CHF',
                    quoteText(q.eurchf.bid, q.eurchf.ask, mids.eurchf),
                    t('direct'),
                  )}
                  {lbl(
                    bx,
                    by + 18,
                    'middle',
                    t('usdchf'),
                    quoteText(q.usdchf.bid, q.usdchf.ask, mids.usdchf),
                  )}
                </g>
              );
            })()}
            {/* nodes */}
            {(['EUR', 'USD', 'CHF'] as Ccy[]).map((c) => (
              <g key={c}>
                <circle
                  cx={pos[c][0]}
                  cy={pos[c][1]}
                  r={R}
                  style={{
                    fill: c === 'EUR' && arb ? 'var(--ff-good-soft)' : 'var(--ff-surface)',
                    stroke: arb ? 'var(--ff-good)' : 'var(--ff-ink)',
                    strokeWidth: 2,
                    transition: 'fill 300ms ease, stroke 300ms ease',
                  }}
                />
                <text
                  x={pos[c][0]}
                  y={pos[c][1] + 5}
                  style={{
                    fontSize: compact ? '13px' : '15px',
                    fontWeight: 800,
                    fill: 'var(--ff-ink)',
                    textAnchor: 'middle',
                  }}
                >
                  {c}
                </text>
              </g>
            ))}
            {/* amounts along the round trip */}
            {arb && (
              <g class="tri-amounts">
                <text
                  x={pos.EUR[0] + R + 10}
                  y={pos.EUR[1] - 4}
                  style={{ fontSize: `${fs}px`, fontWeight: 700, fill: 'var(--ff-ink-2)' }}
                >
                  {money(M, 'EUR')}
                </text>
                <text
                  x={pos.EUR[0] + R + 10}
                  y={pos.EUR[1] + fs + 2}
                  style={{ fontSize: `${fs}px`, fontWeight: 800, fill: 'var(--ff-good-text)' }}
                >
                  → {money(M + st.profitPerEurMillion, 'EUR')}
                </text>
                {(['USD', 'CHF'] as Ccy[]).map((c) => (
                  <text
                    key={c}
                    x={pos[c][0]}
                    y={pos[c][1] + R + fs + 6}
                    style={{
                      fontSize: `${fs}px`,
                      fontWeight: 700,
                      fill: 'var(--ff-ink-2)',
                      textAnchor: 'middle',
                    }}
                  >
                    {money(amountAt[c] ?? 0, c)}
                  </text>
                ))}
              </g>
            )}
          </svg>

          <div class="tri-ruler-title">{t('ruler')}</div>
          <svg
            ref={rulerRef}
            viewBox={`0 0 ${W} ${RH}`}
            role="img"
            aria-label={t('rulerAria', {
              ib: fmtRate(st.impliedBid, 'EUR/CHF', 5),
              ia: fmtRate(st.impliedAsk, 'EUR/CHF', 5),
              db: r4(q.eurchf.bid),
              da: r4(q.eurchf.ask),
              pips: fmtNumber(st.offsetPips, lang, { digits: 1, sign: true }),
            })}
            class="tri-svg tri-ruler"
          >
            <path d={`M${rl},42H${rr}`} style={{ stroke: 'var(--ff-axis)', strokeWidth: 1 }} />
            {[-span, -span / 2, 0, span / 2, span].map((p) => (
              <g key={p}>
                <path d={`M${rx(p)},38V46`} style={{ stroke: 'var(--ff-axis)', strokeWidth: 1 }} />
                <text
                  x={clamp(rx(p), rl + 18, rr - 18)}
                  y={102}
                  style={{ fontSize: `${fs}px`, fill: 'var(--ff-muted)', textAnchor: 'middle' }}
                >
                  {p === 0
                    ? t('implied', { rate: r4(st.implied) })
                    : compact && Math.abs(p) !== span
                      ? ''
                      : fmtNumber(p, lang, { sign: true })}
                </text>
              </g>
            ))}
            {/* cross band (via USD) */}
            <rect
              x={cx(ib)}
              y={20}
              width={Math.max(2, cx(ia) - cx(ib))}
              height={12}
              rx={4}
              style={{ fill: 'var(--ff-chip)', stroke: 'var(--ff-ink-2)', strokeWidth: 1.25 }}
            />
            <text
              x={cx((ib + ia) / 2)}
              y={14}
              style={{
                fontSize: `${fs}px`,
                fontWeight: 700,
                fill: 'var(--ff-ink-2)',
                textAnchor: 'middle',
              }}
            >
              {t('viaUsd')}
            </text>
            {/* gap */}
            {arb && (
              <rect
                x={cx(Math.min(gapLo, gapHi))}
                y={40}
                width={Math.max(0, cx(Math.max(gapLo, gapHi)) - cx(Math.min(gapLo, gapHi)))}
                height={4}
                style={{ fill: 'var(--ff-good)' }}
              />
            )}
            {/* direct quote, draggable */}
            <g class={`tri-direct${dragging ? ' is-active' : ''}`} data-handle {...handlers}>
              <rect
                x={cx(db) - 14}
                y={46}
                width={Math.max(28, cx(da) - cx(db) + 28)}
                height={44}
                style={{ fill: 'transparent' }}
              />
              <rect
                x={cx(db)}
                y={52}
                width={Math.max(3, cx(da) - cx(db))}
                height={12}
                rx={4}
                style={{
                  fill: arb ? 'var(--ff-good-soft)' : 'var(--ff-linear-soft)',
                  stroke: arb ? 'var(--ff-good)' : 'var(--ff-long)',
                  strokeWidth: 1.5,
                }}
              />
              <text
                x={clamp(cx((db + da) / 2), rl + 50, rr - 50)}
                y={80}
                style={{
                  fontSize: `${fs}px`,
                  fontWeight: 700,
                  fill: arb ? 'var(--ff-good-text)' : 'var(--ff-linear-text)',
                  textAnchor: 'middle',
                }}
              >
                {t('directQuote')}{' '}
                {t('gap', { pips: fmtNumber(st.offsetPips, lang, { digits: 1, sign: true }) })}
              </text>
            </g>
            {/* surface for drag anywhere on the ruler */}
            <rect
              x={rl}
              y={0}
              width={rr - rl}
              height={46}
              class="tri-surface"
              style={{ fill: 'transparent' }}
              {...handlers}
            />
          </svg>
          <p class="tri-hint">{t('drag')}</p>
        </div>
        <div class="ff-lab-side">
          <StatTable>
            <StatHero
              label={t('heroLabel')}
              value={money(profitShown ?? st.profitPerEurMillion, 'EUR')}
              sub={t('heroSub', { notional })}
            />
          </StatTable>
          <div class="panel">
            {sliders.map(({ key, label }) => (
              <Slider
                key={key}
                id={`tri-${key}-${uid}`}
                label={label}
                value={mids[key]}
                min={C.ranges[key][0]}
                max={C.ranges[key][1]}
                step={C.step}
                valueText={r4(mids[key])}
                onInput={(v) =>
                  setMids((m) => ({
                    ...m,
                    [key]: snap(v, C.step, C.ranges[key][0], C.ranges[key][1]),
                  }))
                }
              />
            ))}
            <div class="tri-row">
              <Segmented
                label={t('spreads')}
                options={[
                  { value: 'on', label: t('spreads.on') },
                  { value: 'off', label: t('spreads.off') },
                ]}
                value={withSpread ? 'on' : 'off'}
                onChange={(v) => setWithSpread(v === 'on')}
              />
              <button
                type="button"
                class="btn btn-light tri-reset"
                data-reset
                onClick={() =>
                  setMids((m) => ({ ...m, eurchf: snap(m.eurusd * m.usdchf, C.step, 0, 10) }))
                }
              >
                {t('reset')}
              </button>
            </div>
          </div>
          <div class="tri-legs" data-legs>
            <div class="tri-legs-title">{t('legs')}</div>
            {arb ? (
              <ol>
                {st.legs.map((leg, i) => (
                  <li key={leg.pair}>
                    <span class="tri-leg-head">
                      {t('leg', {
                        n: i + 1,
                        pair: leg.pair,
                        side: t(`side.${leg.side}`),
                        base: leg.pair.slice(0, 3),
                        rate: r4(leg.rate),
                      })}
                    </span>
                    <span class="tri-leg-flow mono">
                      {t('legFlow', {
                        pay: money(leg.pay.amount, leg.pay.ccy),
                        receive: money(leg.receive.amount, leg.receive.ccy),
                      })}
                    </span>
                  </li>
                ))}
              </ol>
            ) : (
              <p class="tri-nolegs">{t('noLegs', { notional })}</p>
            )}
          </div>
          <p class={`tri-note${arb ? ' is-arb' : ''}`} data-note aria-live="polite">
            {note}
            {!withSpread && st.direction !== 'none' ? ` ${t('noSpreadNote')}` : ''}
          </p>
        </div>
      </div>
    </div>
  );
}
