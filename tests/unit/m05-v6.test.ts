/**
 * Version 6, module 05 (Greeks), points 2, 10 and 11:
 *  - where gamma and vega peak: across spot gamma peaks at d1 = −σ√T and vega at d1 = +σ√T
 *    (d2 = 0); across strikes both peak at d1 = 0; "forward close to the strike" is only the rule
 *    of thumb (point 2); the gap to ATMF grows with σ²T while ATMF gamma stays near the peak,
 *  - near ATMF only the gamma share of theta peaks; the full one-day theta of the lab (gamma share
 *    plus carry) is most negative further left at 13 weeks (review of point 2),
 *  - deep in the money the spot delta tends to e^(−rf T), the spot delta of a forward, and the
 *    forward delta to 1 (point 10),
 *  - vega cannot be hedged with spot or forwards; desks use other options, less often volatility
 *    or variance swaps (point 11).
 * Check values are typed only here; texts, quiz and dictionaries take them from the core.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { getGlossaryEntry } from '@/content/glossary';
import { quiz } from '@/content/quiz/05-greeks';
import { greekslab } from '@/i18n/dict/greekslab';
import { EXAMPLE as E, EXAMPLE_STRIKE as K } from '@/lib/fx/example';
import { PIP, greeks, thetaGammaShare, thetaOneDay } from '@/lib/fx/greeks';
import { d1d2, gkPrice } from '@/lib/fx/vanilla';
import { LAB_CONFIG, gammaPeakSpot, vegaPeakSpot } from '@/lib/greekslab';
import { formatNum, getNum } from '@/lib/nums';
import { M05 } from '@/lib/nums/m05';

const { T, vol, rd, rf, notional: N } = E;
const D = LAB_CONFIG.defaults;
const sqrtT = Math.sqrt(T);

/** Arg min of f on [a, b] with grid step h. */
function argMin(f: (x: number) => number, a: number, b: number, h: number): number {
  return argMax((x) => -f(x), a, b, h);
}

/** Arg max of f on [a, b] with grid step h. */
function argMax(f: (x: number) => number, a: number, b: number, h: number): number {
  let best = -Infinity;
  let arg = a;
  const n = Math.round((b - a) / h);
  for (let i = 0; i <= n; i++) {
    const x = a + i * h;
    const y = f(x);
    if (y > best) {
      best = y;
      arg = x;
    }
  }
  return arg;
}

const ROOT = process.cwd();
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8');
const mdx = (lang: 'de' | 'en', n: number) =>
  read(`src/content/modules/05-greeks/${lang}/${n}.mdx`);
/** Text without <Num />, <Fact /> and MDX comments, i.e. what is typed in by hand. */
const typed = (src: string) =>
  src
    .replace(/<Num\b[^>]*\/>/g, ' ')
    .replace(/<Fact\b[^>]*\/>/g, ' ')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, ' ');

