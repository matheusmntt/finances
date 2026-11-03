import { NaoEncontradoError } from '../../core/errors'
import type { CarroRepository } from '../../repositories/carro-repository'

export class MarcarCustoPagoUseCase {
  constructor(private readonly carro: CarroRepository) {}

  execute(id: number, pagoEm: string | null) {
    if (!this.carro.marcarCustoPago(id, pagoEm))
      throw new NaoEncontradoError('Custo não encontrado.')
  }
}
