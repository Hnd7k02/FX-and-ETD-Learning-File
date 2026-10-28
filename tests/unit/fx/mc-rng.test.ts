import { describe, expect, it } from 'vitest';
import { createRng, Rng, streams } from '@/lib/fx/mc/rng';

function moments(xs: ArrayLike<number>) {
  const n = xs.length;
  let m = 0;
  for (let i = 0; i < n; i++) m += xs[i]!;
  m /= n;
  let v = 0;
  let s3 = 0;
  let s4 = 0;
  for (let i = 0; i < n; i++) {
    const d = xs[i]! - m;
    v += d * d;
    s3 += d * d * d;
    s4 += d * d * d * d;
  }
  v /= n;
  return { mean: m, variance: v, skew: s3 / n / v ** 1.5, kurtosis: s4 / n / (v * v) };
}

describe('xoshiro128**', () => {
  it('matches the reference output of the authors’ C code for the state [1, 2, 3, 4]', () => {
    const r = Rng.fromState([1, 2, 3, 4]);
    expect(Array.from({ length: 6 }, () => r.nextUint32())).toEqual([
      11520, 0, 5927040, 70819200, 2031721883, 1637235492,
    ]);
  });

  it('is reproducible from the seed and differs between seeds', () => {
    const a = createRng(42);
    const b = createRng(42);
    const c = createRng(43);
    const xa = Array.from({ length: 100 }, () => a.uniform());
    const xb = Array.from({ length: 100 }, () => b.uniform());
    const xc = Array.from({ length: 100 }, () => c.uniform());
    expect(xa).toEqual(xb);
    expect(xa).not.toEqual(xc);
    expect(a.seed).toBe(42);
  });

  it('accepts large and negative safe-integer seeds, rejects others', () => {
    expect(new Rng(2 ** 40 + 7).state()).not.toEqual(new Rng(7).state());
    expect(new Rng(-1).state()).not.toEqual(new Rng(1).state());
    expect(() => new Rng(1.5)).toThrow(RangeError);
    expect(() => new Rng(Number.NaN)).toThrow(RangeError);
    expect(() => Rng.fromState([0, 0, 0, 0])).toThrow(RangeError);
  });

  it('gives uniforms strictly inside (0, 1) with mean ½ and variance 1/12', () => {
    const r = createRng(7);
    const n = 200_000;
    const xs = new Float64Array(n);
    for (let i = 0; i < n; i++) xs[i] = r.uniform();
    expect(xs.reduce((a, x) => Math.min(a, x), 1)).toBeGreaterThan(0);
    expect(xs.reduce((a, x) => Math.max(a, x), 0)).toBeLessThan(1);
    const m = moments(xs);
    // SE of the mean = sqrt(1/12/n) ≈ 0.00065; of the variance ≈ 0.00019.
    expect(Math.abs(m.mean - 0.5)).toBeLessThan(0.003);
    expect(Math.abs(m.variance - 1 / 12)).toBeLessThan(0.001);
  });

  it('gives standard normals: mean 0, variance 1, skew 0, kurtosis 3', () => {
    const r = createRng(11);
    const xs = r.fillNormals(new Float64Array(400_000));
    const m = moments(xs);
    expect(Math.abs(m.mean)).toBeLessThan(0.008);
    expect(Math.abs(m.variance - 1)).toBeLessThan(0.01);
    expect(Math.abs(m.skew)).toBeLessThan(0.02);
    expect(Math.abs(m.kurtosis - 3)).toBeLessThan(0.04);
    // Tail probability P(Z > 1.96) = 2.5 %.
    const tail = xs.filter((x) => x > 1.96).length / xs.length;
    expect(Math.abs(tail - 0.025)).toBeLessThan(0.002);
  });

  it('fillNormals gives exactly the sequence of normal(), also across odd chunk sizes', () => {
    const a = createRng(5);
    const b = createRng(5);
    const seq = Array.from({ length: 1001 }, () => a.normal());
    const buf = new Float64Array(1001);
    b.fillNormals(buf, 0, 333);
    b.fillNormals(buf, 333, 334); // single value, leaves a cached spare
    b.fillNormals(buf, 334, 1001);
    expect(Array.from(buf)).toEqual(seq);
    expect(b.normal()).toBe(a.normal());
    expect(b.fillNormals(new Float64Array(0)).length).toBe(0);
  });

  it('clone continues identically, jump moves to a different stream', () => {
    const r = createRng(9);
    r.normal(); // leaves a cached spare
    const c = r.clone();
    expect(c.normal()).toBe(r.normal());
    expect(c.uniform()).toBe(r.uniform());
    const before = r.state();
    r.jump();
    expect(r.state()).not.toEqual(before);
  });

  it('streams are reproducible, stream 0 equals the seeded generator, streams differ', () => {
    const [s0, s1, s2] = streams(123, 3);
    const again = streams(123, 3);
    const plain = createRng(123);
    expect(s0!.uniform()).toBe(plain.uniform());
    expect(s1!.state()).toEqual(again[1]!.state());
    const x1 = Array.from({ length: 50 }, () => s1!.uniform());
    const x2 = Array.from({ length: 50 }, () => s2!.uniform());
    expect(x1).not.toEqual(x2);
    // Practically uncorrelated.
    let c = 0;
    const n = 20_000;
    for (let i = 0; i < n; i++) c += s1!.normal() * s2!.normal();
    expect(Math.abs(c / n)).toBeLessThan(0.03);
    expect(streams(1, 0)).toEqual([]);
    expect(() => streams(1, -1)).toThrow(RangeError);
  });
});
