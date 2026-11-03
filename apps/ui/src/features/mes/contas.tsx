import { Link } from '@tanstack/react-router'
import { useSalvar } from '@/api/mutacoes'
import { BotaoRemover } from '@/components/botao-remover'
import { Secao } from '@/components/secao'
import type { Calculo } from '@/domain/calculo'
import type { Despesa, Estado, Extra } from '@/domain/tipos'
import { isoHoje, isoParaBr, plural, reais } from '@/lib/formato'
import { soma, textoParcela, useMarcarDespesa } from './comum'
import { FormularioAdicionar } from './formulario-adicionar'

type Props = { estado: Estado; calculo: Calculo; mes: string }

// Linha já paga, sem ações de pagamento (o que a Greici e o André pagaram).
function LinhaSimples({
  nome,
  valor,
  meta,
}: {
  nome: string
  valor: number
  meta: string
}) {
  return (
    <div className="conta paga">
      <label className="check">
        <input type="checkbox" checked disabled readOnly />
        <span className="sr-only">Pago</span>
      </label>
      <div className="conta-info">
        <div className="conta-nome">
          <span>{nome}</span>
        </div>
        {meta ? <p className="meta">{meta}</p> : null}
      </div>
      <div className="conta-valor">{reais(valor)}</div>
    </div>
  )
}

function LinhaConta({
  despesa,
  estado,
  calculo,
  mes,
}: Props & { despesa: Despesa }) {
  const salvar = useSalvar()
  const marcar = useMarcarDespesa()
  const v = despesa.valores[mes]
  if (!v) return null
  const deles = v.pagoPorCredores
  const paga = deles || Boolean(v.pagoEm)
  const meta = deles
    ? 'Pago pela Greici e pelo André'
    : [
        textoParcela(despesa, mes, calculo),
        despesa.pagoAosCredores && !despesa.categoriaDivida
          ? 'pago direto a eles, fora da devolução'
          : '',
        v.pagoEm ? `paga em ${isoParaBr(v.pagoEm)}` : '',
      ]
        .filter(Boolean)
        .join(' · ')

  const remover = () => {
    const meses = Object.keys(despesa.valores).length
    if (
      window.confirm(
        `Remover “${despesa.nome}” de ${plural(meses, 'mês', 'meses')}?`,
      )
    ) {
      salvar.mutate({
        caminho: `/despesas/${despesa.id}`,
        metodo: 'DELETE',
        mensagem: `${despesa.nome} removida`,
      })
    }
  }

  return (
    <div
      className={`conta${paga ? ' paga' : ''}${despesa.criadaPeloUsuario ? ' conta-com-acao' : ''}`}
    >
      <label className="check">
        <input
          type="checkbox"
          checked={paga}
          disabled={deles}
          onChange={(e) => marcar(despesa, mes, e.target.checked)}
        />
        <span className="sr-only">Marcar {despesa.nome} como paga</span>
      </label>
      <div className="conta-info">
        <div className="conta-nome">
          <span>{despesa.nome}</span>
          {despesa.categoriaDivida || despesa.pagoAosCredores ? (
            <Link className="tag tag-link" to="/divida">
              {estado.config.credores}
            </Link>
          ) : null}
          {despesa.categoriaDivida &&
          despesa.categoriaDivida === estado.config.categoriaCarro ? (
            <Link className="tag tag-link" to="/multas">
              Carro
            </Link>
          ) : null}
        </div>
        <p className="meta">{meta}</p>
      </div>
      <div className="conta-valor">{reais(v.valor)}</div>
      {despesa.criadaPeloUsuario ? (
        <BotaoRemover
          rotulo={`Remover ${despesa.nome} de todos os meses`}
          onClick={remover}
        />
      ) : null}
    </div>
  )
}

