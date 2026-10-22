/**
 * Price drivers of a vanilla FX option (module 04, section 4): the six Garman-Kohlhagen inputs
 * S, K, T, σ, rd, rf, the direction in which each one moves the call and the put, and the price
 * curve along one driver (its slope is the Greek of module 05). Pure functions, no DOM.
 * Convention: rd = CHF rate (quote, domestic), rf = USD rate (base, foreign); T = weeks / 52.
 */
import { gkPrice, type OptionType } from '@/lib/fx/vanilla';
import { EXAMPLE, EXAMPLE_STRIKE } from '@/lib/fx/example';

export type DriverId = 'S' | 'K' | 'T' | 'vol' | 'rd' | 'rf';
export const DRIVER_ORDER: readonly DriverId[] = ['S', 'K', 'T', 'vol', 'rd', 'rf'];

export interface DriverValues {
  /** Spot, CHF per USD. */
  S: number;
  /** Strike, CHF per USD. */
  K: number;
  /** Time to expiry in weeks (T = weeks / 52). */
  weeks: number;
  /** Implied vol (decimal). */
  vol: number;
  /** CHF rate (decimal). */
  rd: number;
  /** USD rate (decimal). */
  rf: number;
}

export interface DriverDef {
  id: DriverId;
  /** Field in DriverValues. */
  key: keyof DriverValues;
  min: number;
  max: number;
  step: number;
  /** A typical bump for the "effect of" line (in the driver's own units). */
  bump: number;
}

/** Slider ranges (change here to change the lab). */
export const DRIVERS: Record<DriverId, DriverDef> = {
  S: { id: 'S', key: 'S', min: 0.74, max: 0.86, step: 0.0005, bump: 0.01 },
  K: { id: 'K', key: 'K', min: 0.74, max: 0.86, step: 0.0005, bump: 0.01 },
  T: { id: 'T', key: 'weeks', min: 1, max: 52, step: 1, bump: 4 },
  vol: { id: 'vol', key: 'vol', min: 0.02, max: 0.2, step: 0.0025, bump: 0.01 },
  rd: { id: 'rd', key: 'rd', min: -0.01, max: 0.05, step: 0.0025, bump: 0.01 },
  rf: { id: 'rf', key: 'rf', min: -0.01, max: 0.06, step: 0.0025, bump: 0.01 },
};

/** The running example as start values (13 weeks = T 0.25). */
export function exampleDrivers(): DriverValues {
  return {
    S: EXAMPLE.spot,
    K: EXAMPLE_STRIKE,
    weeks: Math.round(EXAMPLE.T * 52),
    vol: EXAMPLE.vol,
    rd: EXAMPLE.rd,
    rf: EXAMPLE.rf,
  };
}

/** Option price in pips (quote currency per unit base / 0.0001). */
export function pricePips(v: DriverValues, type: OptionType): number {
  return gkPrice(v.S, v.K, v.weeks / 52, v.vol, v.rd, v.rf, type) / 1e-4;
}

/** The values with one driver set to x. */
export function withDriver(v: DriverValues, id: DriverId, x: number): DriverValues {
  return { ...v, [DRIVERS[id].key]: x };
}

/** Derivative of the price (pips) with respect to the driver, central difference. */
export function slope(v: DriverValues, id: DriverId, type: OptionType): number {
  const d = DRIVERS[id];
  const x = v[d.key];
  const h = (d.max - d.min) * 1e-5;
  return (
    (pricePips(withDriver(v, id, x + h), type) - pricePips(withDriver(v, id, x - h), type)) /
    (2 * h)
  );
}

export type Direction = 'up' | 'down' | 'flat';

/** Change below this many pips over one slider step counts as flat. */
export const FLAT_PIPS = 0.005;

/** Direction of the price when the driver increases (at the current values). */
export function direction(v: DriverValues, id: DriverId, type: OptionType): Direction {
  const change = slope(v, id, type) * DRIVERS[id].step;
  if (change > FLAT_PIPS) return 'up';
  if (change < -FLAT_PIPS) return 'down';
  return 'flat';
}

/** Price change in pips for the driver's typical bump (clamped to its range). */
export function bumpEffect(v: DriverValues, id: DriverId, type: OptionType): number {
  const d = DRIVERS[id];
  const x = v[d.key];
  const up = Math.min(d.max, x + d.bump);
  return pricePips(withDriver(v, id, up), type) - pricePips(v, type);
}

/** Call and put price (pips) along one driver, n + 1 points over its slider range. */
export function driverCurve(
  v: DriverValues,
  id: DriverId,
  n = 80,
): { xs: number[]; call: number[]; put: number[] } {
  const d = DRIVERS[id];
  const xs: number[] = [];
  const call: number[] = [];
  const put: number[] = [];
  for (let i = 0; i <= n; i++) {
    const x = d.min + ((d.max - d.min) * i) / n;
    const w = withDriver(v, id, x);
    xs.push(x);
    call.push(pricePips(w, 'call'));
    put.push(pricePips(w, 'put'));
  }
  return { xs, call, put };
}
