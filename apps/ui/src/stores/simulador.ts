import { create } from 'zustand'
import { SIMULACAO_VAZIA, type Simulacao } from '@/domain/projecao'

type SimuladorStore = {
  sim: Simulacao
  definir: <K extends keyof Simulacao>(campo: K, valor: Simulacao[K]) => void
  limpar: () => void
}

// Cenário do simulador da Projeção: muda só o que a tela mostra; nada é salvo.
export const useSimulador = create<SimuladorStore>((set) => ({
  sim: SIMULACAO_VAZIA,
  definir: (campo, valor) =>
    set((s) => ({ sim: { ...s.sim, [campo]: valor } })),
  limpar: () => set({ sim: SIMULACAO_VAZIA }),
}))
