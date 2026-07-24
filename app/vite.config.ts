import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  base: '/peer-poker/',
  plugins: [react(), tailwindcss()],
  // host: true binds 0.0.0.0 so the container's port-forward reaches the dev server
  server: { host: true, port: 8000, strictPort: true },
  preview: { host: true, port: 8000, strictPort: true },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    passWithNoTests: true,
  },
});
