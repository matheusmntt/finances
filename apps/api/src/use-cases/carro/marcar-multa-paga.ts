import { NaoEncontradoError } from '../../core/errors'
import type { CarroRepository } from '../../repositories/carro-repository'

// Paga pela Greici e pelo André: ao marcar, o valor entra na dívida com eles.
export class MarcarMultaPagaUseCase {
  constructor(private readonly carro: CarroRepository) {}

  execute(serie: string, pagoEm: string | null) {
    if (!this.carro.marcarMultaPaga(serie, pagoEm))
      throw new NaoEncontradoError('Multa não encontrada.')
  }
}
