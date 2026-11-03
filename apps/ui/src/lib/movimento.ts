// Presets de animação (motion). Rápidos e discretos: entram em ~200ms, saem mais rápido do que entram.
// O MotionConfig da raiz desliga tudo para quem pediu menos movimento no sistema.
import type { Transition } from 'motion/react'

export const EASE = [0.2, 0, 0, 1] as const
export const EASE_ENTRADA = [0.05, 0.7, 0.1, 1] as const

export const rapida: Transition = { duration: 0.12, ease: EASE }
export const padrao: Transition = { duration: 0.2, ease: EASE }
export const mola: Transition = {
  type: 'spring',
  stiffness: 520,
  damping: 38,
  mass: 0.8,
}

// Itens de lista que entram e saem (contas, entradas, metas...): abrem a altura e aparecem; ao sair,
// fecham a altura para os vizinhos subirem sem salto. Use dentro de <AnimatePresence initial={false}>.
export const itemLista = {
  layout: 'position' as const,
  initial: { opacity: 0, height: 0 },
  animate: {
    opacity: 1,
    height: 'auto',
    transition: { height: padrao, opacity: { ...padrao, delay: 0.04 } },
  },
  exit: {
    opacity: 0,
    height: 0,
    transition: { height: { ...rapida, delay: 0.04 }, opacity: rapida },
  },
  transition: mola,
  style: { overflow: 'clip' },
}

// Cartões e blocos que aparecem (fichas, avisos): sobem 6px e aparecem.
export const surgir = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0, transition: padrao },
  exit: { opacity: 0, y: -4, transition: rapida },
}

// Escalonamento curto para grupos que entram juntos (cartões de KPI).
export const escalonar = (i: number, passo = 0.03) => ({
  ...surgir,
  animate: {
    ...surgir.animate,
    transition: { ...padrao, delay: Math.min(i, 8) * passo },
  },
})
