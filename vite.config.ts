import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base './' so the built bundle loads under Electron's local file server.
export default defineConfig({
  base: './',
  plugins: [react()],
  server: { port: 5173, strictPort: true },
  build: { outDir: 'dist', emptyOutDir: true },
});
