import { asc, sql } from 'drizzle-orm'
import type { Banco } from '../db/connection'
import * as t from '../db/schema'

export type Config = {
  credores: string
  categoriaContasPagasPorCredores: string
  categoriaCarro: string
  planoInicio: string
  planoFim: string
  cdbTaxaMensal: number
  cdbInicio: string
  placa: string
  // Vazio: o salário previsto vem da última folha de pagamento de mês cheio.
  salarioPrevisto: number | null
  reservaMeses: number
  // Cenário da Projeção: quanto do salário bruto é investido depois que a dívida zera.
  poupancaPercentual: number
}

export type ValorMes = {
  valor: number
  pagoEm: string | null
  pagoPorCredores: boolean
}

export type Estado = ReturnType<DrizzleEstadoRepository['ler']>

export interface EstadoRepository {
  ler(): Estado
  lerConfig(): Config
}

// Lê o estado completo do app numa ida só: é o que a UI usa para montar todas as telas.
export class DrizzleEstadoRepository implements EstadoRepository {
  constructor(private readonly db: Banco) {}

  lerConfig(): Config {
    const linhas = Object.fromEntries(
      this.db
        .select()
        .from(t.config)
        .all()
        .map((c) => [c.chave, c.valor]),
    )
    return {
      credores: linhas.credores ?? '',
      categoriaContasPagasPorCredores:
        linhas.categoriaContasPagasPorCredores ?? '',
      categoriaCarro: linhas.categoriaCarro ?? '',
      planoInicio: linhas.planoInicio ?? '',
      planoFim: linhas.planoFim ?? '',
      cdbTaxaMensal: Number(linhas.cdbTaxaMensal || 0),
      cdbInicio: linhas.cdbInicio ?? '',
      placa: linhas.placa ?? '',
      salarioPrevisto: linhas.salarioPrevisto
        ? Number(linhas.salarioPrevisto)
        : null,
      reservaMeses: linhas.reservaMeses ? Number(linhas.reservaMeses) : 6,
      poupancaPercentual: linhas.poupancaPercentual
        ? Number(linhas.poupancaPercentual)
        : 20,
    }
  }

  ler() {
    const db = this.db

    const valores = new Map<number, Record<string, ValorMes>>()
    for (const v of db
      .select()
      .from(t.despesaValores)
      .orderBy(asc(t.despesaValores.mes))
      .all()) {
      const doMes = valores.get(v.despesaId) ?? {}
      doMes[v.mes] = {
        valor: v.valor,
        pagoEm: v.pagoEm,
        pagoPorCredores: v.pagoPorCredores,
      }
      valores.set(v.despesaId, doMes)
    }

    const infracoes: Record<string, { descricao: string; tipo: string }> = {}
    for (const i of db.select().from(t.infracoes).all()) {
      infracoes[i.codigo] = { descricao: i.descricao, tipo: i.tipo }
    }

    const itens = new Map<number, (typeof t.holeriteItens.$inferSelect)[]>()
    for (const i of db
      .select()
      .from(t.holeriteItens)
      .orderBy(asc(t.holeriteItens.holeriteId), asc(t.holeriteItens.ordem))
      .all()) {
      itens.set(i.holeriteId, [...(itens.get(i.holeriteId) ?? []), i])
    }

    const despesas = db
      .select({ d: t.despesas })
      .from(t.despesas)
      .innerJoin(t.grupos, sql`${t.grupos.id} = ${t.despesas.grupoId}`)
      .orderBy(asc(t.grupos.ordem), asc(t.despesas.ordem), asc(t.despesas.id))
      .all()
      .map(({ d }) => ({
        id: d.id,
        slug: d.slug,
        grupoId: d.grupoId,
        nome: d.nome,
        nomeCurto: d.nomeCurto,
        categoriaDivida: d.categoriaDivida,
        pagoAosCredores: d.pagoAosCredores,
        criadaPeloUsuario: d.criadaPeloUsuario,
        ordem: d.ordem,
        valores: valores.get(d.id) ?? {},
      }))

    const multas = db
      .select()
      .from(t.multas)
      .orderBy(asc(t.multas.serie))
      .all()
      .map(
        ({
          pdf,
          editadoNoApp,
          velocidadeMedida,
          velocidadeConsiderada,
          velocidadeLimite,
          ...m
        }) => ({
          ...m,
          temPdf: pdf != null,
          velocidade:
            velocidadeConsiderada == null
              ? null
              : {
                  medida: velocidadeMedida,
                  considerada: velocidadeConsiderada,
                  limite: velocidadeLimite,
                },
        }),
      )

    const custosCarro = db
      .select()
      .from(t.custosCarro)
      .orderBy(asc(t.custosCarro.ordem), asc(t.custosCarro.id))
      .all()
      .map(({ pdf, editadoNoApp, ...c }) => ({ ...c, temPdf: pdf != null }))

    const holerites = db
      .select()
      .from(t.holerites)
      .orderBy(asc(t.holerites.competencia), asc(t.holerites.id))
      .all()
      .map(({ pdf, criadoEm, ...h }) => ({
        ...h,
        itens: (itens.get(h.id) ?? []).map(({ holeriteId, ordem, ...i }) => i),
      }))

    return {
      config: this.lerConfig(),
      grupos: db.select().from(t.grupos).orderBy(asc(t.grupos.ordem)).all(),
      categorias: db
        .select()
        .from(t.categoriasDivida)
        .orderBy(asc(t.categoriasDivida.ordem))
        .all(),
      despesas,
      entradas: db
        .select({
          id: t.entradas.id,
          mes: t.entradas.mes,
          descricao: t.entradas.descricao,
          valor: t.entradas.valor,
        })
        .from(t.entradas)
        .orderBy(asc(t.entradas.mes), asc(t.entradas.id))
        .all(),
      extras: db
        .select({
          id: t.extras.id,
          mes: t.extras.mes,
          descricao: t.extras.descricao,
          valor: t.extras.valor,
          pagoEm: t.extras.pagoEm,
        })
        .from(t.extras)
        .orderBy(asc(t.extras.mes), asc(t.extras.id))
        .all(),
      emprestimos: db
        .select({
          id: t.emprestimos.id,
          mes: t.emprestimos.mes,
          descricao: t.emprestimos.descricao,
          valor: t.emprestimos.valor,
          categoriaDivida: t.emprestimos.categoriaDivida,
          origem: t.emprestimos.origem,
        })
        .from(t.emprestimos)
        .orderBy(asc(t.emprestimos.mes), asc(t.emprestimos.id))
        .all(),
      infracoes,
      multas,
      custosCarro,
      holerites,
      metas: db
        .select({
          id: t.metas.id,
          nome: t.metas.nome,
          valor: t.metas.valor,
          ordem: t.metas.ordem,
        })
        .from(t.metas)
        .orderBy(asc(t.metas.ordem), asc(t.metas.id))
        .all(),
    }
  }
}
