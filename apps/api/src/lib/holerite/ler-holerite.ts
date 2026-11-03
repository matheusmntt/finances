// Monta a folha de pagamento a partir do texto do PDF do recibo: pelos rótulos ("Folha Mensal de 08/2026",
// "CNPJ", "Líquido"...) e pelas colunas da tabela (Hrs/Qtde, Vencimentos, Descontos). Confere se os itens
// fecham com os totais e o líquido; se não fecharem, recusa o arquivo.
import { RegraInvalidaError } from '../../core/errors'
import { type TextoPdf, textosDoPdf } from '../pdf/textos-do-pdf'

export type ItemHolerite = {
  codigo: string
  descricao: string
  referencia: string | null
  vencimento: number
  desconto: number
}

export type HoleriteLido = {
  tipo: string
  competencia: string // AAAA-MM
  empresa: string
  razaoSocial: string
  cnpj: string
  funcionario: string
  matricula: string
  cargo: string
  itens: ItemHolerite[]
  salarioMensal: number
  baseInss: number
  baseIrrf: number
  fgts: number
  totalVencimentos: number
  totalDescontos: number
  liquido: number
  banco: string | null
  agencia: string | null
  conta: string | null
  pagoEm: string | null // AAAA-MM-DD, data do recibo
}

type Linha = { pagina: number; y: number; itens: TextoPdf[] }

// Largura aproximada na Helvetica (em milésimos do tamanho da fonte), para achar o centro de cada texto.
function largura(t: TextoPdf) {
  let soma = 0
  for (const ch of t.texto) {
    if (/\d/.test(ch)) soma += 556
    else if (/[.,:;/ ]/.test(ch)) soma += 278
    else if (/[A-Z]/.test(ch)) soma += 667
    else soma += 500
  }
  return (soma / 1000) * (t.tamanho || 9)
}

const centro = (t: TextoPdf) => t.x + largura(t) / 2
const NUMERO = /^-?\d{1,3}(\.\d{3})*,\d{2}$/
const centavos = (texto: string) =>
  Math.round(Number(texto.replace(/\./g, '').replace(',', '.')) * 100)
const semAcento = (texto: string) =>
  texto
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()

// Agrupa os textos em linhas (mesma página e mesma altura), de cima para baixo e da esquerda para a direita.
function linhas(textos: TextoPdf[]): Linha[] {
  const grupos: Linha[] = []
  for (const t of [...textos].sort(
    (a, b) => a.pagina - b.pagina || b.y - a.y || a.x - b.x,
  )) {
    const ultima = grupos[grupos.length - 1]
    if (ultima && ultima.pagina === t.pagina && Math.abs(ultima.y - t.y) <= 3)
      ultima.itens.push(t)
    else grupos.push({ pagina: t.pagina, y: t.y, itens: [t] })
  }
  for (const l of grupos) l.itens.sort((a, b) => a.x - b.x)
  return grupos
}

// O título de coluna mais perto (pelo centro) de cada texto.
function maisPerto(titulos: TextoPdf[], t: TextoPdf): TextoPdf {
  return titulos.reduce((melhor, titulo) =>
    Math.abs(centro(titulo) - centro(t)) < Math.abs(centro(melhor) - centro(t))
      ? titulo
      : melhor,
  )
}

const erro = (detalhe: string) =>
  new RegraInvalidaError(
    `Não consegui ler essa folha de pagamento: ${detalhe} Confira se é o PDF do recibo no modelo de sempre.`,
  )

const TITULO_FOLHA = /^(.+?)\s+de\s+(0[1-9]|1[0-2])\/(\d{4})$/

