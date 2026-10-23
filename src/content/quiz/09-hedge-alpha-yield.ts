/**
 * Module 09 hedge, alpha, yield: four graded quiz questions and one "Kurz geprüft" check per
 * section. Every number in a label or explanation comes from src/lib/nums/m09.ts (core,
 * Monte Carlo fair values, module 09 logic) and is formatted with src/lib/format.ts.
 */
import type { Lang } from '@/i18n/types';
import { fmtMoney, fmtPips, fmtRate } from '@/lib/format';
import { M09 as M } from '@/lib/nums/m09';
import type { ModuleQuiz, QuizQuestion } from './types';

const both = (f: (lang: Lang) => string) => ({ de: f('de'), en: f('en') });
const chf = (x: number, sign = false) => both((l) => fmtMoney(x, 'CHF', l, 0, sign));
const pips = (x: number, sign = false) => both((l) => fmtPips(x, l, 0, sign));
const rate = (x: number) => fmtRate(x);

/* ---------- numbers ---------- */
const s1Down = rate(M.s1Down);
/** From the whole pips shown in the explanation, so the difference can be recomputed. */
const callBetter = pips(Math.round(M.s1CallDownPips) - Math.round(M.s1FwdDownPips));
const premium = pips(M.callPremiumPips);
const fwdLoss = pips(Math.abs(M.s1FwdDownPips));

const levK = rate(M.levStrike);
const levWorse = rate(M.levWorse);
const fwd = rate(M.forward);
const hDown = rate(M.hDown);
const levCost = chf(M.costDown.leveraged);
const fwdCost = chf(M.costDown.forward);
const levDiff = chf(M.costDown.leveraged - M.costDown.forward, true);
const levBetter = pips(M.levBetterPips);

/** Money-market forward with 5 decimals, as in module 02 and section 4. */
const carryFwd = fmtRate(M.carryForward, 'USD/CHF', 5);
const spot = rate(M.spot);
const carryPips = pips(M.carryPips);
const yCushion = pips(M.yCushionPips);
const yMax = chf(M.yMaxChf);
const yK = rate(M.yStrike);
const yPut = pips(M.yPutPips);
const yBe = rate(M.yBreakEven);

const tarfWorst = chf(M.tarfWorst);
const tarfMaxLoss = chf(M.tarfMaxLoss);
const tarfTarget = pips(M.tarfTargetPips);

/* ---------- checks (one per section, ungraded) ---------- */

const check1: QuizQuestion = {
  id: 'm09-c1',
  prompt: {
    de: 'Der Importeur und eine Anlegerin erwarten beide einen stärkeren Dollar. Was entscheidet zuerst, welches Produkt zu wem passt?',
    en: 'The importer and an investor both expect a stronger dollar. What decides first which product suits whom?',
  },
  options: [
    {
      label: {
        de: 'Das Bedürfnis: Er will ein Risiko loswerden, sie will eines eingehen',
        en: 'The need: he wants to get rid of a risk, she wants to take one',
      },
      explain: {
        de: 'Richtig. Der Importeur ist schon short USD und sucht einen Hedge. Die Anlegerin hat kein Risiko und sucht Alpha. Erst danach filtert die Sicht.',
        en: 'Correct. The importer is already short USD and looks for a hedge. The investor has no risk and looks for alpha. Only then does the view filter.',
      },
    },
    {
      label: {
        de: 'Die Marktsicht, denn sie bestimmt das Produkt',
        en: 'The market view, because it determines the product',
      },
      explain: {
        de: 'Die Sicht ist bei beiden gleich und trotzdem passen andere Produkte. Dieselbe Sicht lässt sich mit sehr verschiedenem Risiko umsetzen.',
        en: 'The view is the same for both, yet different products fit. The same view can be expressed with very different risk.',
      },
    },
    {
      label: {
        de: 'Der Kurs: Das Produkt mit dem besten Strike passt zu beiden',
        en: 'The rate: the product with the best strike suits both',
      },
      explain: {
        de: 'Der beste Strike ist mit verkauften Optionen bezahlt. Für den Importeur kann er zur Überabsicherung werden, für die Anlegerin zum gehebelten Verlust. Zuerst zählt, ob jemand ein Risiko loswerden oder eingehen will.',
        en: 'The best strike is paid for with sold options. For the importer it can turn into an over-hedge, for the investor into a leveraged loss. What counts first is whether someone wants to get rid of a risk or take one.',
      },
    },
    {
      label: {
        de: 'Nichts: Gleiche Sicht heisst gleiches Produkt',
        en: 'Nothing: the same view means the same product',
      },
      explain: {
        de: 'Für den Importeur kann ein TARF zur Überabsicherung werden, wenn er unter dem Strike die doppelte Menge kauft. Für die Anlegerin ist ein Forward eine offene Position. Das Bedürfnis macht den Unterschied.',
        en: 'For the importer a TARF can turn into an over-hedge when he buys twice the amount below the strike. For the investor a forward is an open position. The need makes the difference.',
      },
    },
  ],
  correct: 0,
};

