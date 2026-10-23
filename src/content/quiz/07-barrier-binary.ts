/**
 * Module 07 Barrier & Binary: four graded quiz questions and one "Kurz geprüft" check per
 * section. Every number in a label or explanation is computed in src/lib/nums/m07.ts (raw
 * values in M07) or src/lib/m07/config.ts and formatted with src/lib/format.ts.
 */
import type { Lang } from '@/i18n/types';
import { fmtMoney, fmtNumber, fmtPct, fmtRate } from '@/lib/format';
import { M07_CONFIG, PIP } from '@/lib/m07/config';
import { M07 } from '@/lib/nums/m07';
import type { ModuleQuiz, QuizOption, QuizQuestion } from './types';

const both = (f: (lang: Lang) => string) => ({ de: f('de'), en: f('en') });

/**
 * Questions are written with the correct option first; `at` moves it to another position so
 * the right answer is not always A. Returns the options and the index of the correct one.
 */
function place(options: QuizOption[], at: number): Pick<QuizQuestion, 'options' | 'correct'> {
  const [right, ...rest] = options;
  const out = [...rest];
  out.splice(at, 0, right!);
  return { options: out, correct: at };
}
const pips = (x: number, digits = 1) => both((l) => fmtNumber(x / PIP, l, { digits }));
const chf = (x: number) => both((l) => fmtMoney(x, 'CHF', l));
const pct = (x: number, digits = 1) => both((l) => fmtPct(x, l, digits));
const rate = (x: number) => fmtRate(x, 'USD/CHF');

const C = M07_CONFIG;
const K = rate(C.strike);
const Hu = rate(C.barriers.up);
const Hd = rate(C.barriers.down);
const P = C.touch.payout;

/* ---------- Checks (one per section, ungraded) ---------- */

const uocDisc = pct(1 - M07.uoc / M07.vanilla, 0);
const check1: QuizQuestion = {
  id: 'm07-c1',
  prompt: {
    de: `Der Up-and-out Call (Strike ${K}, Barriere ${Hu}) ist rund ${uocDisc.de} billiger als der Vanilla Call. Warum?`,
    en: `The up-and-out call (strike ${K}, barrier ${Hu}) is about ${uocDisc.en} cheaper than the vanilla call. Why?`,
  },
  ...place(
    [
      {
        label: {
          de: 'Er verschwindet genau in den Szenarien, in denen der Call am meisten wert wäre',
          en: 'It disappears in exactly the scenarios where the call would be worth the most',
        },
        explain: {
          de: 'Richtig. Die Barriere liegt über dem Strike. Steigt der Dollar stark, wird sie berührt und der Call ist weg. Der Rabatt ist der Wert dieser Szenarien.',
          en: 'Correct. The barrier sits above the strike. If the dollar rises sharply, it is touched and the call is gone. The discount is the value of those scenarios.',
        },
      },
      {
        label: {
          de: 'Die Barriere wird fast nie berührt, darum kostet sie wenig',
          en: 'The barrier is hardly ever touched, so it costs little',
        },
        explain: {
          de: `Nein. Die Barriere wird mit einer Wahrscheinlichkeit von rund ${pct(M07.touchUp, 0).de} berührt (risikoneutral, keine Prognose). Die untere Barriere ${Hd} wird sogar öfter berührt (${pct(M07.touchDown, 0).de}), und doch ist der Down-and-out Call nur ${pct(1 - M07.doc / M07.vanilla, 0).de} billiger. Es zählt, welche Szenarien wegfallen, nicht nur wie viele.`,
          en: `No. The barrier is touched with a probability of about ${pct(M07.touchUp, 0).en} (risk-neutral, not a forecast). The lower barrier ${Hd} is touched even more often (${pct(M07.touchDown, 0).en}), yet the down-and-out call is only ${pct(1 - M07.doc / M07.vanilla, 0).en} cheaper. What matters is which scenarios are lost, not just how many.`,
        },
      },
      {
        label: {
          de: 'Er verschwindet, wenn der Dollar fällt, also wenn der Importeur keinen Schutz braucht',
          en: 'It disappears when the dollar falls, so when the importer needs no protection',
        },
        explain: {
          de: `Das beschreibt den Down-and-out Call mit Barriere ${Hd}. Er ist nur ${pct(1 - M07.doc / M07.vanilla, 0).de} billiger. Der Up-and-out Call verschwindet, wenn der Dollar steigt.`,
          en: `That describes the down-and-out call with barrier ${Hd}. It is only ${pct(1 - M07.doc / M07.vanilla, 0).en} cheaper. The up-and-out call disappears when the dollar rises.`,
        },
      },
    ],
    0,
  ),
};

