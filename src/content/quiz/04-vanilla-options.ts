/**
 * Module 04 Vanilla Options: four graded quiz questions and one "Kurz geprüft" check per
 * section. Every number in a prompt, label or explanation is computed from the running example
 * (src/lib/nums/m04.ts → M04, M04_SCENARIOS) and formatted with src/lib/format.ts.
 */
import type { Lang } from '@/i18n/types';
import { fmtMoney, fmtNumber, fmtPct, fmtPips, fmtRate } from '@/lib/format';
import { EXAMPLE as E } from '@/lib/fx/example';
import { M04, M04_SCENARIOS as SC } from '@/lib/nums/m04';
import type { ModuleQuiz, QuizQuestion } from './types';

const PAIR = E.pair;
const PIP = 1e-4;
const N = E.notional;
const both = (f: (lang: Lang) => string) => ({ de: f('de'), en: f('en') });
const rate = (x: number, digits = 4) => fmtRate(x, PAIR, digits);
const chf = (x: number) => both((l) => fmtMoney(x, E.quote, l));
const pips = (x: number, digits = 2) => both((l) => fmtPips(x, l, digits));
const num = (x: number, digits: number) => both((l) => fmtNumber(x, l, { digits }));

const K = rate(M04.K);
const F5 = rate(M04.F, 5);
const spot = rate(E.spot);
const callChf = chf(M04.callChf);
const callPips = pips(M04.callPips);
const putPips = pips(M04.putPips);
const rd = both((l) => fmtPct(E.rd, l, 1));

/* ---------- Graded quiz ---------- */

const q1: QuizQuestion = {
  id: 'm04-q1',
  prompt: {
    de: `Der Importeur kauft den USD Call mit Strike ${K} und zahlt ${callChf.de} Prämie. Bei Verfall steht USD/CHF auf ${rate(SC.stUp)}. Was kosten ihn die USD 1 Mio. insgesamt?`,
    en: `The importer buys the USD call with strike ${K} and pays ${callChf.en} premium. At expiry USD/CHF is at ${rate(SC.stUp)}. What do the USD 1m cost him in total?`,
  },
  options: [
    {
      label: chf(M04.costUp),
      mono: true,
      explain: {
        de: `Richtig. Er übt aus und kauft zum Strike: ${chf(M04.K * N).de}. Dazu kommt die Prämie von ${callChf.de}. Mehr zahlt er nie.`,
        en: `Correct. He exercises and buys at the strike: ${chf(M04.K * N).en}. Add the premium of ${callChf.en}. He never pays more than that.`,
      },
    },
    {
      label: chf(SC.stUp * N),
      mono: true,
      explain: {
        de: 'Das wäre der Preis ohne Absicherung. Mit dem Call übt er aus, weil der Kurs über dem Strike liegt.',
        en: 'That would be the unhedged price. With the call he exercises, because the rate is above the strike.',
      },
    },
    {
      label: chf(M04.K * N),
      mono: true,
      explain: {
        de: 'Das ist nur der Strike mal Nominal. Die Prämie hat er heute bezahlt, sie gehört zu seinen Kosten.',
        en: 'That is only strike times notional. He paid the premium today, and it is part of his cost.',
      },
    },
    {
      label: chf(SC.stUp * N + M04.callChf),
      mono: true,
      explain: {
        de: 'Hier wurde die Prämie zum Marktkurs addiert. Er übt aber aus und kauft zum Strike, nicht zum Marktkurs.',
        en: 'This adds the premium to the market rate. But he exercises and buys at the strike, not at the market rate.',
      },
    },
  ],
  correct: 0,
};

