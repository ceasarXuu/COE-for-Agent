import path from 'node:path';

import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

const CONSOLE_BFF_PORT = Number(process.env.CONSOLE_BFF_PORT ?? '4318');

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  server: {
    host: '127.0.0.1',
    port: Number(process.env.CONSOLE_WEB_V2_PORT ?? '4273'),
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
