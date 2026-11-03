import { NaoEncontradoError } from '../../core/errors'
import type { LancamentosRepository } from '../../repositories/lancamentos-repository'

// Marca (ou desmarca, com pagoEm null) a conta de um mês como paga.
export class MarcarValorMesPagoUseCase {
  constructor(private readonly lancamentos: LancamentosRepository) {}

  execute(input: { despesaId: number; mes: string; pagoEm: string | null }) {
    if (!this.lancamentos.despesa(input.despesaId))
      throw new NaoEncontradoError()
    if (
      !this.lancamentos.marcarValorMesPago(
        input.despesaId,
        input.mes,
        input.pagoEm,
      )
    ) {
      throw new NaoEncontradoError('Essa conta não existe neste mês.')
    }
  }
}