const q2: QuizQuestion = {
  id: 'm04-q2',
  prompt: {
    de: `Du verkaufst einen USD Put mit Strike ${K} und erhältst ${putPips.de} Pips Prämie. Unter welchem Kurs bei Verfall machst du Verlust?`,
    en: `You sell a USD put with strike ${K} and receive a premium of ${putPips.en} pips. Below which rate at expiry do you make a loss?`,
  },
  options: [
    {
      label: { de: `unter ${rate(M04.bePut)}`, en: `below ${rate(M04.bePut)}` },
      mono: true,
      explain: {
        de: `Richtig. Über dem Strike verfällt der Put wertlos. Darunter zahlst du K − S, aber die Prämie federt das ab: Break-even bei Strike minus Prämie, ${rate(M04.bePut)}.`,
        en: `Correct. Above the strike the put expires worthless. Below it you pay K − S, but the premium cushions that: break-even at strike minus premium, ${rate(M04.bePut)}.`,
      },
    },
    {
      label: { de: `unter ${K}`, en: `below ${K}` },
      mono: true,
      explain: {
        de: 'Unter dem Strike wird der Put ausgeübt, aber du hast die Prämie schon erhalten. Verlust machst du erst, wenn die Auszahlung grösser ist als die Prämie.',
        en: 'Below the strike the put is exercised, but you have already received the premium. You only make a loss once the payout exceeds the premium.',
      },
    },
    {
      label: { de: `über ${rate(M04.cap)}`, en: `above ${rate(M04.cap)}` },
      mono: true,
      explain: {
        de: 'Das ist der Break-even eines Long Calls. Ein Short Put verliert, wenn der Dollar fällt, nicht wenn er steigt.',
        en: 'That is the break-even of a long call. A short put loses when the dollar falls, not when it rises.',
      },
    },
    {
      label: { de: `unter ${spot}`, en: `below ${spot}` },
      mono: true,
      explain: {
        de: 'Der Spot von heute spielt bei Verfall keine Rolle. Es zählen nur Strike, Prämie und der Kurs bei Verfall.',
        en: "Today's spot plays no role at expiry. Only the strike, the premium and the rate at expiry count.",
      },
    },
  ],
  correct: 0,
};

const q3: QuizQuestion = {
  id: 'm04-q3',
  prompt: {
    de: `Spot ${spot}, Forward 3 Monate ${F5}. Ein USD Call mit Strike ${rate(SC.kMid)} ist …`,
    en: `Spot ${spot}, 3-month forward ${F5}. A USD call with strike ${rate(SC.kMid)} is …`,
  },
  options: [
    {
      label: {
        de: `OTM, ${fmtPips((SC.kMid - M04.F) / PIP, 'de')} Pips über dem Forward`,
        en: `OTM, ${fmtPips((SC.kMid - M04.F) / PIP, 'en')} pips above the forward`,
      },
      explain: {
        de: 'Richtig. Moneyness misst man gegen den Forward. Beim Call heisst Strike über dem Forward: aus dem Geld, die Prämie ist reiner Zeitwert.',
        en: 'Correct. Moneyness is measured against the forward. For a call, a strike above the forward means out of the money; the premium is pure time value.',
      },
    },
    {
      label: {
        de: 'ITM, weil der Strike unter dem Spot liegt',
        en: 'ITM, because the strike is below spot',
      },
      explain: {
        de: 'Der typische Fehler: Vergleich mit dem Spot. Ausgeübt wird erst bei Verfall, und der faire Kurs dafür ist der Forward.',
        en: 'The classic mistake: comparing with spot. Exercise only happens at expiry, and the fair rate for that is the forward.',
      },
    },
    {
      label: {
        de: 'ATMF, weil der Strike zwischen Spot und Forward liegt',
        en: 'ATMF, because the strike lies between spot and forward',
      },
      explain: {
        de: 'ATMF heisst Strike gleich Forward, auf etwa einen Pip genau. Dieser Strike liegt deutlich darüber.',
        en: 'ATMF means strike equal to the forward, to within about a pip. This strike is well above it.',
      },
    },
    {
      label: {
        de: `ITM, ${fmtNumber((E.spot - SC.kMid) / PIP, 'de')} Pips im Geld`,
        en: `ITM, ${fmtNumber((E.spot - SC.kMid) / PIP, 'en')} pips in the money`,
      },
      explain: {
        de: 'Das ist der Abstand zum Spot. Gegen den Forward hat dieser Call keinen inneren Wert.',
        en: 'That is the distance to spot. Against the forward this call has no intrinsic value.',
      },
    },
  ],
  correct: 0,
};

