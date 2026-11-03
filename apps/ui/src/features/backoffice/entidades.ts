// O que cada tabela do Backoffice mostra e edita: campos, rótulos, tipos e quem pode criar ou remover.
// Os nomes dos campos são os que a API aceita (apps/api/src/use-cases/backoffice/entidades.ts).
import { nomeFolha } from '@/domain/calculo'
import type { Config, Despesa, Estado, Multa } from '@/domain/tipos'
import { mesCurto, nomeMes, plural, titulo } from '@/lib/formato'

// Valor de um campo como vai para a API.
export type Valor = string | number | boolean | null

// Tipos: texto, centavos, inteiro, mes, data (AAAA-MM-DD), dataBr (DD/MM/AAAA), hora, booleano, grupo,
// categoria, opcao e taxa (fração: 0,01 = 1% ao mês).
export type CampoDef = {
  campo: string
  rotulo: string
  opcional?: boolean
  largo?: boolean
} & (
  | { tipo: 'texto'; max: number }
  | { tipo: 'opcao'; opcoes: readonly (readonly [string, string])[] }
  | { tipo: 'categoria'; vazio?: string }
  | { tipo: 'inteiro'; padrao?: number }
  | {
      tipo:
        | 'centavos'
        | 'taxa'
        | 'mes'
        | 'data'
        | 'dataBr'
        | 'hora'
        | 'booleano'
        | 'grupo'
    }
)

export type TipoCampo = CampoDef['tipo']

// Registro de qualquer tabela. Cada entidade é definida com o tipo exato (definir<R>) e guardada assim.
export type Registro = Record<string, unknown>

type ChaveDe<R> = Extract<keyof R, string>

// Campo de um registro: tem o mesmo nome da propriedade ou diz de onde vem o valor ("ler").
export type CampoRegistro<R> = CampoDef &
  ({ campo: ChaveDe<R>; ler?: undefined } | { ler(x: R): Valor })

// O que as funções das entidades recebem: os dados e a despesa aberta em "Valores por mês".
export type Contexto = { estado: Estado; despesa: Despesa | undefined }

type EntidadeBase = { id: string; titulo: string; descricao: string }

export type EntidadeConfig = EntidadeBase & {
  layout: 'config'
  campos: (CampoDef & { campo: keyof Config })[]
}

export type EntidadeLista<R extends Registro> = EntidadeBase & {
  layout: 'tabela' | 'fichas'
  novo?: string
  registros(ctx: Contexto): R[]
  chave(x: R): string | number
  nome(x: R): string
  campos: CampoRegistro<R>[]
  // Campos do formulário "Adicionar": o nome de um campo da tabela ou um campo só de criação.
  criar?: (ChaveDe<R> | CampoDef)[]
  // false: a tabela não tem "Remover"; uma função: só alguns registros podem ser removidos.
  remover?: false | ((x: R, ctx: Contexto) => boolean)
  confirmar?(x: R): string
  // Primeira coluna, só leitura (o mês em "Valores por mês", o código nas infrações).
  colunaChave?: { rotulo: string; texto(x: R): string }
  // Fichas: linha de baixo, valor à direita e a etiqueta "Pago".
  resumo?(x: R, ctx: Contexto): string
  valor?(x: R): number
  pago?(x: R): boolean
  // Botão "Meses" das despesas.
  meses?: boolean
  caminho?(chave: string | null, ctx: Contexto): string
}

export type Entidade = EntidadeConfig | EntidadeLista<Registro>

// Confere os campos contra o tipo do registro e guarda a entidade junto com as outras.
const definir = <R extends Registro>(e: EntidadeLista<R>) =>
  e as unknown as EntidadeLista<Registro>

const velocidade =
  (chave: 'medida' | 'considerada' | 'limite') =>
  (m: Multa): Valor =>
    m.velocidade ? m.velocidade[chave] : null

function nomeInfracao(estado: Estado, m: Multa) {
  const i = estado.infracoes[m.codigoInfracao]
  return i ? i.descricao : titulo(m.descricao)
}

const temPago = (x: { pagoEm: string | null }) => Boolean(x.pagoEm)

