import { type ComponentProps, useEffect, useState } from 'react'
import { formatarCampo, lerReais } from '@/lib/formato'
import { toastErro } from '@/stores/toast'

type CampoReaisProps = Omit<ComponentProps<'input'>, 'value' | 'onChange'> & {
  valor: number | null
  // Chamado quando a pessoa sai do campo com um valor válido e diferente do atual. Vazio vira `vazio`.
  onSalvar: (centavos: number | null) => void
  vazio?: number | null
  onDigitar?: (centavos: number | null) => void
}

// Campo de valor em reais que salva ao sair dele ("1.500,00", "1500" ou "1500.50").
export function CampoReais({
  valor,
  onSalvar,
  vazio = null,
  onDigitar,
  className,
  onBlur,
  ...props
}: CampoReaisProps) {
  const [texto, setTexto] = useState(formatarCampo(valor))
  const [invalido, setInvalido] = useState(false)
  // Acabou de salvar: um anel verde curto confirma sem toast.
  const [salvo, setSalvo] = useState(0)
  useEffect(() => {
    if (!salvo) return
    const timer = setTimeout(() => setSalvo(0), 900)
    return () => clearTimeout(timer)
  }, [salvo])

  useEffect(() => setTexto(formatarCampo(valor)), [valor])

  return (
    <input
      {...props}
      className={`campo campo-valor${invalido ? ' invalido' : ''}${className ? ` ${className}` : ''}`}
      inputMode="decimal"
      data-salvo={salvo || undefined}
      value={texto}
      onChange={(e) => {
        setTexto(e.target.value)
        const lido =
          e.target.value.trim() === '' ? vazio : lerReais(e.target.value)
        setInvalido(e.target.value.trim() !== '' && lido == null)
        if (onDigitar && (lido != null || e.target.value.trim() === ''))
          onDigitar(lido)
      }}
      onBlur={(e) => {
        onBlur?.(e)
        const lido = texto.trim() === '' ? vazio : lerReais(texto)
        if (texto.trim() !== '' && lido == null) {
          toastErro('Valor inválido. Use, por exemplo, 1.500,00.')
          setTexto(formatarCampo(valor))
          setInvalido(false)
          return
        }
        setInvalido(false)
        setTexto(formatarCampo(lido))
        if (lido !== valor) {
          onSalvar(lido)
          setSalvo(Date.now())
        }
      }}
    />
  )
}
