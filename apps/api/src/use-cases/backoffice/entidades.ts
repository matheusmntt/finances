// O que o Backoffice pode editar: para cada tabela, os campos, como cada um é validado e o que dá para criar
// ou remover. As chaves dos campos são as propriedades do esquema Drizzle (db/schema.ts).
import type { SQLiteColumn, SQLiteTable } from 'drizzle-orm/sqlite-core'
import type { ZodType } from 'zod'
import * as v from '../../core/validacao'
import * as t from '../../db/schema'

export type Campo = {
  esquema: ZodType
  // grupo ou categoria: o valor precisa existir na tabela correspondente.
  referencia?: 'grupo' | 'categoria'
  // O importador de boletos também grava esse campo; alterar marca o registro como editado no app.
  importado?: boolean
}

export type Entidade = {
  tabela: SQLiteTable
  coluna: SQLiteColumn // chave primária
  numerica: boolean
  campos: Record<string, Campo>
  criar?: {
    campos: string[]
    // Como nasce a chave quando não é um número automático.
    chave?: 'slug' | 'codigo'
    fixos?: Record<string, unknown>
  }
  // true: sempre pode remover; uma regra: confere antes (ver RemoverRegistroUseCase).
  remover?:
    | true
    | 'grupo-sem-despesas'
    | 'categoria-sem-uso'
    | 'custo-sem-chave'
}

const c = (esquema: ZodType, extra: Omit<Campo, 'esquema'> = {}): Campo => ({
  esquema,
  ...extra,
})
const importado = (esquema: ZodType) => c(esquema, { importado: true })
const ordem = c(v.inteiro('a ordem', 0, 9999))

