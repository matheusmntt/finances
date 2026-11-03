import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { Estado } from '@/domain/tipos'
import { api } from '@/lib/api'
import { toast, toastErro } from '@/stores/toast'
import { alterarEstadoEmCache, estadoQuery } from './estado'

export type Pedido = {
  caminho: string
  metodo?: 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  corpo?: unknown
  nomeArquivo?: string
  // Mensagem do toast quando der certo, e "Desfazer" opcional.
  mensagem?: string
  desfazer?: () => void
  // Aplica a mudança no cache antes da resposta (desfeita se a API recusar).
  otimista?: (estado: Estado) => void
}

// Uma alteração qualquer: chama a API e recarrega o estado. Erros viram toast com a mensagem da API.
// Todas vão em fila, na ordem em que foram feitas (um "Desfazer" logo depois da ação não chega antes dela).
export function useSalvar() {
  const queryClient = useQueryClient()
  return useMutation({
    scope: { id: 'salvar' },
    mutationFn: (pedido: Pedido) =>
      api<unknown>(pedido.caminho, {
        metodo: pedido.metodo ?? 'POST',
        corpo: pedido.corpo,
        nomeArquivo: pedido.nomeArquivo,
      }),
    onMutate: async (pedido) => {
      if (!pedido.otimista) return
      await queryClient.cancelQueries({ queryKey: estadoQuery.queryKey })
      alterarEstadoEmCache(queryClient, pedido.otimista)
    },
    onSuccess: (_resposta, pedido) => {
      if (pedido.mensagem) toast(pedido.mensagem, pedido.desfazer)
    },
    onError: (erro) => toastErro(erro.message),
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: estadoQuery.queryKey }),
  })
}
