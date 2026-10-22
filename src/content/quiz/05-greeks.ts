/**
 * Module 05 Greeks: four graded quiz questions and one "Kurz geprüft" check per section.
 * Every number in a label or explanation is computed in src/lib/nums/m05.ts and formatted
 * with src/lib/format.ts. The checks for sections 1, 3 and 4 are provisional and will be
 * refined together with their section texts.
 */
import type { Lang } from '@/i18n/types';
import { fmtMoney, fmtNumber, fmtPct, fmtPips } from '@/lib/format';
import { EXAMPLE as E } from '@/lib/fx/example';
import { M05 } from '@/lib/nums/m05';
import type { ModuleQuiz, QuizQuestion } from './types';

const both = (f: (lang: Lang) => string) => ({ de: f('de'), en: f('en') });
const num = (x: number, digits: number, sign = false) =>
  both((l) => fmtNumber(x, l, { digits, sign }));
const chf = (x: number, sign = false) => both((l) => fmtMoney(x, E.quote, l, 0, sign));

const gamma = fmtNumber(M05.gamma, 'en', { digits: 2 });
const delta = fmtNumber(M05.delta, 'en', { digits: 3 });
const deltaUp = fmtNumber(M05.deltaUp, 'en', { digits: 2 });
const dChange = num(M05.deltaChangeApprox, 3, true);
const vol = both((l) => fmtPct(E.vol, l, 0));
const volUp = both((l) => fmtPct(E.vol + 0.01, l, 0));
const rf = both((l) => fmtPct(E.rf, l, 1));
const breakEven = both((l) => fmtPips(M05.breakEvenPips, l));
const vega = chf(M05.vegaPointChf);
const thetaDay = chf(M05.thetaOneDayChf);
const thetaGamma = chf(M05.thetaGammaDayChf);
const thetaCarry = chf(M05.thetaCarryDayChf, true);
const rhoF = chf(M05.rhoForeignChf, true);
const rhoD = chf(M05.rhoDomesticChf, true);
const pnl10 = chf(M05.deltaPnl10PipsChf);

/* ---------- Checks (one per section, ungraded) ---------- */

const check1: QuizQuestion = {
  id: 'm05-c1',
  prompt: {
    de: 'Der Importeur hält den USD Call aus dem Beispiel. Worauf reagiert der Preis dieser Option?',
    en: 'The importer holds the USD call from the example. What does the price of this option react to?',
  },
  options: [
    {
      label: { de: 'Nur auf den Spotkurs USD/CHF', en: 'Only to the USD/CHF spot rate' },
      explain: {
        de: 'Der Spot ist der wichtigste Treiber, aber nicht der einzige. Zeit, Vola und die beiden Zinsen bewegen den Preis ebenfalls, jeder hat seinen eigenen Greek.',
        en: 'Spot is the most important driver, but not the only one. Time, volatility and the two interest rates move the price too; each has its own Greek.',
      },
    },
    {
      label: {
        de: 'Auf Spot, Zeit, Vola und die zwei Zinsen',
        en: 'To spot, time, volatility and the two interest rates',
      },
      explain: {
        de: 'Fünf Eingaben, sechs Greeks: Delta und Gamma für den Spot, Theta für die Zeit, Vega für die Vola, Rho domestic und Rho foreign für die Zinsen.',
        en: 'Five inputs, six Greeks: delta and gamma for spot, theta for time, vega for volatility, rho domestic and rho foreign for the rates.',
      },
    },
    {
      label: {
        de: 'Auf Spot und Zeit; Zinsen spielen keine Rolle',
        en: 'To spot and time; interest rates play no role',
      },
      explain: {
        de: 'Die Zinsen bestimmen den Forward, und die Option wird gegen den Forward bewertet. Darum gibt es zwei Rhos.',
        en: 'The rates determine the forward, and the option is valued against the forward. That is why there are two rhos.',
      },
    },
  ],
  correct: 1,
};

