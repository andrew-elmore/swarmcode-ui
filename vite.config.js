import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  define: {
    'process.env.REACT_APP_PARSE_URL': JSON.stringify(process.env.REACT_APP_PARSE_URL || ''),
    'process.env.REACT_APP_PARSE_APP_ID': JSON.stringify(process.env.REACT_APP_PARSE_APP_ID || ''),
    'process.env.REACT_APP_PARSE_REST_API_KEY': JSON.stringify(process.env.REACT_APP_PARSE_REST_API_KEY || ''),
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['vite.svg', 'pwa-192x192.svg', 'pwa-512x512.svg'],
      manifest: {
        name: 'SwarmCode',
        short_name: 'SwarmCode',
        description: 'Multi-agent project management',
        theme_color: '#1976d2',
        background_color: '#ffffff',
        display: 'standalone',
        start_url: '/',
        icons: [
          {
            src: 'pwa-192x192.svg',
            sizes: '192x192',
            type: 'image/svg+xml',
            purpose: 'any',
          },
          {
            src: 'pwa-512x512.svg',
            sizes: '512x512',
            type: 'image/svg+xml',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            urlPattern: /\/parse\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24, // 24 hours
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
        ],
      },
    }),
  ],
  server: {
    port: 3000,
    proxy: {
      '/parse': {
        target: 'http://localhost:1337',
        changeOrigin: true,
      },
    },
  },
})
