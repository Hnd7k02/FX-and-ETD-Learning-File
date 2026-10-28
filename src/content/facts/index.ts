/**
 * Registry of sourced facts used in MDX via <Fact id="…" />.
 * Each file src/content/facts/<ns>.ts exports `facts`. Every fact names a source id that
 * must exist as a "## id" heading in src/content/sources.md (checked by the content lint).
 */
import type { FactDef, FactTable } from './types';

const modules = import.meta.glob<{ facts: FactTable }>('./*.ts', { eager: true });

export const FACTS: FactTable = {};
for (const mod of Object.values(modules)) {
  if (mod.facts) Object.assign(FACTS, mod.facts);
}

export function getFact(id: string): FactDef {
  const f = FACTS[id];
  if (!f) throw new Error(`<Fact id="${id}"> is not registered in src/content/facts`);
  return f;
}

export type { FactDef, FactTable } from './types';
