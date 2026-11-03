import type { ReactNode } from 'react'

export type Stat = {
  rotulo: ReactNode
  valor: ReactNode
  sub?: ReactNode
  classe?: string
}

type ResumoProps = {
  rotulo: ReactNode
  valor: ReactNode
  sub?: ReactNode
  pct?: number | null // barra de progresso (0 a 100)
  stats: Stat[]
}

// Cartão de destaque do topo das abas: um número grande, uma barra de progresso e números menores ao lado.
export function Resumo({ rotulo, valor, sub, pct, stats }: ResumoProps) {
  return (
    <section className="cartao resumo">
      <p className="rotulo">{rotulo}</p>
      <p className="valor-grande">{valor}</p>
      {sub != null ? <p className="sub">{sub}</p> : null}
      {pct != null ? (
        <div
          className="progresso"
          role="progressbar"
          aria-label="Quanto já foi pago"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={pct}
        >
          <span style={{ width: `${pct}%` }} />
        </div>
      ) : null}
      <dl className="mini-stats">
        {stats.map((s, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: a ordem dos números é fixa
          <div key={i}>
            <dt>{s.rotulo}</dt>
            <dd className={s.classe}>{s.valor}</dd>
            {s.sub != null ? <dd className="sub">{s.sub}</dd> : null}
          </div>
        ))}
      </dl>
    </section>
  )
}
