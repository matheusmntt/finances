import { and, eq, isNull, max, sql } from 'drizzle-orm'
import type { Banco } from '../db/connection'
import * as t from '../db/schema'

export type MultaImportada = Omit<
  typeof t.multas.$inferInsert,
  'pagoEm' | 'editadoNoApp'
>

export type GuiaImportada = {
  valor: number
  detalhe: string
  guia: string
  validade: string
  linhaDigitavel: string
  arquivo: string
  pdf: Buffer | null
}

export type Pdf = { nome: string; conteudo: Buffer }

// Multas, custos do carro (CRLV, pátio...) e o que o importador de boletos grava.
export interface CarroRepository {
  marcarMultaPaga(serie: string, pagoEm: string | null): boolean
  marcarCustoPago(id: number, pagoEm: string | null): boolean
  pdfMulta(serie: string): Pdf | undefined
  pdfCusto(id: number): Pdf | undefined

  // Importador: o que foi editado no app (editado_no_app) nunca é sobrescrito.
  existeMulta(serie: string): boolean
  gravarInfracao(codigo: string, descricao: string, tipo: string): void
  gravarMulta(multa: MultaImportada): void
  garantirCusto(custo: {
    chave: string
    descricao: string
    detalhe: string
    valor: number
    ordem: number
  }): void
  chaveDoCustoDaGuia(guia: string): string | undefined
  custoSemGuia(chave: string): boolean
  criarCustoVazio(chave: string, descricao: string): void
  aplicarGuia(chave: string, guia: GuiaImportada): boolean
}

export class DrizzleCarroRepository implements CarroRepository {
  constructor(private readonly db: Banco) {}

  marcarMultaPaga(serie: string, pagoEm: string | null) {
    return (
      this.db
        .update(t.multas)
        .set({ pagoEm })
        .where(eq(t.multas.serie, serie))
        .run().changes > 0
    )
  }

  marcarCustoPago(id: number, pagoEm: string | null) {
    return (
      this.db
        .update(t.custosCarro)
        .set({ pagoEm })
        .where(eq(t.custosCarro.id, id))
        .run().changes > 0
    )
  }

  pdfMulta(serie: string) {
    const linha = this.db
      .select({ pdf: t.multas.pdf })
      .from(t.multas)
      .where(eq(t.multas.serie, serie))
      .get()
    return linha?.pdf
      ? { nome: `${serie}.pdf`, conteudo: linha.pdf }
      : undefined
  }

  pdfCusto(id: number) {
    const linha = this.db
      .select({ pdf: t.custosCarro.pdf, guia: t.custosCarro.guia })
      .from(t.custosCarro)
      .where(eq(t.custosCarro.id, id))
      .get()
    return linha?.pdf
      ? { nome: `guia-${linha.guia ?? id}.pdf`, conteudo: linha.pdf }
      : undefined
  }

  existeMulta(serie: string) {
    return Boolean(
      this.db
        .select({ s: t.multas.serie })
        .from(t.multas)
        .where(eq(t.multas.serie, serie))
        .get(),
    )
  }

  gravarInfracao(codigo: string, descricao: string, tipo: string) {
    this.db
      .insert(t.infracoes)
      .values({ codigo, descricao, tipo })
      .onConflictDoUpdate({
        target: t.infracoes.codigo,
        set: { descricao, tipo },
        setWhere: eq(t.infracoes.editadoNoApp, false),
      })
      .run()
  }

  gravarMulta(multa: MultaImportada) {
    const { serie, pdf, ...resto } = multa
    this.db
      .insert(t.multas)
      .values(multa)
      .onConflictDoUpdate({
        target: t.multas.serie,
        // O PDF só é trocado quando o importador encontrou o arquivo.
        set: { ...resto, pdf: sql`COALESCE(excluded.pdf, ${t.multas.pdf})` },
        setWhere: eq(t.multas.editadoNoApp, false),
      })
      .run()
  }

  garantirCusto(custo: {
    chave: string
    descricao: string
    detalhe: string
    valor: number
    ordem: number
  }) {
    this.db
      .insert(t.custosCarro)
      .values(custo)
      .onConflictDoNothing({ target: t.custosCarro.chave })
      .run()
  }

  chaveDoCustoDaGuia(guia: string) {
    return (
      this.db
        .select({ chave: t.custosCarro.chave })
        .from(t.custosCarro)
        .where(eq(t.custosCarro.guia, guia))
        .get()?.chave ?? undefined
    )
  }

  custoSemGuia(chave: string) {
    return Boolean(
      this.db
        .select({ id: t.custosCarro.id })
        .from(t.custosCarro)
        .where(and(eq(t.custosCarro.chave, chave), isNull(t.custosCarro.guia)))
        .get(),
    )
  }

  criarCustoVazio(chave: string, descricao: string) {
    const ordem =
      (this.db
        .select({ m: max(t.custosCarro.ordem) })
        .from(t.custosCarro)
        .get()?.m ?? 0) + 1
    this.db
      .insert(t.custosCarro)
      .values({ chave, descricao, detalhe: '', valor: 0, ordem })
      .onConflictDoNothing({ target: t.custosCarro.chave })
      .run()
  }

  aplicarGuia(chave: string, guia: GuiaImportada) {
    const { pdf, ...dados } = guia
    return (
      this.db
        .update(t.custosCarro)
        .set({ ...dados, ...(pdf ? { pdf } : {}) })
        .where(
          and(
            eq(t.custosCarro.chave, chave),
            eq(t.custosCarro.editadoNoApp, false),
          ),
        )
        .run().changes > 0
    )
  }
}
