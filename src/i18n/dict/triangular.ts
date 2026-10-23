import { defineDict } from '../types';

/**
 * TriangularArbitrage (module 01, section 3): EUR/USD × USD/CHF against EUR/CHF.
 * Maths in src/lib/fx/arbitrage.ts, setup in src/lib/m01/triangle.ts (teaching values).
 */
export const triangular = defineDict({
  de: {
    title: 'Dreiecksarbitrage',
    sub: 'EUR/USD × USD/CHF gegen EUR/CHF · Rundreise mit EUR {notional} · Kurse zum Lernen',
    chip: 'Kreuzkurs',
    eurusd: 'EUR/USD',
    usdchf: 'USD/CHF',
    eurchf: 'EUR/CHF direkt',
    spreads: 'Bid und Ask',
    'spreads.on': 'mit Spread',
    'spreads.off': 'ohne Spread',
    reset: 'Kurse angleichen',
    quote: '{bid} / {ask}',
    quoteMid: '{mid}',
    direct: 'direkt',
    viaUsd: 'via USD',
    ruler: 'EUR/CHF: direkter Kurs gegen den Kreuzkurs via USD',
    band: 'kein Gewinn',
    implied: 'Kreuzkurs {rate}',
    directQuote: 'direkt',
    gap: '{pips} Pips',
    drag: 'Zieh den direkten EUR/CHF-Kurs auf dem Lineal oder nutze die Regler',
    heroLabel: 'Gewinn je Rundreise',
    heroSub: 'Start und Ende mit EUR {notional}, ohne Gebühren',
    legs: 'Die drei Geschäfte',
    'side.sell': 'verkaufe',
    'side.buy': 'kaufe',
    leg: '{n}. {pair}: {side} {base} zu {rate}',
    legFlow: '{pay} → {receive}',
    noLegs: 'Keine Rundreise lohnt sich, solange der direkte Kurs im Band des Kreuzkurses liegt.',
    'note.none':
      'Die Kurse passen zusammen. Der direkte EUR/CHF-Kurs liegt im Band des Kreuzkurses: Jede Rundreise kostet dich den Spread.',
    'note.sellDirectBuyCross':
      'Der direkte EUR/CHF-Kurs ist zu hoch. Verkaufe EUR direkt gegen CHF, kaufe mit den CHF Dollars und mit den Dollars wieder EUR: Du landest bei {end}.',
    'note.buyDirectSellCross':
      'Der direkte EUR/CHF-Kurs ist zu tief. Verkaufe EUR gegen USD, die USD gegen CHF und kaufe mit den CHF direkt EUR zurück: Du landest bei {end}.',
    noSpreadNote: 'Ohne Spread ist jede noch so kleine Abweichung Gewinn.',
    aria: 'Dreieck EUR, USD, CHF. EUR/USD {eurusd}, USD/CHF {usdchf}, EUR/CHF direkt {eurchf}, Kreuzkurs {implied}. {result}',
    ariaNone: 'Keine Arbitrage.',
    ariaProfit: 'Arbitrage: Gewinn {profit} je Rundreise.',
    rulerAria:
      'Lineal EUR/CHF: Kreuzkurs Bid {ib} bis Ask {ia}, direkter Kurs Bid {db} bis Ask {da}, Abweichung {pips} Pips.',
  },
  en: {
    title: 'Triangular arbitrage',
    sub: 'EUR/USD × USD/CHF against EUR/CHF · round trip with EUR {notional} · rates for learning',
    chip: 'Cross rate',
    eurusd: 'EUR/USD',
    usdchf: 'USD/CHF',
    eurchf: 'EUR/CHF direct',
    spreads: 'Bid and ask',
    'spreads.on': 'with spread',
    'spreads.off': 'without spread',
    reset: 'Align the rates',
    quote: '{bid} / {ask}',
    quoteMid: '{mid}',
    direct: 'direct',
    viaUsd: 'via USD',
    ruler: 'EUR/CHF: direct quote against the cross via USD',
    band: 'no profit',
    implied: 'cross {rate}',
    directQuote: 'direct',
    gap: '{pips} pips',
    drag: 'Drag the direct EUR/CHF quote on the ruler or use the sliders',
    heroLabel: 'Profit per round trip',
    heroSub: 'start and end with EUR {notional}, no fees',
    legs: 'The three trades',
    'side.sell': 'sell',
    'side.buy': 'buy',
    leg: '{n}. {pair}: {side} {base} at {rate}',
    legFlow: '{pay} → {receive}',
    noLegs: 'No round trip pays as long as the direct quote lies inside the band of the cross rate.',
    'note.none':
      'The rates fit together. The direct EUR/CHF quote lies inside the band of the cross rate: every round trip costs you the spread.',
    'note.sellDirectBuyCross':
      'The direct EUR/CHF quote is too high. Sell EUR for CHF directly, buy dollars with the CHF and euros with the dollars: you end with {end}.',
    'note.buyDirectSellCross':
      'The direct EUR/CHF quote is too low. Sell EUR for USD, the USD for CHF and buy EUR back directly with the CHF: you end with {end}.',
    noSpreadNote: 'Without a spread, every deviation, however small, is profit.',
    aria: 'Triangle EUR, USD, CHF. EUR/USD {eurusd}, USD/CHF {usdchf}, EUR/CHF direct {eurchf}, cross {implied}. {result}',
    ariaNone: 'No arbitrage.',
    ariaProfit: 'Arbitrage: profit {profit} per round trip.',
    rulerAria:
      'EUR/CHF ruler: cross bid {ib} to ask {ia}, direct bid {db} to ask {da}, gap {pips} pips.',
  },
});
