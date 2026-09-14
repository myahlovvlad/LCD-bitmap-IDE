import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import packageMetadata from './package.json';

export default defineConfig({
  plugins: [react()],
  define: {
    __APP_SOFTWARE_VERSION__: JSON.stringify(packageMetadata.version)
  },
  base: './',
  root: '.',
  build: {
    outDir: 'dist/renderer',
    emptyOutDir: false,
    chunkSizeWarningLimit: 520,
    rollupOptions: {
      output: {
        manualChunks: {
          'graph-vendor': ['@xyflow/react'],
          'ui-vendor': ['lucide-react']
        }
      }
    }
  },
  server: {
    host: '127.0.0.1',
    port: 5173
  }
});
