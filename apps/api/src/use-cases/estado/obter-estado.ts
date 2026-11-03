import type {
  Estado,
  EstadoRepository,
} from '../../repositories/estado-repository'

export class ObterEstadoUseCase {
  constructor(private readonly estado: EstadoRepository) {}

  execute(): Estado {
    return this.estado.ler()
  }
}