describe('point 2: where gamma peaks', () => {
  const g = (s: number) => greeks(s, K, T, vol, rd, rf, 'call').gamma;

  it('peaks across spot at d1 = −σ√T, not at d1 = 0 (check values)', () => {
    const sPeak = gammaPeakSpot(D);
    expect(sPeak).toBeCloseTo(0.79805, 5);
    expect(g(sPeak)).toBeCloseTo(12.3786, 4);
    expect(d1d2(sPeak, K, T, vol, rd, rf).d1).toBeCloseTo(-vol * sqrtT, 12);
    // d1 = 0 lies to the right of the peak and gives less gamma; today's spot even less
    expect(M05.spotD1Zero).toBeCloseTo(0.79933, 5);
    expect(d1d2(M05.spotD1Zero, K, T, vol, rd, rf).d1).toBeCloseTo(0, 12);
    expect(M05.gammaD1Zero).toBeCloseTo(12.3687, 4);
    expect(g(E.spot)).toBeCloseTo(12.3556, 4);
    expect(M05.gammaPeak).toBeGreaterThan(M05.gammaD1Zero);
    expect(M05.gammaD1Zero).toBeGreaterThan(g(E.spot));
  });

  it('the numerical maximum over a fine spot grid equals the analytic spot', () => {
    expect(Math.abs(argMax(g, 0.76, 0.84, 1e-6) - gammaPeakSpot(D))).toBeLessThan(1e-5);
    // the same for other lab settings: long expiry, high vol, other rates
    for (const p of [
      { ...D, weeks: 52 },
      { ...D, weeks: 4, volPct: 16 },
      { ...D, weeks: 26, volPct: 12, rdPct: 2, rfPct: 5 },
    ]) {
      const t = p.weeks / 52;
      const gp = (s: number) =>
        greeks(s, K, t, p.volPct / 100, p.rdPct / 100, p.rfPct / 100, 'call').gamma;
      expect(Math.abs(argMax(gp, 0.7, 0.9, 1e-6) - gammaPeakSpot(p))).toBeLessThan(1e-5);
    }
  });

  it('matches the derivative in the derivation: ∂Γ/∂S = −(Γ/S) · [d1/(σ√T) + 1]', () => {
    const h = 1e-6;
    for (const s of [0.78, 0.79, M05.gammaPeakSpot, 0.8, 0.81]) {
      const { d1 } = d1d2(s, K, T, vol, rd, rf);
      const analytic = -(g(s) / s) * (d1 / (vol * sqrtT) + 1);
      const numeric = (g(s + h) - g(s - h)) / (2 * h);
      expect(analytic).toBeCloseTo(numeric, 4);
    }
    // zero at the peak, and F = K · e^(−1.5 σ² T) there
    const F = M05.gammaPeakSpot * Math.exp((rd - rf) * T);
    expect(F).toBeCloseTo(K * Math.exp(-1.5 * vol * vol * T), 12);
    expect(M05.gammaPeakFwdPips).toBeCloseTo(19.0, 1);
  });

  it('the gap to ATMF grows with σ²T, but ATMF gamma stays near the peak: e^(−9σ²T/8)', () => {
    const lab = (p: typeof D) => ({
      t: p.weeks / 52,
      v: p.volPct / 100,
      d: p.rdPct / 100,
      f: p.rfPct / 100,
    });
    const gapPips = (p: typeof D) => {
      const { t, d, f } = lab(p);
      return (K - gammaPeakSpot(p) * Math.exp((d - f) * t)) / PIP;
    };
    // forward below the strike at the peak: 19 pips in the example, 76 and 299 at 52 weeks
    expect(gapPips(D)).toBeCloseTo(19.0, 1);
    expect(gapPips({ ...D, weeks: 52 })).toBeCloseTo(75.8, 1);
    expect(gapPips({ ...D, weeks: 52, volPct: 16 })).toBeCloseTo(298.7, 1);
    const R = LAB_CONFIG.ranges;
    for (const weeks of [R.weeks.min, 13, 26, R.weeks.max]) {
      for (const volPct of [R.volPct.min, 8, 12, R.volPct.max]) {
        for (const [rdPct, rfPct] of [
          [D.rdPct, D.rfPct],
          [R.rdPct.min, R.rfPct.max],
          [R.rdPct.max, R.rfPct.min],
        ] as const) {
          const p = { ...D, weeks, volPct, rdPct, rfPct };
          const { t, v, d, f } = lab(p);
          const gAt = (s: number) => greeks(s, K, t, v, d, f, 'call').gamma;
          const sAtmf = K * Math.exp((f - d) * t);
          const ratio = gAt(sAtmf) / gAt(gammaPeakSpot(p));
          expect(ratio).toBeCloseTo(Math.exp((-9 / 8) * v * v * t), 12);
          expect(ratio).toBeGreaterThanOrEqual(0.97);
        }
      }
    }
  });

  it('peaks across strikes at d1 = 0', () => {
    const gk = (k: number) => greeks(E.spot, k, T, vol, rd, rf, 'call').gamma;
    const kPeak = argMax(gk, 0.77, 0.82, 1e-6);
    expect(Math.abs(d1d2(E.spot, kPeak, T, vol, rd, rf).d1)).toBeLessThan(1e-3);
  });

  it('registers the numbers shown in the text', () => {
    expect(formatNum(getNum('m05.gammaPeakSpot'), 'de')).toBe('0.7981');
    expect(formatNum(getNum('m05.gammaPeak'), 'de')).toBe('12.38');
    expect(formatNum(getNum('m05.spotD1Zero'), 'de')).toBe('0.7993');
    expect(formatNum(getNum('m05.gammaD1Zero'), 'de')).toBe('12.37');
    expect(formatNum(getNum('m05.gamma'), 'de')).toBe('12.36');
    expect(formatNum(getNum('m05.gammaPeakFwdPips'), 'de')).toBe('19');
  });
});

