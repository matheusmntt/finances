// Esquema do banco para o Drizzle. Espelha as tabelas criadas pelas migrações (db/migrations.ts): quem cria
// e altera tabelas são as migrações; este arquivo só descreve o que já existe, para as consultas terem tipos.
import { sql } from 'drizzle-orm'
import {
  blob,
  integer,
  primaryKey,
  sqliteTable,
  text,
} from 'drizzle-orm/sqlite-core'

const criadoEm = () =>
  text('criado_em').notNull().default(sql`(datetime('now'))`)

// Colunas 0/1 do SQLite lidas como boolean.
const flag = (nome: string) =>
  integer(nome, { mode: 'boolean' }).notNull().default(false)

export const config = sqliteTable('config', {
  chave: text('chave').primaryKey(),
  valor: text('valor').notNull(),
})

// Separado de config para o seeder nunca apagar (invalida as sessões).
export const segredos = sqliteTable('segredos', {
  chave: text('chave').primaryKey(),
  valor: text('valor').notNull(),
})

export const grupos = sqliteTable('grupos', {
  id: text('id').primaryKey(),
  nome: text('nome').notNull(),
  descricao: text('descricao').notNull().default(''),
  ordem: integer('ordem').notNull().default(0),
})

export const categoriasDivida = sqliteTable('categorias_divida', {
  id: text('id').primaryKey(),
  nome: text('nome').notNull(),
  ordem: integer('ordem').notNull().default(0),
})

// Contas mensais: fixas, parceladas e devoluções. O valor de cada mês fica em despesaValores.
export const despesas = sqliteTable('despesas', {
  id: integer('id').primaryKey(),
  slug: text('slug').unique(),
  grupoId: text('grupo_id')
    .notNull()
    .references(() => grupos.id),
  nome: text('nome').notNull(),
  nomeCurto: text('nome_curto'),
  // Preenchido: devolução para a Greici e o André nessa parte da dívida.
  categoriaDivida: text('categoria_divida').references(
    () => categoriasDivida.id,
  ),
  criadaPeloUsuario: flag('criada_pelo_usuario'),
  ordem: integer('ordem').notNull().default(0),
  criadoEm: criadoEm(),
  // Conta paga direto para eles junto com a devolução (não é devolução).
  pagoAosCredores: flag('pago_aos_credores'),
})

export const despesaValores = sqliteTable(
  'despesa_valores',
  {
    despesaId: integer('despesa_id')
      .notNull()
      .references(() => despesas.id, { onDelete: 'cascade' }),
    mes: text('mes').notNull(), // AAAA-MM
    valor: integer('valor').notNull(), // centavos
    pagoEm: text('pago_em'), // AAAA-MM-DD
    // A Greici e o André pagaram (entra na dívida).
    pagoPorCredores: flag('pago_por_credores'),
  },
  (t) => [primaryKey({ columns: [t.despesaId, t.mes] })],
)

export const entradas = sqliteTable('entradas', {
  id: integer('id').primaryKey(),
  mes: text('mes').notNull(),
  descricao: text('descricao').notNull(),
  valor: integer('valor').notNull(),
  criadoEm: criadoEm(),
})

// Gastos avulsos de um mês.
export const extras = sqliteTable('extras', {
  id: integer('id').primaryKey(),
  mes: text('mes').notNull(),
  descricao: text('descricao').notNull(),
  valor: integer('valor').notNull(),
  pagoEm: text('pago_em'),
  criadoEm: criadoEm(),
})

// O que a Greici e o André pagaram por você fora das contas mensais.
export const emprestimos = sqliteTable('emprestimos', {
  id: integer('id').primaryKey(),
  mes: text('mes'),
  descricao: text('descricao').notNull(),
  valor: integer('valor').notNull(),
  categoriaDivida: text('categoria_divida')
    .notNull()
    .references(() => categoriasDivida.id),
  origem: text('origem').notNull(),
  criadoEm: criadoEm(),
})

export const infracoes = sqliteTable('infracoes', {
  codigo: text('codigo').primaryKey(),
  descricao: text('descricao').notNull(),
  tipo: text('tipo').notNull(),
  editadoNoApp: flag('editado_no_app'),
})

