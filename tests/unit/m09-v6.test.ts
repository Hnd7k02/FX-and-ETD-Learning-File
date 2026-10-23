/**
 * Version 6, group "hedge, alpha, carry, TPF" (points 3, 4 and 5):
 * - point 3: alpha is the risk-adjusted excess return over a benchmark (Jensen 1968), not
 *   «a return that comes from a market view»; texts, quiz and glossary agree,
 * - point 4: the carry of module 09 is on USD 1 Mio. AT MATURITY (CHF 6’939), the carry of
 *   module 01 on USD 1 Mio. bought TODAY (CHF 7’000); the core identity behind both,
 * - point 5: paid coupons and maximum gains of TPF and RTPF come from ONE source, the
 *   contractual coupon (fair coupon rounded to the quote step), in modules 08 and 09, the
 *   product matrix and the path simulator; the unrounded fair coupon is shown only as
 *   «fairer Coupon (Monte Carlo) ± Standardfehler».
 * Check values are typed only here.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import { EXAMPLE } from '@/lib/fx/example';
import { forwardMoneyMarket, moneyMarketCarry } from '@/lib/fx/forward';
import { MC_PRODUCTS, fairProduct } from '@/lib/fx/mc/fair';
import { PIP } from '@/lib/fx/mc/products';
import { carryView, CARRY_DEFAULTS, yieldPnl } from '@/lib/m09/carry';
import { keyFact, matrixParams, pipsDigits, productResult, PRODUCTS } from '@/lib/matrix';
import { PATHSIM_CONFIG, paidCoupon, paramRange, simProduct, simulate } from '@/lib/pathsim';
import { fullStage, stageCoupon, stagePayoff } from '@/lib/structures';
import { NBSP, fmtPips } from '@/lib/format';
import { formatNum } from '@/lib/nums/format';
import { M09, nums as n09 } from '@/lib/nums/m09';
import { nums as n08 } from '@/lib/nums/m08';
import { nums as n01 } from '@/lib/nums/m01';
import { GLOSSARY } from '@/content/glossary';
import { pathsimulator } from '@/i18n/dict/pathsimulator';
import { productmatrix } from '@/i18n/dict/productmatrix';
import { quiz as quiz08 } from '@/content/quiz/08-structured-products';
import { quiz as quiz09 } from '@/content/quiz/09-hedge-alpha-yield';
import type { NumDef } from '@/lib/nums/types';

const ROOT = process.cwd();
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8');
const mdx = (slug: string, lang: 'de' | 'en', s: number) =>
  read(`src/content/modules/${slug}/${lang}/${s}.mdx`);
const num = (table: Record<string, NumDef>, key: string): NumDef => {
  const d = table[key];
  if (!d) throw new Error(`missing num ${key}`);
  return d;
};
const de = (table: Record<string, NumDef>, key: string) => formatNum(num(table, key), 'de');
const en = (table: Record<string, NumDef>, key: string) => formatNum(num(table, key), 'en');
/** A shown amount "CHF 46’524" / "USD 991’326" / "775.4" back to a number. */
const shown = (s: string) => Number(s.replace(/[^0-9.+-]/g, ''));

function walk(dir: string, re: RegExp, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, re, out);
    else if (re.test(name)) out.push(p);
  }
  return out;
}

/* ---------------------------------------------------------------------------------------- */
/* Point 4: carry on USD 1 Mio. at maturity (module 09) vs. bought today (module 01)          */
/* ---------------------------------------------------------------------------------------- */

