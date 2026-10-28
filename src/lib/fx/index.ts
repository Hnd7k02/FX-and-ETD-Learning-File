/**
 * Public API of the calculation core (pure functions, no DOM).
 *
 * Convention everywhere: pair Base/Quote (USD/CHF), rd = quote-currency rate (domestic, CHF),
 * rf = base-currency rate (foreign, USD). Prices in quote currency per 1 unit base.
 * Option models: continuous rates, T in years (days/365). Money market: simple rates with the
 * day count of each currency (CHF, USD, EUR ACT/360; GBP, JPY ACT/365).
 *
 * Import from '@/lib/fx' in UI code; the module files stay importable on their own for
 * islands that want a smaller bundle. Monte Carlo (./mc) is not re-exported: it runs in a
 * web worker and at build time.
 */
export * from './normal';
export * from './example';
export * from './vanilla';
export * from './daycount';
export * from './forward';
export * from './swap';
export * from './arbitrage';
export * from './greeks';
export * from './implied';
export * from './smile';
export * from './exotics';
