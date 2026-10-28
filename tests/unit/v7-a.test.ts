/**
 * Version 7, Block A (Review 3): six conclusions that were too absolute, corrected in DE and EN.
 * - A1 06.1: unhedged and forward are yardsticks, not limits. Close to forward and strike a
 *   structure with a premium costs more than both; the zero-cost collar and seagull stay between.
 * - A2 09.1: the call beats the forward only below F − premium; a slightly weaker dollar still
 *   favours the forward.
 * - A3 glossary «theta»: theta is the gamma share plus the interest carry; deep in the money the
 *   carry dominates and theta turns positive (as module 05.4 already says).
 * - A4 01.2: the FX market is mostly OTC; currency futures and options on them trade on
 *   exchanges (wording only, no size, no exchange name).
 * - A5 07.3: a digital is at best a partial hedge: a fixed amount while the extra cost grows.
 * - A6 08.2: an accumulator beats the forward per fixing between 2K − F and the barrier.
 * The retired phrases are guarded by tests/unit/content-lint.test.ts (RETIRED_V7). Check values
 * are typed only here.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { GLOSSARY } from '@/content/glossary';
import { quiz as quiz08 } from '@/content/quiz/08-structured-products';
import { NBSP } from '@/lib/format';
import { EXAMPLE, EXAMPLE_FORWARD, EXAMPLE_STRIKE } from '@/lib/fx/example';
import { digitalCash } from '@/lib/fx/exotics/digital';
import { thetaSplit } from '@/lib/fx/greeks';
import { MC_PRODUCTS, fairProduct } from '@/lib/fx/mc/fair';
import { productPayoff } from '@/lib/fx/mc/payoffs';
import { shaperFacts, shaperPosition } from '@/lib/hedge-shaper';
import { M07_CONFIG } from '@/lib/m07/config';
import { hedgeSetup } from '@/lib/m09/hedge';
import { matrixParams, productResult } from '@/lib/matrix';
import { formatNum } from '@/lib/nums/format';
import { M06, MARKET, nums as n06, payAt } from '@/lib/nums/m06';
import { M07, nums as n07 } from '@/lib/nums/m07';
import { M08, nums as n08 } from '@/lib/nums/m08';
import { M09, nums as n09 } from '@/lib/nums/m09';
import type { NumDef } from '@/lib/nums/types';
import { forwardToDay } from '@/lib/pathsim';

const ROOT = process.cwd();
type Lang = 'de' | 'en';
const mdx = (slug: string, lang: Lang, s: number) =>
  readFileSync(join(ROOT, `src/content/modules/${slug}/${lang}/${s}.mdx`), 'utf8');
const tag = (key: string) => `<Num of="${key}" />`;
const show = (table: Record<string, NumDef>, key: string, lang: Lang) => {
  const d = table[key];
  if (!d) throw new Error(`missing num ${key}`);
  return formatNum(d, lang);
};
/** Both texts of a section carry every listed <Num> tag, so DE and EN show the same numbers. */
function expectSameNums(slug: string, s: number, keys: readonly string[]) {
  for (const lang of ['de', 'en'] as const) {
    const src = mdx(slug, lang, s);
    for (const k of keys) expect(src, `${lang}: ${k}`).toContain(tag(k));
  }
}
const grid = (lo: number, hi: number, n: number) =>
  Array.from({ length: n + 1 }, (_, i) => lo + ((hi - lo) * i) / n);
const { spot: S, T, vol, rd, rf, notional: N } = EXAMPLE;
const PIP = 1e-4;

/* ---------------------------------------------------------------------------------------- */
/* A1 · 06.1: «ohne Absicherung» and the forward are yardsticks, not limits                  */
/* ---------------------------------------------------------------------------------------- */

