import type { Config } from "@react-router/dev/config";

export default {
  appDirectory: "app",
  buildDirectory: "build",
  serverBuildFile: "index.mjs",
  ssr: true,
  
  // Server bundle configuration
  serverBundles: ({ branch }) => {
    return branch.some((route) => route.id === "root") ? "root" : branch[0]?.id || "default";
  },
} satisfies Config;

