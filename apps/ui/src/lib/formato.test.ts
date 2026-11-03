import { describe, expect, it } from 'vitest'
import {
  diferencaMeses,
  formatarCampo,
  lerReais,
  lerReaisComSinal,
  mesCurto,
  nomeMes,
  proximoMes,
} from './formato'

describe('lerReais', () => {
  it.each([
    ['1.500,00', 150000],
    ['1500', 150000],
    ['1500,5', 150050],
    ['1500.50', 150050],
    ['R$ 4.750,00', 475000],
    ['1.500', 150000],
    ['0', 0],
  ])('%s -> %i centavos', (texto, centavos) => {
    expect(lerReais(texto)).toBe(centavos)
  })

  it.each(['', 'abc', '1,2,3', '10,999'])('%s não é um valor', (texto) => {
    expect(lerReais(texto)).toBeNull()
  })

  it('aceita sinal e trata vazio como zero', () => {
    expect(lerReaisComSinal('-300')).toBe(-30000)
    expect(lerReaisComSinal('−300,50')).toBe(-30050)
    expect(lerReaisComSinal('+20')).toBe(2000)
    expect(lerReaisComSinal('')).toBe(0)
    expect(lerReaisComSinal('x')).toBeNull()
  })

  it('volta ao texto do campo', () => {
    expect(formatarCampo(150000)).toBe('1.500,00')
    expect(formatarCampo(null)).toBe('')
  })
})

describe('meses', () => {
  it('avança e conta meses na virada do ano', () => {
    expect(proximoMes('2026-12')).toBe('2027-01')
    expect(diferencaMeses('2026-11', '2027-02')).toBe(3)
  })

  it('escreve o nome do mês', () => {
    expect(nomeMes('2026-03')).toBe('março de 2026')
    expect(mesCurto('2026-10')).toBe('out/26')
  })
})
