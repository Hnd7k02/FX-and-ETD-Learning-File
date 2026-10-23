/**
 * Module 01 FX market & spot: four graded quiz questions and one "Kurz geprüft" check per
 * section. Every number in a prompt, label or explanation is computed from the running example,
 * the module logic (src/lib/m01) and the number registry (src/lib/nums/m01.ts → M01), and
 * formatted with src/lib/format.ts. Distractors are the typical mistakes: pip vs big figure,
 * symmetric percentages, bid and ask mixed up, a stop treated as a fixed rate, forgetting the
 * interest when looking for a break-even.
 */
import type { Lang } from '@/i18n/types';
import { fmtMoney, fmtNumber, fmtPct, fmtRate } from '@/lib/format';
import { EXAMPLE as E } from '@/lib/fx/example';
import { BIG_FIGURE, PIP, exposure } from '@/lib/m01/exposure';
import { ORDER_DEMO } from '@/lib/m01/orders';
import { SPREAD_MODEL, spreadCost } from '@/lib/m01/quote';
import {
  fmtClock,
  overlapWindow,
  weekStart,
  zurichWindow,
  SESSION_CONFIG,
} from '@/lib/m01/sessions';
import { M01, M01_SCENARIOS as SC } from '@/lib/nums/m01';
import type { ModuleQuiz, QuizQuestion } from './types';

const PAIR = E.pair;
const N = E.notional;
const both = (f: (lang: Lang) => string) => ({ de: f('de'), en: f('en') });
const rate = (x: number, digits = 4) => fmtRate(x, PAIR, digits);
const money = (x: number, ccy: string = E.quote, sign = false) =>
  both((l) => fmtMoney(x, ccy, l, 0, sign));
const pct = (x: number, digits = 2, sign = true) => both((l) => fmtPct(x, l, digits, sign));
const int = (x: number) => both((l) => fmtNumber(x, l, { digits: 0 }));

const spot = rate(E.spot);

/* ---------- Checks (one per section, ungraded) ---------- */

const bfUp = exposure(E.spot + BIG_FIGURE);
const check1: QuizQuestion = {
  id: 'm01-c1',
  prompt: {
    de: `USD/CHF steigt bis zum Zahltag von ${spot} auf ${rate(E.spot + BIG_FIGURE)}. Wie viel mehr kosten den Importeur seine USD 1 Mio.?`,
    en: `By payment day USD/CHF rises from ${spot} to ${rate(E.spot + BIG_FIGURE)}. How much more do the importer's USD 1m cost him?`,
  },
  options: [
    {
      label: money(PIP * N),
      mono: true,
      explain: {
        de: `Das ist ein Pip (0.0001). Der Kurs ist aber um eine Big Figure gestiegen, also um 100 Pips: ${money(bfUp.diff).de}.`,
        en: `That is one pip (0.0001). But the rate has risen by a big figure, 100 pips: ${money(bfUp.diff).en}.`,
      },
    },
    {
      label: money(bfUp.diff),
      mono: true,
      explain: {
        de: `Richtig. Eine Big Figure ist 0.0100. Mal USD 1 Mio. ergibt das ${money(bfUp.diff).de}.`,
        en: `Correct. One big figure is 0.0100. Times USD 1m that makes ${money(bfUp.diff).en}.`,
      },
    },
    {
      label: money(BIG_FIGURE * N * 10),
      mono: true,
      explain: {
        de: `Zehnmal zu viel: Das wären zehn Big Figures (0.1000). Richtig ist 0.0100 · USD 1 Mio. = ${money(bfUp.diff).de}.`,
        en: `Ten times too much: that would be ten big figures (0.1000). The right answer is 0.0100 · USD 1m = ${money(bfUp.diff).en}.`,
      },
    },
    {
      label: money(-bfUp.diff, E.quote, true),
      mono: true,
      explain: {
        de: `Falsches Vorzeichen. Der Importeur ist short USD: Steigt der Dollar, zahlt er mehr, nämlich ${money(bfUp.diff).de}.`,
        en: `Wrong sign. The importer is short USD: if the dollar rises, he pays more, namely ${money(bfUp.diff).en}.`,
      },
    },
  ],
  correct: 1,
};

