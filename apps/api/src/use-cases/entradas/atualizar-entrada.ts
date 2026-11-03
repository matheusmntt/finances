import { NaoEncontradoError } from '../../core/errors'
import type { LancamentosRepository } from '../../repositories/lancamentos-repository'

export class AtualizarEntradaUseCase {
  constructor(private readonly lancamentos: LancamentosRepository) {}

  execute(id: number, dados: { descricao?: string; valor?: number }) {
    const entrada = this.lancamentos.entrada(id)
    if (!entrada) throw new NaoEncontradoError('Entrada não encontrada.')
    this.lancamentos.atualizarEntrada(id, {
      descricao: dados.descricao ?? entrada.descricao,
      valor: dados.valor ?? entrada.valor,
    })
  }
}
