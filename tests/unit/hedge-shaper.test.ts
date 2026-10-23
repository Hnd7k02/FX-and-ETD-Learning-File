import { describe, expect, it } from 'vitest';
import { EXAMPLE as E } from '@/lib/fx/example';
import { gkPrice } from '@/lib/fx/vanilla';
import {
  SHAPER_IDS,
  effectiveCurve,
  effectiveRate,
  shaperBands,
  shaperBlocks,
  shaperFacts,
  shaperId,
  shaperPosition,
  shaperStrikes,
} from '@/lib/hedge-shaper';
import { netPremium, type PayoffMarket } from '@/lib/payoff';

const m: PayoffMarket = {
  S: E.spot,
  T: E.T,
  vol: E.vol,
  rd: E.rd,
  rf: E.rf,
  notional: E.notional,
  pair: E.pair,
};
const PIP = 1e-4;

describe('blocks and ids', () => {
  it('maps blocks to structures and back', () => {
    expect(shaperId({ sellCall: false, sellPut: false })).toBe('call');
    expect(shaperId({ sellCall: true, sellPut: false })).toBe('call-spread');
    expect(shaperId({ sellCall: false, sellPut: true })).toBe('collar');
    expect(shaperId({ sellCall: true, sellPut: true })).toBe('seagull');
    for (const id of SHAPER_IDS) expect(shaperId(shaperBlocks(id))).toBe(id);
  });

  it('uses the spot and spot + 300 pips as call strikes', () => {
    const k = shaperStrikes(m);
    expect(k.call).toBeCloseTo(0.8, 10);
    expect(k.sellCall).toBeCloseTo(0.83, 10);
  });
});

describe('positions', () => {
  it('call: one long call at the spot, premium from Garman-Kohlhagen', () => {
    const pos = shaperPosition('call', m);
    expect(pos.legs).toHaveLength(1);
    expect(pos.putStrike).toBeNull();
    const c = gkPrice(E.spot, 0.8, E.T, E.vol, E.rd, E.rf, 'call');
    expect(netPremium(pos.legs, m).quote).toBeCloseTo(c * E.notional, 6);
  });

  it('call spread is cheaper than the call by the sold call', () => {
    const call = netPremium(shaperPosition('call', m).legs, m).pips;
    const spread = netPremium(shaperPosition('call-spread', m).legs, m).pips;
    const sold = (gkPrice(E.spot, 0.83, E.T, E.vol, E.rd, E.rf, 'call') * 1) / PIP;
    expect(call - spread).toBeCloseTo(sold, 8);
  });

  it('collar and seagull are zero cost; the seagull put sits lower', () => {
    const collar = shaperPosition('collar', m);
    const seagull = shaperPosition('seagull', m);
    expect(Math.abs(netPremium(collar.legs, m).pips)).toBeLessThan(1e-6);
    expect(Math.abs(netPremium(seagull.legs, m).pips)).toBeLessThan(1e-6);
    expect(collar.putStrike!).toBeLessThan(0.8);
    expect(seagull.putStrike!).toBeLessThan(collar.putStrike!);
    // reference values of the example (bisection, 1e-8)
    expect(collar.putStrike!).toBeCloseTo(0.78632, 5);
    expect(seagull.putStrike!).toBeCloseTo(0.78105, 5);
  });

  it('drops the put if no zero-cost strike exists (extreme market)', () => {
    // with zero vol and a far OTM call the call is worthless and no put strike below gives 0 value
    const flat: PayoffMarket = { ...m, vol: 1e-6 };
    const pos = shaperPosition('collar', flat);
    if (pos.putStrike === null) expect(pos.legs).toHaveLength(1);
    else expect(Math.abs(netPremium(pos.legs, flat).pips)).toBeLessThan(0.05);
  });
});

