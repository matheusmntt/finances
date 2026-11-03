import { create } from 'zustand'

export type Tema = 'claro' | 'escuro'

// A chave e o formato são os mesmos de public/tema-inicial.js, que aplica o tema antes de a página aparecer.
const CHAVE = 'tema.v1'
const sistemaEscuro = () =>
  window.matchMedia('(prefers-color-scheme: dark)').matches

function salvo(): Tema | null {
  try {
    const tema = localStorage.getItem(CHAVE)
    return tema === 'claro' || tema === 'escuro' ? tema : null
  } catch {
    return null
  }
}

function aplicar(tema: Tema | null) {
  const raiz = document.documentElement
  if (tema) raiz.dataset.theme = tema === 'escuro' ? 'dark' : 'light'
  else delete raiz.dataset.theme
  // Cor da barra do navegador e do app instalado: o fundo do tema em uso.
  const fundo = getComputedStyle(raiz).getPropertyValue('--bg').trim()
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', fundo)
}

// Troca o tema com uma transição de página (círculo que se abre a partir do botão), quando o navegador
// tem View Transitions e a pessoa não pediu menos movimento.
function comTransicao(
  origem: { x: number; y: number } | undefined,
  mudar: () => void,
) {
  const reduzido = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (!document.startViewTransition || reduzido || !origem) {
    mudar()
    return
  }
  const raiz = document.documentElement
  raiz.style.setProperty('--vt-x', `${origem.x}px`)
  raiz.style.setProperty('--vt-y', `${origem.y}px`)
  document.startViewTransition(mudar)
}

type TemaStore = {
  tema: Tema
  alternar: (origem?: { x: number; y: number }) => void
  sincronizarComSistema: () => void
}

// Sem escolha salva, segue o tema do sistema; depois do primeiro clique, a escolha vale mais.
export const useTema = create<TemaStore>((set, get) => ({
  tema: salvo() ?? (sistemaEscuro() ? 'escuro' : 'claro'),
  alternar: (origem) => {
    const tema: Tema = get().tema === 'escuro' ? 'claro' : 'escuro'
    comTransicao(origem, () => {
      aplicar(tema)
      set({ tema })
    })
    try {
      localStorage.setItem(CHAVE, tema)
    } catch {
      // sem armazenamento: vale só até recarregar
    }
  },
  sincronizarComSistema: () => {
    if (salvo()) return
    aplicar(null)
    set({ tema: sistemaEscuro() ? 'escuro' : 'claro' })
  },
}))
