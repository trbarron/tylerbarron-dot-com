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
  
  // React Router 7 automatically discovers routes in app/routes/
  // No need to explicitly define routes
  
  // Server bundle configuration
  serverBundles: ({ branch }) => {
    return branch.some((route) => route.id === "root") ? "root" : branch[0]?.id || "default";
  },

  // React Router 7 already includes all v3 features by default
} satisfies Config;

