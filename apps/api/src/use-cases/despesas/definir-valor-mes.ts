import { NaoEncontradoError } from '../../core/errors'
import type { LancamentosRepository } from '../../repositories/lancamentos-repository'

// Define o valor de uma despesa num mês (usado ao editar o plano de devolução). Valor 0 tira a parcela do mês.
export class DefinirValorMesUseCase {
  constructor(private readonly lancamentos: LancamentosRepository) {}

  execute(input: { despesaId: number; mes: string; valor: number }) {
    if (!this.lancamentos.despesa(input.despesaId))
      throw new NaoEncontradoError()
    if (input.valor === 0)
      this.lancamentos.removerValorMes(input.despesaId, input.mes)
    else
      this.lancamentos.definirValorMes(input.despesaId, input.mes, input.valor)
  }
}
