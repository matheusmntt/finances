import type {
  LancamentosRepository,
  NovaEntrada,
} from '../../repositories/lancamentos-repository'

// Gasto avulso de um mês.
export class CriarExtraUseCase {
  constructor(private readonly lancamentos: LancamentosRepository) {}

  execute(input: NovaEntrada) {
    this.lancamentos.criarExtra(input)
  }
}
