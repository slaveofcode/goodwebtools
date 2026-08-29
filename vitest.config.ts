import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
    // Vitest owns unit tests under src/; Playwright owns the e2e/ specs. Scoping
    // the include here stops vitest from matching e2e/*.spec.ts (which use the
    // Playwright runner and would fail as empty "0 test" suites).
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
  },
  resolve: {
    alias: {
      '@': '/src'
    }
  }
});
