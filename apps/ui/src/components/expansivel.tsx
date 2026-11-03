import { AnimatePresence, motion } from 'motion/react'
import type { ReactNode } from 'react'
import { padrao, rapida } from '@/lib/movimento'

type ExpansivelProps = {
  aberto: boolean
  id?: string
  className?: string
  children: ReactNode
}

// Conteúdo que abre e fecha animando a altura (detalhes de uma multa, sublistas). O botão que controla
// usa aria-expanded e aria-controls={id}. Fechado, o conteúdo sai do DOM.
export function Expansivel({
  aberto,
  id,
  className,
  children,
}: ExpansivelProps) {
  return (
    <AnimatePresence initial={false}>
      {aberto ? (
        <motion.div
          key="conteudo"
          id={id}
          className={className}
          style={{ overflow: 'clip' }}
          initial={{ height: 0, opacity: 0 }}
          animate={{
            height: 'auto',
            opacity: 1,
            transition: { height: padrao, opacity: { ...padrao, delay: 0.05 } },
          }}
          exit={{
            height: 0,
            opacity: 0,
            transition: { height: rapida, opacity: { duration: 0.08 } },
          }}
        >
          {children}
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
