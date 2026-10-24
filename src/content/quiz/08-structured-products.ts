/**
 * Module 08 structured products: four graded quiz questions and one "Kurz geprüft" check per
 * section. Every number in a label or explanation comes from src/lib/nums/m08.ts (Monte Carlo
 * fair values, simulator scenarios, dual currency closed form) and is formatted with
 * src/lib/format.ts.
 */
import type { Lang } from '@/i18n/types';
import { fmtMoney, fmtNumber, fmtPct, fmtPips, fmtRate } from '@/lib/format';
import { M08 as M } from '@/lib/nums/m08';
import type { ModuleQuiz, QuizQuestion } from './types';

const both = (f: (lang: Lang) => string) => ({ de: f('de'), en: f('en') });
const chf = (x: number, sign = false) => both((l) => fmtMoney(x, 'CHF', l, 0, sign));
const usd = (x: number) => both((l) => fmtMoney(x, 'USD', l));
const pips = (x: number, d = 1) => both((l) => fmtPips(x, l, d));
const pct = (x: number, d = 1) => both((l) => fmtPct(x, l, d));
const rate = (x: number) => fmtRate(x);
const paths = both((l) => fmtNumber(M.paths, l));

const accK = rate(M.accStrike);
const accF = rate(M.accFwd);
const accBetter = pips(M.accBetterPips, 0);
const accUpUsd = usd(M.accUp.base);
const accUpDiff = chf(M.accUp.diff, true);
const accSideDiff = chf(M.accSide.diff, true);
const accDownDiff = chf(M.accDown.diff, true);
const accDownUsd = usd(M.accDown.base);
const accNeed = usd(M.accNotional * M.accFixings);
const tarfTarget = chf(M.tarfTargetChf);
const tarfP = pct(M.tarfPTarget);
const tarfPM = pct(M.tarfPMaturity);
/** Two decimals in the worked equation, so it can be recomputed from the shown numbers. */
const tarfP2 = pct(M.tarfPTarget, 2);
const tarfPM2 = pct(M.tarfPMaturity, 2);
const tarfLoss = chf(M.tarfImpliedLoss);
/** "about CHF 84’000" in the answer label: the implied loss rounded to thousands. */
const tarfLossRound = chf(Math.round(Math.abs(M.tarfImpliedLoss) / 1000) * 1000);
const tarfWorst = chf(M.tarfWorst);
/** Contractual coupon (paid per fixing); the fair coupon only with its standard error. */
const tpfCoupon = pips(M.tpfCouponPips);
const tpfFair = pips(M.tpfFairCouponPips, 2);
const tpfSe = pips(M.tpfSePips, 2);
const tpfDrop = pips(M.tpfFwdDropPips, 0);
const tpfFwdEnd = rate(M.tpfFwdEnd);
const tpfK = rate(M.tpfStrike);
const tpfVsSpot = pct(M.tpfStrikeVsSpot);
const tpfNoTarget = pips(M.tpfCouponNoTargetPips);
const tpfNoDrift = pips(M.tpfCouponNoDriftPips);
const dciK = rate(M.dciStrike);
const dciBe = rate(M.dciBreakEven);
const dciS = rate(M.dciFixing);
const dciInt = chf(M.dciInterest);
const dciUsd = usd(M.dciUsd);
const dciValue = chf(M.dciOutValue);
const dciDiff = chf(Math.abs(M.dciOutDiff));
const dciCap = chf(M.dciCapital);
const dciWrongUsd = usd((M.dciCapital + M.dciInterest) / M.dciFixing);
const dciCapPlusInt = chf(M.dciCapital + M.dciInterest);

/* ---------- Checks (one per section, ungraded) ---------- */

