/**
 * Sourced facts of module 01 (FX market & spot) for <Fact id="…" />. Sources in
 * src/content/sources/01-spot.md: the BIS Triennial Survey 2025 (preliminary press release of
 * 30.09.2025 and the final figures in the BIS Quarterly Review of December 2025). The size of
 * the dollar's fall in April 2025 is not a fact here but computed from the ECB reference rates
 * (src/lib/nums/m01.ts, m01.apr25…).
 */
import type { FactTable } from './types';

export const facts: FactTable = {
  /** Final figure (QR December 2025); the preliminary press release said USD 9.6 trillion. */
  'm01-bis-turnover': {
    de: 'USD 9.5 Billionen',
    en: 'USD 9.5 trillion',
    source: 'bis-qr-2025-12-fx',
  },
  'm01-bis-month': { de: 'April 2025', en: 'April 2025', source: 'bis-qr-2025-12-fx' },
  'm01-bis-usd-share': { de: '89 %', en: '89%', source: 'bis-press-2025-09-30' },
  'm01-bis-chf-rank': {
    de: 'sechstmeistgehandelte',
    en: 'sixth most traded',
    source: 'bis-press-2025-09-30',
  },
  'm01-tariff-date': {
    de: '2. April 2025',
    en: '2 April 2025',
    source: 'bis-qr-2025-12-foreword',
  },
};
