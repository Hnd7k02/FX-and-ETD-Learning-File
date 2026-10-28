/**
 * Module 07, Version 6 review, points 1 and 9.
 *
 * Point 1 (double barrier, 07.4): «the narrower the corridor, the cheaper» holds for the double
 * knock-out (and the double no-touch) only. The double knock-in comes to life more often and
 * gets dearer; without a rebate both add up to the vanilla (in-out parity, Hull «Exotic
 * Options»). Checked pathwise on daily GBM paths of the core (src/lib/fx/mc/gbm) and with the
 * core's double no-touch series (continuous monitoring).
 *
 * The single-barrier twin (07.1 BarrierPaths caption): moving the barrier closer to spot makes
 * the knock-out cheaper and the knock-in dearer (core pathsSummary over the slider range).
 *
 * Point 9 (barrier and jump, 07.4): a stop needs a tradable price at its level to be filled
 * there, a barrier needs no price at its level: a jump past it triggers it all the same. The
 * barrier itself needs no continuous rate; only its pricing formulas (and the hedging based on
 * them) assume one. A level counts as hit at or beyond it. Checked on the ECB fixings of the
 * franc-shock replay (src/lib/m07/gap) and on the texts.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { getGlossaryEntry } from '@/content/glossary';
import { quiz } from '@/content/quiz/07-barrier-binary';
import { gapreplay } from '@/i18n/dict/gapreplay';
import { doubleNoTouch, doubleOneTouch } from '@/lib/fx/exotics/doubleNoTouch';
import { simulate } from '@/lib/fx/mc/gbm';
import { gkPrice } from '@/lib/fx/vanilla';
import { M07_CONFIG, PIP } from '@/lib/m07/config';
import { fixingsWindow, gapOrders, gapSummary } from '@/lib/m07/gap';
import { M07_MARKET, firstHit, pathsSummary } from '@/lib/m07/paths';

const LANGS = ['de', 'en'] as const;
type Lang = (typeof LANGS)[number];
const ROOT = process.cwd();

function section(lang: Lang, n: number): string {
  return readFileSync(
    join(ROOT, 'src/content/modules/07-barrier-binary', lang, `${n}.mdx`),
    'utf8',
  );
}

/** The paragraph of a section that starts with `start`. */
function paragraph(lang: Lang, n: number, start: string): string {
  const block = section(lang, n)
    .split(/\n[ \t]*\n/)
    .find((b) => b.trim().startsWith(start));
  expect(block, `${lang} ${n}: paragraph «${start}»`).toBeDefined();
  return block!;
}

/** Text between an opening tag and its closing tag (first occurrence). */
function block(lang: Lang, n: number, open: string, close: string): string {
  const src = section(lang, n);
  const from = src.indexOf(open);
  expect(from, `${lang} ${n}: ${open}`).toBeGreaterThanOrEqual(0);
  return src.slice(from, src.indexOf(close, from));
}

/* ---------- Point 1: double knock-out and double knock-in ---------- */

interface DoubleBarrierMc {
  /** Prices in pips per USD (CHF per USD / PIP), discounted with e^(−rd T). */
  dko: number;
  dki: number;
  vanilla: number;
  /** Share of paths that touch a barrier (risk-neutral, not a forecast). */
  touch: number;
  /** Pathwise payoffs (undiscounted) for the comparison of two corridors. */
  dkoPay: Float64Array;
  dkiPay: Float64Array;
  /** Largest pathwise |DKO + DKI − vanilla|. */
  parityError: number;
}

const C = M07_CONFIG;
const K = C.strike;
const DAYS = 91;
const PATHS = 40_000;
const SEED = 11;
/** Wide corridor: the two barriers of the module (0.7760 / 0.8240). */
const WIDE = [C.barriers.down, C.barriers.up] as const;
/** Narrow corridor nested inside it, halfway to the spot (0.7880 / 0.8120). */
const NARROW = [
  (C.market.spot + C.barriers.down) / 2,
  (C.market.spot + C.barriers.up) / 2,
] as const;