const check2: QuizQuestion = {
  id: 'm07-c2',
  prompt: {
    de: `Der Up-and-out Call mit Barriere ${Hu} kostet ${pips(M07.uoc).de} Pips, der Vanilla Call ${pips(M07.vanilla).de} Pips. Was kostet der Up-and-in Call mit gleicher Barriere (ohne Rebate)?`,
    en: `The up-and-out call with barrier ${Hu} costs ${pips(M07.uoc).en} pips, the vanilla call ${pips(M07.vanilla).en} pips. What does the up-and-in call with the same barrier cost (no rebate)?`,
  },
  ...place(
    [
      {
        label: pips(M07.uic),
        mono: true,
        explain: {
          de: 'Richtig. In-Out-Parität: Knock-out + Knock-in = Vanilla. Auf jedem Pfad lebt genau eine der beiden Optionen.',
          en: 'Correct. In-out parity: knock-out + knock-in = vanilla. On every path exactly one of the two is alive.',
        },
      },
      {
        label: pips(M07.uoc),
        mono: true,
        explain: {
          de: 'Das ist der Preis des Knock-outs. Knock-in und Knock-out ergänzen sich zum Vanilla, sie kosten nicht dasselbe.',
          en: 'That is the price of the knock-out. Knock-in and knock-out add up to the vanilla; they do not cost the same.',
        },
      },
      {
        label: pips(M07.vanilla + M07.uoc),
        mono: true,
        explain: {
          de: 'Das wäre teurer als der Vanilla. Ein Knock-in kann nie mehr wert sein als der Vanilla, denn er zahlt höchstens dasselbe.',
          en: 'That would be dearer than the vanilla. A knock-in can never be worth more than the vanilla because it pays at most the same.',
        },
      },
      {
        label: pips(M07.vanilla / 2),
        mono: true,
        explain: {
          de: 'Halbe-halbe gilt nicht. Die Aufteilung hängt davon ab, wie wahrscheinlich und wie wertvoll die Szenarien mit Berührung sind.',
          en: 'It is not split half and half. The split depends on how likely and how valuable the scenarios with a touch are.',
        },
      },
    ],
    2,
  ),
};

const volUp = both((l) => fmtPct(C.market.vol + C.touch.volBumpPct / 100, l, 0));
const volNow = both((l) => fmtPct(C.market.vol, l, 0));
const L = rate(C.touch.defaults.lower);
const U = rate(C.touch.defaults.upper);
const check3: QuizQuestion = {
  id: 'm07-c3',
  prompt: {
    de: `Ein Double No-Touch ${L} / ${U} zahlt ${fmtMoney(P, 'CHF', 'de')} und kostet heute ${chf(M07.dnt * P).de}. Die Vola steigt von ${volNow.de} auf ${volUp.de}. Was passiert mit dem Preis?`,
    en: `A double no-touch ${L} / ${U} pays ${fmtMoney(P, 'CHF', 'en')} and costs ${chf(M07.dnt * P).en} today. Vol rises from ${volNow.en} to ${volUp.en}. What happens to the price?`,
  },
  ...place(
    [
      {
        label: {
          de: `Er fällt auf ${chf(M07.dntVolUp * P).de}`,
          en: `It falls to ${chf(M07.dntVolUp * P).en}`,
        },
        explain: {
          de: 'Richtig. Mehr Vola heisst mehr Bewegung, also eine höhere Chance, eine der Barrieren zu berühren. Der Käufer eines DNT ist short Vega.',
          en: 'Correct. More vol means more movement and a higher chance of touching one of the barriers. The buyer of a DNT is short vega.',
        },
      },
      {
        label: {
          de: `Er steigt auf ${chf(M07.dntVolDown * P).de}`,
          en: `It rises to ${chf(M07.dntVolDown * P).en}`,
        },
        explain: {
          de: 'Das ist der Preis bei tieferer Vola. Anders als ein Vanilla verliert der DNT, wenn die Vola steigt.',
          en: 'That is the price at lower vol. Unlike a vanilla, the DNT loses when vol rises.',
        },
      },
      {
        label: {
          de: 'Er bleibt gleich, die Auszahlung ist fix',
          en: 'It stays the same; the payout is fixed',
        },
        explain: {
          de: 'Die Auszahlung ist fix, die Wahrscheinlichkeit nicht. Der Preis ist die abgezinste Wahrscheinlichkeit, im Korridor zu bleiben.',
          en: 'The payout is fixed, the probability is not. The price is the discounted probability of staying in the corridor.',
        },
      },
    ],
    1,
  ),
};

