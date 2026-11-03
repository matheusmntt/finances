import {
  type Announcements,
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  type Modifier,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { type ReactNode, useState } from 'react'
import { Icone } from './icones'

type Como = 'ul' | 'ol' | 'tbody' | 'div'
const ITEM: Record<Como, 'li' | 'tr' | 'div'> = {
  ul: 'li',
  ol: 'li',
  tbody: 'tr',
  div: 'div',
}

type Contexto = {
  alca: ReactNode // botão de arrastar (também funciona pelo teclado: espaço, setas, espaço)
  arrastando: boolean
}

type ListaOrdenavelProps<T> = {
  itens: T[]
  chave: (item: T) => string
  nome: (item: T) => string // para o leitor de tela ("Netflix movida para a posição 3")
  onReordenar: (itens: T[]) => void
  children: (item: T, contexto: Contexto) => ReactNode
  como?: Como
  className?: string
  itemClassName?: string
}

// Só na vertical: a lista não sai do lugar para os lados.
const vertical: Modifier = ({ transform }) => ({ ...transform, x: 0 })

// Lista que se reordena arrastando a alça (mouse, toque ou teclado). Ao soltar, chama onReordenar com a
// nova ordem; quem chama salva (otimista) e o item já fica no lugar novo.
export function ListaOrdenavel<T>({
  itens,
  chave,
  nome,
  onReordenar,
  children,
  como = 'ul',
  className,
  itemClassName,
}: ListaOrdenavelProps<T>) {
  const sensores = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )
  const ids = itens.map(chave)
  const nomeDe = (id: string | number) => {
    const item = itens.find((x) => chave(x) === String(id))
    return item ? nome(item) : 'Item'
  }
  const posicao = (id: string | number) => ids.indexOf(String(id)) + 1

  const anuncios: Announcements = {
    onDragStart: ({ active }) =>
      `${nomeDe(active.id)} pego, na posição ${posicao(active.id)} de ${ids.length}. Use as setas para mover e espaço para soltar.`,
    onDragOver: ({ active, over }) =>
      over ? `${nomeDe(active.id)} sobre a posição ${posicao(over.id)}.` : '',
    onDragEnd: ({ active, over }) =>
      over
        ? `${nomeDe(active.id)} solto na posição ${posicao(over.id)}.`
        : `${nomeDe(active.id)} solto.`,
    onDragCancel: ({ active }) =>
      `Movimento cancelado. ${nomeDe(active.id)} voltou ao lugar.`,
  }

  const aoSoltar = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return
    const de = ids.indexOf(String(active.id))
    const para = ids.indexOf(String(over.id))
    onReordenar(arrayMove(itens, de, para))
  }

  const Lista = como
  return (
    <DndContext
      sensors={sensores}
      collisionDetection={closestCenter}
      modifiers={[vertical]}
      onDragEnd={aoSoltar}
      accessibility={{
        announcements: anuncios,
        screenReaderInstructions: {
          draggable:
            'Para reordenar, aperte espaço, mova com as setas e aperte espaço de novo para soltar. Esc cancela.',
        },
      }}
    >
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <Lista className={className}>
          {itens.map((item) => (
            <ItemOrdenavel
              key={chave(item)}
              id={chave(item)}
              nome={nome(item)}
              elemento={ITEM[como]}
              className={itemClassName}
            >
              {(contexto) => children(item, contexto)}
            </ItemOrdenavel>
          ))}
        </Lista>
      </SortableContext>
    </DndContext>
  )
}

function ItemOrdenavel({
  id,
  nome,
  elemento: Elemento,
  className,
  children,
}: {
  id: string
  nome: string
  elemento: 'li' | 'tr' | 'div'
  className?: string
  children: (contexto: Contexto) => ReactNode
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id })
  const [soltou, setSoltou] = useState(false)

  const alca = (
    <button
      type="button"
      ref={setActivatorNodeRef}
      className="alca"
      aria-label={`Arrastar ${nome} para reordenar`}
      title="Arraste para reordenar"
      {...attributes}
      {...listeners}
      onPointerUp={() => setSoltou(true)}
    >
      <Icone.alca />
    </button>
  )

  return (
    <Elemento
      ref={setNodeRef}
      className={`ordenavel${isDragging ? ' arrastando' : ''}${soltou && !isDragging ? ' soltou' : ''}${className ? ` ${className}` : ''}`}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      onAnimationEnd={() => setSoltou(false)}
    >
      {children({ alca, arrastando: isDragging })}
    </Elemento>
  )
}
