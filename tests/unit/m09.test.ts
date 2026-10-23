import { describe, expect, it } from 'vitest';
import { EXAMPLE, EXAMPLE_FORWARD, EXAMPLE_STRIKE } from '@/lib/fx/example';
import { gkPrice } from '@/lib/fx/vanilla';
import { M09_CONFIG, M09_MARKET } from '@/lib/m09/config';
import {
  HEDGE_IDS,
  cheapestAt,
  crossedEvents,
  hedgeCosts,
  hedgeCurve,
  hedgeEvents,
  hedgeRange,
  hedgeRate,
  hedgeSetup,
  initialHedgeFixing,
  isHedgeId,
  snapHedgeFixing,
  tourPosition,
  tourStops,
  tourWaypoints,
} from '@/lib/m09/hedge';
import {
  CARRY_DEFAULTS,
  YIELD_STEPS,
  carryRange,
  carryView,
  clampCarryInputs,
  cushionPips,
  expectedPnlPerUsd,
  initialCarryFixing,
  isYieldStep,
  probBelow,
  probLoss,
  snapCarryFixing,
  yieldCurve,
  yieldPnl,
  yieldPnlPerUsd,
  yieldReturnPa,
} from '@/lib/m09/carry';
import { forward } from '@/lib/fx/forward';

const S = EXAMPLE.spot;

