import { type ComponentProps, useEffect, useRef } from 'react'
import { toast } from '@/stores/toast'

type CampoInteiroProps = Omit<
  ComponentProps<'input'>,
  'value' | 'defaultValue' | 'onChange' | 'type'
> & {
  valor: number
  min: number
  max: number
  erro: string // toast quando o número está fora da faixa
  onSalvar: (valor: number) => void
}

// Campo de número inteiro que salva no "change" do navegador (ao sair do campo, Enter ou nas setinhas),
// como na v1, e não a cada tecla. Fora da faixa, avisa e volta ao valor salvo.
export function CampoInteiro({
  valor,
  min,
  max,
  erro,
  onSalvar,
  className,
  ...props
}: CampoInteiroProps) {
  const ref = useRef<HTMLInputElement>(null)
  const atual = useRef({ valor, min, max, erro, onSalvar })
  atual.current = { valor, min, max, erro, onSalvar }

  useEffect(() => {
    if (ref.current) ref.current.value = String(valor)
  }, [valor])

  useEffect(() => {
    const campo = ref.current
    if (!campo) return
    const aoMudar = () => {
      const { valor, min, max, erro, onSalvar } = atual.current
      const n = Number(campo.value)
      if (!Number.isInteger(n) || n < min || n > max) {
        toast(erro)
        campo.value = String(valor)
        return
      }
      onSalvar(n)
    }
    campo.addEventListener('change', aoMudar)
    return () => campo.removeEventListener('change', aoMudar)
  }, [])

  return (
    <input
      {...props}
      ref={ref}
      className={`campo${className ? ` ${className}` : ''}`}
      type="number"
      min={min}
      max={max}
      step={1}
      defaultValue={valor}
    />
  )
}
