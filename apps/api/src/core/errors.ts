// Erros de regra de negócio. A camada HTTP traduz cada um para o status correspondente.
export class AppError extends Error {
  readonly status: number

  constructor(mensagem: string, status = 400) {
    super(mensagem)
    this.status = status
  }
}

export class RegraInvalidaError extends AppError {
  constructor(mensagem: string) {
    super(mensagem, 400)
  }
}

export class NaoEncontradoError extends AppError {
  constructor(mensagem = 'Registro não encontrado.') {
    super(mensagem, 404)
  }
}

export class ConflitoError extends AppError {
  constructor(mensagem: string) {
    super(mensagem, 409)
  }
}

export class NaoPermitidoError extends AppError {
  constructor(mensagem: string) {
    super(mensagem, 403)
  }
}
