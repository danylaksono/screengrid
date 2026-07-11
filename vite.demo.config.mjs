import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  root: 'demo/app',
  plugins: [react()],
  server: {
    port: 5174,
    strictPort: false,
    fs: {
      allow: ['../..']
    }
  },
  build: {
    outDir: '../../dist-demo',
    emptyOutDir: true
  }
});
