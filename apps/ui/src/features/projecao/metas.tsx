// Metas: reserva de emergência e metas próprias, cada uma investindo toda a sobra e no cenário.
import { zodResolver } from '@hookform/resolvers/zod'
import { type ReactNode, useState } from 'react'
import { type FieldErrors, useForm } from 'react-hook-form'
import { z } from 'zod'
import { useSalvar } from '@/api/mutacoes'
import { Icone } from '@/components/icones'
import { Secao } from '@/components/secao'
import { type CampoMeta, nomeCenario, quandoAtinge } from '@/domain/projecao'
import type { Meta } from '@/domain/tipos'
import { lerReais, mesCurto, plural, reais } from '@/lib/formato'
import { toast } from '@/stores/toast'
import { CampoInteiro } from './campo-inteiro'
import type { Projecao } from './contexto'
import { daquiA } from './textos'

type Cenario = {
  rotulo: string
  alvo: number
  detalhe?: string
  quando: string | null
  noPlano: string | null
}

type CartaoMetaProps = {
  p: Projecao
  nome: string
  valor: number | null // null: o alvo aparece em cada cenário
  sub: string
  cenarios: Cenario[]
  onRemover?: () => void
  extra?: ReactNode
}

function CartaoMeta({
  p,
  nome,
  valor,
  sub,
  cenarios,
  onRemover,
  extra,
}: CartaoMetaProps) {
  const { r, mesAtual } = p
  return (
    <div className="cartao meta-cartao">
      <div className="meta-topo">
        <p className="stat-rotulo">{nome}</p>
        {onRemover ? (
          <button
            type="button"
            className="botao botao-icone botao-fantasma"
            aria-label={`Remover a meta ${nome}`}
            title="Remover meta"
            onClick={onRemover}
          >
            <Icone.remover />
          </button>
        ) : null}
      </div>
      {valor != null ? <p className="stat-valor">{reais(valor)}</p> : null}
      <p className="sub">{sub}</p>
      <ul className="meta-cenarios">
        {cenarios.map(({ rotulo, alvo, detalhe, quando, noPlano }) => {
          const pct = Math.min(
            100,
            Math.round((Math.max(0, r.hoje.patrimonio) / alvo) * 100),
          )
          let status: string
          if (quando === mesAtual) status = 'Já atingida'
          else if (quando) {
            const daqui = daquiA(mesAtual, quando)
            status = `Chega em ${mesCurto(quando)}${daqui ? ` · ${daqui}` : ''}`
          } else status = `Não chega até ${mesCurto(r.fim.mes)}`
          return (
            <li key={rotulo} className="meta-cenario">
              <div className="meta-cenario-topo">
                <span>{rotulo}</span>
                {valor == null ? <strong>{reais(alvo)}</strong> : null}
              </div>
              {detalhe ? <p className="sub">{detalhe}</p> : null}
              <div
                className="progresso"
                role="progressbar"
                aria-label="Quanto do valor você já tem"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={pct}
              >
                <span style={{ width: `${pct}%` }} />
              </div>
              <p className={`meta-status${quando ? '' : ' negativo'}`}>
                {status}
              </p>
              {noPlano !== quando ? (
                <p className="sub">
                  No plano: {noPlano ? mesCurto(noPlano) : 'não chega'}
                </p>
              ) : null}
            </li>
          )
        })}
      </ul>
      {extra}
    </div>
  )
}

const esquemaMeta = z.object({
  nome: z.string().trim().min(1, 'Dê um nome para a meta.'),
  valor: z.string().refine((texto) => (lerReais(texto) ?? 0) > 0, {
    message: 'Informe o valor da meta, como 50.000,00.',
  }),
})
type NovaMeta = z.infer<typeof esquemaMeta>

