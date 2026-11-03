import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

export type FiltroMultas = 'pendentes' | 'pagos' | 'todos'
export type VisaoProjecao = '12-meses' | 'tudo'

type Preferencias = {
  filtroMultas: FiltroMultas
  visaoProjecao: VisaoProjecao
  definirFiltroMultas: (filtro: FiltroMultas) => void
  definirVisaoProjecao: (visao: VisaoProjecao) => void
}

// Escolhas que o app lembra entre uma visita e outra (ficam no navegador).
export const usePreferencias = create<Preferencias>()(
  persist(
    (set) => ({
      filtroMultas: 'pendentes',
      visaoProjecao: '12-meses',
      definirFiltroMultas: (filtroMultas) => set({ filtroMultas }),
      definirVisaoProjecao: (visaoProjecao) => set({ visaoProjecao }),
    }),
    {
      name: 'financas.preferencias.v1',
      storage: createJSONStorage(() => localStorage),
    },
  ),
)