const peak = overlapWindow('winter', 'monThu')!;
const peakText = `${fmtClock(peak[0])}–${fmtClock(peak[1])}`;
const ws = weekStart('winter');
const tokyo = zurichWindow(
  SESSION_CONFIG.sessions.find((s) => s.id === 'tokyo')!,
  'winter',
);
const check2: QuizQuestion = {
  id: 'm01-c2',
  prompt: {
    de: 'Wann ist der Devisenmarkt an einem normalen Werktag typischerweise am tiefsten, also am liquidesten (Zürcher Zeit, Winter)?',
    en: 'When is the FX market typically deepest, i.e. most liquid, on a normal weekday (Zurich time, winter)?',
  },
  options: [
    {
      label: {
        de: `Am Sonntagabend um ${fmtClock(ws.hour)}, wenn Wellington öffnet`,
        en: `On Sunday evening at ${fmtClock(ws.hour)}, when Wellington opens`,
      },
      explain: {
        de: 'Dort beginnt die Woche, aber nur wenige Händler sind wach. Der Markt ist dann dünn, nicht tief.',
        en: 'That is where the week starts, but few dealers are awake. The market is thin then, not deep.',
      },
    },
    {
      label: {
        de: `Gegen ${fmtClock(tokyo.open)}, wenn Tokio öffnet`,
        en: `Around ${fmtClock(tokyo.open)}, when Tokyo opens`,
      },
      explain: {
        de: 'Tokio ist ein grosses Zentrum, aber Europa und Amerika schlafen. Die Liquidität ist nur mittel.',
        en: 'Tokyo is a major centre, but Europe and America are asleep. Liquidity is only moderate.',
      },
    },
    {
      label: {
        de: `Am Nachmittag, etwa ${peakText}, wenn London und New York gleichzeitig offen sind`,
        en: `In the afternoon, about ${peakText}, when London and New York are open at the same time`,
      },
      explain: {
        de: 'Richtig. In der Überlappung der beiden grössten Zentren stellen die meisten Händler Kurse. Die Spreads sind dann am engsten.',
        en: 'Correct. In the overlap of the two largest centres most dealers are making prices. Spreads are tightest then.',
      },
    },
  ],
  correct: 2,
};

const quote = M01.quote;
const halfBase = spreadCost(SPREAD_MODEL.basePips, N);
const check3: QuizQuestion = {
  id: 'm01-c3',
  prompt: {
    de: `Der Market Maker quotiert USD/CHF ${rate(quote.bid)} / ${rate(quote.ask)}. Der Importeur kauft USD 1 Mio. Wie viel zahlt er gegenüber dem Mittelkurs ${spot} mehr?`,
    en: `The market maker quotes USD/CHF ${rate(quote.bid)} / ${rate(quote.ask)}. The importer buys USD 1m. How much more does he pay than at the mid of ${spot}?`,
  },
  options: [
    {
      label: money(halfBase),
      mono: true,
      explain: {
        de: `Richtig. Er kauft zum Ask ${rate(quote.ask)}, ${int(SPREAD_MODEL.basePips / 2).de} Pips über der Mitte: ${money(halfBase).de}, der halbe Spread.`,
        en: `Correct. He buys at the ask of ${rate(quote.ask)}, ${int(SPREAD_MODEL.basePips / 2).en} pips above the mid: ${money(halfBase).en}, half the spread.`,
      },
    },
    {
      label: money(spreadCost(SPREAD_MODEL.basePips, N, 'full')),
      mono: true,
      explain: {
        de: `Das ist der ganze Spread. Er fällt nur an, wenn er kauft und sofort wieder verkauft. Gegenüber der Mitte zahlt er den halben: ${money(halfBase).de}.`,
        en: `That is the whole spread. It only applies if he buys and sells straight back. Against the mid he pays half of it: ${money(halfBase).en}.`,
      },
    },
    {
      label: money(SPREAD_MODEL.basePips / 2),
      mono: true,
      explain: {
        de: `Hier wurden Pips direkt als Franken gezählt. Ein Pip ist auf USD 1 Mio. aber ${money(PIP * N).de} wert, also ${money(halfBase).de}.`,
        en: `This counts pips directly as francs. But on USD 1m one pip is worth ${money(PIP * N).en}, so ${money(halfBase).en}.`,
      },
    },
    {
      label: money(-halfBase, E.quote, true),
      mono: true,
      explain: {
        de: `Bid und Ask verwechselt. Der Importeur kauft Dollars und zahlt den höheren Kurs, den Ask. Er zahlt mehr, nicht weniger: ${money(halfBase).de}.`,
        en: `Bid and ask mixed up. The importer buys dollars and pays the higher rate, the ask. He pays more, not less: ${money(halfBase).en}.`,
      },
    },
  ],
  correct: 0,
};

