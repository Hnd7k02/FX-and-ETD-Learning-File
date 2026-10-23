/**
 * Module 03 FX Swap: four graded quiz questions and one "Kurz geprüft" check per section.
 * Every number in a prompt, label or explanation is computed from the running example and the
 * teaching choices of the module (src/lib/nums/m03.ts → M03, src/lib/m03/config.ts) and
 * formatted with src/lib/format.ts.
 */
import type { Lang } from '@/i18n/types';
import { fmtMoney, fmtPct, fmtPips, fmtRate } from '@/lib/format';
import { M03_CONFIG, PIP } from '@/lib/m03/config';
import { swapLegs } from '@/lib/m03/legs';
import { EXAMPLE_MARKET as MK } from '@/lib/m03/trip';
import { M03 } from '@/lib/nums/m03';
import type { ModuleQuiz, QuizQuestion } from './types';

const C = M03_CONFIG;
const PAIR = C.market.pair;
const N = C.market.notional;
const RD = C.rateDigits;
const both = (f: (lang: Lang) => string) => ({ de: f('de'), en: f('en') });
const rate = (x: number, digits = 4) => fmtRate(x, PAIR, digits);
const chf = (x: number, sign = false) => both((l) => fmtMoney(x, C.market.quote, l, 0, sign));
const usd = (x: number) => both((l) => fmtMoney(x, C.market.base, l));
const pips = (x: number, digits = 1, sign = true) => both((l) => fmtPips(x, l, digits, sign));
const pct = (x: number) => both((l) => fmtPct(x, l, 1));

const spot = rate(MK.spot);
const rdTxt = pct(MK.rd);
const rfTxt = pct(MK.rf);
const days = C.market.days;
const legs = M03.legs;
const points3m = pips(legs.points);
const oldFwd = rate(M03.oldForward, RD);

/* ---------- Graded quiz ---------- */

const q1: QuizQuestion = {
  id: 'm03-q1',
  prompt: {
    de: `USD/CHF Spot ${spot}, CHF-Zins ${rdTxt.de}, USD-Zins ${rfTxt.de}. Wie viele Swap Points hat ein FX Swap über ${days} Tage (Geldmarkt, Act/360)?`,
    en: `USD/CHF spot ${spot}, CHF rate ${rdTxt.en}, USD rate ${rfTxt.en}. How many swap points does an FX swap over ${days} days have (money market, Act/360)?`,
  },
  options: [
    {
      label: pips(-legs.points),
      mono: true,
      explain: {
        de: 'Vorzeichen vertauscht. Die Base-Währung USD hat den höheren Zins. Darum liegt der Far-Kurs unter dem Spot: ein Abschlag, also negative Swap Points.',
        en: 'Sign flipped. The base currency USD has the higher rate. So the far rate lies below spot: a discount, i.e. negative swap points.',
      },
    },
    {
      label: pips(legs.approxPoints),
      mono: true,
      explain: {
        de: `Das ist die Faustregel S · (r CHF − r USD) · t. Exakt teilst du noch durch (1 + r USD · t) und kommst auf ${points3m.de} Pips.`,
        en: `That is the rule of thumb S · (r CHF − r USD) · t. Exactly, you also divide by (1 + r USD · t) and get ${points3m.en} pips.`,
      },
    },
    {
      label: points3m,
      mono: true,
      explain: {
        de: `Richtig. Far-Kurs = ${spot} · (1 + ${rdTxt.de} · ${days}/360) / (1 + ${rfTxt.de} · ${days}/360) = ${rate(legs.rows[1].rate, RD)}. Far minus Near sind ${points3m.de} Pips, gleich viel wie die Forward Points.`,
        en: `Correct. Far rate = ${spot} · (1 + ${rdTxt.en} · ${days}/360) / (1 + ${rfTxt.en} · ${days}/360) = ${rate(legs.rows[1].rate, RD)}. Far minus near is ${points3m.en} pips, the same as the forward points.`,
      },
    },
    {
      label: pips((MK.spot * (MK.rd - MK.rf)) / PIP),
      mono: true,
      explain: {
        de: `Das ist die Zinsdifferenz über ein ganzes Jahr. Für ${days} Tage multiplizierst du noch mit ${days}/360 und teilst durch (1 + r USD · t).`,
        en: `That is the interest differential over a whole year. For ${days} days you still multiply by ${days}/360 and divide by (1 + r USD · t).`,
      },
    },
  ],
  correct: 2,
};

