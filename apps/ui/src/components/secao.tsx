import type { ReactNode } from 'react'

type SecaoProps = {
  titulo: ReactNode
  descricao?: ReactNode
  total?: ReactNode
  legendaTotal?: ReactNode
  topo?: ReactNode // entre o cabeçalho e o conteúdo (avisos, barras de ação)
  children: ReactNode
}

// Bloco com título, descrição e total à direita, como "Entradas" ou "Despesas fixas".
export function Secao({
  titulo,
  descricao,
  total,
  legendaTotal,
  topo,
  children,
}: SecaoProps) {
  return (
    <section className="secao">
      <header className="secao-topo">
        <div>
          <h2>{titulo}</h2>
          {descricao ? <p>{descricao}</p> : null}
        </div>
        {total != null || legendaTotal != null ? (
          <div className="secao-total">
            {total != null ? <strong>{total}</strong> : null}
            {legendaTotal != null ? <span>{legendaTotal}</span> : null}
          </div>
        ) : null}
      </header>
      {topo}
      {children}
    </section>
  )
}
