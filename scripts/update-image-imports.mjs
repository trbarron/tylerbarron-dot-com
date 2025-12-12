#!/usr/bin/env node
/**
 * Update image imports to use CDN helper
 * Converts: import falco1 from "~/images/SSBM/falco1.jpg"
 * To: const falco1 = getImageUrl('SSBM/falco1.jpg')
 */

import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

const filesToUpdate = [
  'app/routes/SSBM.tsx',
  'app/routes/camelUpCup.tsx',
  'app/routes/catTracker.blog.tsx',
  'app/routes/chesserGuesser.tsx',
  'app/routes/generativeArt.tsx',
  'app/routes/set.tsx',
  'app/routes/theRiddler.tsx',
  'app/components/Footer.tsx',
];

function updateFile(filePath) {
  const fullPath = join(projectRoot, filePath);
  console.log(`\n📝 Processing: ${filePath}`);

  try {
    let content = readFileSync(fullPath, 'utf-8');
    let modified = false;
    let importCount = 0;

    // Track if we need to add the import
    const hasImageImport = content.includes('from "~/images/');

    // Pattern to match: import variableName from "~/images/Path/file.ext";
    const importPattern = /import\s+(\w+)\s+from\s+["']~\/images\/(.*?)["'];?\s*\n/g;

    // Collect all imports to convert
    const imports = [];
    let match;
    while ((match = importPattern.exec(content)) !== null) {
      imports.push({
        fullMatch: match[0],
        varName: match[1],
        imagePath: match[2],
      });
      importCount++;
    }

    if (imports.length === 0) {
      console.log('  ℹ️  No image imports found');
      return { updated: false, count: 0 };
    }

    // Add CDN import if needed
    if (!content.includes("from '~/utils/cdn'") && !content.includes('from "~/utils/cdn"')) {
      // Find the last import statement
      const lastImportMatch = content.match(/import[^;]+;(?=\s*\n\s*\n)/g);
      if (lastImportMatch) {
        const lastImport = lastImportMatch[lastImportMatch.length - 1];
        const importIndex = content.indexOf(lastImport) + lastImport.length;
        content =
          content.slice(0, importIndex) +
          "\nimport { getImageUrl } from '~/utils/cdn';" +
          content.slice(importIndex);
        modified = true;
      }
    }

    // Convert each import to const assignment
    imports.forEach(({ fullMatch, varName, imagePath }) => {
      const replacement = `const ${varName} = getImageUrl('${imagePath}');\n`;
      content = content.replace(fullMatch, '');
      modified = true;

      // Add the const declaration after imports
      // Find the first line that's not an import
      const lines = content.split('\n');
      let insertIndex = 0;
      for (let i = 0; i < lines.length; i++) {
        if (!lines[i].trim().startsWith('import') && lines[i].trim() !== '') {
          insertIndex = i;
          break;
        }
      }

      // Insert at the right position
      const beforeInsert = content.substring(0, content.indexOf(lines[insertIndex]));
      const afterInsert = content.substring(content.indexOf(lines[insertIndex]));
      content = beforeInsert + replacement + afterInsert;
    });

    if (modified) {
      writeFileSync(fullPath, content, 'utf-8');
      console.log(`  ✅ Updated ${importCount} imports`);
      return { updated: true, count: importCount };
    }

    return { updated: false, count: 0 };
  } catch (error) {
    console.error(`  ❌ Error processing ${filePath}:`, error.message);
    return { updated: false, count: 0, error: error.message };
  }
}

function main() {
  console.log('🔄 Updating image imports to use CDN...\n');

  const results = {
    total: 0,
    updated: 0,
    totalImports: 0,
    errors: [],
  };

  filesToUpdate.forEach(file => {
    results.total++;
    const result = updateFile(file);
    if (result.updated) {
      results.updated++;
      results.totalImports += result.count;
    }
    if (result.error) {
      results.errors.push({ file, error: result.error });
    }
  });

  console.log('\n' + '='.repeat(60));
  console.log('📊 Update Summary');
  console.log('='.repeat(60));
  console.log(`📁 Files processed: ${results.total}`);
  console.log(`✅ Files updated: ${results.updated}`);
  console.log(`🖼️  Total imports converted: ${results.totalImports}`);

  if (results.errors.length > 0) {
    console.log(`\n❌ Errors: ${results.errors.length}`);
    results.errors.forEach(({ file, error }) => {
      console.log(`   - ${file}: ${error}`);
    });
  }

  console.log('\n✨ Done! Next steps:');
  console.log('   1. Review the changes with: git diff');
  console.log('   2. Test locally: npm run dev');
  console.log('   3. Verify images load from CDN');
  console.log('   4. Commit the changes\n');
}

main();
