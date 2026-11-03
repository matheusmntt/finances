import { type QueryClient, queryOptions, useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { calcular } from '@/domain/calculo'
import type { Estado } from '@/domain/tipos'
import { api } from '@/lib/api'
import { mesAtual } from '@/lib/formato'

export const estadoQuery = queryOptions({
  queryKey: ['estado'],
  queryFn: () => api<Estado>('/estado'),
})

export const useEstado = () => useQuery(estadoQuery)

// O estado e os números calculados a partir dele (saldo de cada mês, dívida, carro, salário previsto).
export function useDados() {
  const { data: estado } = useQuery(estadoQuery)
  const calculo = useMemo(
    () => (estado ? calcular(estado, mesAtual()) : undefined),
    [estado],
  )
  return estado && calculo ? { estado, calculo } : undefined
}

// Muda o estado em cache antes de a resposta chegar (para marcar como pago sem esperar a rede).
export function alterarEstadoEmCache(
  queryClient: QueryClient,
  alterar: (estado: Estado) => void,
) {
  queryClient.setQueryData<Estado>(estadoQuery.queryKey, (atual) => {
    if (!atual) return atual
    const copia = structuredClone(atual)
    alterar(copia)
    return copia
  })
}