const check1: QuizQuestion = {
  id: 'm08-c1',
  prompt: {
    de: `Der Accumulator bietet ${accK} statt des Forwards ${accF}, ohne Prämie. Wer bezahlt den besseren Kurs?`,
    en: `The accumulator offers ${accK} instead of the forward ${accF}, without a premium. Who pays for the better rate?`,
  },
  options: [
    {
      label: {
        de: 'Niemand: Das ist der Vorteil der Struktur',
        en: 'Nobody: that is the advantage of the structure',
      },
      explain: {
        de: 'Ein besserer Kurs als der Forward ist nie gratis. Beim Abschluss ist das Produkt null wert: Was du beim Strike gewinnst, gibst du über verkaufte Optionen wieder her.',
        en: 'A rate better than the forward is never free. At inception the product is worth zero: what you gain on the strike, you give back through sold options.',
      },
    },
    {
      label: {
        de: 'Du selbst, mit verkauften Optionen: doppelte Menge unter dem Strike und Knock-out',
        en: 'You do, with sold options: twice the amount below the strike and a knock-out',
      },
      explain: {
        de: `Richtig. Der zweite verkaufte Put und der Knock-out bezahlen die ${accBetter.de} Pips. Du trägst dafür Hebel und Pfadrisiko.`,
        en: `Correct. The second sold put and the knock-out pay for the ${accBetter.en} pips. In return you carry leverage and path risk.`,
      },
    },
    {
      label: {
        de: 'Der Anbieter, aus seiner Marge',
        en: 'The provider, out of its margin',
      },
      explain: {
        de: 'Die Marge des Anbieters macht den Kurs für dich eher schlechter, nicht besser. Bezahlt wird der bessere Strike mit den Optionen, die du verkaufst.',
        en: "The provider's margin makes the rate worse for you, not better. The better strike is paid for with the options you sell.",
      },
    },
  ],
  correct: 1,
};

const check2: QuizQuestion = {
  id: 'm08-c2',
  prompt: {
    de: `Im Szenario «Trend auf» endet der Accumulator bei Fixing ${M.accUp.endedAt} durch Knock-out. Was heisst das für den Importeur?`,
    en: `In the ‘trend up’ scenario the accumulator is knocked out at fixing ${M.accUp.endedAt}. What does that mean for the importer?`,
  },
  options: [
    {
      label: {
        de: 'Er verliert alles, was er bisher gekauft hat',
        en: 'He loses everything he has bought so far',
      },
      explain: {
        de: `Nein. Die bisher gekauften ${accUpUsd.de} bleiben ihm, zum guten Strike. Das Problem ist der Rest, den er nicht mehr abgesichert hat.`,
        en: `No. He keeps the ${accUpUsd.en} bought so far, at the good strike. The problem is the rest, which is no longer hedged.`,
      },
    },
    {
      label: {
        de: `Er hat erst ${accUpUsd.de} gekauft und muss den Rest am Markt teurer kaufen`,
        en: `He has bought only ${accUpUsd.en} and has to buy the rest in the market at higher rates`,
      },
      explain: {
        de: `Richtig. Der Knock-out kommt genau dann, wenn der Dollar steigt. Differenz zum Forward-Hedge: ${accUpDiff.de}.`,
        en: `Correct. The knock-out comes exactly when the dollar rises. Difference to the forward hedge: ${accUpDiff.en}.`,
      },
    },
    {
      label: {
        de: 'Ab jetzt kauft er die doppelte Menge',
        en: 'From now on he buys twice the amount',
      },
      explain: {
        de: 'Die doppelte Menge gilt für Fixings unter dem Strike, nicht nach dem Knock-out. Nach dem Knock-out wird gar nichts mehr gekauft.',
        en: 'The double amount applies to fixings below the strike, not after the knock-out. After the knock-out nothing more is bought.',
      },
    },
  ],
  correct: 1,
};

const check3: QuizQuestion = {
  id: 'm08-c3',
  prompt: {
    de: `Der TARF hat ein Target von ${pips(M.tarfTargetPips, 0).de} Pips. Was begrenzt dieses Target?`,
    en: `The TARF has a target of ${pips(M.tarfTargetPips, 0).en} pips. What does this target cap?`,
  },
  options: [
    {
      label: { de: 'Den Gewinn', en: 'The gain' },
      explain: {
        de: `Richtig. Mehr als ${tarfTarget.de} gewinnst du nicht: Am Fixing, das das Target erreicht, zählt nur noch der Rest bis zum Target. Verluste zählen nicht aufs Target, sie laufen mit doppelter Menge weiter.`,
        en: `Correct. You cannot gain more than ${tarfTarget.en}: on the fixing that reaches the target, only what is left to the target counts. Losses do not count towards the target; they run on with twice the amount.`,
      },
    },
    {
      label: { de: 'Den Verlust', en: 'The loss' },
      explain: {
        de: `Umgekehrt: Verluste zählen nicht aufs Target. Der schlechteste von ${paths.de} Monte-Carlo-Pfaden endet bei ${tarfWorst.de}.`,
        en: `The other way round: losses do not count towards the target. The worst of ${paths.en} Monte Carlo paths ends at ${tarfWorst.en}.`,
      },
    },
    {
      label: { de: 'Gewinn und Verlust gleichermassen', en: 'Gain and loss alike' },
      explain: {
        de: 'Das Target ist asymmetrisch: Es beendet die guten Szenarien früh, die schlechten laufen bis zum Schluss.',
        en: 'The target is asymmetric: it ends the good scenarios early, while the bad ones run to the end.',
      },
    },
  ],
  correct: 0,
};

