/// <reference types="vitest/config" />
import { getViteConfig } from 'astro/config';

export default getViteConfig({
  test: {
    // Registries use import.meta.glob; the persistent module cache would hide newly added files.
    fsModuleCache: false,
    include: ['tests/unit/**/*.test.ts'],
    environment: 'node',
    // Monte Carlo tests take ~2 s locally; CI runners with coverage are several times slower.
    testTimeout: 30_000,
    coverage: {
      provider: 'v8',
      include: ['src/lib/**/*.ts'],
      exclude: ['src/lib/**/*.d.ts', 'src/lib/**/*.worker.ts', 'src/lib/risk-summary.ts'],
      reporter: ['text-summary', 'text', 'html'],
      thresholds: { lines: 90 },
    },
  },
});
