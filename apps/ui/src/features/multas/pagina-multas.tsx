// Aba "Multas": boletos do Detran, CRLV e pátio, pagos pela Greici e pelo André.
import { Link } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { useDados } from '@/api/estado'
import { useSalvar } from '@/api/mutacoes'
import { Icone } from '@/components/icones'
import type { CustoCarro, Estado, Multa } from '@/domain/tipos'
import {
  dataBr,
  diasAte,
  isoHoje,
  plural,
  reais,
  semAcento,
} from '@/lib/formato'
import { useTitulo } from '@/lib/titulo'
import { type FiltroMultas, usePreferencias } from '@/stores/preferencias'
import { CartaoCusto } from './cartao-custo'
import { CartaoMulta } from './cartao-multa'
import {
  descricaoMulta,
  nivel,
  prazoTexto,
  rolarAte,
  tipoMulta,
} from './utilidades'

// Seções pela situação de hoje: guia ainda válida, guia que passou da validade (precisa de outra) e paga.
const SECOES = [
  {
    id: 'validas',
    titulo: 'Guias válidas',
    nota: 'Dá para pagar com o código até a validade. As com desconto valem 20% a menos; as com juros já são de multas vencidas.',
    inclui: (b: Multa) => !b.pagoEm && diasAte(b.validade) >= 0,
  },
  {
    id: 'expiradas',
    titulo: 'Guias com a validade vencida',
    nota: 'Esse código não serve mais: emita uma guia nova no site do Detran (ou da PRF). O valor pode mudar, com juros.',
    inclui: (b: Multa) => !b.pagoEm && diasAte(b.validade) < 0,
  },
  {
    id: 'pagas',
    titulo: 'Pagas',
    nota: 'Pagas pela Greici e pelo André; entram na dívida com eles.',
    inclui: (b: Multa) => Boolean(b.pagoEm),
  },
]

const FILTROS: { id: FiltroMultas; rotulo: string }[] = [
  { id: 'pendentes', rotulo: 'A pagar' },
  { id: 'pagos', rotulo: 'Pagos' },
  { id: 'todos', rotulo: 'Todos' },
]

// Todos os termos da busca precisam aparecer em algum dos textos (sem acento, sem maiúsculas).
function corresponde(busca: string, textos: (string | null | undefined)[]) {
  if (!busca) return true
  const alvo = semAcento(textos.filter(Boolean).join(' '))
  return semAcento(busca)
    .split(/\s+/)
    .filter(Boolean)
    .every((termo) => alvo.includes(termo))
}

function passaFiltro(filtro: FiltroMultas, pago: boolean) {
  if (filtro === 'pendentes' && pago) return false
  if (filtro === 'pagos' && !pago) return false
  return true
}

function ordenar(a: Multa, b: Multa) {
  return (
    dataBr(a.validade).getTime() - dataBr(b.validade).getTime() ||
    dataBr(b.dataInfracao).getTime() - dataBr(a.dataInfracao).getTime() ||
    a.serie.localeCompare(b.serie)
  )
}

function mensagemVazia(filtro: FiltroMultas, busca: string) {
  if (busca) return 'Nada encontrado para essa busca.'
  if (filtro === 'pagos') return 'Nada marcado como pago ainda.'
  if (filtro === 'pendentes') return 'Tudo pago. Nada em aberto no carro.'
  return 'Nenhuma multa.'
}