const check4: QuizQuestion = {
  id: 'm08-c4',
  prompt: {
    de: `Dual Currency mit Strike ${dciK} und Break-even ${dciBe}: Wann wird dein Kapital in USD umgetauscht?`,
    en: `Dual currency with strike ${dciK} and break-even ${dciBe}: when is your capital converted into USD?`,
  },
  options: [
    {
      label: {
        de: `Wenn das Fixing bei Verfall über ${dciK} liegt`,
        en: `If the fixing at maturity is above ${dciK}`,
      },
      explain: {
        de: 'Über dem Strike bleibt dein Geld in CHF, und du erhältst den erhöhten Zins.',
        en: 'Above the strike your money stays in CHF and you receive the enhanced interest.',
      },
    },
    {
      label: {
        de: `Wenn das Fixing bei Verfall unter ${dciK} liegt`,
        en: `If the fixing at maturity is below ${dciK}`,
      },
      explain: {
        de: `Richtig. Dann übt die Gegenseite den verkauften USD Put / CHF Call aus, und du erhältst ${dciUsd.de} zum Strike.`,
        en: `Correct. Then the counterparty exercises the sold USD put / CHF call and you receive ${dciUsd.en} at the strike.`,
      },
    },
    {
      label: {
        de: `Erst wenn das Fixing unter dem Break-even ${dciBe} liegt`,
        en: `Only if the fixing is below the break-even ${dciBe}`,
      },
      explain: {
        de: `Umgetauscht wird schon unter dem Strike ${dciK}. Der Break-even sagt nur, ab wann du schlechter fährst als mit Festgeld.`,
        en: `Conversion already happens below the strike ${dciK}. The break-even only tells you from where you do worse than with a deposit.`,
      },
    },
  ],
  correct: 1,
};

/* ---------- Graded quiz ---------- */

const q1: QuizQuestion = {
  id: 'm08-q1',
  prompt: {
    de: 'In welchem Markt schlägt der Accumulator den Forward-Hedge des Importeurs am ehesten?',
    en: "In which market is the accumulator most likely to beat the importer's forward hedge?",
  },
  options: [
    {
      label: { de: 'Der Dollar steigt stark', en: 'The dollar rises sharply' },
      explain: {
        de: `Dann kommt der Knock-out, und der Rest muss teurer am Markt gekauft werden. Im Szenario «Trend auf»: ${accUpDiff.de} gegenüber dem Forward.`,
        en: `Then the knock-out comes and the rest has to be bought in the market at higher rates. In the ‘trend up’ scenario: ${accUpDiff.en} against the forward.`,
      },
    },
    {
      label: { de: 'Der Markt bleibt ruhig', en: 'The market stays calm' },
      explain: {
        de: `Richtig. Kein Knock-out, kein doppeltes Fixing: Jeder Kauf läuft zum besseren Strike. Im Szenario «Seitwärts»: ${accSideDiff.de}.`,
        en: `Correct. No knock-out, no double fixing: every purchase runs at the better strike. In the ‘sideways’ scenario: ${accSideDiff.en}.`,
      },
    },
    {
      label: { de: 'Der Dollar fällt stark', en: 'The dollar falls sharply' },
      explain: {
        de: `Dann kauft er die doppelte Menge über dem Marktkurs, ${accDownUsd.de} statt ${accNeed.de}. Im Szenario mit dem stärksten Fall: ${accDownDiff.de}.`,
        en: `Then he buys twice the amount above the market rate, ${accDownUsd.en} instead of ${accNeed.en}. In the scenario with the steepest fall: ${accDownDiff.en}.`,
      },
    },
    {
      label: {
        de: `In jedem Markt, weil der Strike ${accBetter.de} Pips besser ist`,
        en: `In every market, because the strike is ${accBetter.en} pips better`,
      },
      explain: {
        de: 'Der bessere Strike ist mit Hebel und Knock-out bezahlt. Bei grossen Bewegungen in beide Richtungen verliert der Accumulator gegen den Forward.',
        en: 'The better strike is paid for with leverage and the knock-out. In large moves in either direction the accumulator loses against the forward.',
      },
    },
  ],
  correct: 1,
};

