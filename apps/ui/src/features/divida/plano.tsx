import { useEffect, useState } from 'react'
import { useSalvar } from '@/api/mutacoes'
import { CampoReais } from '@/components/campo-reais'
import { Icone } from '@/components/icones'
import { Secao } from '@/components/secao'
import type { Calculo } from '@/domain/calculo'
import type { Despesa } from '@/domain/tipos'
import { soma, useMarcarDespesa } from '@/features/mes/comum'
import {
  mesAtual,
  mesCurto,
  nomeMes,
  plural,
  proximoMes,
  reais,
  titulo,
} from '@/lib/formato'
import { nomesContasDiretas } from './resumo-divida'

// Uma célula do plano: caixa de "pago" (normal) ou campo de valor (editando).
function Celula({
  despesa,
  mes,
  editando,
  inicioGrupo,
  aoEditar,
}: {
  despesa: Despesa
  mes: string
  editando: boolean
  inicioGrupo: boolean
  aoEditar: (mes: string) => void
}) {
  const salvar = useSalvar()
  const marcar = useMarcarDespesa()
  const v = despesa.valores[mes]
  const rotulo = `${despesa.nomeCurto || despesa.nome} em ${nomeMes(mes)}`
  const grupo = inicioGrupo ? ' inicio-grupo' : ''

  if (editando && despesa.pagoAosCredores && !despesa.categoriaDivida) {
    // Contas fixas: aparecem para conferir o total, mas não são editadas aqui.
    return (
      <td className={`num${grupo}${v ? '' : ' vazio-celula'}`}>
        {v ? reais(v.valor) : '—'}
      </td>
    )
  }

  if (editando) {
    // Vazio tira a parcela do mês (valor 0 na API).
    const editar = (centavos: number | null) => {
      const valor = centavos ?? 0
      if (valor === (v?.valor ?? 0)) return
      aoEditar(mes)
      salvar.mutate({
        caminho: `/despesas/${despesa.id}/meses/${mes}`,
        metodo: 'PUT',
        corpo: { valor },
        otimista: (e) => {
          const x = e.despesas.find((y) => y.id === despesa.id)
          if (!x) return
          const atual = x.valores[mes]
          if (valor === 0) delete x.valores[mes]
          else
            x.valores[mes] = {
              pagoEm: null,
              pagoPorCredores: false,
              ...atual,
              valor,
            }
        },
      })
    }
    return (
      <td className="num">
        <CampoReais
          className="campo-tabela"
          valor={v ? v.valor : null}
          onSalvar={editar}
          placeholder="—"
          aria-label={rotulo}
          data-plano-mes={mes}
        />
        {v?.pagoEm ? <span className="tag tag-pago">paga</span> : null}
      </td>
    )
  }

  if (!v) return <td className={`num vazio-celula${grupo}`}>—</td>
  const atrasada = !v.pagoEm && mes < mesAtual()
  return (
    <td className={`num${grupo}`}>
      <label className={`check-valor${v.pagoEm ? ' paga' : ''}`}>
        <input
          type="checkbox"
          checked={Boolean(v.pagoEm)}
          onChange={(e) => marcar(despesa, mes, e.target.checked)}
        />
        <span>{reais(v.valor)}</span>
        <span className="sr-only">{rotulo}</span>
      </label>
      {atrasada ? <span className="tag tag-alerta">atrasada</span> : null}
    </td>
  )
}

