// Ícones de traço (16×16), os mesmos da v1. Herdam a cor do texto.
import type { ReactNode } from 'react'

const Svg = ({ children }: { children: ReactNode }) => (
  <svg viewBox="0 0 16 16" aria-hidden="true">
    {children}
  </svg>
)

export const Icone = {
  abrir: () => (
    <Svg>
      <path d="M9 3h4v4m0-4L7.5 8.5M12 9.5V13H3V4h3.5" />
    </Svg>
  ),
  enviar: () => (
    <Svg>
      <path d="M8 11V3m0 0L5 6m3-3 3 3M3 12.5h10" />
    </Svg>
  ),
  baixar: () => (
    <Svg>
      <path d="M8 2v8m0 0L5 7m3 3 3-3M3 12.5h10" />
    </Svg>
  ),
  copiar: () => (
    <Svg>
      <rect x="5.5" y="5.5" width="8" height="8" rx="1.5" />
      <path d="M10.5 3.5v-.5A1.5 1.5 0 0 0 9 1.5H4A1.5 1.5 0 0 0 2.5 3v5A1.5 1.5 0 0 0 4 9.5h.5" />
    </Svg>
  ),
  seta: () => (
    <Svg>
      <path d="m4 6 4 4 4-4" />
    </Svg>
  ),
  anterior: () => (
    <Svg>
      <path d="m10 4-4 4 4 4" />
    </Svg>
  ),
  proximo: () => (
    <Svg>
      <path d="m6 4 4 4-4 4" />
    </Svg>
  ),
  alerta: () => (
    <Svg>
      <path d="M8 2.5 14 13H2L8 2.5Z" />
      <path d="M8 6.5v3M8 11.3v.2" />
    </Svg>
  ),
  info: () => (
    <Svg>
      <circle cx="8" cy="8" r="6" />
      <path d="M8 7.5v3.5M8 5.2v.2" />
    </Svg>
  ),
  remover: () => (
    <Svg>
      <path d="m4.5 4.5 7 7m0-7-7 7" />
    </Svg>
  ),
  mais: () => (
    <Svg>
      <path d="M8 3.5v9M3.5 8h9" />
    </Svg>
  ),
  editar: () => (
    <Svg>
      <path d="M10.5 3 13 5.5 6 12.5H3.5V10L10.5 3Z" />
    </Svg>
  ),
  busca: () => (
    <Svg>
      <circle cx="7" cy="7" r="4.5" />
      <path d="m10.5 10.5 3 3" />
    </Svg>
  ),
  sol: () => (
    <Svg>
      <circle cx="8" cy="8" r="3" />
      <path d="M8 1.5V3m0 10v1.5M1.5 8H3m10 0h1.5M3.4 3.4l1.06 1.06m7.08 7.08 1.06 1.06M3.4 12.6l1.06-1.06m7.08-7.08 1.06-1.06" />
    </Svg>
  ),
  lua: () => (
    <Svg>
      <path d="M13.5 9.6A5.6 5.6 0 0 1 6.4 2.5a5.6 5.6 0 1 0 7.1 7.1Z" />
    </Svg>
  ),
  ok: () => (
    <Svg>
      <path d="m3.5 8.5 3 3 6-7" />
    </Svg>
  ),
  fechar: () => (
    <Svg>
      <path d="m4 4 8 8m0-8-8 8" />
    </Svg>
  ),
  alca: () => (
    <Svg>
      <circle cx="6" cy="4" r=".9" fill="currentColor" stroke="none" />
      <circle cx="10" cy="4" r=".9" fill="currentColor" stroke="none" />
      <circle cx="6" cy="8" r=".9" fill="currentColor" stroke="none" />
      <circle cx="10" cy="8" r=".9" fill="currentColor" stroke="none" />
      <circle cx="6" cy="12" r=".9" fill="currentColor" stroke="none" />
      <circle cx="10" cy="12" r=".9" fill="currentColor" stroke="none" />
    </Svg>
  ),
  arquivo: () => (
    <Svg>
      <path d="M9 1.5H4.5A1.5 1.5 0 0 0 3 3v10a1.5 1.5 0 0 0 1.5 1.5h7A1.5 1.5 0 0 0 13 13V5.5m-4-4 4 4m-4-4v4h4" />
    </Svg>
  ),
  // Gira enquanto uma ação está em andamento (a animação vem do CSS: .girando).
  carregando: () => (
    <svg viewBox="0 0 16 16" aria-hidden="true" className="girando">
      <circle cx="8" cy="8" r="5.5" opacity=".25" />
      <path d="M13.5 8A5.5 5.5 0 0 0 8 2.5" />
    </svg>
  ),
}
