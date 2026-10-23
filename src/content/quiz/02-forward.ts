/**
 * Module 02 Forward: four graded quiz questions and one "Kurz geprüft" check per section.
 * Every number in a prompt, label or explanation is computed from the running example, the
 * calculation core (forward, cash and carry) and the module logic (src/lib/m02 → M02 in
 * src/lib/nums/m02.ts), and formatted with src/lib/format.ts. Distractors are the typical
 * mistakes: the rate at maturity instead of the forward, sign errors, rates swapped, the
 * continuous instead of the money-market forward, a forward read as a forecast, the arbitrage
 * run in the wrong direction, pips off by a factor of ten.
 */
import type { Lang } from '@/i18n/types';
import { fmtMoney, fmtPct, fmtPips, fmtRate } from '@/lib/format';
import { EXAMPLE as E } from '@/lib/fx/example';
import { forwardContinuous, forwardMoneyMarket } from '@/lib/fx/forward';
import { M02_CONFIG, PIP } from '@/lib/m02/config';
import { carryFor } from '@/lib/m02/carry';
import { M02 } from '@/lib/nums/m02';
import type { ModuleQuiz, QuizQuestion } from './types';

const M = M02_CONFIG.market;
const H = M02_CONFIG.hedge;
const PAIR = E.pair;
const N = E.notional;
const FD = M02_CONFIG.forwardDigits;
const both = (f: (lang: Lang) => string) => ({ de: f('de'), en: f('en') });
const rate = (x: number, digits = 4) => fmtRate(x, PAIR, digits);
const fwd = (x: number) => rate(x, FD);
const money = (x: number, ccy: string = E.quote, sign = false) =>
  both((l) => fmtMoney(x, ccy, l, 0, sign));
const pct = (x: number, digits = 1) => both((l) => fmtPct(x, l, digits));
const pips = (x: number, sign = false) => both((l) => fmtPips(x, l, 1, sign));

const F = M02.F;
const spot = rate(E.spot);
const rf = pct(E.rf);
const rd = pct(E.rd);

/* ---------- Checks (one per section, ungraded) ---------- */

const check1: QuizQuestion = {
  id: 'm02-c1',
  prompt: {
    de: `Der Importeur hat USD 1 Mio. auf Termin zu ${fwd(F)} gekauft. Bei Fälligkeit steht USD/CHF bei ${rate(H.stDown)}. Wie viel zahlt er für die Dollars?`,
    en: `The importer has bought USD 1m forward at ${fwd(F)}. At maturity USD/CHF stands at ${rate(H.stDown)}. How much does he pay for the dollars?`,
  },
  options: [
    {
      label: money(M02.downChf),
      mono: true,
      explain: {
        de: `So viel hätte er ohne Absicherung gezahlt. Mit dem Forward ist der Kurs aber fixiert: Er zahlt ${money(M02.fwdChf).de}.`,
        en: `That is what he would have paid unhedged. With the forward, however, the rate is fixed: he pays ${money(M02.fwdChf).en}.`,
      },
    },
    {
      label: money(M02.fwdChf),
      mono: true,
      explain: {
        de: `Richtig. USD 1 Mio. × ${fwd(F)} = ${money(M02.fwdChf).de}, egal wo der Kurs steht. Die ${money(N * (F - H.stDown)).de} mehr als ohne Absicherung sind die Chance, die er abgegeben hat.`,
        en: `Correct. USD 1m × ${fwd(F)} = ${money(M02.fwdChf).en}, wherever the rate stands. The ${money(N * (F - H.stDown)).en} more than unhedged is the opportunity he gave up.`,
      },
    },
    {
      label: money(M02.spotChf),
      mono: true,
      explain: {
        de: `Das ist USD 1 Mio. zum Spot von heute (${spot}). Der Forward liegt aber nicht beim Spot, sondern bei ${fwd(F)}: ${money(M02.fwdChf).de}.`,
        en: `That is USD 1m at today's spot (${spot}). But the forward is not at spot; it is at ${fwd(F)}: ${money(M02.fwdChf).en}.`,
      },
    },
    {
      label: money(M02.downChf - (M02.fwdChf - M02.downChf)),
      mono: true,
      explain: {
        de: `Hier wurde die Differenz zum Forward abgezogen statt dazugezählt. Mit dem Forward zahlt er genau ${money(M02.fwdChf).de}.`,
        en: `Here the difference to the forward was subtracted instead of added. With the forward he pays exactly ${money(M02.fwdChf).en}.`,
      },
    },
  ],
  correct: 1,
};

