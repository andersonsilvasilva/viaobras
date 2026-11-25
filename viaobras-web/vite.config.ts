import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': path.resolve(import.meta.dirname, './src') } },
  server: { port: 5173, host: true },
  build: {
    // Páginas: o app autenticado (index.html), a landing institucional (landing.html) e a de planos (planos.html).
    rollupOptions: {
      input: {
        main: path.resolve(import.meta.dirname, 'index.html'),
        landing: path.resolve(import.meta.dirname, 'landing.html'),
        planos: path.resolve(import.meta.dirname, 'planos.html'),
      },
    },
  },
})
