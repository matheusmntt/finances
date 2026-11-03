import { NaoEncontradoError } from '../../core/errors'
import type { LancamentosRepository } from '../../repositories/lancamentos-repository'

export class RemoverEntradaUseCase {
  constructor(private readonly lancamentos: LancamentosRepository) {}

  execute(id: number) {
    if (!this.lancamentos.removerEntrada(id))
      throw new NaoEncontradoError('Entrada não encontrada.')
  }
}
