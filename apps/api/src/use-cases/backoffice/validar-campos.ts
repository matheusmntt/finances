import { NaoEncontradoError, RegraInvalidaError } from '../../core/errors'
import { primeiraMensagem } from '../../core/validacao'
import type { LancamentosRepository } from '../../repositories/lancamentos-repository'
import type { Campo } from './entidades'

// Valida os campos enviados contra a especificação: só campos conhecidos, cada um no seu formato, e
// referências (grupo, categoria) que existem. Diz também se algum campo é do importador de boletos.
export function validarCampos(
  campos: Record<string, Campo>,
  corpo: Record<string, unknown>,
  lancamentos: LancamentosRepository,
  { exigirTodos = false } = {},
) {
  const pares = Object.entries(corpo)
  if (!pares.length) throw new RegraInvalidaError('Nada para salvar.')
  const valores: Record<string, unknown> = {}
  let importado = false
  for (const [nome, bruto] of pares) {
    const campo = campos[nome]
    if (!campo) throw new RegraInvalidaError(`Campo desconhecido: ${nome}.`)
    const resultado = campo.esquema.safeParse(bruto)
    if (!resultado.success)
      throw new RegraInvalidaError(primeiraMensagem(resultado.error))
    const valor = resultado.data
    if (
      campo.referencia === 'grupo' &&
      !lancamentos.grupoExiste(String(valor))
    ) {
      throw new NaoEncontradoError('Grupo não encontrado.')
    }
    if (
      campo.referencia === 'categoria' &&
      valor != null &&
      !lancamentos.categoriaExiste(String(valor))
    ) {
      throw new NaoEncontradoError('Categoria da dívida não encontrada.')
    }
    valores[nome] = valor
    importado ||= Boolean(campo.importado)
  }
  if (exigirTodos) {
    const faltando = Object.keys(campos).find((nome) => !(nome in valores))
    if (faltando) throw new RegraInvalidaError(`Informe ${faltando}.`)
  }
  return { valores, importado }
}
