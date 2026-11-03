import { BotaoRemover } from '@/components/botao-remover'
import { Icone } from '@/components/icones'
import { Secao } from '@/components/secao'
import { plural, reais, semAcento } from '@/lib/formato'
import { CampoInline } from './campo-inline'
import { textoBusca } from './campos'
import {
  type CampoRegistro,
  type Contexto,
  type EntidadeLista,
  podeRemover,
  type Registro,
  type Valor,
  valorDe,
} from './entidades'
import { useBackoffice } from './estado-local'
import { FormularioCriar } from './formulario-criar'

// O que a lista faz com os registros (definido na página).
export type Acoes = {
  salvarCampo: (
    chave: string,
    def: CampoRegistro<Registro>,
    valor: Valor,
  ) => Promise<boolean>
  remover: (registro: Registro) => void
  abrirMeses: (despesaId: number) => void
  escolherDespesa: (despesaId: number) => void
}

type ListaProps = {
  entidade: EntidadeLista<Registro>
  ctx: Contexto
  busca: string
  acoes: Acoes
}

function corresponde(
  e: EntidadeLista<Registro>,
  x: Registro,
  ctx: Contexto,
  busca: string,
) {
  if (!busca) return true
  const alvo = semAcento(
    [
      e.nome(x),
      e.colunaChave?.texto(x),
      e.resumo?.(x, ctx),
      ...e.campos.map((c) => textoBusca(c, valorDe(c, x), ctx.estado)),
    ]
      .filter(Boolean)
      .join(' '),
  )
  return semAcento(busca)
    .split(/\s+/)
    .filter(Boolean)
    .every((termo) => alvo.includes(termo))
}

const mensagemVazia = (busca: string) =>
  busca ? 'Nada encontrado para esse filtro.' : 'Nenhum registro.'

// Uma tabela qualquer: cabeçalho com total e contagem, e a tabela ou as fichas.
export function ListaEntidade({ entidade: e, ctx, busca, acoes }: ListaProps) {
  if (e.id === 'valores' && !ctx.despesa) {
    return (
      <Secao titulo={e.titulo} descricao={e.descricao}>
        <div className="cartao vazio">Nenhuma despesa cadastrada.</div>
      </Secao>
    )
  }

  const todos = e.registros(ctx)
  const lista = todos.filter((x) => corresponde(e, x, ctx, busca))
  const contagem =
    lista.length === todos.length
      ? plural(todos.length, 'registro', 'registros')
      : `${lista.length} de ${plural(todos.length, 'registro', 'registros')}`
  const campoValor = e.campos.find(
    (c) => c.campo === 'valor' && c.tipo === 'centavos',
  )
  const total = campoValor
    ? reais(
        lista.reduce((s, x) => {
          const v = valorDe(campoValor, x)
          return s + (typeof v === 'number' ? v : 0)
        }, 0),
      )
    : undefined

  return (
    <Secao
      titulo={e.titulo}
      descricao={e.descricao}
      total={total}
      legendaTotal={contagem}
      topo={
        e.id === 'valores' ? (
          <SeletorDespesa ctx={ctx} onEscolher={acoes.escolherDespesa} />
        ) : null
      }
    >
      {e.layout === 'fichas' ? (
        <Fichas
          entidade={e}
          ctx={ctx}
          lista={lista}
          busca={busca}
          acoes={acoes}
        />
      ) : (
        <Tabela
          entidade={e}
          ctx={ctx}
          lista={lista}
          busca={busca}
          acoes={acoes}
        />
      )}
    </Secao>
  )
}

type ConteudoProps = ListaProps & { lista: Registro[] }

