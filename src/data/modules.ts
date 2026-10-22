import type { L10n } from '@/i18n/types';

export type Family = 'linear' | 'options' | 'exotics' | 'apply';
export type Level = 'basics' | 'intermediate' | 'advanced';

export interface SectionDef {
  /** Full section title (H2 on the section page). */
  title: L10n;
  /** Short label for steppers and progress lists. */
  short: L10n;
  /** One-sentence teaser ("Weiter, wo du warst" card). */
  teaser: L10n;
}

export interface ModuleDef {
  slug: string;
  /** Two-digit number, e.g. "05". */
  n: string;
  family: Family;
  level: Level;
  minutes: number;
  /** Short title (learning path station, breadcrumb). */
  title: L10n;
  /** Long title (H1 in the module header). */
  headline: L10n;
  sections: [SectionDef, SectionDef, SectionDef, SectionDef];
}

export const FAMILIES: Record<Family, { label: L10n; modules: string[] }> = {
  linear: { label: { de: 'Linear', en: 'Linear' }, modules: ['01', '02', '03'] },
  options: { label: { de: 'Optionen', en: 'Options' }, modules: ['04', '05', '06'] },
  exotics: { label: { de: 'Exotics', en: 'Exotics' }, modules: ['07', '08'] },
  apply: { label: { de: 'Anwendung', en: 'Application' }, modules: ['09'] },
};

export const LEVELS: Record<Level, L10n> = {
  basics: { de: 'Einstieg', en: 'Basics' },
  intermediate: { de: 'Aufbau', en: 'Intermediate' },
  advanced: { de: 'Vertiefung', en: 'Advanced' },
};

const intuition = (teaser: L10n): SectionDef => ({
  title: { de: 'Intuition', en: 'Intuition' },
  short: { de: 'Intuition', en: 'Intuition' },
  teaser,
});

