// Gráfico em SVG com linhas (curvas suaves, área opcional) e barras. Tem mira com tooltip que segue o
// cursor, navegação pelo teclado (setas, Home e End), legenda que esconde e mostra séries e transições:
// entra se revelando da esquerda para a direita e, quando os dados mudam (simulador), as linhas e barras
// deslizam até os valores novos.
import { AnimatePresence, motion } from 'motion/react'
import {
  type KeyboardEvent,
  type PointerEvent,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react'
import { mesCurto, nomeMes, reais, reaisCurto } from '@/lib/formato'
import { mola, padrao } from '@/lib/movimento'

export type Serie = {
  nome: string
  classe?: string // serie-1 a serie-4: a cor vem do CSS
  valores: (number | null)[]
  // "info" não é desenhada: só aparece no tooltip.
  tipo?: 'linha' | 'barras' | 'info'
  // Linha com área preenchida (gradiente) até o zero.
  area?: boolean
}

type GraficoProps = {
  meses: string[]
  series: Serie[]
  // Mês atual: linhas tracejadas e barras mais claras depois dele (previsão).
  iHoje?: number | null
  marcos?: { i: number; texto: string }[]
  altura?: number
  rotulo?: string
  // Mostra a legenda acima do gráfico; clicar numa série esconde ou mostra.
  legenda?: boolean
}

type Ponto = [number, number]

// Valores redondos para o eixo, cobrindo de min a max (em centavos).
function ticksBonitos(min: number, max: number, alvo: number) {
  const faixa = Math.max(max - min, 100) / 100
  const bruto = faixa / alvo
  const potencia = 10 ** Math.floor(Math.log10(bruto))
  const passo =
    ([1, 2, 2.5, 5, 10].map((f) => f * potencia).find((p) => p >= bruto) ??
      10 * potencia) * 100
  const ticks: number[] = []
  for (let v = Math.floor(min / passo) * passo; v < max + passo; v += passo) {
    ticks.push(Math.round(v))
    if (v >= max) break
  }
  return ticks
}

// Curva monotônica (Fritsch–Carlson): suave, sem passar do valor real entre dois meses.
function curva(pontos: Ponto[]) {
  const n = pontos.length
  if (n === 0) return ''
  const f = (v: number) => v.toFixed(1)
  const [x0, y0] = pontos[0] as Ponto
  if (n === 1) return `M${f(x0)},${f(y0)}`
  const dx: number[] = []
  const inc: number[] = []
  for (let i = 0; i < n - 1; i++) {
    const [xa, ya] = pontos[i] as Ponto
    const [xb, yb] = pontos[i + 1] as Ponto
    dx.push(xb - xa)
    inc.push((yb - ya) / (xb - xa))
  }
  const t: number[] = [inc[0] as number]
  for (let i = 1; i < n - 1; i++) {
    const a = inc[i - 1] as number
    const b = inc[i] as number
    t.push(a * b <= 0 ? 0 : (3 * (a + b)) / ((2 * b + a) / a + (b + 2 * a) / b))
  }
  t.push(inc[n - 2] as number)
  let d = `M${f(x0)},${f(y0)}`
  for (let i = 0; i < n - 1; i++) {
    const [xa, ya] = pontos[i] as Ponto
    const [xb, yb] = pontos[i + 1] as Ponto
    const h = (dx[i] as number) / 3
    d += `C${f(xa + h)},${f(ya + (t[i] as number) * h)} ${f(xb - h)},${f(yb - (t[i + 1] as number) * h)} ${f(xb)},${f(yb)}`
  }
  return d
}

// Barra com a ponta de dados arredondada (4px) e a base reta.
function caminhoBarra(xc: number, largura: number, y0: number, y1: number) {
  const xl = xc - largura / 2
  const xr = xc + largura / 2
  const r = Math.min(4, Math.abs(y1 - y0), largura / 2)
  const s = y1 < y0 ? 1 : -1 // positiva sobe, negativa desce
  return `M${xl},${y0}V${y1 + s * r}Q${xl},${y1} ${xl + r},${y1}H${xr - r}Q${xr},${y1} ${xr},${y1 + s * r}V${y0}Z`
}

// Largura do elemento, atualizada quando a tela muda de tamanho.
function useLargura() {
  const ref = useRef<HTMLDivElement>(null)
  const [largura, setLargura] = useState(0)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observador = new ResizeObserver(([entrada]) =>
      setLargura(Math.round(entrada?.contentRect.width ?? 0)),
    )
    observador.observe(el)
    return () => observador.disconnect()
  }, [])
  return [ref, largura] as const
}