describe('A1 · 06.1: yardsticks, not limits', () => {
  const F = EXAMPLE_FORWARD;
  const unhedged = (st: number) => st * N;
  const fwd = F * N;
  const premiumPips = (id: 'call' | 'call-spread') =>
    shaperFacts(shaperPosition(id, MARKET), MARKET, PIP).premiumPips;
  const bands = {
    call: () => [M06.callBandLo, M06.shCall.capRate] as const,
    'call-spread': () => [M06.spreadBandLo, M06.shSpread.capRate] as const,
  };

  it('reproduces the check values at 0.7950 (CHF on USD 1 Mio., premium included)', () => {
    expect(M06.stMid).toBe(0.795);
    expect(unhedged(0.795)).toBeCloseTo(795000, 2);
    expect(fwd).toBeCloseTo(793030.54, 2);
    expect(payAt('call', 0.795)).toBeCloseTo(804527.81, 2);
    expect(payAt('call-spread', 0.795)).toBeCloseTo(802468.04, 2);
    expect(payAt('collar', 0.795)).toBeCloseTo(795000, 2);
    expect(payAt('seagull', 0.795)).toBeCloseTo(795000, 2);
    expect(premiumPips('call')).toBeCloseTo(95.278, 3);
    expect(premiumPips('call-spread')).toBeCloseTo(74.68, 3);
    expect(n06['m06.midUnhedgedChf']!.value).toBeCloseTo(795000, 6);
    expect(n06['m06.midCallChf']!.value).toBe(payAt('call', 0.795));
    expect(n06['m06.midSpreadChf']!.value).toBe(payAt('call-spread', 0.795));
    expect(n06['m06.fwdChf']!.value).toBe(fwd);
  });

  it('band ends: forward minus premium and the cap (strike plus premium); rd = 0, no growth', () => {
    expect(EXAMPLE.rd).toBe(0);
    expect(M06.callBandLo).toBeCloseTo(0.783503, 6);
    expect(M06.shCall.capRate).toBeCloseTo(0.809528, 6);
    expect(M06.spreadBandLo).toBeCloseTo(0.785562, 5);
    expect(M06.shSpread.capRate).toBeCloseTo(0.807468, 6);
    expect(M06.callBandLo).toBeCloseTo(F - premiumPips('call') * PIP, 12);
    expect(M06.shCall.capRate).toBeCloseTo(M06.shK.call + premiumPips('call') * PIP, 12);
    expect(n06['m06.callBandLo']!.value).toBe(M06.callBandLo);
    expect(n06['m06.spreadBandLo']!.value).toBe(M06.spreadBandLo);
    expect(n06['m06.shCallCap']!.value).toBe(M06.shCall.capRate);
    expect(n06['m06.shSpreadCap']!.value).toBe(M06.shSpread.capRate);
  });

  for (const id of ['call', 'call-spread'] as const) {
    it(`${id} costs more than max(unhedged, forward) inside its band`, () => {
      const [lo, hi] = bands[id]();
      expect(lo).toBeLessThan(F);
      expect(hi).toBeGreaterThan(MARKET.S);
      for (const st of grid(lo + 1e-6, hi - 1e-6, 400)) {
        const yardstick = Math.max(unhedged(st), fwd);
        expect(payAt(id, st), `S_T ${st.toFixed(6)}`).toBeGreaterThan(yardstick);
      }
      // just outside the band one of the two yardsticks is cheaper again
      for (const st of [lo - 0.001, hi + 0.001]) {
        expect(payAt(id, st), `S_T ${st.toFixed(6)}`).toBeLessThan(Math.max(unhedged(st), fwd));
      }
    });
  }

  it.each(['collar', 'seagull'] as const)(
    '%s (zero cost) stays between unhedged and forward on a rate grid',
    (id) => {
      const tol = 0.5; // CHF on USD 1 Mio.: residual of the solved zero-cost put strike
      expect(
        Math.abs(shaperFacts(shaperPosition(id, MARKET), MARKET, PIP).premiumQuote),
      ).toBeLessThan(tol);
      for (const st of grid(0.7, 0.9, 400)) {
        const cost = payAt(id, st);
        const [lo, hi] = [Math.min(unhedged(st), fwd), Math.max(unhedged(st), fwd)];
        expect(cost, `S_T ${st.toFixed(4)} below both`).toBeGreaterThanOrEqual(lo - tol);
        expect(cost, `S_T ${st.toFixed(4)} above both`).toBeLessThanOrEqual(hi + tol);
      }
    },
  );

  it('06.1 shows the example and the bands in DE and EN through <Num>', () => {
    expectSameNums('06-combos-smile', 1, [
      'm06.stMid',
      'm06.midUnhedgedChf',
      'm06.fwdChf',
      'm06.midCallChf',
      'm06.midSpreadChf',
      'm06.callBandLo',
      'm06.shCallCap',
      'm06.spreadBandLo',
      'm06.shSpreadCap',
    ]);
    expect(mdx('06-combos-smile', 'de', 1)).toContain('Vergleichsmassstäbe, aber keine Grenzen');
    expect(mdx('06-combos-smile', 'en', 1)).toContain('yardsticks, but not the limits');
    expect(show(n06, 'm06.stMid', 'de')).toBe('0.7950');
    expect(show(n06, 'm06.midCallChf', 'de')).toBe(`CHF${NBSP}804’528`);
    expect(show(n06, 'm06.midSpreadChf', 'de')).toBe(`CHF${NBSP}802’468`);
    expect(show(n06, 'm06.midCallChf', 'en')).toBe(
      formatNum({ value: 804528, kind: 'money' }, 'en'),
    );
    expect(show(n06, 'm06.callBandLo', 'de')).toBe('0.7835');
    expect(show(n06, 'm06.shCallCap', 'de')).toBe('0.8095');
    expect(show(n06, 'm06.spreadBandLo', 'de')).toBe('0.7856');
    expect(show(n06, 'm06.shSpreadCap', 'de')).toBe('0.8075');
  });
});

