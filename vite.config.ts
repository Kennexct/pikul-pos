import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';
import type { Plugin } from 'vite';
import { defineConfig } from 'vitest/config';
import { VitePWA } from 'vite-plugin-pwa';

/** Dev/preview: deep links under /app/ serve the app shell (Cloudflare does this with public/_redirects). */
const appFallback = (): Plugin => {
  const rewrite = (req: { url?: string }) => {
    if (req.url && /^\/app(\/[^.]*)?(\?.*)?$/.test(req.url)) req.url = '/app/index.html';
    else if (req.url && /^\/admin\/?(\?.*)?$/.test(req.url)) req.url = '/admin/index.html';
  };
  return {
    name: 'kasirku-app-fallback',
    configureServer(server) {
      server.middlewares.use((req, _res, next) => (rewrite(req), next()));
    },
    configurePreviewServer(server) {
      server.middlewares.use((req, _res, next) => (rewrite(req), next()));
    },
  };
};

export default defineConfig({
  appType: 'mpa',
  build: {
    rollupOptions: {
      input: { landing: resolve(__dirname, 'index.html'), app: resolve(__dirname, 'app/index.html'), admin: resolve(__dirname, 'admin/index.html') },
    },
  },
  plugins: [
    appFallback(),
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/*.png', 'favicon.svg'],
      manifest: {
        name: 'KasirKu — Kasir UMKM',
        short_name: 'KasirKu',
        description: 'Kasir cepat untuk UMKM dan pedagang kaki lima',
        lang: 'id',
        start_url: '/app/',
        scope: '/app/',
        id: '/app/',
        display: 'standalone',
        orientation: 'any',
        background_color: '#f7f9f8',
        theme_color: '#0b7a5a',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        navigateFallback: '/app/index.html',
        navigateFallbackAllowlist: [/^\/app(\/|$)/],
        navigateFallbackDenylist: [/^\/api\//],
        globPatterns: ['**/*.{js,css,html,svg,png,webp,woff2}'],
        // ADR-014: the admin console and the landing script are online-only, never in the POS offline cache.
        globIgnores: ['admin/**', 'assets/admin-*', 'assets/landing-*', 'landing/**', 'index.html'],
        runtimeCaching: [
          {
            // Product photos + QRIS image from Supabase Storage: available offline.
            urlPattern: ({ url }) => url.pathname.startsWith('/storage/v1/object/public/'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'store-images',
              expiration: { maxEntries: 500, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
        ],
      },
    }),
  ],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'server/**/*.test.ts'],
  },
});