const usdLinear = N * (1 - E.rf * (M.days / M.basisBase));
const usdWrongWay = N * (1 + E.rf * (M.days / M.basisBase));
const check2: QuizQuestion = {
  id: 'm02-c2',
  prompt: {
    de: `Weg B: Wie viele Dollars kaufst du heute zum Spot, damit du mit einer Anlage zu ${rf.de} (Act/360) in 90 Tagen genau USD 1 Mio. hast?`,
    en: `Route B: how many dollars do you buy at spot today so that a deposit at ${rf.en} (Act/360) gives you exactly USD 1m in 90 days?`,
  },
  options: [
    {
      label: money(N, 'USD'),
      mono: true,
      explain: {
        de: `Dann hättest du nach 90 Tagen mehr als USD 1 Mio., weil die Anlage Zins bringt. Du brauchst heute nur den Barwert: ${money(M02.usdToday, 'USD').de}.`,
        en: `Then you would have more than USD 1m after 90 days, because the deposit earns interest. Today you only need the present value: ${money(M02.usdToday, 'USD').en}.`,
      },
    },
    {
      label: money(M02.usdToday, 'USD'),
      mono: true,
      explain: {
        de: `Richtig. USD 1 Mio. / (1 + ${rf.de} · 90/360) = ${money(M02.usdToday, 'USD').de}. Mit Zins wächst das genau auf USD 1 Mio.`,
        en: `Correct. USD 1m / (1 + ${rf.en} · 90/360) = ${money(M02.usdToday, 'USD').en}. With interest this grows to exactly USD 1m.`,
      },
    },
    {
      label: money(usdLinear, 'USD'),
      mono: true,
      explain: {
        de: `Das ist USD 1 Mio. minus den Zins (1 − ${rf.de} · 90/360). Abzinsen heisst aber teilen: USD 1 Mio. / (1 + ${rf.de} · 90/360) = ${money(M02.usdToday, 'USD').de}. Der Unterschied ist klein, aber nicht null.`,
        en: `That is USD 1m minus the interest (1 − ${rf.en} · 90/360). Discounting means dividing, though: USD 1m / (1 + ${rf.en} · 90/360) = ${money(M02.usdToday, 'USD').en}. The difference is small but not zero.`,
      },
    },
    {
      label: money(usdWrongWay, 'USD'),
      mono: true,
      explain: {
        de: `Das ist USD 1 Mio. mit Zins aufgezinst, also die falsche Richtung. Du suchst den Betrag heute, der zu USD 1 Mio. wächst: ${money(M02.usdToday, 'USD').de}.`,
        en: `That is USD 1m with interest added, the wrong direction. You are looking for today's amount that grows to USD 1m: ${money(M02.usdToday, 'USD').en}.`,
      },
    },
  ],
  correct: 1,
};

