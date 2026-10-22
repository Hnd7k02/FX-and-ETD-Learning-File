/**
 * GBM engine against closed forms (§7 Monte Carlo tests).
 *
 * European payoffs: within 3 standard errors of Garman-Kohlhagen / cash-or-nothing.
 * Barriers: daily monitoring in the simulation, continuous closed forms with the barrier shifted
 * by Broadie-Glasserman-Kou (bgkShift). BGK removes the leading O(√Δt) error but leaves an
 * O(Δt) bias, largest for reverse knock-outs (barrier in the money, as here). Documented
 * tolerance: |MC − BGK closed form| ≤ 3 SE + 0.5 pip, and MC must be at least four times
 * closer to the BGK value than to the unshifted continuous value.
 */
import { describe, expect, it } from 'vitest';
import { barrierPrice } from '@/lib/fx/exotics/barrier';
import { digitalCash } from '@/lib/fx/exotics/digital';
import { doubleNoTouch } from '@/lib/fx/exotics/doubleNoTouch';
import { gkPrice } from '@/lib/fx/vanilla';
import {
  BGK_BETA,
  bgkShift,
  gbmCoefficients,
  gbmPaths,
  gbmStep,
  GbmPathSource,
  simulate,
} from '@/lib/fx/mc/gbm';
import { DEFAULT_MARKET as m, MC_CONFIG } from '@/lib/fx/mc/products';
import { expectation } from '@/lib/fx/mc/value';

const DAYS = 91;
const T = DAYS / 365;
const K = 0.793;
const PIP = 1e-4;

describe('GBM paths', () => {
  it('start at the spot, are reproducible and reuse one buffer', () => {
    const a: number[][] = [];
    const info = simulate(m, { paths: 4, days: 10, seed: 1 }, (p) => a.push(Array.from(p)));
    const b: number[][] = [];
    simulate(m, { paths: 4, days: 10, seed: 1 }, (p) => b.push(Array.from(p)));
    expect(a).toEqual(b);
    expect(a.every((p) => p[0] === m.spot && p.length === 11)).toBe(true);
    expect(info).toMatchObject({ paths: 4, pairs: 2, antithetic: true, days: 10, seed: 1 });
    const refs = new Set<Float64Array>();
    simulate(m, { paths: 3, days: 5, seed: 1 }, (p) => refs.add(p));
    expect(refs.size).toBe(1);
  });

  it('pairs Z and −Z: log returns of a pair add up to twice the drift', () => {
    const { drift } = gbmCoefficients(m, 1 / 365);
    const paths: Float64Array[] = [];
    simulate(m, { paths: 2, days: 30, seed: 3 }, (p) => paths.push(p.slice()));
    const [up, down] = paths as [Float64Array, Float64Array];
    for (const d of [1, 7, 30]) {
      expect(Math.log(up[d]! / m.spot) + Math.log(down[d]! / m.spot)).toBeCloseTo(2 * drift * d, 12);
    }
  });

  it('rounds odd path counts up to full antithetic pairs; plain mode keeps the count', () => {
    let n = 0;
    expect(simulate(m, { paths: 5, days: 2, seed: 1 }, () => n++).paths).toBe(6);
    expect(n).toBe(6);
    n = 0;
    const info = simulate(m, { paths: 5, days: 2, seed: 1, antithetic: false }, () => n++);
    expect([info.paths, info.pairs, n]).toEqual([5, 0, 5]);
  });

  it('generator and callback give identical paths', () => {
    const viaCallback: number[] = [];
    simulate(m, { paths: 6, days: 20, seed: 9 }, (p) => viaCallback.push(p[20]!));
    const gen = gbmPaths(m, { paths: 6, days: 20, seed: 9 });
    const viaGen: number[] = [];
    let r = gen.next();
    while (!r.done) {
      viaGen.push(r.value.path[20]!);
      r = gen.next();
    }
    expect(viaGen).toEqual(viaCallback);
    expect(r.value.paths).toBe(6);
    const src = new GbmPathSource(m, { paths: 1, days: 1, seed: 1, antithetic: false });
    expect(src.next()).toBeDefined();
    expect(src.next()).toBeUndefined();
  });

  it('gbmStep is the exact log step', () => {
    const { drift, diffusion } = gbmCoefficients(m, 1 / 365);
    expect(gbmStep(0.8, 1.5, drift, diffusion)).toBeCloseTo(0.8 * Math.exp(drift + diffusion * 1.5), 15);
    expect(diffusion).toBeCloseTo(0.08 / Math.sqrt(365), 15);
  });

  it('rejects invalid inputs', () => {
    const f = () => undefined;
    expect(() => simulate(m, { paths: 0, days: 1, seed: 1 }, f)).toThrow(RangeError);
    expect(() => simulate(m, { paths: 1, days: 0, seed: 1 }, f)).toThrow(RangeError);
    expect(() => simulate(m, { paths: 1, days: 1, seed: 1, dt: 0 }, f)).toThrow(RangeError);
    expect(() => simulate({ ...m, spot: 0 }, { paths: 1, days: 1, seed: 1 }, f)).toThrow(RangeError);
    expect(() => simulate({ ...m, vol: -0.1 }, { paths: 1, days: 1, seed: 1 }, f)).toThrow(RangeError);
  });
});

