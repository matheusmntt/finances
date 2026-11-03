import { create } from 'zustand'

type EstadoBackoffice = {
  // Fichas e formulários "Adicionar" abertos (continuam abertos ao voltar para a aba).
  abertos: Set<string>
  // Filtro de texto e a tabela a que ele pertence: trocar de tabela limpa o filtro.
  busca: { entidade: string; texto: string }
  definirAberto: (id: string, aberto: boolean) => void
  definirBusca: (entidade: string, texto: string) => void
}

export const useBackoffice = create<EstadoBackoffice>((set) => ({
  abertos: new Set(),
  busca: { entidade: '', texto: '' },
  definirAberto: (id, aberto) =>
    set(({ abertos }) => {
      if (abertos.has(id) === aberto) return {}
      const novos = new Set(abertos)
      if (aberto) novos.add(id)
      else novos.delete(id)
      return { abertos: novos }
    }),
  definirBusca: (entidade, texto) => set({ busca: { entidade, texto } }),
}))
