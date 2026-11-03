// Pedaços repetidos nos cartões de multas e despesas: copiar código, prazo e data de pagamento.
import { useEffect, useRef, useState } from 'react'
import { Icone } from '@/components/icones'
import { diasAte } from '@/lib/formato'
import { toast } from '@/stores/toast'
import { copiarTexto, nivel, prazoTexto } from './utilidades'

// Copia a linha digitável (só os dígitos) e mostra "Copiado!" por um instante.
export function BotaoCopiar({ linha }: { linha: string | null }) {
  const [copiado, setCopiado] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)

  useEffect(() => () => clearTimeout(timer.current), [])

  const copiar = async () => {
    const ok = linha ? await copiarTexto(linha.replace(/\D/g, '')) : false
    if (!ok) {
      toast('Não consegui copiar. Abra os detalhes e copie a linha digitável.')
      return
    }
    setCopiado(true)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setCopiado(false), 1800)
  }

  return (
    <button
      type="button"
      className={`botao${copiado ? ' copiado' : ''}`}
      title="Copia a linha digitável para pagar no app do banco"
      onClick={copiar}
    >
      <Icone.copiar />
      <span className="rotulo-copiar">
        {copiado ? (
          'Copiado!'
        ) : (
          <>
            Copiar<span className="so-largo"> código</span>
          </>
        )}
      </span>
    </button>
  )
}

// "Válida até 23/10/2026 · em 5 dias", com a cor pela urgência.
export function PrazoValidade({ validade }: { validade: string }) {
  const dias = diasAte(validade)
  return (
    <>
      <span className="prazo-rotulo">Válida até</span>
      <strong>{validade}</strong>
      <span className={`dias nivel-${nivel(dias)}`}>{prazoTexto(dias)}</span>
    </>
  )
}

// Data do pagamento editável. Salva no "change" nativo (data completa escolhida); vazio volta ao valor salvo.
export function PrazoPago({
  pagoEm,
  rotulo,
  onAlterar,
}: {
  pagoEm: string
  rotulo: string
  onAlterar: (pagoEm: string) => void
}) {
  const ref = useRef<HTMLInputElement>(null)
  const aoAlterar = useRef(onAlterar)
  aoAlterar.current = onAlterar

  useEffect(() => {
    const campo = ref.current
    if (!campo) return
    campo.value = pagoEm
    const mudou = () => {
      if (campo.value) aoAlterar.current(campo.value)
      else campo.value = pagoEm
    }
    campo.addEventListener('change', mudou)
    return () => campo.removeEventListener('change', mudou)
  }, [pagoEm])

  return (
    <>
      <span className="prazo-rotulo">Pago em</span>
      <input
        ref={ref}
        type="date"
        className="data-pago"
        defaultValue={pagoEm}
        aria-label={`Data do pagamento de ${rotulo}`}
      />
    </>
  )
}
