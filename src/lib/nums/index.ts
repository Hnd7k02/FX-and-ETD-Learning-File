/**
 * Registry of named numbers used in MDX via <Num of="…" />.
 * Each file src/lib/nums/<ns>.ts exports `nums` whose keys start with "<ns>.".
 * Files are merged automatically; tests/unit/nums.test.ts checks prefixes and duplicates.
 */
import type { NumDef, NumTable } from './types';

const modules = import.meta.glob<{ nums: NumTable }>('./*.ts', { eager: true });

export const NUM_FILES: Record<string, NumTable> = {};
export const NUMS: NumTable = {};
for (const [path, mod] of Object.entries(modules)) {
  if (!mod.nums) continue;
  const ns = path.replace(/^\.\//, '').replace(/\.ts$/, '');
  NUM_FILES[ns] = mod.nums;
  Object.assign(NUMS, mod.nums);
}

export function getNum(key: string): NumDef {
  const def = NUMS[key];
  if (!def) throw new Error(`<Num of="${key}"> is not registered in src/lib/nums`);
  return def;
}

export type { NumDef, NumTable } from './types';
export { formatNum } from './format';