const check4: QuizQuestion = {
  id: 'm01-c4',
  prompt: {
    de: 'Welche dieser Währungen gilt als typische Rohstoffwährung?',
    en: 'Which of these currencies is a typical commodity currency?',
  },
  options: [
    {
      label: { de: 'CHF', en: 'CHF' },
      mono: true,
      explain: {
        de: 'Der Franken gilt als Safe Haven und als Funding-Währung, nicht als Rohstoffwährung.',
        en: 'The franc counts as a safe haven and a funding currency, not as a commodity currency.',
      },
    },
    {
      label: { de: 'NOK', en: 'NOK' },
      mono: true,
      explain: {
        de: 'Richtig. Norwegen exportiert viel Öl und Gas. Die Krone folgt darum oft den Energiepreisen.',
        en: 'Correct. Norway exports a lot of oil and gas, so the krone often follows energy prices.',
      },
    },
    {
      label: { de: 'JPY', en: 'JPY' },
      mono: true,
      explain: {
        de: 'Japan importiert viele Rohstoffe. Der Yen gilt als Safe Haven und Funding-Währung.',
        en: 'Japan imports many commodities. The yen counts as a safe haven and a funding currency.',
      },
    },
    {
      label: { de: 'EUR', en: 'EUR' },
      mono: true,
      explain: {
        de: 'Der Euro ist eine grosse Reservewährung. Seine Treiber sind vor allem EZB, Wachstum und Inflation im Euroraum.',
        en: 'The euro is a major reserve currency. Its main drivers are the ECB, growth and inflation in the euro area.',
      },
    },
  ],
  correct: 1,
};

/* ---------- Graded quiz ---------- */