function Tabela({ entidade: e, ctx, lista, busca, acoes }: ConteudoProps) {
  const colunas = (e.colunaChave ? 1 : 0) + e.campos.length + 1
  return (
    <div className="cartao">
      <div className="tabela-wrap">
        <table className="tabela tabela-bo">
          <thead>
            <tr>
              {e.colunaChave ? (
                <th scope="col">{e.colunaChave.rotulo}</th>
              ) : null}
              {e.campos.map((c) => (
                <th
                  key={c.campo}
                  scope="col"
                  className={c.tipo === 'centavos' ? 'num' : undefined}
                >
                  {c.rotulo}
                </th>
              ))}
              <th scope="col">
                <span className="sr-only">Ações</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {lista.length ? (
              lista.map((x) => {
                const chave = String(e.chave(x))
                const nome = e.nome(x)
                return (
                  <tr key={chave}>
                    {e.colunaChave ? (
                      <th scope="row">{e.colunaChave.texto(x)}</th>
                    ) : null}
                    {e.campos.map((c) => (
                      <td
                        key={c.campo}
                        className={`bo-${c.tipo}${c.largo ? ' bo-largo' : ''}`}
                      >
                        <CampoInline
                          def={c}
                          valor={valorDe(c, x)}
                          estado={ctx.estado}
                          foco={`bo-${e.id}-${chave}-${c.campo}`}
                          rotuloAcessivel={`${c.rotulo}: ${nome}`}
                          onSalvar={(valor) =>
                            acoes.salvarCampo(chave, c, valor)
                          }
                        />
                      </td>
                    ))}
                    <td className="bo-acoes">
                      {e.meses ? (
                        <button
                          type="button"
                          className="botao"
                          title="Ver e editar o valor de cada mês"
                          onClick={() => acoes.abrirMeses(Number(e.chave(x)))}
                        >
                          Meses
                        </button>
                      ) : null}
                      {podeRemover(e, x, ctx) ? (
                        <BotaoRemover
                          rotulo={`Remover ${nome}`}
                          onClick={() => acoes.remover(x)}
                        />
                      ) : null}
                    </td>
                  </tr>
                )
              })
            ) : (
              <tr>
                <td colSpan={colunas} className="vazio-celula">
                  {mensagemVazia(busca)}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <FormularioCriar entidade={e} ctx={ctx} />
    </div>
  )
}

function Fichas({ entidade: e, ctx, lista, busca, acoes }: ConteudoProps) {
  return (
    <>
      <div className="bo-fichas">
        {lista.length ? (
          lista.map((x) => (
            <Ficha
              key={String(e.chave(x))}
              entidade={e}
              ctx={ctx}
              registro={x}
              acoes={acoes}
            />
          ))
        ) : (
          <div className="cartao vazio">{mensagemVazia(busca)}</div>
        )}
      </div>
      {e.criar ? (
        <div className="cartao">
          <FormularioCriar entidade={e} ctx={ctx} />
        </div>
      ) : null}
    </>
  )
}

function Ficha({
  entidade: e,
  ctx,
  registro: x,
  acoes,
}: {
  entidade: EntidadeLista<Registro>
  ctx: Contexto
  registro: Registro
  acoes: Acoes
}) {
  const chave = String(e.chave(x))
  const id = `bo-${e.id}-${chave}`
  const aberto = useBackoffice((s) => s.abertos.has(id))
  const definirAberto = useBackoffice((s) => s.definirAberto)
  const nome = e.nome(x)

  return (
    <details
      className="cartao bo-ficha"
      open={aberto}
      onToggle={(ev) => definirAberto(id, ev.currentTarget.open)}
    >
      <summary>
        <span className="bo-ficha-info">
          <strong>{nome}</strong>
          {e.pago?.(x) ? <span className="tag tag-pago">Pago</span> : null}
          <span className="sub">{e.resumo?.(x, ctx) ?? ''}</span>
        </span>
        <span className="bo-ficha-valor">{reais(e.valor?.(x))}</span>
        <Icone.seta />
      </summary>
      <div className="form-grade bo-grade">
        {e.campos.map((c) => (
          <CampoInline
            key={c.campo}
            def={c}
            valor={valorDe(c, x)}
            estado={ctx.estado}
            foco={`${id}-${c.campo}`}
            rotulado
            onSalvar={(valor) => acoes.salvarCampo(chave, c, valor)}
          />
        ))}
      </div>
      {podeRemover(e, x, ctx) ? (
        <div className="bo-ficha-acoes">
          <button
            type="button"
            className="botao botao-fantasma"
            onClick={() => acoes.remover(x)}
          >
            <Icone.remover />
            Remover
          </button>
        </div>
      ) : null}
    </details>
  )
}

// Despesa aberta em "Valores por mês", agrupada como na aba Mês.
function SeletorDespesa({
  ctx,
  onEscolher,
}: {
  ctx: Contexto
  onEscolher: (despesaId: number) => void
}) {
  const { estado, despesa } = ctx
  return (
    <label className="campo-rotulo bo-despesa">
      Despesa
      <select
        className="campo"
        id="bo-despesa"
        value={despesa?.id ?? ''}
        onChange={(ev) => onEscolher(Number(ev.target.value))}
      >
        {estado.grupos.map((g) => {
          const itens = estado.despesas.filter((x) => x.grupoId === g.id)
          if (!itens.length) return null
          return (
            <optgroup key={g.id} label={g.nome}>
              {itens.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.nome}
                </option>
              ))}
            </optgroup>
          )
        })}
      </select>
    </label>
  )
}