describe('HedgeCompare: the importer’s five strategies', () => {
  const s = hedgeSetup();

  it('solves strikes and premiums', () => {
    expect(s.forward).toBeCloseTo(EXAMPLE_FORWARD, 12);
    expect(s.call.strike).toBe(EXAMPLE_STRIKE);
    const p = gkPrice(S, EXAMPLE_STRIKE, EXAMPLE.T, EXAMPLE.vol, EXAMPLE.rd, EXAMPLE.rf, 'call');
    expect(s.call.premium).toBeCloseTo(p, 12);
    expect(s.call.cap).toBeCloseTo(EXAMPLE_STRIKE + p * Math.exp(EXAMPLE.rd * EXAMPLE.T), 12);
    expect(Math.abs(s.collar.premium)).toBeLessThan(1e-9);
    expect(s.collar.putStrike).toBeLessThan(s.forward);
    expect(s.collar.callStrike).toBeGreaterThan(s.forward);
    // leveraged forward: call(K) − 2 put(K) = 0, so K is below the forward
    const K = s.leveraged.strike;
    const v =
      gkPrice(S, K, EXAMPLE.T, EXAMPLE.vol, EXAMPLE.rd, EXAMPLE.rf, 'call') -
      2 * gkPrice(S, K, EXAMPLE.T, EXAMPLE.vol, EXAMPLE.rd, EXAMPLE.rf, 'put');
    expect(Math.abs(v)).toBeLessThan(1e-10);
    expect(K).toBeLessThan(s.forward);
    expect(s.leveraged.better).toBeCloseTo(s.forward - K, 12);
    expect(s.leveraged.worseThanForwardBelow).toBeCloseTo(2 * K - s.forward, 12);
    // with rd = 0: the second put is worth exactly the improvement F − K (parity)
    expect(s.leveraged.secondPut).toBeCloseTo(s.leveraged.better, 9);
  });

  it('gives the effective rates of the formulas in the file header', () => {
    for (const ST of [0.74, 0.77, 0.79, 0.8, 0.83, 0.86]) {
      expect(hedgeRate('unhedged', ST, s)).toBeCloseTo(ST, 12);
      expect(hedgeRate('forward', ST, s)).toBeCloseTo(s.forward, 12);
      expect(hedgeRate('call', ST, s)).toBeCloseTo(
        Math.min(ST, s.call.strike) + s.call.premiumAtExpiry,
        12,
      );
      expect(hedgeRate('collar', ST, s)).toBeCloseTo(
        Math.min(Math.max(ST, s.collar.putStrike), s.collar.callStrike),
        9,
      );
      const K = s.leveraged.strike;
      expect(hedgeRate('leveraged', ST, s)).toBeCloseTo(ST >= K ? K : 2 * K - ST, 12);
    }
    const xs = [0.75, 0.8, 0.85];
    expect(hedgeCurve('call', xs, s)).toEqual(xs.map((x) => hedgeRate('call', x, s)));
    const costs = hedgeCosts(0.84, s);
    expect(costs.forward).toBeCloseTo(s.forward * EXAMPLE.notional, 6);
    expect(Object.keys(costs)).toEqual([...HEDGE_IDS]);
  });

  it('ranks the strategies in hindsight', () => {
    expect(cheapestAt(0.84, HEDGE_IDS, s)).toBe('leveraged');
    expect(cheapestAt(0.76, HEDGE_IDS, s)).toBe('unhedged');
    expect(cheapestAt(0.84, ['unhedged', 'forward', 'call'], s)).toBe('forward');
    expect(cheapestAt(0.84, [], s)).toBeNull();
  });

  it('lists the events of the visible strategies and the ones crossed by a move', () => {
    const ev = hedgeEvents(s);
    expect(ev.map((e) => e.id)).toEqual([
      'collarFloor',
      'levWorse',
      'levStrike',
      'callStrike',
      'forward',
      'collarCap',
    ]);
    expect(hedgeEvents(s, ['forward']).map((e) => e.id)).toEqual(['forward']);
    const up = crossedEvents(0.78, 0.82, ev).map((e) => e.id);
    expect(up).toEqual(['levStrike', 'callStrike', 'forward', 'collarCap']);
    const down = crossedEvents(0.82, 0.78, ev).map((e) => e.id);
    expect(down).toEqual(['collarCap', 'forward', 'callStrike', 'levStrike']);
    expect(crossedEvents(0.8, 0.8, ev)).toEqual([]);
  });

  it('plays a tour at constant speed and stops at every event under reduced motion', () => {
    const w = tourWaypoints();
    expect(w).toEqual(M09_CONFIG.hedge.tour.waypoints.map((x) => S * (1 + x)));
    expect(tourPosition(0, w)).toBeCloseTo(w[0]!, 12);
    expect(tourPosition(1, w)).toBeCloseTo(w[w.length - 1]!, 12);
    expect(tourPosition(-1, w)).toBeCloseTo(w[0]!, 12);
    const total = w.slice(1).reduce((a, x, i) => a + Math.abs(x - w[i]!), 0);
    const first = Math.abs(w[1]! - w[0]!);
    expect(tourPosition(first / total, w)).toBeCloseTo(w[1]!, 9);
    expect(tourPosition(0.5, [0.8])).toBe(0.8);
    expect(tourPosition(0.5, [0.8, 0.8])).toBe(0.8);
    expect(tourPosition(0.5, [])).toBe(M09_MARKET.S);
    const stops = tourStops(hedgeEvents(s), w);
    expect(stops[0]).toBeCloseTo(w[0]!, 12);
    for (const e of hedgeEvents(s))
      expect(stops.some((x) => Math.abs(x - e.level) < 1e-12)).toBe(true);
    for (let i = 1; i < stops.length; i++) expect(stops[i]).not.toBe(stops[i - 1]);
  });

  it('snaps the rate at expiry and starts with a stronger dollar', () => {
    const [lo, hi] = hedgeRange();
    expect(lo).toBeCloseTo(S * (1 + M09_CONFIG.hedge.xRange[0]), 12);
    expect(snapHedgeFixing(0.80012)).toBeCloseTo(0.8, 12);
    expect(snapHedgeFixing(0)).toBe(lo);
    expect(snapHedgeFixing(9)).toBe(hi);
    expect(initialHedgeFixing()).toBeGreaterThan(S);
    expect(isHedgeId('collar')).toBe(true);
    expect(isHedgeId('swap')).toBe(false);
  });
});

