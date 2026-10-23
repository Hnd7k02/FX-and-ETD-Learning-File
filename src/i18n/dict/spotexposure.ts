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
    blockLabel: '+1 Big Figure = {bf}',
    blockLabelDown: '−1 Big Figure = {bf}',
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
    rowPct: 'Dollar / Franken',
    rowPctSub: 'Veränderung in %',
    pctPair: 'USD {usd} · CHF {chf}',
    presets: 'Szenarien',
    presetToday: 'heute',
    'note.flat':
      'Heute kosten die Dollars {today}. Zieh am Kurs: Jede Big Figure (0.0100) kostet den Importeur {bf}.',
    'note.up':
      'Der Dollar ist {pct} teurer geworden. Der Importeur zahlt {diff} mehr für genau dieselbe Lieferung.',
    'note.upFar':
      'Das liegt ausserhalb der typischen Bandbreite für {months} Monate: selten, aber möglich. Der Importeur zahlt {diff} mehr.',
    'note.down':
      'Der Dollar ist billiger geworden: Der Importeur spart {diff}. Darauf wetten will er aber nicht.',
    'note.downFar':
      'Ein starker Franken: Der Importeur spart {diff}. Ein Glücksfall, auf den er sich nicht verlassen kann.',
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
    blockLabel: '+1 big figure = {bf}',
    blockLabelDown: '−1 big figure = {bf}',
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
    rowPct: 'Dollar / franc',
    rowPctSub: 'change in %',
    pctPair: 'USD {usd} · CHF {chf}',
    presets: 'Scenarios',
    presetToday: 'today',
    'note.flat':
      'Today the dollars cost {today}. Drag the rate: every big figure (0.0100) costs the importer {bf}.',
    'note.up':
      'The dollar has become {pct} dearer. The importer pays {diff} more for exactly the same delivery.',
    'note.upFar':
      'That is outside the typical range for {months} months: rare, but possible. The importer pays {diff} more.',
    'note.down':
      'The dollar has become cheaper: the importer saves {diff}. But he does not want to bet on it.',
    'note.downFar':
      'A strong franc: the importer saves {diff}. A windfall he cannot rely on.',
    aria: 'Cost of USD {notional} in CHF depending on the {pair} rate. At {rate}: {cost}, {diff} versus today; inverse CHF/USD {inverse}.',
  },
});
