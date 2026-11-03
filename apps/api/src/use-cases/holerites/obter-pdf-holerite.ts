import { NaoEncontradoError } from '../../core/errors'
import type { Pdf } from '../../repositories/carro-repository'
import type { HoleritesRepository } from '../../repositories/holerites-repository'

export class ObterPdfHoleriteUseCase {
  constructor(private readonly holerites: HoleritesRepository) {}

  execute(id: number): Pdf {
    const pdf = this.holerites.pdf(id)
    if (!pdf) throw new NaoEncontradoError('Folha de pagamento não encontrada.')
    return pdf
  }
}
