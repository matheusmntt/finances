import type { FastifyReply } from 'fastify'
import type { Pdf } from '../../repositories/carro-repository'

export function enviarPdf(reply: FastifyReply, pdf: Pdf) {
  return reply
    .header('Content-Type', 'application/pdf')
    .header('Content-Disposition', `inline; filename="${pdf.nome}"`)
    .header('Cache-Control', 'private, no-store')
    .send(pdf.conteudo)
}
