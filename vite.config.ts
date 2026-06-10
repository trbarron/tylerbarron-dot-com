import { reactRouter } from "@react-router/dev/vite";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { execSync } from "child_process";
import { readFileSync } from "fs";

// Semantic version is the single source of truth (package.json). It works even
// in CI's shallow clone, where git tags are unavailable.
const pkg = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf-8"));

// Short commit hash for build traceability; empty when git is unavailable.
function getGitCommit() {
  try {
    return execSync("git rev-parse --short HEAD").toString().trim();
  } catch {
    return "";
  }
}

// Strip trailing slash then add one so base is always "https://cdn.example.com/"
const cdnUrl = process.env.VITE_CDN_URL?.replace(/\/?$/, '/');

export default defineConfig({
  base: cdnUrl ?? '/',
  plugins: [
    reactRouter(),
    tsconfigPaths(),
  ],
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __GIT_COMMIT__: JSON.stringify(getGitCommit()),
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