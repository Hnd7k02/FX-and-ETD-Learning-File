import { describe, expect, it } from 'vitest';
import {
  EXAMPLE as E,
  EXAMPLE_FORWARD as F,
  EXAMPLE_SMILE,
  EXAMPLE_STRIKE as K,
} from '@/lib/fx/example';
import { gkPrice } from '@/lib/fx/vanilla';
import { greeks, thetaOneDay } from '@/lib/fx/greeks';
import { atmDnsStrike, strikeFromDelta } from '@/lib/fx/implied';
import {
  BASIC_TEMPLATES,
  DEFAULT_TEMPLATES,
  STRIKE_RANGE,
  TEMPLATE_IDS,
  ZERO_COST_PIPS,
  breakEvens,
  buildTemplate,
  expiryExtremes,
  identifyTemplate,
  isTemplateId,
  kinks,
  legGreeks,
  legPayoff,
  legValue,
  legVol,
  marketForward,
  netGreeks,
  netPremium,
  payoffSketch,
  pnlAtExpiry,
  positionPayoff,
  positionValue,
  roundStrike,
  sideSign,
  slopeAbove,
  solveZeroCostStrike,
  strikeGroups,
  templateStrikes,
  type Leg,
  type PayoffMarket,
} from '@/lib/payoff';

const M: PayoffMarket = {
  S: E.spot,
  T: E.T,
  vol: E.vol,
  rd: E.rd,
  rf: E.rf,
  notional: E.notional,
  pair: E.pair,
};
const N = E.notional;
const PIP = 1e-4;
const call = gkPrice(E.spot, K, E.T, E.vol, E.rd, E.rf, 'call');
const put = gkPrice(E.spot, K, E.T, E.vol, E.rd, E.rf, 'put');
const L = (
  side: Leg['side'],
  kind: Leg['kind'],
  strike: number = K,
  notional: number = N,
): Leg => ({
  side,
  kind,
  strike,
  notional,
});

describe('payoff: legs at expiry', () => {
  it('pays the hockey sticks and the forward line', () => {
    expect(sideSign('long')).toBe(1);
    expect(sideSign('short')).toBe(-1);
    expect(legPayoff(L('long', 'call'), 0.81)).toBeCloseTo((0.81 - K) * N, 6);
    expect(legPayoff(L('long', 'call'), 0.78)).toBe(0);
    expect(legPayoff(L('short', 'call'), 0.81)).toBeCloseTo(-(0.81 - K) * N, 6);
    expect(legPayoff(L('long', 'put'), 0.78)).toBeCloseTo((K - 0.78) * N, 6);
    expect(legPayoff(L('short', 'put'), 0.81)).toBe(-0);
    expect(legPayoff(L('long', 'forward'), 0.78)).toBeCloseTo((0.78 - K) * N, 6);
    expect(positionPayoff([L('long', 'call'), L('short', 'put')], 0.77)).toBeCloseTo(
      (0.77 - K) * N,
      6,
    );
  });
});

describe('payoff: value today and net premium', () => {
  it('long call costs the reference call of the example', () => {
    const p = netPremium([L('long', 'call')], M);
    expect(p.pips).toBeCloseTo(call / PIP, 8);
    expect(p.quote).toBeCloseTo(call * N, 6);
    expect(p.pctBase).toBeCloseTo(call / E.spot, 10);
    expect(p.direction).toBe('pay');
    expect(p.zeroCost).toBe(false);
  });

  it('a short put receives the premium', () => {
    const p = netPremium([L('short', 'put')], M);
    expect(p.pips).toBeCloseTo(-put / PIP, 8);
    expect(p.direction).toBe('receive');
  });

  it('put-call parity: long call + short put = DF · (F − K)', () => {
    const p = netPremium([L('long', 'call'), L('short', 'put')], M);
    expect(p.quote).toBeCloseTo(Math.exp(-E.rd * E.T) * (F - K) * N, 6);
  });

  it('a forward at the forward rate is worth zero, off-market it is worth PV(F − K)', () => {
    expect(legValue(L('long', 'forward', F), M)).toBeCloseTo(0, 6);
    expect(legValue(L('long', 'forward', 0.78), M)).toBeCloseTo(
      Math.exp(-E.rd * E.T) * (F - 0.78) * N,
      6,
    );
    expect(legValue(L('short', 'forward', F), M, E.spot, 0)).toBeCloseTo(-(E.spot - F) * N, 6);
    expect(positionValue([L('long', 'call')], M, 0.82)).toBeCloseTo(
      gkPrice(0.82, K, E.T, E.vol, E.rd, E.rf, 'call') * N,
      6,
    );
  });

  it('zero cost below the threshold', () => {
    const p = netPremium(buildTemplate('synthetic-forward', M).legs, M);
    expect(Math.abs(p.pips)).toBeLessThan(ZERO_COST_PIPS);
    expect(p.zeroCost).toBe(true);
    expect(p.direction).toBe('zero');
  });
});

