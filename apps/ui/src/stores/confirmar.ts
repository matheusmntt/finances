import { create } from 'zustand'

export type PedidoConfirmacao = {
  titulo: string
  mensagem?: string
  confirmar?: string // texto do botão ("Remover")
  perigo?: boolean // ação destrutiva: botão vermelho
}

type ConfirmarStore = {
  pedido: (PedidoConfirmacao & { responder: (sim: boolean) => void }) | null
  pedir: (pedido: PedidoConfirmacao) => Promise<boolean>
  responder: (sim: boolean) => void
}

export const useConfirmar = create<ConfirmarStore>((set, get) => ({
  pedido: null,
  pedir: (pedido) =>
    new Promise<boolean>((resolve) => {
      get().pedido?.responder(false)
      set({ pedido: { ...pedido, responder: resolve } })
    }),
  responder: (sim) => {
    get().pedido?.responder(sim)
    set({ pedido: null })
  },
}))

// No lugar de window.confirm: `if (!(await confirmar({ titulo: 'Remover a Netflix?', perigo: true }))) return`.
export const confirmar = (pedido: PedidoConfirmacao) =>
  useConfirmar.getState().pedir(pedido)
