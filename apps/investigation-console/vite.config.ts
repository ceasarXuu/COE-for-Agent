import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const CONSOLE_BFF_PORT = Number(process.env.CONSOLE_BFF_PORT ?? '4318');

export default defineConfig({
  plugins: [react()],
  server: {
    port: Number(process.env.CONSOLE_WEB_PORT ?? '4173'),
    proxy: {
      '/api': {
        target: `http://127.0.0.1:${CONSOLE_BFF_PORT}`,
        changeOrigin: true
      }
    }
  },
  build: {
    outDir: 'dist'
  }
});