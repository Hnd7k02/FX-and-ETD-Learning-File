import { defineDict } from '../types';

/**
 * Greeks lab (GreeksLab island). German texts follow the approved prototype
 * (docs/design/GreeksLab.dc.html); numbers are placeholders filled from the calculation core.
 */
export const greekslab = defineDict({
  de: {
    'gl.title': 'Greeks-Labor',
    'gl.sub': '{option} · Strike {strike} · Nominal {notional} · Zins CHF {rd}, USD {rf}',
    'gl.option': 'USD Call / CHF Put',
    'gl.money.atmf': 'Forward entspricht dem Strike',
    'gl.money.itm': 'Forward {pips} Pips über dem Strike',
    'gl.money.otm': 'Forward {pips} Pips unter dem Strike',

    'gl.head.priceSpot': 'Preis V(S) in Pips',
    'gl.head.delta': 'Delta Δ(S)',
    'gl.head.priceVol': 'Preis V(σ) in Pips',
    'gl.head.vega': 'Vega ν(S) in CHF je Vola-Punkt',
    'gl.head.priceTime': 'Preis V(t) in Pips',
    'gl.head.theta': 'Theta Θ(t) in CHF pro Tag',
    'gl.head.priceRd': 'Preis in Pips je CHF-Zins',
    'gl.head.priceRf': 'Preis in Pips je USD-Zins',
    'gl.head.ghost': 'Beispiel: {months}M, Vola {vol}',
    'gl.pill.slope': 'Steigung der Tangente',
    'gl.pill.slopeShort': 'Steigung',

    'gl.unit.pipsPerVol': 'Pips je Vola-Punkt',
    'gl.unit.pipsPerDay': 'Pips pro Tag',
    'gl.unit.pipsPerPct': 'Pips je +1 %',
    'gl.unit.perVol': 'je Vola-Punkt',
    'gl.unit.perDay': 'pro Tag',
    'gl.unit.perPctChf': 'je +1 % CHF-Zins',
    'gl.unit.perPctUsd': 'je +1 % USD-Zins',
    'gl.unit.slopePrice': 'Steigung der Preiskurve',
    'gl.unit.perBigFigure': '{v} Δ je Big Figure',

    'gl.slider.spot': 'Spot USD/CHF',
    'gl.slider.weeks': 'Laufzeit',
    'gl.slider.vol': 'Implizite Vola',
    'gl.slider.rd': 'Zins CHF',
    'gl.slider.rf': 'Zins USD',
    'gl.weeks.one': '1 Woche',
    'gl.weeks.n': '{n} Wochen',
    'gl.weeks.threeMonths': '{n} Wochen (3M)',
    'gl.weeks.year': '1 Jahr',
    'gl.reset': 'Zurück zum Beispiel',

    'gl.table': 'Prämie und Greeks auf {notional}',
    'gl.premium': 'Prämie',
    'gl.premiumPips': '{v} Pips',
    'gl.premiumChf': '{chf} auf {notional}',
    'gl.name.delta': 'Delta',
    'gl.name.gamma': 'Gamma',
    'gl.name.vega': 'Vega',
    'gl.name.theta': 'Theta',
    'gl.name.rhoD': 'Rho CHF',
    'gl.name.rhoF': 'Rho USD',

    'gl.check.title': 'Numerischer Check',
    'gl.check.gamma': 'mit h = 1 Pip. Deckt sich mit der Formel Γ = {v}.',
    'gl.check.vega':
      'je Vola-Punkt auf {notional}, mit h = 0.01 Vola-Punkte. Deckt sich mit der Formel ν = {v}.',
    'gl.check.theta':
      'pro Tag, mit h = 0.0001 Jahre (knapp eine Stunde). Deckt sich mit der Formel Θ / 365 = {v}. Die Tabelle zeigt den ganzen Tag, V(T − 1 Tag) − V(T) = {day}.',
    'gl.check.rho':
      'je +1 % auf {notional}, mit h = 0.01 %. Deckt sich mit den Formeln für Rho CHF ({d}) und Rho USD ({f}).',

    'gl.axis.spot': 'Spot USD/CHF',
    'gl.axis.vol': 'Implizite Vola',
    'gl.axis.days': 'Restlaufzeit',
    'gl.axis.rd': 'Zins CHF',
    'gl.axis.rf': 'Zins USD',
    'gl.tick.months': '{n}M',
    'gl.tick.expiry': 'Verfall',
    'gl.ref.strike': 'Strike',
    'gl.ref.equalTop': '= USD-Zins',
    'gl.ref.equalBottom': '= CHF-Zins',
    'gl.ref.payoff': 'Wert bei Verfall',

    'gl.aha.gammaPeak.t': 'Gamma am grössten',
    'gl.aha.gammaPeak.d': 'Delta kippt hier am schnellsten',
    'gl.aha.deltaHigh.t': 'Forward-Delta gegen 1',
    'gl.aha.deltaHigh.d': 'Der Call wird zum Forward',
    'gl.aha.deltaLow.t': 'Delta Richtung 0',
    'gl.aha.deltaLow.d': 'Der Call reagiert kaum noch',
    'gl.aha.vegaPeak.t': 'Vega am grössten',
    'gl.aha.vegaPeak.d': 'Forward nahe am Strike',
    'gl.aha.thetaAccel.t': 'Theta beschleunigt',
    'gl.aha.thetaAccel.d': 'Der Zeitwert schmilzt jetzt schnell',
    'gl.aha.thetaPositive.t': 'Theta positiv',
    'gl.aha.thetaPositive.d': 'Der Zins-Carry überwiegt',
    'gl.aha.equalRates.t': 'Gleiche Zinsen',
    'gl.aha.equalRates.d': 'Forward = Spot',

    'gl.hint': 'Tipp: Zieh den schwarzen Punkt direkt im Chart.',

    'gl.aria.dg.top':
      'Preis des Calls in Abhängigkeit vom Spot, mit Tangente bei {x}: Steigung Delta {v}',
    'gl.aria.dg.bottom': 'Delta in Abhängigkeit vom Spot, mit Tangente bei {x}: Steigung Gamma {v}',
    'gl.aria.vega.top':
      'Preis des Calls in Abhängigkeit von der impliziten Vola, mit Tangente bei {x}: Steigung Vega {v} Pips je Vola-Punkt',
    'gl.aria.vega.bottom':
      'Vega in Abhängigkeit vom Spot: {v} je Vola-Punkt bei Spot {x}, Maximum bei Spot {peak}',
    'gl.aria.theta.top':
      'Preis des Calls in Abhängigkeit von der Restlaufzeit, mit Tangente bei {x}: Steigung Theta {v} Pips pro Tag',
    'gl.aria.theta.bottom': 'Theta pro Tag in Abhängigkeit von der Restlaufzeit: {v} bei {x}',
    'gl.aria.rho.top':
      'Preis des Calls in Abhängigkeit vom CHF-Zins, mit Tangente bei {x}: Steigung Rho CHF {v} Pips je +1 %',
    'gl.aria.rho.bottom':
      'Preis des Calls in Abhängigkeit vom USD-Zins, mit Tangente bei {x}: Steigung Rho USD {v} Pips je +1 %',
    'gl.aria.peakOutside': 'ausserhalb des Charts',
    'gl.summary':
      'Greeks-Labor, {mode}. Spot {spot}, Laufzeit {weeks}, Vola {vol}, Zins CHF {rd}, USD {rf}. {money}. Prämie {pips} Pips, {chf}. Delta {delta}, Gamma {gamma}, Vega {vega}, Theta {theta} pro Tag, Rho CHF {rhoD}, Rho USD {rhoF}.',
    'gl.mode.dg': 'Delta und Gamma',
    'gl.mode.vega': 'Vega',
    'gl.mode.theta': 'Theta',
    'gl.mode.rho': 'Rho',
  },
  en: {
    'gl.title': 'Greeks lab',
    'gl.sub': '{option} · strike {strike} · notional {notional} · rates CHF {rd}, USD {rf}',
    'gl.option': 'USD call / CHF put',
    'gl.money.atmf': 'Forward equals the strike',
    'gl.money.itm': 'Forward {pips} pips above the strike',
    'gl.money.otm': 'Forward {pips} pips below the strike',

    'gl.head.priceSpot': 'Price V(S) in pips',
    'gl.head.delta': 'Delta Δ(S)',
    'gl.head.priceVol': 'Price V(σ) in pips',
    'gl.head.vega': 'Vega ν(S) in CHF per vol point',
    'gl.head.priceTime': 'Price V(t) in pips',
    'gl.head.theta': 'Theta Θ(t) in CHF per day',
    'gl.head.priceRd': 'Price in pips vs CHF rate',
    'gl.head.priceRf': 'Price in pips vs USD rate',
    'gl.head.ghost': 'Example: {months}M, vol {vol}',
    'gl.pill.slope': 'Slope of the tangent',
    'gl.pill.slopeShort': 'Slope',

    'gl.unit.pipsPerVol': 'pips per vol point',
    'gl.unit.pipsPerDay': 'pips per day',
    'gl.unit.pipsPerPct': 'pips per +1%',
    'gl.unit.perVol': 'per vol point',
    'gl.unit.perDay': 'per day',
    'gl.unit.perPctChf': 'per +1% CHF rate',
    'gl.unit.perPctUsd': 'per +1% USD rate',
    'gl.unit.slopePrice': 'Slope of the price curve',
    'gl.unit.perBigFigure': '{v} Δ per big figure',

    'gl.slider.spot': 'Spot USD/CHF',
    'gl.slider.weeks': 'Time to expiry',
    'gl.slider.vol': 'Implied vol',
    'gl.slider.rd': 'CHF rate',
    'gl.slider.rf': 'USD rate',
    'gl.weeks.one': '1 week',
    'gl.weeks.n': '{n} weeks',
    'gl.weeks.threeMonths': '{n} weeks (3M)',
    'gl.weeks.year': '1 year',
    'gl.reset': 'Back to the example',

    'gl.table': 'Premium and Greeks on {notional}',
    'gl.premium': 'Premium',
    'gl.premiumPips': '{v} pips',
    'gl.premiumChf': '{chf} on {notional}',
    'gl.name.delta': 'Delta',
    'gl.name.gamma': 'Gamma',
    'gl.name.vega': 'Vega',
    'gl.name.theta': 'Theta',
    'gl.name.rhoD': 'Rho CHF',
    'gl.name.rhoF': 'Rho USD',

    'gl.check.title': 'Numerical check',
    'gl.check.gamma': 'with h = 1 pip. Matches the formula Γ = {v}.',
    'gl.check.vega':
      'per vol point on {notional}, with h = 0.01 vol points. Matches the formula ν = {v}.',
    'gl.check.theta':
      'per day, with h = 0.0001 years (just under an hour). Matches the formula Θ / 365 = {v}. The table shows the full day, V(T − 1 day) − V(T) = {day}.',
    'gl.check.rho':
      'per +1% on {notional}, with h = 0.01%. Matches the formulas for rho CHF ({d}) and rho USD ({f}).',

    'gl.axis.spot': 'Spot USD/CHF',
    'gl.axis.vol': 'Implied vol',
    'gl.axis.days': 'Time to expiry',
    'gl.axis.rd': 'CHF rate',
    'gl.axis.rf': 'USD rate',
    'gl.tick.months': '{n}M',
    'gl.tick.expiry': 'Expiry',
    'gl.ref.strike': 'Strike',
    'gl.ref.equalTop': '= USD rate',
    'gl.ref.equalBottom': '= CHF rate',
    'gl.ref.payoff': 'Value at expiry',

    'gl.aha.gammaPeak.t': 'Gamma at its peak',
    'gl.aha.gammaPeak.d': 'Delta turns fastest here',
    'gl.aha.deltaHigh.t': 'Forward delta nears 1',
    'gl.aha.deltaHigh.d': 'The call becomes a forward',
    'gl.aha.deltaLow.t': 'Delta towards 0',
    'gl.aha.deltaLow.d': 'The call barely reacts',
    'gl.aha.vegaPeak.t': 'Vega at its peak',
    'gl.aha.vegaPeak.d': 'Forward close to the strike',
    'gl.aha.thetaAccel.t': 'Theta accelerates',
    'gl.aha.thetaAccel.d': 'Time value now melts fast',
    'gl.aha.thetaPositive.t': 'Theta positive',
    'gl.aha.thetaPositive.d': 'The rate carry wins',
    'gl.aha.equalRates.t': 'Equal rates',
    'gl.aha.equalRates.d': 'Forward = spot',

    'gl.hint': 'Tip: drag the black dot right on the chart.',

    'gl.aria.dg.top': 'Price of the call against spot, with the tangent at {x}: slope delta {v}',
    'gl.aria.dg.bottom': 'Delta against spot, with the tangent at {x}: slope gamma {v}',
    'gl.aria.vega.top':
      'Price of the call against implied vol, with the tangent at {x}: slope vega {v} pips per vol point',
    'gl.aria.vega.bottom': 'Vega against spot: {v} per vol point at spot {x}, peak at spot {peak}',
    'gl.aria.theta.top':
      'Price of the call against time to expiry, with the tangent at {x}: slope theta {v} pips per day',
    'gl.aria.theta.bottom': 'Theta per day against time to expiry: {v} at {x}',
    'gl.aria.rho.top':
      'Price of the call against the CHF rate, with the tangent at {x}: slope rho CHF {v} pips per +1%',
    'gl.aria.rho.bottom':
      'Price of the call against the USD rate, with the tangent at {x}: slope rho USD {v} pips per +1%',
    'gl.aria.peakOutside': 'outside the chart',
    'gl.summary':
      'Greeks lab, {mode}. Spot {spot}, time to expiry {weeks}, vol {vol}, rates CHF {rd}, USD {rf}. {money}. Premium {pips} pips, {chf}. Delta {delta}, gamma {gamma}, vega {vega}, theta {theta} per day, rho CHF {rhoD}, rho USD {rhoF}.',
    'gl.mode.dg': 'delta and gamma',
    'gl.mode.vega': 'vega',
    'gl.mode.theta': 'theta',
    'gl.mode.rho': 'rho',
  },
});