const q2: QuizQuestion = {
  id: 'm08-q2',
  prompt: {
    de: `Der TARF erreicht in ${tarfP.de} der Pfade (risikoneutral, keine Prognose) das Target und bringt dann rund ${tarfTarget.de}. Sein Barwert ist trotzdem null. Was folgt daraus?`,
    en: `The TARF reaches its target in ${tarfP.en} of the paths (risk-neutral, not a forecast) and then brings about ${tarfTarget.en}. Yet its present value is zero. What follows?`,
  },
  options: [
    {
      label: {
        de: `Die übrigen ${tarfPM.de} der Pfade verlieren im Schnitt rund ${tarfLossRound.de}`,
        en: `The remaining ${tarfPM.en} of the paths lose about ${tarfLossRound.en} on average`,
      },
      mono: false,
      explain: {
        de: `Richtig. Barwert null heisst: ${tarfP2.de} · ${tarfTarget.de} + ${tarfPM2.de} · L = 0, also L ≈ ${tarfLoss.de}. Viele kleine Gewinne bezahlen wenige grosse Verluste.`,
        en: `Correct. A present value of zero means ${tarfP2.en} · ${tarfTarget.en} + ${tarfPM2.en} · L = 0, so L ≈ ${tarfLoss.en}. Many small gains pay for a few large losses.`,
      },
    },
    {
      label: {
        de: `Die übrigen Pfade verlieren im Schnitt ebenfalls rund ${tarfTarget.de}`,
        en: `The remaining paths also lose about ${tarfTarget.en} on average`,
      },
      explain: {
        de: `Dann wäre der Barwert deutlich positiv. Weil die guten Pfade so häufig sind, müssen die seltenen schlechten im Schnitt viel mehr verlieren: rund ${tarfLossRound.de}.`,
        en: `Then the present value would be clearly positive. Because the good paths are so frequent, the rare bad ones must lose much more on average: about ${tarfLossRound.en}.`,
      },
    },
    {
      label: {
        de: 'Der Anbieter verschenkt Geld',
        en: 'The provider is giving money away',
      },
      explain: {
        de: 'Barwert null heisst: kein Geschenk, für keine Seite. Die häufigen kleinen Gewinne sind mit seltenen grossen Verlusten bezahlt.',
        en: 'A present value of zero means no gift to either side. The frequent small gains are paid for with rare large losses.',
      },
    },
    {
      label: {
        de: 'Das Target schützt auch vor grossen Verlusten',
        en: 'The target also protects against large losses',
      },
      explain: {
        de: 'Verluste zählen nicht aufs Target. Ein Pfad ohne Target läuft bis zum letzten Fixing, mit doppelter Menge.',
        en: 'Losses do not count towards the target. A path without a target runs to the last fixing, with twice the amount.',
      },
    },
  ],
  correct: 0,
};

