/**
 * Version 6 review, points 7 and 8 (forward points and TARF).
 *
 * Point 8 (last TARF fixing, 08.3, glossary «target», «tarf», «pivot-tarf», structureblocks):
 * on the fixing that reaches the target the full notional N is traded at an adjusted rate, the
 * fixing minus what is left to the target (buy) or the fixing plus it (sell). The counted total
 * is then exactly the target. Checked on constructed daily paths through the exported payoff
 * functions of the core (src/lib/fx/mc/payoffs.ts, rule 'capped' of src/lib/fx/mc/products.ts),
 * once with test products and once with the products behind every number of module 08.
 *
 * Point 7 (forward points and interest parity, 02.3, quiz 02, module 03, glossary): the forward
 * follows from spot and rates, not from an expectation; in the market the cross-currency basis
 * plays a part. The texts no longer say «allein» / «alone», and the sections they point to
 * (02.2 and 03.4) really discuss the basis (Hull «Determination of Forward and Futures Prices»,
 * BIS Quarterly Review September 2016 «Covered interest parity lost»).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { getGlossaryEntry } from '@/content/glossary';
import { quiz as quiz02 } from '@/content/quiz/02-forward';
import { quiz as quiz03 } from '@/content/quiz/03-fx-swap';
import { quiz as quiz08 } from '@/content/quiz/08-structured-products';
import { forwardcurve } from '@/i18n/dict/forwardcurve';
import { structureblocks } from '@/i18n/dict/structureblocks';
import {
  pivotTarfPayoff,
  productPayoff,
  tarfPayoff,
  type Cashflow,
  type PayoffResult,
} from '@/lib/fx/mc/payoffs';
import { buildProduct, DEFAULT_MARKET as m, MC_CONFIG, type Product } from '@/lib/fx/mc/products';
import { M08, M08_PRODUCTS } from '@/lib/nums/m08';

const LANGS = ['de', 'en'] as const;
type Lang = (typeof LANGS)[number];
const ROOT = process.cwd();
const PIP = 0.0001;

const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8');
const mdx = (slug: string, lang: Lang, n: number) =>
  read(`src/content/modules/${slug}/${lang}/${n}.mdx`);

/** Daily path at `fill` with the given spots on the product's first fixings. */
function pathWith(p: Product, fixings: readonly number[], fill = 0.8): Float64Array {
  const days = p.fixingDays;
  const path = new Float64Array(days[days.length - 1]! + 1).fill(fill);
  fixings.forEach((s, i) => (path[days[i]!] = s));
  return path;
}

/** The trade on the fixing where the target is reached (the flow just before the marker). */
function targetTradeOf(r: PayoffResult): Cashflow {
  expect(r.reason).toBe('target');
  const marker = r.cashflows.at(-1)!;
  expect(marker.kind).toBe('target');
  const trade = r.cashflows.at(-2)!;
  expect(trade.fixing).toBe(marker.fixing);
  return trade;
}

/** Counted gain per USD: the gain of every trade of the plain notional that made money. */
function countedGain(r: PayoffResult, notional: number): number {
  return r.cashflows
    .filter((c) => Math.abs(c.amountBase) === notional && c.pnlQuote > 0)
    .reduce((sum, c) => sum + c.pnlQuote / notional, 0);
}

/* ---------- Point 8: the fixing that reaches the target ---------- */

