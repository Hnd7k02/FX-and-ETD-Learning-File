/**
 * SwapCompare (module 03, section 4): FX swap versus cross-currency swap (CCS) for a firm that
 * holds CHF and needs USD 1 Mio. for a period. Two cash-flow diagrams on the same time axis
 * (up = receive, blue; down = pay, orange; interest payments as thinner outer segments): the FX
 * swap exchanges twice and gives back fewer CHF at the end (dashed ghost = the interest
 * differential sitting in the far rate); the CCS pays interest along the way and re-exchanges at
 * the starting rate. A numerical check shows that both cost the same in present value (no
 * basis). Controls: tenor and a highlight (notional, interest, re-exchange rate) that also marks
 * the matching row of the comparison table.
 * Maths in src/lib/m03/compare.ts, strings in src/i18n/dict/swapcompare.ts.
 */
import type { JSX } from 'preact';
import { useRef, useState } from 'preact/hooks';
import { Segmented } from '@/components/ui/Segmented';
import { useElementWidth, usePrefersReducedMotion, useTween } from '@/components/ui/hooks';
import { swapcompare as dict } from '@/i18n/dict/swapcompare';
import { translator, type Lang } from '@/i18n/types';
import { fmtMillions, fmtMoney, fmtNumber, fmtPct, fmtPips, fmtRate } from '@/lib/format';
import { compareSwaps, type Flow } from '@/lib/m03/compare';
import { M03_CONFIG, tenorById } from '@/lib/m03/config';
import { fitCentre, textWidth } from '@/lib/m03/text';
import { EXAMPLE_MARKET as MK } from '@/lib/m03/trip';

export interface SwapCompareProps {
  lang: Lang;
  /** Start tenor id (default from the config). */
  tenor?: string;
}

type Focus = 'all' | 'notional' | 'interest' | 'rate';

const C = M03_CONFIG;
const K = C.compare;
const PAIR = C.market.pair;
const RD = C.rateDigits;
const N = C.market.notional;

function layoutFor(w: number) {
  const width = Math.max(300, Math.round(w));
  const compact = width < 560;
  const font = compact ? 11 : 12;
  const LN = compact ? 36 : 46;
  const LC = compact ? 13 : 17;
  const top = 20;
  const axisY = top + LN + LC;
  const height = axisY + LN + LC + 40;
  return {
    width,
    height,
    compact,
    font,
    LN,
    LC,
    axisY,
    x0: compact ? 48 : 70,
    xT: width - (compact ? 48 : 70),
    dx: compact ? 6 : 8,
  };
}

/** Receive (+) flows point up; a zero CHF coupon counts as "up" (it would be received). */
function isReceive(total: number, ccy: Flow['ccy']): boolean {
  if (Math.abs(total) * 2 < 1) return ccy === 'quote';
  return total > 0;
}

interface Seg {
  len: number;
  kind: 'notional' | 'coupon' | 'ghost';
}

/** Arrow of stacked segments from the axis: up for receive (+), down for pay (−). */
function StackArrow(p: { x: number; y0: number; segs: Seg[]; up: boolean }): JSX.Element {
  const dir = p.up ? -1 : 1;
  let y = p.y0;
  const parts: JSX.Element[] = [];
  let tip = y;
  p.segs.forEach((s, i) => {
    if (s.len <= 0.2) return;
    const y2 = y + dir * s.len;
    parts.push(
      <path
        key={i}
        d={`M${p.x.toFixed(1)},${y.toFixed(1)}V${y2.toFixed(1)}`}
        class={`m3-seg is-${s.kind} ${p.up ? 'is-in' : 'is-out'}`}
      />,
    );
    if (s.kind !== 'ghost') tip = y2;
    y = y2;
  });
  const head = Math.abs(tip - p.y0) > 8;
  return (
    <g>
      {parts}
      {head && (
        <path
          d={`M${(p.x - 4.5).toFixed(1)},${(tip - dir * 7).toFixed(1)}L${p.x.toFixed(1)},${tip.toFixed(1)}L${(p.x + 4.5).toFixed(1)},${(tip - dir * 7).toFixed(1)}`}
          class={`m3-seg-head ${p.up ? 'is-in' : 'is-out'}`}
        />
      )}
    </g>
  );
}

