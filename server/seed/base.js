// Dados pré-estabelecidos do seeder: tudo o que não vem direto da planilha ou dos PDFs,
// mais os ajustes combinados em 08/10/2026.
"use strict";

module.exports = {
  config: {
    credores: "Greici e André",
    // Contas que a Greici e o André pagaram direto (coluna de agosto/26 da planilha) entram nesta categoria.
    categoriaContasPagasPorCredores: "geral",
    // Multas e custos do carro pagos por eles entram nesta categoria.
    categoriaCarro: "carro",
  },

  grupos: [
    {
      id: "despesas-parceladas",
      nome: "Despesas parceladas",
      descricao: "Acordos e contas atrasadas, com data para acabar.",
      ordem: 1,
    },
    { id: "despesas-fixas", nome: "Despesas fixas", descricao: "Contas que se repetem todo mês.", ordem: 2 },
    {
      id: "despesas-extras-mes",
      nome: "Devoluções e parcelas",
      descricao: "Devoluções para a Greici e o André e outras compras parceladas.",
      ordem: 3,
    },
  ],

  // Para que serve cada devolução: compara o plano com o que eles pagaram.
  categoriasDivida: [
    { id: "geral", nome: "Contas e despesas de agosto", ordem: 1 },
    { id: "cartao", nome: "Cartão (roupas)", ordem: 2 },
    { id: "carro", nome: "Carro", ordem: 3 },
  ],

  // Linhas da planilha que ficam de fora por enquanto (estavam sem valor).
  despesasRemovidas: [
    "despesas-parceladas/fatura-nubank",
    "despesas-parceladas/negociacao-divida-antiga",
    "despesas-fixas/faculdade",
    "despesas-extras-mes/extras-informar-aqui", // virou a seção "Extras" da aba Mês
  ],

  // Linhas da planilha que são devolução para a Greici e o André.
  devolucoes: {
    "despesas-extras-mes/roupas-novas": { categoria: "cartao", nomeCurto: "Roupas" },
    "despesas-extras-mes/pgt-devolucao-greici-andre": { categoria: "geral", nomeCurto: "Devolução" },
    "despesas-extras-mes/carro-pgt-devolucao-greici-andre": { categoria: "carro", nomeCurto: "Carro" },
  },

  // Contas que você paga direto para a Greici e o André junto com a devolução (não são devolução).
  pagosAosCredores: {
    "despesas-fixas/luz-participacao": { nomeCurto: "Luz" },
    "despesas-fixas/internet": { nomeCurto: "Internet" },
    "despesas-fixas/faxina-mes": { nomeCurto: "Faxina" },
  },

  descricaoEntradaPrevista: "Entradas previstas (planilha)",

  // Outras coisas que eles pagaram, além das contas de agosto e das despesas da Greici.
  emprestimos: [
    {
      mes: "2026-09",
      descricao: "Roupas novas no cartão",
      valor: 121899, // 3 parcelas de R$ 406,33
      categoria: "cartao",
      origem: "Compras no cartão",
    },
  ],

  origemDespesasGreici: "Despesas pagas pela Greici",

  // Custos do carro que não são multa.
  custosCarro: [
    { chave: "crlv", descricao: "CRLV", detalhe: "Licenciamento do veículo", valor: 11409, ordem: 1 },
    // Estimativa até chegar a guia; a guia do depósito (abaixo) substitui o valor.
    { chave: "patio", descricao: "Pátio do depósito", detalhe: "Para retirar o carro do depósito", valor: 173276, ordem: 2 },
  ],

  // Que custo do carro cada guia extraída dos PDFs preenche.
  guiasCarro: {
    deposito: "patio",
  },

  infracoes: [
    { codigo: "50100", descricao: "Dirigir sem CNH/PPD/ACC", tipo: "Sem CNH" },
    { codigo: "74550", descricao: "Excesso de velocidade até 20%", tipo: "Velocidade" },
    { codigo: "74630", descricao: "Excesso de velocidade de 20% a 50%", tipo: "Velocidade" },
    { codigo: "51851", descricao: "Deixar de usar o cinto de segurança", tipo: "Cinto" },
    { codigo: "65992", descricao: "Conduzir veículo sem licenciamento", tipo: "Licenciamento" },
  ],
};
