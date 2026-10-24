import { defineDict } from '../types';

/**
 * Riskometer page (src/views/RiskometerView.astro, src/components/islands/Riskometer.tsx).
 * German texts are the approved prototype texts (docs/design/Riskometer.dc.html); every number
 * is a placeholder filled from src/data/fx/riskometer.json. The H1 follows the selected pair.
 */
export const riskometer = defineDict({
  de: {
    'rk.title': 'Riskometer: Wie nervös ist der Franken?',
    'rk.description':
      'Realisierte 1-Monats-Vola von EUR/CHF, USD/CHF, EUR/USD und USD/JPY seit 2006 aus EZB-Referenzkursen, mit Stufen, Tacho und erklärten Marktereignissen.',
    'rk.chip': 'Riskometer',
    'rk.h1.EURCHF': 'Wie nervös ist der Franken?',
    'rk.h1.USDCHF': 'Wie nervös ist der Franken?',
    'rk.h1.EURUSD': 'Wie nervös ist der Euro?',
    'rk.h1.USDJPY': 'Wie nervös ist der Yen?',
    'rk.lead':
      'Die realisierte 1-Monats-Vola von {pair}, berechnet aus Tageskursen. Tipp auf einen Ausschlag: Die Karte darunter erklärt, was passiert ist und was es für Forwards, Optionen und Barrieren hiess.',
    'rk.pairGroup': 'Währungspaar',
    'rk.asOf': 'Stand {date}',
    'rk.today': 'Letzter Stand',
    'rk.todaySub': '{pair} · 1 Monat',
    'rk.gaugeAria': 'Tacho: Stufe {level}, Perzentil {pct}',
    'rk.percentile': 'Höher als an {pct} aller Handelstage seit {year}.',
    'rk.legendAria': 'Stufen für {pair}',
    'rk.legend.below': 'unter {v}',
    'rk.legend.between': '{a} bis {b}',
    'rk.legend.above': 'über {v}',
    'rk.legend.current': 'Stufe zum Datenstand',
    'rk.histTitle': '{years} Jahre {pair}: realisierte 1-Monats-Vola',
    'rk.histSub': 'Wochenwerte {from} bis {to} · Punkte antippen',
    'rk.chartAria':
      'Linienchart der realisierten Vola von {pair} seit {year} mit {n} markierten Ereignissen',
    'rk.chartSummary':
      'Wochenwerte vom {from} bis {to}. Tiefstwert {min} am {minDate}, Höchstwert {max} am {maxDate}, zuletzt {current}. Die Jahreshöchstwerte stehen in der Tabelle unter der Karte.',
    'rk.todayTag': 'Zuletzt {v}',
    'rk.eventsGroup': 'Ereignisse',
    'rk.eventAria': '{year}: {title}, Vola-Spitze {peak}',
    'rk.meansH': 'Was es bedeutet',
    'rk.deepen': 'Vertiefen in',
    'rk.moveNote': '{move} vom {from} bis {to}',
    'rk.peakH': 'Spitze der 1-Monats-Vola',
    'rk.peakSub': 'Spitze am {date} · zuletzt {today}',
    'rk.peakRecord': 'Höchster Wert seit {year}',
    'rk.tableShow': 'Daten als Tabelle',
    'rk.tableHide': 'Tabelle ausblenden',
    'rk.tableCaption':
      'Jahreshöchstwerte der realisierten 1-Monats-Vola von {pair} (Tageswerte seit {year})',
    'rk.colYear': 'Jahr',
    'rk.colMax': 'Höchste Vola',
    'rk.colDate': 'Datum',
    'rk.colLevel': 'Stufe',
    'rk.footData':
      'Daten: EZB-Referenzkurse, veröffentlicht an Arbeitstagen um ca. 16:00 MEZ; USD/CHF und USD/JPY als Kreuzkurse über den Euro.',
    'rk.footMethod':
      'Realisierte Vola: Standardabweichung von {window} täglichen Log-Renditen (Mittelwert 0), annualisiert mit √{ann}, im Chart als Wochenwerte. Stufen nach Perzentilen aller Tageswerte seit {year}, je Paar: {levels}.',
    'rk.footLevels':
      '{l1} unter P{p1}, {l2} bis P{p2}, {l3} bis P{p3}, {l4} bis P{p4}, {l5} ab P{p4}',
    'rk.footDisclaimer': 'Nur zu Bildungszwecken, keine Anlageberatung.',
    'rk.footLink': 'Methodik und Quellen',
  },
  en: {
    'rk.title': 'Riskometer: how nervous is the franc?',
    'rk.description':
      'Realised 1-month volatility of EUR/CHF, USD/CHF, EUR/USD and USD/JPY since 2006 from ECB reference rates, with levels, a gauge and explained market events.',
    'rk.chip': 'Riskometer',
    'rk.h1.EURCHF': 'How nervous is the franc?',
    'rk.h1.USDCHF': 'How nervous is the franc?',
    'rk.h1.EURUSD': 'How nervous is the euro?',
    'rk.h1.USDJPY': 'How nervous is the yen?',
    'rk.lead':
      'The realised 1-month volatility of {pair}, calculated from daily rates. Tap a spike: the card below explains what happened and what it meant for forwards, options and barriers.',
    'rk.pairGroup': 'Currency pair',
    'rk.asOf': 'As of {date}',
    'rk.today': 'Latest reading',
    'rk.todaySub': '{pair} · 1 month',
    'rk.gaugeAria': 'Gauge: level {level}, percentile {pct}',
    'rk.percentile': 'Higher than on {pct} of all trading days since {year}.',
    'rk.legendAria': 'Levels for {pair}',
    'rk.legend.below': 'below {v}',
    'rk.legend.between': '{a} to {b}',
    'rk.legend.above': 'above {v}',
    'rk.legend.current': 'level at the data date',
    'rk.histTitle': '{years} years of {pair}: realised 1-month volatility',
    'rk.histSub': 'Weekly values {from} to {to} · tap the dots',
    'rk.chartAria':
      'Line chart of the realised volatility of {pair} since {year} with {n} marked events',
    'rk.chartSummary':
      'Weekly values from {from} to {to}. Lowest {min} on {minDate}, highest {max} on {maxDate}, latest {current}. The yearly maxima are in the table below the card.',
    'rk.todayTag': 'Latest {v}',
    'rk.eventsGroup': 'Events',
    'rk.eventAria': '{year}: {title}, vol peak {peak}',
    'rk.meansH': 'What it means',
    'rk.deepen': 'Go deeper in',
    'rk.moveNote': '{move} from {from} to {to}',
    'rk.peakH': 'Peak of 1-month volatility',
    'rk.peakSub': 'Peak on {date} · latest {today}',
    'rk.peakRecord': 'Highest value since {year}',
    'rk.tableShow': 'Data as a table',
    'rk.tableHide': 'Hide the table',
    'rk.tableCaption':
      'Yearly maxima of the realised 1-month volatility of {pair} (daily values since {year})',
    'rk.colYear': 'Year',
    'rk.colMax': 'Highest vol',
    'rk.colDate': 'Date',
    'rk.colLevel': 'Level',
    'rk.footData':
      'Data: ECB reference rates, published on working days around 16:00 CET; USD/CHF and USD/JPY as cross rates via the euro.',
    'rk.footMethod':
      'Realised volatility: standard deviation of {window} daily log returns (zero mean), annualised with √{ann}, shown as weekly values in the chart. Levels by percentiles of all daily values since {year}, per pair: {levels}.',
    'rk.footLevels':
      '{l1} below P{p1}, {l2} up to P{p2}, {l3} up to P{p3}, {l4} up to P{p4}, {l5} from P{p4}',
    'rk.footDisclaimer': 'For educational purposes only. Not investment advice.',
    'rk.footLink': 'Methodology and sources',
  },
});