const q4: QuizQuestion = {
  id: 'm04-q4',
  prompt: {
    de: `Der USD Call mit Strike ${K} kostet ${callPips.de} Pips. Forward ${F5}, CHF-Zins ${rd.de}. Was kostet der USD Put mit gleichem Strike?`,
    en: `The USD call with strike ${K} costs ${callPips.en} pips. Forward ${F5}, CHF rate ${rd.en}. What does the USD put with the same strike cost?`,
  },
  options: [
    {
      label: { de: `${putPips.de} Pips`, en: `${putPips.en} pips` },
      mono: true,
      explain: {
        de: `Richtig. Put-Call-Parität: P = C − DF · (F − K). Der Strike liegt ${pips((M04.F - M04.K) / PIP, 1).de} Pips unter dem Forward, und DF ist 1. Also ist der Put um ${pips(M04.parityPips, 1).de} Pips billiger.`,
        en: `Correct. Put-call parity: P = C − DF · (F − K). The strike is ${pips((M04.F - M04.K) / PIP, 1).en} pips below the forward, and DF is 1. So the put is ${pips(M04.parityPips, 1).en} pips cheaper.`,
      },
    },
    {
      label: { de: `${callPips.de} Pips`, en: `${callPips.en} pips` },
      mono: true,
      explain: {
        de: 'Gleich teuer sind Call und Put nur, wenn der Strike genau beim Forward liegt. Hier liegt er knapp darunter.',
        en: 'Call and put only cost the same when the strike is exactly at the forward. Here it is just below.',
      },
    },
    {
      label: {
        de: `${pips(M04.callPips - (E.spot - M04.K) / PIP).de} Pips`,
        en: `${pips(M04.callPips - (E.spot - M04.K) / PIP).en} pips`,
      },
      mono: true,
      explain: {
        de: 'Hier wurde der Spot statt des Forwards eingesetzt. Die Parität rechnet mit dem Forward, weil beide Optionen erst bei Verfall zahlen.',
        en: 'This uses spot instead of the forward. Parity works with the forward, because both options only pay at expiry.',
      },
    },
    {
      label: {
        de: `${pips(M04.callPips + M04.parityPips).de} Pips`,
        en: `${pips(M04.callPips + M04.parityPips).en} pips`,
      },
      mono: true,
      explain: {
        de: 'Vorzeichenfehler: C − P = DF · (F − K). Liegt der Strike unter dem Forward, ist der Call teurer als der Put, nicht umgekehrt.',
        en: 'Sign error: C − P = DF · (F − K). With the strike below the forward the call is dearer than the put, not the other way round.',
      },
    },
  ],
  correct: 0,
};

/* ---------- Checks (one per section, ungraded) ---------- */

const c1: QuizQuestion = {
  id: 'm04-c1',
  prompt: {
    de: `Ein USD Call auf USD 1 Mio. mit Strike ${K} ist aus Sicht des Frankens …`,
    en: `Seen from the franc, a USD call on USD 1m with strike ${K} is …`,
  },
  options: [
    {
      label: {
        de: `ein CHF Put auf ${fmtMoney(M04.K * N, E.quote, 'de')}, Strike ${rate(1 / M04.K)} USD je CHF`,
        en: `a CHF put on ${fmtMoney(M04.K * N, E.quote, 'en')}, strike ${rate(1 / M04.K)} USD per CHF`,
      },
      explain: {
        de: 'Richtig. Das Recht, USD gegen CHF zu kaufen, ist das Recht, CHF gegen USD zu verkaufen. Nominal und Strike werden in die andere Währung umgerechnet.',
        en: 'Correct. The right to buy USD against CHF is the right to sell CHF against USD. Notional and strike are converted into the other currency.',
      },
    },
    {
      label: {
        de: `ein CHF Call auf ${fmtMoney(M04.K * N, E.quote, 'de')}`,
        en: `a CHF call on ${fmtMoney(M04.K * N, E.quote, 'en')}`,
      },
      explain: {
        de: 'Ein CHF Call wäre das Recht, CHF zu kaufen, also USD zu verkaufen. Das ist ein USD Put.',
        en: 'A CHF call would be the right to buy CHF, that is to sell USD. That is a USD put.',
      },
    },
    {
      label: { de: `ein USD Put mit Strike ${K}`, en: `a USD put with strike ${K}` },
      explain: {
        de: 'Ein USD Put gibt das Recht, USD zu verkaufen. Der Importeur will aber USD kaufen.',
        en: 'A USD put gives the right to sell USD. The importer wants to buy USD.',
      },
    },
  ],
  correct: 0,
};