const check2: QuizQuestion = {
  id: 'm09-c2',
  prompt: {
    de: `Der strukturierte Hedge hat den Strike ${levK}, der Forward steht bei ${fwd}. Ab welchem Kurs bei Verfall ist der strukturierte Hedge teurer als der Forward?`,
    en: `The structured hedge has the strike ${levK}; the forward is ${fwd}. Below which rate at expiry does the structured hedge cost more than the forward?`,
  },
  options: [
    {
      label: { de: `Unter ${levWorse}`, en: `Below ${levWorse}` },
      explain: {
        de: `Richtig. Unter dem Strike zahlt der Importeur 2·K − S_T. Das liegt über dem Forward, sobald S_T unter 2·K − F = ${levWorse} fällt.`,
        en: `Correct. Below the strike the importer pays 2·K − S_T. That exceeds the forward once S_T falls below 2·K − F = ${levWorse}.`,
      },
      mono: true,
    },
    {
      label: { de: `Unter ${levK}`, en: `Below ${levK}` },
      explain: {
        de: `Unter dem Strike beginnt die doppelte Menge. Teurer als der Forward wird es aber erst, wenn der Verlust auf der zweiten Million die ${levBetter.de} Pips Vorsprung aufgebraucht hat: unter ${levWorse}.`,
        en: `Below the strike the double amount begins. It only costs more than the forward once the loss on the second million has used up the ${levBetter.en}-pip head start: below ${levWorse}.`,
      },
      mono: true,
    },
    {
      label: { de: `Über ${fwd}`, en: `Above ${fwd}` },
      explain: {
        de: `Über dem Strike zahlt der Importeur immer ${levK}, also weniger als den Forward.`,
        en: `Above the strike the importer always pays ${levK}, so less than the forward.`,
      },
      mono: true,
    },
    {
      label: { de: 'Nie, er ist ja Zero Cost', en: 'Never, it is zero cost' },
      explain: {
        de: 'Zero Cost heisst nur: Beim Abschluss ist er null wert. Der bessere Strike wird mit dem Risiko der doppelten Menge bezahlt.',
        en: 'Zero cost only means it is worth zero at inception. The better strike is paid for with the risk of the double amount.',
      },
    },
  ],
  correct: 0,
};

const check3: QuizQuestion = {
  id: 'm09-c3',
  prompt: {
    de: 'Die Anlegerin will Geld je Fixing und erwartet, dass der Dollar in einem Band bleibt. Welches Feld der Alpha-Matrix passt?',
    en: 'The investor wants cash per fixing and expects the dollar to stay within a band. Which box of the alpha matrix fits?',
  },
  options: [
    {
      label: { de: 'Coupon · Range: RTPF', en: 'Coupon · range: RTPF' },
      explain: {
        de: 'Richtig. Geld je Fixing heisst Coupon, ein Band heisst Range. Der RTPF zahlt, solange das Fixing in der Range liegt.',
        en: 'Correct. Cash per fixing means coupon, a band means range. The RTPF pays while the fixing stays inside the range.',
      },
    },
    {
      label: { de: 'Coupon · Direkt: TPF', en: 'Coupon · direct: TPF' },
      explain: {
        de: 'Der TPF zahlt Coupons für eine Richtung: Fixing über dem Strike. Ein steigender Dollar stört ihn nicht. Die Obergrenze des Bands nutzt er also gar nicht. Für eine Range-Sicht ist der RTPF gebaut.',
        en: 'The TPF pays coupons for one direction: a fixing above the strike. A rising dollar does not bother it, so it makes no use of the band’s upper edge. The RTPF is built for a range view.',
      },
    },
    {
      label: { de: 'Strike · Range: Pivot TARF', en: 'Strike · range: pivot TARF' },
      explain: {
        de: 'Der Pivot TARF passt zur Range, zahlt aber über bessere Kurse beim Kauf und Verkauf von Dollars, nicht als Coupon.',
        en: 'The pivot TARF fits the range but pays through better rates for buying and selling dollars, not as a coupon.',
      },
    },
    {
      label: { de: 'Strike · Direkt: TARF', en: 'Strike · direct: TARF' },
      explain: {
        de: 'Der TARF liefert einen besseren Kurs für eine Richtung. Weder Coupon noch Range.',
        en: 'The TARF delivers a better rate for one direction. Neither coupon nor range.',
      },
    },
  ],
  correct: 0,
};

