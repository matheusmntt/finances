// Cards do topo: livre das dívidas, sobra depois disso, guardado no fim do plano, patrimônio e salário.
import { Link } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { nomeFolha } from '@/domain/calculo'
import { type LinhaProjecao, nomeCenario, type Resumo } from '@/domain/projecao'
import { mesCurto, nomeMes, reais, reaisInteiros } from '@/lib/formato'
import type { Projecao } from './contexto'
import { daquiA } from './textos'

type Stat = {
  rotulo: ReactNode
  valor: ReactNode
  sub: ReactNode
  plano?: ReactNode
  extras?: ReactNode[]
  classe?: string
}

function CartaoStat({ rotulo, valor, sub, plano, extras = [], classe }: Stat) {
  const notas = [...extras, ...(plano != null ? [<>No plano: {plano}</>] : [])]
  return (
    <div className="cartao stat">
      <p className="stat-rotulo">{rotulo}</p>
      <p className={`stat-valor${classe ? ` ${classe}` : ''}`}>{valor}</p>
      <p className="sub">{sub}</p>
      {notas.map((nota, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: a ordem das notas é fixa
        <p key={i} className="sub stat-plano">
          {nota}
        </p>
      ))}
    </div>
  )
}

function textoLivre(linhas: LinhaProjecao[], r: Resumo, mesAtual: string) {
  if (r.livre === 0) return { valor: 'Já está livre', sub: 'nada a devolver' }
  if (r.livre === -1)
    return {
      valor: 'Não zera',
      sub: `faltam ${reais(r.fim.faltaDevolver)} em ${mesCurto(r.fim.mes)}`,
    }
  const mes = (linhas[r.livre] as LinhaProjecao).mes
  return {
    valor: nomeMes(mes),
    sub: [daquiA(mesAtual, mes), `hoje faltam ${reais(r.hoje.faltaDevolver)}`]
      .filter(Boolean)
      .join(' · '),
  }
}

function textoSobra(linhas: LinhaProjecao[], r: Resumo) {
  if (!r.sobras.length)
    return { valor: '—', sub: 'as parcelas vão até o fim do plano' }
  const min = Math.min(...r.sobras)
  const max = Math.max(...r.sobras)
  return {
    valor:
      min === max
        ? reaisInteiros(min)
        : `${reaisInteiros(min)} a ${reaisInteiros(max).replace(/^R\$\s*/, '')}`,
    sub: `a partir de ${nomeMes((linhas[r.iFim + 1] as LinhaProjecao).mes)}`,
  }
}

export function Cartoes({ p }: { p: Projecao }) {
  const { estado, calculo, mesAtual, linhas, r, base, rb, simulando } = p
  const livre = textoLivre(linhas, r, mesAtual)
  const sobra = textoSobra(linhas, r)
  const salario = calculo.salario
  const rendimentoLiquido = r.fim.rendimento - r.fim.ir
  const stats: Stat[] = [
    {
      rotulo: 'Livre das dívidas',
      ...livre,
      plano: simulando ? textoLivre(base, rb, mesAtual).valor : null,
    },
    {
      rotulo: 'Sobra por mês depois disso',
      ...sobra,
      plano: simulando ? textoSobra(base, rb).valor : null,
    },
    {
      rotulo: `Guardado no CDB em ${mesCurto(r.fim.mes)}`,
      valor: reais(r.fim.guardado),
      sub: estado.config.cdbInicio
        ? `${reais(rendimentoLiquido)} de rendimento do CDB, já sem ${reais(r.fim.ir)} de IR`
        : 'sem rendimento',
      extras: [
        `Na conta, sem render: ${reais(r.fim.acumulado)}`,
        ...(r.cenario.disponivel
          ? [
              `${nomeCenario(estado.config.poupancaPercentual)}: ${reais(r.fim.investidoCenario)} no CDB + ${reais(r.fim.contaCenario)} na conta`,
            ]
          : []),
      ],
      plano: simulando ? reais(rb.fim.guardado) : null,
    },
    {
      rotulo: 'Patrimônio hoje',
      valor: reais(r.hoje.patrimonio),
      classe: r.hoje.patrimonio < 0 ? 'negativo' : '',
      sub: 'o que está guardado menos o que falta devolver',
    },
    {
      rotulo: 'Salário previsto',
      valor: salario ? reais(salario.valor) : '—',
      classe: salario ? '' : 'negativo',
      sub: salario ? (
        salario.folha ? (
          <>
            por mês, o líquido da{' '}
            <Link to="/salario">{nomeFolha(salario.folha)}</Link>
          </>
        ) : (
          'por mês, definido no Backoffice'
        )
      ) : (
        <>
          envie uma folha na aba <Link to="/salario">Salário</Link>
        </>
      ),
    },
  ]
  return (
    <div className="kpis">
      {stats.map((s, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: a ordem dos cards é fixa
        <CartaoStat key={i} {...s} />
      ))}
    </div>
  )
}
