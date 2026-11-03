import { type ReactNode, useRef, useState } from 'react'
import { Icone } from './icones'

type ZonaArquivoProps = {
  onArquivo: (arquivo: File) => void
  aceitar?: string // ex.: "application/pdf"
  enviando?: boolean
  titulo: ReactNode
  descricao?: ReactNode
}

// Área para soltar um arquivo (ou clicar e escolher). Ao arrastar um arquivo por cima, a borda acende e o
// ícone sobe; enquanto envia, mostra o andamento no próprio lugar.
export function ZonaArquivo({
  onArquivo,
  aceitar,
  enviando,
  titulo,
  descricao,
}: ZonaArquivoProps) {
  const [sobre, setSobre] = useState(false)
  const profundidade = useRef(0)

  const aceita = (arquivo: File) =>
    !aceitar ||
    aceitar
      .split(',')
      .some((t) => arquivo.type === t.trim() || arquivo.name.endsWith(t.trim()))

  return (
    <label
      className="zona-arquivo"
      data-sobre={sobre || undefined}
      data-enviando={enviando || undefined}
      onDragEnter={(e) => {
        e.preventDefault()
        profundidade.current++
        setSobre(true)
      }}
      onDragOver={(e) => e.preventDefault()}
      onDragLeave={() => {
        profundidade.current--
        if (profundidade.current <= 0) setSobre(false)
      }}
      onDrop={(e) => {
        e.preventDefault()
        profundidade.current = 0
        setSobre(false)
        const arquivo = e.dataTransfer.files[0]
        if (arquivo && aceita(arquivo) && !enviando) onArquivo(arquivo)
      }}
    >
      <span className="zona-arquivo-icone">
        {enviando ? <Icone.carregando /> : <Icone.enviar />}
      </span>
      <span className="zona-arquivo-texto">
        <strong>{enviando ? 'Enviando…' : titulo}</strong>
        {descricao && !enviando ? <span>{descricao}</span> : null}
      </span>
      <input
        type="file"
        accept={aceitar}
        className="sr-only"
        disabled={enviando}
        onChange={(e) => {
          const arquivo = e.target.files?.[0]
          if (arquivo) onArquivo(arquivo)
          e.target.value = ''
        }}
      />
    </label>
  )
}
