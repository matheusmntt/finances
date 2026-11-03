import { and, eq } from 'drizzle-orm'
import type { Banco } from '../db/connection'
import * as t from '../db/schema'
import type { Pdf } from './carro-repository'

export type NovoHolerite = Omit<
  typeof t.holerites.$inferInsert,
  'id' | 'criadoEm'
> & {
  itens: {
    codigo: string
    descricao: string
    referencia: string | null
    vencimento: number
    desconto: number
  }[]
}

export interface HoleritesRepository {
  existe(tipo: string, competencia: string): boolean
  criar(holerite: NovoHolerite): number
  remover(id: number): boolean
  pdf(id: number): Pdf | undefined
}

export class DrizzleHoleritesRepository implements HoleritesRepository {
  constructor(private readonly db: Banco) {}

  existe(tipo: string, competencia: string) {
    return Boolean(
      this.db
        .select({ id: t.holerites.id })
        .from(t.holerites)
        .where(
          and(
            eq(t.holerites.tipo, tipo),
            eq(t.holerites.competencia, competencia),
          ),
        )
        .get(),
    )
  }

  criar({ itens, ...holerite }: NovoHolerite) {
    return this.db.transaction((tx) => {
      const { id } = tx
        .insert(t.holerites)
        .values(holerite)
        .returning({ id: t.holerites.id })
        .get()
      if (itens.length) {
        tx.insert(t.holeriteItens)
          .values(
            itens.map((item, i) => ({ ...item, holeriteId: id, ordem: i + 1 })),
          )
          .run()
      }
      return id
    })
  }

  remover(id: number) {
    return (
      this.db.delete(t.holerites).where(eq(t.holerites.id, id)).run().changes >
      0
    )
  }

  pdf(id: number) {
    const linha = this.db
      .select({ pdf: t.holerites.pdf, competencia: t.holerites.competencia })
      .from(t.holerites)
      .where(eq(t.holerites.id, id))
      .get()
    return linha
      ? { nome: `folha-${linha.competencia}.pdf`, conteudo: linha.pdf }
      : undefined
  }
}
