import { create } from 'zustand'

export type TipoToast = 'info' | 'ok' | 'erro'

export type Toast = {
  id: number
  mensagem: string
  tipo: TipoToast
  desfazer?: () => void
  duracao: number
}

type ToastStore = {
  toasts: Toast[]
  mostrar: (
    mensagem: string,
    opcoes?: { desfazer?: () => void; tipo?: TipoToast },
  ) => void
  fechar: (id: number) => void
}

const MAXIMO = 3
let proximoId = 1

// Mensagens rápidas no rodapé ("Netflix marcada como paga"), com "Desfazer" opcional. Até três empilhadas;
// cada uma some sozinha (o componente pausa o tempo enquanto o mouse ou o foco estão nela).
export const useToast = create<ToastStore>((set) => ({
  toasts: [],
  mostrar: (mensagem, { desfazer, tipo = 'ok' } = {}) =>
    set((s) => ({
      toasts: [
        ...s.toasts.filter((t) => t.mensagem !== mensagem),
        {
          id: proximoId++,
          mensagem,
          tipo,
          desfazer,
          duracao: desfazer ? 6000 : tipo === 'erro' ? 5000 : 2800,
        },
      ].slice(-MAXIMO),
    })),
  fechar: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}))

// Confirmação de algo que deu certo (com "Desfazer" opcional).
export const toast = (mensagem: string, desfazer?: () => void) =>
  useToast.getState().mostrar(mensagem, { desfazer })

// Erro: vem da API ou de uma validação. Fica um pouco mais na tela.
export const toastErro = (mensagem: string) =>
  useToast.getState().mostrar(mensagem, { tipo: 'erro' })

// Aviso neutro, sem ser sucesso nem erro.
export const toastInfo = (mensagem: string) =>
  useToast.getState().mostrar(mensagem, { tipo: 'info' })
