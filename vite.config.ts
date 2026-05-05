import { reactRouter } from "@react-router/dev/vite";
import { defineConfig, type Plugin } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { execSync } from "child_process";
import { copyFileSync, mkdirSync } from "fs";
import { resolve } from "path";

// Copy Stockfish WASM files to public/ so they can be served as static assets.
// The engine JS file dynamically loads the matching .wasm from the same URL path.
function copyStockfish(): Plugin {
  const files = [
    'stockfish-18-lite-single.js',
    'stockfish-18-lite-single.wasm',
  ];
  const copy = () => {
    const bin = resolve('node_modules/stockfish/bin');
    const pub = resolve('public');
    mkdirSync(pub, { recursive: true });
    for (const f of files) {
      try {
        copyFileSync(resolve(bin, f), resolve(pub, f));
      } catch {
        // Non-fatal: warn only if the file is genuinely missing
        console.warn(`[copy-stockfish] Could not copy ${f}`);
      }
    }
  };
  return { name: 'copy-stockfish', buildStart: copy, configureServer: copy };
}

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
    copyStockfish(),
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