import { useEffect, useRef, useState } from 'react'
import type { Estado } from '@/domain/tipos'
import { toast } from '@/stores/toast'
import { lerEntrada, mensagemInvalida, textoDe } from './campos'
import { type AtributosCampo, Controle, Rotulado } from './controle'
import type { CampoDef, Valor } from './entidades'

type CampoInlineProps = {
  def: CampoDef
  valor: unknown
  estado: Estado
  // Identifica o campo entre redesenhos (para devolver o foco).
  foco: string
  rotuloAcessivel?: string
  rotulado?: boolean
  // Manda o valor para a API; false se ela recusou.
  onSalvar: (valor: Valor) => Promise<boolean>
}

const SELECAO = new Set(['grupo', 'categoria', 'opcao'])

// Campo editável no lugar: texto salva ao sair do campo; seletor e caixa de marcar salvam na hora.
export function CampoInline({
  def,
  valor,
  estado,
  foco,
  rotuloAcessivel,
  rotulado,
  onSalvar,
}: CampoInlineProps) {
  const inicial = textoDe(def, valor)
  const [texto, setTexto] = useState(inicial)
  const base = useRef(inicial)

  // Valor novo vindo do servidor. O campo com o foco mantém o que já foi digitado nele (como na v1).
  useEffect(() => {
    const anterior = base.current
    base.current = inicial
    setTexto((atual) => {
      const focado =
        document.activeElement instanceof HTMLElement &&
        document.activeElement.dataset.foco === foco
      return focado && atual !== anterior ? atual : inicial
    })
  }, [inicial, foco])

  async function salvar(bruto: string) {
    const lido = lerEntrada(def, bruto)
    if (lido === undefined) {
      toast(mensagemInvalida(def))
      setTexto(base.current)
      return
    }
    const formatado = textoDe(def, lido)
    setTexto(formatado)
    if (formatado === base.current) return
    if (!(await onSalvar(lido))) setTexto(base.current)
  }

  const atributos: AtributosCampo = {
    'data-foco': foco,
    'aria-label': rotuloAcessivel,
  }
  if (def.tipo === 'booleano') {
    atributos.checked = texto !== ''
    atributos.onChange = (e) => {
      const marcado = e.target instanceof HTMLInputElement && e.target.checked
      salvar(marcado ? 'sim' : '')
    }
  } else {
    atributos.value = texto
    atributos.onChange = SELECAO.has(def.tipo)
      ? (e) => salvar(e.target.value)
      : (e) => setTexto(e.target.value)
    if (!SELECAO.has(def.tipo)) {
      atributos.onBlur = () => {
        if (texto !== base.current) salvar(texto)
      }
    }
  }

  return rotulado ? (
    <Rotulado def={def} estado={estado} atributos={atributos} />
  ) : (
    <Controle def={def} estado={estado} atributos={atributos} />
  )
}