describe('CarryCushion: carry, discount certificate and dual currency', () => {
  const v = carryView();

  it('uses the money-market forward of the running example', () => {
    const F = forward(S, EXAMPLE.rd, EXAMPLE.rf, EXAMPLE.T, 'moneyMarket', {
      days: EXAMPLE.mmDays,
      quoteCcy: EXAMPLE.quote,
      baseCcy: EXAMPLE.base,
    });
    expect(v.days).toBe(EXAMPLE.mmDays);
    expect(v.T).toBe(EXAMPLE.T);
    expect(v.forward).toBeCloseTo(F, 12);
    expect(v.forwardPointsPips).toBeCloseTo((F - S) / 1e-4, 9);
    expect(v.strike).toBeCloseTo(S * (1 - M09_CONFIG.yieldProducts.strikeBelow), 12);
  });

  it('prices the options off the same forward (put-call parity holds exactly)', () => {
    expect(v.call - v.put).toBeCloseTo(S * v.dff - v.strike * v.dfd, 12);
    expect(v.certPrice).toBeCloseTo(v.strike * v.dfd - v.put, 12);
    expect(v.certDiscount).toBeCloseTo((S - v.certPrice) / S, 12);
  });

  it('makes the discount certificate and the dual currency investment twins', () => {
    for (const x of [0.7, 0.75, 0.78, v.strike, 0.81, 0.9]) {
      expect(yieldPnlPerUsd('discount', x, v)).toBeCloseTo(yieldPnlPerUsd('dci', x, v), 12);
      // certificate = carry + sold call (premium carried to maturity)
      expect(yieldPnlPerUsd('discount', x, v)).toBeCloseTo(
        yieldPnlPerUsd('carry', x, v) + v.call / v.dfd - Math.max(x - v.strike, 0),
        12,
      );
    }
  });

  it('has its break-evens where the result is zero, and no free lunch in the model', () => {
    for (const st of YIELD_STEPS) {
      expect(yieldPnlPerUsd(st, v.breakEven[st], v)).toBeCloseTo(0, 12);
      expect(expectedPnlPerUsd(st, v)).toBeCloseTo(0, 12);
    }
    expect(v.breakEven.carry).toBe(v.forward);
    expect(v.breakEven.dci).toBeLessThan(v.breakEven.carry);
    expect(cushionPips('carry', v)).toBeCloseTo(-v.forwardPointsPips, 9);
    expect(cushionPips('dci', v)).toBeGreaterThan(cushionPips('carry', v));
    expect(v.maxGainPerUsd.carry).toBe(Infinity);
    expect(yieldPnlPerUsd('dci', 0.95, v)).toBeCloseTo(v.maxGainPerUsd.dci, 12);
  });

  it('turns per-USD results into CHF and yields', () => {
    expect(yieldPnl('carry', S, v)).toBeCloseTo(EXAMPLE.notional * (S - v.forward), 6);
    expect(yieldCurve('dci', [0.7, 0.9], v)).toEqual([
      yieldPnl('dci', 0.7, v),
      yieldPnl('dci', 0.9, v),
    ]);
    // carry at unchanged spot earns the USD rate on the amount invested
    expect(yieldReturnPa('carry', S, v)).toBeCloseTo(EXAMPLE.rf, 12);
    // the DCI above the strike earns its quoted yield
    expect(yieldReturnPa('dci', 0.9, v)).toBeCloseTo(v.dciYieldPa, 12);
    expect(v.dciYieldPa).toBeGreaterThan(v.depositRate);
    expect(yieldReturnPa('discount', 0.9, v)).toBeGreaterThan(v.dciYieldPa);
  });

  it('gives model probabilities (lognormal around the forward)', () => {
    const sq = v.vol * Math.sqrt(v.T);
    expect(probLoss('carry', v)).toBeGreaterThan(0.5);
    expect(probLoss('carry', v)).toBeLessThan(0.52);
    expect(probLoss('dci', v)).toBeLessThan(probLoss('carry', v));
    expect(probBelow(0, v)).toBe(0);
    expect(probBelow(v.sigmaBand[0], v)).toBeCloseTo(0.158655, 5);
    expect(probBelow(v.sigmaBand[1], v)).toBeCloseTo(0.841345, 5);
    expect(v.typicalMove).toBeCloseTo(S * sq, 12);
  });

  it('grows the carry cushion with time and the typical move with its square root', () => {
    const v1 = carryView({ ...CARRY_DEFAULTS, months: 1 });
    const v12 = carryView({ ...CARRY_DEFAULTS, months: 12 });
    expect(cushionPips('carry', v12) / cushionPips('carry', v1)).toBeCloseTo(
      12 / (1 + EXAMPLE.rf) / (1 / (1 + EXAMPLE.rf / 12)),
      9,
    );
    expect(v12.typicalMove / v1.typicalMove).toBeCloseTo(Math.sqrt(12), 9);
    const v0 = carryView({ ...CARRY_DEFAULTS, usdRate: 0 });
    expect(cushionPips('carry', v0)).toBeCloseTo(0, 9);
  });

  it('snaps inputs and the rate at expiry', () => {
    const [lo, hi] = carryRange();
    expect(snapCarryFixing(0)).toBe(lo);
    expect(snapCarryFixing(5)).toBe(hi);
    expect(initialCarryFixing()).toBeCloseTo(S * (1 + M09_CONFIG.carry.initialMove), 12);
    expect(clampCarryInputs({ months: 30, usdRate: -1, vol: 0.0812, strikeBelow: 0.0101 })).toEqual(
      { months: 12, usdRate: 0, vol: 0.08, strikeBelow: 0.01 },
    );
    expect(isYieldStep('dci')).toBe(true);
    expect(isYieldStep('bond')).toBe(false);
  });
});
