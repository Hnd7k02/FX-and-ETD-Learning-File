/**
 * Fetches the ECB euro reference rates (USD, CHF, JPY per EUR) from the ECB Data Portal,
 * validates them and updates data/raw/ecb-eur-reference.csv if they changed.
 *
 *   npm run data:fetch                               live fetch, today = current UTC date
 *   npm run data:fetch -- --from-file <csvdata.csv>  offline / tests (ECB csvdata format)
 *   options: --out <path>  --today <YYYY-MM-DD>
 *
 * Exit code 1 if the download fails or the data does not pass the validation (MASTER_PROMPT §9);
 * the file is then left untouched. Exit code 0 otherwise (updated or unchanged).
 */
import { parseEcbCsv, parseRawCsv, serializeRawCsv, type RawRow } from '../src/lib/data/csv';
import { todayIso } from '../src/lib/data/dates';
import { checkContinuity, validate } from '../src/lib/data/validate';
import { parseArgs, readText, writeIfChanged } from './lib/cli';

export const ECB_URL =
  'https://data-api.ecb.europa.eu/service/data/EXR/D.USD+CHF+JPY.EUR.SP00.A?startPeriod=1999-01-04&format=csvdata';
const DEFAULT_OUT = 'data/raw/ecb-eur-reference.csv';

async function download(url: string): Promise<string> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { Accept: 'text/csv' },
        signal: AbortSignal.timeout(60_000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
      return await res.text();
    } catch (e) {
      lastError = e;
      console.warn(`fetch attempt ${attempt} failed: ${String(e)}`);
      if (attempt < 3) await new Promise((r) => setTimeout(r, attempt * 5_000));
    }
  }
  throw new Error(`ECB download failed: ${String(lastError)}`);
}

function describe(rows: readonly RawRow[]): string {
  const last = rows[rows.length - 1];
  if (!last) return 'no rows';
  return `${rows.length} fixings ${rows[0]!.date} … ${last.date}; last: USD ${last.USD}, CHF ${last.CHF}, JPY ${last.JPY} per EUR`;
}

async function main(): Promise<number> {
  const args = parseArgs(process.argv.slice(2));
  const out = args.out ?? DEFAULT_OUT;
  const today = args.today ?? todayIso();

  const text = args['from-file'] ? readText(args['from-file']) : await download(ECB_URL);
  if (text === null) {
    console.error(`File not found: ${args['from-file']}`);
    return 1;
  }
  const { rows, skipped } = parseEcbCsv(text);
  console.log(`ECB csvdata: ${describe(rows)}${skipped ? ` (${skipped} observations ignored)` : ''}`);

  const errors = validate(rows, { today });
  const prevText = readText(out);
  const prev = prevText ? parseRawCsv(prevText) : [];
  const continuity = checkContinuity(prev, rows);
  errors.push(...continuity.errors);

  if (errors.length > 0) {
    console.error(`Validation failed (${errors.length} error(s)); ${out} left unchanged:`);
    for (const e of errors) console.error(`  [${e.rule}] ${e.message}`);
    return 1;
  }

  const written = writeIfChanged(out, serializeRawCsv(rows));
  console.log(
    written
      ? `Updated ${out}: ${continuity.added} new fixing(s), ${continuity.revised.length} revised day(s)${
          continuity.revised.length ? ` (${continuity.revised.slice(0, 5).join(', ')})` : ''
        }.`
      : `${out} unchanged.`,
  );
  return 0;
}

main().then(
  (code) => process.exit(code),
  (e: unknown) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  },
);
