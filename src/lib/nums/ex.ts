import { EXAMPLE, EXAMPLE_FORWARD, EXAMPLE_STRIKE } from '@/lib/fx/example';
import type { NumTable } from './types';

/** Inputs of the running example. Derived values are added once the core is complete. */
export const nums: NumTable = {
  'ex.spot': { value: EXAMPLE.spot, kind: 'rate' },
  'ex.rd': { value: EXAMPLE.rd, kind: 'pct' },
  'ex.rf': { value: EXAMPLE.rf, kind: 'pct' },
  'ex.vol': { value: EXAMPLE.vol, kind: 'pct', digits: 0 },
  'ex.notional': { value: EXAMPLE.notional, kind: 'money', ccy: 'USD' },
  'ex.forward': { value: EXAMPLE_FORWARD, kind: 'rate', digits: 5 },
  'ex.strike': { value: EXAMPLE_STRIKE, kind: 'rate' },
};
