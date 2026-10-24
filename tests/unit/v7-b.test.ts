/**
 * Version 7, Block B (Review 3, 24.10.2026):
 *  - B0: the premium-adjusted delta is the spot delta minus the premium, both per unit of
 *    notional, Δ_pa = Δ − V/S. In closed form that is (K/S)·e^(−rd T)·N(d2) for the call and
 *    −(K/S)·e^(−rd T)·N(−d2) for the put; the glossary entry names the unit, the formula and
 *    the pair-dependent convention and never claims the premium is "not simply subtracted",
 *  - B2 to B6: the sharpened wordings stand in DE and EN (reference rates of the same tenor,
 *    spot-start swap, "in the model", "in the example", knock-in before the barrier) and the
 *    retired absolute sentences are gone. B1, B7 and B8 stay as they are (glossary market
 *    order and knock-in unchanged).
 * Check values are typed only here; texts take theirs from the core.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { getGlossaryEntry } from '@/content/glossary';
import { EXAMPLE as E, EXAMPLE_STRIKE } from '@/lib/fx/example';
import { greeks, premiumAdjustedDelta } from '@/lib/fx/greeks';
import { normCdf } from '@/lib/fx/normal';
import { d1d2 } from '@/lib/fx/vanilla';
import type { OptionType } from '@/lib/fx/vanilla';

const ROOT = process.cwd();
const mdx = (slug: string, lang: 'de' | 'en', n: number): string =>
  readFileSync(join(ROOT, 'src/content/modules', slug, lang, `${n}.mdx`), 'utf8');

/** Closed form of the premium-adjusted spot delta (premium in base currency). */
function closedForm(
  S: number,
  K: number,
  T: number,
  vol: number,
  rd: number,
  rf: number,
  type: OptionType,
): number {
  const { d2 } = d1d2(S, K, T, vol, rd, rf);
  const df = Math.exp(-rd * T);
  return type === 'call' ? (K / S) * df * normCdf(d2) : -(K / S) * df * normCdf(-d2);
}

describe('B0 · premium-adjusted delta', () => {
  const { spot: S, T, vol, rd, rf } = E;
  const K = EXAMPLE_STRIKE;
  const TYPES: readonly OptionType[] = ['call', 'put'];

  it('is the spot delta minus the premium per unit of notional, Δ − V/S', () => {
    for (const type of TYPES) {
      const g = greeks(S, K, T, vol, rd, rf, type);
      expect(premiumAdjustedDelta(S, K, T, vol, rd, rf, type)).toBe(g.delta - g.price / S);
    }
  });

  it('equals (K/S)·e^(−rd T)·N(d2) for the call and −(K/S)·e^(−rd T)·N(−d2) for the put', () => {
    // [S, K, T, vol, rd, rf]: the example, two other strikes, and cases with rd ≠ 0.
    const cases: [number, number, number, number, number, number][] = [
      [S, K, T, vol, rd, rf],
      [S, 0.773, T, vol, rd, rf],
      [S, 0.82, T, vol, rd, rf],
      [S, K, 0.5, 0.1, 0.01, 0.045],
      [0.9, 0.95, 1, 0.12, 0.02, 0],
      [1.1, 1.05, 0.1, 0.06, 0.03, 0.04],
    ];
    for (const [s, k, t, v, d, f] of cases) {
      for (const type of TYPES) {
        const pa = premiumAdjustedDelta(s, k, t, v, d, f, type);
        expect(Math.abs(pa - closedForm(s, k, t, v, d, f, type))).toBeLessThan(1e-12);
      }
    }
  });

  it('reproduces the check values of the example (strike 0.7930)', () => {
    const call = greeks(S, K, T, vol, rd, rf, 'call');
    expect(call.delta).toBeCloseTo(0.503934, 5);
    expect(call.price / S).toBeCloseTo(0.0158364, 6);
    expect(premiumAdjustedDelta(S, K, T, vol, rd, rf, 'call')).toBeCloseTo(0.488097, 5);
    const put = greeks(S, K, T, vol, rd, rf, 'put');
    expect(put.delta).toBeCloseTo(-0.487355, 5);
    expect(put.price / S).toBeCloseTo(0.0157982, 6);
    expect(premiumAdjustedDelta(S, K, T, vol, rd, rf, 'put')).toBeCloseTo(-0.503153, 5);
  });

  it('glossary: spot delta, unit per notional, formula and pair convention in DE and EN', () => {
    const e = getGlossaryEntry('premium-adjusted-delta');
    expect(e).toBeDefined();
    if (!e) return;
    const formula = 'Δ_pa = Δ_Spot − V/S';
    expect(e.def.de.startsWith('Spot-Delta abzüglich der Prämie')).toBe(true);
    expect(e.def.en.startsWith('Spot delta minus the premium')).toBe(true);
    expect(e.def.de).toContain('in der Basiswährung bezahlt');
    expect(e.def.en).toContain('paid in the base currency');
    expect(e.def.de).toContain('pro Einheit Nominal');
    expect(e.def.en).toContain('per unit of notional');
    expect(e.def.de).toContain(formula);
    expect(e.def.en).toContain(formula);
    expect(e.def.de).toContain('Position in dieser Währung');
    expect(e.def.en).toContain('position in that currency');
    expect(e.def.de).toContain('hängt vom Währungspaar ab');
    expect(e.def.en).toContain('depends on the currency pair');
    // The review's sentence is wrong and must not appear.
    for (const lang of ['de', 'en'] as const) {
      expect(e.def[lang]).not.toMatch(/not simply subtracted|nicht einfach abgezogen/i);
    }
  });
});

