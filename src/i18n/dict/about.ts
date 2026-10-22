import { defineDict } from '../types';

/** UI strings of the About & Methodology page and the reset-progress island. */
export const about = defineDict({
  de: {
    'about.title': 'Über Forward First: Methodik, Modelle und Quellen',
    'about.description':
      'Wie Forward First rechnet: Garman-Kohlhagen, Black-76, geschlossene Formeln für Exotics und Monte Carlo. Dazu Daten und Methode des Riskometers, Konventionen und Quellen.',
    'about.crumb': 'Über',
    'about.chip': 'Methodik',
    'about.h1': 'Über Forward First',
    'about.lead':
      'Wie das Tool rechnet, woher die Daten kommen und was es bewusst nicht ist. Für alle, die wissen wollen, warum eine Zahl so ist, wie sie ist.',
    'about.disclaimer': 'Nur zu Bildungszwecken. Keine Anlageberatung.',
    'about.disclaimerText':
      'Forward First erklärt, wie Devisen-Instrumente funktionieren. Es empfiehlt weder Produkte noch Geschäfte. Strukturierte Produkte zeigt es generisch, in Bausteine zerlegt und immer mit einem Verlustszenario.',
    'about.toc': 'Auf dieser Seite',

    'about.what.h': 'Was Forward First ist',
    'about.what.p1':
      'Ein interaktives Lerntool für den Devisenmarkt. Neun aufbauende Module führen dich vom Spot über Forward und FX Swap zu Optionen, den sechs Greeks und exotischen Strukturen.',
    'about.what.p2':
      'Der rote Faden: Alles wird auf den Forward heruntergebrochen. Ein Call ist ein Forward mit Knick, ein Zero-Cost Collar ein Forward mit Spielraum, ein Accumulator eine Serie von Forwards mit Hebel und Knock-out.',
    'about.what.p3':
      'Jede Zahl kommt live aus einem getesteten Rechenkern; nichts ist abgetippt. Das Riskometer zeigt echte Schwankungen aus offiziellen Referenzkursen.',
    'about.what.notH': 'Was es nicht ist',
    'about.what.not1': 'keine Anlageberatung',
    'about.what.not2': 'keine Handelsempfehlungen',
    'about.what.not3': 'keine Echtzeitkurse',
    'about.what.not4': 'keine Produkte eines Anbieters',
    'about.what.familiesH': 'Vier Familien, neun Module',

    'about.example.h': 'Das durchgehende Beispiel',
    'about.example.lead':
      'Alle Module erzählen denselben Fall: Ein Schweizer Importeur muss in {months} Monaten {notional} bezahlen. Er fürchtet einen stärkeren Dollar.',
    'about.example.spot': 'Spot USD/CHF',
    'about.example.forward': 'Forward {months} Monate',
    'about.example.strike': 'Strike (ATMF)',
    'about.example.premium': 'Prämie USD Call',
    'about.example.tableCaption': 'Eingaben und abgeleitete Werte des Beispiels',
    'about.example.colQty': 'Grösse',
    'about.example.colSym': 'Symbol',
    'about.example.colValue': 'Wert',
    'about.example.colNote': 'Herkunft',
    'about.example.pair': 'Währungspaar',
    'about.example.pairNote': 'Base USD, Quote CHF; Preis in CHF je 1 USD',
    'about.example.rd': 'Zins CHF (domestic)',
    'about.example.rf': 'Zins USD (foreign)',
    'about.example.term': 'Laufzeit',
    'about.example.termValue': '{months} Monate',
    'about.example.termNote': 'T = {T} im Optionsmodell; {days} Tage Act/360 am Geldmarkt',
    'about.example.vol': 'Implizite Vola',
    'about.example.fwdCont': 'Forward, stetig',
    'about.example.fwdMm': 'Forward, Geldmarkt',
    'about.example.points': 'Forward Points',
    'about.example.pointsValue': '{pips} Pips',
    'about.example.notional': 'Nominal',
    'about.example.position': 'Position',
    'about.example.positionValue': 'Long USD Call / CHF Put',
    'about.example.premiumValue': '{pips} Pips · {money}',
    'about.example.input': 'Eingabe',
    'about.example.calcStrike': 'Forward, auf 4 Stellen gerundet',
    'about.example.calcPremium': 'Garman-Kohlhagen × Nominal',

    'about.models.h': 'Modelle',
    'about.models.lead':
      'Die Formeln, mit denen der Rechenkern arbeitet. Konvention überall: Paar Base/Quote, r_d ist der Zins der Quote-Währung, r_f der der Base-Währung, T in Jahren.',
    'about.models.fwd.h': 'Forward: Zinsparität',
    'about.models.fwd.p':
      'Zwei gleich sichere Wege zum selben Betrag kosten heute gleich viel. Der Geldmarkt rechnet mit einfachen Zinsen und der Tageszählung jeder Währung, die Optionsmodelle mit stetigen Zinsen. Im Beispiel liegen beide {diff} Pips auseinander.',
    'about.models.gk.h': 'Garman-Kohlhagen',
    'about.models.gk.p':
      'Black-Scholes mit zwei Zinsen: Die Base-Währung wirft ihren Zins r_f ab wie eine Dividende. Damit rechnet das Tool europäische Calls und Puts auf den Spot und die sechs Greeks.',
    'about.models.b76.h': 'Black-76 auf den Forward',
    'about.models.b76.p':
      'Dieselbe Formel, auf den Forward geschrieben. Die Zinsen stecken im Forward, übrig bleiben Forward, Strike, Vola und Laufzeit. Der Wow-Moment und der Zeitwert nutzen diese Form.',
    'about.models.greeks.h': 'Greeks und Parität',
    'about.models.greeks.p':
      'Delta, Gamma, Vega, Theta, Rho domestic und Rho foreign analytisch, dazu ein numerischer Check mit finiten Differenzen. Theta zeigt das Tool als 1-Tages-Differenz V(T − 1/365) − V(T).',
    'about.models.smile.h': 'Vola-Smile',
    'about.models.smile.p':
      'Aus den Quotes ATM, 25Δ Risk Reversal und 25Δ Butterfly entsteht ein Smile, quadratisch im Forward-Delta des Calls. Bei Δ = 0.25 ergibt das ATM + BF + RR/2.',
    'about.models.exotics.h': 'Exotics in geschlossener Form',
    'about.models.exotics.p':
      'Europäische Digitals (Cash-or-Nothing), die acht Single-Barrier-Typen nach Reiner-Rubinstein mit stetiger Beobachtung, One-Touch und No-Touch sowie der Double No-Touch als Reihenformel. Die In-Out-Parität dient als Test.',
    'about.models.mc.h': 'Monte Carlo für pfadabhängige Produkte',
    'about.models.mc.p':
      'Window Barrier, Accumulator, Decumulator, TARF, Pivot TARF, TPF und RTPF haben keine geschlossene Formel. Das Tool simuliert Kurspfade als geometrische Brownsche Bewegung mit Drift r_d − r_f in Tagesschritten.',
    'about.models.mc.seed':
      'Seed-basierter Zufallsgenerator: Jedes Ergebnis ist reproduzierbar.',
    'about.models.mc.anti':
      'Antithetische Pfade: Zu jedem Zufallszug Z läuft auch −Z. Das senkt den Standardfehler.',
    'about.models.mc.bgk':
      'Die Simulation beobachtet einmal pro Tag. Für den Vergleich mit stetigen Formeln verschiebt sie die Barriere nach Broadie-Glasserman-Kou; die Konstante 0.5826 ist −ζ(½)/√(2π).',
    'about.models.mc.out':
      'Faire Strikes und Coupons rechnet ein Skript beim Build und speichert sie mit Pfadanzahl und Standardfehler. Interaktive Szenarien laufen in einem Web Worker.',
    'about.models.normal':
      'Die Normalverteilung N(x) rechnet der Kern mit doppelter Genauigkeit (Fehler unter 1e−14), damit die Tests gegen eine unabhängige Referenz bis auf 1e−10 stimmen.',

    'about.risk.h': 'Riskometer: Daten und Methode',
    'about.risk.lead':
      'Das Riskometer misst, wie stark ein Währungspaar gerade schwankt, und ordnet das in seine eigene Geschichte seit {since} ein.',
    'about.risk.step1.h': 'EZB-Referenzkurse',
    'about.risk.step1.p':
      'Werktags um ca. 16:00 MEZ, abgerufen über die ECB Data Portal API: EUR/CHF, EUR/USD und EUR/JPY.',
    'about.risk.step2.h': 'Paare und Kreuzkurse',
    'about.risk.step2.p':
      'EUR/CHF und EUR/USD kommen direkt von der EZB. Die beiden Dollar-Paare entstehen als Kreuzkurse.',
    'about.risk.step3.h': 'Log-Renditen',
    'about.risk.step3.p': 'Von einem Fixing zum nächsten, als Logarithmus des Kursverhältnisses.',
    'about.risk.step4.h': 'Realisierte Vola',
    'about.risk.step4.p':
      '{window} Log-Renditen ({fixings} Fixings), Mittelwert 0, annualisiert mit √{ann}, in %.',
    'about.risk.step5.h': 'Perzentil und Stufe',
    'about.risk.step5.p':
      'Rang des heutigen Werts unter allen Tageswerten seit {since}, je Paar separat. Daraus folgt eine von fünf Stufen.',
    'about.risk.levelsH': 'Fünf Stufen, festgelegt über Perzentile',
    'about.risk.levelsCaption':
      'Unter P{p1} ruhig, ab P{p4} extrem. Der Anteil zeigt, wie viele Handelstage seit {since} in die Stufe fallen.',
    'about.risk.share': '{pct} der Tage',
    'about.risk.range.first': 'unter P{to}',
    'about.risk.range.mid': 'P{from} bis P{to}',
    'about.risk.range.last': 'ab P{from}',
    'about.risk.thresholdsH': 'Schwellen je Paar',
    'about.risk.thresholdsCaption': 'Realisierte 1-Monats-Vola in %, Tageswerte seit {since}. Stand {asOf}.',
    'about.risk.colPair': 'Paar',
    'about.risk.colMax': 'Maximum',
    'about.risk.detailsH': 'Weitere Details',
    'about.risk.chart':
      'Chart: Wochenwerte (letzter Wert der Woche) seit {since}. Kennzahlen und Stufen rechnen mit Tageswerten.',
    'about.risk.gauge':
      'Tacho: fünf gleich breite Segmente. Die Nadel steht bei Segmentindex plus Anteil innerhalb der Stufe, gemessen in Perzentilen; Extrem reicht bis zum historischen Maximum.',
    'about.risk.events':
      'Ereignisse: Kursbewegung und Vola-Spitze rechnet das Build-Skript aus den Daten; die Spitze ist das Maximum von {before} Handelstagen vor bis {after} Handelstagen nach dem Ereignis.',
    'about.risk.update':
      'Update: Eine GitHub Action holt die Kurse werktags um 15:30 UTC, prüft sie (aufsteigende Daten, keine Duplikate, Kurse über null, letzter Wert höchstens fünf Bankarbeitstage alt, tägliche Log-Rendite unter 10 % mit dokumentierter Ausnahme), rechnet neu, testet und baut die Seite. Nur wenn sich Daten ändern, entsteht ein Commit.',
    'about.risk.caveat':
      'Die EZB veröffentlicht Referenzkurse nur zu Informationszwecken. Das Riskometer ist eine Lernhilfe, kein Risikomodell.',
    'about.risk.asOf': 'Datenstand: {date}',
    'about.risk.open': 'Zum Riskometer',

    'about.conv.h': 'Zahlen und Konventionen',
    'about.conv.lead': 'Wie Zahlen im Tool geschrieben und gerechnet werden.',
    'about.conv.colTopic': 'Thema',
    'about.conv.colRule': 'Regel',
    'about.conv.colSample': 'Beispiel',
    'about.conv.numbers': 'Zahlenformat',
    'about.conv.numbersRule':
      'Schweizer Format (de-CH): Apostroph als Tausendertrenner, Punkt als Dezimalzeichen. Englisch: en-GB.',
    'about.conv.percent': 'Prozent',
    'about.conv.percentRule': 'Mit geschütztem Leerzeichen vor dem Prozentzeichen.',
    'about.conv.minus': 'Vorzeichen',
    'about.conv.minusRule': 'Typografisches Minus statt Bindestrich.',
    'about.conv.rates': 'Kurse',
    'about.conv.ratesRule': '4 Nachkommastellen, JPY-Paare 2.',
    'about.conv.pip': 'Pip',
    'about.conv.pipRule': '0.0001, bei JPY-Paaren 0.01. Eine Big Figure sind 100 Pips.',
    'about.conv.quote': 'Quotierung',
    'about.conv.quoteRule':
      'Paar Base/Quote, Preis in Quote-Währung je 1 Einheit Base. r_d gehört zur Quote-, r_f zur Base-Währung.',
    'about.conv.mm': 'Geldmarkt',
    'about.conv.mmRule': 'Einfache Zinsen, t = Tage / Basis. {act360}: Act/360. {act365}: Act/365.',
    'about.conv.model': 'Optionsmodell',
    'about.conv.modelRule': 'Stetige Zinsen, T = Tage / 365 bzw. Wochen / 52.',
    'about.conv.value': 'Valuta',
    'about.conv.valueRule': 'Spot T+2, USD/CAD T+1.',
    'about.conv.greeks': 'Greeks',
    'about.conv.greeksRule':
      'Auf das Nominal: Vega je Vola-Punkt, Rho je +1 Prozentpunkt, Theta je Kalendertag.',

    'about.sources.h': 'Quellen',
    'about.sources.lead':
      'Marktereignisse, institutionelle Fakten und Statistiken stehen nur mit Quelle im Tool. Lehrbuchwissen braucht keine. {n} Einträge.',
    'about.sources.publisher': 'Herausgeber',
    'about.sources.date': 'Datum',
    'about.sources.supports': 'Belegt',
    'about.sources.open': 'Quelle öffnen',
    'about.sources.newTab': '(öffnet in neuem Tab)',

    'about.credits.h': 'Credits und Datenschutz',
    'about.credits.stack':
      'Gebaut mit Astro, TypeScript und Preact; Charts als handgeschriebenes SVG. Getestet mit Vitest, Playwright und axe.',
    'about.credits.privacy':
      'Dein Lernfortschritt bleibt in deinem Browser (localStorage). Es gibt kein Konto und kein Tracking.',

    'reset.h': 'Fortschritt zurücksetzen',
    'reset.stored': 'Gespeicherter Fortschritt: {pct}',
    'reset.none': 'Noch kein Fortschritt gespeichert.',
    'reset.button': 'Fortschritt zurücksetzen',
    'reset.confirmTitle': 'Wirklich zurücksetzen?',
    'reset.confirmText':
      'Erledigte Abschnitte und Quiz-Ergebnisse in diesem Browser werden gelöscht. Das lässt sich nicht rückgängig machen.',
    'reset.confirm': 'Ja, zurücksetzen',
    'reset.cancel': 'Abbrechen',
    'reset.done': 'Fortschritt zurückgesetzt. Du startest wieder bei 01 Spot.',
    'reset.cancelled': 'Nichts geändert.',
  },
  en: {
    'about.title': 'About Forward First: methodology, models and sources',
    'about.description':
      'How Forward First calculates: Garman-Kohlhagen, Black-76, closed-form exotics and Monte Carlo. Plus the Riskometer’s data and method, conventions and sources.',
    'about.crumb': 'About',
    'about.chip': 'Methodology',
    'about.h1': 'About Forward First',
    'about.lead':
      'How the tool calculates, where the data comes from and what it deliberately is not. For anyone who wants to know why a number is what it is.',
    'about.disclaimer': 'For educational purposes only. Not investment advice.',
    'about.disclaimerText':
      'Forward First explains how FX instruments work. It recommends neither products nor trades. Structured products are shown generically, taken apart into building blocks and always with a loss scenario.',
    'about.toc': 'On this page',

    'about.what.h': 'What Forward First is',
    'about.what.p1':
      'An interactive learning tool for the FX market. Nine modules that build on each other take you from spot through forwards and FX swaps to options, the six Greeks and exotic structures.',
    'about.what.p2':
      'The common thread: everything is reduced to the forward. A call is a forward with a kink, a zero-cost collar a forward with room to move, an accumulator a series of forwards with leverage and a knock-out.',
    'about.what.p3':
      'Every number comes live from a tested calculation core; nothing is typed in. The Riskometer shows real market swings from official reference rates.',
    'about.what.notH': 'What it is not',
    'about.what.not1': 'not investment advice',
    'about.what.not2': 'no trading recommendations',
    'about.what.not3': 'no real-time prices',
    'about.what.not4': 'no provider’s products',
    'about.what.familiesH': 'Four families, nine modules',

    'about.example.h': 'The running example',
    'about.example.lead':
      'Every module tells the same story: a Swiss importer has to pay {notional} in {months} months and fears a stronger dollar.',
    'about.example.spot': 'Spot USD/CHF',
    'about.example.forward': '{months}-month forward',
    'about.example.strike': 'Strike (ATMF)',
    'about.example.premium': 'USD call premium',
    'about.example.tableCaption': 'Inputs and derived values of the example',
    'about.example.colQty': 'Quantity',
    'about.example.colSym': 'Symbol',
    'about.example.colValue': 'Value',
    'about.example.colNote': 'Source',
    'about.example.pair': 'Currency pair',
    'about.example.pairNote': 'Base USD, quote CHF; price in CHF per 1 USD',
    'about.example.rd': 'CHF rate (domestic)',
    'about.example.rf': 'USD rate (foreign)',
    'about.example.term': 'Term',
    'about.example.termValue': '{months} months',
    'about.example.termNote': 'T = {T} in the option model; {days} days Act/360 in the money market',
    'about.example.vol': 'Implied volatility',
    'about.example.fwdCont': 'Forward, continuous',
    'about.example.fwdMm': 'Forward, money market',
    'about.example.points': 'Forward points',
    'about.example.pointsValue': '{pips} pips',
    'about.example.notional': 'Notional',
    'about.example.position': 'Position',
    'about.example.positionValue': 'Long USD call / CHF put',
    'about.example.premiumValue': '{pips} pips · {money}',
    'about.example.input': 'Input',
    'about.example.calcStrike': 'Forward, rounded to 4 decimals',
    'about.example.calcPremium': 'Garman-Kohlhagen × notional',

    'about.models.h': 'Models',
    'about.models.lead':
      'The formulas the calculation core works with. Convention throughout: pair base/quote, r_d is the rate of the quote currency, r_f that of the base currency, T in years.',
    'about.models.fwd.h': 'Forward: interest rate parity',
    'about.models.fwd.p':
      'Two equally safe routes to the same amount cost the same today. The money market uses simple rates and each currency’s day count, the option models continuous rates. In the example the two differ by {diff} pips.',
    'about.models.gk.h': 'Garman-Kohlhagen',
    'about.models.gk.p':
      'Black-Scholes with two interest rates: the base currency pays its rate r_f like a dividend. The tool uses it for European calls and puts on spot and for the six Greeks.',
    'about.models.b76.h': 'Black-76 on the forward',
    'about.models.b76.p':
      'The same formula, written on the forward. The rates are inside the forward, leaving forward, strike, volatility and time. The Wow moment and the time value use this form.',
    'about.models.greeks.h': 'Greeks and parity',
    'about.models.greeks.p':
      'Delta, gamma, vega, theta, rho domestic and rho foreign in closed form, plus a numerical check with finite differences. The tool shows theta as the one-day difference V(T − 1/365) − V(T).',
    'about.models.smile.h': 'Volatility smile',
    'about.models.smile.p':
      'The quotes ATM, 25Δ risk reversal and 25Δ butterfly give a smile that is quadratic in the call’s forward delta. At Δ = 0.25 this yields ATM + BF + RR/2.',
    'about.models.exotics.h': 'Closed-form exotics',
    'about.models.exotics.p':
      'European digitals (cash-or-nothing), the eight single-barrier types after Reiner-Rubinstein with continuous monitoring, one-touch and no-touch, and the double no-touch as a series formula. In-out parity serves as a test.',
    'about.models.mc.h': 'Monte Carlo for path-dependent products',
    'about.models.mc.p':
      'Window barriers, accumulators, decumulators, TARFs, pivot TARFs, TPFs and RTPFs have no closed formula. The tool simulates rate paths as geometric Brownian motion with drift r_d − r_f in daily steps.',
    'about.models.mc.seed': 'Seeded random number generator: every result is reproducible.',
    'about.models.mc.anti':
      'Antithetic paths: for every random draw Z the path with −Z runs as well. This lowers the standard error.',
    'about.models.mc.bgk':
      'The simulation observes once a day. To compare with continuous formulas it shifts the barrier after Broadie-Glasserman-Kou; the constant 0.5826 is −ζ(½)/√(2π).',
    'about.models.mc.out':
      'Fair strikes and coupons are computed by a script at build time and stored with the number of paths and the standard error. Interactive scenarios run in a Web Worker.',
    'about.models.normal':
      'The core computes the normal distribution N(x) in double precision (error below 1e−14), so the tests match an independent reference down to 1e−10.',

    'about.risk.h': 'Riskometer: data and method',
    'about.risk.lead':
      'The Riskometer measures how much a currency pair is swinging right now and places it in its own history since {since}.',
    'about.risk.step1.h': 'ECB reference rates',
    'about.risk.step1.p':
      'On working days around 16:00 CET, fetched via the ECB Data Portal API: EUR/CHF, EUR/USD and EUR/JPY.',
    'about.risk.step2.h': 'Pairs and crosses',
    'about.risk.step2.p':
      'EUR/CHF and EUR/USD come straight from the ECB. The two dollar pairs are derived as cross rates.',
    'about.risk.step3.h': 'Log returns',
    'about.risk.step3.p': 'From one fixing to the next, as the logarithm of the rate ratio.',
    'about.risk.step4.h': 'Realised volatility',
    'about.risk.step4.p':
      '{window} log returns ({fixings} fixings), zero mean, annualised with √{ann}, in %.',
    'about.risk.step5.h': 'Percentile and level',
    'about.risk.step5.p':
      'Rank of today’s value among all daily values since {since}, for each pair separately. This gives one of five levels.',
    'about.risk.levelsH': 'Five levels, set by percentiles',
    'about.risk.levelsCaption':
      'Below P{p1} calm, from P{p4} extreme. The share shows how many trading days since {since} fall into each level.',
    'about.risk.share': '{pct} of days',
    'about.risk.range.first': 'below P{to}',
    'about.risk.range.mid': 'P{from} to P{to}',
    'about.risk.range.last': 'from P{from}',
    'about.risk.thresholdsH': 'Thresholds per pair',
    'about.risk.thresholdsCaption':
      'Realised 1-month volatility in %, daily values since {since}. As of {asOf}.',
    'about.risk.colPair': 'Pair',
    'about.risk.colMax': 'Maximum',
    'about.risk.detailsH': 'More details',
    'about.risk.chart':
      'Chart: weekly values (last value of the week) since {since}. Statistics and levels use daily values.',
    'about.risk.gauge':
      'Gauge: five segments of equal width. The needle sits at the segment index plus the share within the level, measured in percentiles; Extreme runs up to the historical maximum.',
    'about.risk.events':
      'Events: the move and the volatility peak are computed by the build script from the data; the peak is the maximum from {before} trading days before to {after} trading days after the event.',
    'about.risk.update':
      'Updates: a GitHub Action fetches the rates on weekdays at 15:30 UTC, validates them (ascending dates, no duplicates, rates above zero, last value at most five business days old, daily log return below 10% with a documented exception), recalculates, tests and builds the site. A commit is only made when the data changes.',
    'about.risk.caveat':
      'The ECB publishes reference rates for information purposes only. The Riskometer is a learning aid, not a risk model.',
    'about.risk.asOf': 'Data as of {date}',
    'about.risk.open': 'Open the Riskometer',

    'about.conv.h': 'Numbers and conventions',
    'about.conv.lead': 'How numbers are written and calculated in the tool.',
    'about.conv.colTopic': 'Topic',
    'about.conv.colRule': 'Rule',
    'about.conv.colSample': 'Example',
    'about.conv.numbers': 'Number format',
    'about.conv.numbersRule':
      'Swiss format in German (de-CH): apostrophe as thousands separator, point as decimal sign. English: en-GB.',
    'about.conv.percent': 'Percent',
    'about.conv.percentRule': 'No space before the percent sign in English; a no-break space in German.',
    'about.conv.minus': 'Sign',
    'about.conv.minusRule': 'Typographic minus instead of a hyphen.',
    'about.conv.rates': 'Rates',
    'about.conv.ratesRule': '4 decimals, JPY pairs 2.',
    'about.conv.pip': 'Pip',
    'about.conv.pipRule': '0.0001, for JPY pairs 0.01. One big figure is 100 pips.',
    'about.conv.quote': 'Quotes',
    'about.conv.quoteRule':
      'Pair base/quote, price in quote currency per 1 unit of base. r_d belongs to the quote, r_f to the base currency.',
    'about.conv.mm': 'Money market',
    'about.conv.mmRule': 'Simple rates, t = days / basis. {act360}: Act/360. {act365}: Act/365.',
    'about.conv.model': 'Option model',
    'about.conv.modelRule': 'Continuous rates, T = days / 365 or weeks / 52.',
    'about.conv.value': 'Value date',
    'about.conv.valueRule': 'Spot T+2, USD/CAD T+1.',
    'about.conv.greeks': 'Greeks',
    'about.conv.greeksRule':
      'On the notional: vega per vol point, rho per +1 percentage point, theta per calendar day.',

    'about.sources.h': 'Sources',
    'about.sources.lead':
      'Market events, institutional facts and statistics appear in the tool only with a source. Textbook knowledge needs none. {n} entries.',
    'about.sources.publisher': 'Publisher',
    'about.sources.date': 'Date',
    'about.sources.supports': 'Supports',
    'about.sources.open': 'Open source',
    'about.sources.newTab': '(opens in a new tab)',

    'about.credits.h': 'Credits and privacy',
    'about.credits.stack':
      'Built with Astro, TypeScript and Preact; charts as hand-written SVG. Tested with Vitest, Playwright and axe.',
    'about.credits.privacy':
      'Your learning progress stays in your browser (localStorage). There is no account and no tracking.',

    'reset.h': 'Reset progress',
    'reset.stored': 'Saved progress: {pct}',
    'reset.none': 'No progress saved yet.',
    'reset.button': 'Reset progress',
    'reset.confirmTitle': 'Really reset?',
    'reset.confirmText':
      'Completed sections and quiz results in this browser will be deleted. This cannot be undone.',
    'reset.confirm': 'Yes, reset',
    'reset.cancel': 'Cancel',
    'reset.done': 'Progress reset. You start again at 01 Spot.',
    'reset.cancelled': 'Nothing changed.',
  },
});
