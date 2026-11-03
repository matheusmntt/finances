// Aba "Mês": entradas, contas e extras de um mês, com o que falta pagar e o saldo.
import { useNavigate } from '@tanstack/react-router'
import { useMemo, useState } from 'react'
import { useDados } from '@/api/estado'
import { Avisos } from '@/components/avisos'
import { Icone } from '@/components/icones'
import { type Calculo, calcular } from '@/domain/calculo'
import { mesAtual, nomeMes } from '@/lib/formato'
import { useTitulo } from '@/lib/titulo'
import { Route } from '@/routes/_app/mes'
import { mesInicial } from './comum'
import { SecaoEmprestimos, SecaoExtras, SecoesGrupos } from './contas'
import { NovaDespesa } from './nova-despesa'
import { avisosMes, ResumoMes } from './resumo-mes'
import { SecaoEntradas } from './secao-entradas'

// " (atual) · 2 em aberto", ao lado do nome do mês no seletor.
function statusMes(calculo: Calculo, mes: string) {
  const p = calculo.doMes(mes)
  const atual = mesAtual()
  const partes: string[] = []
  if (mes === atual) partes.push(' (atual)')
  if (p.qtd === 0 && p.pagoPorCredores)
    partes.push(' · pago pela Greici e André')
  else if (mes <= atual && p.qtd) {
    const abertas = p.qtd - p.qtdPagas
    partes.push(abertas ? ` · ${abertas} em aberto` : ' · tudo pago')
  }
  return partes.join('')
}

function NavMes({
  calculo,
  mes,
  irParaMes,
}: {
  calculo: Calculo
  mes: string
  irParaMes: (mes: string) => void
}) {
  const { meses } = calculo
  const i = meses.indexOf(mes)
  const anos = [...new Set(meses.map((m) => m.slice(0, 4)))]
  const atual = mesAtual()
  const passo = (n: number) => {
    const destino = meses[i + n]
    if (destino) irParaMes(destino)
  }
  return (
    <div className="mes-nav">
      <button
        type="button"
        className="botao botao-icone"
        aria-label="Mês anterior"
        disabled={i === 0}
        onClick={() => passo(-1)}
      >
        <Icone.anterior />
      </button>
      <label className="sr-only" htmlFor="mes-seletor">
        Escolher mês
      </label>
      <select
        id="mes-seletor"
        className="seletor-mes"
        value={mes}
        onChange={(e) => irParaMes(e.target.value)}
      >
        {anos.map((ano) => (
          <optgroup key={ano} label={ano}>
            {meses
              .filter((m) => m.startsWith(ano))
              .map((m) => (
                <option key={m} value={m}>
                  {nomeMes(m)}
                  {statusMes(calculo, m)}
                </option>
              ))}
          </optgroup>
        ))}
      </select>
      <button
        type="button"
        className="botao botao-icone"
        aria-label="Próximo mês"
        disabled={i === meses.length - 1}
        onClick={() => passo(1)}
      >
        <Icone.proximo />
      </button>
      <button
        type="button"
        className="botao"
        hidden={mes === atual || !meses.includes(atual)}
        onClick={() => irParaMes(atual)}
      >
        Ir para o mês atual
      </button>
    </div>
  )
}

export function PaginaMes() {
  useTitulo('Mês')
  const dados = useDados()
  const { mes: mesPedido } = Route.useSearch()
  const navigate = useNavigate()
  // Valores de entradas sendo digitados: os números da tela acompanham antes de salvar.
  const [rascunho, setRascunho] = useState<Map<number, number>>(new Map())

  const calculoVivo = useMemo(() => {
    if (!dados || !rascunho.size) return dados?.calculo
    const copia = structuredClone(dados.estado)
    for (const e of copia.entradas) {
      const valor = rascunho.get(e.id)
      if (valor != null) e.valor = valor
    }
    return calcular(copia, mesAtual())
  }, [dados, rascunho])

  if (!dados || !calculoVivo) return null
  const { estado } = dados
  const calculo = calculoVivo
  const mes =
    mesPedido && calculo.indice.has(mesPedido) ? mesPedido : mesInicial(calculo)

  const irParaMes = (destino: string) => {
    if (!calculo.indice.has(destino)) return
    navigate({ to: '/mes', search: { mes: destino }, replace: true })
    window.scrollTo({ top: 0 })
  }

  const digitarEntrada = (id: number, valor: number | null) =>
    setRascunho((atual) => {
      if (valor == null && !atual.has(id)) return atual
      const novo = new Map(atual)
      if (valor == null) novo.delete(id)
      else novo.set(id, valor)
      return novo
    })

  const props = { estado, calculo, mes }
  return (
    <section className="view" aria-label="Contas do mês">
      <NavMes calculo={calculo} mes={mes} irParaMes={irParaMes} />
      {/* Trocar de mês redesenha tudo, limpando o que estava digitado nos formulários. */}
      <div id="mes-conteudo" key={mes}>
        <div className="painel" id="mes-resumo">
          <ResumoMes {...props} />
        </div>
        <div id="mes-avisos">
          <Avisos avisos={avisosMes(props)} />
        </div>
        <SecaoEntradas {...props} onDigitar={digitarEntrada} />
        <SecoesGrupos {...props} />
        <SecaoEmprestimos {...props} />
        <SecaoExtras {...props} />
        <NovaDespesa estado={estado} meses={calculo.meses} mes={mes} />
      </div>
    </section>
  )
}