function FormMeta() {
  const salvar = useSalvar()
  const [aberto, setAberto] = useState(false)
  const { register, handleSubmit, reset } = useForm<NovaMeta>({
    resolver: zodResolver(esquemaMeta),
    defaultValues: { nome: '', valor: '' },
  })

  const aoEnviar = ({ nome, valor }: NovaMeta) =>
    salvar.mutate(
      {
        caminho: '/backoffice/metas',
        metodo: 'POST',
        corpo: { nome, valor: lerReais(valor) },
        mensagem: `Meta “${nome}” adicionada`,
      },
      {
        onSuccess: () => {
          reset()
          setAberto(false)
        },
      },
    )
  // Um erro por vez, na ordem dos campos.
  const aoErrar = (erros: FieldErrors<NovaMeta>) => {
    const erro = erros.nome ?? erros.valor
    if (erro?.message) toast(erro.message)
  }

  return (
    <details
      className="cartao adicionar-detalhes meta-nova"
      open={aberto}
      onToggle={(e) => setAberto(e.currentTarget.open)}
    >
      <summary>
        <span className="marcador-mais" aria-hidden="true">
          <Icone.mais />
        </span>
        Adicionar meta
      </summary>
      <form
        className="form-grade"
        autoComplete="off"
        noValidate
        onSubmit={handleSubmit(aoEnviar, aoErrar)}
      >
        <label className="campo-rotulo largo">
          Nome
          <input
            className="campo"
            maxLength={60}
            placeholder="Ex.: Entrada do apartamento"
            {...register('nome')}
          />
        </label>
        <label className="campo-rotulo">
          Valor
          <input
            className="campo campo-valor"
            inputMode="decimal"
            placeholder="0,00"
            {...register('valor')}
          />
        </label>
        <div className="form-acoes">
          <button
            type="submit"
            className="botao botao-primario"
            disabled={salvar.isPending}
          >
            Adicionar
          </button>
        </div>
      </form>
    </details>
  )
}

export function Metas({ p }: { p: Projecao }) {
  const { estado, linhas, r, base, rb, simulando } = p
  const salvar = useSalvar()
  const config = estado.config
  const cenarioNome = nomeCenario(config.poupancaPercentual)

  // campoCenario: o que conta no cenário (só o investido, para a reserva, ou investido mais conta).
  // alvoPlano: o valor sem a simulação, para comparar.
  const cenarios = (
    alvo: number,
    alvoPlano: number,
    campoCenario: CampoMeta,
    detalheCenario: string,
  ): Cenario[] => {
    const lista: { rotulo: string; campo: CampoMeta; detalhe?: string }[] = [
      { rotulo: 'Investindo toda a sobra', campo: 'patrimonio' },
    ]
    if (r.cenario.disponivel)
      lista.push({
        rotulo: `${cenarioNome} depois da dívida`,
        campo: campoCenario,
        detalhe: detalheCenario,
      })
    return lista.map(({ rotulo, campo, detalhe }) => {
      const quando = quandoAtinge(linhas, r.iHoje, alvo, campo)
      // Sem simulação, "no plano" é o próprio resultado.
      return {
        rotulo,
        detalhe,
        alvo,
        quando,
        noPlano: simulando
          ? quandoAtinge(base, rb.iHoje, alvoPlano, campo)
          : quando,
      }
    })
  }

  function remover(meta: Meta) {
    if (!window.confirm(`Remover a meta “${meta.nome}”?`)) return
    salvar.mutate({
      caminho: `/backoffice/metas/${meta.id}`,
      metodo: 'DELETE',
      mensagem: `Meta “${meta.nome}” removida`,
    })
  }

  const meses = config.reservaMeses
  const reserva = Math.max(1, meses * r.custoMensal)

  return (
    <Secao
      titulo="Metas"
      descricao="Quando o seu patrimônio (o que está guardado menos o que falta devolver) chega em cada valor, investindo toda a sobra e no cenário em que só uma parte do bruto é investida."
    >
      <div className="metas">
        <CartaoMeta
          p={p}
          nome="Reserva de emergência"
          valor={reserva}
          sub={`${plural(meses, 'mês', 'meses')} de despesas (${reais(r.custoMensal)} por mês depois das parcelas)`}
          cenarios={cenarios(
            reserva,
            Math.max(1, meses * rb.custoMensal),
            'reservaCenario',
            'conta só o que está investido no CDB; o que fica na conta é dinheiro livre',
          )}
          extra={
            // biome-ignore lint/a11y/noLabelWithoutControl: o CampoInteiro é um <input>
            <label className="meta-ajuste">
              Meses de despesas
              <CampoInteiro
                valor={meses}
                min={1}
                max={36}
                erro="Use de 1 a 36 meses."
                aria-label="Meses de despesas da reserva de emergência"
                onSalvar={(reservaMeses) =>
                  salvar.mutate({
                    caminho: '/backoffice/config',
                    metodo: 'PUT',
                    corpo: { reservaMeses },
                  })
                }
              />
            </label>
          }
        />
        {estado.metas.map((m) => (
          <CartaoMeta
            key={m.id}
            p={p}
            nome={m.nome}
            valor={m.valor}
            sub="meta sua"
            cenarios={cenarios(
              m.valor,
              m.valor,
              'patrimonioCenario',
              'investido mais o que fica na conta',
            )}
            onRemover={() => remover(m)}
          />
        ))}
      </div>
      <FormMeta />
    </Secao>
  )
}
