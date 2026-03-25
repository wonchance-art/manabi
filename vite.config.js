import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'Anatomy Studio',
        short_name: 'Anatomy',
        description: 'AI가 문장을 해부하는 언어 학습 앱',
        theme_color: '#7C5CFC',
        background_color: '#0F0F1A',
        display: 'standalone',
        start_url: '/materials',
        icons: [
          { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: { cacheName: 'google-fonts', expiration: { maxAgeSeconds: 60 * 60 * 24 * 365 } },
          },
        ],
      },
    }),
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('@tanstack/react-query')) return 'vendor-query';
          if (id.includes('@supabase/supabase-js')) return 'vendor-supabase';
          if (id.includes('node_modules')) return 'vendor-react';
        }
      }
    }
  },
  server: {
    proxy: {
      '/api/gemini': {
        target: 'https://generativelanguage.googleapis.com/v1beta',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/gemini/, '/models/gemini-2.0-flash-lite-preview-02-05:generateContent'),
        configure: (proxy, options) => {
          proxy.on('proxyReq', (proxyReq, req, res) => {
            // This is a placeholder for development. 
            // In production (Vercel), the API key is handled by the serverless function.
            // For local Vite proxy, we need to append the key to the URL via rewrite or here.
          });
        }
      }
    }
  }
})
