// @ts-check
import { defineConfig } from 'astro/config';
import preact from '@astrojs/preact';
import mdx from '@astrojs/mdx';

// Static site. German lives under /, English under /en/.
export default defineConfig({
  // Replaced by the production URL once Cloudflare is connected (see DECISIONS.md D-13).
  site: 'https://forward-first.pages.dev',
  output: 'static',
  trailingSlash: 'always',
  build: { format: 'directory' },
  integrations: [preact(), mdx()],
  i18n: {
    defaultLocale: 'de',
    locales: ['de', 'en'],
    routing: { prefixDefaultLocale: false },
  },
  prefetch: { prefetchAll: false, defaultStrategy: 'hover' },
  devToolbar: { enabled: false },
  // HTML-aware whitespace compression (Astro 7 defaults to JSX rules, which can eat spaces).
  compressHTML: true,
});
