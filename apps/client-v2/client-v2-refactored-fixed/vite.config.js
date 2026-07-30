import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const proxyTarget = env.VITE_PROXY_TARGET || 'http://127.0.0.1:3001';

  return {
    plugins: [
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['icon.svg'],
        manifest: {
          id: '/?source=pwa',
          name: 'Tiny Chat',
          short_name: 'Tiny Chat',
          description: 'Small but powerful real-time messaging.',
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
          icons: [{ src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' }],
        },
        workbox: {
          maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
          navigateFallback: '/index.html',
          cleanupOutdatedCaches: true,
        },
        devOptions: { enabled: false },
      }),
    ],
    build: {
      target: 'es2022',
      cssCodeSplit: true,
      sourcemap: false,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) return undefined;
            if (id.includes('@ionic') || id.includes('ionicons')) return 'ionic';
            if (id.includes('socket.io') || id.includes('engine.io')) return 'realtime';
            if (id.includes('react')) return 'react';
            return undefined;
          },
        },
      },
    },
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
