/**
 * Monte Carlo engine and structured products (phase 6). Entry point for islands and scripts.
 *
 * - products.ts: MC_CONFIG / PRODUCT_DEFAULTS (every parameter, path count, seed, convention),
 *   product types, buildProduct, BUILDING_BLOCKS.
 * - rng.ts: seeded xoshiro128** generator, normals, independent streams.
 * - gbm.ts: daily GBM paths with antithetic pairs, BGK barrier shift.
 * - payoffs.ts: one kernel per product; productPayoff gives every cash flow of a path.
 * - value.ts: price, solvers (fair strike, coupon, pivot width) with common random numbers.
 * - scenarios.ts: deterministic scenario paths for the path simulator.
 * - dci.ts: dual currency investment (closed form).
 * - protocol.ts / mc.worker.ts: Web Worker protocol and client.
 * - fair.ts: precomputed fair values (src/data/fx/mc-products.json).
 */
export * from './products';
export * from './rng';
export * from './gbm';
export * from './payoffs';
export * from './value';
export * from './scenarios';
export * from './dci';
export * from './protocol';
export * from './fair';
export * from './maxloss';
// precompute.ts (the builder of the JSON, used by scripts/precompute-mc.ts) is not re-exported
// so that islands do not bundle it; only its data types are.
export type { McProductsData, StoredPremium, StoredStats, StoredZeroCost } from './precompute';
