import type {
  LancamentosRepository,
  NovaEntrada,
} from '../../repositories/lancamentos-repository'

export class CriarEntradaUseCase {
  constructor(private readonly lancamentos: LancamentosRepository) {}

  execute(input: NovaEntrada) {
    this.lancamentos.criarEntrada(input)
  }
}
