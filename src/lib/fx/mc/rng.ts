/**
 * Seeded pseudo-random numbers for the Monte Carlo engine. Pure, no DOM.
 *
 * Generator: xoshiro128** 1.0 (Blackman and Vigna, 2018). Four 32-bit state words, period
 * 2^128 − 1, passes BigCrush. Every operation is a 32-bit integer operation (Math.imul, shifts,
 * xor), so it is exact and identical in every JavaScript engine: the same seed gives the same
 * numbers in Node (precompute script, tests) and in the browser (Web Worker).
 * Why not a 64-bit generator: JavaScript has no fast 64-bit integers (BigInt is slow); the
 * 128-bit state is plenty for our path counts (≤ 10^9 draws).
 *
 * Seeding: SplitMix32 expands the integer seed into the four state words (the recommended way
 * to seed the xoshiro family; avoids correlated states for nearby seeds such as 1, 2, 3).
 *
 * Uniforms: 52 random bits from two outputs, mapped to the open interval (0, 1):
 * u = (k + 0.5) / 2^52, k ∈ {0 … 2^52 − 1}. Never 0, never 1, so log(u) is always finite.
 *
 * Normals: Marsaglia's polar method (a rejection form of Box-Muller without sin/cos); each
 * accepted pair gives two independent N(0, 1) draws, the second is cached for the next call.
 *
 * Independent streams: jump() advances the state by 2^64 steps (the official jump polynomial),
 * so streams(seed, k) gives k non-overlapping sequences of length 2^64 each.
 */

const TWO_POW_26 = 67_108_864;
const TWO_POW_M52 = 1 / 4_503_599_627_370_496;

/** Jump polynomial of xoshiro128**: advances the state by 2^64 calls of next(). */
const JUMP = [0x8764000b, 0xf542d2d3, 0x6fa035c3, 0x77f2db5b] as const;

function rotl(x: number, k: number): number {
  return (x << k) | (x >>> (32 - k));
}

/**
 * SplitMix32 step (Steele, Lea and Flood; 32-bit variant): returns the new counter and a
 * well-mixed 32-bit output. Used only for seeding.
 */
function splitmix32(counter: number): [next: number, out: number] {
  const next = (counter + 0x9e3779b9) | 0;
  let t = next ^ (next >>> 16);
  t = Math.imul(t, 0x21f0aaad);
  t ^= t >>> 15;
  t = Math.imul(t, 0x735a2d97);
  t ^= t >>> 15;
  return [next, t >>> 0];
}

/** Checks that a seed is a safe integer (negative values are allowed). */
function assertSeed(seed: number): void {
  if (!Number.isSafeInteger(seed)) {
    throw new RangeError(`Rng: seed must be a safe integer, got ${seed}`);
  }
}

/** Seeded generator: uniforms in (0, 1) and standard normals, reproducible from the seed. */
export class Rng {
  private a = 0;
  private b = 0;
  private c = 0;
  private d = 0;
  private spare = 0;
  private hasSpare = false;

  /** The seed this generator was created with (streams keep the parent seed). */
  readonly seed: number;

  constructor(seed: number) {
    assertSeed(seed);
    this.seed = seed;
    // Low and high 32 bits of the seed; the high part is folded into the SplitMix counter.
    const lo = seed >>> 0;
    const hi = Math.floor(seed / 4_294_967_296) >>> 0;
    let counter = lo ^ Math.imul(hi, 0x85ebca6b);
    const words: number[] = [];
    for (let i = 0; i < 4; i++) {
      const [next, out] = splitmix32(counter);
      counter = next;
      words.push(out);
    }
    [this.a, this.b, this.c, this.d] = words as [number, number, number, number];
    // The all-zero state is the one forbidden state of xoshiro (practically unreachable here).
    if ((this.a | this.b | this.c | this.d) === 0) this.a = 1;
  }

  /** Next raw 32-bit output as an unsigned integer in [0, 2^32). */
  nextUint32(): number {
    const result = Math.imul(rotl(Math.imul(this.b, 5), 7), 9) >>> 0;
    const t = this.b << 9;
    this.c ^= this.a;
    this.d ^= this.b;
    this.b ^= this.c;
    this.a ^= this.d;
    this.c ^= t;
    this.d = rotl(this.d, 11);
    return result;
  }

  /** Uniform in the open interval (0, 1) with 52-bit resolution. */
  uniform(): number {
    const hi = this.nextUint32() >>> 6; // 26 bits
    const lo = this.nextUint32() >>> 6; // 26 bits
    return (hi * TWO_POW_26 + lo + 0.5) * TWO_POW_M52;
  }

  /** Standard normal N(0, 1) by the Marsaglia polar method (second draw cached). */
  normal(): number {
    if (this.hasSpare) {
      this.hasSpare = false;
      return this.spare;
    }
    let u: number;
    let v: number;
    let s: number;
    do {
      u = 2 * this.uniform() - 1;
      v = 2 * this.uniform() - 1;
      s = u * u + v * v;
    } while (s >= 1 || s === 0);
    const m = Math.sqrt((-2 * Math.log(s)) / s);
    this.spare = v * m;
    this.hasSpare = true;
    return u * m;
  }