export default function SwapCompare({ lang, tenor: tenorProp }: SwapCompareProps): JSX.Element {
  const t = translator(dict, lang);
  const rm = usePrefersReducedMotion();
  const box = useRef<HTMLDivElement>(null);
  const L = layoutFor(useElementWidth(box, 640));
  const [tenorId, setTenorId] = useState<string>(tenorProp ?? K.defaultTenor);
  const [focus, setFocus] = useState<Focus>('all');
  const [touched, setTouched] = useState(false);

  const tenor = tenorById(K.tenors, tenorId);
  const cmp = compareSwaps(MK, tenor.days);
  const nCoupons = cmp.periods.length;
  // the far CHF arrow of the FX swap shrinks with F / S (tweened)
  const farRatio = useTween(cmp.fxSwap.endRate / MK.spot, 300, rm);
  const usd = (z: number, sign = true) => fmtMoney(z, C.market.base, lang, 0, sign);
  const chf = (z: number, sign = true) => fmtMoney(z, C.market.quote, lang, 0, sign);
  const nearTxt = fmtRate(MK.spot, PAIR);
  const farTxt = fmtRate(cmp.fxSwap.endRate, PAIR, RD);
  const pipsTxt = fmtPips(cmp.swapPoints, lang, 1, true);
  const notional = fmtMillions(N, '', lang).trim();
  const fs = `${L.font}px`;
  const xAt = (day: number) => L.x0 + ((L.xT - L.x0) * day) / tenor.days;

  /** Groups flows by date and currency; returns segments and the total for labels. */
  const groups = (flows: Flow[]) => {
    const map = new Map<string, { day: number; ccy: Flow['ccy']; segs: Seg[]; total: number }>();
    for (const f of flows) {
      const key = `${f.day}-${f.ccy}`;
      const g = map.get(key) ?? { day: f.day, ccy: f.ccy, segs: [], total: 0 };
      const full = f.ccy === 'base' ? N : N * MK.spot;
      const len =
        f.kind === 'notional'
          ? L.LN * Math.min(1, Math.abs(f.amount) / full)
          : Math.abs(f.amount) > 0.5
            ? L.LC
            : 0;
      g.segs.push({ len, kind: f.kind });
      g.total += f.amount;
      map.set(key, g);
    }
    return [...map.values()];
  };

  const diagram = (which: 'fx' | 'ccs') => {
    const flows = which === 'fx' ? cmp.fxSwap.flows : cmp.ccs.flows;
    const gs = groups(flows);
    let couponLabelled = false;
    return gs.map((g) => {
      const x = xAt(g.day) + (g.ccy === 'base' ? -L.dx : L.dx);
      const up = isReceive(g.total, g.ccy);
      let segs = g.segs;
      // FX swap far CHF: shrink with the tweened ratio, add the ghost of the missing part
      if (which === 'fx' && g.day === tenor.days && g.ccy === 'quote') {
        const len = L.LN * farRatio;
        segs = [
          { len, kind: 'notional' },
          { len: Math.max(0, L.LN - len), kind: 'ghost' },
        ];
      }
      const len = segs.reduce((a, s) => a + (s.kind === 'ghost' ? 0 : s.len), 0);
      const isEnd = g.day === 0 || g.day === tenor.days;
      const showLabel =
        isEnd || (!L.compact && !couponLabelled && Math.abs(g.total) > 0.5 && g.ccy === 'base');
      if (!isEnd && showLabel) couponLabelled = true;
      const text = g.ccy === 'base' ? usd(g.total) : chf(g.total);
      const w = textWidth(text, L.font, 0.6) + 4;
      const cx = fitCentre(x, w, 2, L.width - 2);
      const ly = up ? L.axisY - len - 7 : L.axisY + len + L.font + 5;
      return (
        <g key={`${g.day}-${g.ccy}`}>
          {Math.abs(g.total) < 0.5 && !isEnd ? (
            <circle cx={x} cy={L.axisY} r={2.5} class="m3-zero-dot" />
          ) : (
            <StackArrow x={x} y0={L.axisY} segs={segs} up={up} />
          )}
          {showLabel && Math.abs(g.total) > 0.5 && (
            <text
              x={cx}
              y={ly}
              class={`m3-flow-label ${up ? 'is-in' : 'is-out'}`}
              style={{ fontSize: fs }}
            >
              {text}
            </text>
          )}
        </g>
      );
    });
  };

  const axis = (
    <g>
      <path d={`M${L.x0 - 24},${L.axisY}H${L.xT + 30}`} class="m3-axis" />
      <path
        d={`M${L.xT + 22},${L.axisY - 5}L${L.xT + 30},${L.axisY}L${L.xT + 22},${L.axisY + 5}`}
        class="m3-axis"
      />
      {cmp.periods.length > 1 &&
        cmp.periods.slice(0, -1).map((_, i) => {
          const day = cmp.periods.slice(0, i + 1).reduce((a, b) => a + b, 0);
          return <path key={i} d={`M${xAt(day).toFixed(1)},${L.axisY - 3}v6`} class="m3-axis" />;
        })}
      <text x={L.x0} y={L.height - 6} class="m3-cap-sub" style={{ fontSize: fs }}>
        {t('sc.time.start')}
      </text>
      <text x={L.xT} y={L.height - 6} class="m3-cap-sub" style={{ fontSize: fs }}>
        {t('sc.time.end', { tenor: tenorId })}
      </text>
    </g>
  );

  const ariaArgs = {
    tenor: tenorId,
    near: nearTxt,
    far: farTxt,
    n: nCoupons,
    usd: usd(cmp.ccsCouponBase, false),
    chf: chf(cmp.ccsCouponQuote, false),
  };
  const rowClass = (f: Focus) => (focus === f ? 'is-focus' : '');
  const tableRows: { key: string; f: Focus | null }[] = [
    { key: 'tenor', f: null },
    { key: 'notional', f: 'notional' },
    { key: 'rate', f: 'rate' },
    { key: 'interest', f: 'interest' },
    { key: 'price', f: 'interest' },
    { key: 'use', f: null },
  ];

  return (
    <div class={`m3 sc is-focus-${focus}`} data-compare data-tenor={tenorId} data-focus={focus}>
      <div class="ff-lab-head">
        <div class="m3-titles">
          <div class="ff-lab-title">{t('sc.title')}</div>
          <div class="ff-lab-sub">
            {t('sc.sub', { notional, rd: fmtPct(MK.rd, lang), rf: fmtPct(MK.rf, lang) })}
          </div>
        </div>
        <span class="m3-chip is-good" data-chip>
          {t('sc.chip')}
        </span>
      </div>
      <div class="m3-controls">
        <div class="m3-seg-field">
          <span class="field-label">{t('sc.seg.tenor')}</span>
          <Segmented
            label={t('sc.seg.tenor')}
            value={tenorId}
            mono
            onChange={(z) => {
              setTenorId(z);
              setTouched(true);
            }}
            options={K.tenors.map((z) => ({ value: z.id, label: z.id }))}
          />
        </div>
        <div class="m3-seg-field">
          <span class="field-label">{t('sc.seg.focus')}</span>
          <Segmented<Focus>
            label={t('sc.seg.focus')}
            value={focus}
            onChange={setFocus}
            options={[
              { value: 'all', label: t('sc.focus.all') },
              { value: 'notional', label: t('sc.focus.notional') },
              { value: 'interest', label: t('sc.focus.interest') },
              { value: 'rate', label: t('sc.focus.rate') },
            ]}
          />
        </div>
      </div>
      <ul class="m3-key-list" aria-hidden="true">
        <li>
          <span class="m3-key-sw is-in" />
          {t('sc.legend.in')}
        </li>
        <li>
          <span class="m3-key-sw is-out" />
          {t('sc.legend.out')}
        </li>
        <li>
          <span class="m3-key-sw is-coupon" />
          {t('sc.legend.coupon')}
        </li>
      </ul>

      <div ref={box} class="m3-cmp">
        <div class="m3-cmp-row" data-row="fx">
          <div class="m3-cmp-head">
            <b>{t('sc.row.fx')}</b>
            <span class="m3-pill is-rate">{t('sc.start', { rate: nearTxt })}</span>
            <span class="m3-pill is-rate">{t('sc.fx.end', { rate: farTxt })}</span>
            <span class="m3-pill is-interest">{t('sc.fx.points', { pips: pipsTxt })}</span>
            <span class="m3-pill is-interest">{t('sc.fx.cost', { chf: chf(-cmp.fxCostChf) })}</span>
            {cmp.fxSwapUnusual && <span class="m3-pill is-warn">{t('sc.unusual')}</span>}
          </div>
          <svg
            viewBox={`0 0 ${L.width} ${L.height}`}
            role="img"
            class="m3-svg"
            aria-label={`${t('sc.row.fx')}. ${t('sc.aria', ariaArgs)}`}
          >
            {axis}
            {diagram('fx')}
          </svg>
        </div>
        <div class="m3-cmp-row" data-row="ccs">
          <div class="m3-cmp-head">
            <b>{t('sc.row.ccs')}</b>
            <span class="m3-pill is-rate">{t('sc.start', { rate: nearTxt })}</span>
            <span class="m3-pill is-rate">{t('sc.ccs.end', { rate: nearTxt })}</span>
            <span class="m3-pill is-interest">
              {t('sc.ccs.coupons', {
                n: nCoupons,
                usd: usd(-cmp.ccsCouponBase),
                chf: chf(cmp.ccsCouponQuote),
              })}
            </span>
          </div>
          <svg
            viewBox={`0 0 ${L.width} ${L.height}`}
            role="img"
            class="m3-svg"
            aria-label={`${t('sc.row.ccs')}. ${t('sc.aria', ariaArgs)}`}
          >
            {axis}
            {diagram('ccs')}
          </svg>
        </div>
      </div>

      <div class="ff-check m3-check" data-check>
        <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true" class="m3-check-icon">
          <circle cx="10" cy="10" r="9" />
          <path d="M6 10.3L8.8 13L14 7.4" />
        </svg>
        <div>
          <b>{t('sc.check.title')}</b>
          <span>
            {t('sc.check.text', {
              fx: fmtMoney(cmp.pvFxChf, C.market.quote, lang),
              ccs: fmtMoney(cmp.pvCcsChf, C.market.quote, lang),
            })}
          </span>
        </div>
      </div>

      {L.compact ? (
        <dl class="m3-cmp-list" data-cmp-table>
          {tableRows.map((r) => (
            <div key={r.key} class={`m3-cmp-item ${r.f ? rowClass(r.f) : ''}`}>
              <dt>{t(`sc.t.${r.key}` as 'sc.t.tenor')}</dt>
              <dd>
                <b>{t('sc.row.fx')}</b>
                <span>{t(`sc.t.${r.key}.fx` as 'sc.t.tenor.fx')}</span>
              </dd>
              <dd>
                <b>{t('sc.row.ccs')}</b>
                <span>{t(`sc.t.${r.key}.ccs` as 'sc.t.tenor.ccs')}</span>
              </dd>
            </div>
          ))}
        </dl>
      ) : (
        <div
          class="ff-scroll-x m3-table-wrap"
          tabIndex={0}
          role="region"
          aria-label={t('sc.table.caption')}
        >
          <table class="ff-table m3-table m3-cmp-table" data-cmp-table>
            <caption class="sr-only">{t('sc.table.caption')}</caption>
            <thead>
              <tr>
                <th scope="col">{t('sc.table.aspect')}</th>
                <th scope="col">{t('sc.row.fx')}</th>
                <th scope="col">{t('sc.row.ccs')}</th>
              </tr>
            </thead>
            <tbody>
              {tableRows.map((r) => (
                <tr key={r.key} class={r.f ? rowClass(r.f) : ''}>
                  <th scope="row">{t(`sc.t.${r.key}` as 'sc.t.tenor')}</th>
                  <td>{t(`sc.t.${r.key}.fx` as 'sc.t.tenor.fx')}</td>
                  <td>{t(`sc.t.${r.key}.ccs` as 'sc.t.tenor.ccs')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p class="m3-hint">{t('sc.hint')}</p>
      <div class="sr-only" aria-live="polite" aria-atomic="true">
        {touched ? t('sc.live', { tenor: tenorId, far: farTxt, n: fmtNumber(nCoupons, lang) }) : ''}
      </div>
    </div>
  );
}
