// Simulador: renda a mais, gasto extra, antecipar a devolução e outra taxa do CDB. Nada é salvo.
import { type ChangeEvent, useState } from 'react'
import { Avisos } from '@/components/avisos'
import { Icone } from '@/components/icones'
import type { Simulacao } from '@/domain/projecao'
import {
  formatarCampo,
  juntar,
  lerReaisComSinal,
  mesCurto,
  nomeMes,
  reais,
} from '@/lib/formato'
import { useSimulador } from '@/stores/simulador'
import { lerTaxa, percentual } from './textos'

type CampoValor = 'renda' | 'gasto' | 'antecipar'
type CampoTexto = CampoValor | 'taxa'

const valorCampo = (v: number) =>
  v ? `${v < 0 ? '-' : ''}${formatarCampo(Math.abs(v))}` : ''

const textoTaxa = (taxa: number | null) =>
  taxa == null ? '' : percentual(taxa).replace('%', '')

// Banner "Simulação: ..." com o botão de voltar ao plano.
export function AvisoSimulacao({
  sim,
  mesAtual,
  onLimpar,
}: {
  sim: Simulacao
  mesAtual: string
  onLimpar: () => void
}) {
  const partes: string[] = []
  if (sim.renda) {
    partes.push(
      `renda ${sim.renda > 0 ? '+' : '−'}${reais(Math.abs(sim.renda))} por mês a partir de ${mesCurto(sim.rendaInicio || mesAtual)}`,
    )
  }
  if (sim.gasto)
    partes.push(
      `${sim.gasto > 0 ? 'gasto extra de' : 'economia de'} ${reais(Math.abs(sim.gasto))} por mês`,
    )
  if (sim.antecipar)
    partes.push(`${reais(sim.antecipar)} a mais por mês na devolução`)
  if (sim.taxa != null) partes.push(`CDB a ${percentual(sim.taxa)} ao mês`)
  return (
    <Avisos
      avisos={[
        {
          tipo: 'info',
          conteudo: (
            <>
              <strong>Simulação:</strong> {juntar(partes)}. Os números abaixo
              mostram esse cenário; o plano salvo não muda.{' '}
              <button type="button" className="link" onClick={onLimpar}>
                Voltar ao plano
              </button>
            </>
          ),
        },
      ]}
    />
  )
}

type SimuladorProps = {
  meses: string[] // de hoje até o fim do plano
  mesAtual: string
  taxaPlano: number
  aberto: boolean
  onAlternar: (aberto: boolean) => void
  onLimpar: () => void
}

// Os campos guardam o texto digitado e são lidos a cada digitação; o texto só volta a ser formatado
// quando o formulário é montado de novo (ao limpar), para não atrapalhar quem está digitando.
export function Simulador({
  meses,
  mesAtual,
  taxaPlano,
  aberto,
  onAlternar,
  onLimpar,
}: SimuladorProps) {
  const sim = useSimulador((s) => s.sim)
  const definir = useSimulador((s) => s.definir)
  const [textos, setTextos] = useState<Record<CampoTexto, string>>(() => ({
    renda: valorCampo(sim.renda),
    gasto: valorCampo(sim.gasto),
    antecipar: valorCampo(sim.antecipar),
    taxa: textoTaxa(sim.taxa),
  }))
  const [invalidos, setInvalidos] = useState<Set<CampoTexto>>(new Set())

  function marcar(campo: CampoTexto, invalido: boolean) {
    setInvalidos((atual) => {
      if (atual.has(campo) === invalido) return atual
      const novo = new Set(atual)
      if (invalido) novo.add(campo)
      else novo.delete(campo)
      return novo
    })
  }

  function aoDigitar(campo: CampoTexto, e: ChangeEvent<HTMLInputElement>) {
    const texto = e.target.value
    setTextos((atual) => ({ ...atual, [campo]: texto }))
    if (campo === 'taxa') {
      const taxa = lerTaxa(texto)
      marcar(campo, taxa === undefined)
      if (taxa === undefined) return
      definir('taxa', taxa)
    } else {
      const valor = lerReaisComSinal(texto)
      const invalido = valor == null || (campo === 'antecipar' && valor < 0)
      marcar(campo, invalido)
      if (invalido) return
      definir(campo, valor)
    }
    onAlternar(true)
  }

  // Atributos de cada campo de valor (o <input> fica no JSX, dentro do seu rótulo).
  const propsCampo = (nome: CampoTexto, placeholder = '0,00') => ({
    className: `campo campo-valor${invalidos.has(nome) ? ' invalido' : ''}`,
    inputMode: 'decimal' as const,
    placeholder,
    value: textos[nome],
    'aria-invalid': invalidos.has(nome) || undefined,
    onChange: (e: ChangeEvent<HTMLInputElement>) => aoDigitar(nome, e),
  })

  return (
    <details
      className="cartao simulador"
      open={aberto}
      onToggle={(e) => onAlternar(e.currentTarget.open)}
    >
      <summary>
        <span className="marcador-mais" aria-hidden="true">
          <Icone.editar />
        </span>
        Simular um cenário<span className="sub">nada é salvo</span>
      </summary>
      <form
        className="form-grade"
        autoComplete="off"
        onSubmit={(e) => e.preventDefault()}
      >
        <label className="campo-rotulo">
          Renda a mais por mês
          <input {...propsCampo('renda')} />
        </label>
        <label className="campo-rotulo">
          A partir de
          <select
            className="campo"
            value={sim.rendaInicio || mesAtual}
            onChange={(e) => {
              definir('rendaInicio', e.target.value)
              onAlternar(true)
            }}
          >
            {meses.map((m) => (
              <option key={m} value={m}>
                {nomeMes(m)}
              </option>
            ))}
          </select>
        </label>
        <label className="campo-rotulo">
          Gasto extra por mês
          <input {...propsCampo('gasto')} />
        </label>
        <label className="campo-rotulo">
          Antecipar a devolução
          <input {...propsCampo('antecipar')} />
        </label>
        <label className="campo-rotulo">
          CDB (% ao mês)
          <input {...propsCampo('taxa', textoTaxa(taxaPlano))} />
        </label>
        <div className="form-acoes">
          <button type="button" className="botao" onClick={onLimpar}>
            Limpar
          </button>
        </div>
      </form>
      <p className="sub simulador-nota">
        Use − na frente para renda a menos ou para economia. “Antecipar a
        devolução” soma esse valor às parcelas de cada mês até a dívida zerar.
      </p>
    </details>
  )
}