function doubleBarrierMc(L: number, U: number): DoubleBarrierMc {
  const dkoPay = new Float64Array(PATHS);
  const dkiPay = new Float64Array(PATHS);
  let ko = 0;
  let ki = 0;
  let van = 0;
  let hits = 0;
  let parityError = 0;
  simulate(M07_MARKET, { paths: PATHS, days: DAYS, seed: SEED }, (path, i) => {
    let hit = false;
    for (let d = 0; d <= DAYS; d++) {
      if (path[d]! <= L || path[d]! >= U) {
        hit = true;
        break;
      }
    }
    const pay = Math.max(path[DAYS]! - K, 0);
    dkoPay[i] = hit ? 0 : pay;
    dkiPay[i] = hit ? pay : 0;
    parityError = Math.max(parityError, Math.abs(dkoPay[i]! + dkiPay[i]! - pay));
    ko += dkoPay[i]!;
    ki += dkiPay[i]!;
    van += pay;
    if (hit) hits++;
  });
  const df = Math.exp((-C.market.rd * DAYS) / 365);
  const pips = (sum: number) => ((sum / PATHS) * df) / PIP;
  return {
    dko: pips(ko),
    dki: pips(ki),
    vanilla: pips(van),
    touch: hits / PATHS,
    dkoPay,
    dkiPay,
    parityError,
  };
}

describe('point 1: a narrower corridor makes the double knock-out cheaper and the knock-in dearer', () => {
  const wide = doubleBarrierMc(WIDE[0], WIDE[1]);
  const narrow = doubleBarrierMc(NARROW[0], NARROW[1]);

  it('uses nested corridors around the spot', () => {
    expect(WIDE[0]).toBeCloseTo(0.776, 10);
    expect(WIDE[1]).toBeCloseTo(0.824, 10);
    expect(NARROW[0]).toBeCloseTo(0.788, 10);
    expect(NARROW[1]).toBeCloseTo(0.812, 10);
    expect(WIDE[0]).toBeLessThan(NARROW[0]);
    expect(NARROW[1]).toBeLessThan(WIDE[1]);
  });

  it('in-out parity holds on every path (no rebate)', () => {
    expect(wide.parityError).toBe(0);
    expect(narrow.parityError).toBe(0);
    expect(wide.dko + wide.dki).toBeCloseTo(wide.vanilla, 9);
    expect(narrow.dko + narrow.dki).toBeCloseTo(narrow.vanilla, 9);
  });

  it('pathwise: the narrow knock-out never pays more, the narrow knock-in never less', () => {
    for (let i = 0; i < PATHS; i++) {
      expect(narrow.dkoPay[i]!).toBeLessThanOrEqual(wide.dkoPay[i]!);
      expect(narrow.dkiPay[i]!).toBeGreaterThanOrEqual(wide.dkiPay[i]!);
    }
  });

  it('prices: double knock-out cheaper, double knock-in dearer, touch likelier', () => {
    // check values (daily monitoring, 40'000 antithetic paths, seed 11), pips per USD:
    // wide DKO 15.26 + DKI 111.12 = vanilla 126.38; narrow DKO 0.17 + DKI 126.22 = 126.38
    expect(wide.dko).toBeGreaterThan(13);
    expect(wide.dko).toBeLessThan(18);
    expect(wide.dki).toBeGreaterThan(108);
    expect(wide.dki).toBeLessThan(114);
    expect(narrow.dko).toBeGreaterThan(0.05);
    expect(narrow.dko).toBeLessThan(0.5);
    expect(narrow.dki).toBeGreaterThan(125);
    expect(narrow.dko).toBeLessThan(wide.dko);
    expect(narrow.dki).toBeGreaterThan(wide.dki);
    // risk-neutral touch probabilities, not a forecast: about 80.7 % and 99.8 %
    expect(wide.touch).toBeGreaterThan(0.78);
    expect(wide.touch).toBeLessThan(0.84);
    expect(narrow.touch).toBeGreaterThan(0.99);
    expect(narrow.touch).toBeGreaterThan(wide.touch);
  });

  it('the Monte Carlo vanilla matches Garman-Kohlhagen (same paths for both corridors)', () => {
    const gk =
      gkPrice(C.market.spot, K, DAYS / 365, C.market.vol, C.market.rd, C.market.rf, 'call') / PIP;
    expect(wide.vanilla).toBe(narrow.vanilla);
    expect(Math.abs(wide.vanilla - gk)).toBeLessThan(2);
  });

  it('the digital relative (double no-touch, continuous) also gets cheaper; the double one-touch dearer', () => {
    const p = {
      S: C.market.spot,
      T: C.market.T,
      vol: C.market.vol,
      rd: C.market.rd,
      rf: C.market.rf,
    };
    const dntWide = doubleNoTouch({ ...p, L: WIDE[0], U: WIDE[1] });
    const dntNarrow = doubleNoTouch({ ...p, L: NARROW[0], U: NARROW[1] });
    const dotWide = doubleOneTouch({ ...p, L: WIDE[0], U: WIDE[1] });
    const dotNarrow = doubleOneTouch({ ...p, L: NARROW[0], U: NARROW[1] });
    // check values: about 0.1390 and 0.0002 per 1 of payout (CHF rate 0 %: no discounting)
    expect(dntWide).toBeGreaterThan(0.12);
    expect(dntWide).toBeLessThan(0.16);
    expect(dntNarrow).toBeGreaterThan(0);
    expect(dntNarrow).toBeLessThan(0.001);
    expect(dntNarrow).toBeLessThan(dntWide);
    expect(dotNarrow).toBeGreaterThan(dotWide);
    const df = Math.exp(-C.market.rd * C.market.T);
    expect(dntWide + dotWide).toBeCloseTo(df, 12);
    expect(dntNarrow + dotNarrow).toBeCloseTo(df, 12);
  });
});

