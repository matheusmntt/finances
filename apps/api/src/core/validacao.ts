// Esquemas Zod reutilizados pelas rotas e pelo Backoffice, com as mensagens que o app mostra ao usuário.
import { z } from 'zod'

export const MAX_CENTAVOS = 100_000_000_00 // R$ 100 milhões

const vazio = (v: unknown) => v == null || (typeof v === 'string' && !v.trim())

// Texto obrigatório: tira espaços repetidos e confere o tamanho.
export const texto = (nome: string, max = 120) =>
  z
    .string({ error: `Informe ${nome}.` })
    .transform((s) => s.trim().replace(/\s+/g, ' '))
    .pipe(
      z
        .string()
        .min(1, `Informe ${nome}.`)
        .max(
          max,
          `${nome[0]?.toUpperCase()}${nome.slice(1)} pode ter no máximo ${max} caracteres.`,
        ),
    )

// Texto que pode ficar vazio: null (coluna anulável) ou "" (coluna NOT NULL), conforme `vazioComo`.
export const textoOpcional = (
  nome: string,
  max = 120,
  vazioComo: null | '' = null,
) =>
  z.preprocess(
    (v) => (vazio(v) ? vazioComo : v),
    z.union([z.literal(vazioComo), texto(nome, max)]),
  )

export const centavos = (nome: string, minimo = 0) =>
  z
    .number({ error: `Valor inválido em ${nome}.` })
    .int(`Valor inválido em ${nome}.`)
    .min(minimo, `Valor inválido em ${nome}.`)
    .max(MAX_CENTAVOS, `Valor inválido em ${nome}.`)

export const centavosOpcional = (nome: string, minimo = 0) =>
  z.preprocess((v) => (vazio(v) ? null : v), centavos(nome, minimo).nullable())

export const inteiro = (nome: string, minimo: number, maximo: number) =>
  z
    .number({
      error: `Confira ${nome}: use um número inteiro entre ${minimo} e ${maximo}.`,
    })
    .int(`Confira ${nome}: use um número inteiro entre ${minimo} e ${maximo}.`)
    .min(
      minimo,
      `Confira ${nome}: use um número inteiro entre ${minimo} e ${maximo}.`,
    )
    .max(
      maximo,
      `Confira ${nome}: use um número inteiro entre ${minimo} e ${maximo}.`,
    )

export const inteiroOpcional = (nome: string, minimo: number, maximo: number) =>
  z.preprocess(
    (v) => (vazio(v) ? null : v),
    inteiro(nome, minimo, maximo).nullable(),
  )

// AAAA-MM
export const mes = z
  .string({ error: 'Mês inválido. Use AAAA-MM.' })
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Mês inválido. Use AAAA-MM.')

export const mesOpcional = z.preprocess(
  (v) => (vazio(v) ? null : v),
  mes.nullable(),
)

// AAAA-MM-DD ou null (desmarca o pagamento).
export const dataPagamento = z.preprocess(
  (v) => (vazio(v) ? null : v),
  z
    .string({ error: 'Data inválida. Use AAAA-MM-DD.' })
    .regex(
      /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/,
      'Data inválida. Use AAAA-MM-DD.',
    )
    .nullable(),
)

// DD/MM/AAAA, como nos boletos.
export const dataBr = (nome: string) =>
  z
    .string({ error: `Confira ${nome}: use DD/MM/AAAA.` })
    .regex(
      /^(0[1-9]|[12]\d|3[01])\/(0[1-9]|1[0-2])\/\d{4}$/,
      `Confira ${nome}: use DD/MM/AAAA.`,
    )

export const dataBrOpcional = (nome: string) =>
  z.preprocess((v) => (vazio(v) ? null : v), dataBr(nome).nullable())

export const hora = (nome: string) =>
  z.preprocess(
    (v) => (vazio(v) ? null : v),
    z
      .string()
      .regex(/^([01]\d|2[0-3]):[0-5]\d$/, `Confira ${nome}: use HH:MM.`)
      .nullable(),
  )

export const booleano = (nome: string) =>
  z.boolean({ error: `Confira ${nome}.` })

export const opcao = <T extends readonly [string, ...string[]]>(
  nome: string,
  opcoes: T,
) => z.enum(opcoes, { error: `Confira ${nome}.` })

// Fração por mês: 0.0117 = 1,17% ao mês.
export const taxa = (nome: string) =>
  z
    .number({ error: `Informe ${nome} entre 0% e 20% ao mês.` })
    .min(0, `Informe ${nome} entre 0% e 20% ao mês.`)
    .max(0.2, `Informe ${nome} entre 0% e 20% ao mês.`)

// Chave de texto de um registro (id de grupo, código de infração...).
export const chaveTexto = z
  .string({ error: 'Valor inválido.' })
  .regex(/^[\w-]{1,40}$/, 'Valor inválido.')

export const idNumerico = z.coerce.number().int().positive()

export const serieMulta = z.string().regex(/^[A-Z]\d{9}$/)

// A primeira mensagem de erro, para mostrar ao usuário.
export function primeiraMensagem(erro: z.ZodError): string {
  return erro.issues[0]?.message ?? 'Dados inválidos.'
}
