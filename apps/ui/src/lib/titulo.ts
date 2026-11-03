import { useEffect } from 'react'

// Título da aba do navegador: "Projeção · Minhas finanças".
export function useTitulo(titulo: string) {
  useEffect(() => {
    document.title = `${titulo} · Minhas finanças`
  }, [titulo])
}