describe('point 2: where vega peaks (consistency in 05.3)', () => {
  const v = (s: number) => greeks(s, K, T, vol, rd, rf, 'call').vega;

  it('peaks across spot at d1 = +σ√T, i.e. d2 = 0 (check value 0.80061)', () => {
    const sPeak = vegaPeakSpot(D);
    expect(sPeak).toBeCloseTo(0.80061, 5);
    const { d1, d2 } = d1d2(sPeak, K, T, vol, rd, rf);
    expect(d1).toBeCloseTo(vol * sqrtT, 12);
    expect(d2).toBeCloseTo(0, 12);
    expect(Math.abs(argMax(v, 0.76, 0.84, 1e-6) - sPeak)).toBeLessThan(1e-5);
    expect(formatNum(getNum('m05.vegaPeakSpot'), 'de')).toBe('0.8006');
  });

  it('peaks across strikes at d1 = 0', () => {
    const vk = (k: number) => greeks(E.spot, k, T, vol, rd, rf, 'call').vega;
    const kPeak = argMax(vk, 0.77, 0.82, 1e-6);
    expect(Math.abs(d1d2(E.spot, kPeak, T, vol, rd, rf).d1)).toBeLessThan(1e-3);
  });
});

describe('point 2 review: only the gamma share of theta peaks near ATMF', () => {
  const full = (s: number, t: number = T) => thetaOneDay(s, K, t, vol, rd, rf, 'call') * N;
  const share = (s: number) =>
    thetaGammaShare(s, vol, greeks(s, K, T, vol, rd, rf, 'call').gamma) * N;

  it('the gamma share −½σ²S²Γ peaks with vega at d1 = +σ√T (check value CHF −69.34)', () => {
    const sMin = argMin(share, 0.76, 0.84, 1e-6);
    expect(Math.abs(sMin - vegaPeakSpot(D))).toBeLessThan(1e-5);
    expect(share(vegaPeakSpot(D))).toBeCloseTo(-69.339, 3);
  });

  it('the full one-day theta of the lab is most negative far left of ATMF at 13 weeks', () => {
    // check values: CHF −30.83 at today's spot (forward at the strike), −37.36 at 0.7862
    expect(full(E.spot)).toBeCloseTo(-30.825, 3);
    expect(full(0.7862)).toBeCloseTo(-37.357, 3);
    expect(full(0.7862)).toBeLessThan(full(E.spot) - 6);
    const sMin = argMin(full, 0.76, 0.84, 1e-5);
    expect(sMin).toBeCloseTo(0.78625, 4);
    expect((K - sMin * Math.exp((rd - rf) * T)) / PIP).toBeGreaterThan(100);
  });

  it('in the last weeks the full theta is most negative close to ATMF (05.4)', () => {
    for (const weeks of [1, 2, 4]) {
      const t = weeks / 52;
      const sMin = argMin((s) => full(s, t), 0.76, 0.84, 1e-5);
      expect((K - sMin * Math.exp((rd - rf) * t)) / PIP, `${weeks} weeks`).toBeLessThan(50);
    }
  });
});

