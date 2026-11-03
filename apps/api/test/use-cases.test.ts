import { describe, expect, it } from 'vitest'
import { montar } from './montar'

describe('despesas', () => {
  it('cria uma despesa parcelada com o valor em cada mês', () => {
    const { c } = montar()
    const { id } = c.criarDespesa.execute({
      grupoId: 'despesas-fixas',
      nome: 'Academia',
      valor: 9990,
      mesInicio: '2026-11',
      parcelas: 3,
      categoriaDivida: null,
      pagoAosCredores: false,
    })
    const despesa = c.obterEstado.execute().despesas.find((d) => d.id === id)
    expect(Object.keys(despesa?.valores ?? {})).toEqual([
      '2026-11',
      '2026-12',
      '2027-01',
    ])
    expect(despesa?.criadaPeloUsuario).toBe(true)
  })

  it('sem parcelas, vai até o fim do plano', () => {
    const { c } = montar()
    const { planoFim } = c.obterEstado.execute().config
    const { id } = c.criarDespesa.execute({
      grupoId: 'despesas-fixas',
      nome: 'Streaming',
      valor: 2000,
      mesInicio: '2029-11',
      parcelas: null,
      categoriaDivida: null,
      pagoAosCredores: false,
    })
    const meses = Object.keys(
      c.obterEstado.execute().despesas.find((d) => d.id === id)?.valores ?? {},
    )
    expect(meses.at(-1)).toBe(planoFim)
  })

  it('não remove despesa que veio da planilha', () => {
    const { c } = montar()
    const daPlanilha = c.obterEstado
      .execute()
      .despesas.find((d) => !d.criadaPeloUsuario)
    expect(() => c.removerDespesa.execute(daPlanilha?.id ?? 0)).toThrow(
      'Só dá para remover despesas criadas pelo app',
    )
  })
})

describe('importador de boletos', () => {
  it('importa as multas e cada guia do pátio como um custo próprio', () => {
    const { c } = montar()
    const estado = c.obterEstado.execute()
    expect(estado.multas.length).toBeGreaterThan(0)
    expect(
      estado.custosCarro.filter((x) => x.chave?.startsWith('patio')).length,
    ).toBe(2)
  })

  it('não sobrescreve o que foi editado no Backoffice e não duplica nada ao rodar de novo', () => {
    const { c, importar } = montar()
    const serie = c.obterEstado.execute().multas[0]?.serie ?? ''
    c.atualizarRegistro.execute('multas', serie, { valor: 12345 })
    const antes = c.obterEstado.execute()
    importar()
    const depois = c.obterEstado.execute()
    expect(depois.multas.find((m) => m.serie === serie)?.valor).toBe(12345)
    expect(depois.multas.length).toBe(antes.multas.length)
    expect(depois.custosCarro.length).toBe(antes.custosCarro.length)
  })
})

describe('backoffice', () => {
  it('não remove grupo com despesas nem categoria em uso', () => {
    const { c } = montar()
    expect(() => c.removerRegistro.execute('grupos', 'despesas-fixas')).toThrow(
      'Mude o grupo delas antes de remover',
    )
    expect(() =>
      c.removerRegistro.execute('categorias-divida', 'carro'),
    ).toThrow('Essa categoria está em uso')
  })

  it('cria grupo com id a partir do nome e recusa campos desconhecidos', () => {
    const { c } = montar()
    c.criarRegistro.execute('grupos', { nome: 'Saúde & Bem-estar' })
    expect(
      c.obterEstado.execute().grupos.some((g) => g.id === 'saude-bem-estar'),
    ).toBe(true)
    expect(() =>
      c.atualizarRegistro.execute('despesas', '1', { slug: 'x' }),
    ).toThrow('Campo desconhecido: slug.')
  })

  it('reordena uma tabela numa transação só', () => {
    const { c } = montar()
    const ids = c.obterEstado.execute().grupos.map((g) => g.id)
    c.reordenar.execute('grupos', [...ids].reverse())
    expect(c.obterEstado.execute().grupos.map((g) => g.id)).toEqual(
      [...ids].reverse(),
    )
    expect(() => c.reordenar.execute('entradas', ['1'])).toThrow(
      'Essa tabela não tem ordem.',
    )
    expect(() =>
      c.reordenar.execute('grupos', [ids[0] ?? '', ids[0] ?? '']),
    ).toThrow('repetidos')
  })

  it('recusa um plano que termina antes de começar', () => {
    const { c } = montar()
    expect(() => c.atualizarConfig.execute({ planoInicio: '2099-01' })).toThrow(
      'O início do plano precisa ser antes do fim.',
    )
  })
})

describe('login', () => {
  it('bloqueia o IP depois de 10 senhas erradas', () => {
    const { c } = montar()
    for (let i = 0; i < 10; i++)
      expect(() =>
        c.entrar.execute({ senha: 'errada', ip: '1.1.1.1' }),
      ).toThrow('Senha incorreta.')
    expect(() =>
      c.entrar.execute({ senha: 'senha-de-teste', ip: '1.1.1.1' }),
    ).toThrow('Muitas tentativas')
    const { token } = c.entrar.execute({
      senha: 'senha-de-teste',
      ip: '2.2.2.2',
    })
    expect(c.sessoes.valida(token)).toBe(true)
    expect(c.sessoes.valida(`${token}x`)).toBe(false)
  })
})
