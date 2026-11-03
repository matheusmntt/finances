import { z } from 'zod'

// Variáveis VITE_ entram no JavaScript que o navegador baixa: nada aqui é segredo de verdade. A API key só
// identifica a UI; quem protege os dados é o login com senha.
const esquema = z.object({
  VITE_API_KEY: z
    .string()
    .min(16, 'Defina VITE_API_KEY em apps/ui/.env (a mesma API_KEY da API).'),
  VITE_API_URL: z.string().default('/api'),
})

export const env = esquema.parse(import.meta.env)
