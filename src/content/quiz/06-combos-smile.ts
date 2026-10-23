/**
 * Module 06 Combos & Vol Smile: four graded quiz questions and one "Kurz geprüft" check per
 * section. Every number in a prompt, label or explanation is computed from the running example
 * (src/lib/nums/m06.ts → M06) and formatted with src/lib/format.ts.
 */
import type { Lang } from '@/i18n/types';
import { fmtMoney, fmtNumber, fmtPct, fmtPips, fmtRate, pipSize } from '@/lib/format';
import { EXAMPLE as E } from '@/lib/fx/example';
import { M06 } from '@/lib/nums/m06';
import type { ModuleQuiz, QuizQuestion } from './types';

const PAIR = E.pair;
const PIP = pipSize(PAIR);
const N = E.notional;
const both = (f: (lang: Lang) => string) => ({ de: f('de'), en: f('en') });
const rate = (x: number) => fmtRate(x, PAIR);
const chf = (x: number) => both((l) => fmtMoney(x, E.quote, l));
const pips = (x: number, digits = 1) => both((l) => fmtPips(x, l, digits));
const pct = (x: number, digits = 2, sign = false) => both((l) => fmtPct(x, l, digits, sign));

const callPips = pips(M06.csCallPips);
const soldPips = pips(M06.csSoldPips);
const csPips = pips(M06.csPips);
const widthPips = pips((M06.csK2 - M06.csK1) / PIP, 0);
const maxGainPips = pips(M06.csMaxGain / N / PIP);
/** "79.4 Pips" / "79.4 pips". */
const pipsLabel = (x: number) => both((l) => `${fmtPips(x, l)} ${l === 'de' ? 'Pips' : 'pips'}`);

/* ---------- Graded quiz ---------- */

const q1: QuizQuestion = {
  id: 'm06-q1',
  prompt: {
    de: `Der Importeur kauft einen USD Call mit Strike ${rate(M06.csK1)} für ${callPips.de} Pips und verkauft einen USD Call mit Strike ${rate(M06.csK2)} für ${soldPips.de} Pips. Was kostet der Call-Spread netto?`,
    en: `The importer buys a USD call with strike ${rate(M06.csK1)} for ${callPips.en} pips and sells a USD call with strike ${rate(M06.csK2)} for ${soldPips.en} pips. What does the call spread cost net?`,
  },
  options: [
    {
      label: pipsLabel(M06.csCallPips + M06.csSoldPips),
      mono: true,
      explain: {
        de: 'Hier wurde die Prämie des verkauften Calls addiert. Wer verkauft, erhält Prämie; sie verringert die Kosten.',
        en: 'This adds the premium of the call sold. Selling brings premium in; it reduces the cost.',
      },
    },
    {
      label: pipsLabel(M06.csPips),
      mono: true,
      explain: {
        de: `Richtig. Gekaufter Call minus verkaufter Call: ${callPips.de} − ${soldPips.de} = ${csPips.de} Pips. Dafür endet der Schutz bei ${rate(M06.csK2)}.`,
        en: `Correct. Call bought minus call sold: ${callPips.en} − ${soldPips.en} = ${csPips.en} pips. In return the protection ends at ${rate(M06.csK2)}.`,
      },
    },
    {
      label: pipsLabel(M06.csCallPips),
      mono: true,
      explain: {
        de: 'Das ist nur der gekaufte Call. Der verkaufte Call bringt Prämie zurück, darum ist der Spread billiger.',
        en: 'That is only the call bought. The call sold brings premium back, so the spread is cheaper.',
      },
    },
    {
      label: pipsLabel(M06.csSoldPips),
      mono: true,
      explain: {
        de: 'Das ist die Prämie des verkauften Calls, also das, was der Importeur zurückbekommt, nicht was er zahlt.',
        en: 'That is the premium of the call sold, i.e. what the importer gets back, not what he pays.',
      },
    },
  ],
  correct: 1,
};

