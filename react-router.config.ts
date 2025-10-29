import type { Config } from "@react-router/dev/config";

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

  // React Router 7 already includes all v3 features by default
} satisfies Config;