describe('point 4: carry notionals', () => {
  const S = EXAMPLE.spot;
  const rd = EXAMPLE.rd;
  const rf = EXAMPLE.rf;
  const days = EXAMPLE.mmDays;
  const t = days / 360;
  const N = EXAMPLE.notional;
  const F = forwardMoneyMarket(S, rd, rf, days);

  it('check values: USD 991’325.90 today, CHF 6’939.28 at maturity, CHF 7’000.00 today', () => {
    expect(M09.carryUsdToday).toBeCloseTo(991_325.9, 2);
    expect(M09.carryUsdToday).toBeCloseTo(N / (1 + rf * t), 8);
    expect(M09.carryChf).toBeCloseTo(6_939.28, 2);
    expect(M09.carryChf).toBeCloseTo((S - F) * N, 8);
    expect(M09.carryChfStart).toBeCloseTo(7_000, 2);
  });

  it('m09.carryChf is the end-notional carry, the same as the yield figure', () => {
    const v = carryView(CARRY_DEFAULTS);
    expect(v.notional).toBe(N);
    expect(v.days).toBe(days);
    expect(num(n09, 'm09.carryChf').value).toBeCloseTo(yieldPnl('carry', S, v), 8);
    expect(num(n09, 'm09.carryChf').value).toBeCloseTo(
      moneyMarketCarry(S, rd, rf, days, N, 'maturity').carry,
      8,
    );
  });

  it('m09.carryChfStart is the 01.4 number (USD 1 Mio. bought today)', () => {
    expect(num(n09, 'm09.carryChfStart').value).toBeCloseTo(num(n01, 'm01.carryPnlFlat').value, 8);
    expect(shown(de(n09, 'm09.carryChfStart'))).toBe(7_000);
    expect(de(n09, 'm09.carryChf')).toBe(`CHF${NBSP}6’939`);
    expect(en(n09, 'm09.carryChf')).toBe(`CHF${NBSP}6,939`);
    expect(de(n09, 'm09.carryUsdToday')).toBe(`USD${NBSP}991’326`);
    expect(en(n09, 'm09.carryChfStart')).toBe(`CHF${NBSP}7,000`);
  });

  it('identity (rd = 0): (S − F) · N = USD interest on N / (1 + rf · t), valued at spot', () => {
    expect(rd).toBe(0);
    const usdToday = N / (1 + rf * t);
    const usdInterest = usdToday * rf * t;
    expect((S - F) * N).toBeCloseTo(usdInterest * S, 8);
  });

  it('identity (general rd): (S − F) · N = USD interest at spot − CHF interest on the CHF spent', () => {
    for (const [rdx, rfx, d, bq, bb] of [
      [0.01, 0.035, 90, 360, 360],
      [0.02, 0.005, 180, 360, 360],
      [0.015, 0.04, 91, 365, 360],
      [-0.0075, 0.05, 30, 360, 365],
    ] as const) {
      const tq = d / bq;
      const tb = d / bb;
      const Fx = forwardMoneyMarket(S, rdx, rfx, d, bq, bb);
      const usdToday = N / (1 + rfx * tb);
      const chfSpent = usdToday * S;
      const expected = usdToday * rfx * tb * S - chfSpent * rdx * tq;
      expect((S - Fx) * N).toBeCloseTo(expected, 6);
      const c = moneyMarketCarry(S, rdx, rfx, d, N, 'maturity', bq, bb);
      expect(c.baseAtMaturity).toBeCloseTo(N, 6);
      expect(c.baseToday).toBeCloseTo(usdToday, 6);
      expect(c.quoteToday).toBeCloseTo(chfSpent, 6);
      expect(c.forward).toBeCloseTo(Fx, 12);
      expect(c.carry).toBeCloseTo((S - Fx) * N, 6);
      // the same position with N bought today is larger by 1 + rf · tb
      const today = moneyMarketCarry(S, rdx, rfx, d, N, 'today', bq, bb);
      expect(today.baseToday).toBe(N);
      expect(today.carry).toBeCloseTo(c.carry * (1 + rfx * tb), 6);
      expect(today.carry).toBeCloseTo(today.baseAtMaturity * (S - Fx), 6);
    }
  });

  it('module 01: the start-notional carry is borrow-and-invest at an unchanged spot', () => {
    const usdEnd = N * (1 + rf * t);
    const chfDebt = N * S * (1 + rd * t);
    expect(usdEnd * S - chfDebt).toBeCloseTo(M09.carryChfStart, 8);
    expect(M09.carryChfStart).toBeCloseTo(M09.carryChf * (1 + rf * t), 8);
  });

  it('D-26: shown pips × USD 1 Mio. = shown CHF carry (69.39 pips → CHF 6’939)', () => {
    expect(de(n09, 'm09.carryPipsExact')).toBe('69.39');
    const pipsShown = shown(de(n09, 'm09.carryPipsExact'));
    expect(Math.round(pipsShown * PIP * N)).toBe(shown(de(n09, 'm09.carryChf')));
  });

  it('09.4 names both notionals, DE and EN', () => {
    for (const lang of ['de', 'en'] as const) {
      const src = mdx('09-hedge-alpha-yield', lang, 4);
      for (const k of ['m09.carryUsdToday', 'm09.carryChf', 'm09.carryChfStart']) {
        expect(src, `${lang}: ${k}`).toContain(`<Num of="${k}" />`);
      }
      expect(src).toContain(lang === 'de' ? 'bei Fälligkeit' : 'at maturity');
      expect(src).toContain(lang === 'de' ? '/module/01-spot/4/' : '/en/module/01-spot/4/');
      // only the amounts scale with 1 + r_USD τ; forward, break-even and pips do not
      expect(src).toContain(
        lang === 'de'
          ? 'sind alle Beträge und damit der Zinsvorsprung um den Faktor'
          : 'every amount, and so the interest differential, is larger by the factor',
      );
      expect(src).toContain(
        lang === 'de'
          ? 'Forward, Break-even und der Abschlag pro Dollar bei Fälligkeit bleiben gleich.'
          : 'The forward, the break-even and the discount per dollar at maturity stay the same.',
      );
      // the importer's 69.39 pips are the money-market forward discount (09.2 uses the
      // continuous forward), and the paragraph keeps one precision for the same quantity
      expect(src).toContain(
        lang === 'de'
          ? 'Zum Geldmarkt-Forward kauft der Importeur <Num of="m09.carryPipsExact" /> Pips'
          : 'At the money-market forward the importer buys <Num of="m09.carryPipsExact" /> pips',
      );
      const importer = src
        .split('\n')
        .find(
          (l) =>
            l.includes('Geldmarkt-Forward kauft') ||
            l.includes('money-market forward the importer'),
        )!;
      expect(importer).not.toContain('<Num of="m09.carryPips" />');
    }
  });

  it('forward and break-even are the same for both notionals, only the amounts scale', () => {
    const S = EXAMPLE.spot;
    const end = moneyMarketCarry(
      S,
      EXAMPLE.rd,
      EXAMPLE.rf,
      EXAMPLE.mmDays,
      EXAMPLE.notional,
      'maturity',
    );
    const start = moneyMarketCarry(
      S,
      EXAMPLE.rd,
      EXAMPLE.rf,
      EXAMPLE.mmDays,
      EXAMPLE.notional,
      'today',
    );
    expect(start.forward).toBe(end.forward);
    expect(start.forward).toBeCloseTo(M09.carryForward, 12);
    const f = 1 + (EXAMPLE.rf * EXAMPLE.mmDays) / 360;
    expect(start.baseToday / end.baseToday).toBeCloseTo(f, 12);
    expect(start.quoteToday / end.quoteToday).toBeCloseTo(f, 12);
    expect(start.carry / end.carry).toBeCloseTo(f, 12);
    // break-even of both: the result at maturity is zero at S_T = F
    for (const c of [start, end]) {
      expect(
        c.baseAtMaturity * c.forward - c.quoteToday * (1 + EXAMPLE.rd * (EXAMPLE.mmDays / 360)),
      ).toBeCloseTo(0, 6);
    }
  });
});

