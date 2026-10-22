import type { L10n } from '@/i18n/types';

/** A sourced historical fact for <Fact id="…" />. `source` is a "## id" heading in sources.md. */
export interface FactDef extends L10n {
  source: string;
}
export type FactTable = Record<string, FactDef>;
