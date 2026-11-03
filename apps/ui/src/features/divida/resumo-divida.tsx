import { Resumo } from '@/components/resumo'
import type { Calculo } from '@/domain/calculo'
import { soma } from '@/features/mes/comum'
import { juntar, mesAtual, mesCurto, plural, reais } from '@/lib/formato'

// "luz, internet e faxina"
export const nomesContasDiretas = (calculo: Calculo) =>
  juntar(
    calculo.divida.contasDiretas.map((x) =>
      (x.nomeCurto || x.nome).toLowerCase(),
    ),
  )

// Cartão do topo: quanto falta devolver e o que vai para eles no mês atual.
export function ResumoDivida({ calculo }: { calculo: Calculo }) {
  const dv = calculo.divida
  const falta = dv.pagoPorEles - dv.devolvido
  const ultimoMes = dv.mesesPlano[dv.mesesPlano.length - 1]
  const mes = mesAtual()
  const paraEles = soma(
    [...dv.devolucoes, ...dv.contasDiretas].map((x) => x.valores[mes]?.valor),
  )
  return (
    <Resumo
      rotulo="Falta devolver para a Greici e o André"
      valor={reais(Math.max(0, falta))}
      sub={
        falta <= 0
          ? `Você já devolveu tudo o que eles pagaram até agora${falta < 0 ? ` (e ${reais(-falta)} a mais)` : ''}.`
          : `${reais(dv.devolvido)} devolvidos de ${reais(dv.pagoPorEles)} que eles já pagaram`
      }
      pct={
        dv.pagoPorEles
          ? Math.min(100, Math.round((dv.devolvido / dv.pagoPorEles) * 100))
          : 0
      }
      stats={[
        {
          rotulo: 'Eles já pagaram',
          valor: reais(dv.pagoPorEles),
          sub: 'contas, cartão e carro',
        },
        {
          rotulo: 'Você devolveu',
          valor: reais(dv.devolvido),
          sub: `${dv.qtdDevolvidas} de ${plural(dv.qtdParcelas, 'parcela', 'parcelas')}`,
        },
        {
          rotulo: 'Plano termina em',
          valor: ultimoMes ? mesCurto(ultimoMes) : '—',
          sub: `${reais(dv.plano)} no total`,
        },
        {
          rotulo: `Para eles em ${mesCurto(mes)}`,
          valor: reais(paraEles),
          sub: dv.contasDiretas.length
            ? `devolução + ${nomesContasDiretas(calculo)}`
            : 'devolução',
        },
      ]}
    />
  )
}
