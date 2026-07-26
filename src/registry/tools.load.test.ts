import { describe, it, expect } from 'vitest';
import { tools } from './tools';

/**
 * Regression guard for "Failed to fetch dynamically imported module" errors.
 *
 * Every tool is code-split behind a dynamic `load()` import. If an island has a
 * broken import path, a missing/renamed export, or a syntax/type error, that
 * dynamic import throws at runtime and the tool page shows the generic
 * "Failed to fetch dynamically imported module" message. Importing each island
 * here — through the same Vite pipeline the app uses — fails the build/test
 * loudly and names the exact tool instead.
 *
 * (Note: this cannot reproduce the *dev-server* variant of that error, which is
 * Vite's optimizer transiently returning 504 for a dep and is fixed by
 * restarting `npm run dev`. This covers the code-level causes.)
 */
describe('every tool island loads', () => {
  it.each(tools.map(tool => [tool.id, tool] as const))(
    'imports the "%s" island with a default component export',
    async (_id, tool) => {
      const mod = await tool.load();
      expect(mod).toBeTruthy();
      expect(typeof mod.default).toBe('function');
    }
  );
});
