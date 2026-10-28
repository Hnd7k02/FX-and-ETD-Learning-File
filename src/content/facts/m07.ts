/**
 * Sourced facts of module 07 (Barrier & Binary) for <Fact id="…" />. The SNB sources are the
 * entries `snb-2011-09-06` and `snb-2015-01-15` of src/content/sources/riskometer.md (reused, not
 * duplicated); the SNB rate of −0.75 % reuses the fact `m05-snb-2015-rate`. The ECB fixing time
 * is sourced in src/content/sources/07-barrier-binary.md.
 */
import type { FactTable } from './types';

export const facts: FactTable = {
  'm07-floor': { de: '1.20', en: '1.20', source: 'snb-2011-09-06' },
  'm07-floor-start': { de: '06.09.2011', en: '6 September 2011', source: 'snb-2011-09-06' },
  'm07-floor-end': { de: '15.01.2015', en: '15 January 2015', source: 'snb-2015-01-15' },
  'm07-ecb-time': {
    de: 'um ca. 14:10 MEZ',
    en: 'at around 14:10 CET',
    source: 'ecb-reference-rates-method',
  },
};