const g = M07.gap;
const stop = fmtRate(C.gap.stop, 'EUR/CHF');
const shock = fmtRate(g.shock, 'EUR/CHF');
const check4: QuizQuestion = {
  id: 'm07-c4',
  prompt: {
    de: `Ein Stop-Loss soll EUR bei ${stop} verkaufen. Im hypothetischen Szenario mit täglichen EZB-Referenzkursen wird er erst zu ${shock} ausgeführt. Warum so tief?`,
    en: `A stop-loss is meant to sell EUR at ${stop}. In the hypothetical scenario with daily ECB reference rates it is only filled at ${shock}. Why so low?`,
  },
  ...place(
    [
      {
        label: {
          de: 'Der Kurs sprang über das Niveau, am Stop-Niveau gab es keinen handelbaren Kurs',
          en: 'The rate jumped over the level; there was no tradable price at the stop level',
        },
        explain: {
          de: 'Richtig. Ein Stop wird zum nächsten handelbaren Kurs ausgeführt. Bei einem Gap liegt dieser weit hinter dem Stop-Niveau. Das Szenario nimmt vereinfacht das nächste Fixing. Auch Barrieren werden übersprungen, aber ein Knock-out ist keine Transaktion: Die Option erlischt.',
          en: 'Correct. A stop is filled at the next tradable price. In a gap, that price lies far beyond the stop level. As a simplification, the scenario takes the next fixing. Barriers are jumped over too, but a knock-out is not a transaction: the option is extinguished.',
        },
      },
      {
        label: {
          de: 'Stops werden immer erst am nächsten Tag ausgeführt',
          en: 'Stops are always filled on the next day',
        },
        explain: {
          de: 'Ein Stop arbeitet laufend, nicht nur einmal pro Tag. Entscheidend ist, ob es am Stop-Niveau einen Kurs gibt. Springt der Kurs, gibt es dort keinen.',
          en: 'A stop works continuously, not just once a day. What matters is whether there is a price at the stop level. If the rate jumps, there is none.',
        },
      },
      {
        label: {
          de: 'Der Stop war zu nah am Mindestkurs gesetzt',
          en: 'The stop was set too close to the minimum rate',
        },
        explain: {
          de: 'Auch ein tieferer Stop hätte nichts genützt: Im Szenario wird jeder Stop bis hinunter zum Fixing nach dem Schock zu diesem Fixing ausgeführt.',
          en: 'A lower stop would not have helped either: in the scenario every stop down to the fixing after the shock is filled at that fixing.',
        },
      },
    ],
    2,
  ),
};

/* ---------- Quiz (graded) ---------- */

