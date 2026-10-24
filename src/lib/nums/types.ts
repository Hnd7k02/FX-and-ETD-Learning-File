/** A named number for <Num of="…" />. Values come from the calculation core, never typed in. */
export type NumKind = 'rate' | 'pips' | 'money' | 'pct' | 'num';

export interface NumDef {
  value: number;
  kind: NumKind;
  /** Currency code for kind "money" (default CHF). */
  ccy?: string;
  /** Decimal places; defaults: rate 4, pips 1, money 0, pct 1, num 2. */
  digits?: number;
  /** Show "+" for positive values. */
  sign?: boolean;
  /** Short description for maintainers. */
  note?: string;
}

export type NumTable = Record<string, NumDef>;
