/**
 * Build script for Electron main process.
 *
 * Uses esbuild to bundle src/main/main.ts into a CommonJS bundle
 * (dist/main/main.cjs) that works correctly in Electron without
 * ESM/CJS named-import conflicts introduced in Node.js 24.
 *
 * Usage: node scripts/build-electron-main.mjs
 */

import { build } from 'esbuild';
import { mkdirSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const outDir = resolve(root, 'dist/main');
const preloadOutDir = resolve(root, 'dist/preload');

// Write a package.json into dist/main/ so Node treats .js as CJS
mkdirSync(outDir, { recursive: true });
mkdirSync(preloadOutDir, { recursive: true });
writeFileSync(
  resolve(outDir, 'package.json'),
  JSON.stringify({ type: 'commonjs' }),
  'utf8'
);

const commonOptions = {
  bundle: true,
  platform: 'node',
  target: 'node18',
  format: 'cjs',
  external: [
    'electron',
    'node:*',
    // Allow node builtins without the prefix too
    'fs', 'path', 'url', 'http', 'https', 'crypto', 'os', 'stream', 'events',
    'child_process', 'util', 'buffer', 'module',
    'serialport', '@serialport/*'
  ],
  tsconfig: resolve(root, 'tsconfig.electron.json'),
  logLevel: 'info'
};

await Promise.all([
  build({
    ...commonOptions,
    entryPoints: [resolve(root, 'src/main/main.ts')],
    outfile: resolve(outDir, 'main.cjs')
  }),
  build({
    ...commonOptions,
    entryPoints: [resolve(root, 'src/preload/preload.cts')],
    outfile: resolve(preloadOutDir, 'preload.cjs')
  })
]);

console.log('✅ Electron main and preload processes bundled → dist/main/main.cjs, dist/preload/preload.cjs');
