import { NaoEncontradoError } from '../../core/errors'
import type { LancamentosRepository } from '../../repositories/lancamentos-repository'

export class RemoverEmprestimoUseCase {
  constructor(private readonly lancamentos: LancamentosRepository) {}

  execute(id: number) {
    if (!this.lancamentos.removerEmprestimo(id)) throw new NaoEncontradoError()
  }
}
