import { and, count, eq, inArray, max } from 'drizzle-orm'
import type { SQLiteColumn, SQLiteTable } from 'drizzle-orm/sqlite-core'
import { ConflitoError } from '../core/errors'
import type { Banco } from '../db/connection'
import * as t from '../db/schema'

export type Valores = Record<string, unknown>

// Edição genérica de tabelas para o Backoffice. As tabelas e colunas vêm sempre da especificação em
// use-cases/backoffice/entidades.ts, nunca do usuário. Por isso os valores entram como `never`: a tabela
// só é conhecida em tempo de execução, e cada campo já foi validado contra a especificação.
export interface BackofficeRepository {
  atualizar(
    tabela: SQLiteTable,
    coluna: SQLiteColumn,
    chave: string | number,
    valores: Valores,
  ): boolean
  inserir(tabela: SQLiteTable, valores: Valores): void
  remover(
    tabela: SQLiteTable,
    coluna: SQLiteColumn,
    chave: string | number,
  ): boolean
  existe(
    coluna: SQLiteColumn,
    tabela: SQLiteTable,
    valor: string | number,
  ): boolean
  proximaOrdem(tabela: SQLiteTable): number
  despesasNoGrupo(grupoId: string): number
  usosDaCategoria(categoriaId: string): number
  chaveDoCusto(id: number): string | null | undefined

  valorMesExiste(despesaId: number, mes: string): boolean
  inserirValoresMes(despesaId: number, meses: string[], valor: number): void
  atualizarValorMes(despesaId: number, mes: string, valores: Valores): boolean
  removerValorMes(despesaId: number, mes: string): boolean

  gravarConfig(pares: [string, string][]): void
  lerConfig(chave: string): string | undefined
  // Roda tudo numa transação: se algo falhar, nada é gravado.
  transacao<T>(fn: () => T): T
}

const unico = (erro: unknown) =>
  erro instanceof Error && /UNIQUE constraint failed/.test(erro.message)

export class DrizzleBackofficeRepository implements BackofficeRepository {
  constructor(private readonly db: Banco) {}

  atualizar(
    tabela: SQLiteTable,
    coluna: SQLiteColumn,
    chave: string | number,
    valores: Valores,
  ) {
    try {
      return (
        this.db
          .update(tabela)
          .set(valores as never)
          .where(eq(coluna, chave))
          .run().changes > 0
      )
    } catch (erro) {
      if (unico(erro))
        throw new ConflitoError('Já existe outro registro com esses dados.')
      throw erro
    }
  }

  inserir(tabela: SQLiteTable, valores: Valores) {
    try {
      this.db
        .insert(tabela)
        .values(valores as never)
        .run()
    } catch (erro) {
      if (unico(erro))
        throw new ConflitoError('Já existe outro registro com esses dados.')
      throw erro
    }
  }

  remover(tabela: SQLiteTable, coluna: SQLiteColumn, chave: string | number) {
    return this.db.delete(tabela).where(eq(coluna, chave)).run().changes > 0
  }

  existe(coluna: SQLiteColumn, tabela: SQLiteTable, valor: string | number) {
    return Boolean(
      this.db.select({ c: coluna }).from(tabela).where(eq(coluna, valor)).get(),
    )
  }

  proximaOrdem(tabela: SQLiteTable) {
    const coluna = (tabela as unknown as { ordem: SQLiteColumn }).ordem
    return (
      Number(
        this.db
          .select({ m: max(coluna) })
          .from(tabela)
          .get()?.m ?? 0,
      ) + 1
    )
  }

  despesasNoGrupo(grupoId: string) {
    return (
      this.db
        .select({ n: count() })
        .from(t.despesas)
        .where(eq(t.despesas.grupoId, grupoId))
        .get()?.n ?? 0
    )
  }

  usosDaCategoria(categoriaId: string) {
    const despesas =
      this.db
        .select({ n: count() })
        .from(t.despesas)
        .where(eq(t.despesas.categoriaDivida, categoriaId))
        .get()?.n ?? 0
    const emprestimos =
      this.db
        .select({ n: count() })
        .from(t.emprestimos)
        .where(eq(t.emprestimos.categoriaDivida, categoriaId))
        .get()?.n ?? 0
    const config =
      this.db
        .select({ n: count() })
        .from(t.config)
        .where(
          and(
            inArray(t.config.chave, [
              'categoriaCarro',
              'categoriaContasPagasPorCredores',
            ]),
            eq(t.config.valor, categoriaId),
          ),
        )
        .get()?.n ?? 0
    return despesas + emprestimos + config
  }

  chaveDoCusto(id: number) {
    return this.db
      .select({ chave: t.custosCarro.chave })
      .from(t.custosCarro)
      .where(eq(t.custosCarro.id, id))
      .get()?.chave
  }

  valorMesExiste(despesaId: number, mes: string) {
    return Boolean(
      this.db
        .select({ m: t.despesaValores.mes })
        .from(t.despesaValores)
        .where(
          and(
            eq(t.despesaValores.despesaId, despesaId),
            eq(t.despesaValores.mes, mes),
          ),
        )
        .get(),
    )
  }

  inserirValoresMes(despesaId: number, meses: string[], valor: number) {
    this.db
      .insert(t.despesaValores)
      .values(meses.map((mes) => ({ despesaId, mes, valor })))
      .run()
  }

  atualizarValorMes(despesaId: number, mes: string, valores: Valores) {
    return (
      this.db
        .update(t.despesaValores)
        .set(valores)
        .where(
          and(
            eq(t.despesaValores.despesaId, despesaId),
            eq(t.despesaValores.mes, mes),
          ),
        )
        .run().changes > 0
    )
  }

  removerValorMes(despesaId: number, mes: string) {
    return (
      this.db
        .delete(t.despesaValores)
        .where(
          and(
            eq(t.despesaValores.despesaId, despesaId),
            eq(t.despesaValores.mes, mes),
          ),
        )
        .run().changes > 0
    )
  }

  gravarConfig(pares: [string, string][]) {
    for (const [chave, valor] of pares) {
      this.db
        .insert(t.config)
        .values({ chave, valor })
        .onConflictDoUpdate({ target: t.config.chave, set: { valor } })
        .run()
    }
  }

  lerConfig(chave: string) {
    return this.db
      .select()
      .from(t.config)
      .where(eq(t.config.chave, chave))
      .get()?.valor
  }

  transacao<T>(fn: () => T): T {
    return this.db.transaction(() => fn())
  }
}
