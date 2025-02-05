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
  serverMetafile: "server/metafile.json",
  serverModuleFormat: "esm",
  serverMinify: true,
  serverMode: isProduction ? "production" : "development",
  
  serverMinifyOptions: {
    dead_code: true,
    global_defs: {
      "@process.env.NODE_ENV": "'production'"
    }
  },
  
  browserNodeBuiltinsPolyfill: {
    modules: {
      crypto: false,
      events: true,
      fs: true,
      path: true,
      punycode: true,
      querystring: true,
      util: true,
    },
  },
  
  serverDependenciesToBundle: [
    'mnemonist/lru-cache',
    'obliterator/iterator',
    'obliterator/foreach',
    'd3-geo/dist/d3-geo.min.js',
    'topojson-client/dist/topojson-client.min.js',
    '@remix-run/node',
    'react',
    'react-dom',
    'react-router-dom',
    'react-router'
  ],
  serverConditions: ["worker", "import", "require", "production", "default"],
  
  serverAnalyzeCommonDependencies: true,

  future: {
    v3_fetcherPersist: true,
    v3_lazyRouteDiscovery: true,
    v3_relativeSplatPath: true,
    v3_singleFetch: true,
    v3_throwAbortReason: true,
  },
};