describe('Block B · B2 to B6 wordings in DE and EN', () => {
  it('B2 · 02.2 compares the market forward with reference rates of the same tenor', () => {
    expect(mdx('02-forward', 'de', 2)).toContain(
      'von der Formel mit Referenzzinsen gleicher Laufzeit ab',
    );
    expect(mdx('02-forward', 'en', 2)).toContain(
      'from the formula with reference rates of the same tenor',
    );
  });

  it('B3 · 03.2 ties swap points = forward points to a spot-start swap', () => {
    const de = mdx('03-fx-swap', 'de', 2);
    const en = mdx('03-fx-swap', 'en', 2);
    expect(de).toContain(
      'Beginnt der Swap per Spot, sind die Swap Points genau die **Forward Points**.',
    );
    expect(en).toContain(
      'If the swap starts at spot, the swap points are exactly the **forward points**.',
    );
    expect(de).not.toContain('Darum sind die Swap Points genau die');
    expect(en).not.toContain('So the swap points are exactly the');
  });

  it('B4 · 05.4 takeaway puts the break-even rule inside the model', () => {
    const de = mdx('05-greeks', 'de', 4);
    const en = mdx('05-greeks', 'en', 4);
    expect(de).toContain(
      'Im Modell verdient der delta-gehedgte Call nur an Tagen, an denen sich USD/CHF mehr als rund <Num of="ex.breakEvenPips1" /> Pips bewegt.',
    );
    expect(en).toContain(
      'in the model, the delta-hedged call only makes money on days when USD/CHF moves by more than about <Num of="ex.breakEvenPips1" /> pips.',
    );
    expect(de).not.toContain('Delta-gehedgt verdient der Call nur an Tagen');
    expect(en).not.toContain('delta-hedged, the call only makes money on days');
  });

  it('B5 · 06.3 heading limits "short vol" to the example', () => {
    expect(mdx('06-combos-smile', 'de', 3)).toContain(
      '### Butterfly und Seagull: im Beispiel short Vola\n',
    );
    expect(mdx('06-combos-smile', 'en', 3)).toContain(
      '### Butterfly and seagull: short vol in the example\n',
    );
  });

  it('B6 · 07.1 knock-in: a claim with value before the barrier, glossary unchanged', () => {
    const de = mdx('07-barrier-binary', 'de', 1);
    const en = mdx('07-barrier-binary', 'en', 1);
    expect(de).toContain(
      'Vorher hast du nur die Anwartschaft darauf, der Vertrag hat aber schon einen Wert. Danach ist sie ein ganz normaler Vanilla.',
    );
    expect(en).toContain(
      'Before, you only hold a claim to it, but the contract already has value. Afterwards it is an ordinary vanilla.',
    );
    expect(de).not.toContain('Vorher existiert sie nicht');
    expect(en).not.toContain('Before, it does not exist');
    const g = getGlossaryEntry('knock-in');
    expect(g?.def.de.startsWith('Die Option entsteht erst, wenn')).toBe(true);
    expect(g?.def.en.startsWith('The option only comes into existence when')).toBe(true);
  });

  it('B1 · market order wording stays (glossary and 01.3)', () => {
    const g = getGlossaryEntry('market-order');
    expect(g?.def.de).toContain('Die Ausführung ist sicher, der genaue Kurs nicht.');
    expect(g?.def.en).toContain('Execution is certain, the exact rate is not.');
    expect(mdx('01-spot', 'de', 3)).toContain('Die Ausführung ist sicher, der Kurs nicht.');
    expect(mdx('01-spot', 'en', 3)).toContain('Execution is certain, the rate is not.');
  });
});