const q3: QuizQuestion = {
  id: 'm08-q3',
  prompt: {
    de: `Warum ist der TPF-Coupon mit ${tpfCoupon.de} Pips pro Fixing so gross?`,
    en: `Why is the TPF coupon of ${tpfCoupon.en} pips per fixing so large?`,
  },
  options: [
    {
      label: {
        de: 'Weil der Anbieter dem Kunden eine Prämie bezahlt',
        en: 'Because the provider pays the client a premium',
      },
      explain: {
        de: 'Es fliesst keine Prämie: Der TPF ist beim Abschluss null wert. Den Coupon bezahlen die zwei verkauften Puts.',
        en: 'No premium changes hands: the TPF is worth zero at inception. The coupon is paid for by the two sold puts.',
      },
    },
    {
      label: {
        de: `Weil der Strike ${tpfK} relativ zum Spot gesetzt ist (${tpfVsSpot.de}), der Forward aber um ${tpfDrop.de} Pips auf ${tpfFwdEnd} fällt`,
        en: `Because the strike ${tpfK} is set relative to the spot (${tpfVsSpot.en}), while the forward falls by ${tpfDrop.en} pips to ${tpfFwdEnd}`,
      },
      explain: {
        de: `Richtig. Für die späten Fixings liegt der Forward unter dem Strike. Die verkauften Puts sind darum viel wert, und ihre Prämie bezahlt den Coupon. Ohne Target wären es ${tpfNoTarget.de} Pips, ohne Target und ohne Zinsdifferenz nur ${tpfNoDrift.de} Pips.`,
        en: `Correct. For the late fixings the forward lies below the strike. The sold puts are therefore worth a lot, and their premium pays for the coupon. Without a target it would be ${tpfNoTarget.en} pips, without a target and without the interest-rate differential only ${tpfNoDrift.en} pips.`,
      },
    },
    {
      label: {
        de: 'Weil der Coupon in jedem Szenario fliesst',
        en: 'Because the coupon is paid in every scenario',
      },
      explain: {
        de: `Der Coupon fliesst nur, solange das Fixing auf oder über ${tpfK} liegt. Darunter zahlst du die doppelte Differenz.`,
        en: `The coupon is only paid as long as the fixing is at or above ${tpfK}. Below it you pay twice the difference.`,
      },
    },
    {
      label: {
        de: 'Weil das Target den Coupon kleiner macht',
        en: 'Because the target makes the coupon smaller',
      },
      explain: {
        de: `Umgekehrt: Das Target streicht die Coupons der guten Szenarien. Ohne Target wären ${tpfNoTarget.de} Pips fair. Mit Target beträgt der faire Coupon (Monte Carlo) ${tpfFair.de} ± ${tpfSe.de} Pips (Standardfehler), vertraglich gerundet ${tpfCoupon.de} Pips.`,
        en: `The other way round: the target cancels the coupons of the good scenarios. Without a target ${tpfNoTarget.en} pips would be fair. With the target the fair coupon (Monte Carlo) is ${tpfFair.en} ± ${tpfSe.en} pips (standard error), ${tpfCoupon.en} pips after rounding in the contract.`,
      },
    },
  ],
  correct: 1,
};

const q4: QuizQuestion = {
  id: 'm08-q4',
  prompt: {
    de: `Du legst ${dciCap.de} als Dual Currency an: Strike ${dciK}, Zins ${dciInt.de}. Bei Verfall steht USD/CHF bei ${dciS}. Was erhältst du?`,
    en: `You invest ${dciCap.en} in a dual currency deposit: strike ${dciK}, interest ${dciInt.en}. At maturity USD/CHF is at ${dciS}. What do you receive?`,
  },
  options: [
    {
      label: { de: dciCapPlusInt.de, en: dciCapPlusInt.en },
      mono: true,
      explain: {
        de: `Das gilt nur über dem Strike. Bei ${dciS} liegt das Fixing darunter: Dein Kapital wird umgetauscht.`,
        en: `That only applies above the strike. At ${dciS} the fixing is below it: your capital is converted.`,
      },
    },
    {
      label: {
        de: `${dciUsd.de} plus ${dciInt.de}, Wert ${dciValue.de}`,
        en: `${dciUsd.en} plus ${dciInt.en}, worth ${dciValue.en}`,
      },
      mono: true,
      explain: {
        de: `Richtig. Umgetauscht wird zum Strike: Kapital / ${dciK}. Zum Kurs ${dciS} sind die Dollars plus Zins ${dciValue.de} wert, ${dciDiff.de} weniger als ein Festgeld.`,
        en: `Correct. Conversion happens at the strike: capital / ${dciK}. At ${dciS} the dollars plus interest are worth ${dciValue.en}, ${dciDiff.en} less than a deposit.`,
      },
    },
    {
      label: { de: dciWrongUsd.de, en: dciWrongUsd.en },
      mono: true,
      explain: {
        de: `Das wäre ein Umtausch zum Marktkurs ${dciS}. Umgetauscht wird aber zum Strike ${dciK}, also weniger Dollars: ${dciUsd.de}.`,
        en: `That would be a conversion at the market rate ${dciS}. The conversion happens at the strike ${dciK}, which gives fewer dollars: ${dciUsd.en}.`,
      },
    },
    {
      label: { de: dciCap.de, en: dciCap.en },
      mono: true,
      explain: {
        de: 'Das Kapital ist nicht in CHF geschützt. Unter dem Strike erhältst du Dollars, und der Zins kommt immer dazu.',
        en: 'The capital is not protected in CHF. Below the strike you receive dollars, and the interest is always paid on top.',
      },
    },
  ],
  correct: 1,
};

export const quiz: ModuleQuiz = {
  slug: '08-structured-products',
  quiz: [q1, q2, q3, q4],
  checks: { '1': check1, '2': check2, '3': check3, '4': check4 },
};
