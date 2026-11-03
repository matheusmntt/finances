// Aba "Salário": folhas de pagamento enviadas em PDF. O líquido de cada uma entra no mês do pagamento.
import { useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { type ChangeEvent, useEffect, useState } from 'react'
import { estadoQuery, useDados } from '@/api/estado'
import { useSalvar } from '@/api/mutacoes'
import { Icone } from '@/components/icones'
import { Resumo } from '@/components/resumo'
import { Secao } from '@/components/secao'
import { nomeFolha } from '@/domain/calculo'
import type { Holerite } from '@/domain/tipos'
import { isoParaBr, nomeMes, plural, reais } from '@/lib/formato'
import { useTitulo } from '@/lib/titulo'
import { Route } from '@/routes/_app/salario'
import { toast } from '@/stores/toast'
import { CartaoFolha } from './cartao-folha'

const ordenar = (lista: Holerite[]) =>
  [...lista].sort(
    (a, b) => b.competencia.localeCompare(a.competencia) || b.id - a.id,
  )

// Rola até o cartão e pisca o destaque.
function rolarAte(el: HTMLElement) {
  const suave = !window.matchMedia('(prefers-reduced-motion: reduce)').matches
  el.scrollIntoView({ behavior: suave ? 'smooth' : 'auto', block: 'center' })
  el.classList.remove('destaque')
  void el.offsetWidth
  el.classList.add('destaque')
}

function BotaoEnviar({ onEnviar }: { onEnviar: (arquivo: File) => void }) {
  const aoEscolher = (e: ChangeEvent<HTMLInputElement>) => {
    const arquivo = e.target.files?.[0]
    // Limpa o campo para dar para escolher o mesmo arquivo de novo.
    e.target.value = ''
    if (arquivo) onEnviar(arquivo)
  }
  return (
    <label className="botao botao-arquivo botao-primario">
      <Icone.enviar />
      Enviar folha (PDF)
      <input
        type="file"
        accept="application/pdf,.pdf"
        className="sr-only"
        onChange={aoEscolher}
      />
    </label>
  )
}

export function PaginaSalario() {
  useTitulo('Salário')
  const dados = useDados()
  const salvar = useSalvar()
  const queryClient = useQueryClient()
  const { folha } = Route.useSearch()
  const [abertos, setAbertos] = useState<Set<number>>(new Set())
  // Folha para mostrar: abre os detalhes e rola até ela depois do render.
  const [destacar, setDestacar] = useState<number | null>(null)

  const mostrar = (id: number) => {
    setAbertos((atual) => new Set(atual).add(id))
    setDestacar(id)
  }

  // ?folha=ID (vindo da aba Mês, por exemplo).
  useEffect(() => {
    if (folha == null) return
    setAbertos((atual) => new Set(atual).add(folha))
    setDestacar(folha)
  }, [folha])

  useEffect(() => {
    if (destacar == null) return
    const alvo = document.getElementById(`f-${destacar}`)
    setDestacar(null)
    if (alvo) rolarAte(alvo)
  }, [destacar])

  if (!dados) return null
  const lista = ordenar(dados.estado.holerites)

  async function enviar(arquivo: File) {
    const antes = new Set(dados?.estado.holerites.map((h) => h.id))
    try {
      // Só volta depois de recarregar o estado, então a folha nova já está no cache.
      await salvar.mutateAsync({
        caminho: '/holerites',
        metodo: 'POST',
        corpo: arquivo,
        nomeArquivo: arquivo.name,
      })
    } catch {
      return // o toast de erro já foi mostrado
    }
    const atual = queryClient.getQueryData(estadoQuery.queryKey)
    const nova = atual?.holerites.find((h) => !antes.has(h.id))
    if (!nova) return
    toast(`${nomeFolha(nova)}: ${reais(nova.liquido)} em ${nomeMes(nova.mes)}`)
    mostrar(nova.id)
  }

  function remover(h: Holerite) {
    const nome = nomeFolha(h)
    if (
      !window.confirm(
        `Remover a ${nome}? O PDF é apagado e ${reais(h.liquido)} saem das entradas de ${nomeMes(h.mes)}.`,
      )
    )
      return
    setAbertos((atual) => {
      const novo = new Set(atual)
      novo.delete(h.id)
      return novo
    })
    salvar.mutate({
      caminho: `/holerites/${h.id}`,
      metodo: 'DELETE',
      mensagem: `${nome} removida`,
    })
  }

  function alternar(id: number) {
    setAbertos((atual) => {
      const novo = new Set(atual)
      if (novo.has(id)) novo.delete(id)
      else novo.add(id)
      return novo
    })
  }

  const ultima = lista[0]
  if (!ultima)
    return (
      <section className="view" aria-label="Salário e folhas de pagamento">
        <div className="cartao vazio vazio-folhas">
          <p>Nenhuma folha de pagamento enviada ainda.</p>
          <p className="sub">
            Envie o PDF do recibo: os vencimentos, descontos e o líquido
            aparecem aqui, e o líquido entra nas entradas do mês em que foi
            pago.
          </p>
          <BotaoEnviar onEnviar={enviar} />
        </div>
      </section>
    )

  const total = lista.reduce((s, h) => s + h.liquido, 0)
  const fgts = lista.reduce((s, h) => s + h.fgts, 0)
  const pctDescontos = ultima.totalVencimentos
    ? Math.round((ultima.totalDescontos / ultima.totalVencimentos) * 100)
    : 0

  return (
    <section className="view" aria-label="Salário e folhas de pagamento">
      <div className="painel">
        <Resumo
          rotulo="Último salário líquido"
          valor={reais(ultima.liquido)}
          sub={
            <>
              {nomeFolha(ultima)}
              {ultima.pagoEm ? `, paga em ${isoParaBr(ultima.pagoEm)}` : ''}.
              Entrou em{' '}
              <Link to="/mes" search={{ mes: ultima.mes }}>
                {nomeMes(ultima.mes)}
              </Link>
              .
            </>
          }
          stats={[
            {
              rotulo: 'Salário bruto',
              valor: reais(ultima.salarioMensal),
              sub: ultima.cargo,
            },
            {
              rotulo: 'Descontos',
              valor: reais(ultima.totalDescontos),
              sub: `${pctDescontos}% dos vencimentos`,
            },
            {
              rotulo: 'FGTS depositado',
              valor: reais(fgts),
              sub: `em ${plural(lista.length, 'folha', 'folhas')}`,
            },
          ]}
        />
      </div>
      <Secao
        titulo="Folhas de pagamento"
        descricao="O líquido de cada folha entra nas entradas do mês em que foi pago. Para mudar o mês, use o Backoffice."
        total={reais(total)}
        legendaTotal={`líquido em ${plural(lista.length, 'folha', 'folhas')}`}
        topo={
          <div className="barra-plano">
            <p className="sub">
              O PDF fica guardado no app. Envie uma folha por mês, a mensal e
              também a de 13º ou férias quando tiver.
            </p>
            <div className="barra-plano-acoes">
              <BotaoEnviar onEnviar={enviar} />
            </div>
          </div>
        }
      >
        <div className="boletos">
          {lista.map((h) => (
            <CartaoFolha
              key={h.id}
              folha={h}
              aberto={abertos.has(h.id)}
              onAlternar={() => alternar(h.id)}
              onRemover={() => remover(h)}
            />
          ))}
        </div>
      </Secao>
    </section>
  )
}
