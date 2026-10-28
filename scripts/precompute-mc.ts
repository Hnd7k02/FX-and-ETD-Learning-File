/**
 * Precomputes the fair strikes, coupons and pivot width of the structured products (§8.7) by
 * Monte Carlo and writes them with path count and standard error:
 *     → src/data/fx/mc-products.json
 *
 *   npm run data:mc
 *   options: --paths <n>  --seed <n>  --out <json>
 *
 * Parameters, paths and seed come from MC_CONFIG (src/lib/fx/mc/products.ts). Deterministic for
 * a given config: only generatedAt (the date) changes between runs; the runtime is printed.
 */
import { MC_CONFIG } from '../src/lib/fx/mc/products';
import { precomputeMcProducts } from '../src/lib/fx/mc/precompute';
import { parseArgs, writeIfChanged } from './lib/cli';

function main(): number {
  const args = parseArgs(process.argv.slice(2));
  const paths = args.paths ? Number(args.paths) : MC_CONFIG.engine.precomputePaths;
  const seed = args.seed ? Number(args.seed) : MC_CONFIG.engine.seed;
  const out = args.out ?? 'src/data/fx/mc-products.json';

  console.log(
    `Monte Carlo: ${paths.toLocaleString('en')} paths (antithetic), seed ${seed}, daily steps`,
  );
  const t0 = Date.now();
  const data = precomputeMcProducts({ paths, seed, log: (m) => console.log(`  ${m}`) });
  const seconds = (Date.now() - t0) / 1000;
  const written = writeIfChanged(out, `${JSON.stringify(data, null, 2)}\n`);
  console.log(`${written ? 'Wrote' : 'Unchanged'} ${out} in ${seconds.toFixed(1)} s`);
  return 0;
}

process.exit(main());
