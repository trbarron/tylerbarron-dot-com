import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Vite 8 resolves tsconfig `paths` natively; this replaces the
  // vite-tsconfig-paths plugin, which Vite now warns is redundant.
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    // Unit tests are *.test.ts; *.spec.ts under tests/visual are Playwright
    // specs run via `npm run test:visual`, not Vitest.
    include: ['tests/**/*.test.{ts,tsx}'],
    exclude: ['tests/visual/**', 'node_modules/**'],
  },
});
