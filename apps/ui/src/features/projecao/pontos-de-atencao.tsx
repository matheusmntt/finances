// Pontos de atenção: sem salário, folha não enviada, meses no vermelho ou apertados, devolução atrasada.
import { Link } from '@tanstack/react-router'
import { type Aviso, Avisos } from '@/components/avisos'
import { Secao } from '@/components/secao'
import { juntar, reais } from '@/lib/formato'
import type { Projecao } from './contexto'
import { faixas, soma } from './textos'

function pontosDeAtencao({ estado, calculo: c, mesAtual, linhas }: Projecao) {
  const pontos: Aviso[] = []
  const daquiPraFrente = linhas.filter((l) => l.futuro)

  if (!c.salario) {
    pontos.push({
      tipo: 'perigo',
      conteudo: (
        <>
          <strong>Sem salário previsto.</strong> Os meses daqui para a frente
          estão sem o salário CLT. Envie uma folha na aba{' '}
          <Link to="/salario">Salário</Link> ou defina o salário previsto no
          Backoffice.
        </>
      ),
    })
  }

  // Folhas que faltam: meses que já passaram, depois da primeira folha, sem folha mensal.
  const comFolha = new Set(
    estado.holerites.filter((h) => /mensal/i.test(h.tipo)).map((h) => h.mes),
  )
  const primeira = [...comFolha].sort()[0]
  const semFolha = primeira
    ? c.meses.filter((m) => m > primeira && m < mesAtual && !comFolha.has(m))
    : []
  if (semFolha.length) {
    pontos.push({
      tipo: 'alerta',
      conteudo: (
        <>
          <strong>
            Folha de pagamento não enviada: {juntar(faixas(c, semFolha))}.
          </strong>{' '}
          {semFolha.length === 1 ? 'Esse mês está' : 'Esses meses estão'} sem o
          salário. Envie na aba <Link to="/salario">Salário</Link>.
        </>
      ),
    })
  }

  const negativos = daquiPraFrente.filter((l) => l.saldo < 0)
  const ultimo = negativos[negativos.length - 1]
  if (ultimo) {
    pontos.push({
      tipo: ultimo.acumulado < 0 ? 'perigo' : 'alerta',
      conteudo: (
        <>
          <strong>
            {juntar(
              faixas(
                c,
                negativos.map((l) => l.mes),
              ),
            )}{' '}
            {negativos.length === 1 ? 'fecha' : 'fecham'} no vermelho
          </strong>{' '}
          ({negativos.map((l) => reais(l.saldo)).join(', ')}).{' '}
          {ultimo.guardado >= 0
            ? 'O que está guardado cobre, mas não deixa folga.'
            : 'Nem o que está guardado cobre.'}
        </>
      ),
    })
  }

  const apertados = daquiPraFrente.filter(
    (l) => l.saldo >= 0 && l.entradas && l.saldo < l.entradas * 0.05,
  )
  if (apertados.length) {
    const valores = apertados.map((l) => l.saldo)
    const min = Math.min(...valores)
    const max = Math.max(...valores)
    pontos.push({
      tipo: 'alerta',
      conteudo: (
        <>
          <strong>
            Meses apertados:{' '}
            {juntar(
              faixas(
                c,
                apertados.map((l) => l.mes),
              ),
            )}
            .
          </strong>{' '}
          Sobram{' '}
          {min === max
            ? `só ${reais(min)}`
            : `entre ${reais(min)} e ${reais(max)}`}{' '}
          por mês. Um gasto inesperado nesse período já desequilibra o plano.
        </>
      ),
    })
  }

  // Devolução atrasada: parcelas de meses que já passaram sem marcar como pagas.
  const atrasadas: { mes: string; valor: number }[] = []
  for (const x of c.divida.devolucoes) {
    for (const [mes, v] of Object.entries(x.valores)) {
      if (mes < mesAtual && !v.pagoEm) atrasadas.push({ mes, valor: v.valor })
    }
  }
  if (atrasadas.length) {
    const meses = [...new Set(atrasadas.map((a) => a.mes))].sort()
    pontos.push({
      tipo: 'alerta',
      conteudo: (
        <>
          <strong>
            {reais(soma(atrasadas.map((a) => a.valor)))} de devolução atrasada
          </strong>{' '}
          ({juntar(faixas(c, meses))}). Enquanto não for paga, a dívida não
          zera. Marque na aba <Link to="/divida">Greici e André</Link> quando
          pagar.
        </>
      ),
    })
  }

  const dv = c.divida
  if (dv.plano !== dv.previsto) {
    pontos.push({
      tipo: 'info',
      conteudo: (
        <>
          <strong>
            O plano devolve {reais(Math.abs(dv.plano - dv.previsto))}{' '}
            {dv.plano > dv.previsto ? 'a mais' : 'a menos'} do que eles pagam
          </strong>{' '}
          ({reais(dv.plano)} × {reais(dv.previsto)}). Detalhes e edição na aba{' '}
          <Link to="/divida">Greici e André</Link>.
        </>
      ),
    })
  }
  return pontos
}

export function PontosDeAtencao({ p }: { p: Projecao }) {
  const pontos = pontosDeAtencao(p)
  return (
    <Secao
      titulo="Pontos de atenção"
      descricao={
        p.simulando
          ? 'Calculados com o cenário simulado.'
          : 'Calculados com as entradas, despesas e extras de hoje.'
      }
    >
      {pontos.length ? (
        <Avisos avisos={pontos} />
      ) : (
        <p className="sub">Nada fora do normal.</p>
      )}
    </Secao>
  )
}
