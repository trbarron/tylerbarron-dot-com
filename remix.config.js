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
  browserNodeBuiltinsPolyfill: { 
    modules: { 
      events: true,
      querystring: true,
      util: true,
      punycode: true,
    } 
  },
  serverDependenciesToBundle: ['chessground'],
};