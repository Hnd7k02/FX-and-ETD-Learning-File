import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import astro from 'eslint-plugin-astro';
import globals from 'globals';

export default [
  {
    ignores: [
      'dist/',
      '.astro/',
      'node_modules/',
      'coverage/',
      'playwright-report/',
      'test-results/',
      'docs/',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...astro.configs.recommended,
  {
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-non-null-assertion': 'off',
      'no-irregular-whitespace': [
        'error',
        { skipStrings: true, skipTemplates: true, skipJSXText: true, skipComments: true },
      ],
    },
  },
];
