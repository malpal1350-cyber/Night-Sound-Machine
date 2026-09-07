import { defineConfig } from 'vitest/config';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    define: {
      __APP_VERSION__: JSON.stringify('1.0.0'),
    },
  },
  define: {
    __APP_VERSION__: JSON.stringify('1.0.0'),
  },
});
