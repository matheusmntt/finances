import { Link } from '@tanstack/react-router'
import { Icone } from '@/components/icones'
import { nomeFolha } from '@/domain/calculo'
import type { Holerite } from '@/domain/tipos'
import { abrirArquivo } from '@/lib/api'
import { isoParaBr, nomeMes, reais } from '@/lib/formato'
import { toast } from '@/stores/toast'

type CartaoFolhaProps = {
  folha: Holerite
  aberto: boolean
  onAlternar: () => void
  onRemover: () => void
}

// Uma folha de pagamento: líquido, data do pagamento e, nos detalhes, os itens do recibo.
export function CartaoFolha({
  folha: h,
  aberto,
  onAlternar,
  onRemover,
}: CartaoFolhaProps) {
  const nome = nomeFolha(h)
  const deposito = [
    h.banco,
    h.agencia && `agência ${h.agencia}`,
    h.conta && `conta ${h.conta}`,
  ]
    .filter(Boolean)
    .join(' · ')
  const empresa = h.empresa || h.razaoSocial

  return (
    <article className="cartao boleto folha" id={`f-${h.id}`}>
      <div className="info">
        <div className="info-topo">
          <span className="custo-nome">{nome}</span>
          {empresa ? <span className="tag">{empresa}</span> : null}
        </div>
        <p className="descricao">
          {h.cargo}
          {h.salarioMensal ? ` · salário de ${reais(h.salarioMensal)}` : ''}
        </p>
        <p className="meta">
          Entra nas contas de{' '}
          <Link to="/mes" search={{ mes: h.mes }}>
            {nomeMes(h.mes)}
          </Link>
        </p>
      </div>
      <div className="valor">
        <strong>{reais(h.liquido)}</strong>
        <span>
          {reais(h.totalVencimentos)} − {reais(h.totalDescontos)}
        </span>
      </div>
      <div className="prazo">
        <span className="prazo-rotulo">Pago em</span>
        <strong>{h.pagoEm ? isoParaBr(h.pagoEm) : '—'}</strong>
      </div>
      <div className="acoes">
        <button
          type="button"
          className="botao botao-primario"
          onClick={() =>
            abrirArquivo(`/holerites/${h.id}/pdf`).catch((e: Error) =>
              toast(e.message),
            )
          }
        >
          <Icone.abrir />
          Ver PDF
        </button>
        <button
          type="button"
          className="botao botao-icone"
          aria-expanded={aberto}
          aria-controls={`df-${h.id}`}
          aria-label={`Detalhes da ${nome}`}
          onClick={onAlternar}
        >
          <Icone.seta />
        </button>
      </div>
      <div className="detalhes" id={`df-${h.id}`} hidden={!aberto}>
        <Itens folha={h} />
        <dl className="largo detalhes-dados">
          <div>
            <dt>Base INSS</dt>
            <dd>{reais(h.baseInss)}</dd>
          </div>
          <div>
            <dt>Base IRRF</dt>
            <dd>{reais(h.baseIrrf)}</dd>
          </div>
          <div>
            <dt>FGTS do mês</dt>
            <dd>{reais(h.fgts)}</dd>
          </div>
          <div>
            <dt>Empresa</dt>
            <dd>
              {h.razaoSocial || h.empresa || '—'}
              {h.cnpj ? ` · CNPJ ${h.cnpj}` : ''}
            </dd>
          </div>
          <div>
            <dt>Funcionário</dt>
            <dd>
              {h.funcionario || '—'}
              {h.matricula ? ` · ${h.matricula}` : ''}
            </dd>
          </div>
          <div>
            <dt>Depósito</dt>
            <dd>{deposito || '—'}</dd>
          </div>
          <div>
            <dt>Arquivo original</dt>
            <dd className="codigo">{h.arquivo || '—'}</dd>
          </div>
        </dl>
        <div className="largo acoes-folha">
          <button
            type="button"
            className="botao botao-fantasma"
            onClick={onRemover}
          >
            <Icone.remover />
            Remover folha
          </button>
        </div>
      </div>
    </article>
  )
}

// Tabela com os itens do recibo (vencimentos e descontos), totais e líquido.
function Itens({ folha: h }: { folha: Holerite }) {
  return (
    <div className="tabela-wrap largo">
      <table className="tabela tabela-folha">
        <thead>
          <tr>
            <th scope="col">Cód</th>
            <th scope="col">Descrição</th>
            <th scope="col" className="num col-ref">
              Hrs/Qtde
            </th>
            <th scope="col" className="num">
              Vencimentos
            </th>
            <th scope="col" className="num">
              Descontos
            </th>
          </tr>
        </thead>
        <tbody>
          {h.itens.map((i, n) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: o código pode se repetir no mesmo recibo
            <tr key={n}>
              <td>{i.codigo}</td>
              <td>
                {i.descricao}
                {i.referencia ? (
                  <span className="ref-curta"> · {i.referencia}</span>
                ) : null}
              </td>
              <td className="num col-ref">{i.referencia || ''}</td>
              <td className="num">{i.vencimento ? reais(i.vencimento) : ''}</td>
              <td className="num">{i.desconto ? reais(i.desconto) : ''}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <th scope="row" colSpan={2}>
              Totais
            </th>
            <td className="col-ref" />
            <td className="num">{reais(h.totalVencimentos)}</td>
            <td className="num">{reais(h.totalDescontos)}</td>
          </tr>
          <tr>
            <th scope="row" colSpan={2}>
              Líquido
            </th>
            <td className="col-ref" />
            <td className="num" colSpan={2}>
              {reais(h.liquido)}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}