describe('point 1: texts', () => {
  it.each(LANGS)(
    '07.4 double barrier paragraph treats knock-out and knock-in apart (%s)',
    (lang) => {
      const p = paragraph(lang, 4, lang === 'de' ? '**Double Barrier.**' : '**Double barrier.**');
      if (lang === 'de') {
        expect(p).toContain('desto billiger der Double Knock-out');
        expect(p).toContain(
          'Der Double Knock-in wird dagegen teurer: Dasselbe Ereignis lässt ihn häufiger entstehen.',
        );
        expect(p).toMatch(/Ohne Rebate ergeben Double Knock-out und Double Knock-in/);
        expect(p).toContain('zusammen den Vanilla');
      } else {
        expect(p).toContain('the cheaper the double knock-out');
        expect(p).toContain(
          'The double knock-in, by contrast, gets dearer: the same event brings it to life more often.',
        );
        expect(p).toMatch(/Without a rebate, a double knock-out and a double knock-in/);
        expect(p).toContain('add up to the vanilla');
      }
    },
  );

  it.each(LANGS)(
    'the glossary double barrier names both and the parity without rebate (%s)',
    (lang) => {
      const e = getGlossaryEntry('double-barrier')!;
      expect(e.aliases).toEqual(expect.arrayContaining(['Double Knock-out', 'Double Knock-in']));
      const def = e.def[lang];
      expect(def).toMatch(
        lang === 'de' ? /Double Knock-in entsteht/ : /double knock-in comes to life/,
      );
      expect(def).toMatch(
        lang === 'de'
          ? /desto billiger der Knock-out und desto teurer der Knock-in/
          : /the cheaper the knock-out and the dearer the knock-in/,
      );
      expect(def).toMatch(lang === 'de' ? /ohne Rebate/ : /without a rebate/);
    },
  );
});

/* ---------- Single barrier twin (07.1): closer barrier, cheaper knock-out, dearer knock-in ---------- */

describe('07.1 BarrierPaths: a barrier closer to spot', () => {
  const r = C.paths.barrier;
  const S = C.market.spot;
  const steps = (from: number, to: number) => {
    const out: number[] = [];
    const n = Math.round(Math.abs(to - from) / r.step);
    for (let i = 0; i <= n; i++) out.push(from + Math.sign(to - from) * i * r.step);
    return out;
  };
  // the whole slider range, walked from the far end towards the spot (spot itself excluded)
  const up = steps(r.max, S + r.step);
  const down = steps(r.min, S - r.step);

  it('walks the slider range on both sides of the spot', () => {
    expect(r.min).toBeLessThan(S);
    expect(r.max).toBeGreaterThan(S);
    expect(up.length).toBeGreaterThan(10);
    expect(down.length).toBeGreaterThan(10);
  });

  it.each([
    ['up', up],
    ['down', down],
  ] as const)(
    '%s: knock-out never dearer, knock-in never cheaper, together the vanilla',
    (_dir, levels) => {
      let prev = { out: Infinity, in: -Infinity };
      for (const H of levels) {
        const o = pathsSummary(H, 'out');
        const i = pathsSummary(H, 'in');
        expect(o.price + i.price, `parity at ${H}`).toBeCloseTo(o.vanilla, 12);
        expect(o.price, `KO at ${H}`).toBeLessThanOrEqual(prev.out + 1e-12);
        expect(i.price, `KI at ${H}`).toBeGreaterThanOrEqual(prev.in - 1e-12);
        prev = { out: o.price, in: i.price };
      }
    },
  );

  it('check values in pips (continuous monitoring, strike = forward, vanilla 126.69)', () => {
    const pips = (H: number, io: 'in' | 'out') => pathsSummary(H, io).price / PIP;
    expect(pathsSummary(0.84, 'out').vanilla / PIP).toBeCloseTo(126.69, 2);
    // up: 0.84 → 0.82
    expect(pips(0.84, 'out')).toBeCloseTo(54.3, 1);
    expect(pips(0.84, 'in')).toBeCloseTo(72.39, 1);
    expect(pips(0.82, 'out')).toBeCloseTo(10.77, 1);
    expect(pips(0.82, 'in')).toBeCloseTo(115.92, 1);
    // down: 0.77 → 0.79
    expect(pips(0.77, 'out')).toBeCloseTo(121.5, 1);
    expect(pips(0.77, 'in')).toBeCloseTo(5.19, 1);
    expect(pips(0.79, 'out')).toBeCloseTo(68.05, 1);
    expect(pips(0.79, 'in')).toBeCloseTo(58.64, 1);
  });

  it.each(LANGS)('the caption says both directions (%s)', (lang) => {
    const src = section(lang, 1);
    expect(src).toContain(
      lang === 'de'
        ? 'Zieh die Barriere näher an den Spot: Der Knock-out wird billiger, der Knock-in teurer.'
        : 'Drag the barrier closer to spot: the knock-out gets cheaper, the knock-in dearer.',
    );
  });
});

