import { AppError } from '../../core/errors'
import type { LimiteDeTentativas, Senha, Sessoes } from '../../lib/auth/sessoes'

export class SenhaIncorretaError extends AppError {
  constructor() {
    super('Senha incorreta.', 401)
  }
}

export class MuitasTentativasError extends AppError {
  constructor() {
    super('Muitas tentativas. Espere 15 minutos e tente de novo.', 429)
  }
}

// Confere a senha e devolve o token da sessão (vai num cookie HttpOnly).
export class EntrarUseCase {
  constructor(
    private readonly senha: Senha,
    private readonly sessoes: Sessoes,
    private readonly limite: LimiteDeTentativas,
  ) {}

  execute(input: { senha: string; ip: string }) {
    if (this.limite.bloqueado(input.ip)) throw new MuitasTentativasError()
    if (!this.senha.confere(input.senha)) {
      this.limite.registrarFalha(input.ip)
      throw new SenhaIncorretaError()
    }
    this.limite.limpar(input.ip)
    return { token: this.sessoes.criar() }
  }
}