export function PaginaMultas() {
  useTitulo('Multas')
  const dados = useDados()
  const salvar = useSalvar()
  const { filtroMultas: filtro, definirFiltroMultas } = usePreferencias()
  const [texto, setTexto] = useState('')
  const [abertos, setAbertos] = useState<Set<string>>(new Set())
  // Multa para rolar até depois de limpar o filtro e a busca (ir para a multa de origem).
  const [irParaDepois, setIrParaDepois] = useState<string | null>(null)
  const busca = texto.trim()

  useEffect(() => {
    if (irParaDepois == null) return
    const alvo = document.getElementById(`b-${irParaDepois}`)
    setIrParaDepois(null)
    if (alvo) rolarAte(alvo)
  }, [irParaDepois])

  if (!dados) return null
  const { estado, calculo } = dados

  function marcarMulta(
    serie: string,
    pagoEm: string | null,
    anterior: string | null,
  ) {
    salvar.mutate({
      caminho: `/multas/${serie}/pago`,
      metodo: 'PUT',
      corpo: { pagoEm },
      mensagem:
        pagoEm && !anterior
          ? `${serie} paga pela Greici e pelo André`
          : !pagoEm
            ? `${serie} voltou para “a pagar”`
            : undefined,
      desfazer:
        pagoEm === anterior
          ? undefined
          : () => marcarMulta(serie, anterior || null, pagoEm),
      otimista: (e) => {
        const m = e.multas.find((x) => x.serie === serie)
        if (m) m.pagoEm = pagoEm
      },
    })
  }

  function marcarCusto(
    custo: CustoCarro,
    pagoEm: string | null,
    anterior: string | null,
  ) {
    salvar.mutate({
      caminho: `/custos-carro/${custo.id}/pago`,
      metodo: 'PUT',
      corpo: { pagoEm },
      mensagem:
        pagoEm && !anterior
          ? `${custo.descricao} pago pela Greici e pelo André`
          : !pagoEm
            ? `${custo.descricao} voltou para “a pagar”`
            : undefined,
      desfazer:
        pagoEm === anterior
          ? undefined
          : () => marcarCusto(custo, anterior || null, pagoEm),
      otimista: (e) => {
        const c = e.custosCarro.find((x) => x.id === custo.id)
        if (c) c.pagoEm = pagoEm
      },
    })
  }

  function alternar(serie: string) {
    setAbertos((atual) => {
      const novo = new Set(atual)
      if (novo.has(serie)) novo.delete(serie)
      else novo.add(serie)
      return novo
    })
  }

  // Rola até a multa; se ela estiver escondida pelo filtro ou pela busca, mostra todas antes.
  function irPara(serie: string) {
    const alvo = document.getElementById(`b-${serie}`)
    if (alvo) {
      rolarAte(alvo)
      return
    }
    definirFiltroMultas('todos')
    setTexto('')
    setIrParaDepois(serie)
  }

  const multaVisivel = (b: Multa) =>
    passaFiltro(filtro, Boolean(b.pagoEm)) &&
    corresponde(busca, [
      b.serie,
      b.descricao,
      descricaoMulta(estado, b),
      tipoMulta(estado, b),
      b.local,
      b.municipio,
      b.autuador,
      b.origem,
      b.guia,
      b.dataInfracao,
    ])
  const custos = estado.custosCarro.filter(
    (c) =>
      passaFiltro(filtro, Boolean(c.pagoEm)) &&
      corresponde(busca, [c.descricao, c.detalhe, 'carro']),
  )
  const secoes = SECOES.map((secao) => ({
    ...secao,
    itens: estado.multas
      .filter((b) => secao.inclui(b) && multaVisivel(b))
      .sort(ordenar),
  })).filter((secao) => secao.itens.length)

  const c = calculo.carro
  const contagens: Record<FiltroMultas, number> = {
    pendentes: c.qtdTotal - c.qtdPagos,
    pagos: c.qtdPagos,
    todos: c.qtdTotal,
  }

  return (
    <section className="view" aria-label="Multas e despesas do carro">
      <div className="painel">
        <ResumoCarro estado={estado} carro={c} />
        <Vencimentos estado={estado} />
      </div>

      <div className="aviso-cartao aviso-info" role="note">
        <Icone.info />
        <div>
          Multas, CRLV e pátio são pagos pela Greici e pelo André. Ao marcar um
          item como pago, o valor entra na sua dívida com eles, na aba{' '}
          <Link to="/divida">Greici e André</Link>.
        </div>
      </div>

      <div className="ferramentas">
        {/* biome-ignore lint/a11y/useSemanticElements: mesma marcação da v1; o CSS do .segmentado não espera um fieldset */}
        <div className="segmentado" role="group" aria-label="Filtrar">
          {FILTROS.map((f) => (
            <button
              key={f.id}
              type="button"
              aria-pressed={filtro === f.id}
              onClick={() => definirFiltroMultas(f.id)}
            >
              {f.rotulo} <span className="contagem">{contagens[f.id]}</span>
            </button>
          ))}
        </div>
        <label className="busca">
          <Icone.busca />
          <span className="sr-only">Buscar</span>
          <input
            type="search"
            placeholder="Buscar série, infração, local…"
            autoComplete="off"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
          />
        </label>
      </div>

      <div>
        {custos.length ? (
          <section className="secao" aria-labelledby="t-custos-carro">
            <header className="secao-topo">
              <div>
                <h2 id="t-custos-carro">Outras despesas do carro</h2>
                <p>
                  Necessárias para regularizar e retirar o carro. Também pagas
                  pela Greici e pelo André.
                </p>
              </div>
              <div className="secao-total">
                <strong>
                  {reais(custos.reduce((t, x) => t + x.valor, 0))}
                </strong>
                <span>{plural(custos.length, 'despesa', 'despesas')}</span>
              </div>
            </header>
            <div className="boletos">
              {custos.map((custo) => (
                <CartaoCusto
                  key={custo.id}
                  custo={custo}
                  onPagar={(pago) =>
                    marcarCusto(
                      custo,
                      pago ? custo.pagoEm || isoHoje() : null,
                      custo.pagoEm,
                    )
                  }
                  onAlterarData={(pagoEm) =>
                    salvar.mutate({
                      caminho: `/custos-carro/${custo.id}/pago`,
                      metodo: 'PUT',
                      corpo: { pagoEm },
                    })
                  }
                />
              ))}
            </div>
          </section>
        ) : null}

        {secoes.map((secao) => (
          <section
            key={secao.id}
            className="secao"
            aria-labelledby={`t-${secao.id}`}
          >
            <header className="secao-topo">
              <div>
                <h2 id={`t-${secao.id}`}>{secao.titulo}</h2>
                <p>{secao.nota}</p>
              </div>
              <div className="secao-total">
                <strong>
                  {reais(secao.itens.reduce((t, b) => t + b.valor, 0))}
                </strong>
                <span>{plural(secao.itens.length, 'guia', 'guias')}</span>
              </div>
            </header>
            <div className="boletos">
              {secao.itens.map((b) => (
                <CartaoMulta
                  key={b.serie}
                  multa={b}
                  estado={estado}
                  aberto={abertos.has(b.serie)}
                  onAlternar={() => alternar(b.serie)}
                  onPagar={(pago) =>
                    marcarMulta(
                      b.serie,
                      pago ? b.pagoEm || isoHoje() : null,
                      b.pagoEm,
                    )
                  }
                  onAlterarData={(pagoEm) =>
                    salvar.mutate({
                      caminho: `/multas/${b.serie}/pago`,
                      metodo: 'PUT',
                      corpo: { pagoEm },
                    })
                  }
                  onIrPara={irPara}
                />
              ))}
            </div>
          </section>
        ))}

        {!custos.length && !secoes.length ? (
          <div className="cartao vazio">{mensagemVazia(filtro, busca)}</div>
        ) : null}
      </div>
    </section>
  )
}

