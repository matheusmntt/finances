import { ConflitoError } from '../../core/errors'
import { mesBr, proximosMeses } from '../../core/meses'
import { lerHolerite } from '../../lib/holerite/ler-holerite'
import type { HoleritesRepository } from '../../repositories/holerites-repository'

// Lê o PDF da folha de pagamento e guarda tudo, inclusive o PDF. O líquido entra no mês em que foi pago
// (a data do recibo); sem data, no mês seguinte à competência.
export class EnviarHoleriteUseCase {
  constructor(private readonly holerites: HoleritesRepository) {}

  execute(pdf: Buffer, arquivo: string) {
    const folha = lerHolerite(pdf)
    if (this.holerites.existe(folha.tipo, folha.competencia)) {
      throw new ConflitoError(
        `Essa folha (${folha.tipo} de ${mesBr(folha.competencia)}) já foi enviada. Remova a que está no app para enviar de novo.`,
      )
    }
    const mes = folha.pagoEm
      ? folha.pagoEm.slice(0, 7)
      : (proximosMeses(folha.competencia, 2)[1] as string)
    const id = this.holerites.criar({ ...folha, mes, arquivo, pdf })
    return { id }
  }
}
