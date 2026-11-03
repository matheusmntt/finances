import { fileURLToPath } from 'node:url'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    // O plugin do TanStack Router gera src/routeTree.gen.ts a partir de src/routes.
    plugins: [
      tanstackRouter({ target: 'react', autoCodeSplitting: true }),
      react(),
    ],
    resolve: {
      alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
    },
    server: {
      // Em desenvolvimento, /api vai para a API: mesmo endereço, então o cookie de sessão funciona sem CORS.
      proxy: { '/api': env.API_PROXY ?? 'http://localhost:3333' },
    },
    test: {
      environment: 'jsdom',
    },
  }
})
