import { z } from 'zod'

const booleano = z
  .enum(['0', '1', 'true', 'false'])
  .optional()
  .transform((v) => v === '1' || v === 'true')

const esquema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  PORT: z.coerce.number().int().default(3333),
  HOST: z.string().default('0.0.0.0'),
  DB_PATH: z.string().default('../../data/financas.db'),
  // Pasta com os PDFs dos boletos (lidos pelo seed e pelo importador ao iniciar).
  BOLETOS_DIR: z.string().default('../../boletos'),
  // Build da UI (apps/ui/dist). Preenchido: a API também serve o app, como em produção.
  UI_DIR: z.string().optional(),
  // Chave que a UI manda no cabeçalho x-api-key em toda requisição.
  API_KEY: z.string().min(16, 'API_KEY precisa de pelo menos 16 caracteres'),
  // Senha de acesso ao app.
  APP_SENHA: z.string().min(8, 'APP_SENHA precisa de pelo menos 8 caracteres'),
  // Atrás de um proxy com HTTPS: usa o IP real e marca o cookie como Secure.
  TRUST_PROXY: booleano,
  COOKIE_SEGURO: booleano,
})

export type Env = z.infer<typeof esquema>

export function lerEnv(origem: NodeJS.ProcessEnv = process.env): Env {
  const resultado = esquema.safeParse(origem)
  if (!resultado.success) {
    const erros = resultado.error.issues
      .map((i) => `  ${i.path.join('.')}: ${i.message}`)
      .join('\n')
    throw new Error(`Variáveis de ambiente inválidas:\n${erros}`)
  }
  return resultado.data
}