const up = M01.up;
const symmetric = -up.pct;
const wrongFormula = -up.pct / (1 - up.pct);
const q1: QuizQuestion = {
  id: 'm01-q1',
  prompt: {
    de: `USD/CHF steigt von ${spot} auf ${rate(SC.stUp)}, der Dollar gewinnt ${pct(up.pct, 1, false).de}. Um wie viel ändert sich CHF/USD, der Preis des Frankens in Dollar?`,
    en: `USD/CHF rises from ${spot} to ${rate(SC.stUp)}; the dollar gains ${pct(up.pct, 1, false).en}. By how much does CHF/USD, the price of the franc in dollars, change?`,
  },
  options: [
    {
      label: pct(symmetric),
      mono: true,
      explain: {
        de: `Prozente sind beim Kehrwert nicht symmetrisch. CHF/USD fällt von ${rate(1 / E.spot)} auf ${rate(up.inverse)}, das sind ${pct(up.inversePct).de}.`,
        en: `Percentages are not symmetric for the inverse. CHF/USD falls from ${rate(1 / E.spot)} to ${rate(up.inverse)}, which is ${pct(up.inversePct).en}.`,
      },
    },
    {
      label: pct(up.inversePct),
      mono: true,
      explain: {
        de: `Richtig. 1 / (1 + x) − 1 = −x / (1 + x). Mit x = ${pct(up.pct, 1).de} ergibt das ${pct(up.inversePct).de}.`,
        en: `Correct. 1 / (1 + x) − 1 = −x / (1 + x). With x = ${pct(up.pct, 1).en} that gives ${pct(up.inversePct).en}.`,
      },
    },
    {
      label: pct(up.pct),
      mono: true,
      explain: {
        de: `Falsche Richtung. Wird der Dollar teurer, bekommst du für einen Franken weniger Dollars: CHF/USD fällt, um ${pct(up.inversePct).de}.`,
        en: `Wrong direction. If the dollar gets dearer, a franc buys fewer dollars: CHF/USD falls, by ${pct(up.inversePct).en}.`,
      },
    },
    {
      label: pct(wrongFormula),
      mono: true,
      explain: {
        de: `Das wäre −x / (1 − x), mit dem falschen Vorzeichen im Nenner. Richtig ist −x / (1 + x): ${rate(1 / E.spot)} → ${rate(up.inverse)}, also ${pct(up.inversePct).de}.`,
        en: `That would be −x / (1 − x), with the wrong sign in the denominator. The right formula is −x / (1 + x): ${rate(1 / E.spot)} → ${rate(up.inverse)}, so ${pct(up.inversePct).en}.`,
      },
    },
  ],
  correct: 1,
};

const gap = M01.stopGap;
const q2: QuizQuestion = {
  id: 'm01-q2',
  prompt: {
    de: `Der Importeur legt einen Stop-Loss: USD 1 Mio. kaufen, sobald der Ask ${rate(ORDER_DEMO.stop.level)} erreicht. Am Freitag schliesst der Ask bei ${rate(M01.gapFridayAsk)}, am Montag öffnet er nach einer Überraschung bei ${rate(M01.gapMondayAsk)}. Zu welchem Kurs kauft er?`,
    en: `The importer places a stop-loss: buy USD 1m as soon as the ask reaches ${rate(ORDER_DEMO.stop.level)}. On Friday the ask closes at ${rate(M01.gapFridayAsk)}; on Monday, after a surprise, it opens at ${rate(M01.gapMondayAsk)}. At what rate does he buy?`,
  },
  options: [
    {
      label: { de: rate(ORDER_DEMO.stop.level), en: rate(ORDER_DEMO.stop.level) },
      mono: true,
      explain: {
        de: `Ein Stop-Loss ist kein garantierter Kurs. Zu ${rate(ORDER_DEMO.stop.level)} gab es nie einen Kurs, der Markt ist darüber gesprungen.`,
        en: `A stop-loss is not a guaranteed rate. There never was a price at ${rate(ORDER_DEMO.stop.level)}: the market jumped over it.`,
      },
    },
    {
      label: { de: rate(M01.gapFridayAsk), en: rate(M01.gapFridayAsk) },
      mono: true,
      explain: {
        de: 'Am Freitag lag der Ask noch unter dem Stop. Der Stop war also nicht ausgelöst, und der Freitagskurs ist vorbei.',
        en: 'On Friday the ask was still below the stop, so the stop had not been triggered, and the Friday rate is gone.',
      },
    },
    {
      label: { de: rate(gap.price), en: rate(gap.price) },
      mono: true,
      explain: {
        de: `Richtig. Der Stop wird ausgelöst und als Market Order zum ersten verfügbaren Kurs ausgeführt: ${int(gap.slippagePips).de} Pips schlechter, ${money(gap.slippagePips * PIP * N).de} mehr als geplant.`,
        en: `Correct. The stop is triggered and executed as a market order at the first available rate: ${int(gap.slippagePips).en} pips worse, ${money(gap.slippagePips * PIP * N).en} more than planned.`,
      },
    },
    {
      label: { de: 'gar nicht', en: 'not at all' },
      explain: {
        de: `Doch: Der Ask liegt über dem Stop, also ist die Order ausgelöst. Sie wird zum ersten verfügbaren Kurs ausgeführt, ${rate(gap.price)}.`,
        en: `It does: the ask is above the stop, so the order is triggered. It is executed at the first available rate, ${rate(gap.price)}.`,
      },
    },
  ],
  correct: 2,
};

