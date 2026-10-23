/**
 * Option vs forward (module 04, section 1): what the Swiss importer pays in CHF for USD N at
 * expiry, depending on the spot at expiry S_T, with three choices:
 * - unhedged: buy at S_T                                  → S_T · N
 * - forward:  buy at the forward F agreed today            → F · N
 *   (F is the outright as dealt: the continuous forward rounded to `forwardDigits` decimals,
 *   so that "rate × USD 1 Mio." on screen equals the CHF amount on screen)
 * - USD call / CHF put with strike K (premium p per USD, paid today, compounded at rd):
 *   exercise above K, buy in the market below K           → (min(S_T, K) + p · e^(rd T)) · N
 * Pure functions, no DOM. Convention: rd = CHF rate (quote), rf = USD rate (base), T = days/365.
 */
import { gkPrice } from '@/lib/fx/vanilla';
import { forwardContinuous } from '@/lib/fx/forward';

export interface HedgeSetup {
  /** Spot today (CHF per USD). */
  S: number;
  /** Strike of the USD call. */
  K: number;
  /** Time to expiry in years. */
  T: number;
  vol: number;
  rd: number;
  rf: number;
  /** USD amount to pay at expiry. */
  notional: number;
  /** Decimals of the dealt forward outright (default: unrounded model forward). */
  forwardDigits?: number;
}

/** Decimals of a USD/CHF forward outright as dealt (0.79303), as in module 02. */
export const FORWARD_DIGITS = 5;

export interface HedgeFacts {
  /** Forward F = S · e^((rd − rf) T), rounded to `forwardDigits` if given (the dealt rate). */
  F: number;
  /** Call premium per USD, paid today (CHF). */
  premium: number;
  /** Premium carried to expiry: p · e^(rd T). */
  premiumAtExpiry: number;
  /** Below this S_T the option costs less than the forward: F − p·e^(rd T). */
  optionBeatsForwardBelow: number;
  /** Above this S_T the option costs less than staying unhedged: K + p·e^(rd T). */
  optionBeatsUnhedgedAbove: number;
  /** Worst case with the option, per USD: K + p·e^(rd T) (the cap). */
  cap: number;
}

export function hedgeFacts(h: HedgeSetup): HedgeFacts {
  const Fmodel = forwardContinuous(h.S, h.rd, h.rf, h.T);
  const F =
    h.forwardDigits === undefined ? Fmodel : Number(Fmodel.toFixed(Math.max(0, h.forwardDigits)));
  const premium = gkPrice(h.S, h.K, h.T, h.vol, h.rd, h.rf, 'call');
  const premiumAtExpiry = premium * Math.exp(h.rd * h.T);
  return {
    F,
    premium,
    premiumAtExpiry,
    optionBeatsForwardBelow: F - premiumAtExpiry,
    optionBeatsUnhedgedAbove: h.K + premiumAtExpiry,
    cap: h.K + premiumAtExpiry,
  };
}

export type HedgeChoice = 'unhedged' | 'forward' | 'option';

export interface HedgeCosts {
  /** CHF paid for the USD notional at expiry, premium included for the option. */
  unhedged: number;
  forward: number;
  option: number;
}

/** CHF cost of the USD notional at expiry for a spot S_T at expiry. */
export function hedgeCosts(ST: number, h: HedgeSetup, f: HedgeFacts = hedgeFacts(h)): HedgeCosts {
  return {
    unhedged: ST * h.notional,
    forward: f.F * h.notional,
    option: (Math.min(ST, h.K) + f.premiumAtExpiry) * h.notional,
  };
}

/**
 * CHF saved by choice `a` against choice `b`, computed from the whole-franc amounts shown on
 * screen, so that "b − a" on screen equals the saving on screen.
 */
export function savingChf(c: HedgeCosts, a: HedgeChoice, b: HedgeChoice): number {
  return Math.round(c[b]) - Math.round(c[a]);
}

/** Cheapest and dearest choice in hindsight (ties: forward before option before unhedged). */
export function rankCosts(c: HedgeCosts): { cheapest: HedgeChoice; dearest: HedgeChoice } {
  const order: HedgeChoice[] = ['forward', 'option', 'unhedged'];
  const sorted = [...order].sort((a, b) => c[a] - c[b]);
  return { cheapest: sorted[0]!, dearest: sorted[2]! };
}

/**
 * Where S_T sits: 'weakUsd' (option beats the forward: you keep the cheaper dollar),
 * 'middle' (the option is the dearest choice: the price of the insurance),
 * 'strongUsd' (option beats staying unhedged: the cap works).
 */
export type HedgeRegion = 'weakUsd' | 'middle' | 'strongUsd';

export function hedgeRegion(ST: number, f: HedgeFacts): HedgeRegion {
  if (ST < f.optionBeatsForwardBelow) return 'weakUsd';
  if (ST > f.optionBeatsUnhedgedAbove) return 'strongUsd';
  return 'middle';
}

/** Range of the spot-at-expiry slider and chart (CHF per USD) and its step. */
export const ST_RANGE: readonly [number, number] = [0.72, 0.88];
export const ST_STEP = 0.0005;
/** Start value of the slider: a stronger dollar, the scenario the importer fears. */
export const ST_START = 0.84;
