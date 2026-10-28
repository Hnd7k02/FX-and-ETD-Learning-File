/**
 * Typed access to the generated Riskometer data for pages and islands:
 * src/data/fx/riskometer.json (npm run data:build) and src/data/events.json.
 *
 * Example (event card for EUR/CHF in German):
 *   const ev = eventsFor('EUR/CHF')[0];
 *   const m = RISKOMETER.pairs['EUR/CHF'].events[ev.id];
 *   const texts = eventTexts(ev, 'EUR/CHF', 'de', m);   // placeholders filled
 */
import eventsJson from '@/data/events.json';
import riskometerJson from '@/data/fx/riskometer.json';
import { eventsForPair, parseEvents, type MarketEvent } from './events';
import type { PairData, RiskometerData } from './riskometer';
import type { Pair } from './series';

export const RISKOMETER = riskometerJson as unknown as RiskometerData;

/** All events, validated against the placeholder contract. */
export const EVENTS: MarketEvent[] = parseEvents(eventsJson);

export function pairData(pair: Pair): PairData {
  return RISKOMETER.pairs[pair];
}

/** Events shown for a pair, in chronological (file) order. */
export function eventsFor(pair: Pair): MarketEvent[] {
  return eventsForPair(EVENTS, pair);
}
