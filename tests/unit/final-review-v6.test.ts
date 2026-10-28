/**
 * Version 6, final review: statements that were still absolute after points 1 and 7, and the
 * Riskometer labels after point 6.
 *
 * - In-out parity holds without a rebate only (Hull «Exotic Options»): a knock-out rebate is
 *   paid at the hit, so knock-out + knock-in = vanilla + PV(rebate at hit). Checked with the
 *   core's Reiner-Rubinstein prices (src/lib/fx/exotics/barrier) on the module 07 example.
 * - Swap points, forward premium and covered interest arbitrage: interest rate parity fixes the
 *   forward in the model; in the market the cross-currency basis persists (bis-2016-cip). So
 *   «the higher-rate currency always trades at a discount» holds under parity only: a basis
 *   larger than the rate gap turns the sign (core forwardMoneyMarket).
 * - The cash-and-carry figure keeps the market forward close to, not at, the fair value.
 * - The offline file is a frozen snapshot: the Riskometer names the data date, not «today».
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import { getGlossaryEntry } from '@/content/glossary';
import { cashcarry } from '@/i18n/dict/cashcarry';
import { common } from '@/i18n/dict/common';
import { riskometer } from '@/i18n/dict/riskometer';
import { barrierPrice } from '@/lib/fx/exotics/barrier';
import { hitDiscountFactor } from '@/lib/fx/exotics/touch';
import { EXAMPLE } from '@/lib/fx/example';
import { forwardMoneyMarket } from '@/lib/fx/forward';
import { gkPrice } from '@/lib/fx/vanilla';
import { M07_CONFIG, PIP } from '@/lib/m07/config';

const LANGS = ['de', 'en'] as const;
const ROOT = process.cwd();

function def(id: string, lang: (typeof LANGS)[number]): string {
  const e = getGlossaryEntry(id);
  expect(e, id).toBeDefined();
  return e!.def[lang];
}

describe('in-out parity needs «without a rebate»', () => {
  const C = M07_CONFIG;
  const { spot: S, rd, rf, vol, T } = C.market;
  const K = C.strike;
  const H = C.barriers.up;
  const R = C.rebatePips * PIP;
  const call = (kind: 'up-and-out' | 'up-and-in', rebate = 0) =>
    barrierPrice({ S, K, H, T, vol, rd, rf, type: 'call', kind, rebate });
  const vanilla = gkPrice(S, K, T, vol, rd, rf, 'call');

  it('KO + KI = vanilla exactly without a rebate (check values 17.23 + 109.46 = 126.69 pips)', () => {
    expect(call('up-and-out') / PIP).toBeCloseTo(17.2343, 4);
    expect(call('up-and-in') / PIP).toBeCloseTo(109.4569, 4);
    expect(vanilla / PIP).toBeCloseTo(126.6912, 4);
    expect(Math.abs(call('up-and-out') + call('up-and-in') - vanilla)).toBeLessThan(1e-12);
  });

  it('a knock-out rebate adds its value at the hit (check value 7.617 pips for 20 pips)', () => {
    const excess = call('up-and-out', R) + call('up-and-in') - vanilla;
    expect(excess / PIP).toBeCloseTo(7.6171, 4);
    expect(excess).toBeCloseTo(R * hitDiscountFactor(S, H, T, vol, rd, rf, -1), 12);
    // a knock-in rebate is paid at expiry if never knocked in; with rd = 0 both together are R
    const excessKi = call('up-and-in', R) + call('up-and-out') - vanilla;
    expect(excessKi / PIP).toBeCloseTo(12.3829, 4);
    expect(rd).toBe(0);
    expect(excess + excessKi).toBeCloseTo(R, 12);
  });

  it.each(LANGS)('the glossary entry names the condition (%s)', (lang) => {
    expect(def('in-out-parity', lang)).toContain(
      lang === 'de' ? 'ohne Rebate' : 'Without a rebate',
    );
    expect(getGlossaryEntry('in-out-parity')!.see).toContain('rebate');
  });
});

describe('parity statements of the glossary are conditional', () => {
  it('the higher-rate currency is at a discount under parity, a basis can turn it', () => {
    const S = EXAMPLE.spot;
    // parity, base rate higher: forward below spot (the module example, USD 3.5 % vs CHF 0 %)
    expect(forwardMoneyMarket(S, EXAMPLE.rd, EXAMPLE.rf, 90)).toBeLessThan(S);
    // base 5 bp above quote, but the market forward implies a quote rate 20 bp higher (basis):
    // the base currency, although it pays the higher deposit rate, now trades at a premium
    const parity = forwardMoneyMarket(S, 0.01, 0.0105, 360);
    const market = forwardMoneyMarket(S, 0.012, 0.0105, 360);
    expect(parity).toBeLessThan(S);
    expect(market).toBeGreaterThan(S);
  });

  it.each(LANGS)('forward premium/discount, swap points, covered arbitrage (%s)', (lang) => {
    const basis = lang === 'de' ? 'Cross-Currency Basis' : 'cross-currency basis';
    const fpd = def('forward-premium-discount', lang);
    expect(fpd).toContain(lang === 'de' ? 'In der Zinsparität' : 'Under interest rate parity');
    expect(fpd).not.toMatch(lang === 'de' ? /immer/ : /always/);
    // two real sentences (the old third sentence began with a quote mark)
    expect(fpd.split(/[.]\s+/).length).toBe(2);
    expect(def('swap-points', lang)).toContain(basis);
    const cia = def('covered-interest-arbitrage', lang);
    expect(cia).toContain(basis);
    expect(cia).not.toMatch(lang === 'de' ? /eng ein/ : /parity tight/);
  });
});

describe('cash-and-carry figure: close to, not at, the fair value', () => {
  it.each(LANGS)('%s', (lang) => {
    for (const k of ['cc.aha.text', 'cc.aha.textCheap'] as const) {
      expect(cashcarry[lang][k]).toContain(
        lang === 'de' ? 'im Markt nahe beim fairen Wert' : 'close to the fair value',
      );
    }
  });
});

describe('Riskometer labels name the data date, not «today»', () => {
  const RK = ['rk.today', 'rk.todayTag', 'rk.peakSub', 'rk.legend.current', 'rk.chartSummary'];
  const COMMON = ['nav.riskLevel', 'home.riskTitle'];
  it.each(LANGS)('%s', (lang) => {
    const texts = [
      ...RK.map((k) => riskometer[lang][k as keyof (typeof riskometer)['de']]),
      ...COMMON.map((k) => common[lang][k as keyof (typeof common)['de']]),
    ];
    for (const t of texts) {
      expect(t, t).toBeDefined();
      // placeholder names such as {today} are code, not shown text
      const shown = t.replace(/[{][^}]*[}]/g, '');
      expect(shown, t).not.toMatch(lang === 'de' ? /heute|aktuell/i : /today|current/i);
    }
  });
});

/** Old wordings of this round; none may come back anywhere in src (case-sensitive). */
const OLD: string[] = [
  'notiert auf Termin immer mit Abschlag',
  'always trades at a forward discount',
  'hält der Markt die Parität im Normalfall eng ein',
  'the market normally keeps parity tight',
  'entsprechen der Zinsdifferenz über die Laufzeit',
  'and reflect the interest differential over the term.',
  'steht er im Markt beim fairen Wert',
  'keeps it at the fair value',
  'allein aus der Zinsparität',
  'interest-rate parity alone',
  'gleichem Verfall ergeben genau die Vanilla Option',
  'A knock-in plus a knock-out with the same barrier',
  'Stufe heute',
  'Riskometer heute',
  "'Heute {v}'",
  'Level today',
  'Riskometer today',
  "'Today {v}'",
];

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/[.](ts|tsx|astro|mdx|md)$/.test(name)) out.push(p);
  }
  return out;
}

describe('old wordings are gone from src', () => {
  const files = walk(join(ROOT, 'src')).filter((f) => !f.endsWith('sources.md'));
  it.each(OLD)('«%s»', (phrase) => {
    const hits = files.filter((f) => readFileSync(f, 'utf8').includes(phrase));
    expect(hits.map((f) => relative(ROOT, f))).toEqual([]);
  });
});
