#!/usr/bin/env node
// Bundle size analyzer for production builds

import { readdirSync, statSync } from 'fs';
import { join } from 'path';

function formatBytes(bytes) {
  return `${(bytes / 1024 / 1024).toFixed(2)}MB`;
}

function getDirSize(dirPath) {
  let totalSize = 0;

  function recurse(path) {
    try {
      const stat = statSync(path);
      if (stat.isDirectory()) {
        const files = readdirSync(path);
        files.forEach((file) => recurse(join(path, file)));
      } else {
        totalSize += stat.size;
      }
    } catch {
      // Ignore errors
    }
  }

  recurse(dirPath);
  return totalSize;
}

console.log('\n📊 Bundle Size Analysis\n');

try {
  // Analyze server bundle
  const serverBundle = statSync('server/index.mjs');
  console.log(`Server Bundle: ${formatBytes(serverBundle.size)}`);
} catch {
  console.log('Server Bundle: Not found (run build first)');
}

console.log(`Server Chunks: \${formatBytes(getDirSize('server/chunks'))}`);

try {
  // Total server size
  const totalSize = getDirSize('server');
  console.log(`\n📦 Total Server Size: ${formatBytes(totalSize)}`);

  // Check against Lambda limits
  const maxUncompressed = 250 * 1024 * 1024; // 250MB uncompressed
  const maxZipped = 50 * 1024 * 1024; // 50MB zipped

  if (totalSize > maxUncompressed) {
    console.log('⚠️  WARNING: Size exceeds Lambda uncompressed limit (250MB)');
  } else {
    const percentUsed = ((totalSize / maxUncompressed) * 100).toFixed(1);
    console.log(`✅ ${percentUsed}% of Lambda limit used`);
  }

  // Estimate compressed size (rough estimate: 20-30% of uncompressed)
  const estimatedZipped = totalSize * 0.25;
  console.log(`📦 Estimated Compressed: ${formatBytes(estimatedZipped)}`);

  if (estimatedZipped > maxZipped) {
    console.log('⚠️  WARNING: Estimated compressed size exceeds Lambda limit (50MB)');
  }
} catch {
  console.log('\nTotal Server Size: Not found');
}