const tri = M01.tri.state;
const qt = tri.quotes;
const two = (q: { bid: number; ask: number }, pair: string) =>
  `${fmtRate(q.bid, pair)} / ${fmtRate(q.ask, pair)}`;
const q3: QuizQuestion = {
  id: 'm01-q3',
  prompt: {
    de: `EUR/USD ${two(qt.eurusd, 'EUR/USD')}, USD/CHF ${two(qt.usdchf, PAIR)}. EUR/CHF wird direkt mit ${two(qt.eurchf, 'EUR/CHF')} quotiert. Was tust du, wenn du mit EUR 1 Mio. startest?`,
    en: `EUR/USD ${two(qt.eurusd, 'EUR/USD')}, USD/CHF ${two(qt.usdchf, PAIR)}. EUR/CHF is quoted directly at ${two(qt.eurchf, 'EUR/CHF')}. What do you do if you start with EUR 1m?`,
  },
  options: [
    {
      label: {
        de: 'Nichts: Die Kurse liegen im Band, jede Rundreise kostet nur Spread.',
        en: 'Nothing: the rates are inside the band, every round trip only costs spread.',
      },
      explain: {
        de: `Über den Dollar kostet ein Euro höchstens ${fmtRate(tri.impliedAsk, 'EUR/CHF', 5)} (Ask · Ask). Direkt bekommst du ${fmtRate(qt.eurchf.bid, 'EUR/CHF')}. Der direkte Bid liegt über dem Band.`,
        en: `Via the dollar a euro costs at most ${fmtRate(tri.impliedAsk, 'EUR/CHF', 5)} (ask · ask). Directly you get ${fmtRate(qt.eurchf.bid, 'EUR/CHF')}. The direct bid is above the band.`,
      },
    },
    {
      label: {
        de: 'EUR direkt gegen CHF verkaufen, mit den CHF USD kaufen, mit den USD EUR kaufen',
        en: 'Sell EUR for CHF directly, buy USD with the CHF, buy EUR with the USD',
      },
      explain: {
        de: `Richtig. Der direkte Bid ${fmtRate(qt.eurchf.bid, 'EUR/CHF')} ist höher als der Kreuz-Ask ${fmtRate(tri.impliedAsk, 'EUR/CHF', 5)}. Am Ende hast du ${money(M01.tri.state.legs[2]!.receive.amount, 'EUR').de}, ein Gewinn von ${money(M01.tri.profit, 'EUR').de}.`,
        en: `Correct. The direct bid of ${fmtRate(qt.eurchf.bid, 'EUR/CHF')} is above the cross ask of ${fmtRate(tri.impliedAsk, 'EUR/CHF', 5)}. You end with ${money(M01.tri.state.legs[2]!.receive.amount, 'EUR').en}, a profit of ${money(M01.tri.profit, 'EUR').en}.`,
      },
    },
    {
      label: {
        de: 'EUR über den Dollar in CHF tauschen und direkt EUR zurückkaufen',
        en: 'Change EUR into CHF via the dollar and buy EUR back directly',
      },
      explain: {
        de: `Falsche Richtung. Du verkaufst dann zum Kreuz-Bid ${fmtRate(tri.impliedBid, 'EUR/CHF', 5)} und kaufst direkt zum Ask ${fmtRate(qt.eurchf.ask, 'EUR/CHF')} zurück. Das kostet Geld.`,
        en: `Wrong direction. You would sell at the cross bid of ${fmtRate(tri.impliedBid, 'EUR/CHF', 5)} and buy back directly at the ask of ${fmtRate(qt.eurchf.ask, 'EUR/CHF')}. That loses money.`,
      },
    },
  ],
  correct: 1,
};

