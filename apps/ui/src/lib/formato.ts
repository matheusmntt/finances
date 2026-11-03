// Formatação de valores, datas e textos usados em todas as telas.

const moeda = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
})
const moedaInteira = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  maximumFractionDigits: 0,
})
const numero = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 })
const formatoCampo = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

// Valores sempre em centavos.
export const reais = (centavos: number | null | undefined) =>
  moeda.format((centavos ?? 0) / 100)
export const reaisInteiros = (centavos: number) =>
  moedaInteira.format(Math.round(centavos / 100))

// Valores redondos para eixos: "R$ 40 mil", "R$ 500".
export function reaisCurto(centavos: number) {
  const valor = centavos / 100
  if (Math.abs(valor) >= 1000) return `R$ ${numero.format(valor / 1000)} mil`
  return `R$ ${numero.format(valor)}`
}

export const plural = (n: number, singular: string, varios: string) =>
  `${n} ${n === 1 ? singular : varios}`

// ["luz", "internet", "faxina"] -> "luz, internet e faxina"
export function juntar(lista: string[]) {
  if (lista.length <= 1) return lista.join('')
  return `${lista.slice(0, -1).join(', ')} e ${lista[lista.length - 1]}`
}

export const semAcento = (texto: string) =>
  texto
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()

const PALAVRAS_MINUSCULAS = new Set(['de', 'da', 'do', 'das', 'dos', 'e', 'em'])
const SIGLAS = new Set(['br', 'rs', 'prf', 'dnit', 'cnh'])

// "DIRIGE SEM CNH" -> "Dirige sem CNH"
export const titulo = (texto: string) =>
  texto
    .toLowerCase()
    .split(' ')
    .map((palavra, i) => {
      if (/\d/.test(palavra) || SIGLAS.has(palavra.replace(/\W/g, '')))
        return palavra.toUpperCase()
      if (i > 0 && PALAVRAS_MINUSCULAS.has(palavra)) return palavra
      return palavra.replace(/\p{L}/u, (letra) => letra.toUpperCase())
    })
    .join(' ')
    .replace(/-(\p{L}{2})$/u, (_, uf: string) => `-${uf.toUpperCase()}`)

// ---------- Datas ----------

const DIA = 86_400_000

export function hoje() {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

// "AAAA-MM-DD" de hoje, no fuso local.
export function isoHoje() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export const mesAtual = () => isoHoje().slice(0, 7)

// "23/10/2026" -> Date
export function dataBr(ddmmaaaa: string) {
  const [d, m, a] = ddmmaaaa.split('/').map(Number) as [number, number, number]
  return new Date(a, m - 1, d)
}

export const diasAte = (ddmmaaaa: string) =>
  Math.round((dataBr(ddmmaaaa).getTime() - hoje().getTime()) / DIA)

export const isoParaBr = (iso: string) => iso.split('-').reverse().join('/')
export const brParaIso = (br: string | null | undefined) =>
  br ? br.split('/').reverse().join('-') : ''

// Meses de "2026-10" até "2027-05" -> 7
export function diferencaMeses(de: string, ate: string) {
  const [a1, m1] = de.split('-').map(Number) as [number, number]
  const [a2, m2] = ate.split('-').map(Number) as [number, number]
  return (a2 - a1) * 12 + (m2 - m1)
}

export function proximoMes(mes: string) {
  let [a, m] = mes.split('-').map(Number) as [number, number]
  m++
  if (m > 12) {
    m = 1
    a++
  }
  return `${a}-${String(m).padStart(2, '0')}`
}

const NOMES_MESES = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
]

// "2026-10" -> "outubro de 2026"
export function nomeMes(mes: string) {
  const [a, m] = mes.split('-').map(Number) as [number, number]
  return `${NOMES_MESES[m - 1]} de ${a}`
}

// "2026-10" -> "out/26"
export function mesCurto(mes: string) {
  const [a, m] = mes.split('-').map(Number) as [number, number]
  return `${NOMES_MESES[m - 1]?.slice(0, 3)}/${String(a).slice(2)}`
}

// ---------- Campos de valor ----------

// 150000 -> "1.500,00"
export const formatarCampo = (centavos: number | null | undefined) =>
  centavos == null ? '' : formatoCampo.format(centavos / 100)

// "1.500,00", "1500", "1500,5" ou "1500.50" -> centavos. null se não for um valor.
export function lerReais(texto: string | null | undefined): number | null {
  let limpo = String(texto ?? '').replace(/[R$\s]/g, '')
  if (!limpo) return null
  if (limpo.includes(',')) limpo = limpo.replace(/\./g, '').replace(',', '.')
  else if (
    !(/\.\d{1,2}$/.test(limpo) && (limpo.match(/\./g) ?? []).length === 1)
  )
    limpo = limpo.replace(/\./g, '')
  if (!/^\d+(\.\d{0,2})?$/.test(limpo)) return null
  return Math.round(Number(limpo) * 100)
}

// Como lerReais, aceitando sinal: "-300" ou "−300" -> -30000; vazio -> 0.
export function lerReaisComSinal(texto: string): number | null {
  const limpo = texto.trim()
  if (!limpo) return 0
  const negativo = /^[-−]/.test(limpo)
  const valor = lerReais(limpo.replace(/^[-−+]\s*/, ''))
  if (valor == null) return null
  return negativo ? -valor : valor
}
