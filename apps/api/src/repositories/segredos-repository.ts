import { eq } from 'drizzle-orm'
import type { Banco } from '../db/connection'
import * as t from '../db/schema'

export interface SegredosRepository {
  ler(chave: string): string | undefined
  gravar(chave: string, valor: string): void
}

export class DrizzleSegredosRepository implements SegredosRepository {
  constructor(private readonly db: Banco) {}

  ler(chave: string) {
    return this.db
      .select()
      .from(t.segredos)
      .where(eq(t.segredos.chave, chave))
      .get()?.valor
  }

  gravar(chave: string, valor: string) {
    this.db
      .insert(t.segredos)
      .values({ chave, valor })
      .onConflictDoUpdate({ target: t.segredos.chave, set: { valor } })
      .run()
  }
}
