// "Como esta página funciona": o que cada número significa, com os valores do plano (sem a simulação).
import type { ReactNode } from 'react'
import { Secao } from '@/components/secao'
import { nomeFolha } from '@/domain/calculo'
import { nomeCenario } from '@/domain/projecao'
import { nomeMes, plural, reais } from '@/lib/formato'
import type { Projecao } from './contexto'
import { percentual } from './textos'

export function Explicacao({ p }: { p: Projecao }) {
  const { estado, calculo, mesAtual, rb } = p
  const config = estado.config
  const salario = calculo.salario
  const origemSalario = !salario
    ? 'nenhum por enquanto: envie uma folha na aba Salário ou defina o valor no Backoffice'
    : salario.folha
      ? `${reais(salario.valor)} por mês, o líquido da ${nomeFolha(salario.folha)} (a última de mês cheio)`
      : `${reais(salario.valor)} por mês, valor definido no Backoffice`
  const cdb = config.cdbInicio
    ? `Antes de ${nomeMes(config.cdbInicio)} o dinheiro fica parado; a partir desse mês, vai para um CDB que rende ${percentual(config.cdbTaxaMensal || 0)} ao mês.`
    : 'Nenhum CDB está configurado, então o dinheiro guardado não rende.'

  const blocos: [ReactNode, ReactNode][] = [
    [
      'Realizado e previsto',
      `Até ${nomeMes(mesAtual)} os números vêm do que foi lançado no app. Daqui para a frente são previsão, feita com o plano de hoje. Nos gráficos, a previsão aparece tracejada (linhas) ou mais clara (barras).`,
    ],
    [
      'Entradas',
      `O salário CLT é o líquido da folha de pagamento, no mês em que foi pago. Nos meses sem folha, de agora em diante, entra o salário previsto: ${origemSalario}. Notas PJ, 13º, férias e outras rendas só contam quando são lançados na aba Mês.`,
    ],
    [
      'Despesas',
      'Contas fixas, parcelas, devoluções para a Greici e o André e extras de cada mês, como estão nas abas Mês e Greici e André. O que eles pagaram por você não é despesa sua: entra na dívida.',
    ],
    [
      'Sobra do mês',
      <>
        <strong>Sobra = entradas − despesas.</strong> Quando é negativa, o mês
        fecha no vermelho e o dinheiro sai do que está guardado.
      </>,
    ],
    [
      'Guardado: na conta e no CDB',
      <>
        <strong>Na conta corrente</strong> é a soma das sobras de todos os
        meses, sem render nada. <strong>No CDB</strong> é o mesmo dinheiro
        aplicado: {cdb} Cada mês aplicado rende separado e paga Imposto de Renda
        pelo tempo em que ficou aplicado: 22,5% até 6 meses, 20% até 12, 17,5%
        até 24 e 15% depois. O valor mostrado é o que você teria se resgatasse
        tudo naquele mês, já sem o IR. Num mês no vermelho, o dinheiro sai das
        aplicações mais antigas.
      </>,
    ],
    [
      'Falta devolver',
      `O total que a Greici e o André pagam por você (${reais(calculo.divida.previsto)}: contas de agosto, outras despesas, cartão e o carro, inclusive o que ainda falta pagar dele) menos as parcelas de devolução. Nos meses que já passaram, só contam as parcelas marcadas como pagas; nos próximos, as do plano, supondo que serão pagas em dia.`,
    ],
    [
      'Patrimônio e “Livre das dívidas”',
      <>
        <strong>Patrimônio = guardado no CDB − falta devolver:</strong> o que é
        seu de verdade. Fica negativo enquanto a dívida for maior que o
        guardado. “Livre das dívidas” é o mês em que o que falta devolver chega
        a zero.
      </>,
    ],
    [
      'Sobra por mês depois disso',
      'A sobra dos meses depois que acabam as parcelas e a dívida, quando quase toda a renda fica livre.',
    ],
    [
      `Cenário: ${nomeCenario(config.poupancaPercentual).toLowerCase()}`,
      rb.cenario.bruto == null
        ? 'Depois que a dívida zera, investe só uma porcentagem do salário bruto e deixa o resto na conta. Precisa de uma folha de pagamento para saber o bruto.'
        : `A linha azul supõe que você investe toda a sobra. Nesta, até a dívida zerar tudo é igual; depois, todo mês você investe no CDB ${rb.cenario.pct}% do salário bruto (${reais(rb.cenario.bruto)}, da última folha mensal): ${reais(rb.cenario.aporte)}, ou só a sobra se ela for menor. O resto da sobra fica na conta, sem render; num mês no vermelho, sai primeiro da conta. A linha mostra só a parte investida; o tooltip e o card do guardado mostram também o que ficou na conta. A porcentagem fica no próprio gráfico.`,
    ],
    [
      'Metas',
      `A reserva de emergência é ${plural(config.reservaMeses, 'mês', 'meses')} de despesas depois das parcelas (${reais(rb.custoMensal)} por mês, a média). Investindo toda a sobra, ela é formada pelo patrimônio; no cenário, só pelo que está investido no CDB, já que o que fica na conta é dinheiro livre. As outras metas contam todo o dinheiro do cenário (investido mais conta). A data de cada meta é o primeiro mês em que o valor é alcançado; a barra mostra quanto o patrimônio de hoje já cobre.`,
    ],
    [
      'Simulador',
      'Muda só o que a página mostra, por cima do plano: renda a mais ou a menos a partir do mês escolhido, gasto extra (negativo é economia), um valor a mais por mês na devolução até a dívida zerar e outra taxa para o CDB. Nada é salvo; os cards mostram também o número do plano para comparar.',
    ],
    [
      'Pontos de atenção',
      'No vermelho: a sobra do mês é negativa. Apertado: sobram menos de 5% das entradas. Também avisa folha de pagamento não enviada, devolução atrasada e quando não há salário previsto.',
    ],
    [
      'O que a previsão não considera',
      'Inflação, reajustes de salário e de contas, 13º, férias e gastos que ainda não foram lançados. A taxa do CDB é a mesma em todos os meses e o IR é uma estimativa. Os números mudam sempre que um lançamento muda.',
    ],
  ]

  return (
    <Secao
      titulo="Como esta página funciona"
      descricao="O que cada número significa e como ele é calculado."
    >
      <div className="cartao explicacao">
        {blocos.map(([titulo, texto], i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: a lista de blocos é fixa
          <div key={i} className="explicacao-item">
            <h3>{titulo}</h3>
            <p>{texto}</p>
          </div>
        ))}
      </div>
    </Secao>
  )
}
