import { existsSync } from 'node:fs'
import { join } from 'node:path'
import cookie from '@fastify/cookie'
import estaticos from '@fastify/static'
import fastify from 'fastify'
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod'
import type { Container } from './container'
import { tratarErro } from './http/erros'
import { autenticacao } from './http/plugins/autenticacao'
import { rotasAuth } from './http/routes/auth'
import { rotasBackoffice } from './http/routes/backoffice'
import { rotasCarro } from './http/routes/carro'
import { rotasEstado } from './http/routes/estado'
import { rotasHolerites } from './http/routes/holerites'
import { rotasLancamentos } from './http/routes/lancamentos'

export type AppOpcoes = {
  container: Container
  apiKey: string
  confiarProxy?: boolean
  cookieSeguro?: boolean
  logger?: boolean
  // Pasta do build da UI: servida junto com a API (um container só).
  pastaUi?: string
}

export async function criarApp({
  container,
  apiKey,
  confiarProxy = false,
  cookieSeguro = false,
  logger = false,
  pastaUi,
}: AppOpcoes) {
  const app = fastify({
    logger,
    trustProxy: confiarProxy,
  }).withTypeProvider<ZodTypeProvider>()
  app.setValidatorCompiler(validatorCompiler)
  app.setSerializerCompiler(serializerCompiler)
  app.setErrorHandler(tratarErro)

  await app.register(cookie)
  await app.register(autenticacao, { apiKey, sessoes: container.sessoes })

  // Para o health check da hospedagem: não exige chave nem expõe dados.
  app.get('/api/health', async () => ({ ok: true }))

  const opcoes = { container, cookieSeguro, prefix: '/api' }
  await app.register(rotasAuth, opcoes)
  await app.register(rotasEstado, opcoes)
  await app.register(rotasLancamentos, opcoes)
  await app.register(rotasCarro, opcoes)
  await app.register(rotasHolerites, opcoes)
  await app.register(rotasBackoffice, opcoes)
  if (pastaUi) await servirUi(app, pastaUi)
  return app
}

// Arquivos do build da UI. Os de assets/ têm hash no nome e podem ficar em cache para sempre; o resto
// (index.html, sw.js, manifest) é revalidado a cada acesso para um deploy novo chegar logo. Qualquer
// outro caminho fora de /api é rota do app e recebe o index.html.
async function servirUi(
  app: Awaited<ReturnType<typeof criarApp>>,
  pasta: string,
) {
  if (!existsSync(join(pasta, 'index.html')))
    throw new Error(`UI_DIR sem index.html: ${pasta}`)
  await app.register(estaticos, {
    root: pasta,
    wildcard: false,
    cacheControl: false,
    setHeaders: (reply, caminho) => {
      reply.header(
        'Cache-Control',
        caminho.includes(`${join(pasta, 'assets')}/`)
          ? 'public, max-age=31536000, immutable'
          : 'no-cache',
      )
    },
  })
  app.setNotFoundHandler((req, reply) => {
    if (req.method !== 'GET' || req.url.startsWith('/api/'))
      return reply.status(404).send({ erro: 'Não encontrado.' })
    return reply.header('Cache-Control', 'no-cache').sendFile('index.html')
  })
}
