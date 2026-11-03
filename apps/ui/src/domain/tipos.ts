// Formato do GET /api/estado: tudo o que as telas usam. Espelha o que a API devolve
// (apps/api/src/repositories/estado-repository.ts). Valores em centavos; meses em AAAA-MM.

export type Config = {
  credores: string
  categoriaContasPagasPorCredores: string
  categoriaCarro: string
  planoInicio: string
  planoFim: string
  cdbTaxaMensal: number
  cdbInicio: string
  placa: string
  salarioPrevisto: number | null
  reservaMeses: number
  poupancaPercentual: number
}

export type Grupo = {
  id: string
  nome: string
  descricao: string
  ordem: number
}
export type Categoria = { id: string; nome: string; ordem: number }

export type ValorMes = {
  valor: number
  pagoEm: string | null
  pagoPorCredores: boolean
}

export type Despesa = {
  id: number
  slug: string | null
  grupoId: string
  nome: string
  nomeCurto: string | null
  categoriaDivida: string | null
  pagoAosCredores: boolean
  criadaPeloUsuario: boolean
  ordem: number
  valores: Record<string, ValorMes>
}

export type Entrada = {
  id: number
  mes: string
  descricao: string
  valor: number
}
export type Extra = Entrada & { pagoEm: string | null }
export type Emprestimo = {
  id: number
  mes: string | null
  descricao: string
  valor: number
  categoriaDivida: string
  origem: string
}

export type Multa = {
  serie: string
  placa: string | null
  cobranca: 'com-desconto' | 'com-juros'
  arquivo: string | null
  temPdf: boolean
  codigoInfracao: string
  descricao: string
  amparo: string | null
  pontos: number | null
  infrator: string | null
  dataInfracao: string // DD/MM/AAAA
  horaInfracao: string | null
  local: string | null
  municipio: string | null
  autuador: string | null
  origem: string | null
  velocidade: {
    medida: number | null
    considerada: number
    limite: number | null
  } | null
  guia: string | null
  expedida: string | null
  validade: string // DD/MM/AAAA
  valorOriginal: number
  juros: number
  valor: number
  linhaDigitavel: string | null
  pagoEm: string | null
}

export type CustoCarro = {
  id: number
  chave: string | null
  descricao: string
  detalhe: string
  valor: number
  pagoEm: string | null
  guia: string | null
  validade: string | null
  linhaDigitavel: string | null
  arquivo: string | null
  temPdf: boolean
  ordem: number
}

export type ItemHolerite = {
  codigo: string
  descricao: string
  referencia: string | null
  vencimento: number
  desconto: number
}

export type Holerite = {
  id: number
  mes: string
  tipo: string
  competencia: string
  empresa: string
  razaoSocial: string
  cnpj: string
  funcionario: string
  matricula: string
  cargo: string
  salarioMensal: number
  baseInss: number
  baseIrrf: number
  fgts: number
  totalVencimentos: number
  totalDescontos: number
  liquido: number
  banco: string | null
  agencia: string | null
  conta: string | null
  pagoEm: string | null
  arquivo: string | null
  itens: ItemHolerite[]
}

export type Meta = { id: number; nome: string; valor: number; ordem: number }

export type Estado = {
  config: Config
  grupos: Grupo[]
  categorias: Categoria[]
  despesas: Despesa[]
  entradas: Entrada[]
  extras: Extra[]
  emprestimos: Emprestimo[]
  infracoes: Record<string, { descricao: string; tipo: string }>
  multas: Multa[]
  custosCarro: CustoCarro[]
  holerites: Holerite[]
  metas: Meta[]
}