const check3: QuizQuestion = {
  id: 'm02-c3',
  prompt: {
    de: 'Angenommen, der CHF-Zins ist höher als der USD-Zins. Wie notiert der USD auf Termin gegen den Franken?',
    en: 'Suppose the CHF rate is higher than the USD rate. How does the USD trade forward against the franc?',
  },
  options: [
    {
      label: {
        de: 'Mit Aufschlag: Der Forward liegt über dem Spot.',
        en: 'At a premium: the forward is above spot.',
      },
      explain: {
        de: 'Richtig. Die Cost (CHF-Zins) ist grösser als der Benefit (USD-Zins). Forward = Spot + Cost − Benefit liegt darum über dem Spot.',
        en: 'Correct. The cost (CHF rate) is larger than the benefit (USD rate). Forward = spot + cost − benefit is therefore above spot.',
      },
    },
    {
      label: {
        de: 'Mit Abschlag: Der Forward liegt unter dem Spot.',
        en: 'At a discount: the forward is below spot.',
      },
      explain: {
        de: 'Das gilt im Beispiel, wo der USD-Zins höher ist. Hier ist es umgekehrt: Die Cost überwiegt, der Forward liegt über dem Spot.',
        en: 'That holds in the example, where the USD rate is higher. Here it is the other way round: the cost outweighs the benefit, so the forward is above spot.',
      },
    },
    {
      label: {
        de: 'Genau beim Spot, Forward Points gibt es nur bei gleichen Zinsen.',
        en: 'Exactly at spot; forward points only exist when rates are equal.',
      },
      explain: {
        de: 'Umgekehrt: Bei gleichen Zinsen sind die Points null. Jeder Zinsunterschied erzeugt Points.',
        en: 'The other way round: with equal rates the points are zero. Every rate differential creates points.',
      },
    },
    {
      label: {
        de: 'Das hängt davon ab, ob der Markt einen stärkeren Dollar erwartet.',
        en: 'It depends on whether the market expects a stronger dollar.',
      },
      explain: {
        de: 'Nein. Der Forward folgt allein aus Spot und Zinsen. Er ist keine Prognose. Bei höherem CHF-Zins liegt er über dem Spot.',
        en: 'No. The forward follows from spot and interest rates alone. It is not a forecast. With a higher CHF rate it is above spot.',
      },
    },
  ],
  correct: 0,
};

const check4: QuizQuestion = {
  id: 'm02-c4',
  prompt: {
    de: `Fair wäre ein 3-Monats-Forward von ${fwd(F)}. Ein Händler stellt ${fwd(M02.arbMarket)}. Womit verdienst du ohne Kursrisiko?`,
    en: `The fair 3-month forward would be ${fwd(F)}. A dealer quotes ${fwd(M02.arbMarket)}. How do you earn money without exchange-rate risk?`,
  },
  options: [
    {
      label: {
        de: 'USD forward verkaufen; CHF leihen, USD spot kaufen und anlegen',
        en: 'Sell USD forward; borrow CHF, buy USD spot and deposit them',
      },
      explain: {
        de: `Richtig. Du verkaufst den teuren Forward und kaufst die Dollars über den Geldmarkt zum fairen Kurs. Bei Fälligkeit bleiben ${money(M02.arbProfit).de}.`,
        en: `Correct. You sell the dear forward and buy the dollars through the money market at the fair rate. At maturity ${money(M02.arbProfit).en} is left.`,
      },
    },
    {
      label: {
        de: 'USD forward kaufen; USD leihen, spot verkaufen und CHF anlegen',
        en: 'Buy USD forward; borrow USD, sell them spot and deposit CHF',
      },
      explain: {
        de: `Falsche Richtung: Du würdest den teuren Forward kaufen. Das kostet dich ${money(M02.arbProfit).de}.`,
        en: `Wrong direction: you would be buying the dear forward. That costs you ${money(M02.arbProfit).en}.`,
      },
    },
    {
      label: {
        de: 'USD spot kaufen und ohne Absicherung bis zur Fälligkeit halten',
        en: 'Buy USD spot and hold them unhedged until maturity',
      },
      explain: {
        de: 'Das ist eine Wette auf den Dollar, keine Arbitrage. Ohne den Forward-Verkauf trägst du das volle Kursrisiko.',
        en: 'That is a bet on the dollar, not arbitrage. Without selling the forward you carry the full exchange-rate risk.',
      },
    },
  ],
  correct: 0,
};

