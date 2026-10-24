import type { Lang } from '@/i18n/types';
import { fmtMoney, fmtNumber, fmtPct, fmtPips, fmtRate } from '@/lib/format';
import type { NumDef } from './types';

export interface NumOverrides {
  digits?: number;
  sign?: boolean;
}

/** Formats a registered number for the given language. */
export function formatNum(def: NumDef, lang: Lang, o: NumOverrides = {}): string {
  const sign = o.sign ?? def.sign ?? false;
  switch (def.kind) {
    case 'rate': {
      const s = fmtRate(def.value, 'USD/CHF', o.digits ?? def.digits ?? 4);
      return sign && def.value > 0 ? `+${s}` : s;
    }
    case 'pips':
      return fmtPips(def.value, lang, o.digits ?? def.digits ?? 1, sign);
    case 'money':
      return fmtMoney(def.value, def.ccy ?? 'CHF', lang, o.digits ?? def.digits ?? 0, sign);
    case 'pct':
      return fmtPct(def.value, lang, o.digits ?? def.digits ?? 1, sign);
    case 'num':
      return fmtNumber(def.value, lang, { digits: o.digits ?? def.digits ?? 2, sign });
  }
}
