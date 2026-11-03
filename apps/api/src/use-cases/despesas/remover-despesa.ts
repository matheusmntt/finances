import { NaoEncontradoError, NaoPermitidoError } from '../../core/errors'
import type { LancamentosRepository } from '../../repositories/lancamentos-repository'

// Só as despesas criadas pelo app saem pela aba Mês (as da planilha saem pelo Backoffice).
export class RemoverDespesaUseCase {
  constructor(private readonly lancamentos: LancamentosRepository) {}

  execute(despesaId: number) {
    const despesa = this.lancamentos.despesa(despesaId)
    if (!despesa) throw new NaoEncontradoError()
    if (!despesa.criadaPeloUsuario) {
      throw new NaoPermitidoError(
        'Só dá para remover despesas criadas pelo app. As da planilha ficam no plano.',
      )
    }
    this.lancamentos.removerDespesa(despesaId)
  }
}