const check4: QuizQuestion = {
  id: 'm09-c4',
  prompt: {
    de: `Ein Anleger kauft USD am Spot ${spot} und legt sie ${M.yMonths} Monate zum USD-Zins an (Carry). Wo liegt sein Break-even gegenüber einem CHF-Festgeld?`,
    en: `An investor buys USD at spot ${spot} and deposits them for ${M.yMonths} months at the USD rate (carry). Where is his break-even against a CHF deposit?`,
  },
  options: [
    {
      label: { de: `Beim Forward, ${carryFwd}`, en: `At the forward, ${carryFwd}` },
      explain: {
        de: `Richtig. Der Zinsvorsprung von ${carryPips.de} Pips ist genau der Forward-Abschlag. Fällt der Dollar unter den Forward, ist er aufgebraucht.`,
        en: `Correct. The interest differential of ${carryPips.en} pips is exactly the forward discount. If the dollar falls below the forward, it is used up.`,
      },
    },
    {
      label: { de: `Beim Spot, ${spot}`, en: `At spot, ${spot}` },
      explain: {
        de: `Beim Spot hat er gegenüber dem Festgeld sogar ${carryPips.de} Pips Vorsprung: den USD-Zins. Verloren ist erst unter dem Forward.`,
        en: `At spot he is even ${carryPips.en} pips ahead of the deposit: the USD interest. He only loses below the forward.`,
      },
    },
    {
      label: {
        de: 'Es gibt keinen: Der Zinsvorsprung bleibt in jedem Fall',
        en: 'There is none: the interest differential stays in any case',
      },
      explain: {
        de: 'Der Zins ist sicher, der Kurs nicht. Am Ende tauscht er die Dollars zum Kurs bei Verfall zurück.',
        en: 'The interest is certain, the rate is not. At the end he changes the dollars back at the rate at expiry.',
      },
    },
  ],
  correct: 0,
};

/* ---------- graded quiz ---------- */

const q1: QuizQuestion = {
  id: 'm09-q1',
  prompt: {
    de: `Der Importeur vergleicht Forward und USD Call (Prämie ${premium.de} Pips). Bei Verfall steht USD/CHF bei ${s1Down}. Wie schneidet der Call gegenüber dem Forward ab, je USD?`,
    en: `The importer compares the forward and a USD call (premium ${premium.en} pips). At expiry USD/CHF is at ${s1Down}. How does the call do against the forward, per USD?`,
  },
  options: [
    {
      label: {
        de: `Der Call ist ${callBetter.de} Pips besser`,
        en: `The call is ${callBetter.en} pips better`,
      },
      explain: {
        de: `Richtig. Der Forward kostet ihn ${fwdLoss.de} Pips, weil er günstiger hätte kaufen können. Der Call verfällt wertlos und kostet nur die Prämie, ${premium.de} Pips. Die Differenz: ${callBetter.de} Pips.`,
        en: `Correct. The forward costs him ${fwdLoss.en} pips because he could have bought more cheaply. The call expires worthless and costs only the premium, ${premium.en} pips. The difference: ${callBetter.en} pips.`,
      },
    },
    {
      label: {
        de: `Der Forward ist ${callBetter.de} Pips besser`,
        en: `The forward is ${callBetter.en} pips better`,
      },
      explain: {
        de: 'Vorzeichen verwechselt. Bei einem schwächeren Dollar ist der Forward der teurere Hedge, denn er verzichtet auf die günstigere Marktrate.',
        en: 'Sign mixed up. With a weaker dollar the forward is the more expensive hedge, because it gives up the cheaper market rate.',
      },
    },
    {
      label: {
        de: `Der Call ist ${fwdLoss.de} Pips besser`,
        en: `The call is ${fwdLoss.en} pips better`,
      },
      explain: {
        de: `Die Prämie fehlt. Der Call kostet ${premium.de} Pips, auch wenn er nicht ausgeübt wird.`,
        en: `The premium is missing. The call costs ${premium.en} pips even when it is not exercised.`,
      },
    },
    {
      label: {
        de: 'Beide gleich, der Call wird ja nicht ausgeübt',
        en: 'Both the same, the call is not exercised',
      },
      explain: {
        de: 'Nicht ausgeübt heisst nicht gratis. Und der Forward muss zum fixierten Kurs erfüllt werden, auch wenn der Markt tiefer steht.',
        en: 'Not exercised does not mean free. And the forward must be settled at the fixed rate even if the market is lower.',
      },
    },
  ],
  correct: 0,
};

