/** UI strings of the GapReplay island (module 07, section 4). */
import { defineDict } from '../types';

export const gapreplay = defineDict({
  de: {
    'gr.title': 'Frankenschock: hypothetisches Szenario mit täglichen EZB-Referenzkursen',
    'gr.sub':
      'EUR/CHF vom {from} bis {to}, ein Fixing pro Arbeitstag. Referenzkurse sind keine handelbaren Preise.',
    'gr.play': 'Abspielen',
    'gr.pause': 'Pause',
    'gr.replay': 'Nochmals abspielen',
    'gr.slider': 'Tag',
    'gr.sliderValue': '{date} · {rate}',
    'gr.floor': 'Mindestkurs {v} (seit {since})',
    'gr.floorEnded': 'Mindestkurs {v} ({since} bis {date})',
    'gr.floorShort': 'Mindestkurs {v}',
    'gr.stop': 'Stop-Loss {v}',
    'gr.stopShort': 'Stop {v}',
    'gr.ko': 'KO {v}',
    'gr.gap': 'kein Fixing dazwischen',
    'gr.legend.fix': 'EZB-Fixing EUR/CHF',
    'gr.legend.floor': 'Mindestkurs',
    'gr.legend.orders': 'Stop und Barrieren',
    'gr.aha.t': 'Hypothetisches Szenario',
    'gr.aha.d':
      'Mit täglichen EZB-Referenzkursen trifft ein Fixing alles: Stop zu {v} ausgeführt, {n} Knock-outs erloschen.',
    'gr.table': 'Stop und Barrieren unter dem Markt (hypothetisch, je {notional})',
    'gr.tableSub':
      'Stop-Loss: Verkauf EUR, ausgeführt zum ersten Fixing jenseits des Niveaus. Put-KO: EUR Put / CHF Call, Strike {k}, Barriere täglich gegen das Fixing beobachtet.',
    'gr.col.order': 'Typ',
    'gr.col.level': 'Niveau',
    'gr.col.fill': 'Fixing',
    'gr.col.gap': 'Gap (Pips)',
    'gr.row.stop': 'Stop-Loss',
    'gr.row.ko': 'Put-KO',
    'gr.pending': '–',
    'gr.hero': 'Stop-Loss: Mehrverlust',
    'gr.heroSub': 'gegenüber Ausführung zu {v}, auf {notional}',
    'gr.row.put': 'EUR Put {k}: Schutz weg',
    'gr.row.putSub': 'innerer Wert beim Knock-out',
    'gr.row.move': 'Fixing zu Fixing',
    'gr.row.moveSub': '{from} → {to}',
    'gr.row.low': 'Tiefstes Fixing im Fenster',
    'gr.row.lowSub': 'am {date}',
    'gr.note':
      'EZB-Referenzkurse entstehen einmal pro Arbeitstag ({time}). Die EZB veröffentlicht sie nur zu Informationszwecken, sie sind keine handelbaren Preise. Was zwischen zwei Fixings gehandelt wurde, zeigt diese Reihe nicht. Vereinfachung: Der Stop wird zum ersten Fixing jenseits des Niveaus ausgeführt. Ein Knock-out ist keine Transaktion, die Option erlischt. Stop und Barrieren sind Beispiele, keine Marktdaten.',
    'gr.link': 'Frankenschock im Riskometer ansehen',
    'gr.summary': '{date}: EUR/CHF {rate}. {status}',
    'gr.status.before':
      'Hypothetisches Szenario mit täglichen EZB-Referenzkursen. Der Mindestkurs hält: kein Stop ausgeführt, keine Barriere berührt.',
    'gr.status.after':
      'Hypothetisches Szenario mit täglichen EZB-Referenzkursen. Am {date} fällt das Fixing von {before} auf {shock} ({move}). Der Stop-Loss {stop} wird vereinfacht zu diesem Fixing ausgeführt, Mehrverlust {slip}. Die {n} Knock-out-Barrieren von {koHigh} bis {koLow} werden täglich gegen das Fixing beobachtet: Alle knocken mit demselben Fixing aus, die Optionen erlöschen.',
    'gr.aria':
      'EUR/CHF-Fixings der EZB mit Mindestkurs, Stop-Loss und Knock-out-Barrieren. {summary}',
  },
  en: {
    'gr.title': 'The franc shock: a hypothetical scenario with daily ECB reference rates',
    'gr.sub':
      'EUR/CHF from {from} to {to}, one fixing per business day. Reference rates are not tradable prices.',
    'gr.play': 'Play',
    'gr.pause': 'Pause',
    'gr.replay': 'Play again',
    'gr.slider': 'Day',
    'gr.sliderValue': '{date} · {rate}',
    'gr.floor': 'Minimum rate {v} (since {since})',
    'gr.floorEnded': 'Minimum rate {v} ({since} to {date})',
    'gr.floorShort': 'Minimum rate {v}',
    'gr.stop': 'Stop-loss {v}',
    'gr.stopShort': 'Stop {v}',
    'gr.ko': 'KO {v}',
    'gr.gap': 'no fixing in between',
    'gr.legend.fix': 'ECB fixing EUR/CHF',
    'gr.legend.floor': 'Minimum rate',
    'gr.legend.orders': 'Stop and barriers',
    'gr.aha.t': 'Hypothetical scenario',
    'gr.aha.d':
      'With daily ECB reference rates, one fixing hits everything: stop filled at {v}, {n} knock-outs extinguished.',
    'gr.table': 'Stop and barriers below the market (hypothetical, {notional} each)',
    'gr.tableSub':
      'Stop-loss: sell EUR, filled at the first fixing beyond the level. Put KO: EUR put / CHF call, strike {k}, barrier observed daily against the fixing.',
    'gr.col.order': 'Type',
    'gr.col.level': 'Level',
    'gr.col.fill': 'Fixing',
    'gr.col.gap': 'Gap (pips)',
    'gr.row.stop': 'Stop-loss',
    'gr.row.ko': 'Put KO',
    'gr.pending': '–',
    'gr.hero': 'Stop-loss: extra loss',
    'gr.heroSub': 'compared with a fill at {v}, on {notional}',
    'gr.row.put': 'EUR put {k}: protection gone',
    'gr.row.putSub': 'intrinsic value at the knock-out',
    'gr.row.move': 'Fixing to fixing',
    'gr.row.moveSub': '{from} → {to}',
    'gr.row.low': 'Lowest fixing in the window',
    'gr.row.lowSub': 'on {date}',
    'gr.note':
      'ECB reference rates are set once per business day ({time}). The ECB publishes them for information purposes only; they are not tradable prices. What traded between two fixings is not in this series. Simplification: the stop is filled at the first fixing beyond the level. A knock-out is not a transaction; the option is extinguished. The stop and the barriers are examples, not market data.',
    'gr.link': 'See the franc shock in the Riskometer',
    'gr.summary': '{date}: EUR/CHF {rate}. {status}',
    'gr.status.before':
      'Hypothetical scenario with daily ECB reference rates. The floor holds: no stop filled, no barrier touched.',
    'gr.status.after':
      'Hypothetical scenario with daily ECB reference rates. On {date} the fixing falls from {before} to {shock} ({move}). As a simplification, the stop-loss at {stop} is filled at this fixing; extra loss {slip}. The {n} knock-out barriers from {koHigh} to {koLow} are observed daily against the fixing: all knock out on the same fixing, and the options are extinguished.',
    'gr.aria':
      'ECB EUR/CHF fixings with the minimum rate, a stop-loss and knock-out barriers. {summary}',
  },
});
