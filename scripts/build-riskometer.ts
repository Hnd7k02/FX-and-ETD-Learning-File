/**
 * Builds the Riskometer data from the raw ECB file:
 *   data/raw/ecb-eur-reference.csv + src/data/events.json
 *     → src/data/fx/riskometer.json (all four pairs) and src/data/fx/summary.json (EUR/CHF)
 *
 *   npm run data:build
 *   options: --in <csv>  --events <json>  --out-dir <dir>
 *
 * Deterministic (same input → byte-identical output); files are only written when they change.
 * Exit code 1 if the raw data is invalid or an event cannot be computed.
 */
import { join } from 'node:path';
import { parseRawCsv } from '../src/lib/data/csv';
import { parseEvents } from '../src/lib/data/events';
import { PAIRS } from '../src/lib/data/series';
import { buildRiskometer, buildSummary, toJson } from '../src/lib/data/riskometer';
import { validate } from '../src/lib/data/validate';
import { parseArgs, readText, writeIfChanged } from './lib/cli';

function main(): number {
  const args = parseArgs(process.argv.slice(2));
  const input = args.in ?? 'data/raw/ecb-eur-reference.csv';
  const eventsPath = args.events ?? 'src/data/events.json';
  const outDir = args['out-dir'] ?? 'src/data/fx';

  const raw = readText(input);
  const evText = readText(eventsPath);
  if (raw === null || evText === null) {
    console.error(`Missing input: ${raw === null ? input : eventsPath}`);
    return 1;
  }
  const rows = parseRawCsv(raw);
  const errors = validate(rows);
  if (errors.length > 0) {
    console.error(`Raw data invalid (${errors.length} error(s)):`);
    for (const e of errors) console.error(`  [${e.rule}] ${e.message}`);
    return 1;
  }
  const events = parseEvents(JSON.parse(evText));
  const data = buildRiskometer(rows, events);
  const summary = buildSummary(data);

  const w1 = writeIfChanged(join(outDir, 'riskometer.json'), toJson(data));
  const w2 = writeIfChanged(join(outDir, 'summary.json'), toJson(summary));

  console.log(`Riskometer as of ${data.asOf} (${rows.length} fixings, ${events.length} events)`);
  for (const p of PAIRS) {
    const d = data.pairs[p];
    const t = d.thresholds;
    console.log(
      `  ${p}: vol ${d.current.vol.toFixed(2)} %, level ${d.current.level}, P${d.current.percentile.toFixed(1)}, needle ${d.current.needle.toFixed(3)} | P20 ${t.p20} P60 ${t.p60} P85 ${t.p85} P97 ${t.p97} max ${t.max} (${t.maxDate})`,
    );
  }
  console.log(
    `  riskometer.json ${w1 ? 'written' : 'unchanged'}, summary.json ${w2 ? 'written' : 'unchanged'}`,
  );
  return 0;
}

try {
  process.exit(main());
} catch (e) {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
}