describe('TARF: the fixing that reaches the target (rule capped)', () => {
  it('the example products use the rule of the text', () => {
    expect(MC_CONFIG.products.tarf.lastFixing).toBe('capped');
    expect(MC_CONFIG.products.pivotTarf.lastFixing).toBe('capped');
    expect(M08_PRODUCTS.tarf.lastFixing).toBe('capped');
    expect(M08_PRODUCTS.pivotTarf.lastFixing).toBe('capped');
  });

  // Test values: K 0.7600, target 500 pips, N USD 100'000. Fixings 0.7900 (gain 300 pips),
  // 0.7400 (loss, 2N, not counted), 0.7850 (gain 250 pips, only 200 pips are left).
  const tarf = buildProduct('tarf', m, { strike: 0.76 });
  const N = tarf.notional;
  const r = tarfPayoff(pathWith(tarf, [0.79, 0.74, 0.785]), tarf, m);

  it('buys the full notional at fixing − remaining, the counted total is exactly the target', () => {
    expect(tarf.target).toBeCloseTo(500 * PIP, 12);
    expect(N).toBe(100_000);
    const t = targetTradeOf(r);
    const remaining = tarf.target - 0.03;
    expect(remaining).toBeCloseTo(0.02, 12);
    expect(t.kind).toBe('buy');
    expect(t.amountBase).toBe(N);
    expect(t.rate!).toBeCloseTo(0.785 - remaining, 12); // 0.7650
    expect(t.rate!).toBeCloseTo(0.765, 12);
    expect(t.amountQuote).toBeCloseTo(-0.765 * N, 6);
    expect(t.pnlQuote).toBeCloseTo(remaining * N, 6); // CHF 2'000
    // the adjusted rate lies between strike and fixing
    expect(t.rate!).toBeGreaterThanOrEqual(tarf.strike);
    expect(t.rate!).toBeLessThan(t.spot);
    // counted total = target exactly; the loss fixing does not count
    expect(t.targetProgress).toBe(tarf.target);
    expect(countedGain(r, N)).toBeCloseTo(tarf.target, 12);
    expect(r.cashflows.map((c) => c.targetProgress)).toEqual([
      expect.closeTo(0.03, 12),
      expect.closeTo(0.03, 12),
      tarf.target,
      tarf.target,
    ]);
    expect([r.endedAt, r.totalBase]).toEqual([3, 4 * N]);
    expect(r.totalPnlQuote).toBeCloseTo(3000 - 4000 + 2000, 6);
  });

  it("the market variants: 'full' pays the whole gain at the strike, 'none' trades nothing", () => {
    const path = pathWith(tarf, [0.79, 0.74, 0.785]);
    const fullRes = productPayoff(path, { ...tarf, lastFixing: 'full' }, m);
    const full = targetTradeOf(fullRes);
    expect(full.amountBase).toBe(N);
    expect(full.rate!).toBeCloseTo(tarf.strike, 12);
    expect(full.pnlQuote).toBeCloseTo(0.025 * N, 6); // more than the 0.02 left
    // glossary «target»: with the full gain the counted total is more than the target
    expect(countedGain(fullRes, N)).toBeCloseTo(0.03 + 0.025, 12); // 550 pips
    expect(countedGain(fullRes, N)).toBeGreaterThan(tarf.target);
    const none = productPayoff(path, { ...tarf, lastFixing: 'none' }, m);
    expect(none.cashflows.map((c) => c.kind)).toEqual(['buy', 'buy', 'target']);
    // with no payment the counted total stays below the target
    expect(countedGain(none, N)).toBeCloseTo(0.03, 12); // 300 pips
    expect(countedGain(none, N)).toBeLessThan(tarf.target);
  });

  it('the example TARF of module 08: rate = fixing − remaining, total = target', () => {
    const p = M08_PRODUCTS.tarf;
    const K = p.strike;
    // 300 pips on the first fixing, 400 on the second: 200 pips are left
    const res = tarfPayoff(pathWith(p, [K + 0.03, K + 0.04]), p, m);
    const t = targetTradeOf(res);
    expect(t.amountBase).toBe(p.notional);
    expect(t.rate!).toBeCloseTo(K + 0.04 - (p.target - 0.03), 10);
    expect(t.targetProgress).toBe(p.target);
    expect(countedGain(res, p.notional)).toBeCloseTo(p.target, 10);
    expect(res.totalPnlQuote).toBeCloseTo(M08.tarfTargetChf, 4); // CHF 5'000
    // the trend-up scenario of the text ends at exactly the target, with N per fixing bought
    expect(M08.tarfUp.reason).toBe('target');
    expect(M08.tarfUp.pnl).toBeCloseTo(M08.tarfTargetChf, 4);
    expect(M08.tarfUp.base).toBe(M08.tarfUp.endedAt * p.notional);
  });
});

