import { reactRouter } from "@react-router/dev/vite";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [
    reactRouter(),
    tsconfigPaths(),
  ],
  build: {
    rollupOptions: {
      external: [
        'recharts',
        '@react-router/node',
        'remix-utils/client-only'
      ],
    },
  },
  optimizeDeps: {
    exclude: ['recharts'],
  },
  ssr: {
    external: ['recharts'],
  },
});