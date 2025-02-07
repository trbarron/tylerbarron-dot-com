import path from "node:path";

const isProduction = process.env.NODE_ENV === "production";

/** @type {import('@remix-run/dev').AppConfig} */
export default {
  cacheDirectory: "./node_modules/.cache/remix",
  ignoredRouteFiles: ["**/.*", "**/*.test.{js,jsx,ts,tsx}"],
  assetsBuildDirectory: "public/build",
  publicPath: "/_static/build/",
  server: "./server.ts",
  serverBuildPath: "server/index.mjs",
  serverModuleFormat: "esm",
  serverMinify: true,
  serverMode: isProduction ? "production" : "development",
  browserNodeBuiltinsPolyfill: {
    modules: {
      crypto: true,
      events: true,
      fs: true,
      path: true,
    },
  },
  serverDependenciesToBundle: [
    'obliterator/iterator',
    'obliterator/foreach',
    'd3-geo/dist/d3-geo.min.js',
    'topojson-client/dist/topojson-client.min.js',
    'mdx-bundler',
    'rehype-highlight',
    'rehype-img-size',
    'remark-gfm'
  ],
  externals: [
    'typescript',
    'vite',
    '@babel/*',
    '@esbuild/*',
    '@typescript-eslint/*',
    'prettier',
    'tailwindcss',
    'es-abstract',
    'highlight.js',
    '@vanilla-extract/*',
    'leveldown',
    'web-streams-polyfill',
    '@smithy/*',
    '@zxing/*',
    'lodash',
    '@jspm/*',
    '@types/*',
    'eslint*',
    'caniuse-lite',
    '@rollup/*',
    'rollup',
    'jiti',
    'axe-core',
    'yaml',
    'zip-dir',
    'victory-vendor'
  ],

  future: {
    v3_fetcherPersist: true,
    v3_lazyRouteDiscovery: true,
    v3_relativeSplatPath: true,
    v3_singleFetch: true,
    v3_throwAbortReason: true,
  },
};