/* ---------- Graded quiz ---------- */

const q1: QuizQuestion = {
  id: 'm02-q1',
  prompt: {
    de: `Der Importeur hat USD 1 Mio. auf Termin zu ${fwd(F)} gekauft. Bei Fälligkeit steht USD/CHF bei ${rate(H.stUp)}. Was ist der Forward für ihn an diesem Tag wert?`,
    en: `The importer has bought USD 1m forward at ${fwd(F)}. At maturity USD/CHF stands at ${rate(H.stUp)}. What is the forward worth to him on that day?`,
  },
  options: [
    {
      label: money(N * (H.stUp - F), E.quote, true),
      mono: true,
      explain: {
        de: `Richtig. USD 1 Mio. × (${rate(H.stUp)} − ${fwd(F)}). Genau so viel spart er gegenüber dem Kauf ohne Absicherung.`,
        en: `Correct. USD 1m × (${rate(H.stUp)} − ${fwd(F)}). That is exactly what he saves compared with buying unhedged.`,
      },
    },
    {
      label: money(N * (F - H.stUp), E.quote, true),
      mono: true,
      explain: {
        de: `Vorzeichen verkehrt. Wer Dollars auf Termin gekauft hat, gewinnt, wenn der Dollar steigt: ${money(N * (H.stUp - F), E.quote, true).de}.`,
        en: `Wrong sign. Whoever has bought dollars forward gains when the dollar rises: ${money(N * (H.stUp - F), E.quote, true).en}.`,
      },
    },
    {
      label: money(N * (H.stUp - E.spot), E.quote, true),
      mono: true,
      explain: {
        de: `Das ist der Abstand zum Spot von heute (${spot}). Der Importeur hat aber ${fwd(F)} fixiert, nicht den Spot.`,
        en: `That is the distance from today's spot (${spot}). But the importer locked in ${fwd(F)}, not spot.`,
      },
    },
    {
      label: money(0),
      mono: true,
      explain: {
        de: 'Null ist ein fairer Forward nur beim Abschluss. Danach gewinnt oder verliert er mit dem Kurs.',
        en: 'A fair forward is worth zero only when it is agreed. After that it gains or loses with the rate.',
      },
    },
  ],
  correct: 0,
};

const fSwapped = forwardMoneyMarket(E.spot, E.rf, E.rd, M.days, M.basisBase, M.basisQuote);
const fYear = forwardMoneyMarket(E.spot, E.rd, E.rf, M.basisBase, M.basisQuote, M.basisBase);
const fCont = forwardContinuous(E.spot, E.rd, E.rf, E.T);
const q2: QuizQuestion = {
  id: 'm02-q2',
  prompt: {
    de: `USD/CHF Spot ${spot}, Zins CHF ${rd.de}, Zins USD ${rf.de}, 90 Tage, Geldmarkt Act/360. Wo steht der faire Forward?`,
    en: `USD/CHF spot ${spot}, CHF rate ${rd.en}, USD rate ${rf.en}, 90 days, money market Act/360. Where is the fair forward?`,
  },
  options: [
    {
      label: { de: fwd(fSwapped), en: fwd(fSwapped) },
      mono: true,
      explain: {
        de: `Hier sind die Zinsen vertauscht. Der CHF-Zins (Quote) gehört in den Zähler, der USD-Zins (Base) in den Nenner: ${fwd(F)}.`,
        en: `Here the rates are swapped. The CHF rate (quote) goes in the numerator, the USD rate (base) in the denominator: ${fwd(F)}.`,
      },
    },
    {
      label: { de: fwd(F), en: fwd(F) },
      mono: true,
      explain: {
        de: `Richtig. ${spot} · (1 + ${rd.de} · 90/360) / (1 + ${rf.de} · 90/360) = ${fwd(F)}.`,
        en: `Correct. ${spot} · (1 + ${rd.en} · 90/360) / (1 + ${rf.en} · 90/360) = ${fwd(F)}.`,
      },
    },
    {
      label: { de: fwd(fCont), en: fwd(fCont) },
      mono: true,
      explain: {
        de: `Das ist der stetige Forward der Optionsmodelle, ${pips(Math.abs(fCont - F) / PIP).de} Pips daneben. Gefragt war der Geldmarkt: ${fwd(F)}.`,
        en: `That is the continuous forward of the option models, ${pips(Math.abs(fCont - F) / PIP).en} pips off. The question asked for the money market: ${fwd(F)}.`,
      },
    },
    {
      label: { de: fwd(fYear), en: fwd(fYear) },
      mono: true,
      explain: {
        de: `Hier wurde mit einem ganzen Jahr gerechnet statt mit 90/360. Für 3 Monate: ${fwd(F)}.`,
        en: `This uses a whole year instead of 90/360. For 3 months: ${fwd(F)}.`,
      },
    },
  ],
  correct: 1,
};

