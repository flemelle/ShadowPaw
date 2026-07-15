import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  base: './',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  server: {
    port: 5173,
    open: true,
    // Le jeu charge ses assets (musique/images/textures) depuis /public ; sans ceci,
    // le navigateur peut servir une version mise en cache après une modification de
    // fichier, ce qui se voit surtout après une actualisation en cours de session.
    headers: {
      'Cache-Control': 'no-store',
    },
  },
  preview: {
    headers: {
      'Cache-Control': 'no-store',
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
});
