import path from 'node:path'
import { defineConfig } from 'vitest/config'

// Config de testes isolada: sem plugins de build (React/Tailwind) para testes de lógica pura.
export default defineConfig({
  resolve: { alias: { '@': path.resolve(import.meta.dirname, './src') } },
  // css: por padrão o Vitest entrega estilos vazios; o teste de contraste do tema precisa ler as cores
  test: { environment: 'node', include: ['src/**/*.test.{ts,tsx}'], css: { include: [/src[\/]index\.css/] } },
})
