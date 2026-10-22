/**
 * The precomputed fair values (src/data/fx/mc-products.json, written by npm run data:mc) and
 * the products with their fair parameter, ready for the path simulator and the module texts.
 */
import data from '@/data/fx/mc-products.json';
import type { McProductsData } from './precompute';
import {
  buildProduct,
  DEFAULT_MARKET,
  type ProductKind,
  type ProductOf,
  type ProductOverrides,
  type ZeroCostKind,
} from './products';

/** Content of mc-products.json (fair strikes, coupons, width, DNT, window barrier, DCI). */
export const MC_PRODUCTS = data as unknown as McProductsData;

/** True for the zero-cost products whose parameter was solved (§8.7). */
export function isZeroCost(kind: ProductKind): kind is ZeroCostKind {
  return kind !== 'windowBarrier' && kind !== 'doubleNoTouch';
}

/**
 * Product of the running example with its precomputed fair parameter (strike, coupon or pivot
 * width) from mc-products.json, plus optional overrides. Window barrier and double no-touch
 * have no solved parameter and come from buildProduct.
 */
export function fairProduct<K extends ProductKind>(
  kind: K,
  overrides: ProductOverrides<K> = {},
): ProductOf<K> {
  if (!isZeroCost(kind)) return buildProduct(kind, DEFAULT_MARKET, overrides);
  const stored = MC_PRODUCTS.products[kind].product as ProductOf<K>;
  return { ...stored, ...overrides };
}
