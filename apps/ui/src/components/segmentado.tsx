import { motion } from 'motion/react'
import { type ReactNode, useId } from 'react'
import { mola } from '@/lib/movimento'

type Opcao<T extends string> = { valor: T; rotulo: ReactNode }

type SegmentadoProps<T extends string> = {
  opcoes: Opcao<T>[]
  valor: T
  onChange: (valor: T) => void
  rotulo: string // aria-label do grupo
}

// Botões lado a lado em que um está escolhido (filtro das multas, período do gráfico). A pílula de fundo
// desliza até a opção escolhida.
export function Segmentado<T extends string>({
  opcoes,
  valor,
  onChange,
  rotulo,
}: SegmentadoProps<T>) {
  const grupo = useId()
  return (
    <fieldset className="segmentado">
      <legend className="sr-only">{rotulo}</legend>
      {opcoes.map((o) => (
        <button
          key={o.valor}
          type="button"
          aria-pressed={o.valor === valor}
          onClick={() => onChange(o.valor)}
        >
          {o.valor === valor ? (
            <motion.span
              layoutId={`pilula-${grupo}`}
              className="segmentado-pilula"
              transition={mola}
            />
          ) : null}
          <span className="segmentado-texto">{o.rotulo}</span>
        </button>
      ))}
    </fieldset>
  )
}
