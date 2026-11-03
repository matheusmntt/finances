import {
  type ChangeEvent,
  type FocusEvent,
  type RefCallback,
  useId,
} from 'react'
import type { Estado } from '@/domain/tipos'
import type { CampoDef } from './entidades'

type Elemento = HTMLInputElement | HTMLSelectElement

// Atributos repassados ao <input> ou <select>: os de um campo controlado ou os de register() do formulário.
export type AtributosCampo = {
  id?: string
  name?: string
  value?: string
  checked?: boolean
  onChange?: (evento: ChangeEvent<Elemento>) => void
  onBlur?: (evento: FocusEvent<Elemento>) => void
  ref?: RefCallback<Elemento>
  'aria-label'?: string
  'data-foco'?: string
}

function Opcoes({
  lista,
  vazio,
}: {
  lista: readonly (readonly [string, string])[]
  vazio?: string | null
}) {
  return (
    <>
      {vazio == null ? null : <option value="">{vazio}</option>}
      {lista.map(([valor, rotulo]) => (
        <option key={valor} value={valor}>
          {rotulo}
        </option>
      ))}
    </>
  )
}

// O controle de cada tipo de campo, igual ao da v1.
export function Controle({
  def,
  estado,
  atributos,
}: {
  def: CampoDef
  estado: Estado
  atributos: AtributosCampo
}) {
  switch (def.tipo) {
    case 'centavos':
      return (
        <input
          className="campo campo-valor"
          inputMode="decimal"
          placeholder="0,00"
          {...atributos}
        />
      )
    case 'taxa':
      return (
        <input
          className="campo campo-valor"
          inputMode="decimal"
          {...atributos}
        />
      )
    case 'inteiro':
      return <input className="campo" type="number" step="1" {...atributos} />
    case 'mes':
      return (
        <input
          className="campo"
          type="month"
          placeholder="AAAA-MM"
          {...atributos}
        />
      )
    case 'data':
    case 'dataBr':
      return <input className="campo" type="date" {...atributos} />
    case 'hora':
      return <input className="campo" type="time" {...atributos} />
    case 'booleano':
      return <input type="checkbox" {...atributos} />
    case 'grupo':
      return (
        <select className="campo" {...atributos}>
          <Opcoes lista={estado.grupos.map((g) => [g.id, g.nome] as const)} />
        </select>
      )
    case 'categoria':
      return (
        <select className="campo" {...atributos}>
          <Opcoes
            lista={estado.categorias.map((c) => [c.id, c.nome] as const)}
            vazio={def.vazio || (def.opcional ? '—' : null)}
          />
        </select>
      )
    case 'opcao':
      return (
        <select className="campo" {...atributos}>
          <Opcoes lista={def.opcoes} />
        </select>
      )
    case 'texto':
      return <input className="campo" maxLength={def.max} {...atributos} />
  }
}

// Controle com o rótulo em volta (fichas, configurações e formulário "Adicionar").
export function Rotulado({
  def,
  estado,
  atributos,
}: {
  def: CampoDef
  estado: Estado
  atributos: AtributosCampo
}) {
  const id = useId()
  const largo = def.largo ? ' largo' : ''
  const controle = (
    <Controle def={def} estado={estado} atributos={{ ...atributos, id }} />
  )
  if (def.tipo === 'booleano') {
    return (
      <label className={`bo-check${largo}`} htmlFor={id}>
        {controle}
        <span>{def.rotulo}</span>
      </label>
    )
  }
  return (
    <label className={`campo-rotulo${largo}`} htmlFor={id}>
      {def.rotulo}
      {controle}
    </label>
  )
}