const c2: QuizQuestion = {
  id: 'm04-c2',
  prompt: {
    de: 'Du bist short einen USD Call. Was stimmt?',
    en: 'You are short a USD call. Which statement is true?',
  },
  options: [
    {
      label: {
        de: 'Du hast die Prämie erhalten und musst USD zum Strike liefern, wenn der Käufer ausübt.',
        en: 'You have received the premium and must deliver USD at the strike if the buyer exercises.',
      },
      explain: {
        de: 'Richtig. Der Verkäufer übernimmt die Pflicht. Steigt der Dollar stark, ist sein Verlust unbegrenzt.',
        en: 'Correct. The seller takes on the obligation. If the dollar rises a lot, the loss is unlimited.',
      },
    },
    {
      label: {
        de: 'Du hast das Recht, USD zum Strike zu kaufen.',
        en: 'You have the right to buy USD at the strike.',
      },
      explain: {
        de: 'Das Recht hat der Käufer, also wer long ist. Short heisst Pflicht.',
        en: 'The right belongs to the buyer, who is long. Short means obligation.',
      },
    },
    {
      label: {
        de: 'Dein Verlust ist auf die Prämie begrenzt.',
        en: 'Your loss is limited to the premium.',
      },
      explain: {
        de: 'Begrenzt ist der Verlust des Käufers. Beim Short Call ist der Gewinn auf die Prämie begrenzt, der Verlust nicht.',
        en: "That is the buyer's loss. For a short call the gain is limited to the premium, the loss is not.",
      },
    },
  ],
  correct: 0,
};

const c3: QuizQuestion = {
  id: 'm04-c3',
  prompt: {
    de: `Ein USD Call mit Strike ${rate(M04.kItm)} kostet ${pips(M04.itmPips, 1).de} Pips. Forward ${F5}, CHF-Zins ${rd.de}. Wie gross ist sein Zeitwert?`,
    en: `A USD call with strike ${rate(M04.kItm)} costs ${pips(M04.itmPips, 1).en} pips. Forward ${F5}, CHF rate ${rd.en}. How large is its time value?`,
  },
  options: [
    {
      label: {
        de: `${pips(M04.itmTimePips, 1).de} Pips`,
        en: `${pips(M04.itmTimePips, 1).en} pips`,
      },
      mono: true,
      explain: {
        de: `Richtig. Der innere Wert gegen den Forward ist F − K = ${pips(M04.itmIntrinsicPips, 1).de} Pips, abgezinst mit Faktor 1. Der Rest der Prämie ist Zeitwert.`,
        en: `Correct. The intrinsic value against the forward is F − K = ${pips(M04.itmIntrinsicPips, 1).en} pips, discounted with a factor of 1. The rest of the premium is time value.`,
      },
    },
    {
      label: {
        de: `${pips(M04.itmIntrinsicPips, 1).de} Pips`,
        en: `${pips(M04.itmIntrinsicPips, 1).en} pips`,
      },
      mono: true,
      explain: {
        de: 'Das ist der innere Wert, F − K. Gefragt ist der Zeitwert: die Prämie minus den inneren Wert.',
        en: 'That is the intrinsic value, F − K. The question asks for the time value: the premium minus the intrinsic value.',
      },
    },
    {
      label: {
        de: `${pips(M04.itmPips - M04.itmVsSpotPips, 1).de} Pips`,
        en: `${pips(M04.itmPips - M04.itmVsSpotPips, 1).en} pips`,
      },
      mono: true,
      explain: {
        de: `Hier wurde der innere Wert gegen den Spot gerechnet, ${pips(M04.itmVsSpotPips, 1).de} Pips. Ein negativer Zeitwert ergibt keinen Sinn: Innerer Wert und Moneyness misst man gegen den Forward.`,
        en: `This measures the intrinsic value against spot, ${pips(M04.itmVsSpotPips, 1).en} pips. A negative time value makes no sense: intrinsic value and moneyness are measured against the forward.`,
      },
    },
    {
      label: { de: `${pips(M04.itmPips, 1).de} Pips`, en: `${pips(M04.itmPips, 1).en} pips` },
      mono: true,
      explain: {
        de: 'Reiner Zeitwert ist die Prämie nur ATMF oder aus dem Geld. Dieser Call liegt unter dem Forward, also im Geld.',
        en: 'The premium is pure time value only at the forward or out of the money. This call is below the forward, so it is in the money.',
      },
    },
  ],
  correct: 0,
};