const q1: QuizQuestion = {
  id: 'm07-q1',
  prompt: {
    de: `Welche Option ist ein Reverse Knock-out? Spot ${rate(C.market.spot)}, alle mit Strike ${K}.`,
    en: `Which option is a reverse knock-out? Spot ${rate(C.market.spot)}, all with strike ${K}.`,
  },
  ...place(
    [
      {
        label: { de: `Up-and-out Call, Barriere ${Hu}`, en: `Up-and-out call, barrier ${Hu}` },
        explain: {
          de: 'Richtig. Die Barriere liegt über dem Strike, also dort, wo der Call im Geld ist. An der Barriere fällt der Wert von viel innerem Wert auf null.',
          en: 'Correct. The barrier lies above the strike, where the call is in the money. At the barrier the value drops from a lot of intrinsic value to zero.',
        },
      },
      {
        label: { de: `Down-and-out Call, Barriere ${Hd}`, en: `Down-and-out call, barrier ${Hd}` },
        explain: {
          de: 'Das ist ein regulärer Knock-out: Die Barriere liegt unter dem Strike, wo der Call ohnehin aus dem Geld ist.',
          en: 'That is a regular knock-out: the barrier lies below the strike, where the call is out of the money anyway.',
        },
      },
      {
        label: { de: `Up-and-out Put, Barriere ${Hu}`, en: `Up-and-out put, barrier ${Hu}` },
        explain: {
          de: 'Für einen Put ist eine Barriere über dem Strike aus dem Geld. Reverse wäre ein Down-and-out Put mit Barriere unter dem Strike.',
          en: 'For a put, a barrier above the strike is out of the money. A reverse one would be a down-and-out put with the barrier below the strike.',
        },
      },
      {
        label: { de: `Down-and-in Call, Barriere ${Hd}`, en: `Down-and-in call, barrier ${Hd}` },
        explain: {
          de: 'Ein Knock-in verschwindet nicht, er entsteht. Ausserdem liegt diese Barriere aus dem Geld.',
          en: 'A knock-in does not vanish, it comes to life. Besides, this barrier is out of the money.',
        },
      },
    ],
    1,
  ),
};

const hDaily = rate(M07.hDaily);
const q2: QuizQuestion = {
  id: 'm07-q2',
  prompt: {
    de: `Die Barriere ${Hu} des Up-and-out Calls wird nur einmal täglich gegen ein Fixing geprüft statt laufend. Was gilt?`,
    en: `The barrier ${Hu} of the up-and-out call is checked only once a day against a fixing instead of continuously. What holds?`,
  },
  ...place(
    [
      {
        label: {
          de: `Er wird teurer: ${pips(M07.uocDaily).de} statt ${pips(M07.uoc).de} Pips, die Barriere wirkt wie ${hDaily}`,
          en: `It gets dearer: ${pips(M07.uocDaily).en} instead of ${pips(M07.uoc).en} pips; the barrier acts like ${hDaily}`,
        },
        explain: {
          de: 'Richtig. Seltener beobachtet heisst seltener berührt. Nach Broadie, Glasserman und Kou wirkt die Barriere, als läge sie um den Faktor e^(0.5826 · σ · √Δt) weiter weg.',
          en: 'Correct. Observed less often means touched less often. Following Broadie, Glasserman and Kou, the barrier acts as if it were further away by the factor e^(0.5826 · σ · √Δt).',
        },
      },
      {
        label: {
          de: 'Er wird billiger, weil die Barriere näher rückt',
          en: 'It gets cheaper because the barrier moves closer',
        },
        explain: {
          de: 'Die Verschiebung geht weg vom Spot, nicht hin. Zwischen zwei Fixings zählt keine Berührung, das hilft dem Knock-out.',
          en: 'The shift is away from spot, not towards it. Between two fixings no touch counts, which helps the knock-out.',
        },
      },
      {
        label: { de: 'Der Preis bleibt gleich', en: 'The price stays the same' },
        explain: {
          de: 'Die Beobachtung gehört zum Vertrag und ändert die Wahrscheinlichkeit eines Knock-outs, also auch den Preis.',
          en: 'Monitoring is part of the contract and changes the probability of a knock-out, so it changes the price too.',
        },
      },
    ],
    2,
  ),
};

