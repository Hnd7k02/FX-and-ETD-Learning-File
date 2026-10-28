/**
 * Sourced facts of module 02 (Forward) for <Fact id="…" />. Source in
 * src/content/sources/02-forward.md: the preliminary results of the BIS Triennial Survey 2025
 * (statistical release and commentary of 30.09.2025). Everything else in the module is computed
 * from the running example or is textbook knowledge (covered interest parity, day counts,
 * forward-point quoting conventions).
 */
import type { FactTable } from './types';

export const facts: FactTable = {
  /** Share of outright forwards in global OTC FX turnover, April 2025 (2022: 15 %). */
  'm02-bis-fwd-share': { de: '19 %', en: '19%', source: 'bis-rpfx25-fx' },
  /** Growth of outright forward turnover from April 2022 to April 2025. */
  'm02-bis-fwd-growth': { de: '60 %', en: '60%', source: 'bis-rpfx25-fx' },
  'm02-bis-month': { de: 'April 2025', en: 'April 2025', source: 'bis-rpfx25-fx' },
};
