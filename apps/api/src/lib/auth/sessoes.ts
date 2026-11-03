import {
  createHmac,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from 'node:crypto'
import type { SegredosRepository } from '../../repositories/segredos-repository'

export const DURACAO_SESSAO = 30 * 24 * 60 * 60 // segundos

// Confere a senha do app sem guardá-la em texto: o hash é refeito a cada início do servidor.
export class Senha {
  private readonly sal = randomBytes(16)
  private readonly hash: Buffer

  constructor(senha: string) {
    this.hash = scryptSync(senha, this.sal, 32)
  }

  confere(tentativa: string) {
    if (!tentativa || tentativa.length > 200) return false
    return timingSafeEqual(scryptSync(tentativa, this.sal, 32), this.hash)
  }
}

// Sessão = "expira.assinatura" (HMAC com o segredo guardado no banco). Sem tabela de sessões: trocar o
// segredo derruba todas. É o mesmo formato da v1, então quem já estava logado continua logado.
export class Sessoes {
  private readonly segredo: string

  constructor(segredos: SegredosRepository) {
    let segredo = segredos.ler('sessao')
    if (!segredo) {
      segredo = randomBytes(32).toString('hex')
      segredos.gravar('sessao', segredo)
    }
    this.segredo = segredo
  }

  private assinar(texto: string) {
    return createHmac('sha256', this.segredo).update(texto).digest('base64url')
  }

  criar(agora = Date.now()) {
    const expira = String(Math.floor(agora / 1000) + DURACAO_SESSAO)
    return `${expira}.${this.assinar(expira)}`
  }

  valida(token: string | undefined, agora = Date.now()) {
    if (!token) return false
    const [expira, assinatura] = token.split('.')
    if (!expira || !assinatura) return false
    const esperada = Buffer.from(this.assinar(expira))
    const recebida = Buffer.from(assinatura)
    if (
      esperada.length !== recebida.length ||
      !timingSafeEqual(esperada, recebida)
    )
      return false
    return Number(expira) > agora / 1000
  }
}

// Até 10 tentativas erradas a cada 15 minutos por IP.
export class LimiteDeTentativas {
  private readonly tentativas = new Map<
    string,
    { falhas: number; ate: number }
  >()

  bloqueado(ip: string, agora = Date.now()) {
    const t = this.tentativas.get(ip)
    return Boolean(t && t.ate > agora && t.falhas >= 10)
  }

  registrarFalha(ip: string, agora = Date.now()) {
    const t = this.tentativas.get(ip)
    if (!t || t.ate < agora)
      this.tentativas.set(ip, { falhas: 1, ate: agora + 15 * 60 * 1000 })
    else t.falhas++
  }

  limpar(ip: string) {
    this.tentativas.delete(ip)
  }
}
