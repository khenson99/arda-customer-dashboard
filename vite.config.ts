import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': '/src',
    },
  },
  server: {
    proxy: {
      // CS Dashboard API - proxied to local serverless dev or production
      '/api/cs': {
        target: process.env.VITE_API_URL || 'http://localhost:3000',
        changeOrigin: true,
        secure: false,
      },
      // Direct Arda API proxy (legacy, still used for some endpoints)
      '/api/arda': {
        target: 'https://prod.alpha001.io.arda.cards',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/arda/, ''),
        secure: true,
      },
      // Fallback for legacy /api routes
      '/api': {
        target: 'https://prod.alpha001.io.arda.cards',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
        secure: true,
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          recharts: ['recharts'],
        },
      },
    },
    chunkSizeWarningLimit: 1024,
  },
})