  /**
   * Fills out[from … to − 1] with standard normals (default: the whole array). Gives exactly
   * the same sequence as repeated normal() calls, about three times faster: the generator
   * step and the polar method are inlined on local variables (hot loop of the engine).
   */
  fillNormals(out: Float64Array, from = 0, to = out.length): Float64Array {
    let i = from;
    if (i < to && this.hasSpare) {
      out[i++] = this.spare;
      this.hasSpare = false;
    }
    let a = this.a;
    let b = this.b;
    let c = this.c;
    let d = this.d;
    let r: number;
    let t: number;
    let hi: number;
    while (i < to) {
      let u: number;
      let v: number;
      let s: number;
      do {
        // Four xoshiro128** steps → two 52-bit uniforms (same order as uniform()).
        r = Math.imul(b, 5);
        r = Math.imul((r << 7) | (r >>> 25), 9) >>> 0;
        t = b << 9;
        c ^= a;
        d ^= b;
        b ^= c;
        a ^= d;
        c ^= t;
        d = (d << 11) | (d >>> 21);
        hi = r >>> 6;
        r = Math.imul(b, 5);
        r = Math.imul((r << 7) | (r >>> 25), 9) >>> 0;
        t = b << 9;
        c ^= a;
        d ^= b;
        b ^= c;
        a ^= d;
        c ^= t;
        d = (d << 11) | (d >>> 21);
        u = 2 * ((hi * TWO_POW_26 + (r >>> 6) + 0.5) * TWO_POW_M52) - 1;
        r = Math.imul(b, 5);
        r = Math.imul((r << 7) | (r >>> 25), 9) >>> 0;
        t = b << 9;
        c ^= a;
        d ^= b;
        b ^= c;
        a ^= d;
        c ^= t;
        d = (d << 11) | (d >>> 21);
        hi = r >>> 6;
        r = Math.imul(b, 5);
        r = Math.imul((r << 7) | (r >>> 25), 9) >>> 0;
        t = b << 9;
        c ^= a;
        d ^= b;
        b ^= c;
        a ^= d;
        c ^= t;
        d = (d << 11) | (d >>> 21);
        v = 2 * ((hi * TWO_POW_26 + (r >>> 6) + 0.5) * TWO_POW_M52) - 1;
        s = u * u + v * v;
      } while (s >= 1 || s === 0);
      const m = Math.sqrt((-2 * Math.log(s)) / s);
      out[i++] = u * m;
      if (i < to) {
        out[i++] = v * m;
      } else {
        this.spare = v * m;
        this.hasSpare = true;
      }
    }
    this.a = a;
    this.b = b;
    this.c = c;
    this.d = d;
    return out;
  }

  /**
   * Advances the state by 2^64 steps (xoshiro128** jump function) and drops the cached normal.
   * Calling it k times on copies of one generator gives k non-overlapping streams.
   */
  jump(): this {
    let s0 = 0;
    let s1 = 0;
    let s2 = 0;
    let s3 = 0;
    for (const word of JUMP) {
      for (let bit = 0; bit < 32; bit++) {
        if (word & (1 << bit)) {
          s0 ^= this.a;
          s1 ^= this.b;
          s2 ^= this.c;
          s3 ^= this.d;
        }
        this.nextUint32();
      }
    }
    this.a = s0;
    this.b = s1;
    this.c = s2;
    this.d = s3;
    this.hasSpare = false;
    return this;
  }

  /** Independent copy with the same state (including a cached normal). */
  clone(): Rng {
    const r = new Rng(this.seed);
    r.a = this.a;
    r.b = this.b;
    r.c = this.c;
    r.d = this.d;
    r.spare = this.spare;
    r.hasSpare = this.hasSpare;
    return r;
  }

  /** Current state words as unsigned 32-bit integers (for tests and debugging). */
  state(): [number, number, number, number] {
    return [this.a >>> 0, this.b >>> 0, this.c >>> 0, this.d >>> 0];
  }

  /**
   * Generator with an explicit state (e.g. the reference vector [1, 2, 3, 4] of the authors'
   * C code). Throws for the all-zero state.
   */
  static fromState(state: readonly [number, number, number, number]): Rng {
    if (state.every((w) => (w | 0) === 0)) {
      throw new RangeError('Rng.fromState: the all-zero state is not allowed');
    }
    const r = new Rng(0);
    [r.a, r.b, r.c, r.d] = state.map((w) => w | 0) as [number, number, number, number];
    return r;
  }
}

/** New generator from an integer seed. */
export function createRng(seed: number): Rng {
  return new Rng(seed);
}

/**
 * `count` independent, non-overlapping streams from one seed: stream k is the seeded generator
 * jumped k times (k · 2^64 steps ahead). Stream 0 equals createRng(seed).
 */
export function streams(seed: number, count: number): Rng[] {
  if (!Number.isInteger(count) || count < 0) {
    throw new RangeError(`streams: count must be a non-negative integer, got ${count}`);
  }
  const out: Rng[] = [];
  const base = new Rng(seed);
  for (let k = 0; k < count; k++) {
    out.push(base.clone());
    base.jump();
  }
  return out;
}
