import type { CSSProperties } from 'react'

type EsqueletoProps = {
  largura?: CSSProperties['width']
  altura?: CSSProperties['height']
  raio?: CSSProperties['borderRadius']
  className?: string
}

// Bloco cinza com brilho passando, no lugar de um conteúdo que ainda vai chegar. Mantém o tamanho final
// para a página não pular quando os dados aparecem.
export function Esqueleto({
  largura = '100%',
  altura = 14,
  raio,
  className,
}: EsqueletoProps) {
  return (
    <span
      className={`esqueleto${className ? ` ${className}` : ''}`}
      style={{ width: largura, height: altura, borderRadius: raio }}
      aria-hidden="true"
    />
  )
}

// Linhas de uma lista (contas, multas) enquanto carregam.
export function EsqueletoLinhas({ linhas = 4 }: { linhas?: number }) {
  return (
    <div className="cartao esqueleto-lista" aria-hidden="true">
      {Array.from({ length: linhas }, (_, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: linhas fixas, sem identidade
        <div className="esqueleto-linha" key={i}>
          <Esqueleto largura={22} altura={22} raio={7} />
          <div className="esqueleto-texto">
            <Esqueleto largura={`${46 + ((i * 17) % 30)}%`} />
            <Esqueleto largura="28%" altura={11} />
          </div>
          <Esqueleto largura={84} altura={16} />
        </div>
      ))}
    </div>
  )
}

// A página inteira enquanto o estado chega pela primeira vez: resumo no topo e duas seções.
export function EsqueletoPagina() {
  return (
    <div
      className="esqueleto-pagina"
      role="status"
      aria-label="Carregando seus dados"
    >
      <div className="cartao esqueleto-resumo" aria-hidden="true">
        <div className="esqueleto-texto">
          <Esqueleto largura={140} altura={12} />
          <Esqueleto largura={240} altura={38} raio={10} />
          <Esqueleto largura={120} altura={12} />
        </div>
        <div className="esqueleto-stats">
          {[0, 1, 2, 3].map((i) => (
            <div className="esqueleto-texto" key={i}>
              <Esqueleto largura={64} altura={11} />
              <Esqueleto largura={92} altura={18} />
            </div>
          ))}
        </div>
        <Esqueleto altura={8} raio={999} className="esqueleto-barra" />
      </div>
      <Esqueleto largura={160} altura={18} className="esqueleto-titulo" />
      <EsqueletoLinhas linhas={2} />
      <Esqueleto largura={200} altura={18} className="esqueleto-titulo" />
      <EsqueletoLinhas linhas={4} />
    </div>
  )
}
