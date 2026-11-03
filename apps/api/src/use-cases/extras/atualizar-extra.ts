import { NaoEncontradoError } from '../../core/errors'
import type { LancamentosRepository } from '../../repositories/lancamentos-repository'

export class AtualizarExtraUseCase {
  constructor(private readonly lancamentos: LancamentosRepository) {}

  // pagoEm: undefined mantém; null desmarca o pagamento.
  execute(
    id: number,
    dados: { descricao?: string; valor?: number; pagoEm?: string | null },
  ) {
    const extra = this.lancamentos.extra(id)
    if (!extra) throw new NaoEncontradoError('Extra não encontrado.')
    this.lancamentos.atualizarExtra(id, {
      descricao: dados.descricao ?? extra.descricao,
      valor: dados.valor ?? extra.valor,
      pagoEm: dados.pagoEm === undefined ? extra.pagoEm : dados.pagoEm,
    })
  }
}
