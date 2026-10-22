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
  noTouch,
  noTouchProbabilityRaw,
  oneTouch,
  touchProbability,
  type BarrierDirection,
  type HaugSetup,
  type NoTouchParams,
  type TouchParams,
  type TouchPayAt,
} from './touch';
export {
  dntDefaultTerms,
  dntSeries,
  doubleNoTouch,
  doubleOneTouch,
  type DoubleTouchParams,
} from './doubleNoTouch';