const check2: QuizQuestion = {
  id: 'm05-c2',
  prompt: {
    de: 'USD/CHF steigt um eine Big Figure (0.0100). Um wie viel ändert sich das Delta des Calls aus dem Beispiel ungefähr?',
    en: 'USD/CHF rises by one big figure (0.0100). By roughly how much does the delta of the call in the example change?',
  },
  options: [
    {
      label: num(M05.gamma * 0.001, 3, true),
      mono: true,
      explain: {
        de: `Das wäre die Delta-Änderung für 10 Pips (0.0010), nicht für eine Big Figure. Gamma mal Kursänderung: ${gamma} · 0.01 ≈ ${dChange.de}.`,
        en: `That is the delta change for 10 pips (0.0010), not for a big figure. Gamma times the move: ${gamma} · 0.01 ≈ ${dChange.en}.`,
      },
    },
    {
      label: dChange,
      mono: true,
      explain: {
        de: `Delta ändert sich um Gamma mal Kursänderung: ${gamma} · 0.01 ≈ ${dChange.de}. Weil Gamma selbst wandert, landet Delta tatsächlich bei etwa ${deltaUp} statt bei ${delta} + ${dChange.de}.`,
        en: `Delta changes by gamma times the move: ${gamma} · 0.01 ≈ ${dChange.en}. Because gamma itself drifts, delta actually ends up near ${deltaUp} rather than exactly ${delta} + ${dChange.en}.`,
      },
    },
    {
      label: num(M05.gamma * 0.1, 3, true),
      mono: true,
      explain: {
        de: `Zehnmal zu viel: Das wäre die Änderung für 0.1000, also zehn Big Figures. Delta kann ohnehin nie über 1 steigen. Richtig ist ${gamma} · 0.01 ≈ ${dChange.de}.`,
        en: `Ten times too much: that would be the change for 0.1000, ten big figures. Delta can never exceed 1 anyway. The right answer is ${gamma} · 0.01 ≈ ${dChange.en}.`,
      },
    },
  ],
  correct: 1,
};

const check3: QuizQuestion = {
  id: 'm05-c3',
  prompt: {
    de: 'Bei welchem Strike reagiert die Prämie am stärksten auf die Vola, also wo ist Vega am grössten?',
    en: 'At which strike does the premium react most to volatility, that is, where is vega largest?',
  },
  options: [
    {
      label: { de: 'Tief im Geld', en: 'Deep in the money' },
      explain: {
        de: 'Tief im Geld verhält sich die Option fast wie ein Forward. Ob die Vola steigt oder fällt, ändert am Ergebnis wenig: Vega ist klein.',
        en: 'Deep in the money the option behaves almost like a forward. Whether volatility rises or falls changes little: vega is small.',
      },
    },
    {
      label: { de: 'Am Forward (ATMF)', en: 'At the forward (ATMF)' },
      explain: {
        de: 'Am Forward ist offen, ob die Option am Ende etwas wert ist. Genau dort macht mehr Vola den grössten Unterschied, und Vega ist am grössten.',
        en: 'At the forward it is an open question whether the option will finish with value. That is where extra volatility makes the biggest difference, and vega peaks.',
      },
    },
    {
      label: { de: 'Weit aus dem Geld', en: 'Far out of the money' },
      explain: {
        de: 'Weit aus dem Geld ist die Prämie klein, und mehr Vola hilft zwar, aber nur wenig in absoluten Zahlen. Vega ist klein; in Prozent der Prämie ist die Reaktion allerdings gross.',
        en: 'Far out of the money the premium is small; more volatility helps, but only a little in absolute terms. Vega is small, although the reaction in percent of the premium is large.',
      },
    },
  ],
  correct: 1,
};

const check4: QuizQuestion = {
  id: 'm05-c4',
  prompt: {
    de: `Das Theta des Calls im Labor beträgt rund ${thetaDay.de} pro Tag, der Gamma-Anteil Θ_Γ rund ${thetaGamma.de}. Woher kommt der Unterschied?`,
    en: `The theta of the call in the lab is about ${thetaDay.en} per day, the gamma share Θ_Γ about ${thetaGamma.en}. Where does the difference come from?`,
  },
  options: [
    {
      label: {
        de: 'Vom Zins-Carry: Mit jedem Tag rückt der Forward näher an den Spot',
        en: 'From the rate carry: each day the forward moves closer to spot',
      },
      explain: {
        de: `Der USD-Zins (${rf.de}) liegt über dem CHF-Zins, der Forward unter dem Spot. Mit jedem Tag, der vergeht, rückt der Forward näher an den Spot heran. Das hilft dem Call um rund ${thetaCarry.de} pro Tag und mildert den Gamma-Anteil von ${thetaGamma.de} auf ${thetaDay.de}.`,
        en: `The USD rate (${rf.en}) is above the CHF rate, so the forward sits below spot. With every day that passes the forward moves closer to spot. That helps the call by about ${thetaCarry.en} per day and softens the gamma share of ${thetaGamma.en} to ${thetaDay.en}.`,
      },
    },
    {
      label: { de: 'Von der Vola: Vega wirkt mit', en: 'From volatility: vega plays a part' },
      explain: {
        de: 'Vega misst die Reaktion auf eine Änderung der Vola. Beim Theta bleibt die Vola gleich; nur die Zeit vergeht. Der Unterschied kommt vom Zins-Carry.',
        en: 'Vega measures the reaction to a change in volatility. For theta, volatility stays the same; only time passes. The difference comes from the rate carry.',
      },
    },
    {
      label: {
        de: 'Von der Rundung: beide Zahlen messen dasselbe',
        en: 'From rounding: both numbers measure the same thing',
      },
      explain: {
        de: `Der Unterschied ist zu gross für Rundung. Θ_Γ ist nur der Gamma-Anteil des Zeitwertverlusts; das volle Theta enthält zusätzlich den Zins-Carry von rund ${thetaCarry.de} pro Tag.`,
        en: `The gap is far too big for rounding. Θ_Γ is only the gamma share of time decay; full theta also contains the rate carry of about ${thetaCarry.en} per day.`,
      },
    },
  ],
  correct: 0,
};