/* ---------------------------------------------------------------------------------------- */
/* A2 · 09.1: the call beats the forward only below F − premium                               */
/* ---------------------------------------------------------------------------------------- */

describe('A2 · 09.1: forward or call', () => {
  const hs = hedgeSetup();
  const mp = matrixParams();
  const res = (id: 'forward' | 'call', st: number) => productResult(id, st, mp) ?? NaN;
  const thr = hs.forward - hs.call.premiumAtExpiry;

  it('reproduces the check values', () => {
    expect(hs.forward).toBeCloseTo(0.7930305, 7);
    expect(hs.call.premium).toBeCloseTo(0.0126691, 7);
    expect(hs.call.premiumAtExpiry).toBe(hs.call.premium); // rd = 0
    expect(thr).toBeCloseTo(0.780361, 6);
    expect(thr / S - 1).toBeCloseTo(-0.02455, 4);
    expect(M09.callBeatsFwd).toBe(thr);
    expect(n09['m09.callBeatsFwd']!.value).toBe(thr);
    expect(n09['m09.callBeatsFwdPct']!.value).toBeCloseTo(thr / S - 1, 12);
    expect(M09.s1Mild).toBeCloseTo(0.79, 10);
    expect(res('forward', 0.79) / PIP).toBeCloseTo(-30.31, 2);
    expect(res('call', 0.79) / PIP).toBeCloseTo(-126.69, 2);
    expect(M09.s1FwdMildPips).toBeCloseTo(-30.31, 2);
    expect(M09.s1CallMildPips).toBeCloseTo(-126.69, 2);
  });

  it('above F − premium the forward result is better, below it the call result', () => {
    for (const st of grid(0.7, 0.9, 400)) {
      if (Math.abs(st - thr) < 1e-4) continue;
      const better = res('forward', st) > res('call', st) ? 'forward' : 'call';
      expect(better, `S_T ${st.toFixed(4)}`).toBe(st > thr ? 'forward' : 'call');
    }
    expect(res('forward', thr)).toBeCloseTo(res('call', thr), 12);
    // the ±3 % scenarios of the text: up → forward, down (below the threshold) → call
    expect(M09.s1Down).toBeLessThan(thr);
    expect(M09.s1CallDownPips).toBeGreaterThan(M09.s1FwdDownPips);
    expect(M09.s1FwdUpPips).toBeGreaterThan(M09.s1CallUpPips);
  });

  it('09.1 says it in DE and EN with the same numbers', () => {
    expectSameNums('09-hedge-alpha-yield', 1, [
      'm09.s1Mild',
      'm09.s1FwdMild',
      'm09.s1CallMild',
      'm09.callBeatsFwd',
      'm09.callBeatsFwdPct',
    ]);
    expect(mdx('09-hedge-alpha-yield', 'de', 1)).toContain('Fällt er nur leicht');
    expect(mdx('09-hedge-alpha-yield', 'en', 1)).toContain('If it falls only a little');
    expect(show(n09, 'm09.callBeatsFwd', 'de')).toBe('0.7804');
    expect(show(n09, 'm09.callBeatsFwdPct', 'de')).toBe(`−2.45${NBSP}%`);
    expect(show(n09, 'm09.s1Mild', 'de')).toBe('0.7900');
    expect(show(n09, 'm09.s1FwdMild', 'de')).toBe('−30');
    expect(show(n09, 'm09.s1CallMild', 'en')).toBe('−127');
  });
});

