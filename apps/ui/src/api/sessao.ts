import {
  queryOptions,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query'
import { api } from '@/lib/api'

export const sessaoQuery = queryOptions({
  queryKey: ['sessao'],
  queryFn: () => api<{ autenticado: boolean }>('/auth/sessao'),
  staleTime: 60_000,
})

export function useEntrar() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (senha: string) =>
      api('/auth/login', { metodo: 'POST', corpo: { senha } }),
    onSuccess: () =>
      queryClient.setQueryData(sessaoQuery.queryKey, { autenticado: true }),
  })
}

export function useSair() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => api('/auth/logout', { metodo: 'POST' }),
    onSettled: () => {
      queryClient.clear()
      window.location.assign('/login')
    },
  })
}
