import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/unit/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/renderer/core/**/*.ts'],
      exclude: ['src/renderer/core/library/seedPoses.ts', 'src/renderer/core/settings/constants.ts', 'src/renderer/core/library/types.ts'],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src/renderer'),
      '@core': path.resolve(__dirname, './src/renderer/core'),
      '@ui': path.resolve(__dirname, './src/renderer/ui'),
    },
  },
});
