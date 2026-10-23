// @ts-check
import { defineConfig } from 'astro/config';
import preact from '@astrojs/preact';
import mdx from '@astrojs/mdx';

// Static site. German lives under /, English under /en/.
export default defineConfig({
  // Only used for canonical/hreflang tags of the intermediate web build; the deliverable is the
  // offline file release/forward-first.html (DECISIONS.md D-13).
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
