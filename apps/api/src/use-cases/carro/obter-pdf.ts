import { NaoEncontradoError } from '../../core/errors'
import type { CarroRepository, Pdf } from '../../repositories/carro-repository'

// PDF original de uma multa ou de uma guia do carro.
export class ObterPdfBoletoUseCase {
  constructor(private readonly carro: CarroRepository) {}

  execute(alvo: { serie: string } | { custoId: number }): Pdf {
    const pdf =
      'serie' in alvo
        ? this.carro.pdfMulta(alvo.serie)
        : this.carro.pdfCusto(alvo.custoId)
    if (!pdf) throw new NaoEncontradoError('Boleto não encontrado.')
    return pdf
  }
}
