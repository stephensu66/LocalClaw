import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
  },
  resolve: {
    alias: {
      '@openclaw/web-app': path.resolve(__dirname, '../web/src'),
      '@openclaw/shared': path.resolve(__dirname, '../../packages/shared/src'),
    },
  },
});
