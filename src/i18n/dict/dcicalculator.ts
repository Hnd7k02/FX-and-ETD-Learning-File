import { defineDict } from '../types';

/**
 * Dual currency calculator (DciCalculator island, modules 08 and 09). Numbers are placeholders
 * filled from src/lib/dcicalc.ts and formatted with src/lib/format.ts.
 */
export const dcicalculator = defineDict({
  de: {
    'dci.title': 'Dual-Currency-Rechner',
    'dci.sub': 'CHF-Festgeld + verkaufter USD Put / CHF Call · Spot {spot} · Vola {vol} · {label}',
    'dci.generic': 'Vereinfacht und generisch: Marktvarianten unterscheiden sich.',
    'dci.capital': 'Anlage in CHF',
    'dci.tenor': 'Laufzeit',
    'dci.month': '{m} Monat',
    'dci.months': '{m} Monate',
    'dci.distance': 'Strike unter Spot',
    'dci.distanceValue': '{pct} · K {k}',
    'dci.fixing': 'Kurs bei Verfall',
    'dci.dragHint': 'Zieh den Kurs bei Verfall direkt im Chart',
    'dci.y': 'Mehr oder weniger als ein Festgeld, in CHF',
    'dci.x': 'USD/CHF bei Verfall',
    'dci.lg.dci': 'Dual Currency',
    'dci.lg.deposit': 'Festgeld (Geldmarkt)',
    'dci.lg.zone': 'Umtausch in USD',
    'dci.zone': 'Umtausch in USD',
    'dci.k': 'K {v}',
    'dci.be': 'Break-even {v}',
    'dci.spot': 'Spot',
    'dci.fwd': 'Forward',
    'dci.yield': 'Rendite p.a.',
    'dci.yieldSub': 'Geldmarkt {mm} + Prämie {prem}',
    'dci.interest': 'Zins bei Verfall',
    'dci.interestSub': 'Festgeld: {dep}',
    'dci.strike': 'Strike K',
    'dci.strikeSub': '{spot} Pips zum Spot · {fwd} Pips zum Forward',
    'dci.breakEven': 'Break-even',
    'dci.breakEvenSub': 'darunter schneidest du schlechter ab als mit Festgeld',
    'dci.pConv': 'Umtausch (Modell)',
    'dci.pConvSub': 'risikoneutrale Wahrscheinlichkeit, keine Prognose',
    'dci.blocks':
      'Bausteine: Festgeld {cap} + verkaufter USD Put / CHF Call mit Strike {k} auf {usd}. Die Prämie von {prem} erhältst du als Zusatzzins.',
    'dci.out.keep':
      'Bei {s} bleibt dein Geld in CHF: Du erhältst {total} (Kapital plus {int} Zins), {diff} mehr als mit Festgeld.',
    'dci.out.convertGood':
      'Bei {s} wird umgetauscht: Du erhältst {usd} zu {k} plus {int} Zins. Wert in CHF: {value}, immer noch {diff} mehr als mit Festgeld.',
    'dci.out.convertBad':
      'Bei {s} wird umgetauscht: Du erhältst {usd} zu {k} plus {int} Zins. Wert in CHF: {value}, das sind {diff} weniger als mit Festgeld. Das ist das Konversionsrisiko.',
    'dci.aria':
      'Ergebnis der Dual-Currency-Anlage gegenüber Festgeld je nach Kurs bei Verfall. Strike {k}, Break-even {be}, Rendite {yield} p.a. Bei {s}: {diff}.',
  },
  en: {
    'dci.title': 'Dual currency calculator',
    'dci.sub': 'CHF deposit + sold USD put / CHF call · spot {spot} · vol {vol} · {label}',
    'dci.generic': 'Simplified and generic: market variants differ.',
    'dci.capital': 'Investment in CHF',
    'dci.tenor': 'Tenor',
    'dci.month': '{m} month',
    'dci.months': '{m} months',
    'dci.distance': 'Strike below spot',
    'dci.distanceValue': '{pct} · K {k}',
    'dci.fixing': 'Rate at maturity',
    'dci.dragHint': 'Drag the rate at maturity directly on the chart',
    'dci.y': 'More or less than a deposit, in CHF',
    'dci.x': 'USD/CHF at maturity',
    'dci.lg.dci': 'Dual currency',
    'dci.lg.deposit': 'Deposit (money market)',
    'dci.lg.zone': 'Conversion into USD',
    'dci.zone': 'Conversion into USD',
    'dci.k': 'K {v}',
    'dci.be': 'Break-even {v}',
    'dci.spot': 'Spot',
    'dci.fwd': 'Forward',
    'dci.yield': 'Yield p.a.',
    'dci.yieldSub': 'Money market {mm} + premium {prem}',
    'dci.interest': 'Interest at maturity',
    'dci.interestSub': 'Deposit: {dep}',
    'dci.strike': 'Strike K',
    'dci.strikeSub': '{spot} pips to spot · {fwd} pips to the forward',
    'dci.breakEven': 'Break-even',
    'dci.breakEvenSub': 'below it you do worse than with a deposit',
    'dci.pConv': 'Conversion (model)',
    'dci.pConvSub': 'risk-neutral probability, not a forecast',
    'dci.blocks':
      'Building blocks: deposit {cap} + sold USD put / CHF call with strike {k} on {usd}. You receive the premium of {prem} as extra interest.',
    'dci.out.keep':
      'At {s} your money stays in CHF: you receive {total} (capital plus {int} interest), {diff} more than with a deposit.',
    'dci.out.convertGood':
      'At {s} the capital is converted: you receive {usd} at {k} plus {int} interest. Value in CHF: {value}, still {diff} more than with a deposit.',
    'dci.out.convertBad':
      'At {s} the capital is converted: you receive {usd} at {k} plus {int} interest. Value in CHF: {value}, that is {diff} less than with a deposit. This is the conversion risk.',
    'dci.aria':
      'Result of the dual currency investment versus a deposit, by the rate at maturity. Strike {k}, break-even {be}, yield {yield} p.a. At {s}: {diff}.',
  },
});
