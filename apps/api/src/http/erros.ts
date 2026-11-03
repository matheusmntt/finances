import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify'
import { hasZodFastifySchemaValidationErrors } from 'fastify-type-provider-zod'
import { AppError } from '../core/errors'

// Toda resposta de erro tem o formato { erro: "mensagem para o usuário" }.
export function tratarErro(
  erro: FastifyError,
  request: FastifyRequest,
  reply: FastifyReply,
) {
  if (erro instanceof AppError)
    return reply.status(erro.status).send({ erro: erro.message })
  if (hasZodFastifySchemaValidationErrors(erro)) {
    return reply
      .status(400)
      .send({ erro: erro.validation[0]?.message ?? 'Dados inválidos.' })
  }
  if (erro.code === 'FST_ERR_CTP_BODY_TOO_LARGE')
    return reply.status(413).send({ erro: 'Arquivo grande demais.' })
  if (erro.code === 'FST_ERR_CTP_INVALID_MEDIA_TYPE')
    return reply.status(415).send({ erro: 'Formato não aceito.' })
  if (erro.statusCode && erro.statusCode < 500)
    return reply.status(erro.statusCode).send({ erro: erro.message })
  request.log.error(erro)
  return reply.status(500).send({ erro: 'Erro interno. Tente de novo.' })
}
