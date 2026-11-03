// Tabela mês a mês, agrupada por ano (cada ano abre e fecha).
import { Link, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { Icone } from '@/components/icones'
import { Secao } from '@/components/secao'
import type { LinhaProjecao } from '@/domain/projecao'
import { mesCurto, reais } from '@/lib/formato'
import type { Projecao } from './contexto'
import { soma } from './textos'

const Celula = ({ v, negativo = v < 0 }: { v: number; negativo?: boolean }) => (
  <td className={`num${negativo ? ' negativo' : ''}`}>{reais(v)}</td>
)

// Patrimônio positivo em destaque: verde e com o sinal de mais.
const CelulaPatrimonio = ({ v }: { v: number }) =>
  v > 0 ? <td className="num positivo">+{reais(v)}</td> : <Celula v={v} />

export function TabelaMeses({ p }: { p: Projecao }) {
  const { linhas, r, mesAtual } = p
  const navegar = useNavigate()
  const [anosAbertos, setAnosAbertos] = useState(
    () => new Set([mesAtual.slice(0, 4)]),
  )
  const visiveis = linhas.slice(r.iPrimeiro)
  const comCenario = r.cenario.disponivel
  const anos = [...new Set(visiveis.map((l) => l.mes.slice(0, 4)))]

  function alternar(ano: string) {
    setAnosAbertos((atual) => {
      const novo = new Set(atual)
      if (novo.has(ano)) novo.delete(ano)
      else novo.add(ano)
      return novo
    })
  }

  return (
    <Secao
      titulo="Mês a mês"
      descricao={`Na linha de cada ano: entradas, despesas e sobra somadas; guardado, dívida e patrimônio no fim do ano. “Na conta” é a soma das sobras sem render; “Investindo ${r.cenario.pct}%” é a parte investida do cenário. Até ${mesCurto(mesAtual)} os valores são do que aconteceu; depois, previsão. Clique em um mês para ver as contas.`}
    >
      <div className="cartao tabela-wrap">
        <table className="tabela tabela-anos">
          <thead>
            <tr>
              <th scope="col">Mês</th>
              <th scope="col" className="num">
                Entradas
              </th>
              <th scope="col" className="num">
                Despesas
              </th>
              <th scope="col" className="num">
                Sobra
              </th>
              <th scope="col" className="num">
                No CDB
              </th>
              <th scope="col" className="num">
                Na conta
              </th>
              {comCenario ? (
                <th scope="col" className="num">
                  Investindo {r.cenario.pct}%
                </th>
              ) : null}
              <th scope="col" className="num">
                Falta devolver
              </th>
              <th scope="col" className="num">
                Patrimônio
              </th>
            </tr>
          </thead>
          {anos.map((ano) => {
            const doAno = visiveis.filter((l) => l.mes.startsWith(ano))
            const fim = doAno[doAno.length - 1] as LinhaProjecao
            const aberto = anosAbertos.has(ano)
            return (
              <tbody key={ano}>
                <tr className="linha-ano">
                  <th scope="row">
                    <button
                      type="button"
                      className="botao-ano"
                      aria-expanded={aberto}
                      onClick={() => alternar(ano)}
                    >
                      <Icone.seta />
                      {ano}
                    </button>
                  </th>
                  <Celula
                    v={soma(doAno.map((l) => l.entradas))}
                    negativo={false}
                  />
                  <Celula
                    v={soma(doAno.map((l) => l.despesas))}
                    negativo={false}
                  />
                  <Celula v={soma(doAno.map((l) => l.saldo))} />
                  <Celula v={fim.guardado} />
                  <Celula v={fim.acumulado} />
                  {comCenario ? <Celula v={fim.investidoCenario} /> : null}
                  <Celula v={fim.faltaDevolver} negativo={false} />
                  <CelulaPatrimonio v={fim.patrimonio} />
                </tr>
                {doAno.map((l) => {
                  const atual = l.mes === mesAtual
                  return (
                    <tr
                      key={l.mes}
                      className={`linha-mes${atual ? ' atual' : ''}`}
                      hidden={!aberto}
                      onClick={(e) => {
                        if ((e.target as HTMLElement).closest('a')) return
                        navegar({ to: '/mes', search: { mes: l.mes } })
                      }}
                    >
                      <th scope="row">
                        <Link to="/mes" search={{ mes: l.mes }}>
                          {mesCurto(l.mes)}
                        </Link>
                        {atual ? (
                          <>
                            {' '}
                            <span className="tag">atual</span>
                          </>
                        ) : null}
                      </th>
                      <Celula v={l.entradas} negativo={false} />
                      <Celula v={l.despesas} negativo={false} />
                      <Celula v={l.saldo} />
                      <Celula v={l.guardado} />
                      <Celula v={l.acumulado} />
                      {comCenario ? <Celula v={l.investidoCenario} /> : null}
                      <Celula v={l.faltaDevolver} negativo={false} />
                      <CelulaPatrimonio v={l.patrimonio} />
                    </tr>
                  )
                })}
              </tbody>
            )
          })}
        </table>
      </div>
    </Secao>
  )
}
