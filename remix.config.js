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
      punycode: true,
      querystring: true,
      util: true,
    },
  },
  serverDependenciesToBundle: [
    "chessground",
    "@aws-sdk/client-dynamodb",
    "@aws-sdk/client-s3",
    "@aws-sdk/lib-dynamodb",
    'mnemonist',
    'mnemonist/lru-cache',
    'obliterator/iterator',
    'obliterator/foreach',
  ],

  // Future Flags (Enable all for now, but adjust as needed)
  future: {
    v3_fetcherPersist: true,
    v3_lazyRouteDiscovery: true,
    v3_relativeSplatPath: true,
    v3_singleFetch: true,
    v3_throwAbortReason: true,
  },
};