export function lerHolerite(pdf: Buffer): HoleriteLido {
  if (pdf.subarray(0, 5).toString('latin1') !== '%PDF-')
    throw new RegraInvalidaError('O arquivo não é um PDF.')
  let textos: TextoPdf[]
  try {
    textos = textosDoPdf(pdf)
  } catch {
    throw erro('o PDF não tem texto que eu consiga extrair.')
  }
  if (!textos.length)
    throw erro('o PDF não tem texto (pode ser uma imagem escaneada).')

  const todas = linhas(textos)
  const acharTexto = (re: RegExp) => textos.find((t) => re.test(t.texto))
  const linhaDe = (t: TextoPdf) => todas.find((l) => l.itens.includes(t))
  const abaixo = (l: Linha | undefined) =>
    l ? todas[todas.indexOf(l) + 1] : undefined

  // "Folha Mensal de 08/2026"
  const tituloFolha = acharTexto(TITULO_FOLHA)
  if (!tituloFolha)
    throw erro('não achei a competência (como “Folha Mensal de 08/2026”).')
  const [, tipo = '', mesCompetencia, anoCompetencia] = tituloFolha.texto.match(
    TITULO_FOLHA,
  ) as RegExpMatchArray

  // Empresa, razão social e CNPJ na mesma linha; funcionário, matrícula e cargo na linha de baixo.
  const cnpj = acharTexto(/CNPJ/i)
  const linhaEmpresa = cnpj ? linhaDe(cnpj) : undefined
  const empresa = linhaEmpresa
    ? linhaEmpresa.itens.filter((t) => t !== cnpj).map((t) => t.texto)
    : []
  const funcionario = abaixo(linhaEmpresa)?.itens.map((t) => t.texto) ?? []

  // Tabela de itens: entre o cabeçalho (Cód, Descrição, Hrs/Qtde, Vencimentos, Descontos) e o rodapé de totais.
  const cabecalho = todas.find((l) => {
    const nomes = l.itens.map((t) => semAcento(t.texto))
    return nomes.includes('vencimentos') && nomes.includes('descontos')
  })
  if (!cabecalho) throw erro('não achei a tabela de vencimentos e descontos.')
  const tituloDe = (l: Linha, re: RegExp) =>
    l.itens.find((t) => re.test(semAcento(t.texto)))
  const colunas = {
    referencia: tituloDe(cabecalho, /^(hrs|qtd|ref)/),
    vencimento: tituloDe(cabecalho, /^vencimentos$/),
    desconto: tituloDe(cabecalho, /^descontos$/),
  }
  const titulosColunas = Object.values(colunas).filter((t): t is TextoPdf =>
    Boolean(t),
  )
  const colunaDescricao = tituloDe(cabecalho, /^descri/)

  const rodape = todas.find((l) =>
    l.itens.some((t) => /^total venc/.test(semAcento(t.texto))),
  )
  if (!rodape)
    throw erro('não achei os totais (Total Venctos e Total Descontos).')

  const itens = todas
    .filter(
      (l) =>
        l.pagina === cabecalho.pagina &&
        l.y < cabecalho.y &&
        l.y > rodape.y &&
        /^\d+$/.test(l.itens[0]?.texto ?? ''),
    )
    .map((l) => {
      const [codigo, ...resto] = l.itens as [TextoPdf, ...TextoPdf[]]
      const item: ItemHolerite = {
        codigo: codigo.texto,
        descricao: '',
        referencia: null,
        vencimento: 0,
        desconto: 0,
      }
      const descricao: string[] = []
      for (const t of resto) {
        const ehValor =
          NUMERO.test(t.texto) &&
          (!colunaDescricao || t.x > colunaDescricao.x + 120)
        if (!ehValor) {
          descricao.push(t.texto)
          continue
        }
        const coluna = maisPerto(titulosColunas, t)
        if (coluna === colunas.referencia) item.referencia = t.texto
        else if (coluna === colunas.vencimento)
          item.vencimento = centavos(t.texto)
        else item.desconto = centavos(t.texto)
      }
      item.descricao = descricao.join(' ')
      return item
    })
  if (!itens.length)
    throw erro('a tabela de vencimentos e descontos está vazia.')

  // Totais: cada valor da linha de baixo vai para o título mais perto.
  const totais: Partial<
    Record<
      | 'salarioMensal'
      | 'baseInss'
      | 'baseIrrf'
      | 'fgts'
      | 'totalVencimentos'
      | 'totalDescontos',
      number
    >
  > = {}
  const chaves: [RegExp, keyof typeof totais][] = [
    [/^salario/, 'salarioMensal'],
    [/^base inss/, 'baseInss'],
    [/^base irrf/, 'baseIrrf'],
    [/^fgts/, 'fgts'],
    [/^total venc/, 'totalVencimentos'],
    [/^total desc/, 'totalDescontos'],
  ]
  for (const t of abaixo(rodape)?.itens.filter((x) => NUMERO.test(x.texto)) ??
    []) {
    const titulo = maisPerto(rodape.itens, t)
    const chave = chaves.find(([re]) => re.test(semAcento(titulo.texto)))
    if (chave) totais[chave[1]] = centavos(t.texto)
  }
  const { totalVencimentos, totalDescontos } = totais
  if (totalVencimentos == null || totalDescontos == null)
    throw erro('não achei os totais.')

  // Líquido: o valor logo abaixo do título "Líquido".
  const tituloLiquido = acharTexto(/^l[ií]quido$/i)
  const valorLiquido = tituloLiquido
    ? (abaixo(linhaDe(tituloLiquido))?.itens.filter((t) =>
        NUMERO.test(t.texto),
      ) ?? [])
    : []
  if (!tituloLiquido || !valorLiquido.length)
    throw erro('não achei o valor líquido.')
  const liquido = centavos(maisPerto(valorLiquido, tituloLiquido).texto)

  // Conferência: os itens precisam fechar com os totais e o líquido.
  const soma = (campo: 'vencimento' | 'desconto') =>
    itens.reduce((s, x) => s + x[campo], 0)
  if (
    soma('vencimento') !== totalVencimentos ||
    soma('desconto') !== totalDescontos
  ) {
    throw erro('a soma dos itens não bate com os totais.')
  }
  if (totalVencimentos - totalDescontos !== liquido)
    throw erro('vencimentos menos descontos não dá o líquido.')

  // Conta do depósito e data do recibo.
  const conta = acharTexto(/conta\s*:/i)
  const agencia = acharTexto(/ag[eê]ncia\s*:/i)
  const banco = agencia
    ? linhaDe(agencia)?.itens.find(
        (t) => t.x < agencia.x && !NUMERO.test(t.texto),
      )
    : undefined
  const dataRecibo = textos
    .filter((t) => /^\d{2}\/\d{2}\/\d{4}$/.test(t.texto))
    .pop()
  const valorDepois = (t: TextoPdf | undefined) =>
    t ? t.texto.split(':').slice(1).join(':').trim() || null : null

  return {
    tipo: tipo.trim(),
    competencia: `${anoCompetencia}-${mesCompetencia}`,
    empresa: empresa[0] ?? '',
    razaoSocial: empresa[1] ?? '',
    cnpj: cnpj ? cnpj.texto.replace(/^CNPJ:?\s*/i, '') : '',
    funcionario: funcionario[0] ?? '',
    matricula: funcionario[1] ?? '',
    cargo: funcionario[2] ?? '',
    itens,
    salarioMensal: totais.salarioMensal ?? 0,
    baseInss: totais.baseInss ?? 0,
    baseIrrf: totais.baseIrrf ?? 0,
    fgts: totais.fgts ?? 0,
    totalVencimentos,
    totalDescontos,
    liquido,
    banco: banco?.texto ?? null,
    agencia: valorDepois(agencia),
    conta: valorDepois(conta),
    pagoEm: dataRecibo ? dataRecibo.texto.split('/').reverse().join('-') : null,
  }
}