export const ENTIDADES: Record<string, Entidade> = {
  grupos: {
    tabela: t.grupos,
    coluna: t.grupos.id,
    numerica: false,
    campos: {
      nome: c(v.texto('o nome', 60)),
      descricao: c(v.textoOpcional('a descrição', 200, '')),
      ordem,
    },
    criar: { campos: ['nome'], chave: 'slug' },
    remover: 'grupo-sem-despesas',
  },

  'categorias-divida': {
    tabela: t.categoriasDivida,
    coluna: t.categoriasDivida.id,
    numerica: false,
    campos: { nome: c(v.texto('o nome', 60)), ordem },
    criar: { campos: ['nome'], chave: 'slug' },
    remover: 'categoria-sem-uso',
  },

  despesas: {
    tabela: t.despesas,
    coluna: t.despesas.id,
    numerica: true,
    campos: {
      nome: c(v.texto('o nome', 120)),
      nomeCurto: c(v.textoOpcional('o nome curto', 24)),
      grupoId: c(v.chaveTexto, { referencia: 'grupo' }),
      categoriaDivida: c(v.textoOpcional('a categoria da devolução', 40), {
        referencia: 'categoria',
      }),
      pagoAosCredores: c(v.booleano('Pago direto a eles')),
      ordem,
    },
    criar: { campos: ['nome', 'grupoId'], fixos: { criadaPeloUsuario: true } },
    remover: true,
  },

  entradas: {
    tabela: t.entradas,
    coluna: t.entradas.id,
    numerica: true,
    campos: {
      mes: c(v.mes),
      descricao: c(v.texto('a descrição', 120)),
      valor: c(v.centavos('valor')),
    },
    criar: { campos: ['mes', 'descricao', 'valor'] },
    remover: true,
  },

  extras: {
    tabela: t.extras,
    coluna: t.extras.id,
    numerica: true,
    campos: {
      mes: c(v.mes),
      descricao: c(v.texto('a descrição', 120)),
      valor: c(v.centavos('valor', 1)),
      pagoEm: c(v.dataPagamento),
    },
    criar: { campos: ['mes', 'descricao', 'valor'] },
    remover: true,
  },

  emprestimos: {
    tabela: t.emprestimos,
    coluna: t.emprestimos.id,
    numerica: true,
    campos: {
      mes: c(v.mesOpcional),
      descricao: c(v.texto('a descrição', 120)),
      valor: c(v.centavos('valor', 1)),
      categoriaDivida: c(v.chaveTexto, { referencia: 'categoria' }),
      origem: c(v.texto('a origem', 60)),
    },
    criar: {
      campos: ['mes', 'descricao', 'valor', 'categoriaDivida', 'origem'],
    },
    remover: true,
  },

  infracoes: {
    tabela: t.infracoes,
    coluna: t.infracoes.codigo,
    numerica: false,
    campos: {
      descricao: importado(v.texto('a descrição', 120)),
      tipo: importado(v.texto('o tipo', 40)),
    },
    criar: { campos: ['descricao', 'tipo'], chave: 'codigo' },
    remover: true,
  },

  // Multas vêm dos PDFs: o importador traria de volta uma multa removida, então aqui só se edita.
  multas: {
    tabela: t.multas,
    coluna: t.multas.serie,
    numerica: false,
    campos: {
      cobranca: importado(
        v.opcao('o tipo de cobrança', ['com-desconto', 'com-juros']),
      ),
      valorOriginal: importado(v.centavos('valor original')),
      juros: importado(v.centavos('juros')),
      valor: importado(v.centavos('valor')),
      validade: importado(v.dataBr('a validade')),
      pagoEm: c(v.dataPagamento),
      linhaDigitavel: importado(v.textoOpcional('a linha digitável', 80)),
      guia: importado(v.textoOpcional('o número da guia', 40)),
      expedida: importado(v.dataBrOpcional('a data de expedição')),
      codigoInfracao: importado(v.texto('o código da infração', 12)),
      descricao: importado(v.texto('a descrição', 200)),
      amparo: importado(v.textoOpcional('o amparo legal', 120)),
      pontos: importado(v.inteiroOpcional('os pontos', 0, 99)),
      dataInfracao: importado(v.dataBr('a data da infração')),
      horaInfracao: importado(v.hora('a hora da infração')),
      local: importado(v.textoOpcional('o local', 200)),
      municipio: importado(v.textoOpcional('o município', 120)),
      autuador: importado(v.textoOpcional('o autuador', 120)),
      infrator: importado(v.textoOpcional('o infrator', 120)),
      placa: importado(v.textoOpcional('a placa', 10)),
      origem: importado(v.textoOpcional('a multa de origem', 12)),
      velocidadeMedida: importado(
        v.inteiroOpcional('a velocidade medida', 0, 400),
      ),
      velocidadeConsiderada: importado(
        v.inteiroOpcional('a velocidade considerada', 0, 400),
      ),
      velocidadeLimite: importado(
        v.inteiroOpcional('o limite de velocidade', 0, 400),
      ),
    },
  },

  'custos-carro': {
    tabela: t.custosCarro,
    coluna: t.custosCarro.id,
    numerica: true,
    campos: {
      descricao: c(v.texto('a descrição', 60)),
      detalhe: importado(v.textoOpcional('o detalhe', 200, '')),
      valor: importado(v.centavos('valor')),
      validade: importado(v.dataBrOpcional('a validade')),
      pagoEm: c(v.dataPagamento),
      linhaDigitavel: importado(v.textoOpcional('a linha digitável', 80)),
      guia: importado(v.textoOpcional('o número da guia', 40)),
      ordem,
    },
    criar: { campos: ['descricao', 'valor'] },
    remover: 'custo-sem-chave',
  },

  // Metas de patrimônio mostradas na aba Projeção.
  metas: {
    tabela: t.metas,
    coluna: t.metas.id,
    numerica: true,
    campos: {
      nome: c(v.texto('o nome da meta', 60)),
      valor: c(v.centavos('valor da meta', 1)),
      ordem,
    },
    criar: { campos: ['nome', 'valor'] },
    remover: true,
  },

  // Folhas de pagamento: entram pelo envio do PDF (aba Salário); aqui se corrige o que foi lido.
  holerites: {
    tabela: t.holerites,
    coluna: t.holerites.id,
    numerica: true,
    campos: {
      mes: c(v.mes),
      liquido: c(v.centavos('líquido')),
      pagoEm: c(v.dataPagamento),
      tipo: c(v.texto('o tipo da folha', 60)),
      competencia: c(v.mes),
      salarioMensal: c(v.centavos('salário mensal')),
      totalVencimentos: c(v.centavos('total de vencimentos')),
      totalDescontos: c(v.centavos('total de descontos')),
      baseInss: c(v.centavos('base do INSS')),
      baseIrrf: c(v.centavos('base do IRRF')),
      fgts: c(v.centavos('FGTS')),
      empresa: c(v.textoOpcional('a empresa', 120, '')),
      razaoSocial: c(v.textoOpcional('a razão social', 120, '')),
      cnpj: c(v.textoOpcional('o CNPJ', 20, '')),
      funcionario: c(v.textoOpcional('o funcionário', 120, '')),
      matricula: c(v.textoOpcional('a matrícula', 20, '')),
      cargo: c(v.textoOpcional('o cargo', 120, '')),
      banco: c(v.textoOpcional('o banco', 60)),
      agencia: c(v.textoOpcional('a agência', 20)),
      conta: c(v.textoOpcional('a conta', 30)),
    },
    remover: true,
  },
}

// Valores de uma despesa em cada mês (chave composta: despesa + mês).
export const CAMPOS_VALOR_MES: Record<string, Campo> = {
  valor: c(v.centavos('valor', 1)),
  pagoEm: c(v.dataPagamento),
  pagoPorCredores: c(v.booleano('Pago pela Greici e pelo André')),
}

export const CONFIG: Record<string, Campo> = {
  credores: c(v.texto('o nome dos credores', 60)),
  categoriaContasPagasPorCredores: c(v.chaveTexto, { referencia: 'categoria' }),
  categoriaCarro: c(v.chaveTexto, { referencia: 'categoria' }),
  planoInicio: c(v.mes),
  planoFim: c(v.mes),
  cdbTaxaMensal: c(v.taxa('a taxa do CDB')),
  cdbInicio: c(v.mesOpcional),
  placa: c(v.textoOpcional('a placa', 10)),
  salarioPrevisto: c(v.centavosOpcional('o salário previsto')),
  reservaMeses: c(v.inteiro('os meses da reserva de emergência', 1, 36)),
  poupancaPercentual: c(
    v.inteiro('a porcentagem do salário bruto guardada', 1, 100),
  ),
}
