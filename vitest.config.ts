import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths()],
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
