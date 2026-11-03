import { NaoEncontradoError } from '../../core/errors'
import { mesesEntre, proximosMeses } from '../../core/meses'
import type { EstadoRepository } from '../../repositories/estado-repository'
import type { LancamentosRepository } from '../../repositories/lancamentos-repository'

export type CriarDespesaInput = {
  grupoId: string
  nome: string
  valor: number // centavos por mês
  mesInicio: string
  // null: todo mês até o fim do plano.
  parcelas: number | null
  categoriaDivida: string | null
  pagoAosCredores: boolean
}

// Despesa fixa ou parcelada: o mesmo valor em cada mês, a partir de mesInicio.
export class CriarDespesaUseCase {
  constructor(
    private readonly lancamentos: LancamentosRepository,
    private readonly estado: EstadoRepository,
  ) {}

  execute(input: CriarDespesaInput) {
    if (!this.lancamentos.grupoExiste(input.grupoId))
      throw new NaoEncontradoError('Grupo não encontrado.')
    if (
      input.categoriaDivida &&
      !this.lancamentos.categoriaExiste(input.categoriaDivida)
    ) {
      throw new NaoEncontradoError('Categoria de devolução não encontrada.')
    }
    // Devolução já é paga para eles; a marcação "pago direto" é só para contas que não são devolução.
    const direto = !input.categoriaDivida && input.pagoAosCredores
    const quantidade =
      input.parcelas ??
      Math.max(1, mesesEntre(input.mesInicio, this.estado.lerConfig().planoFim))

    const id = this.lancamentos.criarDespesa({
      grupoId: input.grupoId,
      nome: input.nome,
      nomeCurto:
        input.categoriaDivida || direto ? input.nome.slice(0, 24) : null,
      categoriaDivida: input.categoriaDivida,
      pagoAosCredores: direto,
      valores: proximosMeses(input.mesInicio, quantidade).map((mes) => ({
        mes,
        valor: input.valor,
      })),
    })
    return { id }
  }
}
