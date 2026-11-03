import { NaoEncontradoError, RegraInvalidaError } from '../../core/errors'
import { mesBr, proximosMeses } from '../../core/meses'
import type { BackofficeRepository } from '../../repositories/backoffice-repository'
import type { LancamentosRepository } from '../../repositories/lancamentos-repository'
import { CAMPOS_VALOR_MES } from './entidades'
import { validarCampos } from './validar-campos'

// Valores de uma despesa em cada mês, editados direto no Backoffice.

export class CriarValoresMesUseCase {
  constructor(
    private readonly backoffice: BackofficeRepository,
    private readonly lancamentos: LancamentosRepository,
  ) {}

  // O mesmo valor em `meses` meses seguidos a partir de `mes`.
  execute(
    despesaId: number,
    input: { mes: string; valor: number; meses: number },
  ) {
    if (!this.lancamentos.despesa(despesaId))
      throw new NaoEncontradoError('Despesa não encontrada.')
    const meses = proximosMeses(input.mes, input.meses)
    this.backoffice.transacao(() => {
      const repetido = meses.find((m) =>
        this.backoffice.valorMesExiste(despesaId, m),
      )
      if (repetido)
        throw new RegraInvalidaError(
          `Essa despesa já tem valor em ${mesBr(repetido)}. Altere direto na tabela.`,
        )
      this.backoffice.inserirValoresMes(despesaId, meses, input.valor)
    })
  }
}

export class AtualizarValorMesUseCase {
  constructor(
    private readonly backoffice: BackofficeRepository,
    private readonly lancamentos: LancamentosRepository,
  ) {}

  execute(despesaId: number, mes: string, corpo: Record<string, unknown>) {
    if (!this.lancamentos.despesa(despesaId))
      throw new NaoEncontradoError('Despesa não encontrada.')
    const { valores } = validarCampos(CAMPOS_VALOR_MES, corpo, this.lancamentos)
    if (!this.backoffice.atualizarValorMes(despesaId, mes, valores)) {
      throw new NaoEncontradoError('Essa despesa não tem valor nesse mês.')
    }
  }
}

export class RemoverValorMesUseCase {
  constructor(
    private readonly backoffice: BackofficeRepository,
    private readonly lancamentos: LancamentosRepository,
  ) {}

  execute(despesaId: number, mes: string) {
    if (!this.lancamentos.despesa(despesaId))
      throw new NaoEncontradoError('Despesa não encontrada.')
    if (!this.backoffice.removerValorMes(despesaId, mes))
      throw new NaoEncontradoError('Essa despesa não tem valor nesse mês.')
  }
}