describe('Pivot TARF: the fixing that reaches the target (rule capped)', () => {
  // Test values: P 0.8000, K1 0.7700, K2 0.8300, target 300 pips, N USD 100'000.
  const pv = buildProduct('pivotTarf', m, { lowerStrike: 0.77, upperStrike: 0.83 });
  const N = pv.notional;

  it('sell side: sells the full notional at fixing + remaining, the total is the target', () => {
    expect(pv.pivot).toBeCloseTo(0.8, 12);
    expect(pv.target).toBeCloseTo(300 * PIP, 12);
    // 0.7900 buys at K1 (gain 200 pips), 0.8600 sells 2N at K2 (loss, not counted),
    // 0.8150 sells at K2 (gain 150 pips, only 100 pips are left)
    const r = pivotTarfPayoff(pathWith(pv, [0.79, 0.86, 0.815]), pv, m);
    const t = targetTradeOf(r);
    const remaining = pv.target - 0.02;
    expect(remaining).toBeCloseTo(0.01, 12);
    expect(t.kind).toBe('sell');
    expect(t.amountBase).toBe(-N);
    expect(t.rate!).toBeCloseTo(0.815 + remaining, 12); // 0.8250
    expect(t.amountQuote).toBeCloseTo(0.825 * N, 6);
    expect(t.pnlQuote).toBeCloseTo(remaining * N, 6); // CHF 1'000
    // the adjusted rate lies between fixing and upper strike
    expect(t.rate!).toBeGreaterThan(t.spot);
    expect(t.rate!).toBeLessThanOrEqual(pv.upperStrike);
    expect(t.targetProgress).toBe(pv.target);
    expect(countedGain(r, N)).toBeCloseTo(pv.target, 12);
    expect(r.cashflows[1]).toMatchObject({ kind: 'sell', amountBase: -2 * N });
    expect(r.cashflows[1]!.targetProgress).toBeCloseTo(0.02, 12);
  });

  it('buy side: buys the full notional at fixing − remaining', () => {
    // 0.8100 sells at K2 (gain 200 pips), 0.7900 buys at K1 (gain 200, only 100 are left)
    const r = pivotTarfPayoff(pathWith(pv, [0.81, 0.79]), pv, m);
    const t = targetTradeOf(r);
    expect(t.kind).toBe('buy');
    expect(t.amountBase).toBe(N);
    expect(t.rate!).toBeCloseTo(0.79 - 0.01, 12); // 0.7800
    expect(t.rate!).toBeGreaterThanOrEqual(pv.lowerStrike);
    expect(countedGain(r, N)).toBeCloseTo(pv.target, 12);
  });

  it('the example pivot TARF of module 08 can reach the target on one fixing near the pivot', () => {
    const p = M08_PRODUCTS.pivotTarf;
    // the band is wider than the target: one fixing at the pivot earns more than the target
    expect(p.pivot - p.lowerStrike).toBeGreaterThan(p.target);
    const S = p.pivot + 0.01; // sell side
    const r = pivotTarfPayoff(pathWith(p, [S]), p, m);
    const t = targetTradeOf(r);
    expect(r.endedAt).toBe(1);
    expect(t.kind).toBe('sell');
    expect(t.amountBase).toBe(-p.notional);
    expect(t.rate!).toBeCloseTo(S + p.target, 10); // nothing counted yet: remaining = target
    expect(t.rate!).toBeLessThan(p.upperStrike);
    expect(t.pnlQuote).toBeCloseTo(M08.pivTargetChf, 4); // CHF 3'000
  });
});

