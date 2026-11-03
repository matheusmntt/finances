// Popula um banco vazio com os dados da planilha (planilha.json) e os combinados em base.ts. Multas, infrações
// e custos do carro vêm do importador de boletos, que roda logo depois.
import { mesAtual } from '../../core/meses'
import type { Banco } from '../connection'
import * as t from '../schema'
import { base } from './base'
import multas from './multas.json' with { type: 'json' }
import planilha from './planilha.json' with { type: 'json' }

type ItemPlanilha = { id: string; nome: string; valores: (number | null)[] }

// Tabelas de dados, na ordem em que podem ser apagadas (segredos ficam: apagar derrubaria as sessões).
const TABELAS = [
  t.metas,
  t.holeriteItens,
  t.holerites,
  t.despesaValores,
  t.despesas,
  t.entradas,
  t.extras,
  t.emprestimos,
  t.multas,
  t.custosCarro,
  t.infracoes,
  t.categoriasDivida,
  t.grupos,
  t.config,
]

export function semear(db: Banco) {
  const contagem = { despesas: 0, entradas: 0, emprestimos: 0 }
  const devolucoes: Record<string, { categoria: string; nomeCurto: string }> =
    base.devolucoes
  const pagosAosCredores: Record<string, { nomeCurto: string }> =
    base.pagosAosCredores
  const removidas: readonly string[] = base.despesasRemovidas

  db.transaction((tx) => {
    for (const tabela of TABELAS) tx.delete(tabela).run()

    const config = {
      ...base.config,
      planoInicio: planilha.meses[0],
      planoFim: planilha.meses[planilha.meses.length - 1],
      cdbTaxaMensal: String(planilha.aplicacao.taxaMensal),
      cdbInicio: planilha.aplicacao.inicio,
      placa: multas[0]?.placa ?? '',
    }
    tx.insert(t.config)
      .values(
        Object.entries(config).map(([chave, valor]) => ({
          chave,
          valor: String(valor ?? ''),
        })),
      )
      .run()
    tx.insert(t.grupos)
      .values([...base.grupos])
      .run()
    tx.insert(t.categoriasDivida)
      .values([...base.categoriasDivida])
      .run()

    // Despesas mensais da planilha.
    const resgate = new Set(planilha.mesesResgate)
    let ordem = 0
    for (const grupo of planilha.grupos) {
      if (!base.grupos.some((g) => g.id === grupo.id))
        throw new Error(`Grupo sem cadastro em base.ts: ${grupo.id}`)
      for (const item of grupo.itens as ItemPlanilha[]) {
        if (removidas.includes(item.id)) continue
        const devolucao = devolucoes[item.id]
        const direto = pagosAosCredores[item.id]
        const { id } = tx
          .insert(t.despesas)
          .values({
            slug: item.id,
            grupoId: grupo.id,
            nome: item.nome,
            nomeCurto: devolucao?.nomeCurto ?? direto?.nomeCurto ?? null,
            categoriaDivida: devolucao?.categoria ?? null,
            pagoAosCredores: Boolean(direto),
            ordem: ++ordem,
          })
          .returning({ id: t.despesas.id })
          .get()
        const valores = item.valores.flatMap((valor, i) =>
          valor
            ? [
                {
                  despesaId: id,
                  mes: planilha.meses[i] as string,
                  valor,
                  pagoPorCredores: resgate.has(planilha.meses[i] as string),
                },
              ]
            : [],
        )
        if (valores.length) tx.insert(t.despesaValores).values(valores).run()
        contagem.despesas++
      }
    }

    // Salário dos meses que já passaram. Daqui para a frente ele é previsto pela última folha de pagamento.
    const atual = mesAtual()
    planilha.entradas.forEach((valor, i) => {
      const mes = planilha.meses[i] as string
      if (valor == null || mes >= atual) return
      tx.insert(t.entradas)
        .values({ mes, descricao: base.descricaoSalario, valor })
        .run()
      contagem.entradas++
    })

    // O que a Greici e o André pagaram fora das contas mensais.
    for (const item of planilha.pagosPelaGreici.itens) {
      tx.insert(t.emprestimos)
        .values({
          mes: item.mes,
          descricao: item.nome,
          valor: item.valor,
          categoriaDivida: base.config.categoriaContasPagasPorCredores,
          origem: base.origemDespesasGreici,
        })
        .run()
    }
    for (const e of base.emprestimos) {
      tx.insert(t.emprestimos)
        .values({
          mes: e.mes,
          descricao: e.descricao,
          valor: e.valor,
          categoriaDivida: e.categoria,
          origem: e.origem,
        })
        .run()
    }
    contagem.emprestimos =
      planilha.pagosPelaGreici.itens.length + base.emprestimos.length
  })
  return contagem
}