type Carro = {
  total: number
  pago: number
  emAberto: number
  qtdTotal: number
  qtdPagos: number
}

function ResumoCarro({ estado, carro: c }: { estado: Estado; carro: Carro }) {
  const multasAbertas = estado.multas.filter((m) => !m.pagoEm).length
  const custosAbertos = estado.custosCarro.filter((x) => !x.pagoEm).length
  const pct = c.total ? Math.round((c.pago / c.total) * 100) : 0

  return (
    <section className="cartao resumo" aria-label="Resumo do carro">
      <p className="rotulo">
        Carro em aberto{' '}
        <span className="rotulo-extra">
          {estado.config.placa ? `Placa ${estado.config.placa}` : ''}
        </span>
      </p>
      <p className="valor-grande">{reais(c.emAberto)}</p>
      <p className="sub">
        {c.emAberto === 0
          ? 'Tudo pago'
          : `${plural(multasAbertas, 'multa', 'multas')} e ${plural(custosAbertos, 'outra despesa', 'outras despesas')} em aberto`}
      </p>
      <div
        className="progresso"
        role="progressbar"
        aria-label="Quanto já foi pago"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
      >
        <span style={{ width: `${pct}%` }} />
      </div>
      <dl className="mini-stats">
        <div>
          <dt>Pago pela Greici e André</dt>
          <dd>{reais(c.pago)}</dd>
          <dd className="sub">
            {c.qtdPagos} de {plural(c.qtdTotal, 'item', 'itens')}
          </dd>
        </div>
        <div>
          <dt>Total do carro</dt>
          <dd>{reais(c.total)}</dd>
          <dd className="sub">
            {plural(estado.multas.length, 'multa', 'multas')} +{' '}
            {plural(estado.custosCarro.length, 'despesa', 'despesas')}
          </dd>
        </div>
        <div>
          <dt>Progresso</dt>
          <dd>{pct}%</dd>
          <dd className="sub">do valor total</dd>
        </div>
      </dl>
    </section>
  )
}

