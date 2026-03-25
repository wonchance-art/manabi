import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
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
