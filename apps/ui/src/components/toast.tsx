import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { mola } from '@/lib/movimento'
import { type Toast as ToastDados, useToast } from '@/stores/toast'
import { Icone } from './icones'

const ICONES = { ok: Icone.ok, erro: Icone.alerta, info: Icone.info }

// Pilha de toasts no rodapé. Entram de baixo com mola, saem para o lado; dá para arrastar para dispensar.
export function Toast() {
  const toasts = useToast((s) => s.toasts)
  return (
    <section className="toasts" aria-label="Notificações">
      <ol>
        <AnimatePresence initial={false}>
          {toasts.map((t) => (
            <ItemToast key={t.id} toast={t} />
          ))}
        </AnimatePresence>
      </ol>
    </section>
  )
}

function ItemToast({ toast }: { toast: ToastDados }) {
  const fechar = useToast((s) => s.fechar)
  const [pausado, setPausado] = useState(false)
  const restante = useRef(toast.duracao)
  const inicio = useRef(0)

  // Some sozinho; o tempo para enquanto o mouse ou o foco estão no toast.
  useEffect(() => {
    if (pausado) return
    inicio.current = Date.now()
    const timer = setTimeout(() => fechar(toast.id), restante.current)
    return () => {
      clearTimeout(timer)
      restante.current -= Date.now() - inicio.current
    }
  }, [pausado, fechar, toast.id])

  const IconeTipo = ICONES[toast.tipo]
  return (
    <motion.li
      layout
      className={`toast toast-${toast.tipo}`}
      role={toast.tipo === 'erro' ? 'alert' : 'status'}
      initial={{ opacity: 0, y: 24, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, x: 40, transition: { duration: 0.14 } }}
      transition={mola}
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={{ left: 0.1, right: 0.6 }}
      onDragEnd={(_e, info) => {
        if (info.offset.x > 80 || info.velocity.x > 500) fechar(toast.id)
      }}
      onPointerEnter={() => setPausado(true)}
      onPointerLeave={() => setPausado(false)}
      onFocus={() => setPausado(true)}
      onBlur={() => setPausado(false)}
    >
      <span className="toast-icone">
        <IconeTipo />
      </span>
      <span className="toast-mensagem">{toast.mensagem}</span>
      {toast.desfazer ? (
        <button
          type="button"
          className="toast-acao"
          onClick={() => {
            toast.desfazer?.()
            fechar(toast.id)
          }}
        >
          Desfazer
        </button>
      ) : null}
      <button
        type="button"
        className="toast-fechar"
        aria-label="Fechar notificação"
        onClick={() => fechar(toast.id)}
      >
        <Icone.fechar />
      </button>
      <span
        className="toast-tempo"
        style={{
          animationDuration: `${toast.duracao}ms`,
          animationPlayState: pausado ? 'paused' : 'running',
        }}
        aria-hidden="true"
      />
    </motion.li>
  )
}