describe('texts of point 8 describe the rule', () => {
  const RULE: Record<Lang, string[]> = {
    de: [
      'Fixing, das das Target erreicht',
      'volle Nominal',
      'Fixing minus Rest bis zum Target',
      'Fixing plus Rest',
      'Am Markt gibt es Varianten, etwa der volle Gewinn am letzten Fixing oder keine Zahlung; massgebend ist das Term Sheet.',
    ],
    en: [
      'Fixing that reaches the target',
      'full notional',
      'the fixing minus what is left to the target',
      'the fixing plus that remainder',
      'In the market there are variants, such as the full gain on the last fixing or no payment; the term sheet decides.',
    ],
  };

  it.each(LANGS)('08.3 %s explains the last fixing of TARF and pivot TARF', (lang) => {
    const src = mdx('08-structured-products', lang, 3);
    for (const s of RULE[lang]) expect(src, s).toContain(s);
    expect(src).not.toContain('Der letzte Gewinn wird so gekappt');
    expect(src).not.toContain('The last gain is capped so that');
  });

  it.each(LANGS)('glossary and building-block texts %s carry the rule', (lang) => {
    const minus = lang === 'de' ? 'Fixing minus Rest bis zum Target' : 'fixing minus what is left';
    expect(getGlossaryEntry('tarf')!.def[lang]).toContain(minus);
    expect(getGlossaryEntry('pivot-tarf')!.def[lang]).toContain(
      lang === 'de' ? 'Fixing minus bzw. plus Rest' : 'fixing minus or plus what is left',
    );
    const target = getGlossaryEntry('target')!.def[lang];
    expect(target).toContain(lang === 'de' ? 'je nach Term Sheet' : 'depending on the term sheet');
    expect(target).toContain(lang === 'de' ? '(Gewinn = Target)' : '(gain = target)');
    expect(target).toContain(
      lang === 'de' ? '(dann meist mehr als das Target)' : '(then usually more than the target)',
    );
    // no unconditional cap next to the full-gain variant
    expect(target).not.toMatch(/Der Gewinn ist gedeckelt|The gain is capped/);
    expect(getGlossaryEntry('pivot-tarf')!.def[lang]).toContain(
      lang === 'de' ? '(Varianten je nach Term Sheet)' : '(variants per term sheet)',
    );
    const sb = structureblocks[lang];
    expect(sb['sb.text.full.target']).toContain(minus);
    expect(sb['sb.text.pivotTarf']).toContain(minus);
    expect(sb['sb.text.pivotTarf']).toContain(lang === 'de' ? 'Fixing plus Rest' : 'fixing plus');
  });

  it('quiz 08 says only what is left to the target counts on that fixing', () => {
    const c3 = quiz08.checks['3'];
    expect(c3.options[c3.correct]!.explain.de).toContain('nur noch der Rest bis zum Target');
    expect(c3.options[c3.correct]!.explain.en).toContain('only what is left to the target');
  });
});

/* ---------- Point 7: forward = spot and rates, plus the basis in the market ---------- */