describe('payoff: net Greeks', () => {
  it('option legs scale the core Greeks', () => {
    const g = greeks(E.spot, K, E.T, E.vol, E.rd, E.rf, 'call');
    const n = legGreeks(L('short', 'call'), M);
    expect(n.delta).toBeCloseTo(-g.delta * N, 6);
    expect(n.deltaFwd).toBeCloseTo(-g.deltaFwd * N, 6);
    expect(n.gamma).toBeCloseTo(-g.gamma * 0.01 * N, 6);
    expect(n.vega).toBeCloseTo((-g.vega / 100) * N, 6);
    expect(n.theta).toBeCloseTo(-thetaOneDay(E.spot, K, E.T, E.vol, E.rd, E.rf, 'call') * N, 6);
    expect(n.rhoD).toBeCloseTo((-g.rhoD / 100) * N, 6);
    expect(n.rhoF).toBeCloseTo((-g.rhoF / 100) * N, 6);
  });

  it('forward legs: delta e^(−rf T), forward delta 1, no gamma or vega; rho and theta match differences', () => {
    const fwd = L('long', 'forward', 0.79);
    const g = legGreeks(fwd, M);
    expect(g.delta).toBeCloseTo(Math.exp(-E.rf * E.T) * N, 6);
    expect(g.deltaFwd).toBe(N);
    expect(g.gamma).toBe(0);
    expect(g.vega).toBe(0);
    const h = 1e-6;
    const v = (m: PayoffMarket) => legValue(fwd, m);
    expect(g.rhoD).toBeCloseTo(
      (v({ ...M, rd: M.rd + h }) - v({ ...M, rd: M.rd - h })) / (2 * h) / 100,
      2,
    );
    expect(g.rhoF).toBeCloseTo(
      (v({ ...M, rf: M.rf + h }) - v({ ...M, rf: M.rf - h })) / (2 * h) / 100,
      2,
    );
    expect(g.theta).toBeCloseTo(v({ ...M, T: M.T - 1 / 365 }) - v(M), 6);
  });

  it('synthetic forward has forward delta 1 and spot delta e^(−rf T) ≈ 0.99', () => {
    const g = netGreeks(buildTemplate('synthetic-forward', M).legs, M);
    expect(g.deltaFwd / N).toBeCloseTo(1, 10);
    expect(g.delta / N).toBeCloseTo(Math.exp(-E.rf * E.T), 10);
    expect(g.gamma).toBeCloseTo(0, 6);
    expect(g.vega).toBeCloseTo(0, 6);
  });

  it('the straddle at the delta-neutral strike has zero delta', () => {
    const t = buildTemplate('straddle', M);
    expect(t.legs[0]!.strike).toBeCloseTo(atmDnsStrike(E.spot, E.T, E.vol, E.rd, E.rf), 12);
    expect(netGreeks(t.legs, M).delta).toBeCloseTo(0, 4);
  });
});

