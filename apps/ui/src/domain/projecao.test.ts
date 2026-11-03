import { describe, expect, it } from 'vitest'
import { aliquota, indiceLivre, investir } from './projecao'

describe('aliquota', () => {
  it('segue a tabela regressiva do IR', () => {
    expect([1, 6, 7, 12, 13, 24, 25].map(aliquota)).toEqual([
      0.225, 0.225, 0.2, 0.2, 0.175, 0.175, 0.15,
    ])
  })
})

describe('indiceLivre', () => {
  const linhas = (faltas: number[]) =>
    faltas.map((faltaDevolver) => ({ faltaDevolver }))

  it('é o mês seguinte à última parcela', () => {
    expect(indiceLivre(linhas([300, 200, 0, 0]))).toBe(2)
  })
  it('é 0 sem dívida e -1 quando não zera', () => {
    expect(indiceLivre(linhas([0, 0]))).toBe(0)
    expect(indiceLivre(linhas([300, 100]))).toBe(-1)
  })
})

describe('investir', () => {
  const meses = ['2026-01', '2026-02', '2026-03']

  it('guarda parado antes do início e aplica tudo no primeiro mês', () => {
    const r = investir(meses, [10000, 10000, 0], 0.01, '2026-02')
    expect(r[0]).toEqual({ guardado: 10000, rendimento: 0, ir: 0 })
    // 20000 aplicados rendem 1% (200), com 22,5% de IR (45).
    expect(r[1]).toEqual({ guardado: 20155, rendimento: 200, ir: 45 })
  })

  it('mês no vermelho resgata dos lotes e pode ficar descoberto', () => {
    const r = investir(meses, [10000, -15000, 0], 0, '2026-01')
    expect(r[1]?.guardado).toBe(-5000)
    expect(r[2]?.guardado).toBe(-5000)
  })
})