/* ---------- Quiz (four graded questions, pass from 3 of 4) ---------- */

const q1: QuizQuestion = {
  id: 'm05-q1',
  prompt: {
    de: `Der Call aus dem Beispiel hat ein Delta von rund ${delta}. USD/CHF steigt um 10 Pips. Um wie viel ändert sich der Wert der Option auf USD 1 Mio. ungefähr?`,
    en: `The call in the example has a delta of about ${delta}. USD/CHF rises by 10 pips. By roughly how much does the value of the option on USD 1m change?`,
  },
  options: [
    {
      label: pnl10,
      mono: true,
      explain: {
        de: `Delta mal Kursänderung mal Nominal: ${delta} · 0.0010 · USD 1 Mio. ≈ ${pnl10.de}. Die Option bewegt sich etwa halb so stark wie ein Forward über denselben Betrag.`,
        en: `Delta times the move times the notional: ${delta} · 0.0010 · USD 1m ≈ ${pnl10.en}. The option moves about half as much as a forward on the same amount.`,
      },
    },
    {
      label: chf(10 * 1e-4 * E.notional),
      mono: true,
      explain: {
        de: `Das wäre der Gewinn eines Forwards über USD 1 Mio., also Delta 1. Der Call hat Delta ${delta} und gewinnt etwa die Hälfte: ${pnl10.de}.`,
        en: `That would be the gain on a forward over USD 1m, i.e. delta 1. The call has delta ${delta} and gains about half: ${pnl10.en}.`,
      },
    },
    {
      label: chf(M05.deltaPnl10PipsChf / 10),
      mono: true,
      explain: {
        de: `Zehnmal zu wenig: 10 Pips sind 0.0010, nicht 0.0001. Delta mal Kursänderung mal Nominal ergibt ${pnl10.de}.`,
        en: `Ten times too little: 10 pips are 0.0010, not 0.0001. Delta times the move times the notional gives ${pnl10.en}.`,
      },
    },
  ],
  correct: 0,
};

const q2: QuizQuestion = {
  id: 'm05-q2',
  prompt: {
    de: 'Du hältst den Call delta-gehedgt, bist also long Gamma. An welchem Tag verdienst du mit dieser Position?',
    en: 'You hold the call delta-hedged, so you are long gamma. On which day does this position make money?',
  },
  options: [
    {
      label: {
        de: 'An jedem Tag, weil Gamma immer positiv ist',
        en: 'Every day, because gamma is always positive',
      },
      explain: {
        de: `Gamma ist positiv, aber nicht gratis: Jeden Tag kostet die Position Theta. Nur Bewegung über dem Break-even von rund ${breakEven.de} Pips deckt diese Kosten.`,
        en: `Gamma is positive, but not free: every day the position pays theta. Only a move beyond the break-even of about ${breakEven.en} pips covers that cost.`,
      },
    },
    {
      label: {
        de: `Wenn sich USD/CHF um mehr als rund ${breakEven.de} Pips bewegt`,
        en: `When USD/CHF moves by more than about ${breakEven.en} pips`,
      },
      explain: {
        de: `P&L ≈ ½ · Γ · [(ΔS)² − σ² · S² · Δt]. Die Klammer wird positiv, wenn |ΔS| über σ · S / √365 liegt, hier rund ${breakEven.de} Pips. Darunter frisst Theta den Gamma-Gewinn.`,
        en: `P&L ≈ ½ · Γ · [(ΔS)² − σ² · S² · Δt]. The bracket turns positive once |ΔS| exceeds σ · S / √365, here about ${breakEven.en} pips. Below that, theta eats the gamma gain.`,
      },
    },
    {
      label: {
        de: 'Nur wenn USD/CHF steigt, weil es ein Call ist',
        en: 'Only when USD/CHF rises, because it is a call',
      },
      explain: {
        de: 'Delta-gehedgt ist die Richtung egal: Nach einem Anstieg verkaufst du USD, nach einem Rückgang kaufst du. Beides bringt Gewinn, sofern die Bewegung gross genug ist.',
        en: 'Delta-hedged, direction does not matter: after a rise you sell USD, after a fall you buy. Both earn, provided the move is large enough.',
      },
    },
  ],
  correct: 1,
};

