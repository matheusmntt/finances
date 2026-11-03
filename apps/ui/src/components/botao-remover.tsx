import { Icone } from './icones'

// Botão "✕" discreto que aparece no fim das linhas.
export function BotaoRemover({
  rotulo,
  onClick,
}: {
  rotulo: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      className="botao botao-icone botao-fantasma"
      aria-label={rotulo}
      title={rotulo}
      onClick={onClick}
    >
      <Icone.remover />
    </button>
  )
}