const q3: QuizQuestion = {
  id: 'm02-q3',
  prompt: {
    de: `Der 1-Jahres-Forward USD/CHF steht bei ${fwd(M02.fwd1Y)}, ${pips(Math.abs(M02.points1Y)).de} Pips unter dem Spot von ${spot}. Was sagt dir das?`,
    en: `The 1-year USD/CHF forward stands at ${fwd(M02.fwd1Y)}, ${pips(Math.abs(M02.points1Y)).en} pips below the spot of ${spot}. What does that tell you?`,
  },
  options: [
    {
      label: {
        de: 'Der Markt erwartet, dass der Dollar in einem Jahr so tief steht.',
        en: 'The market expects the dollar to stand that low in a year.',
      },
      explain: {
        de: 'Nein. Ein Forward ist keine Prognose. Er folgt allein aus Spot und Zinsen. Wo der Kurs in einem Jahr steht, weiss niemand.',
        en: 'No. A forward is not a forecast. It follows from spot and interest rates alone. Nobody knows where the rate will be in a year.',
      },
    },
    {
      label: {
        de: 'Der USD-Zins ist höher als der CHF-Zins; der Abschlag gleicht das aus.',
        en: 'The USD rate is higher than the CHF rate; the discount offsets that.',
      },
      explain: {
        de: `Richtig. Wer Dollars hält, verdient ${rf.de} statt ${rd.de}. Der Forward liegt genau um diesen Vorteil tiefer: Forward = Spot + Cost − Benefit.`,
        en: `Correct. Holding dollars earns ${rf.en} instead of ${rd.en}. The forward is lower by exactly that advantage: forward = spot + cost − benefit.`,
      },
    },
    {
      label: {
        de: 'Der Forward ist zu billig; das ist eine Arbitrage-Chance.',
        en: 'The forward is too cheap; that is an arbitrage opportunity.',
      },
      explain: {
        de: `Nein. ${fwd(M02.fwd1Y)} ist genau der faire Wert für ein Jahr. Arbitrage gibt es nur bei einer Abweichung vom fairen Forward, nicht vom Spot.`,
        en: `No. ${fwd(M02.fwd1Y)} is exactly the fair value for one year. Arbitrage only exists when the forward deviates from its fair value, not from spot.`,
      },
    },
    {
      label: {
        de: 'Die Bank gewährt dem Kunden einen Rabatt für die lange Laufzeit.',
        en: 'The bank grants the client a discount for the long term.',
      },
      explain: {
        de: 'Nein, das ist kein Rabatt. Der Abschlag ist der Zinsunterschied zwischen USD und CHF über ein Jahr.',
        en: 'No, it is not a rebate. The discount is the interest rate differential between USD and CHF over one year.',
      },
    },
  ],
  correct: 1,
};

