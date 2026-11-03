// Meses no formato AAAA-MM.
export function proximosMeses(inicio: string, quantidade: number): string[] {
  const [ano, mes] = inicio.split('-').map(Number) as [number, number]
  return Array.from({ length: quantidade }, (_, i) => {
    const total = ano * 12 + (mes - 1) + i
    return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}`
  })
}

// Quantos meses de inicio a fim, contando os dois.
export function mesesEntre(inicio: string, fim: string): number {
  const [a1, m1] = inicio.split('-').map(Number) as [number, number]
  const [a2, m2] = fim.split('-').map(Number) as [number, number]
  return (a2 - a1) * 12 + (m2 - m1) + 1
}

// "2026-10" -> "10/2026"
export const mesBr = (mes: string) => `${mes.slice(5)}/${mes.slice(0, 4)}`

export function mesAtual(hoje = new Date()): string {
  return `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`
}
