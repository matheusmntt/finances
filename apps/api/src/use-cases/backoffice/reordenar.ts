import { RegraInvalidaError } from '../../core/errors'
import type { BackofficeRepository } from '../../repositories/backoffice-repository'
import { chave, entidade } from './entidade'

// Nova ordem de uma tabela (arrastar e soltar): cada chave recebe a posição dela na lista, numa transação só.
export class ReordenarUseCase {
  constructor(private readonly backoffice: BackofficeRepository) {}

  execute(nome: string, chaves: string[]) {
    const e = entidade(nome)
    if (!e.campos.ordem)
      throw new RegraInvalidaError('Essa tabela não tem ordem.')
    if (new Set(chaves).size !== chaves.length)
      throw new RegraInvalidaError('A lista tem registros repetidos.')
    const ks = chaves.map((valor) => chave(e, valor))
    this.backoffice.transacao(() => {
      ks.forEach((k, i) => {
        this.backoffice.atualizar(e.tabela, e.coluna, k, { ordem: i + 1 })
      })
    })
  }
}
