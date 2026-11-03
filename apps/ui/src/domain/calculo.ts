// Números derivados do estado: saldo de cada mês, dívida com a Greici e o André, carro e salário previsto.
// Funções puras: recebem o estado e o mês atual, para dar o mesmo resultado em qualquer lugar (e nos testes).
import { proximoMes } from '@/lib/formato'
import type { Despesa, Estado, Holerite } from './tipos'

export type Mes = {
  mes: string
  entradas: number
  salarioPrevisto: number
  despesas: number
  extras: number
  pagoPorCredores: number
  qtd: number
  qtdPagas: number
  valorPago: number
  totalDespesas: number
  saldo: number
  acumulado: number
}

export type CategoriaDivida = {
  id: string
  nome: string
  ordem: number
  pagoPorEles: number
  previsto: number
  plano: number
  devolvido: number
}

export type Calculo = ReturnType<typeof calcular>

// "Folha Mensal de 08/2026"
export const nomeFolha = (h: Pick<Holerite, 'tipo' | 'competencia'>) =>
  `${h.tipo} de ${h.competencia.slice(5)}/${h.competencia.slice(0, 4)}`

const ehMensal = (h: Holerite) => /mensal/i.test(h.tipo)

// Do início ao fim do plano, esticando para cobrir qualquer mês com lançamento.
function listaMeses(d: Estado) {
  let inicio = d.config.planoInicio
  let fim = d.config.planoFim
  const usados = [
    ...d.entradas.map((e) => e.mes),
    ...d.extras.map((x) => x.mes),
    ...d.holerites.map((h) => h.mes),
    ...d.despesas.flatMap((x) => Object.keys(x.valores)),
  ]
  for (const m of usados) {
    if (m < inicio) inicio = m
    if (m > fim) fim = m
  }
  const meses = [inicio]
  while ((meses[meses.length - 1] as string) < fim)
    meses.push(proximoMes(meses[meses.length - 1] as string))
  return meses
}

// Salário dos meses sem folha, daqui para a frente: o valor fixado no Backoffice ou o líquido da última
// folha mensal de mês cheio (a de um mês incompleto, como a do primeiro mês, não serve).
export function salarioPrevisto(
  d: Estado,
): { valor: number; folha: Holerite | null } | null {
  if (d.config.salarioPrevisto)
    return { valor: d.config.salarioPrevisto, folha: null }
  const folha = d.holerites
    .filter(
      (h) =>
        ehMensal(h) &&
        (!h.salarioMensal || h.totalVencimentos >= h.salarioMensal),
    )
    .sort(
      (a, b) => b.competencia.localeCompare(a.competencia) || b.id - a.id,
    )[0]
  return folha ? { valor: folha.liquido, folha } : null
}

export function calcular(d: Estado, mesAtual: string) {
  const meses = listaMeses(d)
  const indice = new Map(meses.map((m, i) => [m, i]))
  const porMes: Mes[] = meses.map((mes) => ({
    mes,
    entradas: 0,
    salarioPrevisto: 0,
    despesas: 0,
    extras: 0,
    pagoPorCredores: 0,
    qtd: 0,
    qtdPagas: 0,
    valorPago: 0,
    totalDespesas: 0,
    saldo: 0,
    acumulado: 0,
  }))
  const doMes = (mes: string) => porMes[indice.get(mes) as number] as Mes

  for (const e of d.entradas) doMes(e.mes).entradas += e.valor
  // O líquido de cada folha de pagamento entra no mês em que foi pago.
  for (const h of d.holerites) doMes(h.mes).entradas += h.liquido
  const salario = salarioPrevisto(d)
  const mesesComFolha = new Set(d.holerites.filter(ehMensal).map((h) => h.mes))
  if (salario) {
    for (const p of porMes) {
      if (p.mes < mesAtual || mesesComFolha.has(p.mes)) continue
      p.salarioPrevisto = salario.valor
      p.entradas += salario.valor
    }
  }
  for (const despesa of d.despesas) {
    for (const [mes, v] of Object.entries(despesa.valores)) {
      const p = doMes(mes)
      if (v.pagoPorCredores) {
        p.pagoPorCredores += v.valor
        continue
      }
      p.despesas += v.valor
      p.qtd++
      if (v.pagoEm) {
        p.qtdPagas++
        p.valorPago += v.valor
      }
    }
  }
  for (const x of d.extras) {
    const p = doMes(x.mes)
    p.extras += x.valor
    p.qtd++
    if (x.pagoEm) {
      p.qtdPagas++
      p.valorPago += x.valor
    }
  }

  let acumulado = 0
  for (const p of porMes) {
    p.totalDespesas = p.despesas + p.extras
    p.saldo = p.entradas - p.totalDespesas
    acumulado += p.saldo
    p.acumulado = acumulado
  }

  return {
    meses,
    indice,
    porMes,
    salario,
    doMes,
    divida: calcularDivida(d),
    carro: calcularCarro(d),
  }
}