describe('point 7: the forward is not a forecast, and the basis is named', () => {
  const ABSOLUTE: Record<Lang, string[]> = {
    de: [
      'allein aus Spot und Zinsen',
      'Die Ursache ist allein der Zinsunterschied',
      'spiegeln nur den Zinsunterschied',
    ],
    en: [
      'spot and interest rates alone',
      'The only cause is the interest rate differential',
      'only reflect the interest rate differential',
    ],
  };

  it.each(LANGS)('02.3 %s: no absolute claim, the basis is referenced', (lang) => {
    const src = mdx('02-forward', lang, 3);
    for (const s of ABSOLUTE[lang]) expect(src, s).not.toContain(s);
    expect(src).toContain(lang === 'de' ? 'nicht aus einer Erwartung' : 'not from an expectation');
    expect(src).toContain(lang === 'de' ? 'Cross-Currency Basis' : 'cross-currency basis');
    const pre = lang === 'de' ? '' : '/en';
    expect(src).toContain(`(${pre}/module/02-forward/2/)`);
    expect(src).toContain(`(${pre}/module/03-fx-swap/4/)`);
    expect(src).toContain(lang === 'de' ? 'keine Prognose' : 'not a forecast');
  });

  it.each(LANGS)('the referenced sections 02.2 and 03.4 %s discuss the basis', (lang) => {
    const term = lang === 'de' ? 'Cross-Currency Basis' : 'cross-currency basis';
    expect(mdx('02-forward', lang, 2)).toContain(`**${term}**`);
    expect(mdx('03-fx-swap', lang, 4)).toContain(`**${term}**`);
  });

  /** Identity claims «points = rate differential» and «forward = fair value» in the market. */
  const IDENTITY: Record<Lang, string[]> = {
    de: [
      'Der Abschlag gibt ihn genau wieder ab',
      'genau um diesen Vorteil tiefer',
      'bleibt der Forward beim fairen Wert',
      'steht der Forward im Markt beim fairen Wert',
      'der faire Forward aus Modul 02',
      'entsprechen den Forward Points: der Zinsdifferenz',
      'Sein Preis ist die Zinsdifferenz;',
      'Null wären sie nur bei gleichen Zinsen',
      'Der Forward ist Spot plus Zinsen',
    ],
    en: [
      'forward: the discount gives it back exactly',
      'lower by exactly that advantage',
      'the forward stays at its fair value',
      'the market forward sits at the fair value',
      'the fair forward from module 02',
      'equal the forward points: the interest differential',
      'Its price is the interest differential;',
      'only be zero if CHF and USD rates',
      'The forward is spot plus interest',
    ],
  };

  it.each(LANGS)('modules 02 and 03 %s make no identity claim', (lang) => {
    const texts = [1, 2, 3, 4].flatMap((n) => [
      mdx('02-forward', lang, n),
      mdx('03-fx-swap', lang, n),
    ]);
    texts.push(...Object.values(forwardcurve[lang]));
    for (const s of [...ABSOLUTE[lang], ...IDENTITY[lang]]) {
      expect(
        texts.some((t) => t.includes(s)),
        s,
      ).toBe(false);
    }
  });

  it.each(LANGS)(
    '02.3, 02.4, 03.1 and 03.2 %s name the basis where they speak of the market',
    (lang) => {
      const basis = lang === 'de' ? 'Cross-Currency Basis' : 'cross-currency basis';
      const parity =
        lang === 'de'
          ? 'In der Zinsparität gibt der Abschlag ihn genau wieder ab'
          : 'under interest rate parity the discount gives it back exactly';
      expect(mdx('02-forward', lang, 3)).toContain(parity);
      expect(mdx('02-forward', lang, 4)).toContain(
        lang === 'de' ? 'nahe beim fairen Wert' : 'close to its fair value',
      );
      const such = lang === 'de' ? 'Abweichungen wie die' : 'Deviations such as the';
      expect(mdx('02-forward', lang, 4)).toContain(`${such} ${basis}`);
      for (const n of [1, 2]) {
        const takeaway = mdx('03-fx-swap', lang, n).split('<Takeaway>')[1]!;
        expect(takeaway, `03.${n}`).toContain(basis);
      }
    },
  );

  it('quiz 02 and 03 explanations make no absolute claim', () => {
    const texts = [quiz02, quiz03].flatMap((q) =>
      [...q.quiz, ...Object.values(q.checks)].flatMap((x) =>
        x.options.flatMap((o) => [o.label.de, o.label.en, o.explain.de, o.explain.en]),
      ),
    );
    for (const s of [...ABSOLUTE.de, ...ABSOLUTE.en, ...IDENTITY.de, ...IDENTITY.en]) {
      expect(
        texts.some((t) => t.includes(s)),
        s,
      ).toBe(false);
    }
    const q3 = quiz02.quiz.find((q) => q.id === 'm02-q3')!;
    expect(q3.options[0]!.explain.de).toContain('Cross-Currency Basis');
    expect(q3.options[0]!.explain.en).toContain('cross-currency basis');
    expect(q3.options[q3.correct]!.explain.de).toContain('(Zinsparität)');
    expect(q3.options[q3.correct]!.explain.en).toContain('(interest rate parity)');
    const c2 = quiz03.checks['2'];
    expect(c2.options[2]!.explain.de).toContain('Ohne Basis');
    expect(c2.options[2]!.explain.en).toContain('Without a basis');
  });

  it('glossary: forward, forward points and parity name the basis', () => {
    for (const id of ['forward', 'forward-points', 'interest-rate-parity']) {
      const e = getGlossaryEntry(id)!;
      expect(e.def.de, id).toContain('Cross-Currency Basis');
      expect(e.def.en, id).toContain('cross-currency basis');
      expect(e.see, id).toContain('cross-currency-basis');
    }
    expect(getGlossaryEntry('forward')!.def.de).toContain('nicht aus einer Prognose');
    expect(getGlossaryEntry('forward')!.def.en).toContain('not from a forecast');
  });
});