// Uma seção por grupo de despesas (Despesas fixas, Cartão...), só com as que têm valor no mês.
export function SecoesGrupos({ estado, calculo, mes }: Props) {
  const doMes = estado.despesas.filter((x) => x.valores[mes])
  return (
    <>
      {estado.grupos.map((g) => {
        const contas = doMes.filter((x) => x.grupoId === g.id)
        if (!contas.length) return null
        const proprias = contas.filter((x) => !x.valores[mes]?.pagoPorCredores)
        const pagas = proprias.filter((x) => x.valores[mes]?.pagoEm).length
        const legenda = proprias.length
          ? `${pagas} de ${proprias.length} ${proprias.length === 1 ? 'paga' : 'pagas'}`
          : 'pagas pela Greici e pelo André'
        return (
          <Secao
            key={g.id}
            titulo={g.nome}
            descricao={g.descricao}
            total={reais(soma(contas.map((x) => x.valores[mes]?.valor)))}
            legendaTotal={legenda}
          >
            <div className="cartao contas">
              {contas.map((x) => (
                <LinhaConta
                  key={x.id}
                  despesa={x}
                  estado={estado}
                  calculo={calculo}
                  mes={mes}
                />
              ))}
            </div>
          </Secao>
        )
      })}
    </>
  )
}

export function SecaoEmprestimos({ estado, mes }: Omit<Props, 'calculo'>) {
  const lista = estado.emprestimos.filter((e) => e.mes === mes)
  if (!lista.length) return null
  return (
    <Secao
      titulo="Pago pela Greici e pelo André"
      descricao="Despesas que eles pagaram por você neste mês. Entram na dívida com eles."
      total={reais(soma(lista.map((e) => e.valor)))}
      legendaTotal={plural(lista.length, 'item', 'itens')}
    >
      <div className="cartao contas">
        {lista.map((e) => (
          <LinhaSimples
            key={e.id}
            nome={e.descricao}
            valor={e.valor}
            meta={e.origem}
          />
        ))}
      </div>
    </Secao>
  )
}

function LinhaExtra({ extra }: { extra: Extra }) {
  const salvar = useSalvar()
  const caminho = `/extras/${extra.id}`
  const pagar = (pagoEm: string | null) => (e: Estado) => {
    const x = e.extras.find((y) => y.id === extra.id)
    if (x) x.pagoEm = pagoEm
  }
  const marcar = (marcado: boolean) => {
    const anterior = extra.pagoEm
    const pagoEm = marcado ? (anterior ?? isoHoje()) : null
    salvar.mutate({
      caminho,
      metodo: 'PATCH',
      corpo: { pagoEm },
      otimista: pagar(pagoEm),
      mensagem: `${extra.descricao} ${marcado ? 'marcado como pago' : 'voltou para “a pagar”'}`,
      desfazer: () =>
        salvar.mutate({
          caminho,
          metodo: 'PATCH',
          corpo: { pagoEm: anterior },
          otimista: pagar(anterior),
        }),
    })
  }

  return (
    <div className={`conta conta-com-acao${extra.pagoEm ? ' paga' : ''}`}>
      <label className="check">
        <input
          type="checkbox"
          checked={Boolean(extra.pagoEm)}
          onChange={(e) => marcar(e.target.checked)}
        />
        <span className="sr-only">Marcar {extra.descricao} como pago</span>
      </label>
      <div className="conta-info">
        <div className="conta-nome">
          <span>{extra.descricao}</span>
        </div>
        <p className="meta">
          {extra.pagoEm ? `pago em ${isoParaBr(extra.pagoEm)}` : 'Gasto avulso'}
        </p>
      </div>
      <div className="conta-valor">{reais(extra.valor)}</div>
      <BotaoRemover
        rotulo={`Remover ${extra.descricao}`}
        onClick={() =>
          salvar.mutate({
            caminho,
            metodo: 'DELETE',
            mensagem: `${extra.descricao} removido`,
            desfazer: () =>
              salvar.mutate({
                caminho: '/extras',
                corpo: {
                  mes: extra.mes,
                  descricao: extra.descricao,
                  valor: extra.valor,
                },
              }),
          })
        }
      />
    </div>
  )
}

export function SecaoExtras({ estado, calculo, mes }: Props) {
  const extras = estado.extras.filter((x) => x.mes === mes)
  return (
    <Secao
      titulo="Extras"
      descricao="Gastos avulsos deste mês. Entram no saldo na hora."
      total={reais(calculo.doMes(mes).extras)}
      legendaTotal={plural(extras.length, 'extra', 'extras')}
    >
      <div className="cartao contas">
        {extras.map((x) => (
          <LinhaExtra key={x.id} extra={x} />
        ))}
        {extras.length ? null : (
          <p className="vazio-linha">Nenhum extra neste mês.</p>
        )}
        <FormularioAdicionar
          tipo="extra"
          mes={mes}
          placeholder="Novo extra (ex.: Presente)"
        />
      </div>
    </Secao>
  )
}
