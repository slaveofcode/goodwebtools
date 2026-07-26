import js from '@eslint/js';
import tsplugin from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';
import astro from 'eslint-plugin-astro';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';

// Flat config (ESLint 9). The `lint` script targets `src/`. Recommended rules,
// with the noisiest TypeScript rules relaxed to warnings so real errors gate CI
// without burying the (previously un-linted) codebase in failures.
export default [
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      '.astro/**',
      'public/**',
      'src-tauri/**',
      'coverage/**',
      '**/*.config.{js,mjs,cjs,ts}',
      'src/env.d.ts', // Astro-generated (triple-slash reference)
    ],
  },
  js.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: { jsx: true },
      },
      globals: { ...globals.browser, ...globals.node, ...globals.worker },
    },
    plugins: { '@typescript-eslint': tsplugin, 'react-hooks': reactHooks },
    rules: {
      ...tsplugin.configs.recommended.rules,
      'no-undef': 'off', // TypeScript handles this; avoids DOM/JSX false positives
      'no-unused-vars': 'off',
      'no-redeclare': 'off', // TypeScript handles global type merges
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' },
      ],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-empty-object-type': 'warn',
      '@typescript-eslint/triple-slash-reference': 'off',
      '@typescript-eslint/ban-ts-comment': 'warn',
      'no-empty': ['warn', { allowEmptyCatch: true }],
    },
  },
  ...astro.configs['flat/recommended'],
];