const q2: QuizQuestion = {
  id: 'm09-q2',
  prompt: {
    de: `Bei ${hDown} kostet der strukturierte Hedge den Importeur ${levCost.de} für USD 1 Mio., der Forward ${fwdCost.de}. Woher kommt der Unterschied von ${levDiff.de}?`,
    en: `At ${hDown} the structured hedge costs the importer ${levCost.en} for USD 1m, the forward ${fwdCost.en}. Where does the difference of ${levDiff.en} come from?`,
  },
  options: [
    {
      label: {
        de: 'Er kauft USD 2 Mio. zum Strike und muss die zweite Million mit Verlust verkaufen',
        en: 'He buys USD 2m at the strike and has to sell the second million at a loss',
      },
      explain: {
        de: `Richtig. Unter dem Strike ${levK} greift der zweite verkaufte Put. Die zusätzliche Million braucht der Importeur nicht. Aus dem Hedge wird eine Spekulation.`,
        en: `Correct. Below the strike ${levK} the second sold put kicks in. The importer does not need the extra million. The hedge turns into speculation.`,
      },
    },
    {
      label: { de: 'Er zahlt beim Abschluss eine Prämie', en: 'He pays a premium at inception' },
      explain: {
        de: 'Der strukturierte Hedge ist Zero Cost. Bezahlt wird nicht mit Geld, sondern mit dem Risiko der doppelten Menge.',
        en: 'The structured hedge is zero cost. It is paid for not with money but with the risk of the double amount.',
      },
    },
    {
      label: { de: 'Ein Knock-out hat den Hedge beendet', en: 'A knock-out ended the hedge' },
      explain: {
        de: 'Im Beispiel gibt es keinen Knock-out. Er läge zudem über dem Spot und würde bei einem steigenden Dollar greifen, nicht bei einem fallenden.',
        en: 'The example has no knock-out. It would also sit above spot and trigger with a rising dollar, not a falling one.',
      },
    },
    {
      label: {
        de: 'Der Forward ist bei fallendem Dollar immer günstiger als jede Option',
        en: 'With a falling dollar the forward is always cheaper than any option',
      },
      explain: {
        de: 'Umgekehrt: Bei fallendem Dollar ist der Call günstiger als der Forward. Der strukturierte Hedge verliert hier wegen des Hebels.',
        en: 'The other way round: with a falling dollar the call is cheaper than the forward. The structured hedge loses here because of the leverage.',
      },
    },
  ],
  correct: 0,
};

const q3: QuizQuestion = {
  id: 'm09-q3',
  prompt: {
    de: 'Eine Anlegerin kauft ohnehin Dollars und erwartet einen stabilen bis stärkeren Dollar. Sie will einen besseren Kurs als den Forward. Welches Feld passt, und was ist der Worst Case?',
    en: 'An investor buys dollars anyway and expects a stable to stronger dollar. She wants a better rate than the forward. Which box fits, and what is the worst case?',
  },
  options: [
    {
      label: {
        de: 'Strike · Direkt (TARF, Accumulator): Gewinn gedeckelt, Verlust gehebelt und ohne eingebauten Stopp',
        en: 'Strike · direct (TARF, accumulator): gain capped, loss leveraged and without a built-in stop',
      },
      explain: {
        de: `Richtig. Der TARF endet beim Target von ${tarfTarget.de} Pips. Läuft der Dollar gegen sie, kauft sie die doppelte Menge bis zum Ende. Im schlechtesten simulierten Pfad endet er bei ${tarfWorst.de}. Theoretisch, mit allen Fixings bei null, verliert er bis zu ${tarfMaxLoss.de}: sehr hoch, aber endlich.`,
        en: `Correct. The TARF ends at the target of ${tarfTarget.en} pips. If the dollar moves against her, she buys twice the amount until the end. In the worst simulated path it ends at ${tarfWorst.en}. In theory, with every fixing at zero, it loses up to ${tarfMaxLoss.en}: very high, but finite.`,
      },
    },
    {
      label: {
        de: 'Coupon · Direkt (TPF): Worst Case ist eine Prämie',
        en: 'Coupon · direct (TPF): the worst case is a premium',
      },
      explain: {
        de: 'Der TPF zahlt Coupons statt eines besseren Kurses, und er hat keine Prämie. Sein Worst Case ist ebenfalls ein gehebelter Verlust.',
        en: 'The TPF pays coupons instead of a better rate, and it has no premium. Its worst case is a leveraged loss as well.',
      },
    },
    {
      label: {
        de: 'Strike · Range (Pivot TARF): kein Verlust möglich, weil Zero Cost',
        en: 'Strike · range (pivot TARF): no loss possible, because it is zero cost',
      },
      explain: {
        de: 'Zero Cost heisst nur Barwert null beim Abschluss. Ausserhalb der Strikes verliert auch der Pivot TARF doppelt. Und ihre Sicht ist eine Richtung, keine Range.',
        en: 'Zero cost only means a present value of zero at inception. Outside the strikes the pivot TARF also loses double. And her view is a direction, not a range.',
      },
    },
    {
      label: {
        de: 'Ein USD Call: Worst Case ist die Prämie',
        en: 'A USD call: the worst case is the premium',
      },
      explain: {
        de: 'Ein Call begrenzt den Verlust auf die Prämie, liefert aber keinen besseren Kurs als den Forward, sondern einen Deckel plus Prämie.',
        en: 'A call limits the loss to the premium, but it delivers no better rate than the forward, only a cap plus premium.',
      },
    },
  ],
  correct: 0,
};