const q2: QuizQuestion = {
  id: 'm06-q2',
  prompt: {
    de: `Der Importeur hat einen Zero-Cost-Collar: Long USD Call ${rate(M06.rrCallK)}, Short USD Put ${rate(M06.rrPutK)}. Bei Verfall steht USD/CHF auf ${rate(M06.stDown)}. Was zahlt er für die USD 1 Mio.?`,
    en: `The importer has a zero-cost collar: long USD call ${rate(M06.rrCallK)}, short USD put ${rate(M06.rrPutK)}. At expiry USD/CHF is at ${rate(M06.stDown)}. What does he pay for the USD 1m?`,
  },
  options: [
    {
      label: chf(M06.stDown * N),
      mono: true,
      explain: {
        de: 'Das wäre der Marktkurs. Der verkaufte Put wird aber ausgeübt: Unter dem Put-Strike muss er zum Strike kaufen.',
        en: 'That would be the market rate. But the put he sold is exercised: below the put strike he has to buy at the strike.',
      },
    },
    {
      label: chf(M06.forward * N),
      mono: true,
      explain: {
        de: 'Das wäre der Forward. Der Collar fixiert keinen Kurs, sondern ein Band zwischen den beiden Strikes.',
        en: 'That would be the forward. A collar does not fix one rate, but a band between the two strikes.',
      },
    },
    {
      label: chf(M06.rrPutK * N),
      mono: true,
      explain: {
        de: `Richtig. Unter ${rate(M06.rrPutK)} wird der Put ausgeübt, und er kauft zum Put-Strike. Gegenüber dem Markt zahlt er ${chf((M06.rrPutK - M06.stDown) * N).de} mehr: der Preis für den Schutz ohne Prämie.`,
        en: `Correct. Below ${rate(M06.rrPutK)} the put is exercised and he buys at the put strike. Compared with the market he pays ${chf((M06.rrPutK - M06.stDown) * N).en} more: the price of protection without a premium.`,
      },
    },
    {
      label: chf(M06.rrCallK * N),
      mono: true,
      explain: {
        de: 'Das ist der Call-Strike, der Deckel nach oben. Er gilt nur, wenn der Dollar über den Call-Strike steigt.',
        en: 'That is the call strike, the cap on the upside. It only applies if the dollar rises above the call strike.',
      },
    },
  ],
  correct: 2,
};

const shockPts = both((l) => fmtNumber(M06.volShock * 100, l));

const q3: QuizQuestion = {
  id: 'm06-q3',
  prompt: {
    de: `Die implizite Vola steigt um ${shockPts.de} Punkte, der Spot bleibt bei ${rate(E.spot)}. Welche Position gewinnt dadurch heute an Wert?`,
    en: `Implied vol rises by ${shockPts.en} points while the spot stays at ${rate(E.spot)}. Which position gains value today as a result?`,
  },
  options: [
    {
      label: { de: 'Der Long Butterfly', en: 'The long butterfly' },
      explain: {
        de: `Nein. Der Butterfly ist short Vega (${chf(M06.flyVega).de} je Punkt). Er verliert ${chf(-M06.flyShock).de}, weil die zwei verkauften Calls in der Mitte am meisten Vega haben.`,
        en: `No. The butterfly is short vega (${chf(M06.flyVega).en} per point). It loses ${chf(-M06.flyShock).en}, because the two calls sold in the middle carry the most vega.`,
      },
    },
    {
      label: { de: 'Der Long Straddle', en: 'The long straddle' },
      explain: {
        de: `Richtig. Zwei gekaufte Optionen, zweimal Vega: ${chf(M06.straddleVega).de} je Punkt. Die Vola-Bewegung allein bringt ${chf(M06.straddleShock).de}.`,
        en: `Correct. Two options bought, twice the vega: ${chf(M06.straddleVega).en} per point. The vol move alone brings ${chf(M06.straddleShock).en}.`,
      },
    },
    {
      label: { de: 'Der Seagull des Importeurs', en: "The importer's seagull" },
      explain: {
        de: `Nein. Der Seagull kostet nichts, ist aber short Vega (${chf(M06.seagullVega).de} je Punkt). Er verliert heute ${chf(-M06.seagullShock).de} an Wert, auch wenn die Absicherung bei Verfall funktioniert.`,
        en: `No. The seagull costs nothing but is short vega (${chf(M06.seagullVega).en} per point). It loses ${chf(-M06.seagullShock).en} in value today, even though the hedge works at expiry.`,
      },
    },
  ],
  correct: 1,
};

const atm = pct(M06.atm);
const rrQ = pct(M06.rr25, 2, true);
const bfQ = pct(M06.bf25, 2, true);
/** Terms of σ25P = ATM + BF − RR/2 without a doubled sign: "8.00 % + 0.25 % − (−0.50 %)". */
const bfAbs = pct(M06.bf25);
const halfRr = pct(M06.rr25 / 2, 2, true);

