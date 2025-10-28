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
        'react',
        'react-dom',
        'react-router-utils/client-only'
      ],
    },
  },
  optimizeDeps: {
    exclude: ['recharts'],
  },
  ssr: {
    noExternal: true,
    external: ['recharts']
  },
});