// Spot moves by 50 pips right after the trade: the swap points move only a little
const BUMP_PIPS = 50;
const bumped = swapLegs({ ...MK, spot: MK.spot + BUMP_PIPS * PIP, days, side: 'buySellBase' });
const dPoints = pips(Math.abs(bumped.points - legs.points), 1, false);
const legMove = chf(N * BUMP_PIPS * PIP);

const q2: QuizQuestion = {
  id: 'm03-q2',
  prompt: {
    de: `Ein Händler hat einen Swap Buy/Sell USD 1 Mio. über ${days} Tage im Buch. Kurz nach dem Abschluss steigt der Spot um ${BUMP_PIPS} Pips, die Zinsen bleiben gleich. Was passiert mit dem Wert des Swaps?`,
    en: `A dealer holds a buy/sell USD 1m swap over ${days} days. Shortly after the trade the spot rises by ${BUMP_PIPS} pips; interest rates stay the same. What happens to the value of the swap?`,
  },
  options: [
    {
      label: {
        de: `Er gewinnt ${legMove.de}, weil er USD gekauft hat.`,
        en: `He gains ${legMove.en} because he bought USD.`,
      },
      explain: {
        de: 'Er hat die USD gekauft und gleich auf Termin wieder verkauft. Der Gewinn im Near Leg wird durch den Verlust im Far Leg fast ganz aufgehoben.',
        en: 'He bought the USD and sold them forward straight away. The gain on the near leg is almost fully offset by the loss on the far leg.',
      },
    },
    {
      label: {
        de: 'Er ändert sich kaum: Near und Far Leg verschieben sich gemeinsam.',
        en: 'It hardly changes: the near and far legs move together.',
      },
      explain: {
        de: `Richtig. Long USD im Near Leg, short USD im Far Leg: Die Kursbewegung hebt sich fast auf. Die Swap Points ändern sich nur um ${dPoints.de} Pips, weil sie proportional zum Spot sind. Ein Swap trägt Zinsrisiko, kaum Kursrisiko.`,
        en: `Correct. Long USD in the near leg, short USD in the far leg: the move almost cancels out. The swap points change by only ${dPoints.en} pips, because they are proportional to the spot. A swap carries interest rate risk, hardly any FX risk.`,
      },
    },
    {
      label: {
        de: `Er verliert ${legMove.de}, weil er USD auf Termin verkauft hat.`,
        en: `He loses ${legMove.en} because he sold USD forward.`,
      },
      explain: {
        de: 'Der Verlust im Far Leg wird durch den Gewinn im Near Leg fast ganz ausgeglichen. Unter dem Strich bleibt fast nichts.',
        en: 'The loss on the far leg is almost fully offset by the gain on the near leg. Almost nothing is left.',
      },
    },
    {
      label: {
        de: `Die Swap Points springen um ${BUMP_PIPS} Pips.`,
        en: `The swap points jump by ${BUMP_PIPS} pips.`,
      },
      explain: {
        de: `Die Swap Points hängen an der Zinsdifferenz. Der Spot wirkt nur als Massstab: ${BUMP_PIPS} Pips mehr Spot ändern sie hier um ${dPoints.de} Pips.`,
        en: `The swap points depend on the interest differential. The spot only scales them: ${BUMP_PIPS} pips more spot change them here by ${dPoints.en} pips.`,
      },
    },
  ],
  correct: 1,
};

