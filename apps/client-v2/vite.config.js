import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

const proxyTarget = process.env.VITE_PROXY_TARGET || 'http://localhost:9997';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      manifest: {
        id: '/?source=pwa',
        name: 'Verdant Chat V2',
        short_name: 'Verdant V2',
        description: 'Verdant Chat V2 desktop-ready PWA client.',
        theme_color: '#2563eb',
        background_color: '#f6f7fb',
        display: 'standalone',
        display_override: ['window-controls-overlay', 'standalone', 'minimal-ui'],
        orientation: 'any',
        scope: '/',
        start_url: '/?source=pwa',
        categories: ['social', 'productivity', 'utilities'],
        shortcuts: [
          {
            name: 'Open chats',
            short_name: 'Chats',
            description: 'Open Verdant Chat',
            url: '/?view=chats&source=pwa-shortcut',
            icons: [{ src: '/icon.svg', sizes: 'any', type: 'image/svg+xml' }],
          },
          {
            name: 'Start new chat',
            short_name: 'New chat',
            description: 'Jump to the chat list and start a conversation',
            url: '/?action=new-chat&source=pwa-shortcut',
            icons: [{ src: '/icon.svg', sizes: 'any', type: 'image/svg+xml' }],
          },
        ],
        icons: [
          { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' },
        ],
      },
      workbox: {
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        navigateFallback: '/index.html',
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/uploads/'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'verdant-v2-uploads',
              expiration: { maxEntries: 80, maxAgeSeconds: 60 * 60 * 24 * 7 },
            },
          },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    allowedHosts: ['chat.evaonline.ir', 'localhost', '127.0.0.1'],
    proxy: {
      '/api': { target: proxyTarget, changeOrigin: true },
      '/uploads': { target: proxyTarget, changeOrigin: true },
      '/socket.io': { target: proxyTarget, changeOrigin: true, ws: true },
    },
  },
});
