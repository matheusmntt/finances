// Extrai o texto de um PDF simples, sem dependências: cada trecho de texto com a posição na página.
// Funciona com PDFs gerados por sistemas (fontes padrão, streams FlateDecode), como os recibos de pagamento.
import { inflateSync } from 'node:zlib'

export type TextoPdf = {
  pagina: number
  x: number
  y: number
  tamanho: number
  texto: string
}

// WinAnsiEncoding: o que difere do latin1 entre 0x80 e 0x9F.
const WIN_ANSI: Record<number, string> = {
  128: '€',
  130: '‚',
  131: 'ƒ',
  132: '„',
  133: '…',
  134: '†',
  135: '‡',
  136: 'ˆ',
  137: '‰',
  138: 'Š',
  139: '‹',
  140: 'Œ',
  142: 'Ž',
  145: '‘',
  146: '’',
  147: '“',
  148: '”',
  149: '•',
  150: '–',
  151: '—',
  152: '˜',
  153: '™',
  154: 'š',
  155: '›',
  156: 'œ',
  158: 'ž',
  159: 'Ÿ',
}

const decodificar = (bytes: number[]) =>
  bytes.map((b) => WIN_ANSI[b] ?? String.fromCharCode(b)).join('')

type Objeto = { dicionario: string; dados: Buffer | null }

// Objetos "N 0 obj ... endobj" com o dicionário e o conteúdo do stream (já descompactado).
function objetos(pdf: Buffer): Map<number, Objeto> {
  const bruto = pdf.toString('latin1') // um caractere por byte: os índices valem para o Buffer
  const lista = new Map<number, Objeto>()
  const re = /(\d+)\s+\d+\s+obj\b/g
  for (let m = re.exec(bruto); m; m = re.exec(bruto)) {
    const fim = bruto.indexOf('endobj', re.lastIndex)
    if (fim < 0) break
    const corpo = bruto.slice(re.lastIndex, fim)
    const inicioStream = corpo.search(/stream\r?\n/)
    let dados: Buffer | null = null
    let dicionario = corpo
    if (inicioStream >= 0) {
      dicionario = corpo.slice(0, inicioStream)
      const abertura = (
        corpo.slice(inicioStream).match(/^stream\r?\n/) as RegExpMatchArray
      )[0].length
      const ini = re.lastIndex + inicioStream + abertura
      const fimStream = bruto.lastIndexOf('endstream', fim)
      dados = pdf.subarray(ini, fimStream)
      if (/\/FlateDecode/.test(dicionario)) {
        try {
          dados = inflateSync(dados)
        } catch {
          dados = null
        }
      }
    }
    lista.set(Number(m[1]), { dicionario, dados })
    re.lastIndex = fim
  }
  return lista
}

// Conteúdo de cada página, na ordem em que aparecem no arquivo.
function conteudosDasPaginas(pdf: Buffer): Buffer[] {
  const lista = objetos(pdf)
  const paginas: Buffer[] = []
  for (const { dicionario } of lista.values()) {
    if (!/\/Type\s*\/Page(?![a-zA-Z])/.test(dicionario)) continue
    const unico = dicionario.match(/\/Contents\s+(\d+)\s+\d+\s+R/)
    const varios = dicionario.match(/\/Contents\s*\[([^\]]*)\]/)
    const refs = unico
      ? [unico[1]]
      : varios
        ? [...(varios[1] ?? '').matchAll(/(\d+)\s+\d+\s+R/g)].map((r) => r[1])
        : []
    const partes = refs
      .map((r) => lista.get(Number(r))?.dados)
      .filter((d): d is Buffer => Boolean(d))
    paginas.push(Buffer.concat(partes))
  }
  return paginas
}

type Item = number | string | { bytes: number[] } | { lista: Item[] } | '['

const ESCAPES: Record<string, number> = { n: 10, r: 13, t: 9, b: 8, f: 12 }

