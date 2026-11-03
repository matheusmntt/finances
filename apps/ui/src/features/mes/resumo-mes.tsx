import { Link } from '@tanstack/react-router'
import type { Aviso } from '@/components/avisos'
import { Resumo } from '@/components/resumo'
import type { Calculo } from '@/domain/calculo'
import type { Estado } from '@/domain/tipos'
import { mesAtual, nomeMes, plural, reais } from '@/lib/formato'
import { soma } from './comum'

const emprestimosDoMes = (estado: Estado, mes: string) =>
  soma(estado.emprestimos.filter((e) => e.mes === mes).map((e) => e.valor))

type Props = { estado: Estado; calculo: Calculo; mes: string }

// Cartão do topo: quanto falta pagar no mês (ou, nos meses pagos por eles, quanto a Greici e o André pagaram).
export function ResumoMes({ estado, calculo, mes }: Props) {
  const p = calculo.doMes(mes)
  const nome = nomeMes(mes)
  const emprestimos = emprestimosDoMes(estado, mes)

  if (p.qtd === 0 && (p.pagoPorCredores || emprestimos)) {
    return (
      <Resumo
        rotulo={`Pago pela Greici e pelo André em ${nome}`}
        valor={reais(p.pagoPorCredores + emprestimos)}
        sub={
          <>
            Esse valor entrou na dívida com eles. Veja como devolver na aba{' '}
            <Link to="/divida">Greici e André</Link>.
          </>
        }
        pct={null}
        stats={[
          { rotulo: 'Contas atrasadas', valor: reais(p.pagoPorCredores) },
          { rotulo: 'Outras despesas', valor: reais(emprestimos) },
          { rotulo: 'Suas entradas', valor: reais(p.entradas) },
        ]}
      />
    )
  }

  const falta = p.totalDespesas - p.valorPago
  return (
    <Resumo
      rotulo={
        mes === mesAtual() ? 'Falta pagar este mês' : `Falta pagar em ${nome}`
      }
      valor={reais(falta)}
      sub={
        p.qtd && p.qtd === p.qtdPagas
          ? `Todas as ${p.qtd} contas pagas`
          : `${p.qtdPagas} de ${plural(p.qtd, 'conta paga', 'contas pagas')}`
      }
      pct={
        p.totalDespesas ? Math.round((p.valorPago / p.totalDespesas) * 100) : 0
      }
      stats={[
        { rotulo: 'Entradas', valor: reais(p.entradas) },
        { rotulo: 'Despesas', valor: reais(p.totalDespesas) },
        {
          rotulo: 'Saldo do mês',
          valor: reais(p.saldo),
          classe: p.saldo < 0 ? 'negativo' : '',
        },
        {
          rotulo: 'Saldo acumulado',
          valor: reais(p.acumulado),
          classe: p.acumulado < 0 ? 'negativo' : '',
        },
      ]}
    />
  )
}

export function avisosMes({ estado, calculo, mes }: Props): Aviso[] {
  const p = calculo.doMes(mes)
  const nome = nomeMes(mes)
  const avisos: Aviso[] = []
  if (p.qtd === 0) return avisos

  if (p.entradas === 0) {
    avisos.push({
      tipo: 'alerta',
      conteudo: (
        <>
          <strong>Nenhuma entrada lançada neste mês.</strong> Envie a folha de
          pagamento e adicione as notas PJ na seção Entradas.
        </>
      ),
    })
  } else if (p.saldo < 0) {
    avisos.push({
      tipo: p.acumulado < 0 ? 'perigo' : 'alerta',
      conteudo: (
        <>
          <strong>
            As despesas de {nome} passam as entradas em {reais(-p.saldo)}.
          </strong>{' '}
          {p.acumulado >= 0
            ? `A sobra dos meses anteriores cobre a diferença: o saldo acumulado fica em ${reais(p.acumulado)}.`
            : `Nem a sobra dos meses anteriores cobre: o saldo acumulado fica em ${reais(p.acumulado)}.`}
        </>
      ),
    })
  } else if (p.saldo < p.entradas * 0.05) {
    avisos.push({
      tipo: 'info',
      conteudo: (
        <>
          <strong>Mês apertado:</strong> depois de pagar tudo, sobram só{' '}
          {reais(p.saldo)}. Qualquer gasto fora do plano deixa o mês no
          vermelho.
        </>
      ),
    })
  }

  const abertas = p.qtd - p.qtdPagas
  if (mes < mesAtual() && abertas > 0) {
    avisos.push({
      tipo: 'alerta',
      conteudo: `Este mês já passou e ${abertas === 1 ? '1 conta ainda não foi marcada como paga' : `${abertas} contas ainda não foram marcadas como pagas`}.`,
    })
  }

  const deles = p.pagoPorCredores + emprestimosDoMes(estado, mes)
  if (deles) {
    avisos.push({
      tipo: 'info',
      conteudo: (
        <>
          Neste mês a Greici e o André pagaram {reais(deles)} por você. Esse
          valor está na aba <Link to="/divida">Greici e André</Link>.
        </>
      ),
    })
  }
  return avisos
}
