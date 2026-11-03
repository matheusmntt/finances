// Pedaços de texto e leituras usados em várias partes da aba Projeção.
import type { Calculo } from '@/domain/calculo'
import { diferencaMeses, mesCurto, plural } from '@/lib/formato'

export const soma = (lista: number[]) => lista.reduce((t, v) => t + (v || 0), 0)

// 0.0085 -> "0,85%"
export const percentual = (fracao: number) =>
  `${(fracao * 100).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`

// "daqui a 3 meses", "este mês" ou nada (mês que já passou).
export function daquiA(mesAtual: string, mes: string) {
  const n = diferencaMeses(mesAtual, mes)
  return n > 0
    ? `daqui a ${plural(n, 'mês', 'meses')}`
    : n === 0
      ? 'este mês'
      : ''
}

// Meses seguidos viram faixas: ["2026-11", "2026-12", "2027-03"] -> ["nov/26 a dez/26", "mar/27"].
export function faixas(c: Calculo, meses: string[]) {
  const grupos: [number, number][] = []
  for (const mes of meses) {
    const i = c.indice.get(mes) as number
    const g = grupos[grupos.length - 1]
    if (g && g[1] === i - 1) g[1] = i
    else grupos.push([i, i])
  }
  const nome = (i: number) => mesCurto(c.meses[i] as string)
  return grupos.map(([a, b]) => (a === b ? nome(a) : `${nome(a)} a ${nome(b)}`))
}

// Taxa do CDB em % ao mês ("0,85") -> fração; vazio -> null (a do plano); inválida -> undefined.
export function lerTaxa(texto: string) {
  const limpo = texto.trim().replace('%', '')
  if (!limpo) return null
  const numero = Number(
    limpo.includes(',') ? limpo.replace(/\./g, '').replace(',', '.') : limpo,
  )
  return Number.isFinite(numero) && numero >= 0 && numero <= 20
    ? Number((numero / 100).toFixed(8))
    : undefined
}
