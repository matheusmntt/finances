import type { ReactNode } from 'react'
import { Icone } from '@/components/icones'
import type { Estado, Multa } from '@/domain/tipos'
import { abrirArquivo } from '@/lib/api'
import { reais, titulo } from '@/lib/formato'
import { toast } from '@/stores/toast'
import { BotaoCopiar, PrazoPago, PrazoValidade } from './partes'
import {
  composicao,
  descricaoMulta,
  tipoMulta,
  valorNoCodigo,
} from './utilidades'

type CartaoMultaProps = {
  multa: Multa
  estado: Estado
  aberto: boolean
  onAlternar: () => void
  onPagar: (pago: boolean) => void
  onAlterarData: (pagoEm: string) => void
  onIrPara: (serie: string) => void
}

export function CartaoMulta({
  multa: b,
  estado,
  aberto,
  onAlternar,
  onPagar,
  onAlterarData,
  onIrPara,
}: CartaoMultaProps) {
  const s = b.serie

  // Link para outra multa (a de origem ou as que ela gerou), se ela existir.
  const linkSerie = (serie: string) =>
    estado.multas.some((m) => m.serie === serie) ? (
      <a
        key={serie}
        href={`#b-${serie}`}
        onClick={(e) => {
          e.preventDefault()
          onIrPara(serie)
        }}
      >
        {serie}
      </a>
    ) : (
      serie
    )

  const meta: ReactNode[] = [
    `Infração ${b.dataInfracao}${b.horaInfracao ? `, ${b.horaInfracao}` : ''}`,
  ]
  if (b.origem) meta.push(<>origem {linkSerie(b.origem)}</>)
  const filhas = estado.multas.filter((m) => m.origem === s).map((m) => m.serie)
  if (filhas.length)
    meta.push(
      <>
        gerou{' '}
        {filhas.map((f, i) => (
          <span key={f}>
            {i > 0 ? ', ' : ''}
            {linkSerie(f)}
          </span>
        ))}
      </>,
    )

  const desconto =
    b.cobranca === 'com-desconto' && b.valorOriginal > b.valor
      ? b.valorOriginal - b.valor
      : 0
  const avisoCodigo =
    desconto > 0 && valorNoCodigo(b.linhaDigitavel) === b.valorOriginal

  return (
    <article
      className={`cartao boleto${b.pagoEm ? ' pago' : ''}`}
      id={`b-${s}`}
    >
      <label className="check">
        <input
          type="checkbox"
          checked={Boolean(b.pagoEm)}
          onChange={(e) => onPagar(e.target.checked)}
        />
        <span className="sr-only">
          Marcar {s} como paga pela Greici e pelo André
        </span>
      </label>
      <div className="info">
        <div className="info-topo">
          <span className="serie">{s}</span>
          <span className="tag">{tipoMulta(estado, b)}</span>
          {b.pagoEm ? <span className="tag tag-pago">Paga</span> : null}
        </div>
        <p className="descricao">
          {descricaoMulta(estado, b)}
          {b.velocidade ? (
            <>
              {' '}
              <span className="sub">
                · {b.velocidade.considerada} km/h (limite {b.velocidade.limite})
              </span>
            </>
          ) : null}
        </p>
        <p className="meta">
          {meta.map((m, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: a ordem dos trechos é fixa
            <span key={i}>
              {i > 0 ? ' · ' : ''}
              {m}
            </span>
          ))}
        </p>
      </div>
      <div className="valor">
        <strong>{reais(b.valor)}</strong>
        <span>{composicao(b)}</span>
      </div>
      <div className="prazo">
        {b.pagoEm ? (
          <PrazoPago pagoEm={b.pagoEm} rotulo={s} onAlterar={onAlterarData} />
        ) : (
          <PrazoValidade validade={b.validade} />
        )}
      </div>
      <div className="acoes">
        {b.temPdf ? (
          <button
            type="button"
            className="botao botao-primario"
            onClick={() =>
              abrirArquivo(`/multas/${s}/pdf`).catch((e: Error) =>
                toast(e.message),
              )
            }
          >
            <Icone.abrir />
            Ver boleto
          </button>
        ) : null}
        <BotaoCopiar linha={b.linhaDigitavel} />
        <button
          type="button"
          className="botao botao-icone"
          aria-expanded={aberto}
          aria-controls={`d-${s}`}
          aria-label={`Detalhes de ${s}`}
          onClick={onAlternar}
        >
          <Icone.seta />
        </button>
      </div>
      <dl className="detalhes" id={`d-${s}`} hidden={!aberto}>
        <div className="largo">
          <dt>Linha digitável</dt>
          <dd className="codigo">{b.linhaDigitavel}</dd>
        </div>
        <div>
          <dt>Nº da guia</dt>
          <dd className="codigo">{b.guia}</dd>
        </div>
        <div>
          <dt>Expedida em</dt>
          <dd>{b.expedida}</dd>
        </div>
        <div>
          <dt>Autuador</dt>
          <dd>{b.autuador}</dd>
        </div>
        <div>
          <dt>Local</dt>
          <dd>
            {titulo(b.local ?? '')} · {titulo(b.municipio ?? '')}
          </dd>
        </div>
        <div>
          <dt>Enquadramento</dt>
          <dd>
            {b.codigoInfracao} · {b.amparo}
          </dd>
        </div>
        {b.pontos != null ? (
          <div>
            <dt>Pontos</dt>
            <dd>{b.pontos}</dd>
          </div>
        ) : null}
        {desconto > 0 ? (
          <div>
            <dt>Desconto</dt>
            <dd>
              {reais(desconto)} até {b.validade}
            </dd>
          </div>
        ) : null}
        {b.velocidade ? (
          <div>
            <dt>Velocidade</dt>
            <dd>
              medida {b.velocidade.medida} · considerada{' '}
              {b.velocidade.considerada} · limite {b.velocidade.limite} km/h
            </dd>
          </div>
        ) : null}
        {avisoCodigo ? (
          <div className="largo">
            <dt>Na hora de pagar</dt>
            <dd>
              O código de barras traz o valor cheio ({reais(b.valorOriginal)}).
              O desconto de {reais(desconto)} vale até {b.validade} e aparece no
              pagamento.
            </dd>
          </div>
        ) : null}
        <div>
          <dt>Arquivo original</dt>
          <dd className="codigo">{b.arquivo || '—'}</dd>
        </div>
      </dl>
    </article>
  )
}