/* ---------------------------------------------------------------------------------------- */
/* A3 · glossary «theta»: gamma share plus carry, positive deep in the money                 */
/* ---------------------------------------------------------------------------------------- */

describe('A3 · theta: gamma share plus carry', () => {
  const split = (K: number) => {
    const t = thetaSplit(S, K, T, vol, rd, rf, 'call');
    return { gamma: t.gamma * N, carry: t.carry * N, total: t.total * N };
  };

  it.each([
    [0.793, -69.33, 38.66, -30.67],
    [0.773, -55.79, 56.67, 0.88],
    [0.75, -25.49, 70.07, 44.58],
    [0.7, -0.5, 75.98, 75.48],
  ])('call %s per day on USD 1 Mio.: gamma share %s, carry %s, theta %s', (K, g, c, t) => {
    const s = split(K);
    expect(s.gamma).toBeCloseTo(g, 2);
    expect(s.carry).toBeCloseTo(c, 2);
    expect(s.total).toBeCloseTo(t, 2);
    expect(s.gamma + s.carry).toBeCloseTo(s.total, 9);
  });

  it('theta of the 0.7930 call is negative, of the 0.7000 call positive', () => {
    expect(EXAMPLE_STRIKE).toBe(0.793);
    expect(split(EXAMPLE_STRIKE).total).toBeLessThan(0);
    expect(split(0.7).total).toBeGreaterThan(0);
    expect(split(0.7).carry).toBeGreaterThan(-split(0.7).gamma);
    for (const K of [0.793, 0.773, 0.75, 0.7]) {
      expect(split(K).gamma, `gamma share ${K}`).toBeLessThan(0);
      expect(split(K).carry, `carry ${K}`).toBeGreaterThan(0);
    }
  });

  it('the glossary says so in DE and EN, in at most two sentences', () => {
    const e = GLOSSARY.find((x) => x.id === 'theta')!;
    expect(e.def.de).toContain('Zins-Carry');
    expect(e.def.de).toContain('dann ist Theta positiv');
    expect(e.def.de).toContain('Zeitwertverlust (der Gamma-Anteil) ist der Preis für Gamma');
    expect(e.def.de).not.toContain('Wie viel Wert die Option verliert');
    expect(e.def.en).toContain('interest carry');
    expect(e.def.en).toContain('then theta is positive');
    expect(e.def.en).toContain('loss of time value (the gamma share) is the price of gamma');
    expect(e.def.en).not.toContain('How much value the option loses');
    expect(e.see).toContain('carry');
    // the module already says it; glossary and module agree
    expect(mdx('05-greeks', 'de', 4)).toContain(
      'Tief im Geld überwiegt der Carry, und Theta wird positiv',
    );
  });
});

/* ---------------------------------------------------------------------------------------- */
/* A4 · 01.2: mostly OTC; futures and options on them trade on exchanges                      */
/* ---------------------------------------------------------------------------------------- */

