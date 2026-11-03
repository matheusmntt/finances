import { NaoEncontradoError } from '../../core/errors'
import type { BackofficeRepository } from '../../repositories/backoffice-repository'
import type { LancamentosRepository } from '../../repositories/lancamentos-repository'
import { chave, entidade } from './entidade'
import { validarCampos } from './validar-campos'

export class AtualizarRegistroUseCase {
  constructor(
    private readonly backoffice: BackofficeRepository,
    private readonly lancamentos: LancamentosRepository,
  ) {}

  execute(nome: string, valorChave: string, corpo: Record<string, unknown>) {
    const e = entidade(nome)
    const { valores, importado } = validarCampos(
      e.campos,
      corpo,
      this.lancamentos,
    )
    // Campo que o importador também grava: marca o registro para o importador não sobrescrever mais.
    if (importado) valores.editadoNoApp = true
    if (
      !this.backoffice.atualizar(
        e.tabela,
        e.coluna,
        chave(e, valorChave),
        valores,
      )
    )
      throw new NaoEncontradoError()
  }
}
