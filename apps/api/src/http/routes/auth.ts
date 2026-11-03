import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { DURACAO_SESSAO } from '../../lib/auth/sessoes'
import type { RotasOpcoes } from '../tipos'

export const rotasAuth: FastifyPluginAsyncZod<RotasOpcoes> = async (
  app,
  { container, cookieSeguro },
) => {
  const cookie = (request: { protocol: string }) => ({
    path: '/',
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: cookieSeguro || request.protocol === 'https',
  })

  app.post(
    '/auth/login',
    {
      schema: {
        body: z.object({
          senha: z
            .string({ error: 'Informe a senha.' })
            .min(1, 'Informe a senha.'),
        }),
      },
    },
    async (request, reply) => {
      const { token } = container.entrar.execute({
        senha: request.body.senha,
        ip: request.ip,
      })
      return reply
        .setCookie('sessao', token, {
          ...cookie(request),
          maxAge: DURACAO_SESSAO,
        })
        .send({ ok: true })
    },
  )

  app.post('/auth/logout', async (request, reply) => {
    return reply.clearCookie('sessao', cookie(request)).send({ ok: true })
  })

  app.get('/auth/sessao', async (request) => ({
    autenticado: container.sessoes.valida(request.cookies.sessao),
  }))
}