const up = M03.up;
/** Sign error made with the numbers as shown (rounded old forward and swap points). */
const shownRound = (x: number, d: number) => Math.round(x * 10 ** d) / 10 ** d;
const allInSignFlipped = shownRound(M03.oldForward, RD) - shownRound(up.points, 1) * PIP;
const q3: QuizQuestion = {
  id: 'm03-q3',
  prompt: {
    de: `Der Importeur rollt seinen Forward zu ${oldFwd} um ${M03.slipDays} Tage. Spot beim Abschluss des Rolls ${rate(C.roll.scenarioUp)}, Swap Points ${pips(up.points).de}. Welcher All-in-Kurs gilt für die neue Zahlung?`,
    en: `The importer rolls his forward at ${oldFwd} by ${M03.slipDays} days. Spot when the roll is dealt ${rate(C.roll.scenarioUp)}, swap points ${pips(up.points).en}. Which all-in rate applies to the new payment?`,
  },
  options: [
    {
      label: { de: rate(up.farRate, RD), en: rate(up.farRate, RD) },
      mono: true,
      explain: {
        de: `Das ist nur der neue Far-Kurs. Du hast den Ausgleich vergessen: Am Roll-Datum erhält der Importeur ${chf(up.settlement).de}.`,
        en: `That is only the new far rate. You forgot the settlement: on the roll date the importer receives ${chf(up.settlement).en}.`,
      },
    },
    {
      label: { de: oldFwd, en: oldFwd },
      mono: true,
      explain: {
        de: 'Das ist der alte Forward. Die Verschiebung um einen Monat bringt aber die Swap Points dazu.',
        en: 'That is the old forward. Moving the date by a month adds the swap points, though.',
      },
    },
    {
      label: {
        de: rate(allInSignFlipped, RD),
        en: rate(allInSignFlipped, RD),
      },
      mono: true,
      explain: {
        de: 'Vorzeichen vertauscht. Die Swap Points sind negativ, also liegt der All-in-Kurs unter dem alten Forward.',
        en: 'Sign flipped. The swap points are negative, so the all-in rate lies below the old forward.',
      },
    },
    {
      label: { de: rate(up.allIn, RD), en: rate(up.allIn, RD) },
      mono: true,
      explain: {
        de: `Richtig. All-in = alter Forward + Swap Points = ${oldFwd} + (${pips(up.points).de} Pips) = ${rate(up.allIn, RD)}. Zusammen mit dem Ausgleich am Roll-Datum zahlt er ${chf(up.totalChf).de}.`,
        en: `Correct. All-in = old forward + swap points = ${oldFwd} + (${pips(up.points).en} pips) = ${rate(up.allIn, RD)}. Together with the settlement on the roll date he pays ${chf(up.totalChf).en}.`,
      },
    },
  ],
  correct: 3,
};

const q4: QuizQuestion = {
  id: 'm03-q4',
  prompt: {
    de: 'Welche Aussage trifft auf einen Cross-Currency Swap zu, aber nicht auf einen FX Swap?',
    en: 'Which statement is true of a cross-currency swap but not of an FX swap?',
  },
  options: [
    {
      label: {
        de: 'Das Nominal wird am Anfang und am Ende getauscht.',
        en: 'The notional is exchanged at the start and at the end.',
      },
      explain: {
        de: 'Das gilt für beide. Beide tauschen Kapital hin und zurück.',
        en: 'That is true of both. Both exchange principal there and back.',
      },
    },
    {
      label: {
        de: 'Während der Laufzeit fliessen Zinsen in beiden Währungen; zurückgetauscht wird zum Anfangskurs.',
        en: 'Interest flows in both currencies during the term; the re-exchange is at the starting rate.',
      },
      explain: {
        de: 'Richtig. Beim CCS fliesst die Zinsdifferenz offen als Zins. Beim FX Swap steckt sie im Far-Kurs, und dazwischen fliesst nichts.',
        en: 'Correct. In a CCS the interest differential flows openly as interest. In an FX swap it sits in the far rate, and nothing flows in between.',
      },
    },
    {
      label: {
        de: 'Der Rücktausch erfolgt zum Spot plus Swap Points.',
        en: 'The re-exchange happens at spot plus swap points.',
      },
      explain: {
        de: 'Das ist der FX Swap: Sein Far-Kurs ist Spot plus Swap Points. Der CCS tauscht zum Anfangskurs zurück.',
        en: 'That is the FX swap: its far rate is spot plus swap points. The CCS exchanges back at the starting rate.',
      },
    },
    {
      label: {
        de: 'Auf dem Nominal gibt es kein Kursrisiko.',
        en: 'There is no FX risk on the notional.',
      },
      explain: {
        de: 'Das gilt für beide: Bei beiden steht der Kurs des Rücktauschs von Anfang an fest.',
        en: 'That is true of both: in both, the rate of the re-exchange is fixed from the start.',
      },
    },
  ],
  correct: 1,
};