const c4: QuizQuestion = {
  id: 'm04-c4',
  prompt: {
    de: `Long Call und Short Put, beide mit Strike ${K}. Welches Spot-Delta hat die Kombination?`,
    en: `Long call and short put, both with strike ${K}. What spot delta does the combination have?`,
  },
  options: [
    {
      label: num(M04.deltaCall - M04.deltaPut, 3),
      mono: true,
      explain: {
        de: `Richtig. Das ist ein synthetischer Forward: Spot-Delta e^(−rf T), Forward-Delta genau 1. Call-Delta ${fmtNumber(M04.deltaCall, 'de', { digits: 3 })} minus Put-Delta ${fmtNumber(M04.deltaPut, 'de', { digits: 3 })}.`,
        en: `Correct. It is a synthetic forward: spot delta e^(−rf T), forward delta exactly 1. Call delta ${fmtNumber(M04.deltaCall, 'en', { digits: 3 })} minus put delta ${fmtNumber(M04.deltaPut, 'en', { digits: 3 })}.`,
      },
    },
    {
      label: num(M04.deltaCall + M04.deltaPut, 3),
      mono: true,
      explain: {
        de: 'Hier wurde der Put als gekauft gerechnet. Long Call plus Long Put wäre ein Straddle mit fast null Delta. Beim Short Put dreht das Vorzeichen.',
        en: 'This counts the put as bought. Long call plus long put would be a straddle with almost zero delta. For a short put the sign flips.',
      },
    },
    {
      label: num(1, 3),
      mono: true,
      explain: {
        de: `Genau 1 ist das Forward-Delta. Das Spot-Delta ist e^(−rf T) = ${fmtNumber(M04.dff, 'de', { digits: 3 })}: USD 1 Mio. in 3 Monaten entsprechen heute nur ihrem Barwert, abgezinst mit dem USD-Zins.`,
        en: `Exactly 1 is the forward delta. The spot delta is e^(−rf T) = ${fmtNumber(M04.dff, 'en', { digits: 3 })}: USD 1m in 3 months is worth only its present value today, discounted at the USD rate.`,
      },
    },
    {
      label: num(0, 3),
      mono: true,
      explain: {
        de: 'Fast keine Nettoprämie heisst nicht kein Risiko. Die Kombination bewegt sich eins zu eins mit dem Forward.',
        en: 'Almost no net premium does not mean no risk. The combination moves one for one with the forward.',
      },
    },
  ],
  correct: 0,
};

/**
 * The questions above list the correct option first (easy to review). The Quiz island does not
 * shuffle, so each question moves its correct option to a fixed, varied position here.
 */
function correctAt(q: QuizQuestion, at: number): QuizQuestion {
  const [right, ...rest] = q.options;
  const options = [...rest];
  options.splice(at, 0, right!);
  return { ...q, options, correct: at };
}

export const quiz: ModuleQuiz = {
  slug: '04-vanilla-options',
  quiz: [correctAt(q1, 1), correctAt(q2, 0), correctAt(q3, 2), correctAt(q4, 3)],
  checks: {
    '1': correctAt(c1, 1),
    '2': correctAt(c2, 2),
    '3': correctAt(c3, 0),
    '4': correctAt(c4, 1),
  },
};
