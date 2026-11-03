// Peças usadas pelas abas "Mês" e "Greici e André".
import { useSalvar } from '@/api/mutacoes'
import { type Calculo, parcela } from '@/domain/calculo'
import type { Despesa, Estado } from '@/domain/tipos'
import { isoHoje, mesAtual, mesCurto, nomeMes } from '@/lib/formato'

export const soma = (lista: (number | null | undefined)[]) =>
  lista.reduce<number>((total, v) => total + (v ?? 0), 0)

// Mês aberto quando o endereço não diz qual: o atual, ou o mais próximo dele com lançamentos.
export function mesInicial(calculo: Calculo) {
  const { meses, porMes } = calculo
  const atual = mesAtual()
  if (meses.includes(atual)) return atual
  if (atual < (meses[0] as string)) {
    const primeiro = porMes.find((p) => p.entradas || p.totalDespesas)
    return primeiro ? primeiro.mes : (meses[0] as string)
  }
  return meses[meses.length - 1] as string
}

// "Parcela 2 de 3", "Parcela única" ou "Todo mês".
export function textoParcela(despesa: Despesa, mes: string, calculo: Calculo) {
  const p = parcela(despesa, mes, calculo.meses, calculo.indice)
  if (!p) return ''
  if (p.recorrente) return 'Todo mês'
  if (p.total === 1) return 'Parcela única'
  return `Parcela ${p.numero} de ${p.total}`
}

export const nomeCategoria = (estado: Estado, id: string) =>
  estado.categorias.find((c) => c.id === id)?.nome ?? id

// Opções do seletor de meses, agrupadas por ano.
export function OpcoesMeses({ meses }: { meses: string[] }) {
  const anos = [...new Set(meses.map((m) => m.slice(0, 4)))]
  return (
    <>
      {anos.map((ano) => (
        <optgroup key={ano} label={ano}>
          {meses
            .filter((m) => m.startsWith(ano))
            .map((m) => (
              <option key={m} value={m}>
                {nomeMes(m)}
              </option>
            ))}
        </optgroup>
      ))}
    </>
  )
}

// Marca (ou desmarca) uma despesa como paga no mês, com "Desfazer". A tela muda antes da resposta.
export function useMarcarDespesa() {
  const salvar = useSalvar()
  return (despesa: Despesa, mes: string, marcado: boolean) => {
    const anterior = despesa.valores[mes]?.pagoEm ?? null
    const caminho = `/despesas/${despesa.id}/meses/${mes}/pago`
    const pagar = (pagoEm: string | null) => (e: Estado) => {
      const v = e.despesas.find((x) => x.id === despesa.id)?.valores[mes]
      if (v) v.pagoEm = pagoEm
    }
    const pagoEm = marcado ? (anterior ?? isoHoje()) : null
    salvar.mutate({
      caminho,
      metodo: 'PUT',
      corpo: { pagoEm },
      otimista: pagar(pagoEm),
      mensagem: `${despesa.nome} (${mesCurto(mes)}) ${marcado ? 'marcada como paga' : 'voltou para “a pagar”'}`,
      desfazer: () =>
        salvar.mutate({
          caminho,
          metodo: 'PUT',
          corpo: { pagoEm: anterior },
          otimista: pagar(anterior),
        }),
    })
  }
}
