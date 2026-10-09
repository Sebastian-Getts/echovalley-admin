import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  // Production and development builds can be served side by side:
  // /admin/ -> prod API, /admin-dev/ -> dev API.
  base: process.env.VITE_BASE_PATH || (process.env.NODE_ENV === 'production' ? '/admin/' : '/'),
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
    open: true,
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        // 保留 /api 前缀，直接转发给后端
      },
    },
  },
})





