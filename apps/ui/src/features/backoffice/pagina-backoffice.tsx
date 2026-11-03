// Aba "Backoffice": edição direta de todos os dados, inclusive os que as outras abas não editam.
import { useNavigate } from '@tanstack/react-router'
import { type FocusEvent, useLayoutEffect, useRef } from 'react'
import { useDados } from '@/api/estado'
import { type Pedido, useSalvar } from '@/api/mutacoes'
import { Avisos } from '@/components/avisos'
import { Icone } from '@/components/icones'
import { useTitulo } from '@/lib/titulo'
import { Route } from '@/routes/_app/backoffice'
import { Configuracoes } from './configuracoes'
import {
  type Contexto,
  caminhoDe,
  ENTIDADES,
  entidadePorId,
  type Registro,
} from './entidades'
import { useBackoffice } from './estado-local'
import { type Acoes, ListaEntidade } from './lista'

// Se uma linha muda de lugar ao redesenhar (a ordem mudou), o navegador tira o foco do campo
// que estava sendo editado: devolve o foco a ele, como a v1 fazia ao redesenhar.
function usePreservarFoco(versao: unknown) {
  const raiz = useRef<HTMLDivElement>(null)
  const foco = useRef<string | null>(null)

  useLayoutEffect(() => {
    if (versao === undefined || !foco.current) return
    if (document.activeElement !== document.body) return
    raiz.current
      ?.querySelector<HTMLElement>(`[data-foco="${CSS.escape(foco.current)}"]`)
      ?.focus()
  }, [versao])

  return {
    ref: raiz,
    onFocus: (ev: FocusEvent<HTMLDivElement>) => {
      foco.current = ev.target.dataset.foco ?? null
    },
    // Saída de verdade (o campo continua na página): esquece o campo.
    onBlur: (ev: FocusEvent<HTMLDivElement>) => {
      if (ev.target.isConnected) foco.current = null
    },
  }
}

export function PaginaBackoffice() {
  useTitulo('Backoffice')
  const dados = useDados()
  const search = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })
  const salvar = useSalvar()
  const busca = useBackoffice((s) => s.busca)
  const definirBusca = useBackoffice((s) => s.definirBusca)
  const conteudo = usePreservarFoco(dados?.estado)

  if (!dados) return null
  const { estado } = dados
  const entidade = entidadePorId(search.tabela)
  const despesa =
    estado.despesas.find((x) => x.id === search.despesa) ?? estado.despesas[0]
  const ctx: Contexto = { estado, despesa }
  const textoBusca = busca.entidade === entidade.id ? busca.texto : ''

  // Troca de tabela (o filtro fica para trás) e volta ao topo.
  function irPara(tabela: string, despesaId?: number) {
    if (tabela !== entidade.id) definirBusca(tabela, '')
    navigate({
      search: (atual) => ({
        ...atual,
        tabela,
        despesa: despesaId ?? atual.despesa,
      }),
      replace: true,
    })
    window.scrollTo({ top: 0 })
  }

  // true se a API aceitou; se recusou, a mensagem dela já apareceu.
  async function enviar(pedido: Pedido) {
    try {
      await salvar.mutateAsync(pedido)
      return true
    } catch {
      return false
    }
  }

  const acoes: Acoes = {
    salvarCampo: (chave, def, valor) =>
      enviar({
        caminho: caminhoDe(entidade, chave, ctx),
        metodo: 'PATCH',
        corpo: { [def.campo]: valor },
      }),
    remover: (registro: Registro) => {
      if (entidade.layout === 'config') return
      const nome = entidade.nome(registro)
      const pergunta = entidade.confirmar
        ? entidade.confirmar(registro)
        : `Remover “${nome}”?`
      if (!window.confirm(pergunta)) return
      salvar.mutate({
        caminho: caminhoDe(entidade, String(entidade.chave(registro)), ctx),
        metodo: 'DELETE',
        mensagem: `Removido: ${nome}`,
      })
    },
    abrirMeses: (despesaId) => irPara('valores', despesaId),
    escolherDespesa: (despesaId) =>
      navigate({
        search: (atual) => ({ ...atual, despesa: despesaId }),
        replace: true,
      }),
  }

  return (
    <section aria-label="Backoffice: edição de todos os dados">
      <Avisos
        avisos={[
          {
            tipo: 'alerta',
            conteudo: (
              <>
                <strong>Edição direta do banco.</strong> Cada campo é salvo
                quando você sai dele, sem como desfazer. Antes de mudanças
                grandes, use “Baixar backup”.
              </>
            ),
          },
        ]}
      />
      <div className="ferramentas">
        <label className="bo-seletor">
          <span className="sr-only">Tabela</span>
          <select
            id="bo-entidade"
            className="seletor-mes"
            value={entidade.id}
            onChange={(ev) => irPara(ev.target.value)}
          >
            {ENTIDADES.map((e) => (
              <option key={e.id} value={e.id}>
                {e.titulo}
              </option>
            ))}
          </select>
        </label>
        <label
          className="busca"
          id="bo-filtro"
          hidden={entidade.layout === 'config'}
        >
          <Icone.busca />
          <span className="sr-only">Filtrar</span>
          <input
            type="search"
            id="bo-busca"
            placeholder="Filtrar registros…"
            autoComplete="off"
            value={textoBusca}
            onChange={(ev) => definirBusca(entidade.id, ev.target.value)}
          />
        </label>
      </div>
      <div id="bo-conteudo" {...conteudo}>
        {entidade.layout === 'config' ? (
          <Configuracoes
            entidade={entidade}
            estado={estado}
            onSalvar={(def, valor) =>
              enviar({
                caminho: caminhoDe(entidade, null, ctx),
                metodo: 'PUT',
                corpo: { [def.campo]: valor },
              })
            }
          />
        ) : (
          <ListaEntidade
            key={entidade.id}
            entidade={entidade}
            ctx={ctx}
            busca={textoBusca.trim()}
            acoes={acoes}
          />
        )}
      </div>
    </section>
  )
}