const q4: QuizQuestion = {
  id: 'm09-q4',
  prompt: {
    de: `Über ${M.yMonths} Monate hat Carry einen Puffer von ${carryPips.de} Pips, die Dual Currency mit Strike ${yK} einen von ${yCushion.de} Pips. Was gibt der Anleger für den grösseren Puffer her?`,
    en: `Over ${M.yMonths} months carry has a cushion of ${carryPips.en} pips, dual currency with strike ${yK} one of ${yCushion.en} pips. What does the investor give up for the larger cushion?`,
  },
  options: [
    {
      label: {
        de: `Den Gewinn über dem Strike: Mehr als ${yMax.de} sind nicht drin`,
        en: `The gain above the strike: no more than ${yMax.en} is possible`,
      },
      explain: {
        de: `Richtig. Der verkaufte Put bringt ${yPut.de} Pips Prämie und senkt den Break-even auf ${yBe}. Dafür ist der Mehrertrag gedeckelt, und unter dem Strike erhält er Dollars.`,
        en: `Correct. The sold put brings ${yPut.en} pips of premium and lowers the break-even to ${yBe}. In return the extra return is capped, and below the strike he receives dollars.`,
      },
    },
    {
      label: {
        de: `Eine Prämie von ${yPut.de} Pips, die er bezahlt`,
        en: `A premium of ${yPut.en} pips that he pays`,
      },
      explain: {
        de: 'Vorzeichen verwechselt. Bei Dual Currency verkauft der Anleger den Put und erhält die Prämie als Zusatzzins.',
        en: 'Sign mixed up. With dual currency the investor sells the put and receives the premium as extra interest.',
      },
    },
    {
      label: { de: 'Einen Hebel von 2', en: 'Leverage of 2' },
      explain: {
        de: 'Dual Currency hat keinen Hebel: Umgetauscht wird nur das Kapital, einmal. Hebel 2 ist typisch für TARF, TPF und Co.',
        en: 'Dual currency has no leverage: only the capital is converted, once. Leverage of 2 is typical of TARFs, TPFs and the like.',
      },
    },
    {
      label: {
        de: 'Nichts, der grössere Puffer ist gratis',
        en: 'Nothing, the larger cushion is free',
      },
      explain: {
        de: 'Im Modell ist der erwartete Mehrertrag beider Ideen gegenüber dem Festgeld null. Mehr Puffer muss also etwas kosten: den Gewinn über dem Strike.',
        en: 'In the model the expected extra return of both ideas over the deposit is zero. More cushion must therefore cost something: the gain above the strike.',
      },
    },
  ],
  correct: 0,
};

/**
 * The questions above are written with the right answer first; `place` moves it to another
 * position so the answer key is not always A.
 */
function place(q: QuizQuestion, at: number): QuizQuestion {
  const options = [...q.options];
  const [right] = options.splice(q.correct, 1);
  options.splice(at, 0, right!);
  return { ...q, options, correct: at };
}

export const quiz: ModuleQuiz = {
  slug: '09-hedge-alpha-yield',
  quiz: [place(q1, 1), place(q2, 2), place(q3, 0), place(q4, 3)],
  checks: {
    '1': place(check1, 1),
    '2': place(check2, 2),
    '3': place(check3, 3),
    '4': place(check4, 1),
  },
};