describe('payoff: zero-cost solver', () => {
  it('solves the put strike of the importer collar', () => {
    const t = buildTemplate('risk-reversal', M);
    expect(t.solve).toBe(1);
    const p = netPremium(t.legs, M);
    expect(Math.abs(p.pips)).toBeLessThan(1e-6);
    const Kp = t.legs[1]!.strike;
    expect(Kp).toBeLessThan(F);
    expect(Kp).toBeGreaterThan(STRIKE_RANGE[0]);
    expect(gkPrice(E.spot, Kp, E.T, E.vol, E.rd, E.rf, 'put')).toBeCloseTo(
      gkPrice(E.spot, t.legs[0]!.strike, E.T, E.vol, E.rd, E.rf, 'call'),
      12,
    );
  });

  it('solves the seagull put', () => {
    const t = buildTemplate('seagull', M);
    expect(t.solve).toBe(2);
    expect(netPremium(t.legs, M).zeroCost).toBe(true);
  });

  it('solves several legs together (synthetic forward → forward strike)', () => {
    const legs = [L('long', 'call', 0.8), L('short', 'put', 0.8)];
    const k = solveZeroCostStrike(legs, [0, 1], M);
    expect(k).not.toBeNull();
    expect(k!).toBeCloseTo(F, 9);
  });

  it('returns null when no strike gives zero cost or the leg is missing', () => {
    expect(solveZeroCostStrike([L('long', 'call')], 0, M)).toBeNull();
    expect(solveZeroCostStrike([L('long', 'call')], 3, M)).toBeNull();
    expect(solveZeroCostStrike([L('long', 'call')], [], M)).toBeNull();
    expect(solveZeroCostStrike(buildTemplate('straddle', M).legs, [0, 1], M)).toBeNull();
  });

  it('finds an exact root on the grid and prefers the root near the current strike', () => {
    // A forward whose fair rate sits exactly on a grid point of the scan.
    const m: PayoffMarket = { ...M, rd: 0, rf: 0 };
    const k = solveZeroCostStrike([L('long', 'forward', 0.8)], 0, m, [0.74, 0.86]);
    expect(k).toBeCloseTo(0.8, 12);
    // A straddle whose strike moves, against a fixed short straddle at the forward and a
    // short put: the net value is convex in K with two roots; the one nearest `near` wins.
    const legs = [
      L('long', 'call', 0.8),
      L('long', 'put', 0.8),
      L('short', 'call', F),
      L('short', 'put', F),
      L('short', 'put', 0.78),
    ];
    const left = solveZeroCostStrike(legs, [0, 1], M, STRIKE_RANGE, 0.75);
    const right = solveZeroCostStrike(legs, [0, 1], M, STRIKE_RANGE, 0.84);
    expect(left).not.toBeNull();
    expect(right).not.toBeNull();
    expect(left!).toBeLessThan(F);
    expect(right!).toBeGreaterThan(F);
  });
});

describe('payoff: at expiry', () => {
  it('long call: break-even K + premium, loss limited to the premium, gain unlimited', () => {
    const legs = [L('long', 'call')];
    expect(breakEvens(legs, M)).toEqual([expect.closeTo(K + call, 10)]);
    const x = expiryExtremes(legs, M);
    expect(x.maxGain).toBe('unlimited');
    expect(x.maxGainAt).toBeNull();
    expect(x.maxLoss).toBeCloseTo(-call * N, 6);
    expect(x.maxLossAt).toBe(0);
    expect(pnlAtExpiry(legs, M, K)).toBeCloseTo(-call * N, 6);
  });

  it('short call: gain limited to the premium, loss unlimited', () => {
    const x = expiryExtremes([L('short', 'call')], M);
    expect(x.maxGain).toBeCloseTo(call * N, 6);
    expect(x.maxLoss).toBe('unlimited');
    expect(x.maxLossAt).toBeNull();
  });

  it('long put: gain up to (K − premium) at a rate of zero', () => {
    const legs = [L('long', 'put')];
    const x = expiryExtremes(legs, M);
    expect(x.maxGain).toBeCloseTo((K - put) * N, 6);
    expect(x.maxGainAt).toBe(0);
    expect(x.maxLoss).toBeCloseTo(-put * N, 6);
    expect(x.maxLossAt).toBeCloseTo(K, 12);
    expect(breakEvens(legs, M)).toEqual([expect.closeTo(K - put, 10)]);
  });

  it('straddle has two break-evens, strangle too', () => {
    expect(breakEvens(buildTemplate('straddle', M).legs, M)).toHaveLength(2);
    expect(breakEvens(buildTemplate('strangle', M).legs, M)).toHaveLength(2);
  });

  it('zero-cost collar: the P&L is zero between the strikes, break-evens at the strikes', () => {
    const t = buildTemplate('risk-reversal', M);
    const be = breakEvens(t.legs, M);
    expect(be[0]).toBeCloseTo(t.legs[1]!.strike, 6);
    expect(be[1]).toBeCloseTo(t.legs[0]!.strike, 6);
  });

  it('a forward at the forward rate breaks even at F', () => {
    const be = breakEvens([L('long', 'forward', F)], M);
    expect(be).toHaveLength(1);
    expect(be[0]).toBeCloseTo(F, 8);
  });

  it('a flat zero position has no break-even', () => {
    expect(breakEvens([L('long', 'call', 0.8, 0)], M)).toEqual([]);
  });

  it('kinks and slope above the strikes', () => {
    const t = buildTemplate('butterfly', M);
    expect(kinks(t.legs)).toHaveLength(3);
    expect(slopeAbove(t.legs)).toBe(0);
    expect(slopeAbove([L('long', 'put')])).toBe(0);
    expect(slopeAbove([L('short', 'forward')])).toBe(-N);
  });
});

