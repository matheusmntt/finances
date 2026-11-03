import { RegraInvalidaError } from '../../core/errors'
import type { BackofficeRepository } from '../../repositories/backoffice-repository'
import type { LancamentosRepository } from '../../repositories/lancamentos-repository'
import { CONFIG } from './entidades'
import { validarCampos } from './validar-campos'

export class AtualizarConfigUseCase {
  constructor(
    private readonly backoffice: BackofficeRepository,
    private readonly lancamentos: LancamentosRepository,
  ) {}

  execute(corpo: Record<string, unknown>) {
    const desconhecida = Object.keys(corpo).find(
      (k) => !Object.hasOwn(CONFIG, k),
    )
    if (desconhecida)
      throw new RegraInvalidaError(
        `Configuração desconhecida: ${desconhecida}.`,
      )
    const { valores } = validarCampos(CONFIG, corpo, this.lancamentos)
    this.backoffice.transacao(() => {
      this.backoffice.gravarConfig(
        Object.entries(valores).map(([k, v]) => [k, String(v ?? '')]),
      )
      const inicio = this.backoffice.lerConfig('planoInicio') ?? ''
      const fim = this.backoffice.lerConfig('planoFim') ?? ''
      if (inicio > fim)
        throw new RegraInvalidaError(
          'O início do plano precisa ser antes do fim.',
        )
    })
  }
}
