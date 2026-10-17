import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [react(), VitePWA({
    registerType: 'prompt',
    includeAssets: ['icon.svg', 'apple-touch-icon.png', 'sample.pdf', 'bosses/*.svg'],
    manifest: {
      name: 'Final Reader', short_name: 'Final Reader', lang: 'es',
      description: 'Cada página, una nueva conquista. Tu lector PDF privado con alma de RPG.',
      theme_color: '#100f16', background_color: '#100f16', display: 'standalone',
      start_url: '/', scope: '/',
      icons: [
        { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
        { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
        { src: '/icon-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
      ]
    },
    workbox: {
      globPatterns: ['**/*.{js,mjs,css,html,svg,png,pdf,wasm,bcmap,ttf,pfb}'],
      maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
      navigateFallback: '/index.html',
      cleanupOutdatedCaches: true,
      clientsClaim: true
    }
  })],
  build: { chunkSizeWarningLimit: 1800 }
});