// Caminho que desliza até a forma nova quando os dados mudam (mesma quantidade de pontos).
function Caminho({
  d,
  className,
  fill,
}: {
  d: string
  className: string
  fill?: string
}) {
  return (
    <motion.path
      className={className}
      fill={fill}
      initial={false}
      animate={{ d }}
      transition={padrao}
    />
  )
}

export function Grafico({
  meses,
  series,
  iHoje = null,
  marcos = [],
  altura = 300,
  rotulo,
  legenda = false,
}: GraficoProps) {
  const id = useId().replace(/:/g, '')
  const [ref, larguraMedida] = useLargura()
  const [atual, setAtual] = useState<number | null>(null)
  const [ocultas, setOcultas] = useState<Set<string>>(new Set())
  const largura = Math.max(larguraMedida, 280)
  const estreito = largura < 560
  const m = { topo: 26, direita: estreito ? 12 : 96, baixo: 30, esquerda: 70 }
  const w = largura - m.esquerda - m.direita
  const h = altura - m.topo - m.baixo
  const n = meses.length
  const desenhaveis = series.filter((s) => s.tipo !== 'info')
  const desenhadas = desenhaveis.filter((s) => !ocultas.has(s.nome))
  const todos = desenhadas.flatMap((s) =>
    s.valores.filter((v): v is number => v != null),
  )
  const ticks = ticksBonitos(
    Math.min(0, ...todos),
    Math.max(0, ...todos),
    estreito ? 4 : 5,
  )
  const yMin = ticks[0] ?? 0
  const yMax = ticks[ticks.length - 1] ?? 0
  const passo = w / Math.max(n, 1)
  const x = (i: number) => m.esquerda + passo * (i + 0.5)
  const y = (v: number) => m.topo + h - ((v - yMin) / (yMax - yMin || 1)) * h

  // Todos os meses quando cabem; senão, o primeiro e cada janeiro.
  const todosOsMeses = passo >= 46
  let ultimoX = Number.NEGATIVE_INFINITY
  const rotulosX = meses.flatMap((mes, i) => {
    if (!todosOsMeses && i !== 0 && !mes.endsWith('-01')) return []
    if (x(i) - ultimoX < 48) return []
    ultimoX = x(i)
    return [{ mes, i }]
  })

  let ultimoMarco = Number.NEGATIVE_INFINITY
  let nivel = 0
  const marcosPosicionados = marcos
    .filter((mc) => mc.i >= 0 && mc.i < n)
    .sort((a, b) => a.i - b.i)
    .map((mc) => {
      const px = x(mc.i)
      nivel = px - ultimoMarco < 150 ? nivel + 1 : 0
      ultimoMarco = px
      const ancora: 'end' | 'start' =
        px > m.esquerda + w - 140 ? 'end' : 'start'
      return { ...mc, px, nivel, ancora }
    })

  // Trechos contínuos (sem null) entre de e ate, cada um como curva.
  const trechos = (valores: (number | null)[], de: number, ate: number) => {
    const lista: Ponto[][] = []
    let atualTrecho: Ponto[] = []
    for (let i = de; i <= ate; i++) {
      const v = valores[i]
      if (v == null) {
        if (atualTrecho.length) lista.push(atualTrecho)
        atualTrecho = []
        continue
      }
      atualTrecho.push([x(i), y(v)])
    }
    if (atualTrecho.length) lista.push(atualTrecho)
    return lista
  }
  const caminho = (valores: (number | null)[], de: number, ate: number) =>
    trechos(valores, de, ate).map(curva).join('')
  const area = (valores: (number | null)[]) => {
    const base = y(Math.max(yMin, Math.min(0, yMax))).toFixed(1)
    return trechos(valores, 0, n - 1)
      .map((t) => {
        const primeiro = t[0] as Ponto
        const ultimo = t[t.length - 1] as Ponto
        return `${curva(t)}L${ultimo[0].toFixed(1)},${base}L${primeiro[0].toFixed(1)},${base}Z`
      })
      .join('')
  }

  const linhas = desenhadas.filter((s) => s.tipo !== 'barras')
  const fins = linhas.flatMap((s) => {
    const i = s.valores.reduce<number>((acc, v, k) => (v != null ? k : acc), -1)
    return i >= 0 ? [{ s, i, v: s.valores[i] as number }] : []
  })
  const colidem = fins.some((a, ia) =>
    fins.some((b, ib) => ia !== ib && Math.abs(y(a.v) - y(b.v)) < 16),
  )

  const mostrar = (i: number) => setAtual(Math.max(0, Math.min(n - 1, i)))
  const aoMover = (e: PointerEvent<SVGSVGElement>) => {
    const caixa = e.currentTarget.getBoundingClientRect()
    const px = ((e.clientX - caixa.left) * largura) / caixa.width
    if (px < m.esquerda - 8 || px > m.esquerda + w + 8) setAtual(null)
    else mostrar(Math.floor((px - m.esquerda) / passo))
  }
  const aoTeclar = (e: KeyboardEvent<SVGSVGElement>) => {
    const base = atual ?? n - 1
    const destino = {
      ArrowLeft: base - 1,
      ArrowRight: base + 1,
      Home: 0,
      End: n - 1,
    }[e.key]
    if (destino == null) return
    e.preventDefault()
    mostrar(destino)
  }

  const alternar = (nome: string) =>
    setOcultas((atuais) => {
      const novas = new Set(atuais)
      if (novas.has(nome)) novas.delete(nome)
      else if (desenhaveis.length - novas.size > 1) novas.add(nome) // sempre sobra uma
      return novas
    })

  // A primeira série fica por cima: as séries são desenhadas da última para a primeira.
  const ordemDesenho = [...desenhadas].reverse()
  const larguraBarra = Math.max(2, Math.min(22, passo * 0.62))
  const tituloTooltip =
    atual == null
      ? ''
      : `${nomeMes(meses[atual] as string)}${iHoje == null ? '' : atual > iHoje ? ' · previsto' : atual === iHoje ? ' · mês atual' : ''}`
  const pxAtual = atual == null ? 0 : x(atual)
  const tooltipADireita = pxAtual + 14 + 230 <= largura
  const temHoje = iHoje != null && iHoje < n - 1
  const corte = temHoje ? Math.max(0, iHoje) : n - 1

  return (
    <div className="grafico-bloco">
      {legenda ? (
        <ul className="legenda legenda-interativa">
          {desenhaveis.map((s) => {
            const oculta = ocultas.has(s.nome)
            return (
              <li key={s.nome}>
                <button
                  type="button"
                  aria-pressed={!oculta}
                  title={oculta ? 'Mostrar no gráfico' : 'Esconder do gráfico'}
                  onClick={() => alternar(s.nome)}
                >
                  <span
                    className={`${s.tipo === 'barras' ? 'chave-barra' : 'chave-linha'} ${s.classe ?? ''}`}
                  />
                  {s.nome}
                </button>
              </li>
            )
          })}
          {temHoje && desenhadas.some((s) => s.tipo !== 'barras') ? (
            <li className="legenda-nota">
              <span className="chave-linha chave-prevista" />
              Tracejado: previsão
            </li>
          ) : null}
        </ul>
      ) : null}
      <div className="grafico" ref={ref}>
        {larguraMedida > 0 ? (
          <svg
            width={largura}
            height={altura}
            style={{ width: largura, height: altura }}
            viewBox={`0 0 ${largura} ${altura}`}
            // biome-ignore lint/a11y/noNoninteractiveTabindex: o gráfico é navegável pelas setas do teclado
            tabIndex={0}
            role="img"
            aria-label={`${rotulo ?? 'Gráfico mês a mês'}. Use as setas para percorrer os meses; os valores também estão na tabela Mês a mês.`}
            onPointerMove={aoMover}
            onPointerLeave={() => setAtual(null)}
            onFocus={() => mostrar(atual ?? iHoje ?? n - 1)}
            onBlur={() => setAtual(null)}
            onKeyDown={aoTeclar}
          >
            <defs>
              {/* Revela o desenho da esquerda para a direita ao entrar e ao trocar o período. */}
              <clipPath id={`revelar-${id}`}>
                <motion.rect
                  key={n}
                  x={0}
                  y={0}
                  height={altura}
                  initial={{ width: 0 }}
                  animate={{ width: largura }}
                  transition={{ duration: 0.7, ease: [0.2, 0, 0, 1] }}
                />
              </clipPath>
              {desenhadas
                .filter((s) => s.area)
                .map((s) => (
                  <linearGradient
                    key={s.nome}
                    id={`area-${id}-${s.classe}`}
                    x1="0"
                    x2="0"
                    y1="0"
                    y2="1"
                  >
                    <stop
                      offset="0%"
                      style={{
                        stopColor: `var(--${s.classe})`,
                        stopOpacity: 0.22,
                      }}
                    />
                    <stop
                      offset="100%"
                      style={{
                        stopColor: `var(--${s.classe})`,
                        stopOpacity: 0,
                      }}
                    />
                  </linearGradient>
                ))}
            </defs>

            {/* Faixa do mês sob o cursor. */}
            <motion.rect
              className="faixa-mes"
              y={m.topo}
              height={h}
              width={passo}
              initial={false}
              animate={{
                x: pxAtual - passo / 2,
                opacity: atual == null ? 0 : 1,
              }}
              transition={{ x: mola, opacity: { duration: 0.12 } }}
            />

            <g className="grade">
              {ticks.map((t) => (
                <g key={t}>
                  <line
                    className={t === 0 ? 'zero' : ''}
                    x1={m.esquerda}
                    x2={m.esquerda + w}
                    y1={y(t)}
                    y2={y(t)}
                  />
                  <text x={m.esquerda - 10} y={y(t) + 4} textAnchor="end">
                    {reaisCurto(t)}
                  </text>
                </g>
              ))}
            </g>
            <g className="eixo">
              {rotulosX.map(({ mes, i }) => (
                <text
                  key={mes}
                  x={x(i)}
                  y={m.topo + h + 20}
                  textAnchor="middle"
                  className={i === atual ? 'ativo' : undefined}
                >
                  {mesCurto(mes)}
                </text>
              ))}
            </g>
            {marcosPosicionados.map((mc) => (
              <g className="marco" key={`${mc.i}-${mc.texto}`}>
                <line
                  x1={mc.px}
                  x2={mc.px}
                  y1={m.topo - 6 + mc.nivel * 14}
                  y2={m.topo + h}
                />
                <text
                  x={mc.px + (mc.ancora === 'end' ? -6 : 6)}
                  y={m.topo - 10 + mc.nivel * 14}
                  textAnchor={mc.ancora}
                >
                  {mc.texto}
                </text>
              </g>
            ))}

            <g clipPath={`url(#revelar-${id})`}>
              <AnimatePresence initial={false}>
                {ordemDesenho.map((s) => (
                  <motion.g
                    key={s.nome}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.18 }}
                  >
                    {s.tipo === 'barras' ? (
                      s.valores.map((v, i) =>
                        v ? (
                          <Caminho
                            // biome-ignore lint/suspicious/noArrayIndexKey: uma barra por mês, na ordem dos meses
                            key={i}
                            className={`barra ${s.classe ?? ''} ${v < 0 ? 'negativa' : 'positiva'}${iHoje != null && i > iHoje ? ' prevista' : ''}${atual != null && atual !== i ? ' apagada' : ''}`}
                            d={caminhoBarra(x(i), larguraBarra, y(0), y(v))}
                          />
                        ) : null,
                      )
                    ) : (
                      <>
                        {s.area ? (
                          <Caminho
                            className="area"
                            d={area(s.valores)}
                            fill={`url(#area-${id}-${s.classe})`}
                          />
                        ) : null}
                        <Caminho
                          className={`linha ${s.classe ?? ''}`}
                          d={caminho(s.valores, 0, corte)}
                        />
                        {temHoje ? (
                          // Depois de hoje: previsto (tracejado).
                          <Caminho
                            className={`linha prevista ${s.classe ?? ''}`}
                            d={caminho(s.valores, corte, n - 1)}
                          />
                        ) : null}
                      </>
                    )}
                  </motion.g>
                ))}
              </AnimatePresence>
            </g>

            {fins.map((f) => (
              <motion.circle
                key={f.s.nome}
                className={`ponto ${f.s.classe ?? ''}`}
                r={4}
                initial={false}
                animate={{ cx: x(f.i), cy: y(f.v) }}
                transition={padrao}
              />
            ))}
            {estreito || colidem
              ? null
              : fins.map((f) => (
                  <motion.text
                    key={f.s.nome}
                    className="rotulo-fim"
                    initial={false}
                    animate={{ x: x(f.i) + 10, y: y(f.v) + 4 }}
                    transition={padrao}
                  >
                    {reaisCurto(f.v)}
                  </motion.text>
                ))}
            <g
              className="mira"
              visibility={atual == null ? 'hidden' : 'visible'}
            >
              <line x1={pxAtual} x2={pxAtual} y1={m.topo} y2={m.topo + h} />
              {atual == null
                ? null
                : linhas.map((s) => {
                    const v = s.valores[atual]
                    return v == null ? null : (
                      <circle
                        key={s.nome}
                        className={`ponto ${s.classe ?? ''}`}
                        r={4.5}
                        cx={pxAtual}
                        cy={y(v)}
                      />
                    )
                  })}
            </g>
            <rect
              className="captura"
              x={m.esquerda}
              y={m.topo}
              width={w}
              height={h}
            />
          </svg>
        ) : (
          <div
            className="esqueleto grafico-esqueleto"
            style={{ height: altura }}
          />
        )}
        <AnimatePresence>
          {atual == null ? null : (
            <motion.div
              className="tooltip-grafico"
              style={{ top: m.topo, left: 0 }}
              initial={{
                opacity: 0,
                x: tooltipADireita ? pxAtual + 14 : pxAtual - 244,
                scale: 0.97,
              }}
              animate={{
                opacity: 1,
                scale: 1,
                x: tooltipADireita ? pxAtual + 14 : pxAtual - 244,
              }}
              exit={{ opacity: 0, scale: 0.97, transition: { duration: 0.1 } }}
              transition={{
                x: mola,
                opacity: { duration: 0.12 },
                scale: { duration: 0.12 },
              }}
            >
              <p className="tooltip-titulo">{tituloTooltip}</p>
              {series
                .filter((s) => !ocultas.has(s.nome))
                .map((s) => {
                  const v = s.valores[atual]
                  if (v == null) return null
                  const chave =
                    s.tipo === 'info'
                      ? 'chave-info'
                      : `${s.tipo === 'barras' ? 'chave-barra' : 'chave-linha'} ${s.classe ?? ''}${v < 0 ? ' negativa' : ''}`
                  return (
                    <p className="tooltip-linha" key={s.nome}>
                      <span className={chave} />
                      <strong>{reais(v)}</strong>
                      <span>{s.nome}</span>
                    </p>
                  )
                })}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