/* ---------- Checks, one per section ---------- */

const trip = M03.trip;
const c1: QuizQuestion = {
  id: 'm03-c1',
  prompt: {
    de: `Die Firma kauft USD 1 Mio. zu ${spot} und verkauft sie nach ${C.trip.days} Tagen zu ${rate(trip.swap.farRate, RD)} zurück. Warum bekommt sie ${chf(trip.costChf).de} weniger zurück, als sie bezahlt hat?`,
    en: `The company buys USD 1m at ${spot} and sells them back after ${C.trip.days} days at ${rate(trip.swap.farRate, RD)}. Why does it get back ${chf(trip.costChf).en} less than it paid?`,
  },
  options: [
    {
      label: {
        de: 'Weil der Dollar in diesem Monat gefallen ist.',
        en: 'Because the dollar fell during the month.',
      },
      explain: {
        de: 'Nein. Beide Kurse standen schon beim Abschluss fest. Wo der Spot in einem Monat steht, spielt für den Swap keine Rolle.',
        en: 'No. Both rates were fixed when the deal was done. Where the spot is in a month does not matter for the swap.',
      },
    },
    {
      label: {
        de: 'Weil sie einen Monat lang die höher verzinste Währung hält.',
        en: 'Because it holds the higher-yielding currency for a month.',
      },
      explain: {
        de: `Richtig. Dollar bringen ${rfTxt.de}, Franken ${rdTxt.de}. Der USD-Zins von ${usd(trip.usdInterest).de} zum Far-Kurs ergibt genau ${chf(trip.costChf).de}.`,
        en: `Correct. Dollars earn ${rfTxt.en}, francs ${rdTxt.en}. The USD interest of ${usd(trip.usdInterest).en} at the far rate gives exactly ${chf(trip.costChf).en}.`,
      },
    },
    {
      label: {
        de: 'Das ist die Gebühr der Bank.',
        en: 'That is the bank’s fee.',
      },
      explain: {
        de: `Spreads gibt es auch, aber hier geht es um etwas anderes: Die ${chf(trip.costChf).de} sind die Zinsdifferenz über die Laufzeit.`,
        en: `Spreads exist too, but this is something else: the ${chf(trip.costChf).en} are the interest differential over the term.`,
      },
    },
  ],
  correct: 1,
};

const c2: QuizQuestion = {
  id: 'm03-c2',
  prompt: {
    de: `Du drehst einen Swap über ${days} Tage von Buy/Sell USD auf Sell/Buy USD. Was passiert mit den Swap Points von ${points3m.de}?`,
    en: `You turn a ${days}-day swap from buy/sell USD into sell/buy USD. What happens to the swap points of ${points3m.en}?`,
  },
  options: [
    {
      label: {
        de: 'Sie bleiben gleich; nur die Zahlungsrichtung kehrt sich um.',
        en: 'They stay the same; only the direction of the payments flips.',
      },
      explain: {
        de: `Richtig. Der Far-Kurs ist derselbe Forward. Netto erhältst du jetzt ${chf(M03.mirror.net.quote).de}, statt sie zu bezahlen.`,
        en: `Correct. The far rate is the same forward. Net, you now receive ${chf(M03.mirror.net.quote).en} instead of paying it.`,
      },
    },
    {
      label: { de: 'Sie wechseln das Vorzeichen.', en: 'They change sign.' },
      explain: {
        de: 'Nein. Das Vorzeichen hängt an der Zinsdifferenz, nicht an der Richtung. Es ändert sich nur, wer die Differenz bezahlt.',
        en: 'No. The sign depends on the interest differential, not on the direction. Only who pays the difference changes.',
      },
    },
    {
      label: {
        de: 'Sie werden null, weil sich beide Richtungen aufheben.',
        en: 'They become zero because the two directions cancel out.',
      },
      explain: {
        de: 'Nein. Null wären sie nur bei gleichen Zinsen in CHF und USD.',
        en: 'No. They would only be zero if CHF and USD rates were equal.',
      },
    },
  ],
  correct: 0,
};

