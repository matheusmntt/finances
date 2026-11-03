import { ConflitoError, RegraInvalidaError } from '../../core/errors'
import { chaveTexto } from '../../core/validacao'
import type { BackofficeRepository } from '../../repositories/backoffice-repository'
import type { LancamentosRepository } from '../../repositories/lancamentos-repository'
import { entidade } from './entidade'
import type { Entidade } from './entidades'
import { validarCampos } from './validar-campos'

// "Saúde & Bem-estar" -> "saude-bem-estar"
export function slug(texto: string) {
  return (
    texto
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'item'
  )
}

export class CriarRegistroUseCase {
  constructor(
    private readonly backoffice: BackofficeRepository,
    private readonly lancamentos: LancamentosRepository,
  ) {}

  execute(nome: string, corpo: Record<string, unknown>) {
    const e = entidade(nome)
    if (!e.criar)
      throw new RegraInvalidaError(
        'Não dá para adicionar registros nessa tabela.',
      )
    const campos = Object.fromEntries(
      e.criar.campos.map((c) => [c, e.campos[c]]).filter(([, c]) => c),
    )
    const enviados = Object.fromEntries(
      e.criar.campos.map((c) => [c, corpo[c]]),
    )
    const { valores } = validarCampos(campos, enviados, this.lancamentos, {
      exigirTodos: true,
    })

    const chaveNova = this.chaveNova(e, corpo, valores)
    if (chaveNova !== undefined)
      valores[e.coluna.name === 'codigo' ? 'codigo' : 'id'] = chaveNova
    if ('ordem' in e.campos)
      valores.ordem = this.backoffice.proximaOrdem(e.tabela)
    Object.assign(valores, e.criar.fixos)
    this.backoffice.inserir(e.tabela, valores)
  }

  private chaveNova(
    e: Entidade,
    corpo: Record<string, unknown>,
    valores: Record<string, unknown>,
  ) {
    if (e.criar?.chave === 'slug') {
      const base = slug(String(valores.nome))
      let candidata = base
      for (
        let i = 2;
        this.backoffice.existe(e.coluna, e.tabela, candidata);
        i++
      )
        candidata = `${base}-${i}`
      return candidata
    }
    if (e.criar?.chave === 'codigo') {
      const codigo = typeof corpo.codigo === 'string' ? corpo.codigo.trim() : ''
      if (!chaveTexto.safeParse(codigo).success) {
        throw new RegraInvalidaError(
          'Informe o código da infração (só letras, números e hífen).',
        )
      }
      if (this.backoffice.existe(e.coluna, e.tabela, codigo))
        throw new ConflitoError('Já existe uma infração com esse código.')
      return codigo
    }
    return undefined
  }
}
