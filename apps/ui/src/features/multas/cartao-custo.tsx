import { Icone } from '@/components/icones'
import type { CustoCarro } from '@/domain/tipos'
import { abrirArquivo } from '@/lib/api'
import { reais } from '@/lib/formato'
import { toast } from '@/stores/toast'
import { BotaoCopiar, PrazoPago, PrazoValidade } from './partes'

type CartaoCustoProps = {
  custo: CustoCarro
  onPagar: (pago: boolean) => void
  onAlterarData: (pagoEm: string) => void
}

// Despesa do carro que não é multa (CRLV, pátio, depósito), com ou sem guia do Detran.
export function CartaoCusto({
  custo: c,
  onPagar,
  onAlterarData,
}: CartaoCustoProps) {
  const temBoleto = Boolean(c.linhaDigitavel)
  const diarias = /por dia/.test(c.detalhe || '')
  const meta = [
    c.guia ? `Guia ${c.guia}` : '',
    diarias && c.validade ? `depois de ${c.validade} entram novas diárias` : '',
  ].filter(Boolean)

  return (
    <article
      className={`cartao boleto${c.pagoEm ? ' pago' : ''}`}
      id={`c-${c.id}`}
    >
      <label className="check">
        <input
          type="checkbox"
          checked={Boolean(c.pagoEm)}
          onChange={(e) => onPagar(e.target.checked)}
        />
        <span className="sr-only">
          Marcar {c.descricao} como pago pela Greici e pelo André
        </span>
      </label>
      <div className="info">
        <div className="info-topo">
          <span className="custo-nome">{c.descricao}</span>
          {temBoleto ? <span className="tag">Guia Detran</span> : null}
          {c.pagoEm ? <span className="tag tag-pago">Pago</span> : null}
        </div>
        <p className="descricao">{c.detalhe}</p>
        {meta.length ? <p className="meta">{meta.join(' · ')}</p> : null}
      </div>
      <div className="valor">
        <strong>{reais(c.valor)}</strong>
      </div>
      <div className="prazo">
        {c.pagoEm ? (
          <PrazoPago
            pagoEm={c.pagoEm}
            rotulo={c.descricao}
            onAlterar={onAlterarData}
          />
        ) : c.validade ? (
          <PrazoValidade validade={c.validade} />
        ) : null}
      </div>
      <div className="acoes">
        {temBoleto && c.temPdf ? (
          <button
            type="button"
            className="botao botao-primario"
            onClick={() =>
              abrirArquivo(`/custos-carro/${c.id}/pdf`).catch((e: Error) =>
                toast(e.message),
              )
            }
          >
            <Icone.abrir />
            Ver boleto
          </button>
        ) : null}
        {temBoleto ? <BotaoCopiar linha={c.linhaDigitavel} /> : null}
      </div>
    </article>
  )
}
