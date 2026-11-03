// Projeção mês a mês: o plano com os ajustes do simulador, o CDB já sem IR, a dívida com a Greici e o André
// e o cenário em que, depois da dívida, só uma parte do salário bruto é investida. Funções puras.
import type { Calculo } from './calculo'
import type { Estado } from './tipos'

export type Simulacao = {
  renda: number // a mais (ou a menos) por mês, a partir de rendaInicio
  rendaInicio: string | null
  gasto: number // a mais por mês (negativo: economia)
  antecipar: number // a mais por mês na devolução, até a dívida zerar
  taxa: number | null // outra taxa do CDB (fração ao mês)
}

export const SIMULACAO_VAZIA: Simulacao = {
  renda: 0,
  rendaInicio: null,
  gasto: 0,
  antecipar: 0,
  taxa: null,
}

export const simulando = (s: Simulacao) =>
  Boolean(s.renda || s.gasto || s.antecipar || s.taxa != null)

export type LinhaProjecao = {
  mes: string
  futuro: boolean
  entradas: number
  salarioPrevisto: number
  despesas: number
  saldo: number
  acumulado: number
  faltaDevolver: number
  guardado: number
  rendimento: number
  ir: number
  patrimonio: number
  // Cenário "investindo X% do bruto depois da dívida".
  contaCenario: number
  investidoCenario: number
  reservaCenario: number
  patrimonioCenario: number
}

export type CampoMeta = 'patrimonio' | 'reservaCenario' | 'patrimonioCenario'

const soma = (valores: number[]) => valores.reduce((t, v) => t + v, 0)

// IR do CDB pelo tempo aplicado (tabela regressiva): até 180 dias, 22,5%; até 360, 20%; até 720, 17,5%; depois, 15%.
export function aliquota(meses: number) {
  if (meses <= 6) return 0.225
  if (meses <= 12) return 0.2
  if (meses <= 24) return 0.175
  return 0.15
}

// CDB: antes do início o dinheiro fica parado; depois, o aporte de cada mês vira um lote que rende e paga IR
// pelo próprio tempo aplicado. Aporte negativo (mês no vermelho) resgata dos lotes mais antigos.
export function investir(
  meses: string[],
  aportes: number[],
  taxa: number,
  inicio: string,
) {
  const lotes: { aplicado: number; valor: number; idade: number }[] = []
  let parado = 0
  let descoberto = 0

  function movimentar(valor: number) {
    if (valor >= 0) {
      const cobre = Math.min(descoberto, valor)
      descoberto -= cobre
      if (valor - cobre > 0)
        lotes.push({ aplicado: valor - cobre, valor: valor - cobre, idade: 0 })
      return
    }
    let falta = -valor
    while (falta > 0 && lotes.length) {
      const lote = lotes[0] as (typeof lotes)[number]
      if (lote.valor <= falta) {
        falta -= lote.valor
        lotes.shift()
      } else {
        lote.aplicado *= 1 - falta / lote.valor
        lote.valor -= falta
        falta = 0
      }
    }
    descoberto += falta
  }

  return meses.map((mes, i) => {
    const aporte = aportes[i] ?? 0
    if (!inicio || mes < inicio) {
      parado += aporte
      return { guardado: Math.round(parado), rendimento: 0, ir: 0 }
    }
    movimentar(parado + aporte)
    parado = 0
    for (const lote of lotes) {
      lote.valor *= 1 + taxa
      lote.idade++
    }
    const bruto = soma(lotes.map((l) => l.valor))
    const ir = soma(
      lotes.map((l) => Math.max(0, l.valor - l.aplicado) * aliquota(l.idade)),
    )
    return {
      guardado: Math.round(bruto - ir - descoberto),
      rendimento: Math.round(bruto - soma(lotes.map((l) => l.aplicado))),
      ir: Math.round(ir),
    }
  })
}

// Salário bruto de cada mês: o da folha mensal daquele mês ou, sem ela, o da folha mensal mais recente.
export function salarioBruto(d: Estado) {
  const folhas = d.holerites.filter(
    (h) => /mensal/i.test(h.tipo) && h.salarioMensal,
  )
  const recente = [...folhas].sort(
    (a, b) => b.competencia.localeCompare(a.competencia) || b.id - a.id,
  )[0]
  const base = recente ? recente.salarioMensal : null
  const porMes = new Map(folhas.map((h) => [h.mes, h.salarioMensal]))
  return {
    base,
    doMes: (mes: string) =>
      porMes.has(mes) ? (porMes.get(mes) as number) : base,
  }
}

// Livre das dívidas: o mês em que a última parcela zera o que falta devolver (0: já livre; -1: não zera).
export function indiceLivre(linhas: Pick<LinhaProjecao, 'faltaDevolver'>[]) {
  const iUltimaDivida = linhas.reduce(
    (acc, l, i) => (l.faltaDevolver > 0 ? i : acc),
    -1,
  )
  if (iUltimaDivida === -1) return 0
  return iUltimaDivida < linhas.length - 1 ? iUltimaDivida + 1 : -1
}

