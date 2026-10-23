import { defineDict } from '../types';

/**
 * G10Profiles (module 01, section 4): ten currency profiles with role filter and scenarios.
 * Structure and scenario rules live in src/lib/m01/g10.ts. Only textbook statements: central
 * bank names, roles as tendencies, typical drivers. No statistics (those need a source and go
 * into the MDX via <Fact>). Driver lists are separated by "|".
 */
export const g10profiles = defineDict({
  de: {
    title: 'Zehn Währungen, zehn Charaktere',
    sub: 'Die G10 · Rolle filtern, Szenario wählen, Währung antippen',
    chip: 'Tendenzen, keine Gesetze',
    grid: 'Die zehn G10-Währungen',
    role: 'Rolle',
    'role.all': 'Alle',
    'role.reserve': 'Reserve',
    'role.safeHaven': 'Safe Haven',
    'role.commodity': 'Rohstoff',
    'role.funding': 'Funding',
    'roleLong.reserve':
      'Grosse Reservewährung: Zentralbanken weltweit halten sie als Reserve, viel Handel und viele Kredite laufen über sie.',
    'roleLong.safeHaven':
      'Safe Haven: In Krisen gesucht. Anleger flüchten in diese Währung, sie wertet dann oft auf.',
    'roleLong.commodity':
      'Rohstoffwährung: folgt den Preisen der wichtigsten Exportgüter und der Weltkonjunktur.',
    'roleLong.funding':
      'Funding-Währung: über lange Zeit tiefe Zinsen. Man leiht sie, um höher verzinste Anlagen zu finanzieren (Carry Trade).',
    'roleLong.none': 'Keine Sonderrolle: Der Kurs folgt vor allem Zinsen, Konjunktur und Politik.',
    scenario: 'Szenario',
    'scenario.none': 'Keins',
    'scenario.riskOff': 'Krise',
    'scenario.riskOn': 'Ruhige Märkte',
    'scenario.commodityBoom': 'Rohstoffboom',
    'tend.up': 'stärker',
    'tend.down': 'schwächer',
    'tend.flat': 'offen',
    'scnote.none':
      'Wähle ein Szenario und schau, welche Währungen typischerweise stärker oder schwächer werden.',
    'scnote.riskOff':
      'Risk-off: Anleger suchen Sicherheit. Safe Havens werten tendenziell auf ({up}), Rohstoffwährungen ab ({down}).',
    'scnote.riskOn':
      'Risk-on: Anleger suchen Rendite und bauen Carry Trades auf. Rohstoffwährungen sind gesucht ({up}), Funding-Währungen werden verkauft ({down}).',
    'scnote.commodityBoom':
      'Rohstoffpreise steigen: Die Exportländer verdienen mehr, ihre Währungen werten tendenziell auf ({up}).',
    caveat: 'Das sind Tendenzen, keine Gesetze. Es gibt Krisen, in denen es anders läuft.',
    'name.USD': 'US-Dollar',
    'name.EUR': 'Euro',
    'name.JPY': 'Japanischer Yen',
    'name.GBP': 'Britisches Pfund',
    'name.CHF': 'Schweizer Franken',
    'name.AUD': 'Australischer Dollar',
    'name.NZD': 'Neuseeland-Dollar',
    'name.CAD': 'Kanadischer Dollar',
    'name.NOK': 'Norwegische Krone',
    'name.SEK': 'Schwedische Krone',
    'cb.USD': 'Federal Reserve (Fed)',
    'cb.EUR': 'Europäische Zentralbank (EZB)',
    'cb.JPY': 'Bank of Japan (BoJ)',
    'cb.GBP': 'Bank of England (BoE)',
    'cb.CHF': 'Schweizerische Nationalbank (SNB)',
    'cb.AUD': 'Reserve Bank of Australia (RBA)',
    'cb.NZD': 'Reserve Bank of New Zealand (RBNZ)',
    'cb.CAD': 'Bank of Canada (BoC)',
    'cb.NOK': 'Norges Bank',
    'cb.SEK': 'Sveriges Riksbank',
    'drivers.USD':
      'Zinsentscheide der Fed|US-Arbeitsmarkt und Inflation|weltweite Nachfrage nach Dollars, besonders in Krisen',
    'drivers.EUR':
      'Zinsentscheide der EZB|Wachstum und Inflation im Euroraum|Politik in der Währungsunion',
    'drivers.JPY':
      'Geldpolitik der BoJ, lange mit sehr tiefen Zinsen|Zinsabstand zu den USA|Kapital, das in Krisen nach Japan zurückfliesst',
    'drivers.GBP':
      'Zinsentscheide der BoE|Inflation und Wachstum in Grossbritannien|Politik und Handelsbeziehungen',
    'drivers.CHF':
      'Geldpolitik der SNB, auch Eingriffe am Devisenmarkt|Nachfrage nach sicheren Anlagen|Entwicklung im Euroraum, dem wichtigsten Handelspartner',
    'drivers.AUD':
      'Rohstoffpreise, vor allem Eisenerz und Kohle|Konjunktur in China|Risikoappetit der Anleger',
    'drivers.NZD':
      'Preise für Milchprodukte und andere Agrarexporte|Zinsentscheide der RBNZ|Risikoappetit der Anleger',
    'drivers.CAD': 'Ölpreis|US-Konjunktur, der wichtigste Handelspartner|Zinsentscheide der BoC',
    'drivers.NOK':
      'Öl- und Gaspreise|Zinsentscheide der Norges Bank|kleiner Markt: in Stressphasen oft starke Ausschläge',
    'drivers.SEK':
      'Zinsentscheide der Riksbank|exportstarke Industrie und Weltkonjunktur|kleiner Markt, meist gegen EUR gehandelt',
    cb: 'Zentralbank',
    roles: 'Rolle',
    drivers: 'Typische Treiber',
    conv: 'Marktkonvention',
    convPair: 'Übliches Paar {pair}',
    convDecimals: '{dec} Nachkommastellen, 1 Pip = {pip}',
    convPipValue: '1 Pip auf {base} 1 Mio. = {value}',
    convValue: 'Valuta Spot: T+{days}',
    convValueOne: 'Valuta Spot: T+{days}, eine Ausnahme',
    selected: 'Ausgewählt',
    summary: '{n} von 10 Währungen passen zur Rolle «{role}»: {codes}.',
    summaryAll: 'Alle zehn Währungen: {codes}.',
  },
  en: {
    title: 'Ten currencies, ten characters',
    sub: 'The G10 · filter by role, pick a scenario, tap a currency',
    chip: 'Tendencies, not laws',
    grid: 'The ten G10 currencies',
    role: 'Role',
    'role.all': 'All',
    'role.reserve': 'Reserve',
    'role.safeHaven': 'Safe haven',
    'role.commodity': 'Commodity',
    'role.funding': 'Funding',
    'roleLong.reserve':
      'Major reserve currency: central banks around the world hold it as reserves; much trade and lending runs through it.',
    'roleLong.safeHaven':
      'Safe haven: sought in crises. Investors flee into this currency, which then often appreciates.',
    'roleLong.commodity':
      'Commodity currency: follows the prices of its main exports and the world economy.',
    'roleLong.funding':
      'Funding currency: low interest rates for long periods. It is borrowed to finance higher-yielding investments (carry trade).',
    'roleLong.none':
      'No special role: the rate mainly follows interest rates, growth and politics.',
    scenario: 'Scenario',
    'scenario.none': 'None',
    'scenario.riskOff': 'Crisis',
    'scenario.riskOn': 'Calm markets',
    'scenario.commodityBoom': 'Commodity boom',
    'tend.up': 'stronger',
    'tend.down': 'weaker',
    'tend.flat': 'unclear',
    'scnote.none': 'Pick a scenario and see which currencies typically become stronger or weaker.',
    'scnote.riskOff':
      'Risk-off: investors look for safety. Safe havens tend to appreciate ({up}), commodity currencies to depreciate ({down}).',
    'scnote.riskOn':
      'Risk-on: investors look for yield and build carry trades. Commodity currencies are in demand ({up}), funding currencies are sold ({down}).',
    'scnote.commodityBoom':
      'Commodity prices rise: the exporting countries earn more, and their currencies tend to appreciate ({up}).',
    caveat:
      'These are tendencies, not laws. There are crises in which things turn out differently.',
    'name.USD': 'US dollar',
    'name.EUR': 'Euro',
    'name.JPY': 'Japanese yen',
    'name.GBP': 'Pound sterling',
    'name.CHF': 'Swiss franc',
    'name.AUD': 'Australian dollar',
    'name.NZD': 'New Zealand dollar',
    'name.CAD': 'Canadian dollar',
    'name.NOK': 'Norwegian krone',
    'name.SEK': 'Swedish krona',
    'cb.USD': 'Federal Reserve (Fed)',
    'cb.EUR': 'European Central Bank (ECB)',
    'cb.JPY': 'Bank of Japan (BoJ)',
    'cb.GBP': 'Bank of England (BoE)',
    'cb.CHF': 'Swiss National Bank (SNB)',
    'cb.AUD': 'Reserve Bank of Australia (RBA)',
    'cb.NZD': 'Reserve Bank of New Zealand (RBNZ)',
    'cb.CAD': 'Bank of Canada (BoC)',
    'cb.NOK': 'Norges Bank',
    'cb.SEK': 'Sveriges Riksbank',
    'drivers.USD':
      'Fed rate decisions|US labour market and inflation|global demand for dollars, especially in crises',
    'drivers.EUR':
      'ECB rate decisions|growth and inflation in the euro area|politics within the monetary union',
    'drivers.JPY':
      'BoJ monetary policy, with very low rates for a long time|rate gap to the United States|capital flowing back to Japan in crises',
    'drivers.GBP': 'BoE rate decisions|UK inflation and growth|politics and trade relations',
    'drivers.CHF':
      'SNB monetary policy, including interventions in the FX market|demand for safe assets|developments in the euro area, the main trading partner',
    'drivers.AUD':
      'commodity prices, above all iron ore and coal|the Chinese economy|investors’ risk appetite',
    'drivers.NZD':
      'prices of dairy and other agricultural exports|RBNZ rate decisions|investors’ risk appetite',
    'drivers.CAD': 'oil price|the US economy, the main trading partner|BoC rate decisions',
    'drivers.NOK':
      'oil and gas prices|Norges Bank rate decisions|small market: often large swings under stress',
    'drivers.SEK':
      'Riksbank rate decisions|export-heavy industry and the world economy|small market, mostly traded against EUR',
    cb: 'Central bank',
    roles: 'Role',
    drivers: 'Typical drivers',
    conv: 'Market convention',
    convPair: 'Usual pair {pair}',
    convDecimals: '{dec} decimals, 1 pip = {pip}',
    convPipValue: '1 pip on {base} 1m = {value}',
    convValue: 'Spot value date: T+{days}',
    convValueOne: 'Spot value date: T+{days}, an exception',
    selected: 'Selected',
    summary: '{n} of 10 currencies match the role “{role}”: {codes}.',
    summaryAll: 'All ten currencies: {codes}.',
  },
});