describe('A4 · 01.2: mostly OTC', () => {
  it('says it in DE and EN without a size of the exchange share or an exchange name', () => {
    const de = mdx('01-spot', 'de', 2);
    const en = mdx('01-spot', 'en', 2);
    expect(de).toContain('überwiegend ausserbörslich');
    expect(de).toContain('Währungsfutures und Optionen darauf werden aber an Börsen gehandelt');
    expect(de).toContain('Der Devisenhandel läuft überwiegend OTC und ruht nur am Wochenende');
    expect(en).toContain('mostly trade off-exchange');
    expect(en).toContain('Currency futures and options on them are traded on exchanges');
    expect(en).toContain('FX trading runs mostly OTC and only rests at the weekend');
    for (const src of [de, en]) {
      expect(src).not.toMatch(/CME|Eurex|Nasdaq|Chicago|Terminb\u00f6rse/);
      expect(src).not.toMatch(/\d+\s?% (des|der|of the|of) (Devisen|FX|B\u00f6rsen|exchange)/);
    }
    // the paragraph on futures states no size of the exchange share: no percent, digit or fraction
    const para = (src: string, needle: string) => src.split('\n').find((l) => l.includes(needle));
    expect(para(de, 'Währungsfutures')).toBeDefined();
    expect(para(en, 'Currency futures')).toBeDefined();
    expect(para(de, 'Währungsfutures')).not.toMatch(
      /%|\d|Zehntel|Drittel|Viertel|H\u00e4lfte|Prozent/,
    );
    expect(para(en, 'Currency futures')).not.toMatch(
      /%|\d|tenth|third|quarter|half|percent|per cent/,
    );
    const otc = GLOSSARY.find((x) => x.id === 'otc')!;
    expect(otc.def.de).toContain('grösstenteils OTC');
    expect(otc.def.en).toContain('largely OTC');
  });
});

/* ---------------------------------------------------------------------------------------- */
/* A5 · 07.3: a digital is at best a partial hedge                                           */
/* ---------------------------------------------------------------------------------------- */

describe('A5 · 07.3: digital as a partial hedge', () => {
  const P = M07_CONFIG.touch.payout;
  const K = M07_CONFIG.strike;
  const premium = digitalCash(S, K, T, vol, rd, rf, 'call') * P;
  const net = P - premium;
  /** The importer's extra cost against the strike on USD 1 Mio. */
  const extra = (st: number) => (st - K) * N;

  it('reproduces the check values (payout CHF 100’000, strike 0.7930, rd = 0)', () => {
    expect(P).toBe(100000);
    expect(K).toBe(0.793);
    expect(premium).toBeCloseTo(49240.57, 2);
    expect(net).toBeCloseTo(50759.43, 2);
    expect(M07.digitalNet).toBeCloseTo(net, 9);
    expect(n07['m07.digitalNetChf']!.value + n07['m07.digitalChf']!.value).toBeCloseTo(P, 9);
    expect(M07.digitalMild).toBeCloseTo(0.82, 12);
    expect(M07.digitalStrong).toBeCloseTo(0.9, 12);
    expect(extra(0.82)).toBeCloseTo(27000, 6);
    expect(extra(0.9)).toBeCloseTo(107000, 6);
    expect(n07['m07.digitalMildExtraChf']!.value).toBeCloseTo(27000, 6);
    expect(n07['m07.digitalStrongExtraChf']!.value).toBeCloseTo(107000, 6);
  });

  it('net payout equals the extra cost at one rate only, 0.843759; the amount never scales', () => {
    const be = K + net / N;
    expect(be).toBeCloseTo(0.843759, 6);
    expect(extra(be)).toBeCloseTo(net, 6);
    expect(extra(0.82) - net).toBeLessThan(0);
    expect(extra(0.9) - net).toBeGreaterThan(0);
    // the digital pays the same fixed amount at both rates
    for (const st of [0.82, 0.9]) {
      expect(digitalCash(st, K, 0, vol, rd, rf, 'call', P)).toBe(P);
    }
  });

  it('07.3 says it in DE and EN with the same numbers, never «genau gedeckt»', () => {
    expectSameNums('07-barrier-binary', 3, [
      'm07.digitalNetChf',
      'm07.digitalMild',
      'm07.digitalMildExtraChf',
      'm07.digitalStrong',
      'm07.digitalStrongExtraChf',
    ]);
    expect(mdx('07-barrier-binary', 'de', 3)).toContain('höchstens ein Teilschutz');
    expect(mdx('07-barrier-binary', 'en', 3)).toContain('at best a partial hedge');
    for (const lang of ['de', 'en'] as const) {
      expect(mdx('07-barrier-binary', lang, 3)).not.toMatch(/genau gedeckt|exactly covered/);
    }
    expect(show(n07, 'm07.digitalNetChf', 'de')).toBe(`CHF${NBSP}50’759`);
    expect(show(n07, 'm07.digitalMild', 'de')).toBe('0.8200');
    expect(show(n07, 'm07.digitalStrong', 'de')).toBe('0.9000');
    expect(show(n07, 'm07.digitalMildExtraChf', 'de')).toBe(`CHF${NBSP}27’000`);
    expect(show(n07, 'm07.digitalStrongExtraChf', 'de')).toBe(`CHF${NBSP}107’000`);
  });
});

