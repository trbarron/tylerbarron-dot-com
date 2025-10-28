import type { Config } from "@react-router/dev/config";

const isProduction = process.env.NODE_ENV === "production";

export default {
  appDirectory: "app",
  assetsBuildDirectory: "public/build",
  publicPath: "/_static/build/",
  serverBuildFile: "index.mjs",
  serverMinify: true,
  serverModuleFormat: "esm",
  ssr: true,
  
  // Server bundle configuration
  serverBundles: ({ branch }) => {
    return branch.some((route) => route.id === "root") ? "root" : branch[0]?.id || "default";
  },

  future: {
    // React Router 7 is already v3, so these flags are defaults
    v3_fetcherPersist: true,
    v3_relativeSplatPath: true,
    v3_throwAbortReason: true,
    v3_singleFetch: true,
    v3_lazyRouteDiscovery: true,
  },
} satisfies Config;

