/// <reference types="vitest/config" />
import { getViteConfig } from 'astro/config';

export default getViteConfig({
  test: {
    // Registries use import.meta.glob; the persistent module cache would hide newly added files.
    fsModuleCache: false,
    include: ['tests/unit/**/*.test.ts'],
    environment: 'node',
    coverage: {
      provider: 'v8',
      include: ['src/lib/**/*.ts'],
      exclude: ['src/lib/**/*.d.ts', 'src/lib/**/*.worker.ts', 'src/lib/risk-summary.ts'],
      reporter: ['text-summary', 'text', 'html'],
      thresholds: { lines: 90 },
    },
  },
});
