import { NaoEncontradoError } from '../../core/errors'
import type { LancamentosRepository } from '../../repositories/lancamentos-repository'

// Algo que a Greici e o André pagaram por você fora das contas mensais: entra na dívida.
export class CriarEmprestimoUseCase {
  constructor(private readonly lancamentos: LancamentosRepository) {}

  execute(input: {
    mes: string
    descricao: string
    valor: number
    categoriaDivida: string
    origem: string | null
  }) {
    if (!this.lancamentos.categoriaExiste(input.categoriaDivida))
      throw new NaoEncontradoError('Categoria não encontrada.')
    this.lancamentos.criarEmprestimo({
      ...input,
      origem: input.origem ?? 'Outros valores pagos por eles',
    })
  }
}
