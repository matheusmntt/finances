import { NaoEncontradoError, RegraInvalidaError } from '../../core/errors'
import type { BackofficeRepository } from '../../repositories/backoffice-repository'
import { chave, entidade } from './entidade'

export class RemoverRegistroUseCase {
  constructor(private readonly backoffice: BackofficeRepository) {}

  execute(nome: string, valorChave: string) {
    const e = entidade(nome)
    if (!e.remover)
      throw new RegraInvalidaError(
        'Não dá para remover registros dessa tabela.',
      )
    const k = chave(e, valorChave)

    if (e.remover === 'grupo-sem-despesas') {
      const n = this.backoffice.despesasNoGrupo(String(k))
      if (n) {
        throw new RegraInvalidaError(
          `Esse grupo tem ${n} ${n === 1 ? 'despesa' : 'despesas'}. Mude o grupo delas antes de remover.`,
        )
      }
    }
    if (
      e.remover === 'categoria-sem-uso' &&
      this.backoffice.usosDaCategoria(String(k))
    ) {
      throw new RegraInvalidaError(
        'Essa categoria está em uso (despesas, valores pagos por eles ou configurações).',
      )
    }
    // Custos com chave (CRLV, pátio, guias) voltariam com o importador no próximo início.
    if (
      e.remover === 'custo-sem-chave' &&
      this.backoffice.chaveDoCusto(Number(k))
    ) {
      throw new RegraInvalidaError(
        'CRLV e pátio voltariam no próximo deploy. Para tirar da conta, zere o valor.',
      )
    }

    if (!this.backoffice.remover(e.tabela, e.coluna, k))
      throw new NaoEncontradoError()
  }
}
