import { defineDict } from '../types';

/**
 * SpotExposure (module 01, section 1): what USD 1 Mio. cost the Swiss importer in CHF.
 * Numbers are placeholders, filled from src/lib/m01/exposure.ts and formatted with format.ts.
 */
export const spotexposure = defineDict({
  de: {
    title: 'Was die Dollars den Importeur kosten',
    sub: 'USD {notional} in {months} Monaten · heute {pair} {spot} = {today}',
    chip: '1 Big Figure = {bf}',
    y: 'Kosten in CHF Tsd.',
    x: '{pair}',
    today: 'heute {today}',
    spotToday: 'Spot heute',
    band: 'typisch in {months} Monaten (±1σ)',
    legendCost: 'Kosten ohne Absicherung',
    legendBlock: '1 Block = 1 Big Figure = {bf}',
    legendBand: 'typische Bandbreite in {months} Monaten',
    slider: 'Kurs {pair} in {months} Monaten',
    drag: 'Zieh am Kurs, direkt im Chart oder am Regler',
    heroLabel: 'Kosten in CHF',
    heroSub: 'für USD {notional}',
    rowRate: '{pair}',
    rowRateSub: 'CHF je 1 USD',
    rowInverse: 'CHF/USD',
    rowInverseSub: 'USD je 1 CHF (Kehrwert)',
    rowDiff: 'gegenüber heute',
    rowDiffSub: '{pips} Pips = {bf} Big Figures',
    rowUsdPct: 'Dollar',
    rowUsdPctSub: 'Veränderung von USD/CHF',
    rowChfPct: 'Franken',
    rowChfPctSub: 'Veränderung von CHF/USD',
    annotBf: '{bf} Big Figures',
    annotBfOne: '{bf} Big Figure',
    presets: 'Szenarien',
    presetToday: 'heute',
    'note.flat':
      'Heute kosten die Dollars {today}. Zieh am Kurs: Jede Big Figure (0.0100) kostet den Importeur {bf}.',
    'note.up':
      'Der Dollar ist {pct} teurer geworden. Der Importeur zahlt {diff} mehr für genau dieselbe Lieferung. So hoch oder höher endet der Kurs im Modell in rund {prob} der Fälle (risikoneutral, keine Prognose).',
    'note.upFar':
      'Das liegt ausserhalb der typischen Bandbreite für {months} Monate. Im Modell endet der Kurs nur in rund {prob} der Fälle so hoch oder höher (risikoneutral, keine Prognose): unwahrscheinlich, aber kein Ausnahmefall. Der Importeur zahlt {diff} mehr.',
    'note.down':
      'Der Dollar ist billiger geworden: Der Importeur spart {diff}. So tief oder tiefer endet der Kurs im Modell in rund {prob} der Fälle (risikoneutral, keine Prognose). Darauf wetten will er nicht.',
    'note.downFar':
      'Ein starker Franken: Der Importeur spart {diff}. Im Modell passiert das nur in rund {prob} der Fälle (risikoneutral, keine Prognose): ein Glücksfall, auf den er sich nicht verlassen kann.',
    'status.flat': 'Kurs wie heute.',
    'status.up': 'Dollar teurer: Mehrkosten.',
    'status.upFar': 'Dollar viel teurer: ausserhalb der typischen Bandbreite.',
    'status.down': 'Dollar billiger: Ersparnis.',
    'status.downFar': 'Dollar viel billiger: ausserhalb der typischen Bandbreite.',
    aria: 'Kosten von USD {notional} in CHF in Abhängigkeit vom Kurs {pair}. Bei {rate}: {cost}, {diff} gegenüber heute; Kehrwert CHF/USD {inverse}.',
  },
  en: {
    title: 'What the dollars cost the importer',
    sub: 'USD {notional} in {months} months · today {pair} {spot} = {today}',
    chip: '1 big figure = {bf}',
    y: 'Cost in CHF thousands',
    x: '{pair}',
    today: 'today {today}',
    spotToday: 'Spot today',
    band: 'typical in {months} months (±1σ)',
    legendCost: 'Cost without a hedge',
    legendBlock: '1 block = 1 big figure = {bf}',
    legendBand: 'typical range in {months} months',
    slider: '{pair} rate in {months} months',
    drag: 'Drag the rate, on the chart or with the slider',
    heroLabel: 'Cost in CHF',
    heroSub: 'for USD {notional}',
    rowRate: '{pair}',
    rowRateSub: 'CHF per 1 USD',
    rowInverse: 'CHF/USD',
    rowInverseSub: 'USD per 1 CHF (inverse)',
    rowDiff: 'versus today',
    rowDiffSub: '{pips} pips = {bf} big figures',
    rowUsdPct: 'Dollar',
    rowUsdPctSub: 'change of USD/CHF',
    rowChfPct: 'Franc',
    rowChfPctSub: 'change of CHF/USD',
    annotBf: '{bf} big figures',
    annotBfOne: '{bf} big figure',
    presets: 'Scenarios',
    presetToday: 'today',
    'note.flat':
      'Today the dollars cost {today}. Drag the rate: every big figure (0.0100) costs the importer {bf}.',
    'note.up':
      'The dollar has become {pct} dearer. The importer pays {diff} more for exactly the same delivery. In the model the rate ends this high or higher in about {prob} of cases (risk-neutral, not a forecast).',
    'note.upFar':
      'That is outside the typical range for {months} months. In the model the rate ends this high or higher in only about {prob} of cases (risk-neutral, not a forecast): unlikely, but no freak event. The importer pays {diff} more.',
    'note.down':
      'The dollar has become cheaper: the importer saves {diff}. In the model the rate ends this low or lower in about {prob} of cases (risk-neutral, not a forecast). He does not want to bet on it.',
    'note.downFar':
      'A strong franc: the importer saves {diff}. In the model this happens in only about {prob} of cases (risk-neutral, not a forecast): a windfall he cannot rely on.',
    'status.flat': 'Rate as today.',
    'status.up': 'Dollar dearer: extra cost.',
    'status.upFar': 'Dollar much dearer: outside the typical range.',
    'status.down': 'Dollar cheaper: saving.',
    'status.downFar': 'Dollar much cheaper: outside the typical range.',
    aria: 'Cost of USD {notional} in CHF depending on the {pair} rate. At {rate}: {cost}, {diff} versus today; inverse CHF/USD {inverse}.',
  },
});
