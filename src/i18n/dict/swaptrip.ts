/** UI strings of the SwapTrip island (module 03, section 1). */
import { defineDict } from '../types';

export const swaptrip = defineDict({
  de: {
    'trip.title': 'Einen Monat lang Dollar',
    'trip.sub':
      'USD {notional} heute kaufen zu {near}, nach {days} Tagen zurück zu {far} · Zins CHF {rd}, USD {rf}',
    'trip.chip.idle': 'Bereit',
    'trip.chip.running': 'Tag {day} von {days}',
    'trip.chip.done': 'Swap-Ergebnis fix: {swap}',
    'trip.legend.spot': 'Spot USD/CHF (Modellpfad)',
    'trip.legend.swap': 'Swap: beide Kurse heute fixiert',
    'trip.legend.open': 'Ohne Swap: offenes Ergebnis',
    'trip.y': 'USD/CHF',
    'trip.x': 'Tage ab heute',
    'trip.near': 'Near Leg {rate}',
    'trip.far': 'Far Leg {rate}',
    'trip.openLabel': 'ohne Swap {chf}',
    'trip.play': 'Abspielen',
    'trip.pause': 'Pause',
    'trip.replay': 'Nochmals',
    'trip.reseed': 'Neuer Kurspfad',
    'trip.slider.day': 'Tag im Monat',
    'trip.day.value': 'Tag {day}',
    'trip.row.spot': 'Spot an Tag {day}',
    'trip.row.spotSub': 'Modellpfad mit Vola {vol}',
    'trip.row.open': 'Ohne Swap',
    'trip.row.openSub': 'Heute Spot kaufen, später Spot verkaufen',
    'trip.row.swap': 'Mit FX Swap',
    'trip.row.swapSub': 'Steht seit Tag 0 fest',
    'trip.legs.near': 'Heute · Near Leg',
    'trip.legs.far': 'Tag {days} · Far Leg',
    'trip.legs.buy': 'Du kaufst USD zu {rate}',
    'trip.legs.sell': 'Du verkaufst USD zu {rate}',
    'trip.legs.net': 'Netto {chf}: der Preis für {days} Tage Dollar.',
    'trip.insight.idle':
      'Drück auf Abspielen: Der Spot läuft einen Monat lang. Achte rechts auf die zwei Ergebnisse.',
    'trip.insight.running':
      'Tag {day}: Spot {spot}. Ohne Swap stündest du bei {open}. Mit Swap bleibt es bei {swap}.',
    'trip.aha.title': 'Das Kursrisiko ist weg. Der Preis bleibt.',
    'trip.aha.text':
      'Der Spot lief auf {spot}, also {move} Pips. Ohne Swap wären es {open}. Mit Swap sind es {swap}, bei jedem Pfad: Das ist die Zinsdifferenz, kein Kursrisiko.',
    'trip.aria':
      'Spot-Pfad über {days} Tage. Tag {day}: Spot {spot}. Ohne Swap {open}, mit Swap {swap}. Near Leg zu {near}, Far Leg zu {far}.',
    'trip.hint':
      'Zieh am Regler, um durch den Monat zu spulen. Ein neuer Kurspfad ändert nur das Ergebnis ohne Swap.',
    'trip.live.done': 'Tag {days} erreicht. Ohne Swap {open}, mit Swap {swap}.',
  },
  en: {
    'trip.title': 'Dollars for one month',
    'trip.sub':
      'Buy USD {notional} today at {near}, back after {days} days at {far} · Rates CHF {rd}, USD {rf}',
    'trip.chip.idle': 'Ready',
    'trip.chip.running': 'Day {day} of {days}',
    'trip.chip.done': 'Swap result fixed: {swap}',
    'trip.legend.spot': 'Spot USD/CHF (model path)',
    'trip.legend.swap': 'Swap: both rates fixed today',
    'trip.legend.open': 'Without swap: open result',
    'trip.y': 'USD/CHF',
    'trip.x': 'Days from today',
    'trip.near': 'Near leg {rate}',
    'trip.far': 'Far leg {rate}',
    'trip.openLabel': 'no swap {chf}',
    'trip.play': 'Play',
    'trip.pause': 'Pause',
    'trip.replay': 'Again',
    'trip.reseed': 'New rate path',
    'trip.slider.day': 'Day of the month',
    'trip.day.value': 'Day {day}',
    'trip.row.spot': 'Spot on day {day}',
    'trip.row.spotSub': 'Model path with vol {vol}',
    'trip.row.open': 'Without swap',
    'trip.row.openSub': 'Buy spot today, sell spot later',
    'trip.row.swap': 'With FX swap',
    'trip.row.swapSub': 'Fixed since day 0',
    'trip.legs.near': 'Today · near leg',
    'trip.legs.far': 'Day {days} · far leg',
    'trip.legs.buy': 'You buy USD at {rate}',
    'trip.legs.sell': 'You sell USD at {rate}',
    'trip.legs.net': 'Net {chf}: the price of {days} days in dollars.',
    'trip.insight.idle':
      'Press play: the spot runs for a month. Watch the two results on the right.',
    'trip.insight.running':
      'Day {day}: spot {spot}. Without the swap you would be at {open}. With the swap it stays at {swap}.',
    'trip.aha.title': 'The FX risk is gone. The price remains.',
    'trip.aha.text':
      'The spot moved to {spot}, that is {move} pips. Without the swap: {open}. With the swap: {swap}, on every path. That is the interest differential, not FX risk.',
    'trip.aria':
      'Spot path over {days} days. Day {day}: spot {spot}. Without swap {open}, with swap {swap}. Near leg at {near}, far leg at {far}.',
    'trip.hint':
      'Drag the slider to scrub through the month. A new rate path only changes the result without the swap.',
    'trip.live.done': 'Day {days} reached. Without swap {open}, with swap {swap}.',
  },
});
