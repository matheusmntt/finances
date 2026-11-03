// Dados pré-estabelecidos do seed: tudo o que não vem direto da planilha ou dos PDFs,
// mais os ajustes combinados em 08/10/2026. Veio da v1 (legacy/server/seed/base.js).

export const base = {
  config: {
    credores: 'Greici e André',
    categoriaContasPagasPorCredores: 'geral',
    categoriaCarro: 'carro',
  },
  grupos: [
    {
      id: 'despesas-parceladas',
      nome: 'Despesas parceladas',
      descricao: 'Acordos e contas atrasadas, com data para acabar.',
      ordem: 1,
    },
    {
      id: 'despesas-fixas',
      nome: 'Despesas fixas',
      descricao: 'Contas que se repetem todo mês.',
      ordem: 2,
    },
    {
      id: 'despesas-extras-mes',
      nome: 'Devoluções e parcelas',
      descricao:
        'Devoluções para a Greici e o André e outras compras parceladas.',
      ordem: 3,
    },
  ],
  categoriasDivida: [
    {
      id: 'geral',
      nome: 'Contas e despesas de agosto',
      ordem: 1,
    },
    {
      id: 'cartao',
      nome: 'Cartão (roupas)',
      ordem: 2,
    },
    {
      id: 'carro',
      nome: 'Carro',
      ordem: 3,
    },
  ],
  despesasRemovidas: [
    'despesas-parceladas/fatura-nubank',
    'despesas-parceladas/negociacao-divida-antiga',
    'despesas-fixas/faculdade',
    'despesas-extras-mes/extras-informar-aqui',
  ],
  devolucoes: {
    'despesas-extras-mes/roupas-novas': {
      categoria: 'cartao',
      nomeCurto: 'Roupas',
    },
    'despesas-extras-mes/pgt-devolucao-greici-andre': {
      categoria: 'geral',
      nomeCurto: 'Devolução',
    },
    'despesas-extras-mes/carro-pgt-devolucao-greici-andre': {
      categoria: 'carro',
      nomeCurto: 'Carro',
    },
  },
  pagosAosCredores: {
    'despesas-fixas/luz-participacao': {
      nomeCurto: 'Luz',
    },
    'despesas-fixas/internet': {
      nomeCurto: 'Internet',
    },
    'despesas-fixas/faxina-mes': {
      nomeCurto: 'Faxina',
    },
  },
  descricaoSalario: 'Salário',
  emprestimos: [
    {
      mes: '2026-09',
      descricao: 'Roupas novas no cartão',
      valor: 121899,
      categoria: 'cartao',
      origem: 'Compras no cartão',
    },
  ],
  origemDespesasGreici: 'Despesas pagas pela Greici',
  custosCarro: [
    {
      chave: 'crlv',
      descricao: 'CRLV',
      detalhe: 'Licenciamento do veículo',
      valor: 11409,
      ordem: 1,
    },
    {
      chave: 'patio',
      descricao: 'Pátio do depósito',
      detalhe: 'Para retirar o carro do depósito',
      valor: 173276,
      ordem: 2,
    },
  ],
  guiasCarro: {
    deposito: 'patio',
  },
  infracoes: [
    {
      codigo: '50100',
      descricao: 'Dirigir sem CNH/PPD/ACC',
      tipo: 'Sem CNH',
    },
    {
      codigo: '74550',
      descricao: 'Excesso de velocidade até 20%',
      tipo: 'Velocidade',
    },
    {
      codigo: '74630',
      descricao: 'Excesso de velocidade de 20% a 50%',
      tipo: 'Velocidade',
    },
    {
      codigo: '51851',
      descricao: 'Deixar de usar o cinto de segurança',
      tipo: 'Cinto',
    },
    {
      codigo: '65992',
      descricao: 'Conduzir veículo sem licenciamento',
      tipo: 'Licenciamento',
    },
  ],
} as const