export const ENTIDADES: Entidade[] = [
  {
    id: 'config',
    titulo: 'Configurações',
    descricao:
      'Período do plano, rendimento do CDB e as categorias que recebem o que a Greici e o André pagam.',
    layout: 'config',
    campos: [
      { campo: 'planoInicio', rotulo: 'Início do plano', tipo: 'mes' },
      { campo: 'planoFim', rotulo: 'Fim do plano', tipo: 'mes' },
      {
        campo: 'cdbTaxaMensal',
        rotulo: 'Rendimento do CDB (% ao mês)',
        tipo: 'taxa',
      },
      {
        campo: 'cdbInicio',
        rotulo: 'CDB começa em',
        tipo: 'mes',
        opcional: true,
      },
      {
        campo: 'credores',
        rotulo: 'Nome dos credores',
        tipo: 'texto',
        max: 60,
      },
      {
        campo: 'placa',
        rotulo: 'Placa do carro',
        tipo: 'texto',
        max: 10,
        opcional: true,
      },
      {
        campo: 'categoriaContasPagasPorCredores',
        rotulo: 'Categoria das contas pagas por eles',
        tipo: 'categoria',
        largo: true,
      },
      {
        campo: 'categoriaCarro',
        rotulo: 'Categoria do carro',
        tipo: 'categoria',
        largo: true,
      },
      {
        campo: 'salarioPrevisto',
        rotulo: 'Salário previsto (vazio: última folha)',
        tipo: 'centavos',
        opcional: true,
      },
      {
        campo: 'reservaMeses',
        rotulo: 'Reserva de emergência (meses)',
        tipo: 'inteiro',
      },
      {
        campo: 'poupancaPercentual',
        rotulo: 'Cenário: % do bruto guardado depois da dívida',
        tipo: 'inteiro',
      },
    ],
  },
  definir<Despesa>({
    id: 'despesas',
    titulo: 'Despesas',
    novo: 'Adicionar despesa',
    descricao:
      'Nome, grupo e destino de cada conta mensal. Os valores de cada mês ficam em “Valores por mês”.',
    layout: 'tabela',
    registros: ({ estado }) => estado.despesas,
    chave: (x) => x.id,
    nome: (x) => x.nome,
    campos: [
      { campo: 'nome', rotulo: 'Nome', tipo: 'texto', max: 120, largo: true },
      {
        campo: 'nomeCurto',
        rotulo: 'Nome curto',
        tipo: 'texto',
        max: 24,
        opcional: true,
      },
      { campo: 'grupoId', rotulo: 'Grupo', tipo: 'grupo' },
      {
        campo: 'categoriaDivida',
        rotulo: 'Devolução de',
        tipo: 'categoria',
        vazio: 'Não é devolução',
      },
      {
        campo: 'pagoAosCredores',
        rotulo: 'Pago direto a eles',
        tipo: 'booleano',
      },
      { campo: 'ordem', rotulo: 'Ordem', tipo: 'inteiro' },
    ],
    criar: ['nome', 'grupoId'],
    confirmar: (x) =>
      `Remover “${x.nome}” e ${plural(Object.keys(x.valores).length, 'valor mensal', 'valores mensais')}?`,
    meses: true,
  }),
  definir<{
    mes: string
    valor: number
    pagoEm: string | null
    pagoPorCredores: boolean
  }>({
    id: 'valores',
    titulo: 'Valores por mês',
    novo: 'Adicionar meses',
    descricao:
      'Quanto a despesa custa em cada mês, quando foi paga e se foram a Greici e o André que pagaram.',
    layout: 'tabela',
    registros: ({ despesa }) =>
      despesa
        ? Object.entries(despesa.valores).map(([mes, v]) => ({ mes, ...v }))
        : [],
    chave: (x) => x.mes,
    nome: (x) => nomeMes(x.mes),
    colunaChave: { rotulo: 'Mês', texto: (x) => mesCurto(x.mes) },
    caminho: (chave, { despesa }) =>
      `/backoffice/despesas/${despesa?.id}/meses${chave == null ? '' : `/${chave}`}`,
    campos: [
      { campo: 'valor', rotulo: 'Valor', tipo: 'centavos' },
      { campo: 'pagoEm', rotulo: 'Pago em', tipo: 'data', opcional: true },
      {
        campo: 'pagoPorCredores',
        rotulo: 'Pago pela Greici e André',
        tipo: 'booleano',
      },
    ],
    criar: [
      { campo: 'mes', rotulo: 'Primeiro mês', tipo: 'mes' },
      'valor',
      {
        campo: 'meses',
        rotulo: 'Quantos meses seguidos',
        tipo: 'inteiro',
        padrao: 1,
      },
    ],
  }),
  definir<Estado['entradas'][number]>({
    id: 'entradas',
    titulo: 'Entradas',
    novo: 'Adicionar entrada',
    descricao: 'Salário, notas PJ e outros recebimentos de todos os meses.',
    layout: 'tabela',
    registros: ({ estado }) => estado.entradas,
    chave: (x) => x.id,
    nome: (x) => x.descricao,
    campos: [
      { campo: 'mes', rotulo: 'Mês', tipo: 'mes' },
      {
        campo: 'descricao',
        rotulo: 'Descrição',
        tipo: 'texto',
        max: 120,
        largo: true,
      },
      { campo: 'valor', rotulo: 'Valor', tipo: 'centavos' },
    ],
    criar: ['mes', 'descricao', 'valor'],
  }),
  definir<Estado['extras'][number]>({
    id: 'extras',
    titulo: 'Extras',
    novo: 'Adicionar extra',
    descricao: 'Gastos avulsos de todos os meses.',
    layout: 'tabela',
    registros: ({ estado }) => estado.extras,
    chave: (x) => x.id,
    nome: (x) => x.descricao,
    campos: [
      { campo: 'mes', rotulo: 'Mês', tipo: 'mes' },
      {
        campo: 'descricao',
        rotulo: 'Descrição',
        tipo: 'texto',
        max: 120,
        largo: true,
      },
      { campo: 'valor', rotulo: 'Valor', tipo: 'centavos' },
      { campo: 'pagoEm', rotulo: 'Pago em', tipo: 'data', opcional: true },
    ],
    criar: ['mes', 'descricao', 'valor'],
  }),
  definir<Estado['emprestimos'][number]>({
    id: 'emprestimos',
    titulo: 'Pago pela Greici e pelo André',
    novo: 'Adicionar valor pago por eles',
    descricao:
      'O que eles pagaram por você fora das contas mensais. Entra na dívida.',
    layout: 'tabela',
    registros: ({ estado }) => estado.emprestimos,
    chave: (x) => x.id,
    nome: (x) => x.descricao,
    campos: [
      { campo: 'mes', rotulo: 'Mês', tipo: 'mes', opcional: true },
      {
        campo: 'descricao',
        rotulo: 'Descrição',
        tipo: 'texto',
        max: 120,
        largo: true,
      },
      { campo: 'valor', rotulo: 'Valor', tipo: 'centavos' },
      {
        campo: 'categoriaDivida',
        rotulo: 'Parte da dívida',
        tipo: 'categoria',
      },
      { campo: 'origem', rotulo: 'Origem', tipo: 'texto', max: 60 },
    ],
    criar: ['mes', 'descricao', 'valor', 'categoriaDivida', 'origem'],
  }),
  definir<Multa>({
    id: 'multas',
    titulo: 'Multas',
    descricao:
      'Dados dos boletos. Uma multa alterada aqui não é mais atualizada pelo importador de boletos. Para não pagar uma multa, zere o valor.',
    layout: 'fichas',
    registros: ({ estado }) => estado.multas,
    chave: (x) => x.serie,
    nome: (x) => x.serie,
    resumo: (x, { estado }) =>
      `${nomeInfracao(estado, x)} · infração em ${x.dataInfracao}`,
    valor: (x) => x.valor,
    pago: temPago,
    remover: false,
    campos: [
      {
        campo: 'cobranca',
        rotulo: 'Cobrança da guia',
        tipo: 'opcao',
        opcoes: [
          ['com-desconto', 'Com 20% de desconto'],
          ['com-juros', 'Com juros (multa vencida)'],
        ],
      },
      { campo: 'valorOriginal', rotulo: 'Valor original', tipo: 'centavos' },
      { campo: 'juros', rotulo: 'Juros', tipo: 'centavos' },
      { campo: 'valor', rotulo: 'Valor a pagar', tipo: 'centavos' },
      { campo: 'validade', rotulo: 'Válida até', tipo: 'dataBr' },
      { campo: 'pagoEm', rotulo: 'Paga em', tipo: 'data', opcional: true },
      {
        campo: 'linhaDigitavel',
        rotulo: 'Linha digitável',
        tipo: 'texto',
        max: 80,
        opcional: true,
        largo: true,
      },
      {
        campo: 'guia',
        rotulo: 'Nº da guia',
        tipo: 'texto',
        max: 40,
        opcional: true,
      },
      {
        campo: 'expedida',
        rotulo: 'Expedida em',
        tipo: 'dataBr',
        opcional: true,
      },
      {
        campo: 'codigoInfracao',
        rotulo: 'Código da infração',
        tipo: 'texto',
        max: 12,
      },
      {
        campo: 'descricao',
        rotulo: 'Descrição no boleto',
        tipo: 'texto',
        max: 200,
        largo: true,
      },
      {
        campo: 'amparo',
        rotulo: 'Amparo legal',
        tipo: 'texto',
        max: 120,
        opcional: true,
      },
      { campo: 'pontos', rotulo: 'Pontos', tipo: 'inteiro', opcional: true },
      { campo: 'dataInfracao', rotulo: 'Data da infração', tipo: 'dataBr' },
      {
        campo: 'horaInfracao',
        rotulo: 'Hora da infração',
        tipo: 'hora',
        opcional: true,
      },
      {
        campo: 'local',
        rotulo: 'Local',
        tipo: 'texto',
        max: 200,
        opcional: true,
        largo: true,
      },
      {
        campo: 'municipio',
        rotulo: 'Município',
        tipo: 'texto',
        max: 120,
        opcional: true,
      },
      {
        campo: 'autuador',
        rotulo: 'Autuador',
        tipo: 'texto',
        max: 120,
        opcional: true,
      },
      {
        campo: 'infrator',
        rotulo: 'Infrator',
        tipo: 'texto',
        max: 120,
        opcional: true,
      },
      {
        campo: 'placa',
        rotulo: 'Placa',
        tipo: 'texto',
        max: 10,
        opcional: true,
      },
      {
        campo: 'origem',
        rotulo: 'Multa de origem',
        tipo: 'texto',
        max: 12,
        opcional: true,
      },
      {
        campo: 'velocidadeMedida',
        rotulo: 'Velocidade medida',
        tipo: 'inteiro',
        opcional: true,
        ler: velocidade('medida'),
      },
      {
        campo: 'velocidadeConsiderada',
        rotulo: 'Velocidade considerada',
        tipo: 'inteiro',
        opcional: true,
        ler: velocidade('considerada'),
      },
      {
        campo: 'velocidadeLimite',
        rotulo: 'Limite de velocidade',
        tipo: 'inteiro',
        opcional: true,
        ler: velocidade('limite'),
      },
    ],
  }),
  definir<Estado['custosCarro'][number]>({
    id: 'custos-carro',
    titulo: 'Outras despesas do carro',
    novo: 'Adicionar despesa do carro',
    descricao:
      'CRLV, pátio e outros custos para regularizar o carro. Também pagos pela Greici e pelo André.',
    layout: 'fichas',
    registros: ({ estado }) => estado.custosCarro,
    chave: (x) => x.id,
    nome: (x) => x.descricao,
    resumo: (x) => x.detalhe,
    valor: (x) => x.valor,
    pago: temPago,
    // CRLV e pátio voltariam no próximo deploy (vêm da carga inicial do banco).
    remover: (x) => !x.chave,
    campos: [
      { campo: 'descricao', rotulo: 'Descrição', tipo: 'texto', max: 60 },
      { campo: 'valor', rotulo: 'Valor', tipo: 'centavos' },
      {
        campo: 'detalhe',
        rotulo: 'Detalhe',
        tipo: 'texto',
        max: 200,
        opcional: true,
        largo: true,
      },
      {
        campo: 'validade',
        rotulo: 'Válida até',
        tipo: 'dataBr',
        opcional: true,
      },
      { campo: 'pagoEm', rotulo: 'Pago em', tipo: 'data', opcional: true },
      {
        campo: 'linhaDigitavel',
        rotulo: 'Linha digitável',
        tipo: 'texto',
        max: 80,
        opcional: true,
        largo: true,
      },
      {
        campo: 'guia',
        rotulo: 'Nº da guia',
        tipo: 'texto',
        max: 40,
        opcional: true,
      },
      { campo: 'ordem', rotulo: 'Ordem', tipo: 'inteiro' },
    ],
    criar: ['descricao', 'valor'],
  }),
  definir<Estado['holerites'][number]>({
    id: 'holerites',
    titulo: 'Folhas de pagamento',
    descricao:
      'Dados lidos dos PDFs enviados na aba Salário. “Entra no mês” define em que mês o líquido conta nas entradas.',
    layout: 'fichas',
    registros: ({ estado }) => estado.holerites,
    chave: (x) => x.id,
    nome: (x) => nomeFolha(x),
    resumo: (x) => `${x.empresa || x.razaoSocial} · entra em ${nomeMes(x.mes)}`,
    valor: (x) => x.liquido,
    pago: temPago,
    confirmar: (x) =>
      `Remover a ${nomeFolha(x)}? O PDF é apagado e o líquido sai das entradas de ${nomeMes(x.mes)}.`,
    campos: [
      { campo: 'mes', rotulo: 'Entra no mês', tipo: 'mes' },
      { campo: 'liquido', rotulo: 'Líquido', tipo: 'centavos' },
      { campo: 'pagoEm', rotulo: 'Pago em', tipo: 'data', opcional: true },
      { campo: 'tipo', rotulo: 'Tipo da folha', tipo: 'texto', max: 60 },
      { campo: 'competencia', rotulo: 'Competência', tipo: 'mes' },
      { campo: 'salarioMensal', rotulo: 'Salário mensal', tipo: 'centavos' },
      {
        campo: 'totalVencimentos',
        rotulo: 'Total de vencimentos',
        tipo: 'centavos',
      },
      {
        campo: 'totalDescontos',
        rotulo: 'Total de descontos',
        tipo: 'centavos',
      },
      { campo: 'baseInss', rotulo: 'Base INSS', tipo: 'centavos' },
      { campo: 'baseIrrf', rotulo: 'Base IRRF', tipo: 'centavos' },
      { campo: 'fgts', rotulo: 'FGTS', tipo: 'centavos' },
      {
        campo: 'empresa',
        rotulo: 'Empresa',
        tipo: 'texto',
        max: 120,
        opcional: true,
      },
      {
        campo: 'razaoSocial',
        rotulo: 'Razão social',
        tipo: 'texto',
        max: 120,
        opcional: true,
      },
      { campo: 'cnpj', rotulo: 'CNPJ', tipo: 'texto', max: 20, opcional: true },
      {
        campo: 'funcionario',
        rotulo: 'Funcionário',
        tipo: 'texto',
        max: 120,
        opcional: true,
      },
      {
        campo: 'matricula',
        rotulo: 'Matrícula',
        tipo: 'texto',
        max: 20,
        opcional: true,
      },
      {
        campo: 'cargo',
        rotulo: 'Cargo',
        tipo: 'texto',
        max: 120,
        opcional: true,
      },
      {
        campo: 'banco',
        rotulo: 'Banco',
        tipo: 'texto',
        max: 60,
        opcional: true,
      },
      {
        campo: 'agencia',
        rotulo: 'Agência',
        tipo: 'texto',
        max: 20,
        opcional: true,
      },
      {
        campo: 'conta',
        rotulo: 'Conta',
        tipo: 'texto',
        max: 30,
        opcional: true,
      },
    ],
  }),
  definir<{ codigo: string; descricao: string; tipo: string }>({
    id: 'infracoes',
    titulo: 'Infrações',
    novo: 'Adicionar infração',
    descricao:
      'Descrição e tipo mostrados nas multas, pelo código da infração.',
    layout: 'tabela',
    registros: ({ estado }) =>
      Object.entries(estado.infracoes)
        .map(([codigo, i]) => ({ codigo, ...i }))
        .sort((a, b) => a.codigo.localeCompare(b.codigo)),
    chave: (x) => x.codigo,
    nome: (x) => x.descricao,
    colunaChave: { rotulo: 'Código', texto: (x) => x.codigo },
    campos: [
      {
        campo: 'descricao',
        rotulo: 'Descrição',
        tipo: 'texto',
        max: 120,
        largo: true,
      },
      { campo: 'tipo', rotulo: 'Tipo', tipo: 'texto', max: 40 },
    ],
    criar: [
      { campo: 'codigo', rotulo: 'Código', tipo: 'texto', max: 12 },
      'descricao',
      'tipo',
    ],
  }),
  definir<Estado['metas'][number]>({
    id: 'metas',
    titulo: 'Metas',
    novo: 'Adicionar meta',
    descricao: 'Valores de patrimônio acompanhados na aba Projeção.',
    layout: 'tabela',
    registros: ({ estado }) => estado.metas,
    chave: (x) => x.id,
    nome: (x) => x.nome,
    campos: [
      { campo: 'nome', rotulo: 'Nome', tipo: 'texto', max: 60, largo: true },
      { campo: 'valor', rotulo: 'Valor', tipo: 'centavos' },
      { campo: 'ordem', rotulo: 'Ordem', tipo: 'inteiro' },
    ],
    criar: ['nome', 'valor'],
  }),
  definir<Estado['grupos'][number]>({
    id: 'grupos',
    titulo: 'Grupos de despesas',
    novo: 'Adicionar grupo',
    descricao: 'Seções da aba Mês. Só dá para remover um grupo sem despesas.',
    layout: 'tabela',
    registros: ({ estado }) => estado.grupos,
    chave: (x) => x.id,
    nome: (x) => x.nome,
    remover: (x, { estado }) =>
      !estado.despesas.some((despesa) => despesa.grupoId === x.id),
    campos: [
      { campo: 'nome', rotulo: 'Nome', tipo: 'texto', max: 60 },
      {
        campo: 'descricao',
        rotulo: 'Descrição',
        tipo: 'texto',
        max: 200,
        opcional: true,
        largo: true,
      },
      { campo: 'ordem', rotulo: 'Ordem', tipo: 'inteiro' },
    ],
    criar: ['nome'],
  }),
  definir<Estado['categorias'][number]>({
    id: 'categorias-divida',
    titulo: 'Categorias da dívida',
    novo: 'Adicionar categoria',
    descricao:
      'Partes da dívida com a Greici e o André, usadas para comparar o plano com o que eles pagaram.',
    layout: 'tabela',
    registros: ({ estado }) => estado.categorias,
    chave: (x) => x.id,
    nome: (x) => x.nome,
    campos: [
      { campo: 'nome', rotulo: 'Nome', tipo: 'texto', max: 60 },
      { campo: 'ordem', rotulo: 'Ordem', tipo: 'inteiro' },
    ],
    criar: ['nome'],
  }),
]

