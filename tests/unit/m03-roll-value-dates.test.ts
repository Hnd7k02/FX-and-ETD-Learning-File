/**
 * Value dates of the roll (03.3). The roll swap is dealt two business days before the old
 * maturity (T+2, under the holiday calendars of both currencies), so its near leg settles on the
 * old forward's value date. The tool builds no holiday calendar: it counts in days. Check in the
 * existing model (src/lib/m03/roll.ts): on the old maturity date the USD of the maturing forward
 * and of the near leg cancel exactly; only the CHF settlement remains, and the USD arrive on the
 * new value date from the far leg alone.
 */
import { describe, expect, it } from 'vitest';
import { forwardMoneyMarket } from '@/lib/fx/forward';
import { M03_CONFIG } from '@/lib/m03/config';
import { rollView } from '@/lib/m03/roll';

const C = M03_CONFIG;
const USD = C.market.base;
const CHF = C.market.quote;
const SPOTS = [
  ...new Set([
    C.roll.spotRange[0],
    C.roll.scenarioDown,
    C.roll.oldForward,
    C.market.spot,
    C.roll.scenarioUp,
    C.roll.spotRange[1],
  ]),
];
const CASES = C.roll.slips.flatMap((s) => SPOTS.map((spot) => [s.id, s.days, spot] as const));

function roll(spot: number, days: number, notional: number = C.market.notional) {
  return rollView({
    oldForward: C.roll.oldForward,
    notional,
    rd: C.market.rd,
    rf: C.market.rf,
    spotAtRoll: spot,
    extraDays: days,
  });
}

describe('roll: value dates without a holiday calendar', () => {
  it.each(CASES)(
    'slip %s, spot %f: the USD cancel exactly on the old maturity',
    (_id, days, spot) => {
      const v = roll(spot, days);
      const atOld = v.result.cashflows.filter((f) => f.at === 'roll');
      const usd = atOld.filter((f) => f.ccy === USD);
      expect(usd.map((f) => f.source).sort()).toEqual(['near', 'oldForward']);
      expect(usd.reduce((a, f) => a + f.amount, 0)).toBe(0);
      // what remains on the old maturity is CHF only: the settlement N · (S1 − F_old)
      const chf = atOld.filter((f) => f.ccy === CHF).reduce((a, f) => a + f.amount, 0);
      expect(chf).toBeCloseTo(v.settlement, 6);
      // the dollars arrive on the new value date, from the far leg alone
      const atNew = v.result.cashflows.filter((f) => f.at === 'newMaturity' && f.ccy === USD);
      expect(atNew).toEqual([
        { at: 'newMaturity', source: 'far', ccy: USD, amount: C.market.notional },
      ]);
    },
  );

  it('cancels exactly for any notional, not only round ones', () => {
    for (const n of [1, 250_000.5, 1_234_567.89, 98_765_432.1]) {
      const usd = roll(C.roll.scenarioUp, 30, n)
        .result.cashflows.filter((f) => f.at === 'roll' && f.ccy === USD)
        .reduce((a, f) => a + f.amount, 0);
      expect(usd).toBe(0);
    }
  });

  it('counts the new value date in plain days from the old one (no calendar shift)', () => {
    for (const s of C.roll.slips) {
      const v = roll(C.roll.scenarioUp, s.days);
      expect(v.result.swap.days).toBe(s.days);
      expect(v.farRate).toBe(
        forwardMoneyMarket(C.roll.scenarioUp, C.market.rd, C.market.rf, s.days),
      );
    }
  });
});