// Tabela com as parcelas de devolução (e as contas pagas direto a eles) mês a mês.
export function Plano({ calculo }: { calculo: Calculo }) {
  const dv = calculo.divida
  const diretas = dv.contasDiretas
  const colunas = [...dv.devolucoes, ...diretas]
  const [editando, setEditando] = useState(false)
  // Meses mostrados durante a edição mesmo sem valor (os adicionados e os que ficaram vazios).
  const [mesesNovos, setMesesNovos] = useState<string[]>([])
  const [focar, setFocar] = useState<string | null>(null)
  const atual = mesAtual()

  const meses = [
    ...new Set([...dv.mesesPlano, ...(editando ? mesesNovos : [])]),
  ].sort()

  // Depois de "Adicionar mês", leva o foco para o primeiro campo da linha nova.
  useEffect(() => {
    if (!focar) return
    document
      .querySelector<HTMLInputElement>(`[data-plano-mes="${focar}"]`)
      ?.focus()
    setFocar(null)
  }, [focar])

  const inicioGrupo = (k: number) =>
    diretas.length > 0 && k === dv.devolucoes.length

  // Devolução: total do plano inteiro. Contas diretas: só dos meses mostrados.
  const totalColuna = (despesa: Despesa) =>
    despesa.categoriaDivida
      ? soma(Object.values(despesa.valores).map((v) => v.valor))
      : soma(meses.map((m) => despesa.valores[m]?.valor))

  const cabecalhoColuna = (despesa: Despesa, k: number) => (
    <th
      key={despesa.id}
      scope="col"
      className={`num${inicioGrupo(k) ? ' inicio-grupo' : ''}`}
      title={despesa.nome}
    >
      {despesa.nomeCurto || despesa.nome}
    </th>
  )

  const explicacaoDiretas = diretas.length
    ? ` ${titulo(nomesContasDiretas(calculo))} não são devolução: você paga direto a eles junto com as parcelas, e por isso entram no “Total para eles” mas não na dívida.`
    : ''

  const barra = (
    <div className="barra-plano">
      <p className="sub">
        {editando
          ? 'Digite os valores combinados da devolução. Deixe vazio para tirar a parcela do mês. Tudo é salvo na hora.'
          : `Marque cada pagamento quando fizer. Eles também aparecem na aba Mês.${explicacaoDiretas}`}
      </p>
      <div className="barra-plano-acoes">
        {editando ? (
          <button
            type="button"
            className="botao"
            onClick={() => {
              const ultimo = meses[meses.length - 1]
              const novo = proximoMes(ultimo ?? atual)
              setMesesNovos((lista) => [...lista, novo])
              setFocar(novo)
            }}
          >
            <Icone.mais />
            Adicionar mês
          </button>
        ) : null}
        <button
          type="button"
          className={`botao${editando ? ' botao-primario' : ''}`}
          onClick={() => {
            setEditando(!editando)
            setMesesNovos([])
          }}
        >
          {editando ? (
            'Concluir edição'
          ) : (
            <>
              <Icone.editar />
              Editar plano
            </>
          )}
        </button>
      </div>
    </div>
  )

  return (
    <Secao
      titulo="Plano de devolução"
      total={reais(dv.plano)}
      legendaTotal={`${plural(dv.qtdParcelas, 'parcela', 'parcelas')} de devolução`}
      topo={barra}
    >
      <div className="cartao tabela-wrap">
        <table className="tabela tabela-plano">
          <thead>
            {diretas.length ? (
              <>
                <tr className="grupos-colunas">
                  <td />
                  <th
                    scope="colgroup"
                    colSpan={dv.devolucoes.length}
                    className="num"
                  >
                    Devolução
                  </th>
                  <th
                    scope="colgroup"
                    colSpan={diretas.length}
                    className="num inicio-grupo"
                  >
                    Pago direto a eles
                  </th>
                  <td />
                </tr>
                <tr>
                  <th scope="col">Mês</th>
                  {colunas.map(cabecalhoColuna)}
                  <th scope="col" className="num">
                    Total para eles
                  </th>
                </tr>
              </>
            ) : (
              <tr>
                <th scope="col">Mês</th>
                {colunas.map(cabecalhoColuna)}
                <th scope="col" className="num">
                  Total do mês
                </th>
              </tr>
            )}
          </thead>
          <tbody>
            {meses.length ? (
              meses.map((mes) => {
                const ehAtual = mes === atual
                return (
                  <tr key={mes} className={ehAtual ? 'atual' : undefined}>
                    <th scope="row">
                      {mesCurto(mes)}
                      {ehAtual ? (
                        <>
                          {' '}
                          <span className="tag">atual</span>
                        </>
                      ) : null}
                    </th>
                    {colunas.map((despesa, k) => (
                      <Celula
                        key={despesa.id}
                        despesa={despesa}
                        mes={mes}
                        editando={editando}
                        inicioGrupo={inicioGrupo(k)}
                        aoEditar={(m) =>
                          setMesesNovos((lista) =>
                            lista.includes(m) ? lista : [...lista, m],
                          )
                        }
                      />
                    ))}
                    <td className="num total-para-eles">
                      {reais(soma(colunas.map((x) => x.valores[mes]?.valor)))}
                    </td>
                  </tr>
                )
              })
            ) : (
              <tr>
                <td colSpan={colunas.length + 2} className="vazio-celula">
                  Nenhuma parcela no plano.
                </td>
              </tr>
            )}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row">Total</th>
              {colunas.map((despesa, k) => (
                <td
                  key={despesa.id}
                  className={`num${inicioGrupo(k) ? ' inicio-grupo' : ''}`}
                >
                  {reais(totalColuna(despesa))}
                </td>
              ))}
              <td className="num">{reais(soma(colunas.map(totalColuna)))}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </Secao>
  )
}
