import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';

function servePoseAssets(): Plugin {
  return {
    name: 'serve-pose-assets',
    configureServer(server) {
      server.middlewares.use('/assets/images', (req, res, next) => {
        const cleanUrl = (req.url || '').split('?')[0];
        const filename = path.basename(cleanUrl);
        const filePath = path.join(__dirname, 'assets/images', filename);
        if (filename && fs.existsSync(filePath)) {
          const ext = path.extname(filePath).toLowerCase();
          const mimeTypes: Record<string, string> = {
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.png': 'image/png',
            '.webp': 'image/webp',
          };
          res.setHeader('Content-Type', mimeTypes[ext] || 'image/jpeg');
          res.setHeader('Cache-Control', 'public, max-age=86400');
          fs.createReadStream(filePath).pipe(res);
          return;
        }
        next();
      });

      server.middlewares.use('/data', (req, res, next) => {
        const cleanUrl = (req.url || '').split('?')[0];
        const filename = path.basename(cleanUrl);
        const filePath = path.join(__dirname, 'data', filename);
        if (filename && fs.existsSync(filePath)) {
          const ext = path.extname(filePath).toLowerCase();
          const mimeTypes: Record<string, string> = {
            '.json': 'application/json',
            '.bin': 'application/octet-stream',
          };
          res.setHeader('Content-Type', mimeTypes[ext] || 'application/octet-stream');
          res.setHeader('Cache-Control', 'public, max-age=86400');
          fs.createReadStream(filePath).pipe(res);
          return;
        }
        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), servePoseAssets()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src/renderer'),
      '@core': path.resolve(__dirname, './src/renderer/core'),
      '@ui': path.resolve(__dirname, './src/renderer/ui'),
    },
  },
  server: {
    port: 5173,
    fs: {
      allow: ['..'],
    },
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
  build: {
    target: 'esnext',
    outDir: 'dist',
    emptyOutDir: true,
  },
});