describe('effective rate', () => {
  it('is S_T unhedged and S_T + premium below the call strike', () => {
    expect(effectiveRate([], m, 0.81)).toBeCloseTo(0.81, 12);
    const pos = shaperPosition('call', m);
    const p = netPremium(pos.legs, m).quote / E.notional;
    expect(effectiveRate(pos.legs, m, 0.78)).toBeCloseTo(0.78 + p, 12);
    expect(effectiveRate(pos.legs, m, 0.85)).toBeCloseTo(0.8 + p, 12);
  });

  it('curve equals the pointwise rate', () => {
    const pos = shaperPosition('seagull', m);
    const xs = [0.75, 0.79, 0.8, 0.82, 0.85];
    const ys = effectiveCurve(pos.legs, m, xs);
    xs.forEach((x, i) => expect(ys[i]).toBeCloseTo(effectiveRate(pos.legs, m, x), 12));
  });

  it('carries the premium to expiry with the CHF rate', () => {
    const mr: PayoffMarket = { ...m, rd: 0.02 };
    const pos = shaperPosition('call', mr);
    const p = netPremium(pos.legs, mr).quote / E.notional;
    expect(effectiveRate(pos.legs, mr, 0.7)).toBeCloseTo(0.7 + p * Math.exp(0.02 * E.T), 12);
  });
});

describe('facts', () => {
  it('call: cap holds, no floor', () => {
    const f = shaperFacts(shaperPosition('call', m), m);
    expect(f.zeroCost).toBe(false);
    expect(f.capRate).toBeCloseTo(0.8 + f.premiumPips * PIP, 10);
    expect(f.capFrom).toBeCloseTo(0.8, 10);
    expect(f.protectionEndsAt).toBeNull();
    expect(f.discountAbove).toBeNull();
    expect(f.floorRate).toBeNull();
    expect(f.premiumQuote).toBeCloseTo(f.premiumPips * PIP * E.notional, 6);
  });

  it('call spread: protection ends at the sold call, then market minus a discount', () => {
    const f = shaperFacts(shaperPosition('call-spread', m), m);
    expect(f.protectionEndsAt).toBeCloseTo(0.83, 10);
    expect(f.discountAbove!).toBeCloseTo(0.03 - f.premiumPips * PIP, 10);
    expect(f.floorRate).toBeNull();
  });

  it('collar: zero cost, cap at the call strike, floor at the put strike', () => {
    const pos = shaperPosition('collar', m);
    const f = shaperFacts(pos, m);
    expect(f.zeroCost).toBe(true);
    expect(f.capRate).toBeCloseTo(0.8, 8);
    expect(f.floorRate!).toBeCloseTo(pos.putStrike!, 8);
    expect(f.protectionEndsAt).toBeNull();
  });

  it('seagull: zero cost, floor and an end of protection', () => {
    const pos = shaperPosition('seagull', m);
    const f = shaperFacts(pos, m);
    expect(f.zeroCost).toBe(true);
    expect(f.floorRate!).toBeCloseTo(pos.putStrike!, 8);
    expect(f.protectionEndsAt).toBeCloseTo(0.83, 10);
    expect(f.discountAbove!).toBeCloseTo(0.03, 8);
  });
});

describe('bands', () => {
  it('splits into cost below and benefit above for the call', () => {
    const pos = shaperPosition('call', m);
    const xs = Array.from({ length: 121 }, (_, i) => 0.74 + (0.12 * i) / 120);
    const bands = shaperBands(xs, effectiveCurve(pos.legs, m, xs));
    expect(bands.map((b) => b.kind)).toEqual(['cost', 'benefit']);
    const f = shaperFacts(pos, m);
    expect(bands[0]!.to).toBeCloseTo(f.capRate, 6);
    expect(bands[0]!.from).toBeCloseTo(0.74, 12);
    expect(bands[1]!.to).toBeCloseTo(0.86, 12);
  });

  it('collar: cost below the floor, nothing in between, benefit above the cap', () => {
    const pos = shaperPosition('collar', m);
    const xs = Array.from({ length: 121 }, (_, i) => 0.74 + (0.12 * i) / 120);
    const bands = shaperBands(xs, effectiveCurve(pos.legs, m, xs));
    expect(bands.map((b) => b.kind)).toEqual(['cost', 'benefit']);
    expect(bands[0]!.to).toBeCloseTo(pos.putStrike!, 6);
    expect(bands[1]!.from).toBeCloseTo(0.8, 6);
  });

  it('unhedged gives no bands', () => {
    expect(shaperBands([0.7, 0.8], [0.7, 0.8])).toEqual([]);
  });
});