/* ---------------------------------------------------------------------------------------- */
/* A6 · 08.2: the accumulator beats the forward per fixing between 2K − F and the barrier     */
/* ---------------------------------------------------------------------------------------- */

describe('A6 · 08.2: accumulator against the forward, fixing by fixing', () => {
  const acc = fairProduct('accumulator');
  const { strike: K, barrier: B, notional: Nf, leverage } = acc;
  const F = MC_PRODUCTS.products.accumulator.forwardAvg;
  const lev = 2 * K - F;
  const mp = matrixParams();
  /**
   * Δ_i of the derivation, from the core: the accumulator's result of one fixing per USD
   * (productResult, src/lib/matrix.ts) minus the forward's (S − F), both × N. The forward is the
   * one of the average fixing day, the module's convention (mp.accumulator.forward = forwardAvg).
   */
  const adv = (s: number) =>
    ((productResult('accumulator', s, mp) ?? NaN) - (s - mp.accumulator.forward)) * Nf;
  /** The same advantage in closed form against the forward f of a single fixing day. */
  const advDay = (s: number, f: number) => {
    const q = s >= B ? 0 : s >= K ? Nf : leverage * Nf;
    return (s - K) * q - (s - f) * Nf;
  };
  /** The Monte Carlo kernel on a flat path at s (the first fixing sees s). */
  const kernelAt = (s: number) => {
    const last = acc.fixingDays[acc.fixingDays.length - 1]!;
    return productPayoff(new Float64Array(last + 1).fill(s), acc, { rd: EXAMPLE.rd });
  };

  it('reproduces the check values (Version 6 data at 4 decimals: the strike follows mc-products.json)', () => {
    expect(leverage).toBe(2);
    expect(mp.accumulator.strike).toBe(K);
    expect(mp.accumulator.barrier).toBe(B);
    expect(mp.accumulator.forward).toBe(F);
    // Version 6: K 0.774001, 2K − F 0.755219. A re-run of npm run data:mc with more paths
    // (Block C) moves the strike by about 1e-5, so these hold at display precision only.
    expect(K).toBeCloseTo(0.774001, 4);
    expect(F).toBeCloseTo(0.792783, 6);
    expect(B).toBe(0.824);
    expect(lev).toBeCloseTo(0.755219, 4);
    expect(M08.accBreakLev).toBe(lev);
    expect(n08['m08.accBreakLev']!.value).toBe(lev);
    expect(n08['m08.accBarrier']!.value).toBe(B);
  });

  it('the matrix profile is the Monte Carlo kernel per fixing: leverage below K, knock-out from B', () => {
    for (const s of grid(0.6, B - 1e-9, 200)) {
      const r = kernelAt(s);
      const first = r.cashflows.filter((c) => c.fixing === 1);
      expect(first.length, `S ${s.toFixed(6)}`).toBe(1);
      expect(first[0]!.kind).toBe('buy');
      expect(first[0]!.rate).toBe(K);
      expect(first[0]!.amountBase).toBe(s < K ? leverage * Nf : Nf);
      expect(first[0]!.pnlQuote).toBeCloseTo((productResult('accumulator', s, mp) ?? NaN) * Nf, 6);
    }
    for (const s of [B, B + 0.01]) {
      const r = kernelAt(s);
      expect(r.reason).toBe('knockout');
      expect(r.endedAt).toBe(1);
      expect(r.totalPnlQuote).toBe(0); // tradeOnKnockOutFixing = false
      expect(productResult('accumulator', s, mp)).toBe(0);
    }
  });

  it('(F − K)·N between K and B, (S − 2K + F)·N below K, sign change exactly at 2K − F', () => {
    for (const s of grid(K, B - 1e-9, 50)) expect(adv(s)).toBeCloseTo((F - K) * Nf, 6);
    for (const s of grid(0.6, K - 1e-9, 50)) expect(adv(s)).toBeCloseTo((s - 2 * K + F) * Nf, 6);
    expect(adv(lev)).toBeCloseTo(0, 6);
    expect(adv(lev + 1e-4)).toBeGreaterThan(0);
    expect(adv(lev - 1e-4)).toBeLessThan(0);
    for (const s of grid(lev + 1e-6, B - 1e-6, 200)) {
      expect(adv(s), `S ${s.toFixed(6)}`).toBeGreaterThan(0);
    }
    for (const s of grid(0.6, lev - 1e-6, 100)) expect(adv(s), `S ${s.toFixed(6)}`).toBeLessThan(0);
    // from the barrier on nothing is bought: the forward's gain is missed
    expect(adv(B)).toBeCloseTo(-(B - F) * Nf, 6);
  });

  it('with the forward of a single fixing day the lower end lies between 0.7485 and 0.7618', () => {
    const days = acc.fixingDays;
    expect(days[0]).toBe(7);
    expect(days[days.length - 1]).toBe(182);
    // Version 6: 0.748539 and 0.761843 (4 decimals, see above)
    expect(2 * K - forwardToDay(7)).toBeCloseTo(0.748539, 4);
    expect(2 * K - forwardToDay(182)).toBeCloseTo(0.761843, 4);
    expect(forwardToDay(MC_PRODUCTS.products.accumulator.avgFixingDay)).toBeCloseTo(F, 5);
    // at F = forwardAvg the closed form is the core's advantage
    for (const s of grid(0.6, 0.9, 300))
      expect(advDay(s, F), `S ${s.toFixed(4)}`).toBeCloseTo(adv(s), 6);
    for (const d of days) {
      const f = forwardToDay(d);
      const edge = 2 * K - f;
      expect(advDay(edge, f)).toBeCloseTo(0, 6);
      expect(edge).toBeGreaterThanOrEqual(2 * K - forwardToDay(7) - 1e-12);
      expect(edge).toBeLessThanOrEqual(2 * K - forwardToDay(182) + 1e-12);
    }
  });

  it('08.2 takeaway names the range in DE and EN; the quiz keeps «ruhig» as the best answer', () => {
    expectSameNums('08-structured-products', 2, ['m08.accBreakLev', 'm08.accBarrier']);
    const de = mdx('08-structured-products', 'de', 2);
    const en = mdx('08-structured-products', 'en', 2);
    expect(de).toContain(
      `solange die Fixings zwischen ${tag('m08.accBreakLev')} und der Barriere ${tag('m08.accBarrier')} liegen`,
    );
    expect(en).toContain(
      `as long as the fixings stay between ${tag('m08.accBreakLev')} and the barrier ${tag('m08.accBarrier')}`,
    );
    expect(de).not.toContain('nur in ruhigen Märkten');
    expect(en).not.toContain('only in calm markets');
    expect(show(n08, 'm08.accBreakLev', 'de')).toBe('0.7552');
    const q1 = quiz08.quiz.find((q) => q.id === 'm08-q1')!;
    expect(q1.options[q1.correct]!.label.de).toBe('Der Markt bleibt ruhig');
    expect(q1.options[q1.correct]!.label.en).toBe('The market stays calm');
  });
});