const low = carryFor(M02.arbMarketLow);
const q4: QuizQuestion = {
  id: 'm02-q4',
  prompt: {
    de: `Fair wäre ${fwd(F)}. Ein Händler stellt den 3-Monats-Forward bei ${fwd(M02.arbMarketLow)}, also ${pips(Math.abs(low.mispricingPips)).de} Pips zu billig. Was bringt die richtige Arbitrage auf USD 1 Mio.?`,
    en: `The fair value would be ${fwd(F)}. A dealer quotes the 3-month forward at ${fwd(M02.arbMarketLow)}, ${pips(Math.abs(low.mispricingPips)).en} pips too cheap. What does the right arbitrage earn on USD 1m?`,
  },
  options: [
    {
      label: {
        de: `USD forward verkaufen, über den Geldmarkt kaufen: ${money(low.profitQuote).de}`,
        en: `Sell USD forward, buy through the money market: ${money(low.profitQuote).en}`,
      },
      explain: {
        de: `Falsche Richtung. Den billigen Forward verkaufst du nicht, du kaufst ihn. So verlierst du ${money(low.profitQuote).de}.`,
        en: `Wrong direction. You do not sell the cheap forward, you buy it. This way you lose ${money(low.profitQuote).en}.`,
      },
    },
    {
      label: {
        de: `USD forward kaufen, über den Geldmarkt verkaufen: ${money(low.profitQuote).de}`,
        en: `Buy USD forward, sell through the money market: ${money(low.profitQuote).en}`,
      },
      explain: {
        de: `Richtig. USD leihen, spot verkaufen, CHF anlegen und USD 1 Mio. auf Termin kaufen. Gewinn: USD 1 Mio. × ${pips(Math.abs(low.mispricingPips)).de} Pips = ${money(low.profitQuote).de}.`,
        en: `Correct. Borrow USD, sell them spot, deposit the CHF and buy USD 1m forward. Profit: USD 1m × ${pips(Math.abs(low.mispricingPips)).en} pips = ${money(low.profitQuote).en}.`,
      },
    },
    {
      label: {
        de: `USD forward kaufen, über den Geldmarkt verkaufen: ${money(low.profitQuote / 10).de}`,
        en: `Buy USD forward, sell through the money market: ${money(low.profitQuote / 10).en}`,
      },
      explain: {
        de: `Richtung stimmt, Betrag nicht. Ein Pip ist 0.0001, auf USD 1 Mio. also ${money(PIP * N).de}. Mal ${pips(Math.abs(low.mispricingPips)).de} Pips ergibt ${money(low.profitQuote).de}.`,
        en: `Right direction, wrong amount. One pip is 0.0001, on USD 1m that is ${money(PIP * N).en}. Times ${pips(Math.abs(low.mispricingPips)).en} pips gives ${money(low.profitQuote).en}.`,
      },
    },
    {
      label: {
        de: 'Nichts: Der Forward liegt sowieso unter dem Spot.',
        en: 'Nothing: the forward is below spot anyway.',
      },
      explain: {
        de: `Unter dem Spot liegt auch der faire Forward. Entscheidend ist die Abweichung vom fairen Wert ${fwd(F)}, und die bringt ${money(low.profitQuote).de}.`,
        en: `The fair forward is below spot too. What matters is the deviation from the fair value of ${fwd(F)}, and that earns ${money(low.profitQuote).en}.`,
      },
    },
  ],
  correct: 1,
};

/** Puts the options in a new order (indices into the original list); the answer follows. */
function reorder(q: QuizQuestion, order: number[]): QuizQuestion {
  return { ...q, options: order.map((i) => q.options[i]!), correct: order.indexOf(q.correct) };
}

export const quiz: ModuleQuiz = {
  slug: '02-forward',
  quiz: [q1, q2, reorder(q3, [0, 2, 3, 1]), reorder(q4, [0, 2, 1, 3])],
  checks: { '1': reorder(check1, [0, 2, 3, 1]), '2': check2, '3': check3, '4': check4 },
};
