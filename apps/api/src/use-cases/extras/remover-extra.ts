import { NaoEncontradoError } from '../../core/errors'
import type { LancamentosRepository } from '../../repositories/lancamentos-repository'

export class RemoverExtraUseCase {
  constructor(private readonly lancamentos: LancamentosRepository) {}

  execute(id: number) {
    if (!this.lancamentos.removerExtra(id))
      throw new NaoEncontradoError('Extra não encontrado.')
  }
}
