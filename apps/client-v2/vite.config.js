import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

function normalizeClientFonts() {
  return {
    name: 'tiny-chat-normalize-client-fonts',
    enforce: 'pre',
    transform(code, id) {
      if (!id.includes('/apps/client-v2/src/') || !id.split('?')[0].endsWith('.css')) return null;
      const next = code
        .replace(/@import\s+url\(['"]?https:\/\/fonts\.googleapis\.com\/css2\?family=Inter[^;]+;\s*/gi, '')
        .replace(/\bInter\b/g, "'Vazirmatn'");
      return next === code ? null : { code: next, map: null };
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const proxyTarget = env.VITE_PROXY_TARGET || 'http://127.0.0.1:3001';

  return {
    plugins: [
      normalizeClientFonts(),
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['icon.svg'],
        manifest: {
          id: '/?source=pwa',
          name: 'Tiny Chat',
          short_name: 'Tiny Chat',
          description: 'Small but powerful real-time messaging.',
          theme_color: '#00c9f5',
          background_color: '#f7f9fc',
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
              description: 'Open Tiny Chat',
              url: '/?view=chats&source=pwa-shortcut',
              icons: [{ src: '/icon.svg', sizes: 'any', type: 'image/svg+xml' }],
            },
            {
              name: 'Start new chat',
              short_name: 'New chat',
              description: 'Start a new Tiny Chat conversation',
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
                cacheName: 'tiny-chat-v2-uploads',
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
  };
});
