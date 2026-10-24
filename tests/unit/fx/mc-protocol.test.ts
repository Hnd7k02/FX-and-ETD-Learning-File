import { describe, expect, it } from 'vitest';
import {
  createMcClient,
  handleMcRequest,
  type McRequest,
  type McResponse,
  type WorkerLike,
} from '@/lib/fx/mc/protocol';
import type { PriceResult, SolveResult } from '@/lib/fx/mc/value';

describe('worker protocol', () => {
  it('prices a product with overrides and answers with the same id', () => {
    const res = handleMcRequest({
      id: 7,
      type: 'price',
      product: 'accumulator',
      overrides: { strike: 0.775 },
      paths: 2000,
      seed: 3,
    });
    expect(res.id).toBe(7);
    expect(res.error).toBeUndefined();
    const r = res.result as PriceResult;
    expect([r.paths, r.seed]).toEqual([2000, 3]);
    expect(Number.isFinite(r.pv)).toBe(true);
  });

  it('solves the zero-cost parameter of a product', () => {
    const res = handleMcRequest({
      id: 1,
      type: 'solve',
      product: 'tpf',
      paths: 2000,
      market: { vol: 0.1 },
    });
    const r = res.result as SolveResult;
    expect(r.param).toBe('coupon');
    expect(r.value).toBeGreaterThan(0);
    expect(Math.abs(r.pvAtValue)).toBeLessThan(1e-6 * r.pvStdErr);
  });

  it('reports errors instead of throwing', () => {
    const bad = handleMcRequest({ id: 2, type: 'price', product: 'tarf', paths: 0 });
    expect(bad).toMatchObject({ id: 2, error: expect.stringContaining('paths') });
    const unknown = handleMcRequest({ id: 3, type: 'nope' } as unknown as McRequest);
    expect(unknown).toEqual({ id: 3, error: 'unknown request type' });
    const thrown = handleMcRequest({
      id: 4,
      type: 'price',
      product: 'nope',
    } as unknown as McRequest);
    expect(thrown.error).toContain('unknown product');
    const nonError = handleMcRequest({
      id: 5,
      type: 'price',
      product: 'tarf',
      get paths(): number {
        throw 'boom';
      },
    } as unknown as McRequest);
    expect(nonError.error).toBe('boom');
  });
});

describe('client', () => {
  it('computes inline without a worker', async () => {
    const client = createMcClient();
    const p = await client.price('doubleNoTouch', { expiryDay: 10 }, { paths: 1000 });
    expect(p.pv).toBeGreaterThan(90_000);
    const s = await client.solve('accumulator', {}, { paths: 2000 });
    expect(s.param).toBe('strike');
    await expect(client.price('tarf', {}, { paths: -1 })).rejects.toThrow('paths');
    client.terminate();
  });

  it('talks to a worker through postMessage / onmessage', async () => {
    const sent: McRequest[] = [];
    let terminated = false;
    const fake: WorkerLike = {
      onmessage: null,
      postMessage(req) {
        sent.push(req);
        // Answer asynchronously like a real worker; an unknown id is ignored.
        setTimeout(() => {
          this.onmessage?.({ data: { id: 999, error: 'stray' } as McResponse });
          this.onmessage?.({ data: handleMcRequest(req) });
        }, 0);
      },
      terminate() {
        terminated = true;
      },
    };
    const client = createMcClient(() => fake);
    const [a, b] = await Promise.all([
      client.price('tarf', { strike: 0.76 }, { paths: 1000 }),
      client.solve('rtpf', {}, { paths: 1000 }),
    ]);
    expect(a.paths).toBe(1000);
    expect(b.param).toBe('coupon');
    expect(sent.map((r) => r.id)).toEqual([1, 2]);
    await expect(client.price('tarf', {}, { paths: 0 })).rejects.toThrow('paths');

    // Pending requests are rejected on terminate.
    const silent: WorkerLike = {
      onmessage: null,
      postMessage: () => undefined,
      terminate: () => undefined,
    };
    const c2 = createMcClient(() => silent);
    const pending = c2.price('tarf');
    c2.terminate();
    await expect(pending).rejects.toThrow('terminated');
    client.terminate();
    expect(terminated).toBe(true);
  });
});

describe('main-thread chunked pricing (offline file)', () => {
  it('priceChunked equals price for the same options', async () => {
    const { price, priceChunked } = await import('@/lib/fx/mc/value');
    const { buildProduct, DEFAULT_MARKET } = await import('@/lib/fx/mc/products');
    const product = buildProduct('accumulator', DEFAULT_MARKET, {});
    const opts = { paths: 2000, seed: 7 };
    const a = price(product, DEFAULT_MARKET, opts);
    const b = await priceChunked(product, DEFAULT_MARKET, opts, 300, undefined, () =>
      Promise.resolve(),
    );
    expect(b.pv).toBe(a.pv);
    expect(b.stdErr).toBe(a.stdErr);
  });

  it('a newer request cancels the running one; terminate stops it', async () => {
    const { createInlineMcClient } = await import('@/lib/fx/mc/protocol');
    const c = createInlineMcClient(200);
    const first = c.price('accumulator', {}, { paths: 4000, seed: 1 });
    const second = c.price('accumulator', {}, { paths: 400, seed: 1 });
    await expect(first).rejects.toThrow('cancelled');
    await expect(second).resolves.toMatchObject({ paths: 400 });
    const s = await c.solve('accumulator', {}, { paths: 400, seed: 3 });
    expect(Number.isFinite(s.value)).toBe(true);
    const third = c.price('accumulator', {}, { paths: 4000, seed: 1 });
    c.terminate();
    await expect(third).rejects.toThrow('cancelled');
  });
});
