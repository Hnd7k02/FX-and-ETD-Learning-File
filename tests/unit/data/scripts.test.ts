/**
 * End-to-end runs of the data scripts with tsx (offline, on fixtures):
 * scripts/fetch-ecb.ts --from-file … and scripts/build-riskometer.ts --out-dir ….
 */
import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { parseRawCsv, serializeRawCsv } from '@/lib/data/csv';

const FIX = 'tests/fixtures/data';
const TSX = 'node_modules/tsx/dist/cli.mjs';
const tmp = mkdtempSync(join(tmpdir(), 'ff-data-'));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

function run(script: string, args: string[]) {
  const r = spawnSync(process.execPath, [TSX, script, ...args], { encoding: 'utf8', timeout: 60_000 });
  return { code: r.status, out: r.stdout + r.stderr };
}

describe('scripts/fetch-ecb.ts', () => {
  const out = join(tmp, 'ecb.csv');
  const seedTail = serializeRawCsv(parseRawCsv(readFileSync('data/raw/ecb-eur-reference.csv', 'utf8')).slice(-30));

  it('pivots valid csvdata into the raw file and reports a summary', () => {
    const r = run('scripts/fetch-ecb.ts', ['--from-file', `${FIX}/ecb-csvdata.csv`, '--out', out, '--today', '2026-09-15']);
    expect(r.code, r.out).toBe(0);
    expect(r.out).toMatch(/30 fixings 2026-08-04 … 2026-09-14/);
    expect(r.out).toMatch(/Updated .*30 new fixing/);
    expect(readFileSync(out, 'utf8')).toBe(seedTail);
  }, 60_000);

  it('leaves an identical file untouched', () => {
    const r = run('scripts/fetch-ecb.ts', ['--from-file', `${FIX}/ecb-csvdata.csv`, '--out', out, '--today', '2026-09-15']);
    expect(r.code, r.out).toBe(0);
    expect(r.out).toMatch(/unchanged/);
  }, 60_000);

  it('exits 1 without writing when validation fails', () => {
    const r = run('scripts/fetch-ecb.ts', ['--from-file', `${FIX}/ecb-csvdata-invalid.csv`, '--out', out, '--today', '2026-09-15']);
    expect(r.code).toBe(1);
    expect(r.out).toMatch(/\[jump\] USD\/JPY 2026-09-14/);
    expect(readFileSync(out, 'utf8')).toBe(seedTail);
  }, 60_000);

  it('exits 1 when the data is stale or would lose history', () => {
    const stale = run('scripts/fetch-ecb.ts', ['--from-file', `${FIX}/ecb-csvdata.csv`, '--out', out, '--today', '2026-10-22']);
    expect(stale.code).toBe(1);
    expect(stale.out).toMatch(/\[stale\]/);
    const longer = join(tmp, 'longer.csv');
    copyFileSync('data/raw/ecb-eur-reference.csv', longer);
    const lost = run('scripts/fetch-ecb.ts', ['--from-file', `${FIX}/ecb-csvdata.csv`, '--out', longer, '--today', '2026-09-15']);
    expect(lost.code).toBe(1);
    expect(lost.out).toMatch(/\[continuity\]/);
    expect(run('scripts/fetch-ecb.ts', ['--from-file', join(tmp, 'missing.csv')]).code).toBe(1);
    expect(run('scripts/fetch-ecb.ts', ['oops']).code).toBe(1);
  }, 60_000);
});

describe('scripts/build-riskometer.ts', () => {
  it('reproduces the committed JSON from the raw data', () => {
    const dir = join(tmp, 'fx');
    const r = run('scripts/build-riskometer.ts', ['--out-dir', dir]);
    expect(r.code, r.out).toBe(0);
    expect(r.out).toMatch(/EUR\/CHF: vol \d+\.\d+ %, level [1-5]/);
    expect(readFileSync(join(dir, 'riskometer.json'), 'utf8')).toBe(readFileSync('src/data/fx/riskometer.json', 'utf8'));
    expect(readFileSync(join(dir, 'summary.json'), 'utf8')).toBe(readFileSync('src/data/fx/summary.json', 'utf8'));
    expect(run('scripts/build-riskometer.ts', ['--out-dir', dir]).out).toMatch(/riskometer.json unchanged/);
  }, 60_000);

  it('exits 1 on invalid raw data or missing input', () => {
    const bad = join(tmp, 'bad.csv');
    writeFileSync(bad, 'date,USD,CHF,JPY\n2026-01-06,1.1,0.9,180\n2026-01-05,1.1,0.9,180\n');
    const r = run('scripts/build-riskometer.ts', ['--in', bad, '--out-dir', join(tmp, 'x')]);
    expect(r.code).toBe(1);
    expect(r.out).toMatch(/\[order\]/);
    expect(run('scripts/build-riskometer.ts', ['--in', join(tmp, 'nope.csv')]).code).toBe(1);
    const brokenEvents = join(tmp, 'events.json');
    writeFileSync(brokenEvents, '{}');
    const e = run('scripts/build-riskometer.ts', ['--events', brokenEvents, '--out-dir', join(tmp, 'y')]);
    expect(e.code).toBe(1);
    expect(e.out).toMatch(/top level must be a list/);
  }, 60_000);
});
