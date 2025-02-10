import { vitePlugin as remix } from "@remix-run/dev";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [
    remix({
      future: {
        v3_fetcherPersist: true,
        v3_relativeSplatPath: true,
        v3_throwAbortReason: true,
      }
    }),
    tsconfigPaths(),
  ],
  build: {
    rollupOptions: {
      onwarn(warning, warn) {
        console.log('Build warning:', warning);
        warn(warning);
      },
      output: {
        manualChunks: {
          'recharts-chunk': [
            'recharts',
            'd3-shape',
            'd3-scale',
            'd3-array',
            'd3-interpolate'
          ],
        },
      },
    },
  },
  optimizeDeps: {
    include: ['recharts'],
  },
  logLevel: 'info',
});