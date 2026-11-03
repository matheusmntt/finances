import { NaoEncontradoError } from '../../core/errors'
import { chaveTexto, idNumerico } from '../../core/validacao'
import { ENTIDADES, type Entidade } from './entidades'

export function entidade(nome: string): Entidade {
  const e = Object.hasOwn(ENTIDADES, nome) ? ENTIDADES[nome] : undefined
  if (!e) throw new NaoEncontradoError('Tabela não encontrada.')
  return e
}

// A chave do registro, no tipo da tabela (número ou texto).
export function chave(e: Entidade, valor: string): string | number {
  const resultado = (e.numerica ? idNumerico : chaveTexto).safeParse(valor)
  if (!resultado.success) throw new NaoEncontradoError()
  return resultado.data
}