// Lê os operadores de texto do conteúdo de uma página (BT/ET, Tm, Td, TD, T*, Tf, Tj, TJ, ' e ").
function textosDaPagina(conteudo: Buffer, pagina: number): TextoPdf[] {
  const c = conteudo.toString('latin1')
  const textos: TextoPdf[] = []
  const pilha: Item[] = []
  let matriz = [1, 0, 0, 1, 0, 0]
  let linha = [1, 0, 0, 1, 0, 0]
  let tamanho = 0
  let entrelinha = 0

  const mover = (tx: number, ty: number) => {
    const [a, b, cc, d, e, f] = linha as [
      number,
      number,
      number,
      number,
      number,
      number,
    ]
    linha = [a, b, cc, d, e + tx * a + ty * cc, f + tx * b + ty * d]
    matriz = linha.slice()
  }
  const escrever = (bytes: number[]) => {
    const texto = decodificar(bytes)
    if (texto.trim()) {
      textos.push({
        pagina,
        x: matriz[4] as number,
        y: matriz[5] as number,
        tamanho: tamanho * Math.abs((matriz[3] as number) || 1),
        texto: texto.trim(),
      })
    }
  }
  const bytesDe = (item: Item | undefined) =>
    item && typeof item === 'object' && 'bytes' in item ? item.bytes : null
  const num = (k: number) => Number(pilha[pilha.length - k])

  let i = 0
  while (i < c.length) {
    const ch = c[i] as string
    if (/\s/.test(ch)) {
      i++
    } else if (ch === '%') {
      while (i < c.length && c[i] !== '\n' && c[i] !== '\r') i++
    } else if (ch === '(') {
      // String literal com parênteses balanceados e escapes.
      const bytes: number[] = []
      let nivel = 1
      i++
      while (i < c.length && nivel > 0) {
        const atual = c[i] as string
        if (atual === '\\') {
          const prox = c[i + 1] ?? ''
          if (prox in ESCAPES) {
            bytes.push(ESCAPES[prox] as number)
            i += 2
          } else if (/[0-7]/.test(prox)) {
            const octal = (
              c.slice(i + 1, i + 4).match(/^[0-7]{1,3}/) as RegExpMatchArray
            )[0]
            bytes.push(Number.parseInt(octal, 8) & 0xff)
            i += 1 + octal.length
          } else if (prox === '\r' || prox === '\n') {
            i += prox === '\r' && c[i + 2] === '\n' ? 3 : 2
          } else {
            bytes.push(prox.charCodeAt(0))
            i += 2
          }
          continue
        }
        if (atual === '(') nivel++
        if (atual === ')' && --nivel === 0) break
        bytes.push(atual.charCodeAt(0))
        i++
      }
      i++
      pilha.push({ bytes })
    } else if (ch === '<' && c[i + 1] !== '<') {
      const fim = c.indexOf('>', i)
      const hex = c.slice(i + 1, fim).replace(/\s/g, '')
      const bytes: number[] = []
      for (let k = 0; k < hex.length; k += 2)
        bytes.push(Number.parseInt(hex.slice(k, k + 2).padEnd(2, '0'), 16))
      pilha.push({ bytes })
      i = fim + 1
    } else if (ch === '[') {
      pilha.push('[')
      i++
    } else if (ch === ']') {
      const itens: Item[] = []
      while (pilha.length && pilha[pilha.length - 1] !== '[')
        itens.unshift(pilha.pop() as Item)
      pilha.pop()
      pilha.push({ lista: itens })
      i++
    } else if ((ch === '<' || ch === '>') && c[i + 1] === ch) {
      i += 2
    } else if (ch === '/') {
      const nome = (
        c.slice(i).match(/^\/[^\s/[\]()<>{}%]*/) as RegExpMatchArray
      )[0]
      pilha.push(nome)
      i += nome.length
    } else if (/[\d.+-]/.test(ch)) {
      const m = c.slice(i).match(/^[+-]?(\d+\.?\d*|\.\d+)/)
      if (!m) {
        i++
        continue
      }
      pilha.push(Number(m[0]))
      i += m[0].length
    } else {
      const m = c.slice(i).match(/^[A-Za-z'"*]+/)
      if (!m) {
        i++
        continue
      }
      const op = m[0]
      i += op.length
      const topo = pilha[pilha.length - 1]
      switch (op) {
        case 'BT':
          matriz = [1, 0, 0, 1, 0, 0]
          linha = matriz.slice()
          break
        case 'Tm':
          matriz = pilha.slice(-6).map(Number)
          linha = matriz.slice()
          break
        case 'Td':
          mover(num(2), num(1))
          break
        case 'TD':
          entrelinha = -num(1)
          mover(num(2), num(1))
          break
        case 'TL':
          entrelinha = num(1)
          break
        case 'T*':
          mover(0, -entrelinha)
          break
        case 'Tf':
          tamanho = num(1)
          break
        case 'Tj': {
          const bytes = bytesDe(topo)
          if (bytes) escrever(bytes)
          break
        }
        case "'":
        case '"': {
          mover(0, -entrelinha)
          const bytes = bytesDe(topo)
          if (bytes) escrever(bytes)
          break
        }
        case 'TJ':
          if (topo && typeof topo === 'object' && 'lista' in topo) {
            escrever(topo.lista.flatMap((x) => bytesDe(x) ?? []))
          }
          break
        case 'BI': {
          // Imagem embutida: pula até o fim dos dados.
          const fim = c.indexOf('EI', i)
          i = fim < 0 ? c.length : fim + 2
          break
        }
        default:
          break
      }
      pilha.length = 0
    }
  }
  return textos
}

export function textosDoPdf(pdf: Buffer): TextoPdf[] {
  return conteudosDasPaginas(pdf).flatMap((conteudo, pagina) =>
    textosDaPagina(conteudo, pagina),
  )
}
