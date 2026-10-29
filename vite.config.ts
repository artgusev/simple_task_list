import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    // In development the API runs separately (npm run dev:server) on port 3000.
    proxy: { '/api': 'http://localhost:3000' },
  },
  build: {
    outDir: 'dist/client',
    emptyOutDir: true,
  },
});
