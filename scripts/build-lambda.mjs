import { build } from 'esbuild';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { isBuiltin } from 'node:module';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const serverDir = path.join(root, 'server');
const runtimePackages = ['@aws-sdk/client-sns'];
const browserPackages = ['@google/model-viewer', 'yet-another-react-lightbox'];

const { metafile, outputFiles } = await build({
  absWorkingDir: root,
  entryPoints: { index: 'server.ts' },
  outdir: serverDir,
  outExtension: { '.js': '.mjs' },
  chunkNames: 'chunks/[name]-[hash]',
  platform: 'node',
  target: 'node24',
  format: 'esm',
  bundle: true,
  splitting: true,
  minify: true,
  define: { 'process.env.NODE_ENV': '"production"' },
  // Some bundled CommonJS packages use require() for Node built-ins.
  banner: {
    js: "import { createRequire as createNodeRequire } from 'node:module'; const require = createNodeRequire(import.meta.url);",
  },
  external: [...runtimePackages, ...browserPackages],
  metafile: true,
  write: false,
});

for (const [file, output] of Object.entries(metafile.outputs)) {
  for (const specifier of output.imports) {
    if (!specifier.external || isBuiltin(specifier.path)) continue;
    if (
      specifier.kind === 'dynamic-import' &&
      (runtimePackages.includes(specifier.path) || browserPackages.includes(specifier.path))
    ) {
      continue;
    }
    throw new Error('Unexpected runtime import ' + specifier.path + ' in ' + file);
  }
}

// Remove leftovers from earlier builds, including the old unbundled layout.
for (const name of ['build', 'chunks', 'node_modules', 'package-lock.json']) {
  await rm(path.join(serverDir, name), { recursive: true, force: true });
}
for (const file of outputFiles) {
  await mkdir(path.dirname(file.path), { recursive: true });
  await writeFile(file.path, file.contents);
}
const bytes = outputFiles.reduce((total, file) => total + file.contents.length, 0);
console.log('Lambda bundle: %d files, %d bytes', outputFiles.length, bytes);
