/**
 * Sourced facts of module 03 (FX Swap) for <Fact id="…" />. Source entries are in
 * src/content/sources/03-fx-swap.md. The BIS figures are deliberately rounded ("around USD 4
 * trillion", "almost USD 10 trillion", "just over 40 %") so they hold for both the preliminary
 * release (30.09.2025: total USD 9.6 trillion, FX swaps USD 4.0 trillion) and the final data
 * of the BIS Quarterly Review of December 2025 (total USD 9.5 trillion).
 */
import type { FactTable } from './types';

export const facts: FactTable = {
  'm03-bis-month': { de: 'April 2025', en: 'April 2025', source: 'bis-triennial-2025' },
  'm03-bis-swaps': {
    de: 'rund USD 4 Billionen',
    en: 'around USD 4 trillion',
    source: 'bis-triennial-2025',
  },
  'm03-bis-total': {
    de: 'knapp USD 10 Billionen',
    en: 'almost USD 10 trillion',
    source: 'bis-triennial-2025',
  },
  'm03-bis-share': { de: 'gut 40 %', en: 'just over 40%', source: 'bis-triennial-2025' },
};
