import { zodResolver } from '@hookform/resolvers/zod'
import { useMemo } from 'react'
import { type FieldErrors, useForm } from 'react-hook-form'
import { z } from 'zod'
import { useSalvar } from '@/api/mutacoes'
import { Icone } from '@/components/icones'
import type { Estado } from '@/domain/tipos'
import { nomeMes } from '@/lib/formato'
import { toast } from '@/stores/toast'
import { lerEntrada, mensagemInvalida, textoInicial } from './campos'
import { Rotulado } from './controle'
import {
  type CampoDef,
  type Contexto,
  caminhoDe,
  camposCriar,
  type EntidadeLista,
  type Registro,
  type Valor,
} from './entidades'
import { useBackoffice } from './estado-local'

// Texto de cada campo (caixas de marcar: true/false), como o formulário guarda.
type ValoresForm = Record<string, string | boolean>

// Cada campo precisa dar para entender; o resto (obrigatórios, tamanhos) a API confere e explica.
function esquemaCriar(defs: CampoDef[]) {
  const forma: Record<
    string,
    z.ZodType<string | boolean, string | boolean>
  > = {}
  for (const def of defs) {
    forma[def.campo] =
      def.tipo === 'booleano'
        ? z.boolean()
        : z.string().refine((t) => lerEntrada(def, t) !== undefined, {
            message: mensagemInvalida(def, true),
          })
  }
  return z.object(forma)
}

function valoresIniciais(defs: CampoDef[], estado: Estado): ValoresForm {
  return Object.fromEntries(
    defs.map((def) => [
      def.campo,
      def.tipo === 'booleano' ? false : textoInicial(def, estado),
    ]),
  )
}

// Nome usado no aviso "Adicionado: …".
function nomeCriado(corpo: Record<string, Valor>) {
  for (const campo of ['nome', 'descricao'] as const) {
    const valor = corpo[campo]
    if (typeof valor === 'string' && valor) return valor
  }
  return typeof corpo.mes === 'string' ? nomeMes(corpo.mes) : 'registro'
}

// "Adicionar …": formulário gerado a partir dos campos de criação da tabela.
export function FormularioCriar({
  entidade,
  ctx,
}: {
  entidade: EntidadeLista<Registro>
  ctx: Contexto
}) {
  const salvar = useSalvar()
  const id = `bo-criar-${entidade.id}`
  const aberto = useBackoffice((s) => s.abertos.has(id))
  const definirAberto = useBackoffice((s) => s.definirAberto)

  const defs = useMemo(() => camposCriar(entidade), [entidade])
  const esquema = useMemo(() => esquemaCriar(defs), [defs])
  const iniciais = valoresIniciais(defs, ctx.estado)
  const { register, handleSubmit, reset, setFocus } = useForm<ValoresForm>({
    resolver: zodResolver(esquema),
    defaultValues: iniciais,
  })

  async function criar(valores: ValoresForm) {
    const corpo: Record<string, Valor> = {}
    for (const def of defs) {
      const bruto = valores[def.campo]
      const lido =
        typeof bruto === 'boolean' ? bruto : lerEntrada(def, bruto ?? '')
      if (lido !== undefined) corpo[def.campo] = lido
    }
    try {
      await salvar.mutateAsync({
        caminho: caminhoDe(entidade, null, ctx),
        metodo: 'POST',
        corpo,
        mensagem: `Adicionado: ${nomeCriado(corpo)}`,
      })
    } catch {
      return // a mensagem da API já apareceu
    }
    reset(iniciais)
    const primeiro = defs[0]
    if (primeiro) setFocus(primeiro.campo)
  }

  // O formulário já leva o foco ao primeiro campo com problema; o aviso diz qual é.
  function invalido(erros: FieldErrors<ValoresForm>) {
    const def = defs.find((d) => erros[d.campo])
    const mensagem = def ? erros[def.campo]?.message : undefined
    if (mensagem) toast(mensagem)
  }

  if (!entidade.criar) return null
  return (
    <details
      className="adicionar-detalhes"
      open={aberto}
      onToggle={(e) => definirAberto(id, e.currentTarget.open)}
    >
      <summary>
        <span className="marcador-mais" aria-hidden="true">
          <Icone.mais />
        </span>
        {entidade.novo}
      </summary>
      <form
        className="form-grade"
        autoComplete="off"
        onSubmit={handleSubmit(criar, invalido)}
      >
        {defs.map((def) => (
          <Rotulado
            key={def.campo}
            def={def}
            estado={ctx.estado}
            atributos={register(def.campo)}
          />
        ))}
        <div className="form-acoes">
          <button
            type="submit"
            className="botao botao-primario"
            disabled={salvar.isPending}
          >
            Adicionar
          </button>
        </div>
      </form>
    </details>
  )
}
