/** Small helpers shared by the data scripts (argument parsing, writing only on change). */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

/** Reads `--name value` pairs; flags without a value are set to "true". */
export function parseArgs(argv: readonly string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (!a.startsWith('--')) throw new Error(`Unexpected argument "${a}"`);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) out[a.slice(2)] = 'true';
    else {
      out[a.slice(2)] = next;
      i++;
    }
  }
  return out;
}

export function readText(path: string): string | null {
  const p = resolve(path);
  return existsSync(p) ? readFileSync(p, 'utf8') : null;
}

/** Writes the file only if its content differs; returns true if it was written. */
export function writeIfChanged(path: string, content: string): boolean {
  const p = resolve(path);
  if (existsSync(p) && readFileSync(p, 'utf8') === content) return false;
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, content);
  return true;
}
