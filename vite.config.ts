import { reactRouter } from "@react-router/dev/vite";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig(({ mode }) => ({
  mode: mode || (process.env.NODE_ENV === 'production' ? 'production' : 'development'),
  plugins: [
    reactRouter(),
    tsconfigPaths(),
  ],
  build: {
    rollupOptions: {
      external: [
        'recharts',
        '@react-router/node',
        'react',
        'react-dom',
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
}));