/* ---------- Point 9: a barrier needs no tradable price ---------- */

describe('point 9: a jump past a barrier triggers it', () => {
  const raw = readFileSync(join(ROOT, 'data/raw/ecb-eur-reference.csv'), 'utf8');
  const g = C.gap;
  const s = gapSummary(fixingsWindow(raw, g.pair, g.from, g.to));

  it('every knock-out barrier is triggered on the shock fixing without a fixing at its level', () => {
    expect(s.shockIndex).toBeGreaterThan(0);
    expect(s.knockOuts).toHaveLength(g.knockOuts.length);
    for (const ko of s.knockOuts) {
      expect(ko.index, `KO ${ko.level}`).toBe(s.shockIndex);
      // the series jumps from above the level to below it: no rate at the barrier
      expect(ko.before).toBeGreaterThan(ko.level);
      expect(ko.fill).toBeLessThan(ko.level);
      expect(s.series.some((p) => p.value === ko.level)).toBe(false);
    }
  });

  it('the stop is filled beyond its level, at the next price the series knows', () => {
    expect(s.stop.index).toBe(s.shockIndex);
    expect(s.stop.fill).toBe(s.shock);
    expect(s.stop.gapPips).toBeGreaterThan(0);
  });

  it('the path logic of the figures counts a level beyond the barrier as a touch', () => {
    // a jump straight across the barrier, no point at the level
    expect(firstHit([0.8, 0.79, 0.75, 0.74], 0.776, 'down')).toBe(2);
    expect(firstHit([0.8, 0.81, 0.86], 0.824, 'up')).toBe(2);
    // a point exactly at the level counts too (at or beyond)
    expect(firstHit([0.8, 0.79, 0.776, 0.75], 0.776, 'down')).toBe(2);
  });

  it('the replay triggers a level at or beyond it, as its notes say', () => {
    const pts = [1.21, 1.205, 1.2, 1.15].map((value, i) => ({ date: `2015-01-0${i + 1}`, value }));
    const [atLevel, jumped] = gapOrders(pts, [1.2, 1.18]);
    expect(atLevel!.index).toBe(2);
    expect(atLevel!.gapPips).toBeCloseTo(0, 9);
    expect(jumped!.index).toBe(3);
    expect(jumped!.gapPips).toBeCloseTo(300, 6);
    for (const key of ['gr.tableSub', 'gr.note'] as const) {
      expect(gapreplay.de[key]).toContain('ersten Fixing auf oder jenseits des Niveaus');
      expect(gapreplay.en[key]).toContain('first fixing at or beyond the level');
    }
  });
});