describe('Monte Carlo against closed forms', () => {
  const opts = { paths: 40_000, seed: 2026 };

  it('E[S_T] equals the forward (martingale check) within 3 SE', () => {
    const r = expectation(m, DAYS, (p) => p[DAYS]!, opts);
    const F = m.spot * Math.exp((m.rd - m.rf) * T);
    expect(Math.abs(r.mean - F)).toBeLessThan(3 * r.stdErr + 1e-12);
  });

  it('European call and put within 3 SE of Garman-Kohlhagen', () => {
    for (const type of ['call', 'put'] as const) {
      const r = expectation(
        m,
        DAYS,
        (p) => Math.exp(-m.rd * T) * Math.max(type === 'call' ? p[DAYS]! - K : K - p[DAYS]!, 0),
        opts,
      );
      const cf = gkPrice(m.spot, K, T, m.vol, m.rd, m.rf, type);
      expect(Math.abs(r.mean - cf)).toBeLessThan(3 * r.stdErr);
      expect(r.paths).toBe(40_000);
    }
  });

  it('antithetic pairs reduce the variance of a call estimate', () => {
    const f = (p: Float64Array) => Math.max(p[DAYS]! - K, 0);
    const anti = expectation(m, DAYS, f, { ...opts, antithetic: true });
    const plain = expectation(m, DAYS, f, { ...opts, antithetic: false });
    // Same number of paths: the variance ratio is about 0.55 for an ATM call.
    expect(anti.stdErr).toBeLessThan(0.85 * plain.stdErr);
  });

  it('cash-or-nothing digital call and put within 3 SE', () => {
    for (const type of ['call', 'put'] as const) {
      const r = expectation(
        m,
        DAYS,
        (p) => (type === 'call' ? (p[DAYS]! > K ? 1 : 0) : p[DAYS]! < K ? 1 : 0),
        opts,
      );
      const cf = digitalCash(m.spot, K, T, m.vol, m.rd, m.rf, type);
      expect(Math.abs(r.mean - cf)).toBeLessThan(3 * r.stdErr);
    }
  });

  const barrierCase = (type: 'call' | 'put', H: number) => {
    const up = H > m.spot;
    const mc = expectation(
      m,
      DAYS,
      (p) => {
        for (let d = 1; d <= DAYS; d++) if (up ? p[d]! >= H : p[d]! <= H) return 0;
        return Math.max(type === 'call' ? p[DAYS]! - K : K - p[DAYS]!, 0);
      },
      { paths: 100_000, seed: 7 },
    );
    const args = { S: m.spot, K, T, vol: m.vol, rd: m.rd, rf: m.rf, type } as const;
    const kind = up ? 'up-and-out' : 'down-and-out';
    const continuous = barrierPrice({ ...args, H, kind });
    const bgk = barrierPrice({ ...args, H: bgkShift(H, m.spot, m.vol), kind });
    return { mc, continuous, bgk };
  };

  it('up-and-out call, daily monitoring ≈ continuous closed form with BGK-shifted barrier', () => {
    const { mc, continuous, bgk } = barrierCase('call', 0.824);
    const err = Math.abs(mc.mean - bgk);
    expect(err).toBeLessThan(3 * mc.stdErr + 0.5 * PIP);
    expect(err).toBeLessThan(Math.abs(mc.mean - continuous) / 4);
  });

  it('down-and-out put, daily monitoring ≈ continuous closed form with BGK-shifted barrier', () => {
    const { mc, continuous, bgk } = barrierCase('put', 0.776);
    const err = Math.abs(mc.mean - bgk);
    expect(err).toBeLessThan(3 * mc.stdErr + 0.5 * PIP);
    expect(err).toBeLessThan(Math.abs(mc.mean - continuous) / 4);
  });

  it('double no-touch, daily monitoring ≈ Hui series with BGK-shifted barriers (3 SE)', () => {
    const L = 0.768;
    const U = 0.832;
    const mc = expectation(
      m,
      DAYS,
      (p) => {
        for (let d = 1; d <= DAYS; d++) if (p[d]! <= L || p[d]! >= U) return 0;
        return Math.exp(-m.rd * T);
      },
      { paths: 60_000, seed: 11 },
    );
    const args = { S: m.spot, T, vol: m.vol, rd: m.rd, rf: m.rf };
    const bgk = doubleNoTouch({ ...args, L: bgkShift(L, m.spot, m.vol), U: bgkShift(U, m.spot, m.vol) });
    const continuous = doubleNoTouch({ ...args, L, U });
    expect(Math.abs(mc.mean - bgk)).toBeLessThan(3 * mc.stdErr);
    expect(Math.abs(mc.mean - continuous)).toBeGreaterThan(10 * mc.stdErr);
  });
});

describe('bgkShift', () => {
  it('moves a barrier above the spot up and one below the spot down by e^(±β σ √Δt)', () => {
    const f = Math.exp(BGK_BETA * 0.08 * Math.sqrt(1 / 365));
    expect(bgkShift(0.824, 0.8, 0.08)).toBeCloseTo(0.824 * f, 14);
    expect(bgkShift(0.776, 0.8, 0.08)).toBeCloseTo(0.776 / f, 14);
    expect(bgkShift(0.824, 0.8, 0.08, 1 / 52)).toBeCloseTo(
      0.824 * Math.exp(BGK_BETA * 0.08 * Math.sqrt(1 / 52)),
      14,
    );
    expect(BGK_BETA).toBe(MC_CONFIG.engine.bgkBeta);
  });
});