const q4: QuizQuestion = {
  id: 'm06-q4',
  prompt: {
    de: `Die Quotes sind ATM ${atm.de}, 25Δ Risk Reversal ${rrQ.de} und 25Δ Butterfly ${bfQ.de}. Welche Vola hat der 25Δ USD Put?`,
    en: `The quotes are ATM ${atm.en}, 25Δ risk reversal ${rrQ.en} and 25Δ butterfly ${bfQ.en}. What is the vol of the 25Δ USD put?`,
  },
  options: [
    {
      label: pct(M06.vol25P),
      mono: true,
      explain: {
        de: `Richtig. σ25P = ATM + BF − RR/2 = ${atm.de} + ${bfAbs.de} − (${halfRr.de}) = ${pct(M06.vol25P).de}. Der negative RR macht den Put teurer.`,
        en: `Correct. σ25P = ATM + BF − RR/2 = ${atm.en} + ${bfAbs.en} − (${halfRr.en}) = ${pct(M06.vol25P).en}. The negative RR makes the put dearer.`,
      },
    },
    {
      label: pct(M06.vol25C),
      mono: true,
      explain: {
        de: 'Das ist die Vola des 25Δ Calls: ATM + BF + RR/2. Beim Put wird RR/2 abgezogen.',
        en: 'That is the vol of the 25Δ call: ATM + BF + RR/2. For the put, RR/2 is subtracted.',
      },
    },
    {
      label: pct(M06.atm + M06.bf25),
      mono: true,
      explain: {
        de: 'Hier fehlt der Risk Reversal. ATM + BF ist nur die Mitte der beiden Flügel; RR verschiebt sie gegeneinander.',
        en: 'The risk reversal is missing here. ATM + BF is only the middle of the two wings; RR moves them apart.',
      },
    },
    {
      label: pct(M06.atm + M06.bf25 - M06.rr25),
      mono: true,
      explain: {
        de: 'Hier wurde der ganze RR statt RR/2 verwendet. Die beiden Flügel liegen je RR/2 neben ihrer Mitte.',
        en: 'This uses the whole RR instead of RR/2. Each wing sits RR/2 away from the middle of the two wings.',
      },
    },
  ],
  correct: 0,
};

/* ---------- Checks (one per section, ungraded) ---------- */

const c1: QuizQuestion = {
  id: 'm06-c1',
  prompt: {
    de: 'Der Importeur verkauft einen USD Put, um seinen USD Call zu bezahlen. Was gibt er dafür auf?',
    en: 'The importer sells a USD put to pay for his USD call. What does he give up in return?',
  },
  options: [
    {
      label: {
        de: 'Den Schutz gegen einen stark steigenden Dollar',
        en: 'The protection against a sharply rising dollar',
      },
      explain: {
        de: 'Das gibt er mit einem verkauften Call ab, nicht mit einem Put. Der Put betrifft die Seite des fallenden Dollars.',
        en: 'He gives that up by selling a call, not a put. The put concerns the side of a falling dollar.',
      },
    },
    {
      label: {
        de: 'Nichts, Zero Cost heisst gratis',
        en: 'Nothing, zero cost means free',
      },
      explain: {
        de: 'Zero Cost heisst nur: keine Prämie. Der Preis steckt in der Pflicht, unter dem Put-Strike zu kaufen.',
        en: 'Zero cost only means no premium. The price is the obligation to buy at the put strike below it.',
      },
    },
    {
      label: {
        de: 'Den Vorteil eines stark fallenden Dollars unter dem Put-Strike',
        en: 'The benefit of a sharply falling dollar below the put strike',
      },
      explain: {
        de: 'Richtig. Unter dem Put-Strike kauft er trotzdem zum Strike. Den tieferen Marktkurs kann er nicht mehr nutzen.',
        en: 'Correct. Below the put strike he still buys at the strike. He can no longer use the lower market rate.',
      },
    },
  ],
  correct: 2,
};

const c2: QuizQuestion = {
  id: 'm06-c2',
  prompt: {
    de: `Call-Spread mit ${rate(M06.csK1)} und ${rate(M06.csK2)}, Prämie ${csPips.de} Pips auf USD 1 Mio. Was ist der maximale Gewinn bei Verfall?`,
    en: `Call spread with ${rate(M06.csK1)} and ${rate(M06.csK2)}, premium ${csPips.en} pips on USD 1m. What is the maximum gain at expiry?`,
  },
  options: [
    {
      label: chf(M06.csMaxGain),
      mono: true,
      explain: {
        de: `Richtig. Breite minus Prämie: ${widthPips.de} − ${csPips.de} = ${maxGainPips.de} Pips, ab ${rate(M06.csK2)} erreicht.`,
        en: `Correct. Width minus premium: ${widthPips.en} − ${csPips.en} = ${maxGainPips.en} pips, reached from ${rate(M06.csK2)} upwards.`,
      },
    },
    {
      label: chf((M06.csK2 - M06.csK1) * N),
      mono: true,
      explain: {
        de: 'Das ist die maximale Auszahlung. Für den Gewinn musst du die bezahlte Prämie abziehen.',
        en: 'That is the maximum payoff. For the gain you have to deduct the premium paid.',
      },
    },
    {
      label: { de: 'unbegrenzt', en: 'unlimited' },
      explain: {
        de: 'Das gilt für einen Long Call allein. Der verkaufte Call deckelt den Gewinn ab dem oberen Strike.',
        en: 'That is true of a long call on its own. The call sold caps the gain from the upper strike.',
      },
    },
    {
      label: chf(M06.csPips * PIP * N),
      mono: true,
      explain: {
        de: 'Das ist die Prämie, also der maximale Verlust, nicht der Gewinn.',
        en: 'That is the premium, i.e. the maximum loss, not the gain.',
      },
    },
  ],
  correct: 0,
};

