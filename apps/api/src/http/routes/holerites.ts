import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { RegraInvalidaError } from '../../core/errors'
import * as v from '../../core/validacao'
import type { RotasOpcoes } from '../tipos'
import { enviarPdf } from './pdf'

const LIMITE_PDF = 5 * 1024 * 1024

// Folhas de pagamento: o corpo do POST é o próprio PDF; o nome do arquivo vem no cabeçalho x-nome-arquivo.
export const rotasHolerites: FastifyPluginAsyncZod<RotasOpcoes> = async (
  app,
  { container: c },
) => {
  app.addHook('preHandler', app.exigirSessao)
  app.addContentTypeParser(
    'application/pdf',
    { parseAs: 'buffer', bodyLimit: LIMITE_PDF },
    (_request, corpo, feito) => feito(null, corpo),
  )

  app.post('/holerites', { bodyLimit: LIMITE_PDF }, async (request, reply) => {
    if (!Buffer.isBuffer(request.body))
      throw new RegraInvalidaError('Envie a folha de pagamento em PDF.')
    let arquivo = 'folha.pdf'
    try {
      const cabecalho = request.headers['x-nome-arquivo']
      if (typeof cabecalho === 'string' && cabecalho)
        arquivo =
          decodeURIComponent(cabecalho).split(/[\\/]/).pop()?.slice(0, 120) ||
          arquivo
    } catch {
      // nome inválido: fica o padrão
    }
    return reply
      .status(201)
      .send(c.enviarHolerite.execute(request.body, arquivo))
  })

  app.delete(
    '/holerites/:id',
    { schema: { params: z.object({ id: v.idNumerico }) } },
    async (request, reply) => {
      c.removerHolerite.execute(request.params.id)
      return reply.status(204).send()
    },
  )

  app.get(
    '/holerites/:id/pdf',
    { schema: { params: z.object({ id: v.idNumerico }) } },
    async (request, reply) =>
      enviarPdf(reply, c.obterPdfHolerite.execute(request.params.id)),
  )
}