describe('point 10: delta deep in the money', () => {
  const dff = Math.exp(-rf * T);
  const dfd = Math.exp(-rd * T);

  it('spot delta tends to e^(−rf T), forward delta to 1 (check value 0.991288)', () => {
    expect(dff).toBeCloseTo(0.991288, 6);
    for (const s of [1.2, 1.6, 2.4]) {
      const g = greeks(s, K, T, vol, rd, rf, 'call');
      expect(Math.abs(g.delta - dff)).toBeLessThan(1e-6);
      expect(Math.abs(g.deltaFwd - 1)).toBeLessThan(1e-6);
    }
    expect(M05.spotDeltaLimit).toBeCloseTo(greeks(2.4, K, T, vol, rd, rf, 'call').delta, 12);
    expect(formatNum(getNum('m05.spotDeltaLimit'), 'de')).toBe('0.991');
    expect(formatNum(getNum('m05.spotDeltaLimit'), 'en')).toBe('0.991');
  });

  it('is the spot delta of a forward: the call turns into a forward', () => {
    const fwd = (s: number) => s * dff - K * dfd;
    const h = 1e-6;
    expect((fwd(0.9 + h) - fwd(0.9 - h)) / (2 * h)).toBeCloseTo(dff, 9);
    expect(gkPrice(1.6, K, T, vol, rd, rf, 'call') - fwd(1.6)).toBeCloseTo(0, 9);
  });

  it('stays between 0 and e^(−rf T) for every spot, so a change above 1 is impossible', () => {
    for (let s = 0.6; s <= 1.2; s += 0.01) {
      const d = greeks(s, K, T, vol, rd, rf, 'call').delta;
      expect(d).toBeGreaterThan(0);
      expect(d).toBeLessThanOrEqual(dff);
    }
  });
});

describe('texts, quiz, glossary and lab (DE and EN)', () => {
  it('05.2 states the spot-delta limit and the exact gamma peak, then the rule of thumb', () => {
    for (const lang of ['de', 'en'] as const) {
      const src = mdx(lang, 2);
      expect(src.match(/m05\.spotDeltaLimit/g)?.length, lang).toBe(2);
      expect(src.match(/m05\.gammaPeakSpot/g)?.length, lang).toBe(2);
      expect(src).toContain('<i>d</i><sub>1</sub> = −σ√<i>T</i>');
      expect(src).toContain('**5.**');
    }
    expect(mdx('de', 2)).toContain('Faustregel');
    expect(mdx('en', 2)).toContain('rule of thumb');
    expect(mdx('de', 2)).toContain('Das Forward-Delta läuft gegen 1.');
    expect(mdx('en', 2)).toContain('The forward delta heads towards 1.');
    // the example result is labelled as such, and the σ²T drift of the peak is named
    expect(mdx('de', 2)).toContain('Im Beispiel sind die Unterschiede klein.');
    expect(mdx('en', 2)).toContain('In the example the differences are small.');
    for (const lang of ['de', 'en'] as const) expect(mdx(lang, 2)).toContain('σ²<i>T</i>.');
  });

  it('05.2 ties the theta claim to the gamma share, 05.4 to the last weeks', () => {
    expect(mdx('de', 2)).toContain(
      'Dort ist auch der Gamma-Anteil des Thetas am grössten, der eigentliche Zeitwertverlust.',
    );
    expect(mdx('en', 2)).toContain(
      'That is also where the gamma share of theta, the actual loss of time value, is largest.',
    );
    expect(mdx('de', 4)).toContain(
      'In diesen letzten Wochen trifft es Optionen nahe am Forward am stärksten',
    );
    expect(mdx('en', 4)).toContain(
      'In those last weeks, options close to the forward are hit hardest',
    );
  });

  it('German texts say «in Abhängigkeit vom Spot», not the ambiguous «über dem Spot»', () => {
    for (const src of [mdx('de', 2), mdx('de', 3), getGlossaryEntry('gamma')!.def.de]) {
      expect(src).not.toMatch(/Maximum über dem Spot|Über dem Spot liegt das Maximum/);
      expect(src).toMatch(/[Ii]n Abhängigkeit vom Spot/);
    }
  });

  it('05.3 places the vega peak at d1 = +σ√T and points to the gamma peak', () => {
    for (const lang of ['de', 'en'] as const) {
      const src = mdx(lang, 3);
      expect(src).toContain('<i>d</i><sub>1</sub> = +σ√<i>T</i>');
      expect(src).toContain('<i>d</i><sub>1</sub> = −σ√<i>T</i>');
      expect(src).toContain('m05.vegaPeakSpot');
    }
  });

  it('05.1 and 05.3 say how vega is hedged (point 11)', () => {
    for (const n of [1, 3]) {
      expect(mdx('de', n)).toContain(
        'Mit Spot und Forwards lässt sich Vega nicht absichern, sie haben kein Vega. Am FX-Desk nimmt man dafür andere Optionen, seltener Volatilitäts- oder Varianz-Swaps.',
      );
      expect(mdx('en', n)).toContain(
        'Vega cannot be hedged with spot or forwards: they have no vega. On an FX desk other options do that job, less often volatility or variance swaps.',
      );
    }
  });

  it('types none of the new check values by hand', () => {
    const literals = ['0.991', '0.7981', '0.7980', '0.7993', '0.8006', '12.38', '12.37', '0.7862'];
    const files = [1, 2, 3, 4].flatMap((n) => [typed(mdx('de', n)), typed(mdx('en', n))]);
    files.push(read('src/content/quiz/05-greeks.ts'), read('src/i18n/dict/greekslab.ts'));
    for (const id of ['gamma', 'delta', 'vega']) {
      const e = getGlossaryEntry(id)!;
      files.push(e.def.de, e.def.en);
    }
    for (const f of files) {
      for (const lit of literals) expect(f.includes(lit), lit).toBe(false);
    }
  });

  it('the quiz takes the spot-delta limit from the core', () => {
    const c2 = quiz.checks['2'];
    expect(c2.options[2]!.explain.de).toContain('Spot-Delta');
    expect(c2.options[2]!.explain.de).toContain('0.991');
    expect(c2.options[2]!.explain.en).toContain('0.991');
    const q1 = quiz.quiz[0]!;
    expect(q1.options[1]!.explain.de).toContain('Spot-Position');
    expect(q1.options[1]!.explain.en).toContain('spot position');
  });

  it('the glossary gives the exact gamma peak and the rule of thumb', () => {
    const e = getGlossaryEntry('gamma')!;
    expect(e.def.de).toContain('d1 = −σ√T');
    expect(e.def.en).toContain('d1 = −σ√T');
    expect(e.def.de).toContain('Faustregel');
    expect(e.def.en).toContain('rule of thumb');
  });

  it('the lab annotation names the forward delta when it heads towards 1', () => {
    expect(greekslab.de['gl.aha.deltaHigh.t']).toContain('Forward-Delta');
    expect(greekslab.en['gl.aha.deltaHigh.t']).toContain('Forward delta');
  });
});

