import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import type { RotasOpcoes } from '../tipos'

export const rotasEstado: FastifyPluginAsyncZod<RotasOpcoes> = async (
  app,
  { container: c },
) => {
  app.addHook('preHandler', app.exigirSessao)

  // Tudo o que a UI precisa para montar as telas (os cálculos de mês, dívida e projeção são feitos na UI).
  app.get('/estado', async () => c.obterEstado.execute())

  // Cópia do banco inteiro (.db do SQLite).
  app.get('/backup', async (_request, reply) => {
    const { nome, conteudo } = c.gerarBackup.execute()
    return reply
      .header('Content-Type', 'application/vnd.sqlite3')
      .header('Content-Disposition', `attachment; filename="${nome}"`)
      .header('Cache-Control', 'no-store')
      .send(conteudo)
  })
}
