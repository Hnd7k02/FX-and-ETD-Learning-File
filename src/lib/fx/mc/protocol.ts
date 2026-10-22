/**
 * Message protocol of the Monte Carlo Web Worker (mc.worker.ts) and a small promise client.
 * Pure module code: no DOM-only APIs, so it runs in a worker, in Node (tests) and inline.
 *
 * Request  { id, type: 'price' | 'solve', product, overrides?, market?, paths?, seed? }
 * Response { id, result } or { id, error }
 *
 * Islands use it like this (Vite bundles the worker from the URL):
 *   const client = createMcClient(
 *     () => new Worker(new URL('../../lib/fx/mc/mc.worker.ts', import.meta.url), { type: 'module' }),
 *   );
 *   const { pv, stdErr } = await client.price('accumulator', { strike: 0.775 });
 * Without a worker factory (or where Worker does not exist) the client computes inline.
 */
import {
  buildProduct,
  DEFAULT_MARKET,
  SOLVED_PARAM,
  type Market,
  type ProductKind,
  type ProductOverrides,
  type ZeroCostKind,
} from './products';
import { price, solveParameter, type PriceResult, type SolveResult } from './value';

/** Valuation request: price a product (defaults + overrides) on a market. */
export interface McPriceRequest {
  id: number;
  type: 'price';
  product: ProductKind;
  overrides?: ProductOverrides<ProductKind>;
  market?: Partial<Market>;
  paths?: number;
  seed?: number;
  antithetic?: boolean;
}

/** Solver request: solve the zero-cost parameter (strike, coupon or width) of a product. */
export interface McSolveRequest {
  id: number;
  type: 'solve';
  product: ZeroCostKind;
  overrides?: ProductOverrides<ZeroCostKind>;
  market?: Partial<Market>;
  paths?: number;
  seed?: number;
  antithetic?: boolean;
}

export type McRequest = McPriceRequest | McSolveRequest;

export type McResult = PriceResult | SolveResult;

export type McResponse<R extends McResult = McResult> =
  { id: number; result: R; error?: undefined } | { id: number; result?: undefined; error: string };

/** Handles one request synchronously (the worker body; also used inline). */
export function handleMcRequest(req: McRequest): McResponse {
  try {
    const market: Market = { ...DEFAULT_MARKET, ...req.market };
    const opts = { paths: req.paths, seed: req.seed, antithetic: req.antithetic };
    const clean = Object.fromEntries(Object.entries(opts).filter(([, v]) => v !== undefined));
    if (req.type === 'price') {
      const product = buildProduct(req.product, market, req.overrides ?? {});
      return { id: req.id, result: price(product, market, clean) };
    }
    if (req.type === 'solve') {
      const product = buildProduct(req.product, market, req.overrides ?? {});
      return {
        id: req.id,
        result: solveParameter(product, SOLVED_PARAM[req.product], market, clean),
      };
    }
    return { id: (req as { id: number }).id, error: `unknown request type` };
  } catch (e) {
    return { id: req.id, error: e instanceof Error ? e.message : String(e) };
  }
}

/** The part of a Worker the client needs (structural, so no DOM types are required). */
export interface WorkerLike {
  postMessage(message: McRequest): void;
  onmessage: ((event: { data: McResponse }) => void) | null;
  terminate(): void;
}

type Pending = { resolve: (r: McResult) => void; reject: (e: Error) => void };

/** Promise client for the worker; computes inline when no worker factory is given. */
export interface McClient {
  price(
    product: ProductKind,
    overrides?: ProductOverrides<ProductKind>,
    opts?: Omit<McPriceRequest, 'id' | 'type' | 'product' | 'overrides'>,
  ): Promise<PriceResult>;
  solve(
    product: ZeroCostKind,
    overrides?: ProductOverrides<ZeroCostKind>,
    opts?: Omit<McSolveRequest, 'id' | 'type' | 'product' | 'overrides'>,
  ): Promise<SolveResult>;
  /** Stops the worker (pending requests are rejected). */
  terminate(): void;
}

export function createMcClient(workerFactory?: () => WorkerLike): McClient {
  let nextId = 1;
  const pending = new Map<number, Pending>();
  const worker = workerFactory?.();
  if (worker) {
    worker.onmessage = (event) => {
      const res = event.data;
      const p = pending.get(res.id);
      if (!p) return;
      pending.delete(res.id);
      if (res.error !== undefined) p.reject(new Error(res.error));
      else p.resolve(res.result);
    };
  }
  const send = (req: McRequest): Promise<McResult> => {
    if (!worker) {
      const res = handleMcRequest(req);
      return res.error !== undefined
        ? Promise.reject(new Error(res.error))
        : Promise.resolve(res.result);
    }
    return new Promise((resolve, reject) => {
      pending.set(req.id, { resolve, reject });
      worker.postMessage(req);
    });
  };
  return {
    price: (product, overrides, opts = {}) =>
      send({ ...opts, id: nextId++, type: 'price', product, overrides }) as Promise<PriceResult>,
    solve: (product, overrides, opts = {}) =>
      send({ ...opts, id: nextId++, type: 'solve', product, overrides }) as Promise<SolveResult>,
    terminate: () => {
      worker?.terminate();
      for (const p of pending.values()) p.reject(new Error('mc worker terminated'));
      pending.clear();
    },
  };
}
