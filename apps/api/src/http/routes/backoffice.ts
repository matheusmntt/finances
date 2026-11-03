import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { z } from 'zod'
import * as v from '../../core/validacao'
import type { RotasOpcoes } from '../tipos'

// Os campos de cada tabela são validados pelo use-case, conforme use-cases/backoffice/entidades.ts.
const corpo = z.record(z.string(), z.unknown(), {
  error: 'Corpo da requisição inválido.',
})

export const rotasBackoffice: FastifyPluginAsyncZod<RotasOpcoes> = async (
  app,
  { container: c },
) => {
  app.addHook('preHandler', app.exigirSessao)

  app.put(
    '/backoffice/config',
    { schema: { body: corpo } },
    async (request, reply) => {
      c.atualizarConfig.execute(request.body)
      return reply.status(204).send()
    },
  )

  app.post(
    '/backoffice/despesas/:id/meses',
    {
      schema: {
        params: z.object({ id: v.idNumerico }),
        body: z.object({
          mes: v.mes,
          valor: v.centavos('valor', 1),
          meses: v.inteiro('a quantidade de meses', 1, 120).default(1),
        }),
      },
    },
    async (request, reply) => {
      c.criarValoresMes.execute(request.params.id, request.body)
      return reply.status(201).send()
    },
  )

  const idMes = z.object({ id: v.idNumerico, mes: v.mes })

  app.patch(
    '/backoffice/despesas/:id/meses/:mes',
    { schema: { params: idMes, body: corpo } },
    async (request, reply) => {
      c.atualizarValorMes.execute(
        request.params.id,
        request.params.mes,
        request.body,
      )
      return reply.status(204).send()
    },
  )

  app.delete(
    '/backoffice/despesas/:id/meses/:mes',
    { schema: { params: idMes } },
    async (request, reply) => {
      c.removerValorMes.execute(request.params.id, request.params.mes)
      return reply.status(204).send()
    },
  )

  const entidade = z.object({ entidade: z.string() })
  const registro = z.object({ entidade: z.string(), chave: z.string() })

  app.post(
    '/backoffice/:entidade',
    { schema: { params: entidade, body: corpo } },
    async (request, reply) => {
      c.criarRegistro.execute(request.params.entidade, request.body)
      return reply.status(201).send()
    },
  )

  app.put(
    '/backoffice/:entidade/ordem',
    {
      schema: {
        params: entidade,
        body: z.object({
          chaves: z.array(z.string()).min(1).max(500),
        }),
      },
    },
    async (request, reply) => {
      c.reordenar.execute(request.params.entidade, request.body.chaves)
      return reply.status(204).send()
    },
  )

  app.patch(
    '/backoffice/:entidade/:chave',
    { schema: { params: registro, body: corpo } },
    async (request, reply) => {
      c.atualizarRegistro.execute(
        request.params.entidade,
        request.params.chave,
        request.body,
      )
      return reply.status(204).send()
    },
  )

  app.delete(
    '/backoffice/:entidade/:chave',
    { schema: { params: registro } },
    async (request, reply) => {
      c.removerRegistro.execute(request.params.entidade, request.params.chave)
      return reply.status(204).send()
    },
  )
}
