import { defineDict } from '../types';

/** "Five levers" figure of module 05, section 1 (GreeksLevers island). */
export const greekslevers = defineDict({
  de: {
    'glv.title': 'Fünf Hebel am Call',
    'glv.sub':
      'Was passiert mit der Prämie, wenn sich genau ein Hebel bewegt und alles andere gleich bleibt?',
    'glv.premium': 'Prämie heute',
    'glv.group': 'Fünf Hebel und ihre Wirkung auf die Prämie',
    'glv.choice': 'Richtung für {lever}',

    'glv.name.spot': 'Spot USD/CHF',
    'glv.name.time': 'Zeit',
    'glv.name.vol': 'Implizite Vola',
    'glv.name.rd': 'CHF-Zins',
    'glv.name.rf': 'USD-Zins',

    'glv.opt.spot.down': '−1 Big Figure',
    'glv.opt.spot.up': '+1 Big Figure',
    'glv.opt.time.day': '1 Tag',
    'glv.opt.time.week': '1 Woche',
    'glv.opt.time.month': '1 Monat',
    'glv.opt.vol.down': '−1 Punkt',
    'glv.opt.vol.up': '+1 Punkt',
    'glv.opt.rate.down': '−1 %',
    'glv.opt.rate.up': '+1 %',

    'glv.why.spot.up': 'Das Recht, USD zu {strike} zu kaufen, wird wertvoller.',
    'glv.why.spot.down': 'Das Recht, USD zu {strike} zu kaufen, verliert an Wert.',
    'glv.why.time': 'Weniger Zeit für eine günstige Bewegung: Der Zeitwert schmilzt.',
    'glv.why.vol.up': 'Grössere Schwankungen: mehr Chance nach oben, der Verlust bleibt begrenzt.',
    'glv.why.vol.down': 'Ruhigerer Markt: Die Chance auf eine grosse Bewegung sinkt.',
    'glv.why.rd.up': 'Der Forward steigt auf {fwd}. Das hilft dem USD Call.',
    'glv.why.rd.down': 'Der Forward sinkt auf {fwd}. Das schadet dem USD Call.',
    'glv.why.rf.up': 'Der Forward sinkt auf {fwd}. Das schadet dem USD Call.',
    'glv.why.rf.down': 'Der Forward steigt auf {fwd}. Das hilft dem USD Call.',

    'glv.more': 'teurer',
    'glv.less': 'billiger',
    'glv.estimate.spot': 'Delta und Gamma schätzen {v}',
    'glv.estimate.time': 'Theta schätzt {v}',
    'glv.estimate.vol': 'Vega schätzt {v}',
    'glv.estimate.rd': 'Rho CHF schätzt {v}',
    'glv.estimate.rf': 'Rho USD schätzt {v}',
    'glv.bar': '{lever}: Prämie {v}, {dir}',
    'glv.summary':
      'Wirkung einzelner Hebel auf die Prämie von {premium}: {list}. Die Greeks schätzen jede Änderung aus der aktuellen Steigung; die Balken zeigen die exakte Neubewertung.',
  },
  en: {
    'glv.title': 'Five levers on the call',
    'glv.sub':
      'What happens to the premium when exactly one lever moves and everything else stays put?',
    'glv.premium': 'Premium today',
    'glv.group': 'Five levers and their effect on the premium',
    'glv.choice': 'Direction for {lever}',

    'glv.name.spot': 'Spot USD/CHF',
    'glv.name.time': 'Time',
    'glv.name.vol': 'Implied vol',
    'glv.name.rd': 'CHF rate',
    'glv.name.rf': 'USD rate',

    'glv.opt.spot.down': '−1 big figure',
    'glv.opt.spot.up': '+1 big figure',
    'glv.opt.time.day': '1 day',
    'glv.opt.time.week': '1 week',
    'glv.opt.time.month': '1 month',
    'glv.opt.vol.down': '−1 point',
    'glv.opt.vol.up': '+1 point',
    'glv.opt.rate.down': '−1%',
    'glv.opt.rate.up': '+1%',

    'glv.why.spot.up': 'The right to buy USD at {strike} becomes more valuable.',
    'glv.why.spot.down': 'The right to buy USD at {strike} loses value.',
    'glv.why.time': 'Less time for a favourable move: the time value melts.',
    'glv.why.vol.up': 'Bigger swings: more upside, while the loss stays capped.',
    'glv.why.vol.down': 'A calmer market: the chance of a big move shrinks.',
    'glv.why.rd.up': 'The forward rises to {fwd}. That helps the USD call.',
    'glv.why.rd.down': 'The forward falls to {fwd}. That hurts the USD call.',
    'glv.why.rf.up': 'The forward falls to {fwd}. That hurts the USD call.',
    'glv.why.rf.down': 'The forward rises to {fwd}. That helps the USD call.',

    'glv.more': 'dearer',
    'glv.less': 'cheaper',
    'glv.estimate.spot': 'Delta and gamma estimate {v}',
    'glv.estimate.time': 'Theta estimates {v}',
    'glv.estimate.vol': 'Vega estimates {v}',
    'glv.estimate.rd': 'Rho CHF estimates {v}',
    'glv.estimate.rf': 'Rho USD estimates {v}',
    'glv.bar': '{lever}: premium {v}, {dir}',
    'glv.summary':
      'Effect of single levers on the premium of {premium}: {list}. The Greeks estimate each change from the current slope; the bars show the exact repricing.',
  },
});