describe('old wordings are gone from src', () => {
  const OLD = [
    'tief im Geld fast eins',
    'deep in the money close to one',
    ': Delta läuft gegen eins',
    ': delta heads towards one',
    'Gamma am Strike am grössten',
    'gamma peaks at the strike',
    'wo der Forward beim Strike liegt, ändert es sich am schnellsten',
    'where the forward sits at the strike, it changes fastest',
    'Erst dort liegt der Forward am Strike',
    'Only there does the forward sit at the strike',
    'jeder Tag am meisten Zeitwert',
    'each day costs the most time value',
    'wird Gamma am Strike umso grösser',
    'gamma at the strike grows',
    'Gamma peaks near ATMF, where the forward sits at the strike',
    'Nahe ATMF, wo der Forward beim Strike liegt, ist Gamma am grössten',
    'Am grössten ist Gamma nahe ATMF (Forward beim Strike)',
    'Gamma is largest near ATMF (forward at the strike)',
    'Vega lässt sich nur mit anderen Optionen absichern',
    'Vega can only be hedged with other options',
    'Delta kann ohnehin nie über 1 steigen',
    'Delta can never exceed 1 anyway',
    'Gewinn eines Forwards über USD 1 Mio., also Delta 1',
    'gain on a forward over USD 1m, i.e. delta 1',
    // the old lab annotation titles as whole dict values (bare, they would block «Forward-Delta …»)
    "'Delta Richtung 1'",
    "'Delta towards 1'",
  ];
  const files = [
    ...[1, 2, 3, 4].flatMap((n) => [mdx('de', n), mdx('en', n)]),
    read('src/content/quiz/05-greeks.ts'),
    read('src/content/glossary.ts'),
    read('src/i18n/dict/greekslab.ts'),
  ];
  it.each(OLD)('"%s"', (phrase) => {
    // case-insensitive, as a lint guard may be
    for (const f of files) expect(f.toLowerCase().includes(phrase.toLowerCase())).toBe(false);
  });
});