function calcularCarro(d: Estado) {
  const itens = [...d.multas, ...d.custosCarro]
  const total = itens.reduce((s, x) => s + x.valor, 0)
  const pagos = itens.filter((x) => x.pagoEm)
  const pago = pagos.reduce((s, x) => s + x.valor, 0)
  return {
    total,
    pago,
    emAberto: total - pago,
    qtdTotal: itens.length,
    qtdPagos: pagos.length,
  }
}

function calcularDivida(d: Estado) {
  const categorias = new Map<string, CategoriaDivida>(
    d.categorias.map((c) => [
      c.id,
      { ...c, pagoPorEles: 0, previsto: 0, plano: 0, devolvido: 0 },
    ]),
  )
  const somar = (
    id: string | null,
    campo: 'pagoPorEles' | 'previsto' | 'plano' | 'devolvido',
    valor: number,
  ) => {
    const c = id ? categorias.get(id) : undefined
    if (c) c[campo] += valor
  }

  const categoriaContas = d.config.categoriaContasPagasPorCredores
  for (const despesa of d.despesas) {
    for (const v of Object.values(despesa.valores)) {
      if (!v.pagoPorCredores) continue
      somar(categoriaContas, 'pagoPorEles', v.valor)
      somar(categoriaContas, 'previsto', v.valor)
    }
  }
  for (const e of d.emprestimos) {
    somar(e.categoriaDivida, 'pagoPorEles', e.valor)
    somar(e.categoriaDivida, 'previsto', e.valor)
  }
  for (const x of [...d.multas, ...d.custosCarro]) {
    somar(d.config.categoriaCarro, 'previsto', x.valor)
    if (x.pagoEm) somar(d.config.categoriaCarro, 'pagoPorEles', x.valor)
  }

  const devolucoes = d.despesas.filter((x) => x.categoriaDivida)
  let qtdParcelas = 0
  let qtdDevolvidas = 0
  for (const despesa of devolucoes) {
    for (const v of Object.values(despesa.valores)) {
      somar(despesa.categoriaDivida, 'plano', v.valor)
      qtdParcelas++
      if (v.pagoEm) {
        somar(despesa.categoriaDivida, 'devolvido', v.valor)
        qtdDevolvidas++
      }
    }
  }

  const lista = [...categorias.values()]
  const total = (campo: 'pagoPorEles' | 'previsto' | 'plano' | 'devolvido') =>
    lista.reduce((s, c) => s + c[campo], 0)
  return {
    categorias: lista,
    devolucoes,
    // Pagas direto para eles junto com a devolução, mas fora da dívida.
    contasDiretas: d.despesas.filter(
      (x) => x.pagoAosCredores && !x.categoriaDivida,
    ),
    mesesPlano: [
      ...new Set(devolucoes.flatMap((x) => Object.keys(x.valores))),
    ].sort(),
    pagoPorEles: total('pagoPorEles'),
    previsto: total('previsto'),
    plano: total('plano'),
    devolvido: total('devolvido'),
    qtdParcelas,
    qtdDevolvidas,
  }
}

export type Parcela =
  | { recorrente: true }
  | { recorrente: false; numero: number; total: number; fim: string }

// Sequência de meses seguidos com valor que contém o mês pedido ("Parcela 2 de 3" ou "Todo mês").
export function parcela(
  despesa: Despesa,
  mes: string,
  meses: string[],
  indice: Map<string, number>,
): Parcela | null {
  if (!despesa.valores[mes]) return null
  const ultimo = meses.length - 1
  const i = indice.get(mes) as number
  let inicio = i
  while (inicio > 0 && despesa.valores[meses[inicio - 1] as string]) inicio--
  let fim = i
  while (fim < ultimo && despesa.valores[meses[fim + 1] as string]) fim++
  if (fim === ultimo) return { recorrente: true }
  return {
    recorrente: false,
    numero: i - inicio + 1,
    total: fim - inicio + 1,
    fim: meses[fim] as string,
  }
}