const [beLo, beHi] = M06.straddleBe;
const half = (M06.straddlePips * PIP) / 2;

const c3: QuizQuestion = {
  id: 'm06-c3',
  prompt: {
    de: `Ein Straddle mit Strike ${rate(M06.dns)} kostet ${pips(M06.straddlePips).de} Pips. Wo liegen die Break-evens bei Verfall?`,
    en: `A straddle with strike ${rate(M06.dns)} costs ${pips(M06.straddlePips).en} pips. Where are the break-evens at expiry?`,
  },
  options: [
    {
      label: {
        de: `${rate(M06.dns - half)} und ${rate(M06.dns + half)}`,
        en: `${rate(M06.dns - half)} and ${rate(M06.dns + half)}`,
      },
      mono: true,
      explain: {
        de: 'Hier wurde die Prämie auf beide Seiten verteilt. Gewinnt aber nur ein Bein, muss es die ganze Prämie beider Beine einspielen.',
        en: 'This splits the premium between both sides. But only one leg pays off, so it has to earn back the premium of both legs.',
      },
    },
    {
      label: { de: `${rate(beLo!)} und ${rate(beHi!)}`, en: `${rate(beLo!)} and ${rate(beHi!)}` },
      mono: true,
      explain: {
        de: `Richtig. Strike minus und plus die ganze Prämie. Bei Verfall muss der Kurs mehr als ${pips(M06.straddlePips).de} Pips vom Strike entfernt liegen.`,
        en: `Correct. Strike minus and plus the whole premium. At expiry the rate has to end more than ${pips(M06.straddlePips).en} pips away from the strike.`,
      },
    },
    {
      label: { de: `nur bei ${rate(M06.dns)}`, en: `only at ${rate(M06.dns)}` },
      mono: true,
      explain: {
        de: 'Beim Strike zahlt der Straddle nichts aus. Dort ist der Verlust am grössten: die ganze Prämie.',
        en: 'At the strike the straddle pays nothing. That is where the loss is largest: the whole premium.',
      },
    },
  ],
  correct: 1,
};

const c4: QuizQuestion = {
  id: 'm06-c4',
  prompt: {
    de: 'Viele Marktteilnehmer kaufen CHF Calls als Schutz gegen einen starken Franken. Was passiert mit dem 25Δ Risk Reversal in USD/CHF?',
    en: 'Many market participants buy CHF calls as protection against a strong franc. What happens to the 25Δ risk reversal in USD/CHF?',
  },
  options: [
    {
      label: {
        de: 'Er steigt, der rechte Flügel hebt sich',
        en: 'It rises; the right wing lifts',
      },
      explain: {
        de: 'Ein CHF Call ist ein USD Put, nicht ein USD Call. Teurer werden die tiefen Strikes, also der linke Flügel.',
        en: 'A CHF call is a USD put, not a USD call. The low strikes get dearer, so the left wing.',
      },
    },
    {
      label: {
        de: 'Er sinkt, der linke Flügel hebt sich',
        en: 'It falls; the left wing lifts',
      },
      explain: {
        de: 'Richtig. CHF Calls sind USD Puts. Ihre Vola steigt, und RR = σ(USD Call) − σ(USD Put) wird negativer.',
        en: 'Correct. CHF calls are USD puts. Their vol rises, and RR = σ(USD call) − σ(USD put) becomes more negative.',
      },
    },
    {
      label: {
        de: 'Nur der Butterfly steigt, der Risk Reversal bleibt',
        en: 'Only the butterfly rises; the risk reversal stays',
      },
      explain: {
        de: 'Das wäre so, wenn beide Flügel gleich stark gefragt wären. Hier ist nur eine Seite gesucht, das verändert die Schiefe.',
        en: 'That would be the case if both wings were equally in demand. Here only one side is sought, which changes the skew.',
      },
    },
  ],
  correct: 1,
};

export const quiz: ModuleQuiz = {
  slug: '06-combos-smile',
  quiz: [q1, q2, q3, q4],
  checks: { '1': c1, '2': c2, '3': c3, '4': c4 },
};