/* ---------------------------------------------------------------------------------------- */
/* Point 5: one contractual coupon for TPF and RTPF                                           */
/* ---------------------------------------------------------------------------------------- */

describe('point 5: contractual coupon everywhere, fair coupon only ± standard error', () => {
  const kinds = [
    { kind: 'tpf' as const, coupon: 775.4, chf: 7_754, max: 46_524, fair: 775.37, se: 0.97 },
    { kind: 'rtpf' as const, coupon: 810.5, chf: 8_105, max: 48_630, fair: 810.54, se: 1.61 },
  ];

  it.each(kinds)('$kind: check values (coupon, CHF per fixing, maximum gain)', (c) => {
    const k = c.kind;
    for (const ns of ['m08', 'm09'] as const) {
      const table = ns === 'm08' ? n08 : n09;
      expect(num(table, `${ns}.${k}Coupon`).value).toBeCloseTo(c.coupon, 9);
      expect(num(table, `${ns}.${k}CouponChf`).value).toBeCloseTo(c.chf, 6);
      expect(num(table, `${ns}.${k}MaxChf`).value).toBeCloseTo(c.max, 6);
    }
  });

  it.each(kinds)('$kind: m09 = m08, shown the same in DE and EN', (c) => {
    const k = c.kind;
    for (const suffix of ['Coupon', 'CouponChf', 'MaxChf']) {
      const a = `m08.${k}${suffix}`;
      const b = `m09.${k}${suffix}`;
      expect(num(n09, b).value, b).toBeCloseTo(num(n08, a).value, 9);
      expect(de(n09, b), b).toBe(de(n08, a));
      expect(en(n09, b), b).toBe(en(n08, a));
    }
  });

  it.each(kinds)('$kind: maximum gain = number of coupons × shown coupon in CHF', (c) => {
    const k = c.kind;
    const count = num(n08, 'm08.tpfTargetCoupons').value;
    expect(count).toBe(fairProduct(k).targetCoupons);
    for (const ns of ['m08', 'm09'] as const) {
      const table = ns === 'm08' ? n08 : n09;
      const chf = shown(de(table, `${ns}.${k}CouponChf`));
      const max = shown(de(table, `${ns}.${k}MaxChf`));
      expect(chf).toBe(c.chf);
      expect(max).toBe(c.max);
      expect(count * chf).toBe(max);
      // coupon in pips as shown × USD 100’000 = coupon in CHF as shown
      const p = shown(de(table, `${ns}.${k}Coupon`));
      expect(Math.round(p * PIP * fairProduct(k).notional)).toBe(chf);
    }
    expect(num(n09, 'm09.tpfTargetCoupons').value).toBe(count);
  });

  it.each(kinds)('$kind: the matrix and the simulator pay the contractual coupon', (c) => {
    const k = c.kind;
    const p = matrixParams();
    expect(p[k].coupon).toBe(simProduct(k).coupon);
    expect(p[k].coupon / PIP).toBeCloseTo(c.coupon, 9);
    const kf = keyFact(k, p);
    expect(kf.value).toBeCloseTo(c.coupon, 9);
    expect(kf.digits).toBe(1);
    // the profile pays exactly this coupon inside the paying zone
    const inside = k === 'tpf' ? p.tpf.strike : EXAMPLE.spot;
    expect(productResult(k, inside, p)).toBe(simProduct(k).coupon);
  });

  it('the coupon does not move the theoretical maximum loss (m09 = m08)', () => {
    expect(num(n09, 'm09.tpfMaxLoss').value).toBe(num(n08, 'm08.tpfMaxLoss').value);
  });

  it.each(kinds)('$kind: contract = fair coupon rounded, far inside the standard error', (c) => {
    const k = c.kind;
    const fair = MC_PRODUCTS.products[k].value / PIP;
    const se = MC_PRODUCTS.products[k].stdErrPips;
    expect(fair).toBeCloseTo(c.fair, 9);
    expect(se).toBeCloseTo(c.se, 9);
    const contract = simProduct(k).coupon / PIP;
    expect(Math.abs(contract - fair)).toBeLessThanOrEqual(
      PATHSIM_CONFIG.couponQuoteStep / PIP / 2 + 1e-9,
    );
    expect(Math.abs(contract - fair)).toBeLessThan(se);
    expect(contract).not.toBe(fair);
    const key = k === 'tpf' ? 'm08.tpfFairCoupon' : 'm08.rtpfFairCoupon';
    expect(de(n08, key)).toBe(String(c.fair));
    expect(de(n08, `m08.${k}Se`)).toBe(String(c.se));
  });

  it('the fair coupon appears in the texts only as «fairer Coupon (Monte Carlo) ± Standardfehler»', () => {
    const files = [
      ...walk(join(ROOT, 'src/content/modules'), /\.mdx$/),
      ...walk(join(ROOT, 'src/content/quiz'), /\.ts$/),
    ];
    for (const f of files) {
      const src = readFileSync(f, 'utf8');
      for (const k of ['tpf', 'rtpf']) {
        const fairKey = `<Num of="m08.${k}FairCoupon" />`;
        let at = src.indexOf(fairKey);
        while (at >= 0) {
          const after = src.slice(at + fairKey.length, at + fairKey.length + 40);
          expect(after, relative(ROOT, f)).toContain(` ± <Num of="m08.${k}Se" />`);
          at = src.indexOf(fairKey, at + 1);
        }
      }
    }
    expect(mdx('08-structured-products', 'de', 4)).toContain(
      'Fairer Coupon (Monte Carlo) ± Standardfehler',
    );
    expect(mdx('08-structured-products', 'en', 4)).toContain(
      'Fair coupon (Monte Carlo) ± standard error',
    );
    // the quiz names the paid coupon without «fair», the fair one with its standard error
    const q3 = quiz08.quiz.find((q) => q.id === 'm08-q3')!;
    expect(q3.prompt.de).not.toMatch(/fair/i);
    expect(q3.prompt.en).not.toMatch(/fair/i);
    expect(q3.prompt.de).toContain(`${de(n08, 'm08.tpfCoupon')} Pips`);
    const text = JSON.stringify(q3.options);
    expect(text).toContain(`${de(n08, 'm08.tpfFairCoupon')} ± ${de(n08, 'm08.tpfSe')} Pips`);
    expect(text).toContain(`${en(n08, 'm08.tpfFairCoupon')} ± ${en(n08, 'm08.tpfSe')} pips`);
  });

  it('the path simulator labels the fair and the contractual coupon', () => {
    expect(pathsimulator.de['ps.st.fairCoupon']).toBe('Fairer Coupon (Monte Carlo)');
    expect(pathsimulator.en['ps.st.fairCoupon']).toBe('Fair coupon (Monte Carlo)');
    expect(pathsimulator.de['ps.st.fairSub']).toContain('Standardfehler');
    expect(pathsimulator.en['ps.st.fairSub']).toContain('standard error');
    expect(pathsimulator.de['ps.st.contractCoupon']).toBe('Vertraglicher Coupon');
    expect(pathsimulator.en['ps.st.contractCoupon']).toBe('Contractual coupon');
    for (const lang of ['de', 'en'] as const) {
      for (const v of ['{c}', '{n}', '{q}'])
        expect(pathsimulator[lang]['ps.st.couponChf']).toContain(v);
      // a coupon chosen with the slider is not «rounded to the quote step»
      expect(pathsimulator[lang]['ps.st.couponChfChosen']).toContain('{c}');
      expect(pathsimulator[lang]['ps.st.couponChfChosen']).toContain('{n}');
      expect(pathsimulator[lang]['ps.st.couponChfChosen']).not.toContain('{q}');
    }
    expect(pathsimulator.de['ps.st.chosenCoupon']).toBe('Gewählter Coupon');
    expect(pathsimulator.en['ps.st.chosenCoupon']).toBe('Chosen coupon');
  });

  it.each(kinds)('$kind: the simulator row is the coupon of the simulated product', (c) => {
    const k = c.kind;
    // default: the contractual coupon
    const def = paidCoupon(k);
    expect(def.chosen).toBe(false);
    expect(def.coupon).toBe(simProduct(k).coupon);
    expect(def.coupon / PIP).toBeCloseTo(c.coupon, 9);
    expect(def.perFixing).toBeCloseTo(c.chf, 6);
    // after the slider moved: the chosen coupon, the same one the event table pays
    const [, , step] = paramRange(k);
    const chosen = simProduct(k).coupon + 2 * step;
    const pc = paidCoupon(k, chosen);
    expect(pc.chosen).toBe(true);
    expect(pc.coupon).toBe(chosen);
    expect(pc.coupon).toBe(simProduct(k, chosen).coupon);
    expect(pc.perFixing).toBeCloseTo(chosen * fairProduct(k).notional, 9);
    expect(pc.perFixing).not.toBeCloseTo(def.perFixing, 0);
    const sim = simulate(k, { name: 'sideways' }, chosen);
    const paid = sim.rows.filter((r) => r.kind === 'coupon');
    expect(paid.length).toBeGreaterThan(0);
    for (const r of paid) expect(r.amountQuote).toBeCloseTo(pc.perFixing, 6);
    const simDef = simulate(k, { name: 'sideways' });
    for (const r of simDef.rows.filter((x) => x.kind === 'coupon'))
      expect(r.amountQuote).toBeCloseTo(def.perFixing, 6);
  });

  it('the simulator island reads the coupon row from paidCoupon(kind, param)', () => {
    const src = read('src/components/islands/PathSimulator.tsx');
    expect(src).toContain('paidCoupon(kind, param)');
    expect(src).not.toContain('simProduct(kind) as { coupon: number }');
  });

  it.each(kinds)('$kind: the building blocks draw and name the contractual coupon', (c) => {
    const k = c.kind;
    const stage = fullStage(k);
    expect(stageCoupon(stage)).toBe(simProduct(k).coupon);
    expect(stageCoupon(stage)! / PIP).toBeCloseTo(c.coupon, 9);
    // the payoff of one fixing inside the paying zone is the coupon in CHF on the notional
    const inside = k === 'tpf' ? simProduct('tpf').strike : EXAMPLE.spot;
    expect(stagePayoff(stage, inside)).toBeCloseTo(c.chf, 6);
    // the strike products keep their fair strikes and draw no coupon
    for (const other of ['accumulator', 'decumulator', 'tarf', 'pivotTarf'] as const) {
      expect(stageCoupon(fullStage(other))).toBeNull();
    }
    const sb = read('src/components/islands/StructureBlocks.tsx');
    expect(sb).toContain('stageCoupon(p)');
    expect(sb).not.toContain('prod.coupon');
  });

  it.each(kinds)('$kind: the matrix readout shows the coupon like the card (0.1 pip)', (c) => {
    const k = c.kind;
    const p = matrixParams();
    expect(pipsDigits(k)).toBe(1);
    expect(keyFact(k, p).digits).toBe(pipsDigits(k));
    const inside = k === 'tpf' ? p.tpf.strike : EXAMPLE.spot;
    const readout = fmtPips(productResult(k, inside, p)! / PIP, 'de', pipsDigits(k));
    expect(readout).toBe(fmtPips(keyFact(k, p).value, 'de', keyFact(k, p).digits));
    expect(readout).toBe(String(c.coupon));
    for (const id of Object.keys(PRODUCTS) as (keyof typeof PRODUCTS)[]) {
      if (id !== 'tpf' && id !== 'rtpf') expect(pipsDigits(id), id).toBe(0);
    }
  });

  it('the TPF pays at or above the strike, in every text', () => {
    expect(productmatrix.de['pm.p.tpf.use']).toContain('auf oder über dem Strike');
    expect(productmatrix.en['pm.p.tpf.use']).toContain('at or above the strike');
    const c3 = JSON.stringify(quiz09.checks['3']);
    expect(c3).toContain('Fixing auf oder über dem Strike');
    expect(c3).toContain('a fixing at or above the strike');
    // the core pays exactly at the strike
    const p = matrixParams();
    expect(productResult('tpf', p.tpf.strike, p)).toBe(p.tpf.coupon);
  });

  it('09.3 states the maximum gains with the coupon that adds up', () => {
    for (const lang of ['de', 'en'] as const) {
      const src = mdx('09-hedge-alpha-yield', lang, 3);
      expect(src).toContain(
        `<Num of="m09.tpfMaxChf" />: <Num of="m09.tpfTargetCoupons" /> ${lang === 'de' ? 'Coupons zu' : 'coupons of'} <Num of="m09.tpfCouponChf" />`,
      );
      expect(src).toContain('<Num of="m09.rtpfMaxChf" />');
      expect(src).toContain('<Num of="m09.rtpfCouponChf" />');
    }
  });
});

