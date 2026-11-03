import { and, eq, max } from 'drizzle-orm'
import type { Banco } from '../db/connection'
import * as t from '../db/schema'

export type NovaDespesa = {
  grupoId: string
  nome: string
  nomeCurto: string | null
  categoriaDivida: string | null
  pagoAosCredores: boolean
  valores: { mes: string; valor: number }[]
}

export type NovaEntrada = { mes: string; descricao: string; valor: number }
export type NovoEmprestimo = NovaEntrada & {
  categoriaDivida: string
  origem: string
}

// Despesas mensais (com o valor de cada mês), entradas, extras e o que a Greici e o André pagaram.
export interface LancamentosRepository {
  grupoExiste(id: string): boolean
  categoriaExiste(id: string): boolean
  despesa(id: number): { id: number; criadaPeloUsuario: boolean } | undefined
  criarDespesa(nova: NovaDespesa): number
  removerDespesa(id: number): void
  // Grava o valor do mês (mantendo pagamento e "pago por eles").
  definirValorMes(despesaId: number, mes: string, valor: number): void
  // Remove o valor do mês, menos se foi pago pela Greici e pelo André.
  removerValorMes(despesaId: number, mes: string): void
  marcarValorMesPago(
    despesaId: number,
    mes: string,
    pagoEm: string | null,
  ): boolean

  entrada(id: number): typeof t.entradas.$inferSelect | undefined
  criarEntrada(nova: NovaEntrada): void
  atualizarEntrada(
    id: number,
    dados: { descricao: string; valor: number },
  ): void
  removerEntrada(id: number): boolean

  extra(id: number): typeof t.extras.$inferSelect | undefined
  criarExtra(nova: NovaEntrada): void
  atualizarExtra(
    id: number,
    dados: { descricao: string; valor: number; pagoEm: string | null },
  ): void
  removerExtra(id: number): boolean

  criarEmprestimo(novo: NovoEmprestimo): void
  removerEmprestimo(id: number): boolean
}

export class DrizzleLancamentosRepository implements LancamentosRepository {
  constructor(private readonly db: Banco) {}

  grupoExiste(id: string) {
    return Boolean(
      this.db
        .select({ id: t.grupos.id })
        .from(t.grupos)
        .where(eq(t.grupos.id, id))
        .get(),
    )
  }

  categoriaExiste(id: string) {
    return Boolean(
      this.db
        .select({ id: t.categoriasDivida.id })
        .from(t.categoriasDivida)
        .where(eq(t.categoriasDivida.id, id))
        .get(),
    )
  }

  despesa(id: number) {
    return this.db
      .select({
        id: t.despesas.id,
        criadaPeloUsuario: t.despesas.criadaPeloUsuario,
      })
      .from(t.despesas)
      .where(eq(t.despesas.id, id))
      .get()
  }

  criarDespesa(nova: NovaDespesa) {
    return this.db.transaction((tx) => {
      const ordem =
        (tx
          .select({ m: max(t.despesas.ordem) })
          .from(t.despesas)
          .get()?.m ?? 0) + 1
      const { id } = tx
        .insert(t.despesas)
        .values({
          grupoId: nova.grupoId,
          nome: nova.nome,
          nomeCurto: nova.nomeCurto,
          categoriaDivida: nova.categoriaDivida,
          pagoAosCredores: nova.pagoAosCredores,
          criadaPeloUsuario: true,
          ordem,
        })
        .returning({ id: t.despesas.id })
        .get()
      if (nova.valores.length) {
        tx.insert(t.despesaValores)
          .values(
            nova.valores.map((v) => ({
              despesaId: id,
              mes: v.mes,
              valor: v.valor,
            })),
          )
          .run()
      }
      return id
    })
  }

  removerDespesa(id: number) {
    this.db.delete(t.despesas).where(eq(t.despesas.id, id)).run()
  }

  definirValorMes(despesaId: number, mes: string, valor: number) {
    this.db
      .insert(t.despesaValores)
      .values({ despesaId, mes, valor })
      .onConflictDoUpdate({
        target: [t.despesaValores.despesaId, t.despesaValores.mes],
        set: { valor },
      })
      .run()
  }

  removerValorMes(despesaId: number, mes: string) {
    this.db
      .delete(t.despesaValores)
      .where(
        and(
          eq(t.despesaValores.despesaId, despesaId),
          eq(t.despesaValores.mes, mes),
          eq(t.despesaValores.pagoPorCredores, false),
        ),
      )
      .run()
  }

  marcarValorMesPago(despesaId: number, mes: string, pagoEm: string | null) {
    const { changes } = this.db
      .update(t.despesaValores)
      .set({ pagoEm })
      .where(
        and(
          eq(t.despesaValores.despesaId, despesaId),
          eq(t.despesaValores.mes, mes),
          eq(t.despesaValores.pagoPorCredores, false),
        ),
      )
      .run()
    return changes > 0
  }

  entrada(id: number) {
    return this.db.select().from(t.entradas).where(eq(t.entradas.id, id)).get()
  }

  criarEntrada(nova: NovaEntrada) {
    this.db.insert(t.entradas).values(nova).run()
  }

  atualizarEntrada(id: number, dados: { descricao: string; valor: number }) {
    this.db.update(t.entradas).set(dados).where(eq(t.entradas.id, id)).run()
  }

  removerEntrada(id: number) {
    return (
      this.db.delete(t.entradas).where(eq(t.entradas.id, id)).run().changes > 0
    )
  }

  extra(id: number) {
    return this.db.select().from(t.extras).where(eq(t.extras.id, id)).get()
  }

  criarExtra(nova: NovaEntrada) {
    this.db.insert(t.extras).values(nova).run()
  }

  atualizarExtra(
    id: number,
    dados: { descricao: string; valor: number; pagoEm: string | null },
  ) {
    this.db.update(t.extras).set(dados).where(eq(t.extras.id, id)).run()
  }

  removerExtra(id: number) {
    return this.db.delete(t.extras).where(eq(t.extras.id, id)).run().changes > 0
  }

  criarEmprestimo(novo: NovoEmprestimo) {
    this.db.insert(t.emprestimos).values(novo).run()
  }

  removerEmprestimo(id: number) {
    return (
      this.db.delete(t.emprestimos).where(eq(t.emprestimos.id, id)).run()
        .changes > 0
    )
  }
}
