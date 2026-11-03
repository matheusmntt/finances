// Aba "Greici e André": o que eles pagaram por você, o plano de devolução e a comparação entre os dois.
import { useState } from 'react'
import { useDados } from '@/api/estado'
import { Secao } from '@/components/secao'
import type { Calculo } from '@/domain/calculo'
import { reais } from '@/lib/formato'
import { useTitulo } from '@/lib/titulo'
import { PagasPorEles } from './pagas-por-eles'
import { Plano } from './plano'
import { ResumoDivida } from './resumo-divida'

function sinal(valor: number) {
  if (valor > 0) return `+${reais(valor)}`
  if (valor < 0) return `−${reais(-valor)}`
  return 'igual'
}

function Comparacao({ calculo }: { calculo: Calculo }) {
  const dv = calculo.divida
  return (
    <Secao
      titulo="Plano × o que eles pagam"
      descricao="“Eles pagam” soma o que já foi pago e o que falta do carro pelos valores de hoje. Diferença positiva: o plano devolve mais do que isso."
    >
      <div className="cartao tabela-wrap">
        <table className="tabela">
          <thead>
            <tr>
              <th scope="col">Parte</th>
              <th scope="col" className="num">
                Eles pagam
              </th>
              <th scope="col" className="num">
                No plano
              </th>
              <th scope="col" className="num">
                Diferença
              </th>
            </tr>
          </thead>
          <tbody>
            {dv.categorias
              .filter((c) => c.previsto || c.plano)
              .map((c) => (
                <tr key={c.id}>
                  <th scope="row">{c.nome}</th>
                  <td className="num">{reais(c.previsto)}</td>
                  <td className="num">{reais(c.plano)}</td>
                  <td className="num">{sinal(c.plano - c.previsto)}</td>
                </tr>
              ))}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row">Total</th>
              <td className="num">{reais(dv.previsto)}</td>
              <td className="num">{reais(dv.plano)}</td>
              <td className="num">{sinal(dv.plano - dv.previsto)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </Secao>
  )
}

export function PaginaDivida() {
  useTitulo('Greici e André')
  const dados = useDados()
  // Listas expandidas em "O que eles pagaram por você".
  const [abertos, setAbertos] = useState<Set<string>>(new Set())

  if (!dados) return null
  const { estado, calculo } = dados

  const alternar = (id: string) =>
    setAbertos((atual) => {
      const novo = new Set(atual)
      if (novo.has(id)) novo.delete(id)
      else novo.add(id)
      return novo
    })

  return (
    <section className="view" aria-label="Dívida com a Greici e o André">
      <div className="painel" id="div-resumo">
        <ResumoDivida calculo={calculo} />
      </div>
      <div id="div-pagas">
        <PagasPorEles
          estado={estado}
          calculo={calculo}
          abertos={abertos}
          alternar={alternar}
        />
      </div>
      <div id="div-plano">
        <Plano calculo={calculo} />
      </div>
      <div id="div-comparacao">
        <Comparacao calculo={calculo} />
      </div>
    </section>
  )
}
