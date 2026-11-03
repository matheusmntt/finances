// Aba "Projeção": para onde o plano leva o dinheiro (guardado, dívida e patrimônio), com metas e simulador.
import { useMemo, useState } from 'react'
import { useDados } from '@/api/estado'
import {
  simulando as estaSimulando,
  projetar,
  resumir,
  SIMULACAO_VAZIA,
} from '@/domain/projecao'
import { mesAtual as lerMesAtual } from '@/lib/formato'
import { useTitulo } from '@/lib/titulo'
import { useSimulador } from '@/stores/simulador'
import { Cartoes } from './cartoes'
import type { Projecao } from './contexto'
import { Explicacao } from './explicacao'
import { Graficos } from './graficos'
import { Metas } from './metas'
import { PontosDeAtencao } from './pontos-de-atencao'
import { AvisoSimulacao, Simulador } from './simulador'
import { TabelaMeses } from './tabela-meses'

export function PaginaProjecao() {
  useTitulo('Projeção')
  const dados = useDados()
  const sim = useSimulador((s) => s.sim)
  const limpar = useSimulador((s) => s.limpar)
  const simulando = estaSimulando(sim)
  const [simuladorAberto, setSimuladorAberto] = useState(simulando)
  // Muda a cada "Limpar": monta o formulário do simulador de novo, com os campos vazios.
  const [versaoSimulador, setVersaoSimulador] = useState(0)
  const mesAtual = lerMesAtual()

  // O plano salvo e, se houver simulação, o cenário simulado por cima dele.
  const plano = useMemo(() => {
    if (!dados) return null
    const base = projetar(
      dados.estado,
      dados.calculo,
      SIMULACAO_VAZIA,
      mesAtual,
    )
    return { base, rb: resumir(dados.estado, dados.calculo, base, mesAtual) }
  }, [dados, mesAtual])
  const p = useMemo<Projecao | null>(() => {
    if (!dados || !plano) return null
    const linhas = simulando
      ? projetar(dados.estado, dados.calculo, sim, mesAtual)
      : plano.base
    const r = simulando
      ? resumir(dados.estado, dados.calculo, linhas, mesAtual)
      : plano.rb
    return {
      ...dados,
      ...plano,
      mesAtual,
      simulando,
      linhas,
      r,
    }
  }, [dados, plano, sim, simulando, mesAtual])

  if (!p) return null

  function limparSimulacao() {
    limpar()
    setVersaoSimulador((v) => v + 1)
    setSimuladorAberto(true)
  }

  return (
    <section className="view" aria-label="Projeção">
      {simulando ? (
        <AvisoSimulacao
          sim={sim}
          mesAtual={mesAtual}
          onLimpar={limparSimulacao}
        />
      ) : null}
      <Cartoes p={p} />
      <Simulador
        key={versaoSimulador}
        meses={p.calculo.meses.filter((m) => m >= mesAtual)}
        mesAtual={mesAtual}
        taxaPlano={p.estado.config.cdbTaxaMensal || 0}
        aberto={simuladorAberto}
        onAlternar={setSimuladorAberto}
        onLimpar={limparSimulacao}
      />
      <Graficos p={p} />
      <Metas p={p} />
      <PontosDeAtencao p={p} />
      <TabelaMeses p={p} />
      <Explicacao p={p} />
    </section>
  )
}