/* ---------------------------------------------------------------------------------------- */
/* Point 3: alpha                                                                            */
/* ---------------------------------------------------------------------------------------- */

describe('point 3: alpha is the risk-adjusted excess return over a benchmark', () => {
  it('09.3 defines alpha like the glossary, DE and EN', () => {
    const d = mdx('09-hedge-alpha-yield', 'de', 3);
    expect(d).toContain(
      'In der Finanztheorie ist **Alpha** der Mehrertrag gegenüber einem Vergleichsmassstab, risikobereinigt.',
    );
    expect(d).toContain('Hier ist der Vergleichsmassstab der Forward bzw. der Geldmarkt');
    expect(d).toContain('Ob daraus Alpha wird, zeigt erst der Vergleich.');
    expect(d).toContain('zunächst nur das Ergebnis der Dollar-Position');
    const e = mdx('09-hedge-alpha-yield', 'en', 3);
    expect(e).toContain(
      'In finance theory, **alpha** is the excess return over a benchmark, adjusted for risk.',
    );
    expect(e).toContain('Here the benchmark is the forward or the money market');
    expect(e).toContain('Only the comparison shows whether that becomes alpha.');
    expect(e).toContain('at first just the result of the dollar position');
  });

  it('the glossary says risk-adjusted and names the benchmark', () => {
    const a = GLOSSARY.find((g) => g.id === 'alpha')!;
    expect(a.def.de).toContain('risikobereinigte Mehrertrag gegenüber einem Vergleichsmassstab');
    expect(a.def.en).toContain('risk-adjusted excess return over a benchmark');
    expect(a.def.de).toContain('Forward bzw. dem Geldmarkt');
    expect(a.def.en).toContain('the forward or the money market');
  });

  it('09.1 and the section check use the same benchmark wording', () => {
    expect(mdx('09-hedge-alpha-yield', 'de', 1)).toContain(
      'besser abschneiden als die Referenz, der Forward bzw. der Geldmarkt',
    );
    expect(mdx('09-hedge-alpha-yield', 'en', 1)).toContain(
      'beat a benchmark, the forward or the money market',
    );
    const c1 = JSON.stringify(quiz09.checks['1']);
    expect(c1).toContain('besser abschneiden als die Referenz');
    expect(c1).toContain('beat a benchmark');
    // she has no risk to hedge, but she wants to take one (09.3 says the same)
    expect(c1).toContain('Die Anlegerin hat kein Risiko, das sie absichern müsste.');
    expect(c1).toContain('The investor has no risk that needs hedging.');
    expect(mdx('09-hedge-alpha-yield', 'de', 3)).toContain(
      'Sie hat kein Risiko, das sie absichern müsste.',
    );
    expect(mdx('09-hedge-alpha-yield', 'en', 3)).toContain('She has no risk that needs hedging.');
  });

  it('the takeaway and the glossary keep products and alpha apart', () => {
    const take = (lang: 'de' | 'en') =>
      mdx('09-hedge-alpha-yield', lang, 3).split('<Takeaway>')[1]!.split('</Takeaway>')[0]!;
    expect(take('de')).toContain(
      'Alpha ist erst, was nach dem Vergleich mit dem Forward bzw. dem Geldmarkt bleibt, risikobereinigt.',
    );
    expect(take('en')).toContain(
      'Alpha is only what remains after the comparison with the forward or the money market, adjusted for risk.',
    );
    const a = GLOSSARY.find((g) => g.id === 'alpha')!;
    expect(a.def.de).toContain('heisst so auch das Bedürfnis');
    expect(a.def.en).toContain('it also names the need');
  });

  it('the loose wordings are gone everywhere in src', () => {
    const OLD = [
      'einen Ertrag, der aus einer Marktsicht kommt',
      'a return that comes from a market view',
      'aus dieser Sicht Geld machen',
      'make money from that view',
      'aus ihrer Sicht Geld machen',
      'make money from her view',
      'hat kein Risiko und sucht Alpha',
      'has no risk and looks for alpha',
      'Allgemein der Mehrertrag gegenüber einem Vergleichsmassstab',
      'In general the excess return over a benchmark',
      'In diesem Tool steht Alpha für Produkte',
      'In this tool alpha stands for products',
      'Alpha-Produkte verwandeln eine Sicht',
      'Alpha products turn a view',
      'Die Anlegerin hat kein Risiko.',
      'The investor has no risk.',
      // point 4: the carry without its notional, and «everything» scaling with 1 + r_USD τ
      'Monaten verdient er auf USD 1 Mio. einen Zinsvorsprung von',
      'he earns an interest differential of <Num of="m09.carryChf" /> on USD 1m',
      'Der Importeur kauft auf Termin <Num of="m09.carryPips" /> Pips',
      'The importer buys forward <Num of="m09.carryPips" /> pips',
      'ist alles um den Faktor',
      'everything is larger by the factor',
      // point 5: the paid coupon presented as the fair coupon next to its standard error
      'steigt der Coupon auf <Num of="m08.tpfCoupon" />',
      'the coupon rises to <Num of="m08.tpfCoupon" />',
      'Standardfehler <Num of="m08.tpfSe" /> bzw.',
      'standard error <Num of="m08.tpfSe" /> and',
      'Der Coupon ist auf <Num of="m08.couponQuote" /> Pips gerundet. So geht',
      'The coupon is rounded to <Num of="m08.couponQuote" /> pips, so',
      'Warum ist der faire TPF-Coupon mit',
      'Why is the fair TPF coupon of',
      'darum steigt der faire Coupon von',
      'so the fair coupon rises from',
      '{chf} je Fixing auf {n}',
      '{chf} per fixing on {n}',
    ];
    const files = walk(join(ROOT, 'src'), /\.(ts|tsx|astro|mdx)$/);
    for (const f of files) {
      const src = readFileSync(f, 'utf8');
      for (const o of OLD) expect(src.includes(o), `${relative(ROOT, f)}: «${o}»`).toBe(false);
    }
  });
});
