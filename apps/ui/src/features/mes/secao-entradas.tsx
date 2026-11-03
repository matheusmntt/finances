import { useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { type ChangeEvent, useEffect, useState } from 'react'
import { estadoQuery } from '@/api/estado'
import { useSalvar } from '@/api/mutacoes'
import { Avisos } from '@/components/avisos'
import { BotaoRemover } from '@/components/botao-remover'
import { Icone } from '@/components/icones'
import { Secao } from '@/components/secao'
import { type Calculo, nomeFolha } from '@/domain/calculo'
import type { Entrada, Estado, Holerite } from '@/domain/tipos'
import { abrirArquivo } from '@/lib/api'
import {
  formatarCampo,
  isoParaBr,
  lerReais,
  nomeMes,
  plural,
  reais,
} from '@/lib/formato'
import { toast } from '@/stores/toast'
import { FormularioAdicionar } from './formulario-adicionar'

function LinhaFolha({ h }: { h: Holerite }) {
  const meta = [
    h.empresa || h.razaoSocial,
    h.pagoEm ? `pago em ${isoParaBr(h.pagoEm)}` : '',
  ]
    .filter(Boolean)
    .join(' · ')
  return (
    <div className="conta conta-com-acao">
      <span className="marcador" aria-hidden="true" />
      <div className="conta-info">
        <div className="conta-nome">
          <span>Salário: {nomeFolha(h)}</span>
          <Link className="tag tag-link" to="/salario" search={{ folha: h.id }}>
            Folha de pagamento
          </Link>
        </div>
        <p className="meta">{meta}</p>
      </div>
      <div className="conta-valor">{reais(h.liquido)}</div>
      {/* Botão, e não link: o PDF vem da API, que exige o cabeçalho x-api-key. */}
      <button
        type="button"
        className="botao botao-icone"
        aria-label={`Ver PDF da ${nomeFolha(h)}`}
        title="Ver PDF da folha"
        onClick={() =>
          abrirArquivo(`/holerites/${h.id}/pdf`).catch((e: Error) =>
            toast(e.message),
          )
        }
      >
        <Icone.abrir />
      </button>
    </div>
  )
}

function SalarioPrevisto({ calculo, mes }: { calculo: Calculo; mes: string }) {
  const p = calculo.doMes(mes)
  if (!p.salarioPrevisto) return null
  const folha = calculo.salario?.folha
  const origem = folha
    ? `Líquido da ${nomeFolha(folha)}`
    : 'Valor definido no Backoffice'
  return (
    <div className="conta">
      <span className="marcador" aria-hidden="true" />
      <div className="conta-info">
        <div className="conta-nome">
          <span>Salário previsto</span>
          <Link className="tag tag-link" to="/salario">
            previsto
          </Link>
        </div>
        <p className="meta">
          {origem}. Sai quando você enviar a folha paga neste mês.
        </p>
      </div>
      <div className="conta-valor">{reais(p.salarioPrevisto)}</div>
    </div>
  )
}

// Descrição e valor de uma entrada, editáveis na própria linha. O valor muda os números da tela enquanto
// a pessoa digita (onDigitar) e é salvo quando ela sai do campo.
function LinhaEntrada({
  entrada,
  onDigitar,
}: {
  entrada: Entrada
  onDigitar: (id: number, valor: number | null) => void
}) {
  const salvar = useSalvar()
  const [descricao, setDescricao] = useState(entrada.descricao)
  const [valor, setValor] = useState(formatarCampo(entrada.valor))
  const [invalido, setInvalido] = useState(false)

  useEffect(() => setDescricao(entrada.descricao), [entrada.descricao])
  useEffect(() => setValor(formatarCampo(entrada.valor)), [entrada.valor])

  const lerValor = (texto: string) =>
    texto.trim() === '' ? 0 : lerReais(texto)

  const salvarDescricao = () => {
    const nova = descricao.trim()
    if (!nova) {
      setDescricao(entrada.descricao)
      return
    }
    setDescricao(nova)
    if (nova === entrada.descricao) return
    salvar.mutate({
      caminho: `/entradas/${entrada.id}`,
      metodo: 'PATCH',
      corpo: { descricao: nova },
      otimista: (e) => {
        const x = e.entradas.find((y) => y.id === entrada.id)
        if (x) x.descricao = nova
      },
    })
  }

  const salvarValor = () => {
    const lido = lerValor(valor)
    if (lido == null) {
      toast('Valor inválido. Use, por exemplo, 4.750,00.')
      setValor(formatarCampo(entrada.valor))
      setInvalido(false)
      onDigitar(entrada.id, null)
      return
    }
    setValor(formatarCampo(lido))
    setInvalido(false)
    if (lido === entrada.valor) {
      onDigitar(entrada.id, null)
      return
    }
    salvar.mutate({
      caminho: `/entradas/${entrada.id}`,
      metodo: 'PATCH',
      corpo: { valor: lido },
      otimista: (e) => {
        const x = e.entradas.find((y) => y.id === entrada.id)
        if (x) x.valor = lido
      },
    })
    onDigitar(entrada.id, null)
  }

  return (
    <div className="conta conta-editavel">
      <span className="marcador" aria-hidden="true" />
      <input
        className="campo"
        value={descricao}
        maxLength={120}
        aria-label="Descrição da entrada"
        onChange={(e) => setDescricao(e.target.value)}
        onBlur={salvarDescricao}
      />
      <input
        className={`campo campo-valor${invalido ? ' invalido' : ''}`}
        value={valor}
        inputMode="decimal"
        aria-label={`Valor de ${entrada.descricao}`}
        onChange={(e) => {
          setValor(e.target.value)
          const lido = lerValor(e.target.value)
          setInvalido(lido == null)
          if (lido != null) onDigitar(entrada.id, lido)
        }}
        onBlur={salvarValor}
      />
      <BotaoRemover
        rotulo={`Remover ${entrada.descricao}`}
        onClick={() =>
          salvar.mutate({
            caminho: `/entradas/${entrada.id}`,
            metodo: 'DELETE',
            mensagem: `${entrada.descricao} removida`,
            desfazer: () =>
              salvar.mutate({
                caminho: '/entradas',
                corpo: {
                  mes: entrada.mes,
                  descricao: entrada.descricao,
                  valor: entrada.valor,
                },
              }),
          })
        }
      />
    </div>
  )
}

// Envia o PDF da folha e abre o mês em que ela entrou.
function useEnviarFolha() {
  const salvar = useSalvar()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  return async (arquivo: File | undefined) => {
    if (!arquivo) return
    let id: number
    try {
      const resposta = (await salvar.mutateAsync({
        caminho: '/holerites',
        metodo: 'POST',
        corpo: arquivo,
        nomeArquivo: arquivo.name,
      })) as { id: number }
      id = resposta.id
    } catch {
      return // o erro já virou toast
    }
    // O estado já foi recarregado quando mutateAsync termina (onSettled espera o recarregamento).
    const nova = queryClient
      .getQueryData(estadoQuery.queryKey)
      ?.holerites.find((h) => h.id === id)
    if (!nova) return
    toast(`${nomeFolha(nova)}: ${reais(nova.liquido)} em ${nomeMes(nova.mes)}`)
    navigate({ to: '/mes', search: { mes: nova.mes }, replace: true })
    window.scrollTo({ top: 0 })
  }
}

export function SecaoEntradas({
  estado,
  calculo,
  mes,
  onDigitar,
}: {
  estado: Estado
  calculo: Calculo
  mes: string
  onDigitar: (id: number, valor: number | null) => void
}) {
  const enviarFolha = useEnviarFolha()
  const entradas = estado.entradas.filter((e) => e.mes === mes)
  const folhas = estado.holerites.filter((h) => h.mes === mes)
  const previsto = calculo.doMes(mes).salarioPrevisto > 0

  const aoEscolherArquivo = (e: ChangeEvent<HTMLInputElement>) => {
    const arquivo = e.target.files?.[0]
    e.target.value = '' // permite enviar o mesmo arquivo de novo
    enviarFolha(arquivo)
  }

  return (
    <Secao
      titulo="Entradas"
      descricao="O salário CLT vem da folha de pagamento: envie o PDF e o líquido entra no mês em que foi pago. Notas PJ e outros recebimentos você lança aqui."
      total={
        <span id="mes-entradas-total">
          {reais(calculo.doMes(mes).entradas)}
        </span>
      }
      legendaTotal={plural(
        entradas.length + folhas.length + (previsto ? 1 : 0),
        'entrada',
        'entradas',
      )}
      topo={
        folhas.length && entradas.length ? (
          <Avisos
            avisos={[
              {
                tipo: 'info',
                conteudo: `O salário de ${nomeMes(mes)} vem da folha de pagamento. Se uma das outras entradas for esse mesmo salário, remova-a para não contar duas vezes.`,
              },
            ]}
          />
        ) : null
      }
    >
      <div className="cartao contas">
        {folhas.map((h) => (
          <LinhaFolha key={h.id} h={h} />
        ))}
        <SalarioPrevisto calculo={calculo} mes={mes} />
        {entradas.map((e) => (
          <LinhaEntrada key={e.id} entrada={e} onDigitar={onDigitar} />
        ))}
        {entradas.length || folhas.length || previsto ? null : (
          <p className="vazio-linha">Nenhuma entrada lançada.</p>
        )}
        <FormularioAdicionar
          tipo="entrada"
          mes={mes}
          placeholder="Nova entrada (ex.: Nota PJ)"
        />
        <label className="linha-enviar">
          <span className="marcador-mais" aria-hidden="true">
            <Icone.enviar />
          </span>
          Enviar folha de pagamento (PDF)
          <input
            type="file"
            accept="application/pdf,.pdf"
            className="sr-only"
            onChange={aoEscolherArquivo}
          />
        </label>
      </div>
    </Secao>
  )
}
