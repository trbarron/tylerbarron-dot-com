#!/usr/bin/env node
// Bundle size analyzer for production builds

import { readFileSync, readdirSync, statSync } from 'fs';
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
        files.forEach(file => recurse(join(path, file)));
      } else {
        totalSize += stat.size;
      }
    } catch (err) {
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
} catch (err) {
  console.log('Server Bundle: Not found (run build first)');
}

try {
  // Analyze node_modules
  const nodeModulesSize = getDirSize('server/node_modules');
  console.log(`Server Dependencies: ${formatBytes(nodeModulesSize)}`);
} catch (err) {
  console.log('Server Dependencies: Not found');
}

try {
  // Analyze build directory
  const buildSize = getDirSize('server/build');
  console.log(`Build Assets: ${formatBytes(buildSize)}`);
} catch (err) {
  console.log('Build Assets: Not found');
}

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
} catch (err) {
  console.log('\nTotal Server Size: Not found');
}

// Analyze largest dependencies
console.log('\n📚 Analyzing Dependencies...\n');

try {
  const packageJson = JSON.parse(readFileSync('server/package.json', 'utf-8'));
  const deps = Object.keys(packageJson.dependencies || {});
  
  const depSizes = deps.map(dep => {
    try {
      const depPath = join('server/node_modules', dep);
      const size = getDirSize(depPath);
      return { name: dep, size };
    } catch {
      return { name: dep, size: 0 };
    }
  }).sort((a, b) => b.size - a.size);
  
  console.log('Top 10 Largest Dependencies:');
  depSizes.slice(0, 10).forEach((dep, i) => {
    if (dep.size > 0) {
      console.log(`${i + 1}. ${dep.name}: ${formatBytes(dep.size)}`);
    }
  });
  
  // Identify optimization opportunities
  console.log('\n💡 Optimization Suggestions:\n');
  
  const largeDeps = depSizes.filter(d => d.size > 5 * 1024 * 1024); // > 5MB
  if (largeDeps.length > 0) {
    console.log('Consider these large dependencies:');
    largeDeps.forEach(dep => {
      console.log(`  - ${dep.name} (${formatBytes(dep.size)})`);
      console.log(`    → Consider lighter alternatives or Lambda layers`);
    });
  }
} catch (err) {
  console.log('Could not analyze dependencies:', err.message);
}

console.log('\n');

