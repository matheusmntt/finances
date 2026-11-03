import { timingSafeEqual } from 'node:crypto'
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import fp from 'fastify-plugin'
import type { Sessoes } from '../../lib/auth/sessoes'

declare module 'fastify' {
  interface FastifyInstance {
    // preHandler das rotas com dados: exige a sessão (login com senha).
    exigirSessao: (
      request: FastifyRequest,
      reply: FastifyReply,
    ) => Promise<void>
  }
}

const iguais = (a: string, b: string) => {
  const x = Buffer.from(a)
  const y = Buffer.from(b)
  return x.length === y.length && timingSafeEqual(x, y)
}

// Duas camadas: a API key (cabeçalho x-api-key) identifica a UI em toda rota /api, menos /api/health; a
// sessão (cookie do login com senha) protege os dados, já que a chave vai no JavaScript que o navegador baixa.
export const autenticacao = fp<{ apiKey: string; sessoes: Sessoes }>(
  async (app: FastifyInstance, { apiKey, sessoes }) => {
    app.addHook('onRequest', async (request, reply) => {
      if (!request.url.startsWith('/api/') || request.url === '/api/health')
        return
      const chave = request.headers['x-api-key']
      if (typeof chave !== 'string' || !iguais(chave, apiKey)) {
        return reply.status(401).send({ erro: 'Chave da API inválida.' })
      }
    })

    app.decorate(
      'exigirSessao',
      async (request: FastifyRequest, reply: FastifyReply) => {
        if (!sessoes.valida(request.cookies.sessao)) {
          return reply.status(401).send({ erro: 'Faça login para continuar.' })
        }
      },
    )
  },
)