const carry = M01.carry;
const naiveRate = E.spot * (1 - E.rf);
const q4: QuizQuestion = {
  id: 'm01-q4',
  prompt: {
    de: `Ein Anleger leiht sich Franken zu ${both((l) => fmtPct(E.rd, l, 1)).de}, tauscht sie zum Spot ${spot} in USD 1 Mio. und legt die Dollars für ${int(E.mmDays).de} Tage zu ${both((l) => fmtPct(E.rf, l, 1)).de} an (Act/360). Unter welchem USD/CHF-Kurs bei Fälligkeit verliert er Geld?`,
    en: `An investor borrows francs at ${both((l) => fmtPct(E.rd, l, 1)).en}, changes them into USD 1m at the spot rate of ${spot} and invests the dollars for ${int(E.mmDays).en} days at ${both((l) => fmtPct(E.rf, l, 1)).en} (Act/360). Below which USD/CHF rate at maturity does he lose money?`,
  },
  options: [
    {
      label: { de: spot, en: spot },
      mono: true,
      explain: {
        de: `Hier fehlt der Zins. Er hat am Ende ${money(carry.usdEnd, 'USD').de}, nicht USD 1 Mio. Darum verträgt er einen etwas tieferen Kurs: ${rate(carry.breakEven, 5)}.`,
        en: `This leaves out the interest. At the end he has ${money(carry.usdEnd, 'USD').en}, not USD 1m, so he can stand a slightly lower rate: ${rate(carry.breakEven, 5)}.`,
      },
    },
    {
      label: { de: rate(carry.breakEven, 5), en: rate(carry.breakEven, 5) },
      mono: true,
      explain: {
        de: `Richtig. Seine Schuld von ${money(carry.chfDebt).de} geteilt durch ${money(carry.usdEnd, 'USD').de} ergibt ${rate(carry.breakEven, 5)}. Das ist genau der Forward: Ein Forward-Hedge würde den Zinsvorteil aufheben.`,
        en: `Correct. His debt of ${money(carry.chfDebt).en} divided by ${money(carry.usdEnd, 'USD').en} gives ${rate(carry.breakEven, 5)}. That is exactly the forward: a forward hedge would cancel the interest advantage.`,
      },
    },
    {
      label: { de: rate(naiveRate), en: rate(naiveRate) },
      mono: true,
      explain: {
        de: `Hier wurde der Jahreszins voll abgezogen. Für ${int(E.mmDays).de} Tage erhält er aber nur ${money(carry.interestUsd, 'USD').de} Zins. Die Schwelle liegt bei ${rate(carry.breakEven, 5)}.`,
        en: `This deducts the full annual rate. For ${int(E.mmDays).en} days he only earns ${money(carry.interestUsd, 'USD').en} of interest. The threshold is ${rate(carry.breakEven, 5)}.`,
      },
    },
    {
      label: {
        de: 'Nie: Der Zins ist ihm sicher.',
        en: 'Never: the interest is certain.',
      },
      explain: {
        de: `Der Zins ist sicher, der Kurs nicht. Fällt USD/CHF auf ${rate(SC.stDown)}, verliert er ${money(M01.carry.usdEnd * SC.stDown - carry.chfDebt, E.quote, true).de}.`,
        en: `The interest is certain, the rate is not. If USD/CHF falls to ${rate(SC.stDown)}, he loses ${money(M01.carry.usdEnd * SC.stDown - carry.chfDebt, E.quote, true).en}.`,
      },
    },
  ],
  correct: 1,
};

export const quiz: ModuleQuiz = {
  slug: '01-spot',
  quiz: [q1, q2, q3, q4],
  checks: { '1': check1, '2': check2, '3': check3, '4': check4 },
};