export function projetar(
  d: Estado,
  c: Calculo,
  sim: Simulacao,
  mesAtual: string,
): LinhaProjecao[] {
  const { config } = d
  const taxa = sim.taxa ?? (config.cdbTaxaMensal || 0)
  const inicioRenda = sim.rendaInicio ?? mesAtual

  // Parcelas de devolução por mês. Nos meses que já passaram, só conta o que foi marcado como pago.
  const devolucao = new Map<string, number>()
  for (const despesa of c.divida.devolucoes) {
    for (const [mes, v] of Object.entries(despesa.valores)) {
      if (mes < mesAtual && !v.pagoEm) continue
      devolucao.set(mes, (devolucao.get(mes) ?? 0) + v.valor)
    }
  }

  let faltaDevolver = c.divida.previsto
  let acumulado = 0
  const base = c.porMes.map((p) => {
    const futuro = p.mes >= mesAtual
    const entradas =
      p.entradas + (futuro && p.mes >= inicioRenda ? sim.renda : 0)
    let despesas = p.totalDespesas + (futuro ? sim.gasto : 0)

    // Antecipar: além da parcela, paga o valor extra até a dívida zerar; depois disso as parcelas somem.
    const planejada = devolucao.get(p.mes) ?? 0
    let devolvida = planejada
    if (sim.antecipar && futuro) {
      devolvida = Math.min(
        Math.max(0, faltaDevolver),
        planejada + sim.antecipar,
      )
      despesas += devolvida - planejada
    }
    faltaDevolver -= devolvida

    const saldo = entradas - despesas
    acumulado += saldo
    return {
      mes: p.mes,
      futuro,
      entradas,
      salarioPrevisto: p.salarioPrevisto,
      despesas,
      saldo,
      acumulado,
      faltaDevolver: Math.max(0, Math.round(faltaDevolver)),
    }
  })

  const meses = base.map((l) => l.mes)
  const cdb = investir(
    meses,
    base.map((l) => l.saldo),
    taxa,
    config.cdbInicio,
  )

  // Cenário: até a dívida zerar, igual ao plano. Depois, de hoje em diante, investe no CDB só X% do salário
  // bruto (ou a sobra, se for menor); o resto da sobra fica na conta, sem render. Mês no vermelho tira primeiro
  // da conta e depois do investimento.
  const livre = indiceLivre(base)
  const fracao = config.poupancaPercentual / 100
  const bruto = salarioBruto(d)
  let conta = 0
  const contas: number[] = []
  const aportes = base.map((l, i) => {
    const salario = bruto.doMes(l.mes)
    let aporte = l.saldo
    if (livre >= 0 && i > livre && l.futuro && salario != null) {
      if (l.saldo >= 0) {
        aporte = Math.min(l.saldo, Math.round(fracao * salario))
        conta += l.saldo - aporte
      } else {
        const daConta = Math.min(conta, -l.saldo)
        conta -= daConta
        aporte = l.saldo + daConta
      }
    }
    contas.push(conta)
    return aporte
  })
  const cenario = investir(meses, aportes, taxa, config.cdbInicio)

  return base.map((l, i) => {
    const plano = cdb[i] as (typeof cdb)[number]
    const investido = (cenario[i] as (typeof cenario)[number]).guardado
    const contaCenario = contas[i] ?? 0
    return {
      ...l,
      ...plano,
      patrimonio: plano.guardado - l.faltaDevolver,
      contaCenario,
      investidoCenario: investido,
      // A reserva de emergência do cenário é só o que está investido; as outras metas contam também a conta.
      reservaCenario: investido - l.faltaDevolver,
      patrimonioCenario: investido + contaCenario - l.faltaDevolver,
    }
  })
}

export type Resumo = ReturnType<typeof resumir>

// Números de resumo de uma projeção.
export function resumir(
  d: Estado,
  c: Calculo,
  linhas: LinhaProjecao[],
  mesAtual: string,
) {
  const ultimo = linhas.length - 1
  const iHoje = Math.max(
    0,
    linhas.findIndex((l) => l.mes === mesAtual),
  )
  const iPrimeiro = Math.max(
    0,
    c.porMes.findIndex((p) => p.entradas || p.totalDespesas),
  )
  const livre = indiceLivre(linhas)

  // Fim das parcelas que não são devolução (as de devolução acabam quando a dívida zera).
  let iParcelas = -1
  for (const x of d.despesas.filter((despesa) => !despesa.categoriaDivida)) {
    const i = c.indice.get(Object.keys(x.valores).sort().pop() ?? '')
    if (i != null && i < ultimo) iParcelas = Math.max(iParcelas, i)
  }
  const iFim = Math.max(iParcelas, livre)
  const sobras =
    iFim >= 0 && iFim < ultimo ? linhas.slice(iFim + 1).map((l) => l.saldo) : []

  // Custo de vida: média das despesas depois das parcelas (ou dos próximos 12 meses).
  const baseCusto = sobras.length
    ? linhas.slice(iFim + 1)
    : linhas.slice(iHoje, iHoje + 12)
  const custoMensal = baseCusto.length
    ? Math.round(soma(baseCusto.map((l) => l.despesas)) / baseCusto.length)
    : 0

  const bruto = salarioBruto(d).base
  const cenario = {
    pct: d.config.poupancaPercentual,
    bruto,
    aporte:
      bruto == null
        ? null
        : Math.round((bruto * d.config.poupancaPercentual) / 100),
    disponivel: bruto != null && livre >= 0,
  }

  return {
    ultimo,
    iHoje,
    iPrimeiro,
    livre,
    iFim,
    sobras,
    custoMensal,
    cenario,
    fim: linhas[ultimo] as LinhaProjecao,
    hoje: linhas[iHoje] as LinhaProjecao,
  }
}

// Primeiro mês, de hoje em diante, em que o patrimônio (do plano ou do cenário) chega ao valor.
export function quandoAtinge(
  linhas: LinhaProjecao[],
  iHoje: number,
  valor: number,
  campo: CampoMeta = 'patrimonio',
) {
  const i = linhas.findIndex((l, k) => k >= iHoje && l[campo] >= valor)
  return i === -1 ? null : (linhas[i] as LinhaProjecao).mes
}

export const nomeCenario = (pct: number) => `Investindo ${pct}% do bruto`