describe('payoff: templates', () => {
  it('lists the templates of §8.3', () => {
    expect(DEFAULT_TEMPLATES).toHaveLength(12);
    expect(DEFAULT_TEMPLATES).not.toContain('long-forward');
    expect(BASIC_TEMPLATES).toEqual(['long-call', 'short-call', 'long-put', 'short-put']);
    expect(isTemplateId('straddle')).toBe(true);
    expect(isTemplateId('condor')).toBe(false);
  });

  it('template strikes sit where the desk expects them', () => {
    const k = templateStrikes(M);
    expect(k.atmf).toBeCloseTo(K, 12);
    expect(k.forward).toBeCloseTo(marketForward(M), 14);
    expect(k.call25).toBeCloseTo(
      roundStrike(strikeFromDelta(0.25, E.spot, E.T, E.vol, E.rd, E.rf, 'call')),
      12,
    );
    expect(k.put25).toBeLessThan(k.atmf);
    expect(k.call25).toBeGreaterThan(k.atmf);
    expect(roundStrike(0.81514)).toBe(0.815);
    expect(roundStrike(0.77276)).toBe(0.773);
  });

  it.each(TEMPLATE_IDS.map((id) => [id]))('%s is recognised from its legs', (id) => {
    const t = buildTemplate(id, M);
    expect(identifyTemplate(t.legs)).toBe(id);
    for (const l of t.legs) {
      expect(l.strike).toBeGreaterThanOrEqual(STRIKE_RANGE[0]);
      expect(l.strike).toBeLessThanOrEqual(STRIKE_RANGE[1]);
    }
  });

  it('unknown structures are not recognised', () => {
    expect(identifyTemplate([])).toBeNull();
    expect(identifyTemplate([L('long', 'call', K, 0)])).toBeNull();
    expect(identifyTemplate([L('long', 'call'), L('long', 'call', 0.8)])).toBeNull();
    // same structure as a risk reversal, but equal strikes → synthetic forward
    expect(identifyTemplate([L('long', 'call'), L('short', 'put')])).toBe('synthetic-forward');
    // straddle structure with distinct strikes → strangle; not in the allowed list → null
    expect(
      identifyTemplate([L('long', 'call', 0.8), L('long', 'put', 0.78)], ['straddle']),
    ).toBeNull();
    // butterfly with a missing distinct strike
    expect(
      identifyTemplate([
        L('long', 'call', 0.78),
        L('short', 'call', 0.79, 2 * N),
        L('long', 'call', 0.78),
      ]),
    ).toBeNull();
  });

  it('groups legs by strike for the drag handles', () => {
    const g = strikeGroups(buildTemplate('synthetic-forward', M).legs);
    expect(g).toHaveLength(1);
    expect(g[0]!.legs).toEqual([0, 1]);
    const b = strikeGroups(buildTemplate('butterfly', M).legs);
    expect(b.map((x) => x.legs)).toEqual([[0], [1], [2]]);
  });

  it('sketches are normalised to ±1', () => {
    const s = payoffSketch(buildTemplate('short-put', M).legs, 0.73, 0.86);
    expect(s).toHaveLength(25);
    expect(Math.min(...s)).toBeCloseTo(-1, 12);
    expect(Math.max(...s)).toBeCloseTo(0, 12);
    expect(payoffSketch([L('long', 'call', 0.9)], 0.73, 0.86).every((y) => y === 0)).toBe(true);
  });
});

describe('payoff: smile (module 06)', () => {
  const MS: PayoffMarket = { ...M, smile: EXAMPLE_SMILE };
  it('uses the smile vol of each strike, flat vol without smile', () => {
    expect(legVol(L('long', 'call'), M)).toBe(E.vol);
    expect(legVol(L('long', 'forward'), MS)).toBe(E.vol);
    const k = templateStrikes(M);
    // negative risk reversal: USD puts (low strikes) are dearer than USD calls
    expect(legVol(L('short', 'put', k.put25), MS)).toBeGreaterThan(
      legVol(L('long', 'call', k.call25), MS),
    );
  });

  it('the zero-cost collar with the smile needs a lower put strike', () => {
    const flat = buildTemplate('risk-reversal', M).legs[1]!.strike;
    const smile = buildTemplate('risk-reversal', MS).legs[1]!.strike;
    expect(smile).toBeLessThan(flat);
    expect(netPremium(buildTemplate('risk-reversal', MS).legs, MS).zeroCost).toBe(true);
    const g = netGreeks(buildTemplate('risk-reversal', MS).legs, MS);
    expect(Number.isFinite(g.vega)).toBe(true);
  });
});
