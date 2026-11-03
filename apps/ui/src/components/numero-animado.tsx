import { animate, useReducedMotion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { reais } from '@/lib/formato'

type NumeroAnimadoProps = {
  valor: number
  formatar?: (valor: number) => string
  className?: string
}

// Número que corre até o valor novo quando muda (saldo, total do mês). Na primeira vez aparece direto.
// Ao mudar, pisca de leve (classe "mudou") para chamar o olho sem distrair.
export function NumeroAnimado({
  valor,
  formatar = reais,
  className,
}: NumeroAnimadoProps) {
  const [mostrado, setMostrado] = useState(valor)
  const [mudou, setMudou] = useState(false)
  const anterior = useRef(valor)
  const reduzido = useReducedMotion()

  useEffect(() => {
    const de = anterior.current
    anterior.current = valor
    if (de === valor) return
    if (reduzido) {
      setMostrado(valor)
      return
    }
    setMudou(true)
    const controle = animate(de, valor, {
      duration: 0.45,
      ease: [0.2, 0, 0, 1],
      onUpdate: (v) => setMostrado(Math.round(v)),
    })
    const timer = setTimeout(() => setMudou(false), 600)
    return () => {
      controle.stop()
      clearTimeout(timer)
    }
  }, [valor, reduzido])

  return (
    <span
      className={`numero${mudou ? ' mudou' : ''}${className ? ` ${className}` : ''}`}
    >
      {formatar(mostrado)}
    </span>
  )
}