const q3: QuizQuestion = {
  id: 'm05-q3',
  prompt: {
    de: `Die implizite Vola steigt von ${vol.de} auf ${volUp.de}, alles andere bleibt gleich. Um wie viel ändert sich der Wert des Calls auf USD 1 Mio. ungefähr?`,
    en: `Implied volatility rises from ${vol.en} to ${volUp.en}, everything else unchanged. By roughly how much does the value of the call on USD 1m change?`,
  },
  options: [
    {
      label: chf(M05.vegaPointChf / 10),
      mono: true,
      explain: {
        de: `Zehnmal zu wenig. Vega je Vola-Punkt ist S · e^(−rf T) · φ(d1) · √T · 1 % auf den Nominal: rund ${vega.de}.`,
        en: `Ten times too little. Vega per vol point is S · e^(−rf T) · φ(d1) · √T · 1% on the notional: about ${vega.en}.`,
      },
    },
    {
      label: vega,
      mono: true,
      explain: {
        de: `Vega je Vola-Punkt beträgt rund ${vega.de}. Ein Punkt mehr Vola macht den Call um diesen Betrag teurer, ein Punkt weniger entsprechend billiger.`,
        en: `Vega per vol point is about ${vega.en}. One point more volatility makes the call dearer by that amount, one point less cheaper by the same.`,
      },
    },
    {
      label: chf(M05.vegaPointChf * 10),
      mono: true,
      explain: {
        de: `Das wäre die Reaktion auf zehn Vola-Punkte. Ein Punkt bringt rund ${vega.de}; die Prämie selbst liegt bei ${chf(M05.callChf).de}.`,
        en: `That would be the reaction to ten vol points. One point is worth about ${vega.en}; the premium itself is ${chf(M05.callChf).en}.`,
      },
    },
  ],
  correct: 1,
};

const q4: QuizQuestion = {
  id: 'm05-q4',
  prompt: {
    de: 'Der USD-Zins steigt um 1 %, alles andere bleibt gleich. Was passiert mit dem Wert des USD Calls auf USD 1 Mio.?',
    en: 'The USD rate rises by 1%, everything else unchanged. What happens to the value of the USD call on USD 1m?',
  },
  options: [
    {
      label: rhoF,
      mono: true,
      explain: {
        de: `Ein höherer USD-Zins drückt den Forward (Forward = Spot + Cost − Benefit, der USD-Zins ist der Benefit). Ein tieferer Forward ist schlecht für einen USD Call: Rho foreign ≈ ${rhoF.de} je +1 %.`,
        en: `A higher USD rate pushes the forward down (forward = spot + cost − benefit; the USD rate is the benefit). A lower forward is bad for a USD call: rho foreign ≈ ${rhoF.en} per +1%.`,
      },
    },
    {
      label: rhoD,
      mono: true,
      explain: {
        de: `Das ist Rho domestic, die Reaktion auf +1 % CHF-Zins: Ein höherer CHF-Zins hebt den Forward und hilft dem Call. Der USD-Zins wirkt umgekehrt: ${rhoF.de}.`,
        en: `That is rho domestic, the reaction to +1% in the CHF rate: a higher CHF rate lifts the forward and helps the call. The USD rate works the other way: ${rhoF.en}.`,
      },
    },
    {
      label: chf(0),
      mono: true,
      explain: {
        de: `Die Zinsen wirken über den Forward auf die Option, nicht nur über die Diskontierung. +1 % USD-Zins senkt den Forward und kostet rund ${rhoF.de}.`,
        en: `The rates reach the option through the forward, not just through discounting. +1% in the USD rate lowers the forward and costs about ${rhoF.en}.`,
      },
    },
  ],
  correct: 0,
};

export const quiz: ModuleQuiz = {
  slug: '05-greeks',
  quiz: [q1, q2, q3, q4],
  checks: { '1': check1, '2': check2, '3': check3, '4': check4 },
};