const down = M03.down;
const c3: QuizQuestion = {
  id: 'm03-c3',
  prompt: {
    de: `Der Importeur rollt seinen Forward zu ${oldFwd}. Beim Abschluss des Rolls steht der Spot bei ${rate(C.roll.scenarioDown)}. Was passiert am alten Fälligkeitstag?`,
    en: `The importer rolls his forward at ${oldFwd}. When the roll is dealt, the spot is at ${rate(C.roll.scenarioDown)}. What happens on the old maturity date?`,
  },
  options: [
    {
      label: {
        de: `Er erhält ${chf(-down.settlement).de}.`,
        en: `He receives ${chf(-down.settlement).en}.`,
      },
      explain: {
        de: 'Vorzeichen vertauscht. Der Spot liegt unter seinem alten Forward: Der Hedge ist aus dem Geld, er muss zahlen.',
        en: 'Sign flipped. The spot is below his old forward: the hedge is out of the money, so he has to pay.',
      },
    },
    {
      label: {
        de: 'Nichts, der Swap verschiebt nur das Datum.',
        en: 'Nothing; the swap only moves the date.',
      },
      explain: {
        de: 'Beim Roll zum aktuellen Spot fällt die Differenz zwischen Spot und altem Forward bar an. Ohne Ausgleich ginge es nur zum historischen Kurs.',
        en: 'When rolling at the current spot, the difference between spot and the old forward is settled in cash. Avoiding it is only possible at the historical rate.',
      },
    },
    {
      label: {
        de: `Er zahlt ${chf(-down.settlement).de}.`,
        en: `He pays ${chf(-down.settlement).en}.`,
      },
      explain: {
        de: `Richtig. Forward und Near Leg zusammen: (${rate(C.roll.scenarioDown)} − ${oldFwd}) · USD 1 Mio. = ${chf(down.settlement).de}. Dafür ist sein neuer Far-Kurs tiefer, der All-in-Kurs bleibt bei ${rate(down.allIn, RD)}.`,
        en: `Correct. Forward and near leg together: (${rate(C.roll.scenarioDown)} − ${oldFwd}) · USD 1m = ${chf(down.settlement).en}. In return his new far rate is lower; the all-in rate stays at ${rate(down.allIn, RD)}.`,
      },
    },
  ],
  correct: 2,
};

const c4: QuizQuestion = {
  id: 'm03-c4',
  prompt: {
    de: 'Eine Schweizer Firma hat eine Anleihe in USD mit fünf Jahren Laufzeit herausgegeben, braucht aber Franken. Welches Instrument passt am besten?',
    en: 'A Swiss company has issued a five-year bond in USD but needs francs. Which instrument fits best?',
  },
  options: [
    {
      label: {
        de: 'Ein FX Swap über 3 Monate, alle 3 Monate gerollt.',
        en: 'A 3-month FX swap, rolled every 3 months.',
      },
      explain: {
        de: 'Möglich, aber jedes Rollen bringt neue Swap Points und einen Ausgleich zum aktuellen Spot. Über fünf Jahre sind das Zins- und Liquiditätsrisiken. Der CCS passt zur Laufzeit der Anleihe.',
        en: 'Possible, but every roll brings new swap points and a settlement at the current spot. Over five years that means interest rate and liquidity risk. The CCS matches the term of the bond.',
      },
    },
    {
      label: {
        de: 'Ein Cross-Currency Swap über fünf Jahre.',
        en: 'A five-year cross-currency swap.',
      },
      explain: {
        de: 'Richtig. Sie tauscht den Erlös in CHF, erhält USD-Zinsen für die Coupons, zahlt CHF-Zinsen und tauscht am Ende zum Anfangskurs zurück.',
        en: 'Correct. It exchanges the proceeds into CHF, receives USD interest for the coupons, pays CHF interest and exchanges back at the starting rate at the end.',
      },
    },
    {
      label: { de: 'Ein Spot-Geschäft heute.', en: 'A spot deal today.' },
      explain: {
        de: 'Dann hat sie Franken, aber am Ende eine USD-Schuld mit offenem Kursrisiko.',
        en: 'Then it has francs, but at the end a USD debt with open FX risk.',
      },
    },
  ],
  correct: 1,
};

export const quiz: ModuleQuiz = {
  slug: '03-fx-swap',
  quiz: [q1, q2, q3, q4],
  checks: { '1': c1, '2': c2, '3': c3, '4': c4 },
};
