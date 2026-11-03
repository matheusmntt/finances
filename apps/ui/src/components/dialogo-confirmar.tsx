import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useId, useRef } from 'react'
import { mola, rapida } from '@/lib/movimento'
import { useConfirmar } from '@/stores/confirmar'
import { Botao } from './botao'

// Diálogo de confirmação (overlay). O fundo escurece, o cartão sobe com mola; Esc ou clique fora cancela.
// Usa <dialog> modal: o foco fica preso nele e volta para onde estava ao fechar.
export function DialogoConfirmar() {
  const pedido = useConfirmar((s) => s.pedido)
  const responder = useConfirmar((s) => s.responder)
  const ref = useRef<HTMLDialogElement>(null)
  const idTitulo = useId()
  const idTexto = useId()

  useEffect(() => {
    const dialogo = ref.current
    if (pedido && dialogo && !dialogo.open) dialogo.showModal()
  }, [pedido])

  return (
    <AnimatePresence onExitComplete={() => ref.current?.close()}>
      {pedido ? (
        <motion.dialog
          ref={ref}
          className="dialogo"
          aria-labelledby={idTitulo}
          aria-describedby={pedido.mensagem ? idTexto : undefined}
          role="alertdialog"
          onCancel={(e) => {
            e.preventDefault()
            responder(false)
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) responder(false)
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={rapida}
        >
          <motion.div
            className="dialogo-cartao"
            initial={{ opacity: 0, y: 12, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.98, transition: rapida }}
            transition={mola}
          >
            <h2 id={idTitulo}>{pedido.titulo}</h2>
            {pedido.mensagem ? <p id={idTexto}>{pedido.mensagem}</p> : null}
            <div className="dialogo-acoes">
              {/* Ação destrutiva: o foco começa em Cancelar, para um Enter distraído não apagar nada. */}
              <Botao autoFocus={pedido.perigo} onClick={() => responder(false)}>
                Cancelar
              </Botao>
              <Botao
                variante={pedido.perigo ? 'perigo' : 'primario'}
                autoFocus={!pedido.perigo}
                onClick={() => responder(true)}
              >
                {pedido.confirmar ?? 'Confirmar'}
              </Botao>
            </div>
          </motion.div>
        </motion.dialog>
      ) : null}
    </AnimatePresence>
  )
}
