/**
 * Closed-form exotic FX options (continuous monitoring, Garman-Kohlhagen setting):
 * European digitals, the eight single barriers, one-touch / no-touch and the double
 * no-touch. Prices in quote currency per 1 unit base; cash payouts in quote currency.
 */
export { digitalAsset, digitalCash } from './digital';
export {
  barrierBreakdown,
  barrierPrice,
  haugTerms,
  isBarrierTouched,
  isReverse,
  type BarrierBreakdown,
  type BarrierKind,
  type BarrierParams,
  type HaugTerms,
} from './barrier';
export {
  barrierDirection,
  forwardPathHitTime,
  haugSetup,
  hitDiscountFactor,
  hitDiscountFactorByQuadrature,
  logNormCdf,
  noTouch,
  noTouchProbabilityRaw,
  oneTouch,
  powTimesCdf,
  touchProbability,
  type BarrierDirection,
  type HaugSetup,
  type NoTouchParams,
  type TouchParams,
  type TouchPayAt,
} from './touch';
export {
  dntBreakdown,
  dntDefaultTerms,
  dntSeries,
  dntTouchProbabilities,
  doubleNoTouch,
  doubleOneTouch,
  type DntBreakdown,
  type DoubleTouchParams,
} from './doubleNoTouch';
