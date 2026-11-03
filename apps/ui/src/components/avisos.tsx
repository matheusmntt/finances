import type { ReactNode } from 'react'
import { Icone } from './icones'

export type Aviso = { tipo: 'info' | 'alerta' | 'perigo'; conteudo: ReactNode }

export function Avisos({ avisos }: { avisos: Aviso[] }) {
  return (
    <>
      {avisos.map((a, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: a lista é recalculada inteira a cada render
        <div key={i} className={`aviso-cartao aviso-${a.tipo}`} role="note">
          {a.tipo === 'info' ? <Icone.info /> : <Icone.alerta />}
          <div>{a.conteudo}</div>
        </div>
      ))}
    </>
  )
}