export const MODULES: ModuleDef[] = [
  {
    slug: '01-spot',
    n: '01',
    family: 'linear',
    level: 'basics',
    minutes: 15,
    title: { de: 'FX-Markt & Spot', en: 'FX Market & Spot' },
    headline: { de: 'Der Devisenmarkt und der Spotkurs', en: 'The FX market and the spot rate' },
    sections: [
      intuition({
        de: 'Was ein Wechselkurs ist und warum der Importeur ein Problem hat.',
        en: 'What an exchange rate is and why the importer has a problem.',
      }),
      {
        title: { de: 'Ein Markt ohne Börse', en: 'A market without an exchange' },
        short: { de: 'OTC-Markt', en: 'OTC market' },
        teaser: {
          de: 'Rund um die Uhr, von Wellington bis New York: wer handelt und wann.',
          en: 'Around the clock, from Wellington to New York: who trades and when.',
        },
      },
      {
        title: { de: 'Quotierung und 2-Way Price', en: 'Quotes and the two-way price' },
        short: { de: 'Quotierung', en: 'Quotes' },
        teaser: {
          de: 'Base, Quote, Pips, Bid und Ask: wie ein Kurs gestellt wird.',
          en: 'Base, quote, pips, bid and ask: how a price is made.',
        },
      },
      {
        title: { de: 'Gefühl für Währungen', en: 'A feel for currencies' },
        short: { de: 'G10', en: 'G10' },
        teaser: {
          de: 'Zehn Steckbriefe: Safe Haven, Rohstoffwährung, Funding-Währung.',
          en: 'Ten profiles: safe haven, commodity currency, funding currency.',
        },
      },
    ],
  },
  {
    slug: '02-forward',
    n: '02',
    family: 'linear',
    level: 'basics',
    minutes: 20,
    title: { de: 'Forward', en: 'Forward' },
    headline: {
      de: 'Forward: den Kurs von morgen heute fixieren',
      en: "Forward: fixing tomorrow's rate today",
    },
    sections: [
      intuition({
        de: 'Kurs heute fixieren, Lieferung später.',
        en: 'Fix the rate today, deliver later.',
      }),
      {
        title: { de: 'Zinsparität', en: 'Interest rate parity' },
        short: { de: 'Zinsparität', en: 'Parity' },
        teaser: {
          de: 'Zwei gleich sichere Wege führen zum selben Forward.',
          en: 'Two equally safe routes lead to the same forward.',
        },
      },
      {
        title: { de: 'Forward Points und Carry', en: 'Forward points and carry' },
        short: { de: 'Points & Carry', en: 'Points & carry' },
        teaser: {
          de: 'Forward = Spot + Cost − Benefit, und warum er keine Prognose ist.',
          en: 'Forward = spot + cost − benefit, and why it is not a forecast.',
        },
      },
      {
        title: { de: 'Arbitrage', en: 'Arbitrage' },
        short: { de: 'Arbitrage', en: 'Arbitrage' },
        teaser: {
          de: 'Was passiert, wenn der Forward falsch steht: Cash and Carry Schritt für Schritt.',
          en: 'What happens when the forward is mispriced: cash and carry step by step.',
        },
      },
    ],
  },
  {
    slug: '03-fx-swap',
    n: '03',
    family: 'linear',
    level: 'basics',
    minutes: 15,
    title: { de: 'FX Swap', en: 'FX Swap' },
    headline: {
      de: 'FX Swap: Währung auf Zeit tauschen',
      en: 'FX swap: exchanging currencies for a while',
    },
    sections: [
      intuition({
        de: 'Währung auf Zeit tauschen, ohne Kursrisiko.',
        en: 'Swap currencies for a period, without FX risk.',
      }),
      {
        title: { de: 'Near und Far Leg', en: 'Near and far leg' },
        short: { de: 'Near & Far', en: 'Near & far' },
        teaser: {
          de: 'Zwei Geschäfte in Gegenrichtung, der Preis sind die Swap Points.',
          en: 'Two opposite trades; the price is the swap points.',
        },
      },
      {
        title: { de: 'Hedge rollen', en: 'Rolling a hedge' },
        short: { de: 'Hedge rollen', en: 'Roll' },
        teaser: {
          de: 'Die Zahlung verschiebt sich um einen Monat: der Swap verlängert den Forward.',
          en: 'The payment slips by a month: the swap extends the forward.',
        },
      },
      {
        title: {
          de: 'Abgrenzung: FX Swap und Cross-Currency Swap',
          en: 'FX swap vs cross-currency swap',
        },
        short: { de: 'Abgrenzung', en: 'FX vs CCS' },
        teaser: {
          de: 'Kurzfristige Liquidität gegen langfristige Finanzierung.',
          en: 'Short-term liquidity versus long-term funding.',
        },
      },
    ],
  },
  {
    slug: '04-vanilla-options',
    n: '04',
    family: 'options',
    level: 'intermediate',
    minutes: 30,
    title: { de: 'Vanilla Options', en: 'Vanilla Options' },
    headline: {
      de: 'Vanilla Options: ein Recht, keine Pflicht',
      en: 'Vanilla options: a right, not an obligation',
    },
    sections: [
      intuition({
        de: 'Ein USD Call ist zugleich ein CHF Put.',
        en: 'A USD call is also a CHF put.',
      }),
      {
        title: { de: 'Vier Grundpositionen', en: 'Four basic positions' },
        short: { de: 'Grundpositionen', en: 'Positions' },
        teaser: {
          de: 'Long und Short, Call und Put: vier Auszahlungsprofile im Payoff-Builder.',
          en: 'Long and short, call and put: four payoff profiles in the payoff builder.',
        },
      },
      {
        title: { de: 'Moneyness und Prämie', en: 'Moneyness and premium' },
        short: { de: 'Moneyness', en: 'Moneyness' },
        teaser: {
          de: 'ATMF, ITM, OTM und warum die Prämie aus innerem Wert und Zeitwert besteht.',
          en: 'ATMF, ITM, OTM and why the premium is intrinsic value plus time value.',
        },
      },
      {
        title: { de: 'Pricing und Parität', en: 'Pricing and parity' },
        short: { de: 'Pricing', en: 'Pricing' },
        teaser: {
          de: 'Garman-Kohlhagen und die Put-Call-Parität: Long Call + Short Put = Forward.',
          en: 'Garman-Kohlhagen and put-call parity: long call + short put = forward.',
        },
      },
    ],
  },
  {
    slug: '05-greeks',
    n: '05',
    family: 'options',
    level: 'intermediate',
    minutes: 35,
    title: { de: 'Greeks', en: 'Greeks' },
    headline: {
      de: 'Greeks: wie der Optionspreis reagiert',
      en: 'Greeks: how the option price reacts',
    },
    sections: [
      intuition({
        de: 'Eine Option reagiert auf Kurs, Zeit, Vola und zwei Zinsen.',
        en: 'An option reacts to the spot, time, volatility and two interest rates.',
      }),
      {
        title: { de: 'Delta und Gamma', en: 'Delta and gamma' },
        short: { de: 'Delta & Gamma', en: 'Delta & gamma' },
        teaser: {
          de: 'Warum Gamma die Ableitung von Delta ist, und was das am Desk kostet.',
          en: 'Why gamma is the derivative of delta, and what that costs on the desk.',
        },
      },
      {
        title: { de: 'Vega', en: 'Vega' },
        short: { de: 'Vega', en: 'Vega' },
        teaser: {
          de: 'Wie stark die Prämie auf die Vola reagiert, und warum Vega bei ATMF am grössten ist.',
          en: 'How strongly the premium reacts to volatility, and why vega peaks at ATMF.',
        },
      },
      {
        title: { de: 'Theta und Rho', en: 'Theta and rho' },
        short: { de: 'Theta & Rho', en: 'Theta & rho' },
        teaser: {
          de: 'Zeitverfall, Gamma gegen Theta und die zwei Zinsen.',
          en: 'Time decay, gamma versus theta and the two interest rates.',
        },
      },
    ],
  },
  {
    slug: '06-combos-smile',
    n: '06',
    family: 'options',
    level: 'intermediate',
    minutes: 25,
    title: { de: 'Kombos & Vola-Smile', en: 'Combos & Vol Smile' },
    headline: {
      de: 'Kombinationen und der Vola-Smile',
      en: 'Option combinations and the volatility smile',
    },
    sections: [
      intuition({
        de: 'Optionen kombinieren, um Kosten und Risiko zu formen.',
        en: 'Combine options to shape cost and risk.',
      }),
      {
        title: { de: 'Spreads und Risk Reversal', en: 'Spreads and risk reversals' },
        short: { de: 'Spreads & RR', en: 'Spreads & RR' },
        teaser: {
          de: 'Call- und Put-Spread, und der Zero-Cost-Collar des Importeurs.',
          en: "Call and put spreads, and the importer's zero-cost collar.",
        },
      },
      {
        title: {
          de: 'Straddle, Strangle, Butterfly, Seagull',
          en: 'Straddle, strangle, butterfly, seagull',
        },
        short: { de: 'Straddle & Co.', en: 'Straddle & co.' },
        teaser: {
          de: 'Positionen auf die Vola statt auf die Richtung.',
          en: 'Positions on volatility rather than direction.',
        },
      },
      {
        title: { de: 'Vola-Smile', en: 'Volatility smile' },
        short: { de: 'Smile', en: 'Smile' },
        teaser: {
          de: 'ATM, Risk Reversal und Butterfly: drei Quotes beschreiben den Smile.',
          en: 'ATM, risk reversal and butterfly: three quotes describe the smile.',
        },
      },
    ],
  },
  {
    slug: '07-barrier-binary',
    n: '07',
    family: 'exotics',
    level: 'advanced',
    minutes: 30,
    title: { de: 'Barrier & Binary', en: 'Barrier & Binary' },
    headline: { de: 'Barrieren und Digitals', en: 'Barriers and digitals' },
    sections: [
      intuition({
        de: 'Optionen, die beim Berühren entstehen oder verschwinden.',
        en: 'Options that appear or vanish when a level is touched.',
      }),
      {
        title: { de: 'Knock-out und Knock-in', en: 'Knock-out and knock-in' },
        short: { de: 'KO & KI', en: 'KO & KI' },
        teaser: {
          de: 'Up, Down, In, Out und die In-Out-Parität.',
          en: 'Up, down, in, out and in-out parity.',
        },
      },
      {
        title: { de: 'Digital und Touch', en: 'Digital and touch' },
        short: { de: 'Digital & Touch', en: 'Digital & touch' },
        teaser: {
          de: 'Alles oder nichts: Digital, One-Touch, No-Touch und Double No-Touch.',
          en: 'All or nothing: digital, one-touch, no-touch and double no-touch.',
        },
      },
      {
        title: { de: 'Zweite Generation und Gap-Risiko', en: 'Second generation and gap risk' },
        short: { de: 'Gap-Risiko', en: 'Gap risk' },
        teaser: {
          de: 'Window Barrier, Double Barrier und der Frankenschock als Lehrstück.',
          en: 'Window barriers, double barriers and the franc shock as a case study.',
        },
      },
    ],
  },
  {
    slug: '08-structured-products',
    n: '08',
    family: 'exotics',
    level: 'advanced',
    minutes: 30,
    title: { de: 'Strukturierte Produkte', en: 'Structured Products' },
    headline: {
      de: 'Strukturierte Produkte, in Bausteine zerlegt',
      en: 'Structured products, taken apart',
    },
    sections: [
      intuition({
        de: 'Ein besserer Kurs als der Forward, finanziert durch verkaufte Optionen.',
        en: 'A better rate than the forward, financed by sold options.',
      }),
      {
        title: { de: 'Accumulator und Decumulator', en: 'Accumulator and decumulator' },
        short: { de: 'Accumulator', en: 'Accumulator' },
        teaser: {
          de: 'Strike, Knock-out und die doppelte Menge im Verlustfall.',
          en: 'Strike, knock-out and double the amount when it goes wrong.',
        },
      },
      {
        title: { de: 'TARF und Pivot TARF', en: 'TARF and pivot TARF' },
        short: { de: 'TARF', en: 'TARF' },
        teaser: {
          de: 'Ein Target begrenzt den Gewinn, nicht den Verlust.',
          en: 'A target caps the gain, not the loss.',
        },
      },
      {
        title: { de: 'TPF, RTPF und Dual Currency', en: 'TPF, RTPF and dual currency' },
        short: { de: 'TPF & DCI', en: 'TPF & DCI' },
        teaser: {
          de: 'Coupons gegen gehebelte Verluste, und das Konversionsrisiko einer Anlage.',
          en: 'Coupons against leveraged losses, and the conversion risk of a deposit.',
        },
      },
    ],
  },
  {
    slug: '09-hedge-alpha-yield',
    n: '09',
    family: 'apply',
    level: 'advanced',
    minutes: 15,
    title: { de: 'Hedge, Alpha, Yield', en: 'Hedge, Alpha, Yield' },
    headline: {
      de: 'Hedge, Alpha, Yield: erst das Bedürfnis, dann das Produkt',
      en: 'Hedge, alpha, yield: need first, product second',
    },
    sections: [
      intuition({
        de: 'Erst das Bedürfnis, dann das Produkt.',
        en: 'Need first, product second.',
      }),
      {
        title: { de: 'Hedgen', en: 'Hedging' },
        short: { de: 'Hedge', en: 'Hedge' },
        teaser: {
          de: 'Vom Spot bis zum strukturierten Hedge: welches Werkzeug wofür.',
          en: 'From spot to structured hedges: which tool for which job.',
        },
      },
      {
        title: { de: 'Alpha', en: 'Alpha' },
        short: { de: 'Alpha', en: 'Alpha' },
        teaser: {
          de: 'Coupon oder Strike, direktional oder Range: vier Felder, vier Produkte.',
          en: 'Coupon or strike, directional or range: four boxes, four products.',
        },
      },
      {
        title: { de: 'Yield und Carry', en: 'Yield and carry' },
        short: { de: 'Yield', en: 'Yield' },
        teaser: {
          de: 'Dual Currency, Discount-Zertifikat und Carry als Kosten-Nutzen-Abwägung.',
          en: 'Dual currency, discount certificates and carry as a cost-benefit trade-off.',
        },
      },
    ],
  },
];

export const MODULE_SLUGS = MODULES.map((m) => m.slug);

export function getModule(slug: string): ModuleDef {
  const m = MODULES.find((x) => x.slug === slug);
  if (!m) throw new Error(`Unknown module: ${slug}`);
  return m;
}

export function moduleIndex(slug: string): number {
  return MODULES.findIndex((x) => x.slug === slug);
}

/** Total number of progress units: 9 modules × 4 sections + 9 quizzes = 45. */
export const PROGRESS_UNITS = MODULES.length * 5;

export const TOTAL_MINUTES = MODULES.reduce((a, m) => a + m.minutes, 0);
