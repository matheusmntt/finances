import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { z } from 'zod'
import * as v from '../../core/validacao'
import type { RotasOpcoes } from '../tipos'

const id = z.object({ id: v.idNumerico })
const idMes = z.object({ id: v.idNumerico, mes: v.mes })

// Despesas (e o valor de cada mês), entradas, extras e o que a Greici e o André pagaram.
export const rotasLancamentos: FastifyPluginAsyncZod<RotasOpcoes> = async (
  app,
  { container: c },
) => {
  app.addHook('preHandler', app.exigirSessao)

  app.post(
    '/despesas',
    {
      schema: {
        body: z.object({
          grupoId: v.chaveTexto,
          nome: v.texto('o nome'),
          valor: v.centavos('valor', 1),
          mesInicio: v.mes,
          parcelas: v.inteiroOpcional('o número de parcelas', 1, 120),
          categoriaDivida: v.textoOpcional('a categoria', 40),
          pagoAosCredores: z.boolean().default(false),
        }),
      },
    },
    async (request, reply) =>
      reply.status(201).send(c.criarDespesa.execute(request.body)),
  )

  app.delete(
    '/despesas/:id',
    { schema: { params: id } },
    async (request, reply) => {
      c.removerDespesa.execute(request.params.id)
      return reply.status(204).send()
    },
  )

  app.put(
    '/despesas/:id/meses/:mes',
    {
      schema: { params: idMes, body: z.object({ valor: v.centavos('valor') }) },
    },
    async (request, reply) => {
      c.definirValorMes.execute({
        despesaId: request.params.id,
        mes: request.params.mes,
        valor: request.body.valor,
      })
      return reply.status(204).send()
    },
  )

  app.put(
    '/despesas/:id/meses/:mes/pago',
    { schema: { params: idMes, body: z.object({ pagoEm: v.dataPagamento }) } },
    async (request, reply) => {
      c.marcarValorMesPago.execute({
        despesaId: request.params.id,
        mes: request.params.mes,
        pagoEm: request.body.pagoEm,
      })
      return reply.status(204).send()
    },
  )

  const novaEntrada = (minimo: number) =>
    z.object({
      mes: v.mes,
      descricao: v.texto('a descrição'),
      valor: v.centavos('valor', minimo),
    })

  app.post(
    '/entradas',
    { schema: { body: novaEntrada(0) } },
    async (request, reply) => {
      c.criarEntrada.execute(request.body)
      return reply.status(201).send()
    },
  )

  app.patch(
    '/entradas/:id',
    {
      schema: {
        params: id,
        body: z.object({
          descricao: v.texto('a descrição').optional(),
          valor: v.centavos('valor').optional(),
        }),
      },
    },
    async (request, reply) => {
      c.atualizarEntrada.execute(request.params.id, request.body)
      return reply.status(204).send()
    },
  )

  app.delete(
    '/entradas/:id',
    { schema: { params: id } },
    async (request, reply) => {
      c.removerEntrada.execute(request.params.id)
      return reply.status(204).send()
    },
  )

  app.post(
    '/extras',
    { schema: { body: novaEntrada(1) } },
    async (request, reply) => {
      c.criarExtra.execute(request.body)
      return reply.status(201).send()
    },
  )

  app.patch(
    '/extras/:id',
    {
      schema: {
        params: id,
        body: z.object({
          descricao: v.texto('a descrição').optional(),
          valor: v.centavos('valor', 1).optional(),
          pagoEm: v.dataPagamento.optional(),
        }),
      },
    },
    async (request, reply) => {
      c.atualizarExtra.execute(request.params.id, request.body)
      return reply.status(204).send()
    },
  )

  app.delete(
    '/extras/:id',
    { schema: { params: id } },
    async (request, reply) => {
      c.removerExtra.execute(request.params.id)
      return reply.status(204).send()
    },
  )

  app.post(
    '/emprestimos',
    {
      schema: {
        body: z.object({
          mes: v.mes,
          descricao: v.texto('a descrição'),
          valor: v.centavos('valor', 1),
          categoriaDivida: v.chaveTexto,
          origem: v.textoOpcional('a origem', 60),
        }),
      },
    },
    async (request, reply) => {
      c.criarEmprestimo.execute(request.body)
      return reply.status(201).send()
    },
  )

  app.delete(
    '/emprestimos/:id',
    { schema: { params: id } },
    async (request, reply) => {
      c.removerEmprestimo.execute(request.params.id)
      return reply.status(204).send()
    },
  )
}
