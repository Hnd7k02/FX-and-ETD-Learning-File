/**
 * UI strings of the GapReplay island (module 07, section 4). The replay is a hypothetical
 * scenario with daily ECB reference rates: every fill and every knock-out is worded as an
 * assumption, never as a historical trade (tests/unit/gap-replay-wording.test.ts). The options
 * have no rebate; if one is added, it gets its own row next to the lost intrinsic value.
 */
import { defineDict } from '../types';

export const gapreplay = defineDict({
  de: {
    'gr.title': 'Frankenschock: hypothetisches Szenario mit täglichen EZB-Referenzkursen',
    'gr.sub':
      'EUR/CHF vom {from} bis {to}, ein Fixing pro Arbeitstag. Referenzkurse sind keine handelbaren Preise; Stop und Barrieren sind angenommen.',
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
    'gr.legend.orders': 'Stop und Barrieren (angenommen)',
    'gr.aha.t': 'Hypothetisches Szenario',
    'gr.aha.d':
      'Ein Fixing trifft alle Niveaus. Annahme: Stop zu {v} ausgeführt, {n} Knock-outs nach den Bedingungen erloschen.',
    'gr.table': 'Stop und Barrieren unter dem Markt (hypothetisch, je {notional})',
    'gr.tableSub':
      'Annahmen: Der Stop-Loss (Verkauf EUR) gilt zum ersten Fixing jenseits des Niveaus als ausgeführt. Put-KO: EUR Put / CHF Call, Strike {k}, Barriere täglich gegen das Fixing beobachtet, kein Rebate.',
    'gr.col.order': 'Typ',
    'gr.col.level': 'Niveau',
    'gr.col.fill': 'Fixing',
    'gr.col.gap': 'Gap (Pips)',
    'gr.row.stop': 'Stop-Loss',
    'gr.row.ko': 'Put-KO',
    'gr.pending': '–',
    'gr.hero': 'Stop-Loss: Mehrverlust im Szenario',
    'gr.heroSub': 'angenommene Ausführung zum Fixing statt zu {v}, auf {notional}',
    'gr.row.put': 'EUR Put {k}: Schutz weg',
    'gr.row.putSub': 'innerer Wert am Fixing, ohne Rebate',
    'gr.row.move': 'Fixing zu Fixing',
    'gr.row.moveSub': '{from} → {to}',
    'gr.row.low': 'Tiefstes Fixing im Fenster',
    'gr.row.lowSub': 'am {date}',
    'gr.note':
      'EZB-Referenzkurse entstehen einmal pro Arbeitstag ({time}). Die EZB veröffentlicht sie nur zu Informationszwecken, sie sind keine handelbaren Preise. Was zwischen zwei Fixings gehandelt wurde, zeigt diese Reihe nicht. Annahmen des Szenarios: Der Stop gilt zum ersten Fixing jenseits des Niveaus als ausgeführt. Ein Knock-out ist keine Transaktion: Die Option erlischt nach den angenommenen Bedingungen (tägliche Beobachtung gegen das Fixing). Die Optionen haben kein Rebate. Stop und Barrieren sind Beispiele, keine Marktdaten und keine historischen Geschäfte.',
    'gr.link': 'Frankenschock im Riskometer ansehen',
    'gr.summary': '{date}: EUR/CHF {rate}. {status}',
    'gr.status.before':
      'Hypothetisches Szenario mit täglichen EZB-Referenzkursen. Der Mindestkurs hält: Kein Fixing erreicht den Stop oder eine Barriere.',
    'gr.status.after':
      'Hypothetisches Szenario mit täglichen EZB-Referenzkursen. Am {date} fällt das Fixing von {before} auf {shock} ({move}). Annahme: Der Stop-Loss {stop} gilt zu diesem Fixing als ausgeführt, Mehrverlust {slip}. Die {n} Knock-out-Barrieren von {koHigh} bis {koLow} werden täglich gegen das Fixing beobachtet, ohne Rebate: Nach diesen angenommenen Bedingungen erlöschen alle Optionen mit demselben Fixing.',
    'gr.aria':
      'EUR/CHF-Fixings der EZB mit Mindestkurs, angenommenem Stop-Loss und angenommenen Knock-out-Barrieren. {summary}',
  },
  en: {
    'gr.title': 'The franc shock: a hypothetical scenario with daily ECB reference rates',
    'gr.sub':
      'EUR/CHF from {from} to {to}, one fixing per business day. Reference rates are not tradable prices; the stop and the barriers are assumed.',
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
    'gr.legend.orders': 'Stop and barriers (assumed)',
    'gr.aha.t': 'Hypothetical scenario',
    'gr.aha.d':
      'One fixing hits every level. Assumed: stop filled at {v}, {n} knock-outs extinguished under their terms.',
    'gr.table': 'Stop and barriers below the market (hypothetical, {notional} each)',
    'gr.tableSub':
      'Assumptions: the stop-loss (sell EUR) counts as filled at the first fixing beyond the level. Put KO: EUR put / CHF call, strike {k}, barrier observed daily against the fixing, no rebate.',
    'gr.col.order': 'Type',
    'gr.col.level': 'Level',
    'gr.col.fill': 'Fixing',
    'gr.col.gap': 'Gap (pips)',
    'gr.row.stop': 'Stop-loss',
    'gr.row.ko': 'Put KO',
    'gr.pending': '–',
    'gr.hero': 'Stop-loss: extra loss in the scenario',
    'gr.heroSub': 'assumed fill at the fixing instead of at {v}, on {notional}',
    'gr.row.put': 'EUR put {k}: protection gone',
    'gr.row.putSub': 'intrinsic value at the fixing, no rebate',
    'gr.row.move': 'Fixing to fixing',
    'gr.row.moveSub': '{from} → {to}',
    'gr.row.low': 'Lowest fixing in the window',
    'gr.row.lowSub': 'on {date}',
    'gr.note':
      'ECB reference rates are set once per business day ({time}). The ECB publishes them for information purposes only; they are not tradable prices. What traded between two fixings is not in this series. Assumptions of the scenario: the stop counts as filled at the first fixing beyond the level. A knock-out is not a transaction: the option is extinguished under the assumed terms (daily observation against the fixing). The options have no rebate. The stop and the barriers are examples, not market data and not historical trades.',
    'gr.link': 'See the franc shock in the Riskometer',
    'gr.summary': '{date}: EUR/CHF {rate}. {status}',
    'gr.status.before':
      'Hypothetical scenario with daily ECB reference rates. The floor holds: no fixing reaches the stop or a barrier.',
    'gr.status.after':
      'Hypothetical scenario with daily ECB reference rates. On {date} the fixing falls from {before} to {shock} ({move}). Assumption: the stop-loss at {stop} counts as filled at this fixing; extra loss {slip}. The {n} knock-out barriers from {koHigh} to {koLow} are observed daily against the fixing, with no rebate: under these assumed terms all options are extinguished on the same fixing.',
    'gr.aria':
      'ECB EUR/CHF fixings with the minimum rate, an assumed stop-loss and assumed knock-out barriers. {summary}',
  },
});