/** Old wordings (point 9 and the one-sided corridor claim of point 1) that must not come back. */
const OLD_WORDINGS = [
  'Stops und Barrieren setzen voraus, dass der Kurs stetig läuft',
  'Stops setzen einen handelbaren Markt voraus, Barrieren einen stetigen Kursverlauf',
  'Um eine Barriere zu durchqueren, muss er jeden Kurs dazwischen einmal erreichen',
  'Auch Barrieren werden übersprungen',
  'Je enger der Korridor, desto billiger, und desto wahrscheinlicher das Aus',
  'Stops and barriers assume that the rate moves continuously',
  'Stops assume a market you can trade in, barriers a rate that moves continuously',
  'To cross a barrier it must pass through every rate in between once',
  'Barriers are jumped over too',
  'The narrower the corridor, the cheaper the option, and the likelier the end',
  // review round 2: «nur» must be limited to the barrier (stops and hedges rely on continuity too)
  'Einen stetigen Kurs setzen nur die Bewertungsformeln voraus',
  'Only the pricing formulas assume a continuous rate',
  // review round 2: the knock-in gets dearer as the barrier moves closer
  'Zieh die Barriere näher an den Spot und schau, wie der Preis fällt',
  'Drag the barrier closer to spot and watch the price fall',
  // review round 2: a level counts at or beyond it; a barrier needs no price at its level
  'Bei stetiger Beobachtung zählt der erste Kurs jenseits der Barriere',
  'With continuous observation, the first rate beyond the barrier counts',
  'Eine Barriere braucht dagegen keinen handelbaren Kurs:',
  'A barrier, by contrast, needs no tradable price:',
  'zum ersten Fixing jenseits des Niveaus',
  'at the first fixing beyond the level',
];

/** A sentence that makes the triggering of a barrier depend on a continuous rate. */
const BARRIER_NEEDS_CONTINUITY = [
  /Barrieren?\s+(setzen|setzt|brauchen|braucht)\s+(?![^.]*\b(kein|keine|keinen|nicht)\b)[^.]*(stetig|handelbar)/,
  /Barrieren\s+einen\s+stetigen/,
  /barriers?\s+(assume|assumes|need|needs)\s+(?![^.]*\b(no|not)\b)[^.]*(continuous|tradable|trade)/i,
  /barriers\s+a\s+rate\s+that\s+moves\s+continuously/i,
];

function walk(dir: string, re: RegExp, out: string[] = []): string[] {
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, ent.name);
    if (ent.isDirectory()) walk(p, re, out);
    else if (re.test(ent.name)) out.push(p);
  }
  return out;
}

