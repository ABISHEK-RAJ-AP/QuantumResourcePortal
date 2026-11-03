import { fileURLToPath, URL } from 'node:url'

import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Backend address used by the dev-server proxy. The browser only ever talks to the Vite origin,
// so session cookies stay same-origin (LLD PD-34) and no CORS configuration is needed.
const API_TARGET = process.env.QRP_API_TARGET ?? 'http://127.0.0.1:8000'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
    dedupe: ['react', 'react-dom'],
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'react/jsx-runtime'],
  },
  server: {
    // 5173 is Q-TeleScope. `::` accepts localhost on IPv4 and IPv6.
    port: 5176,
    strictPort: true,
    host: '::',
    proxy: {
      '/api': { target: API_TARGET, changeOrigin: false },
      '/healthz': { target: API_TARGET, changeOrigin: false },
      '/readyz': { target: API_TARGET, changeOrigin: false },
    },
  },
  preview: { port: 4173 },
})