const q3: QuizQuestion = {
  id: 'm07-q3',
  prompt: {
    de: `Ein Digital Call zahlt ${fmtMoney(P, 'CHF', 'de')}, wenn USD/CHF in drei Monaten über ${K} liegt. Er kostet ${chf(M07.digital * P).de}, der CHF-Zins ist null. Wie hoch ist die risikoneutrale Wahrscheinlichkeit, dass er zahlt?`,
    en: `A digital call pays ${fmtMoney(P, 'CHF', 'en')} if USD/CHF is above ${K} in three months. It costs ${chf(M07.digital * P).en}; the CHF rate is zero. What is the risk-neutral probability that it pays?`,
  },
  ...place(
    [
      {
        label: pct(M07.digital),
        mono: true,
        explain: {
          de: 'Richtig. Preis = Auszahlung · e^(−r_CHF · T) · N(d2). Ohne Abzinsung ist der Preis in Prozent der Auszahlung genau die Wahrscheinlichkeit.',
          en: 'Correct. Price = payout · e^(−r_CHF · T) · N(d2). Without discounting, the price as a share of the payout is exactly the probability.',
        },
      },
      {
        label: pct(0.5),
        mono: true,
        explain: {
          de: 'Der Strike liegt am Forward, aber N(d2) ist wegen des Terms −½σ² etwas kleiner als die Hälfte.',
          en: 'The strike is at the forward, but N(d2) is slightly below one half because of the −½σ² term.',
        },
      },
      {
        label: pct(M07.touchUp),
        mono: true,
        explain: {
          de: `Das ist die Wahrscheinlichkeit, die Barriere ${Hu} irgendwann zu berühren. Hier zählt nur der Kurs bei Verfall gegen ${K}.`,
          en: `That is the probability of touching the barrier ${Hu} at some point. Here only the rate at expiry against ${K} counts.`,
        },
      },
      {
        label: pct(1 - M07.digital),
        mono: true,
        explain: {
          de: 'Das ist die Gegenwahrscheinlichkeit: der Digital Put, der unter dem Strike zahlt.',
          en: 'That is the complementary probability: the digital put that pays below the strike.',
        },
      },
    ],
    0,
  ),
};

const w = M07.window;
const full = chf(M07.uocFull91 * C.market.notional);
const win = chf(w.pv);
const van = chf(w.compare.vanilla ?? Number.NaN);
const q4: QuizQuestion = {
  id: 'm07-q4',
  prompt: {
    de: `Up-and-out Call, Strike ${K}, Barriere ${Hu}, ${C.window.expiryDay} Tage, USD 1 Mio. Wie ordnen sich die Preise mit Barriere über die ganze Laufzeit, mit Window Barrier (Tage ${C.window.startDay} bis ${C.window.endDay}) und ohne Barriere?`,
    en: `Up-and-out call, strike ${K}, barrier ${Hu}, ${C.window.expiryDay} days, USD 1m. How do the prices rank with the barrier for the whole life, with a window barrier (days ${C.window.startDay} to ${C.window.endDay}) and without a barrier?`,
  },
  ...place(
    [
      {
        label: {
          de: `Ganze Laufzeit ${full.de} < Window ${win.de} < Vanilla ${van.de}`,
          en: `Whole life ${full.en} < window ${win.en} < vanilla ${van.en}`,
        },
        explain: {
          de: 'Richtig. Das Fenster schneidet weniger Szenarien weg als eine Barriere über die ganze Laufzeit, aber mehr als keine Barriere.',
          en: 'Correct. The window cuts away fewer scenarios than a barrier for the whole life, but more than no barrier at all.',
        },
      },
      {
        label: {
          de: `Window ${full.de} < Ganze Laufzeit ${win.de} < Vanilla ${van.de}`,
          en: `Window ${full.en} < whole life ${win.en} < vanilla ${van.en}`,
        },
        explain: {
          de: 'Vertauscht. Eine Barriere, die nur einen Monat gilt, wird seltener berührt; die Option ist mehr wert.',
          en: 'Swapped. A barrier that applies for only one month is touched less often, so the option is worth more.',
        },
      },
      {
        label: {
          de: `Alle drei kosten ${van.de}, die Barriere spielt bei Verfall keine Rolle`,
          en: `All three cost ${van.en}; the barrier does not matter at expiry`,
        },
        explain: {
          de: 'Die Barriere wirkt während der Laufzeit. Ein ausgeknockter Call zahlt bei Verfall nichts, egal wo der Kurs dann steht.',
          en: 'The barrier acts during the option’s life. A knocked-out call pays nothing at expiry, wherever the rate stands then.',
        },
      },
    ],
    1,
  ),
};

export const quiz: ModuleQuiz = {
  slug: '07-barrier-binary',
  quiz: [q1, q2, q3, q4],
  checks: { '1': check1, '2': check2, '3': check3, '4': check4 },
};
