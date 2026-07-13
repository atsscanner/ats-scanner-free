import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    sourcemap: false,
    minify: 'terser',
    target: 'es2022',
    rollupOptions: {
      input: 'public/index.html',
      output: {
        dir: 'dist'
      }
    }
  },
  root: 'public',
  server: {
    port: 5173,
    strictPort: false
  }
});
