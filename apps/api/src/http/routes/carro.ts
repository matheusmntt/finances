import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { z } from 'zod'
import * as v from '../../core/validacao'
import type { RotasOpcoes } from '../tipos'
import { enviarPdf } from './pdf'

// Multas e custos do carro: marcar como pago e baixar o PDF do boleto.
export const rotasCarro: FastifyPluginAsyncZod<RotasOpcoes> = async (
  app,
  { container: c },
) => {
  app.addHook('preHandler', app.exigirSessao)
  const pago = z.object({ pagoEm: v.dataPagamento })

  app.put(
    '/multas/:serie/pago',
    { schema: { params: z.object({ serie: v.serieMulta }), body: pago } },
    async (request, reply) => {
      c.marcarMultaPaga.execute(request.params.serie, request.body.pagoEm)
      return reply.status(204).send()
    },
  )

  app.get(
    '/multas/:serie/pdf',
    { schema: { params: z.object({ serie: v.serieMulta }) } },
    async (request, reply) =>
      enviarPdf(
        reply,
        c.obterPdfBoleto.execute({ serie: request.params.serie }),
      ),
  )

  app.put(
    '/custos-carro/:id/pago',
    { schema: { params: z.object({ id: v.idNumerico }), body: pago } },
    async (request, reply) => {
      c.marcarCustoPago.execute(request.params.id, request.body.pagoEm)
      return reply.status(204).send()
    },
  )

  app.get(
    '/custos-carro/:id/pdf',
    { schema: { params: z.object({ id: v.idNumerico }) } },
    async (request, reply) =>
      enviarPdf(
        reply,
        c.obterPdfBoleto.execute({ custoId: request.params.id }),
      ),
  )
}
