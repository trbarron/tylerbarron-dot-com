import { reactRouter } from "@react-router/dev/vite";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { execSync } from "child_process";

// Get git version info at build time
function getGitVersion() {
  try {
    // Get the short commit hash
    const commitHash = execSync("git rev-parse --short HEAD").toString().trim();
    
    // Try to get the most recent tag
    let tag = "";
    try {
      tag = execSync("git describe --tags --abbrev=0").toString().trim();
    } catch {
      // No tags found, that's okay
    }
    
    // Format: "v1.2.3-abc1234" if tag exists, otherwise just "abc1234"
    return tag ? `${tag}-${commitHash}` : commitHash;
  } catch (error) {
    // Fallback if git is not available
    return "unknown";
  }
}

export default defineConfig({
  plugins: [
    reactRouter(),
    tsconfigPaths(),
  ],
  define: {
    __GIT_VERSION__: JSON.stringify(getGitVersion()),
  },
  build: {
    rollupOptions: {
      external: [
        '@react-router/node',
        'remix-utils/client-only'
      ],
    },
  },
});