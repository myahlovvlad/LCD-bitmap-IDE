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

// Write a package.json into dist/main/ so Node treats .js as CJS
mkdirSync(outDir, { recursive: true });
writeFileSync(
  resolve(outDir, 'package.json'),
  JSON.stringify({ type: 'commonjs' }),
  'utf8'
);

await build({
  entryPoints: [resolve(root, 'src/main/main.ts')],
  bundle: true,
  platform: 'node',
  target: 'node18',
  format: 'cjs',
  outfile: resolve(outDir, 'main.cjs'),
  external: [
    'electron',
    'node:*',
    // Allow node builtins without the prefix too
    'fs', 'path', 'url', 'http', 'https', 'crypto', 'os', 'stream', 'events',
    'child_process', 'util', 'buffer', 'module'
  ],
  // __dirname is available natively in CJS, no define needed
  tsconfig: resolve(root, 'tsconfig.electron.json'),
  logLevel: 'info',
});

console.log('✅ Electron main process bundled → dist/main/main.cjs');
