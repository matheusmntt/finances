import { NaoEncontradoError } from '../../core/errors'
import type { HoleritesRepository } from '../../repositories/holerites-repository'

export class RemoverHoleriteUseCase {
  constructor(private readonly holerites: HoleritesRepository) {}

  execute(id: number) {
    if (!this.holerites.remover(id))
      throw new NaoEncontradoError('Folha de pagamento não encontrada.')
  }
}
