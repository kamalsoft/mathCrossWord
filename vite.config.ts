import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: '/mathCrossWord/',
  test: { environment: 'node', include: ['tests/**/*.test.ts'] },
});
