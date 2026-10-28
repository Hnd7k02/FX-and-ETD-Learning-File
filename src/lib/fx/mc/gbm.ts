/**
 * Geometric Brownian motion for FX under the risk-neutral (domestic, CHF) measure. Pure, no DOM.
 *
 *   dS/S = (rd − rf) dt + σ dW
 *
 * Exact log step (no discretisation bias at the step dates):
 *   S_{t+Δt} = S_t · exp((rd − rf − ½σ²) Δt + σ √Δt · Z),  Z ~ N(0, 1)
 * Daily steps, Δt = 1/365 (MC_CONFIG.conventions.dt). Antithetic pairs: every vector of normals
 * Z is used twice, once as Z and once as −Z (paths 2k and 2k + 1 form a pair).
 *
 * Memory: one path buffer of days + 1 numbers is reused for every path (path[0] = spot,
 * path[d] = spot after d days). A callback that wants to keep a path must copy it.
 *
 * Barrier monitoring is daily. To compare with continuous-monitoring closed forms use the
 * Broadie-Glasserman-Kou (1997) shift: a daily barrier H behaves like a continuous barrier at
 * H · e^(+β σ √Δt) above the spot and H · e^(−β σ √Δt) below it, β ≈ 0.5826 ({@link bgkShift}).
 */
import { MC_CONFIG, type Market } from './products';
import { Rng } from './rng';

/** Options of {@link simulate}. */
export interface SimulateOptions {
  /** Number of paths (rounded up to an even number with antithetic pairs). */
  paths: number;
  /** Number of daily steps; the path has days + 1 points. */
  days: number;
  /** Integer seed of the random numbers. */
  seed: number;
  /** Antithetic pairs (Z, −Z). Default MC_CONFIG.engine.antithetic (true). */
  antithetic?: boolean;
  /** Step in years. Default MC_CONFIG.conventions.dt = 1/365. */
  dt?: number;
}

/** What {@link simulate} actually ran. */
export interface SimulationInfo {
  /** Paths delivered to the callback (even with antithetic pairs). */
  paths: number;
  /** Number of antithetic pairs (0 without). */
  pairs: number;
  antithetic: boolean;
  days: number;
  dt: number;
  seed: number;
}

/** Callback per path: the reused buffer (copy it to keep it) and the path index 0 … paths − 1. */
export type PathCallback = (path: Float64Array, index: number) => void;

/** Drift and diffusion of one log step: (rd − rf − ½σ²) Δt and σ √Δt. */
export function gbmCoefficients(market: Market, dt: number): { drift: number; diffusion: number } {
  return {
    drift: (market.rd - market.rf - 0.5 * market.vol * market.vol) * dt,
    diffusion: market.vol * Math.sqrt(dt),
  };
}

/** One exact GBM step: S · exp(drift + diffusion · z). */
export function gbmStep(S: number, z: number, drift: number, diffusion: number): number {
  return S * Math.exp(drift + diffusion * z);
}

function validate(market: Market, o: SimulateOptions, dt: number): void {
  if (!Number.isInteger(o.paths) || o.paths < 1) {
    throw new RangeError(`simulate: paths must be a positive integer, got ${o.paths}`);
  }
  if (!Number.isInteger(o.days) || o.days < 1) {
    throw new RangeError(`simulate: days must be a positive integer, got ${o.days}`);
  }
  if (!(dt > 0)) throw new RangeError(`simulate: dt must be positive, got ${dt}`);
  if (!(market.spot > 0)) throw new RangeError(`simulate: spot must be positive`);
  if (!(market.vol >= 0)) throw new RangeError(`simulate: vol must be non-negative`);
}

/**
 * Path source: hands out GBM paths one by one in a reused buffer. Used by {@link simulate}
 * and {@link gbmPaths}; both give identical paths for identical options.
 */
export class GbmPathSource {
  readonly info: SimulationInfo;
  private readonly rng: Rng;
  private readonly z: Float64Array;
  private readonly path: Float64Array;
  private readonly drift: number;
  private readonly diffusion: number;
  private readonly spot: number;
  private index = 0;

  constructor(market: Market, opts: SimulateOptions) {
    const dt = opts.dt ?? MC_CONFIG.conventions.dt;
    validate(market, opts, dt);
    const antithetic = opts.antithetic ?? MC_CONFIG.engine.antithetic;
    const pairs = antithetic ? Math.ceil(opts.paths / 2) : 0;
    this.info = {
      paths: antithetic ? 2 * pairs : opts.paths,
      pairs,
      antithetic,
      days: opts.days,
      dt,
      seed: opts.seed,
    };
    this.rng = new Rng(opts.seed);
    this.z = new Float64Array(opts.days + 1);
    this.path = new Float64Array(opts.days + 1);
    const { drift, diffusion } = gbmCoefficients(market, dt);
    this.drift = drift;
    this.diffusion = diffusion;
    this.spot = market.spot;
  }

  /** Index of the next path (0-based). */
  get nextIndex(): number {
    return this.index;
  }

  /** Next path in the reused buffer, or undefined when all paths were delivered. */
  next(): Float64Array | undefined {
    const { paths, antithetic, days } = this.info;
    if (this.index >= paths) return undefined;
    const mirrored = antithetic && this.index % 2 === 1;
    if (!mirrored) this.rng.fillNormals(this.z, 1, days + 1);
    const sign = mirrored ? -1 : 1;
    const { z, path, drift, spot } = this;
    const diff = sign * this.diffusion;
    path[0] = spot;
    let x = 0;
    for (let d = 1; d <= days; d++) {
      x += drift + diff * z[d]!;
      path[d] = spot * Math.exp(x);
    }
    this.index++;
    return path;
  }
}

/**
 * Simulates `paths` daily GBM paths and calls onPath(path, index) for each, in a reused buffer
 * (memory O(days), whatever the number of paths). With antithetic pairs the paths 2k and 2k + 1
 * use Z and −Z.
 */
export function simulate(
  market: Market,
  opts: SimulateOptions,
  onPath: PathCallback,
): SimulationInfo {
  const src = new GbmPathSource(market, opts);
  for (let path = src.next(); path !== undefined; path = src.next()) {
    onPath(path, src.nextIndex - 1);
  }
  return src.info;
}

/** Generator form of {@link simulate}: yields { path, index } with the reused buffer. */
export function* gbmPaths(
  market: Market,
  opts: SimulateOptions,
): Generator<{ path: Float64Array; index: number }, SimulationInfo> {
  const src = new GbmPathSource(market, opts);
  for (let path = src.next(); path !== undefined; path = src.next()) {
    yield { path, index: src.nextIndex - 1 };
  }
  return src.info;
}

/** BGK constant β = −ζ(½)/√(2π) ≈ 0.5826 (MC_CONFIG.engine.bgkBeta). */
export const BGK_BETA = MC_CONFIG.engine.bgkBeta;

/**
 * Broadie-Glasserman-Kou continuity correction. Returns the continuous barrier that matches a
 * barrier H monitored every dt years: H · e^(+β σ √dt) if H is above the spot S0 (pushed up),
 * H · e^(−β σ √dt) if below (pushed down). Discrete price(H) ≈ continuous price(bgkShift(H)).
 */
export function bgkShift(
  H: number,
  S0: number,
  vol: number,
  dt: number = MC_CONFIG.conventions.dt,
): number {
  const shift = BGK_BETA * vol * Math.sqrt(dt);
  return H > S0 ? H * Math.exp(shift) : H * Math.exp(-shift);
}