// Guias em aberto agrupadas pela data de validade, da mais próxima para a mais distante.
function Vencimentos({ estado }: { estado: Estado }) {
  const grupos = new Map<
    string,
    { validade: string; valor: number; series: string[] }
  >()
  const abertos = [
    ...estado.multas.map((b) => ({
      validade: b.validade as string | null,
      valor: b.valor,
      nome: b.serie,
      pagoEm: b.pagoEm,
    })),
    ...estado.custosCarro.map((x) => ({
      validade: x.validade,
      valor: x.valor,
      nome: x.descricao,
      pagoEm: x.pagoEm,
    })),
  ]
  for (const x of abertos) {
    if (!x.validade || x.pagoEm) continue
    const grupo = grupos.get(x.validade) ?? {
      validade: x.validade,
      valor: 0,
      series: [],
    }
    grupo.valor += x.valor
    grupo.series.push(x.nome)
    grupos.set(x.validade, grupo)
  }
  const lista = [...grupos.values()].sort(
    (a, b) => dataBr(a.validade).getTime() - dataBr(b.validade).getTime(),
  )

  return (
    <section className="cartao vencimentos" aria-labelledby="t-vencimentos">
      <h2 className="rotulo" id="t-vencimentos">
        Validade das guias em aberto
      </h2>
      <ol className="lista-vencimentos">
        {lista.length ? (
          lista.map((g) => {
            const dias = diasAte(g.validade)
            const quem =
              g.series.length === 1
                ? g.series[0]
                : plural(g.series.length, 'guia', 'guias')
            return (
              <li key={g.validade} className={`venc nivel-${nivel(dias)}`}>
                <div className="venc-data">
                  <strong>{g.validade}</strong>
                  <span>{prazoTexto(dias)}</span>
                </div>
                <div className="venc-info">
                  <strong>{reais(g.valor)}</strong>
                  <span>{quem}</span>
                </div>
              </li>
            )
          })
        ) : (
          <li className="venc-vazio">Nenhuma guia em aberto.</li>
        )}
      </ol>
      <p className="nota">
        Depois da validade é preciso emitir uma nova guia no site do Detran.
      </p>
    </section>
  )
}
