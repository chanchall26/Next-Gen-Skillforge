import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  oxc: { jsx: { runtime: 'automatic' } },
  resolve: {
    alias: { '@': path.resolve(__dirname) },
  },
  test: {
    environment: 'node',
    include: ['__tests__/**/*.test.ts', '__tests__/**/*.test.tsx'],
    exclude: ['node_modules', 'out', '.next', 'coverage'],
    globals: true,
  },
});