describe('point 9: texts', () => {
  const files = [
    ...walk(join(ROOT, 'src/content'), /\.(mdx|ts)$/),
    ...walk(join(ROOT, 'src/i18n/dict'), /\.ts$/),
    ...walk(join(ROOT, 'src/components'), /\.(tsx|astro)$/),
    ...walk(join(ROOT, 'src/data'), /\.(ts|json)$/),
  ];

  it('scans the texts, quiz, glossary, dictionaries and components', () => {
    expect(files.length).toBeGreaterThan(100);
  });

  it('no old wording comes back', () => {
    const hits = files.flatMap((f) => {
      const text = readFileSync(f, 'utf8');
      return OLD_WORDINGS.filter((w) => text.includes(w)).map((w) => `${f}: ${w}`);
    });
    expect(hits).toEqual([]);
  });

  it('no text makes a barrier depend on a continuous rate or a tradable price', () => {
    const hits = files.flatMap((f) => {
      const text = readFileSync(f, 'utf8');
      return BARRIER_NEEDS_CONTINUITY.filter((re) => re.test(text)).map((re) => `${f}: ${re}`);
    });
    expect(hits).toEqual([]);
  });

  it('knows the wrong claims it guards against', () => {
    const old = [
      'Stops setzen einen handelbaren Markt voraus, Barrieren einen stetigen Kursverlauf.',
      'Stops assume a market you can trade in, barriers a rate that moves continuously.',
      'Barrieren setzen einen stetigen Kurs voraus.',
      'Barriers need a tradable price.',
    ];
    for (const t of old) {
      expect(
        BARRIER_NEEDS_CONTINUITY.some((re) => re.test(t)),
        t,
      ).toBe(true);
    }
    for (const t of [
      'Eine Barriere braucht keinen solchen Kurs.',
      'Eine Barriere braucht dagegen keinen handelbaren Kurs.',
      'A barrier needs no tradable price.',
      'Barriers do not need a continuous rate.',
    ]) {
      expect(
        BARRIER_NEEDS_CONTINUITY.some((re) => re.test(t)),
        t,
      ).toBe(false);
    }
  });

  it.each(LANGS)('07.4 keeps the model assumption and says what a jump does (%s)', (lang) => {
    const gap = paragraph(
      lang,
      4,
      lang === 'de' ? 'Die Bewertungsformeln dieses Moduls' : 'The pricing formulas in this module',
    );
    expect(gap).toMatch(
      lang === 'de'
        ? /dass der Kurs stetig läuft, ohne Sprünge/
        : /moves continuously, without jumps/,
    );
    expect(gap).toMatch(lang === 'de' ? /Annahme des Modells/ : /assumption of the model/);

    const risk = block(lang, 4, '<Callout variant="warn"', '</Callout>');
    const take = block(lang, 4, '<Takeaway>', '</Takeaway>');
    for (const [name, text] of [
      ['risk box', risk],
      ['takeaway', take],
    ] as const) {
      if (lang === 'de') {
        expect(text, name).toContain(
          'Ein Stop braucht einen handelbaren Kurs am Stop-Niveau, um dort ausgeführt zu werden.',
        );
        expect(text, name).toMatch(
          /Springt der Kurs über sie hinweg, ist sie trotzdem ausgelöst\./,
        );
        // «nur» is limited to the barrier: stops and hedges also rely on a continuous rate
        expect(text, name).toMatch(/Die Barriere selbst braucht (auch )?keinen stetigen Kurs\./);
        expect(text, name).toContain(
          'Den setzen nur ihre Bewertungsformeln und das Hedging nach diesen Formeln voraus. Darum unterschätzen die Formeln Gap-Risiken.',
        );
      } else {
        expect(text, name).toContain(
          'A stop needs a tradable price at the stop level to be filled there.',
        );
        expect(text, name).toMatch(/if the rate jumps past it, it is triggered all the same\./);
        expect(text, name).toMatch(/The barrier itself needs no continuous rate( either)?\./);
        expect(text, name).toContain(
          'Only its pricing formulas and the hedging based on them assume one. That is why the formulas underestimate gap risk.',
        );
      }
    }
    expect(risk).toMatch(
      lang === 'de'
        ? /Eine Barriere braucht keinen Kurs an ihrem Niveau: /
        : /A barrier needs no price at its level: /,
    );

    // the loss scenario counts the first rate at or beyond the barrier; after a jump, beyond it
    const loss = block(lang, 4, '<Callout variant="bad"', '</Callout>');
    expect(loss).toContain(
      lang === 'de'
        ? 'Bei stetiger Beobachtung zählt der erste Kurs auf oder jenseits der Barriere, nach den Regeln im Term Sheet. Nach einem Sprung liegt er dahinter.'
        : 'With continuous observation, the first rate at or beyond the barrier counts, under the rules in the term sheet. After a jump it lies beyond the barrier.',
    );
    // the knock-out is extinguished without a trade
    expect(take).toMatch(
      lang === 'de' ? /Beim Knock-out wird dabei nichts gehandelt/ : /A knock-out trades nothing/,
    );
  });

  it.each(LANGS)('the gap check says a barrier is triggered by the jump (%s)', (lang) => {
    const c4 = quiz.checks['4'];
    const right = c4.options[c4.correct]!.explain[lang];
    expect(right).toMatch(
      lang === 'de'
        ? /Eine Barriere braucht dagegen keinen handelbaren Kurs an ihrem Niveau: Springt das Fixing über sie hinweg, ist sie trotzdem ausgelöst\./
        : /A barrier, by contrast, needs no tradable price at its level: if the fixing jumps past it, it is triggered all the same\./,
    );
    expect(right).toMatch(
      lang === 'de'
        ? /Ein Knock-out ist dabei keine Transaktion: /
        : /A knock-out is not a transaction here: /,
    );
  });

  it.each(LANGS)(
    'the glossary: barriers count as touched in a gap; formulas underestimate it (%s)',
    (lang) => {
      const gap = getGlossaryEntry('gap-risk')!.def[lang];
      expect(gap).toMatch(
        lang === 'de' ? /Barrieren gelten trotzdem als berührt/ : /barriers still count as touched/,
      );
      expect(gap).toMatch(
        lang === 'de'
          ? /Bewertungsformeln mit stetigem Kurs unterschätzen/
          : /pricing formulas with a continuous rate underestimate/,
      );
      for (const id of ['knock-out', 'knock-in']) {
        const def = getGlossaryEntry(id)!.def[lang];
        expect(def, id).toMatch(
          lang === 'de' ? /erreicht oder durchbricht/ : /reaches or breaches/,
        );
      }
    },
  );
});
