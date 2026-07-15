import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    pool: 'threads',
    fileParallelism: false,
    maxWorkers: 1,
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json-summary'],
      include: [
        'src/entities/**/*.ts',
        'src/renderer/core/**/*.ts',
        'src/renderer/utils/**/*.ts',
        'src/shared/**/*.ts'
      ],
      exclude: [
        'src/renderer/core/fonts.ts',
        'src/renderer/core/rendererEngine.ts',
        'src/shared/constants/**'
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        statements: 80,
        branches: 75
      }
    }
  }
});
