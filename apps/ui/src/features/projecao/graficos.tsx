// Gráficos "Guardado e dívida" e "Sobra de cada mês", com a porcentagem do cenário.
import { useSalvar } from '@/api/mutacoes'
import { Grafico } from '@/components/grafico'
import { type LinhaProjecao, nomeCenario } from '@/domain/projecao'
import { mesCurto, reais } from '@/lib/formato'
import { usePreferencias, type VisaoProjecao } from '@/stores/preferencias'
import { CampoInteiro } from './campo-inteiro'
import type { Projecao } from './contexto'

const VISOES: { id: VisaoProjecao; texto: string }[] = [
  { id: '12-meses', texto: 'Próximos 12 meses' },
  { id: 'tudo', texto: 'Até o fim do plano' },
]

export function Graficos({ p }: { p: Projecao }) {
  const { linhas, r } = p
  const salvar = useSalvar()
  const preferida = usePreferencias((s) => s.visaoProjecao)
  const definirVisao = usePreferencias((s) => s.definirVisaoProjecao)
  const visao: VisaoProjecao = preferida === 'tudo' ? 'tudo' : '12-meses'
  const pct = p.estado.config.poupancaPercentual
  const cenarioNome = nomeCenario(pct)
  const { cenario } = r

  const de = visao === '12-meses' ? r.iHoje : r.iPrimeiro
  const ate = visao === '12-meses' ? Math.min(r.ultimo, r.iHoje + 11) : r.ultimo
  const trecho = linhas.slice(de, ate + 1)
  const meses = trecho.map((l) => l.mes)
  const iHoje = r.iHoje - de
  // Sai da linha do guardado no CDB no mês em que a dívida zera.
  const noCenario = (valor: (l: LinhaProjecao) => number) =>
    trecho.map((l, k) =>
      cenario.disponivel && de + k >= r.livre ? valor(l) : null,
    )
  const marcos = [{ i: iHoje, texto: 'Hoje' }]
  if (r.livre > 0 && r.livre !== r.iHoje)
    marcos.push({ i: r.livre - de, texto: 'Livre das dívidas' })

  const valores =
    cenario.bruto != null
      ? ` (${reais(cenario.bruto)}), ou seja, ${reais(cenario.aporte)} por mês,`
      : ''
  const aviso =
    cenario.bruto == null
      ? ' Envie uma folha de pagamento para ver essa linha.'
      : r.livre < 0
        ? ' A dívida não zera até o fim do plano, então essa linha não se separa do guardado no CDB.'
        : ''

  return (
    <section className="cartao grafico-cartao">
      <div className="grafico-topo">
        <div>
          <h2>Guardado e dívida</h2>
          <p className="sub">
            {meses.length
              ? `${mesCurto(meses[0] as string)} a ${mesCurto(meses[meses.length - 1] as string)}`
              : ''}
          </p>
        </div>
        {/* biome-ignore lint/a11y/useSemanticElements: grupo de botões, como na v1 (fieldset muda o visual) */}
        <div
          className="segmentado"
          role="group"
          aria-label="Período do gráfico"
        >
          {VISOES.map((v) => (
            <button
              key={v.id}
              type="button"
              aria-pressed={visao === v.id}
              onClick={() => definirVisao(v.id)}
            >
              {v.texto}
            </button>
          ))}
        </div>
      </div>
      <ul className="legenda">
        <li>
          <span className="chave-linha serie-1" />
          Guardado no CDB
        </li>
        <li>
          <span className="chave-linha serie-3" />
          Na conta corrente, sem render
        </li>
        <li>
          <span className="chave-linha serie-2" />
          Falta devolver
        </li>
        <li>
          <span className="chave-linha serie-4" />
          {cenarioNome} no CDB depois da dívida
        </li>
        <li>
          <span className="chave-linha chave-prevista" />
          Tracejado: previsão
        </li>
      </ul>
      {/* biome-ignore lint/a11y/noLabelWithoutControl: o CampoInteiro é um <input> */}
      <label className="sub cenario-ajuste">
        <span className="chave-linha serie-4" />
        <span>
          Cenário: depois que a dívida zera, investir{' '}
          <CampoInteiro
            valor={pct}
            min={1}
            max={100}
            erro="Use uma porcentagem inteira de 1 a 100."
            aria-label="Porcentagem do salário bruto investida por mês depois da dívida"
            onSalvar={(poupancaPercentual) =>
              salvar.mutate({
                caminho: '/backoffice/config',
                metodo: 'PUT',
                corpo: { poupancaPercentual },
              })
            }
          />{' '}
          % do salário bruto{valores} no CDB e deixar o resto da sobra na conta,
          sem render. A linha mostra só a parte investida.{aviso}
        </span>
      </label>
      <Grafico
        meses={meses}
        iHoje={iHoje}
        marcos={marcos}
        rotulo="Gráfico do guardado no CDB, do guardado na conta sem render, do que falta devolver e do cenário, mês a mês"
        series={[
          {
            nome: 'Guardado no CDB',
            classe: 'serie-1',
            valores: trecho.map((l) => l.guardado),
          },
          {
            nome: 'Na conta, sem render',
            classe: 'serie-3',
            valores: trecho.map((l) => l.acumulado),
          },
          {
            nome: 'Falta devolver',
            classe: 'serie-2',
            valores: trecho.map((l) => l.faltaDevolver),
          },
          {
            nome: `${cenarioNome} no CDB`,
            classe: 'serie-4',
            valores: noCenario((l) => l.investidoCenario),
          },
          // Só no tooltip: o que o cenário deixa na conta.
          {
            nome: 'Cenário: resto na conta',
            tipo: 'info',
            valores: noCenario((l) => l.contaCenario),
          },
        ]}
      />
      <div className="grafico-topo grafico-topo-secundario">
        <div>
          <h3>Sobra de cada mês</h3>
          <p className="sub">
            Entradas menos despesas. Barras mais claras são previsão; vermelhas,
            meses no vermelho.
          </p>
        </div>
      </div>
      <Grafico
        meses={meses}
        iHoje={iHoje}
        marcos={[{ i: iHoje, texto: 'Hoje' }]}
        altura={190}
        rotulo="Gráfico da sobra de cada mês"
        series={[
          {
            nome: 'Sobra do mês',
            classe: 'serie-1',
            tipo: 'barras',
            valores: trecho.map((l) => l.saldo),
          },
        ]}
      />
    </section>
  )
}