export const multas = sqliteTable('multas', {
  serie: text('serie').primaryKey(),
  placa: text('placa'),
  // Lido do PDF: guia com 20% de desconto ou guia de multa vencida, com juros.
  cobranca: text('cobranca', {
    enum: ['com-desconto', 'com-juros'],
  }).notNull(),
  arquivo: text('arquivo'),
  pdf: blob('pdf', { mode: 'buffer' }),
  codigoInfracao: text('codigo_infracao').notNull(),
  descricao: text('descricao').notNull(),
  amparo: text('amparo'),
  pontos: integer('pontos'),
  infrator: text('infrator'),
  dataInfracao: text('data_infracao').notNull(), // DD/MM/AAAA, como no boleto
  horaInfracao: text('hora_infracao'),
  local: text('local'),
  municipio: text('municipio'),
  autuador: text('autuador'),
  origem: text('origem'),
  velocidadeMedida: integer('velocidade_medida'),
  velocidadeConsiderada: integer('velocidade_considerada'),
  velocidadeLimite: integer('velocidade_limite'),
  guia: text('guia'),
  expedida: text('expedida'),
  validade: text('validade').notNull(), // DD/MM/AAAA
  valorOriginal: integer('valor_original').notNull(),
  juros: integer('juros').notNull().default(0),
  valor: integer('valor').notNull(),
  linhaDigitavel: text('linha_digitavel'),
  pagoEm: text('pago_em'),
  editadoNoApp: flag('editado_no_app'),
})

export const custosCarro = sqliteTable('custos_carro', {
  id: integer('id').primaryKey(),
  descricao: text('descricao').notNull(),
  detalhe: text('detalhe').notNull().default(''),
  valor: integer('valor').notNull(),
  pagoEm: text('pago_em'),
  ordem: integer('ordem').notNull().default(0),
  chave: text('chave').unique(),
  guia: text('guia'),
  validade: text('validade'), // DD/MM/AAAA
  linhaDigitavel: text('linha_digitavel'),
  arquivo: text('arquivo'),
  pdf: blob('pdf', { mode: 'buffer' }),
  editadoNoApp: flag('editado_no_app'),
})

// Folhas de pagamento enviadas em PDF. O líquido entra como salário no mês do pagamento.
export const holerites = sqliteTable('holerites', {
  id: integer('id').primaryKey(),
  mes: text('mes').notNull(), // AAAA-MM em que o líquido entra nas contas
  tipo: text('tipo').notNull(), // "Folha Mensal", "13º Salário"...
  competencia: text('competencia').notNull(), // AAAA-MM
  empresa: text('empresa').notNull().default(''),
  razaoSocial: text('razao_social').notNull().default(''),
  cnpj: text('cnpj').notNull().default(''),
  funcionario: text('funcionario').notNull().default(''),
  matricula: text('matricula').notNull().default(''),
  cargo: text('cargo').notNull().default(''),
  salarioMensal: integer('salario_mensal').notNull().default(0),
  baseInss: integer('base_inss').notNull().default(0),
  baseIrrf: integer('base_irrf').notNull().default(0),
  fgts: integer('fgts').notNull().default(0),
  totalVencimentos: integer('total_vencimentos').notNull(),
  totalDescontos: integer('total_descontos').notNull(),
  liquido: integer('liquido').notNull(),
  banco: text('banco'),
  agencia: text('agencia'),
  conta: text('conta'),
  pagoEm: text('pago_em'), // AAAA-MM-DD, data do recibo
  arquivo: text('arquivo'),
  pdf: blob('pdf', { mode: 'buffer' }).notNull(),
  criadoEm: criadoEm(),
})

export const holeriteItens = sqliteTable(
  'holerite_itens',
  {
    holeriteId: integer('holerite_id')
      .notNull()
      .references(() => holerites.id, { onDelete: 'cascade' }),
    ordem: integer('ordem').notNull(),
    codigo: text('codigo').notNull(),
    descricao: text('descricao').notNull(),
    referencia: text('referencia'), // coluna Hrs/Qtde, como no recibo
    vencimento: integer('vencimento').notNull().default(0),
    desconto: integer('desconto').notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.holeriteId, t.ordem] })],
)

// Metas de patrimônio da aba Projeção.
export const metas = sqliteTable('metas', {
  id: integer('id').primaryKey(),
  nome: text('nome').notNull(),
  valor: integer('valor').notNull(), // centavos
  ordem: integer('ordem').notNull().default(0),
  criadoEm: criadoEm(),
})