export const ENTIDADE_PADRAO = 'despesas'

export const caminhoDe = (e: Entidade, chave: string | null, ctx: Contexto) => {
  if (e.layout === 'config') return '/backoffice/config'
  if (e.caminho) return e.caminho(chave, ctx)
  return `/backoffice/${e.id}${chave == null ? '' : `/${encodeURIComponent(chave)}`}`
}

export const podeRemover = (
  e: EntidadeLista<Registro>,
  x: Registro,
  ctx: Contexto,
) => e.remover !== false && (!e.remover || e.remover(x, ctx))

export const valorDe = (def: CampoRegistro<Registro>, x: Registro) =>
  def.ler ? def.ler(x) : x[def.campo]

export const camposCriar = (e: EntidadeLista<Registro>): CampoDef[] =>
  (e.criar ?? []).flatMap((c) => {
    if (typeof c !== 'string') return [c]
    const def = e.campos.find((d) => d.campo === c)
    return def ? [def] : []
  })

// A tabela de ?tabela=; sem ela (ou com uma que não existe), as despesas.
export function entidadePorId(id: string | undefined): Entidade {
  const e =
    ENTIDADES.find((x) => x.id === id) ??
    ENTIDADES.find((x) => x.id === ENTIDADE_PADRAO)
  if (!e) throw new Error(`Tabela ${ENTIDADE_PADRAO} não definida.`)
  return e
}
