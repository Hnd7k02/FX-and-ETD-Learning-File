import { defineDict } from '../types';

/**
 * OrderDemo (module 01, section 3): market, limit and stop-loss orders with gap risk.
 * Paths and levels come from ORDER_DEMO in src/lib/m01/orders.ts (schematic).
 */
export const orderdemo = defineDict({
  de: {
    title: 'Market, Limit, Stop-Loss',
    sub: 'Der Importeur kauft USD {notional} innert zwei Wochen · Kurse schematisch',
    type: 'Ordertyp',
    'type.market': 'Market',
    'type.limit': 'Limit',
    'type.stop': 'Stop-Loss',
    scenario: 'Markt',
    'scenario.calm': 'Ruhig',
    'scenario.gap': 'Gap übers Wochenende',
    level: '{type}-Kurs',
    y: '{pair}, Ask',
    weekend: 'Wochenende',
    days: 'Mo,Di,Mi,Do,Fr,Mo,Di,Mi,Do,Fr',
    askLine: 'Ask: dein Kaufkurs',
    levelLabel: '{type} {rate}',
    fillLabel: 'ausgeführt {rate}',
    endLabel: 'Kauf am Zahltag {rate}',
    slipLabel: '{pips} Pips schlechter',
    drag: 'Zieh die gestrichelte Linie, direkt im Chart oder am Regler',
    heroLabel: 'Kaufkurs',
    heroSub: '{cost} für USD {notional}',
    rowFilled: 'Order ausgeführt',
    yes: 'ja',
    no: 'nein',
    rowDay: 'wann',
    dayN: 'Tag {n}',
    rowSlip: 'gegenüber dem Order-Kurs',
    rowVsMarket: 'gegenüber Market am Tag 1',
    pipsValue: '{pips} Pips',
    'note.market':
      'Sofort ausgeführt zum aktuellen Ask, {rate}. Die Ausführung ist sicher, den Kurs nimmst du, wie er ist.',
    'note.limitFilled':
      'Der Ask fiel auf dein Limit: gekauft zu {rate}. Das sind {diff} gegenüber der Market Order am ersten Tag.',
    'note.limitGapFilled':
      'Der Markt ist durch dein Limit gesprungen: gekauft zu {rate}, sogar besser als das Limit.',
    'note.limitMissed':
      'Der Markt hat dein Limit nie erreicht. Der Kurs wäre sicher gewesen, die Ausführung war es nicht: Am Zahltag kauft der Importeur zu {rate}, {diff} gegenüber der Market Order.',
    'note.stopFilled':
      'Der Stop wurde bei {level} ausgelöst und im ruhigen Markt praktisch zum Stop-Kurs ausgeführt. Er begrenzt das Risiko nach oben.',
    'note.stopGap':
      'Gap! Am Freitag lag der Ask bei {friday}, am Montag öffnete der Markt bei {monday}. Dein Stop bei {level} wurde ausgelöst, aber zum ersten verfügbaren Kurs ausgeführt: {pips} Pips schlechter, {slipChf} mehr. Ein Stop-Loss ist kein garantierter Kurs.',
    'note.stopMissed':
      'Der Ask hat deinen Stop nie erreicht. Am Zahltag kauft der Importeur zum dann gültigen Ask, {rate}.',
    aria: 'Kursverlauf {pair} (Ask) über zwei Wochen, {scenario}. {type}{levelText}: {result}.',
    ariaLevel: ' bei {rate}',
    ariaFilled: 'ausgeführt an Tag {n} zu {rate}',
    ariaMissed: 'nicht ausgeführt, Kauf am Zahltag zu {rate}',
  },
  en: {
    title: 'Market, limit, stop-loss',
    sub: 'The importer buys USD {notional} within two weeks · rates schematic',
    type: 'Order type',
    'type.market': 'Market',
    'type.limit': 'Limit',
    'type.stop': 'Stop-loss',
    scenario: 'Market',
    'scenario.calm': 'Calm',
    'scenario.gap': 'Gap over the weekend',
    level: '{type} rate',
    y: '{pair}, ask',
    weekend: 'Weekend',
    days: 'Mon,Tue,Wed,Thu,Fri,Mon,Tue,Wed,Thu,Fri',
    askLine: 'Ask: your buying rate',
    levelLabel: '{type} {rate}',
    fillLabel: 'filled {rate}',
    endLabel: 'bought on payment day {rate}',
    slipLabel: '{pips} pips worse',
    drag: 'Drag the dashed line, on the chart or with the slider',
    heroLabel: 'Buying rate',
    heroSub: '{cost} for USD {notional}',
    rowFilled: 'Order filled',
    yes: 'yes',
    no: 'no',
    rowDay: 'when',
    dayN: 'day {n}',
    rowSlip: 'versus the order rate',
    rowVsMarket: 'versus market on day 1',
    pipsValue: '{pips} pips',
    'note.market':
      'Filled at once at the current ask, {rate}. Execution is certain; you take the rate as it is.',
    'note.limitFilled':
      'The ask fell to your limit: bought at {rate}. That is {diff} versus the market order on day one.',
    'note.limitGapFilled':
      'The market jumped through your limit: bought at {rate}, even better than the limit.',
    'note.limitMissed':
      'The market never reached your limit. The rate would have been certain, the execution was not: on payment day the importer buys at {rate}, {diff} versus the market order.',
    'note.stopFilled':
      'The stop was triggered at {level} and, in a calm market, filled practically at the stop rate. It caps the risk on the upside.',
    'note.stopGap':
      'Gap! On Friday the ask stood at {friday}, on Monday the market opened at {monday}. Your stop at {level} was triggered but filled at the first available rate: {pips} pips worse, {slipChf} more. A stop-loss is not a guaranteed rate.',
    'note.stopMissed':
      'The ask never reached your stop. On payment day the importer buys at the ask of that day, {rate}.',
    aria: '{pair} rate (ask) over two weeks, {scenario}. {type}{levelText}: {result}.',
    ariaLevel: ' at {rate}',
    ariaFilled: 'filled on day {n} at {rate}',
    ariaMissed: 'not filled, bought on payment day at {rate}',
  },
});
