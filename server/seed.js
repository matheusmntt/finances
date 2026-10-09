// Semeia o banco com os dados da planilha, dos boletos e de server/seed/base.js.
//
//   npm run seed          semeia um banco vazio
//   npm run seed:reset    apaga os dados e semeia de novo (as sessões continuam valendo)
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { abrir, transacao, estaVazio } = require("./db");
const base = require("./seed/base");
const { importarBoletos } = require("./importar");

const RAIZ = path.join(__dirname, "..");
const PASTA_SEED = path.join(__dirname, "seed");

// Tabelas de dados, na ordem em que podem ser apagadas.
const TABELAS = [
  "holerite_itens",
  "holerites",
  "despesa_valores",
  "despesas",
  "entradas",
  "extras",
  "emprestimos",
  "multas",
  "custos_carro",
  "infracoes",
  "categorias_divida",
  "grupos",
  "config",
];

function lerJson(nome) {
  return JSON.parse(fs.readFileSync(path.join(PASTA_SEED, nome), "utf8"));
}

function semear(db) {
  const planilha = lerJson("extraido-planilha.json");
  const boletos = lerJson("extraido-multas.json");
  const contagem = {};

  transacao(db, () => {
    TABELAS.forEach((tabela) => db.exec(`DELETE FROM ${tabela}`));

    // Configuração
    const config = {
      ...base.config,
      planoInicio: planilha.meses[0],
      planoFim: planilha.meses[planilha.meses.length - 1],
      cdbTaxaMensal: String(planilha.aplicacao.taxaMensal),
      cdbInicio: planilha.aplicacao.inicio,
      placa: (boletos[0] && boletos[0].placa) || "",
    };
    const inserirConfig = db.prepare("INSERT INTO config (chave, valor) VALUES (?, ?)");
    Object.entries(config).forEach(([chave, valor]) => inserirConfig.run(chave, String(valor)));

    const inserirGrupo = db.prepare("INSERT INTO grupos (id, nome, descricao, ordem) VALUES (?, ?, ?, ?)");
    base.grupos.forEach((g) => inserirGrupo.run(g.id, g.nome, g.descricao, g.ordem));

    const inserirCategoria = db.prepare("INSERT INTO categorias_divida (id, nome, ordem) VALUES (?, ?, ?)");
    base.categoriasDivida.forEach((c) => inserirCategoria.run(c.id, c.nome, c.ordem));

    // Despesas mensais da planilha
    const inserirDespesa = db.prepare(
      `INSERT INTO despesas (slug, grupo_id, nome, nome_curto, categoria_divida, pago_aos_credores, ordem)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    );
    const inserirValor = db.prepare(
      "INSERT INTO despesa_valores (despesa_id, mes, valor, pago_por_credores) VALUES (?, ?, ?, ?)"
    );
    const resgate = new Set(planilha.mesesResgate);
    let ordem = 0;
    contagem.despesas = 0;
    planilha.grupos.forEach((grupo) => {
      if (!base.grupos.some((g) => g.id === grupo.id)) throw new Error(`Grupo sem cadastro em base.js: ${grupo.id}`);
      grupo.itens.forEach((item) => {
        if (base.despesasRemovidas.includes(item.id)) return;
        const devolucao = base.devolucoes[item.id] || {};
        const direto = base.pagosAosCredores[item.id];
        const { lastInsertRowid: id } = inserirDespesa.run(
          item.id,
          grupo.id,
          item.nome,
          devolucao.nomeCurto || (direto && direto.nomeCurto) || null,
          devolucao.categoria || null,
          direto ? 1 : 0,
          ++ordem
        );
        item.valores.forEach((valor, i) => {
          if (!valor) return;
          const mes = planilha.meses[i];
          inserirValor.run(id, mes, valor, resgate.has(mes) ? 1 : 0);
        });
        contagem.despesas++;
      });
    });

    // Entradas
    const inserirEntrada = db.prepare("INSERT INTO entradas (mes, descricao, valor) VALUES (?, ?, ?)");
    contagem.entradas = 0;
    planilha.entradas.forEach((valor, i) => {
      if (valor == null) return;
      inserirEntrada.run(planilha.meses[i], base.descricaoEntradaPrevista, valor);
      contagem.entradas++;
    });

    // O que a Greici e o André pagaram fora das contas mensais
    const inserirEmprestimo = db.prepare(
      "INSERT INTO emprestimos (mes, descricao, valor, categoria_divida, origem) VALUES (?, ?, ?, ?, ?)"
    );
    planilha.pagosPelaGreici.itens.forEach((item) =>
      inserirEmprestimo.run(item.mes, item.nome, item.valor, base.config.categoriaContasPagasPorCredores, base.origemDespesasGreici)
    );
    base.emprestimos.forEach((e) => inserirEmprestimo.run(e.mes, e.descricao, e.valor, e.categoria, e.origem));
    contagem.emprestimos = planilha.pagosPelaGreici.itens.length + base.emprestimos.length;
  });

  // Multas, infrações e custos do carro vêm do importador (o mesmo usado em bancos já em uso).
  const importados = importarBoletos(db);
  contagem.multas = importados.multasNovas.length + importados.multasAtualizadas;
  contagem.guiasCarro = importados.guias;

  return contagem;
}

module.exports = { semear };

if (require.main === module) {
  const caminho = process.env.DB_PATH || path.join(RAIZ, "data", "financas.db");
  const db = abrir(caminho);
  if (!estaVazio(db) && !process.argv.includes("--reset")) {
    console.error(`O banco ${caminho} já tem dados. Use "npm run seed:reset" para apagar tudo e semear de novo.`);
    process.exit(1);
  }
  const contagem = semear(db);
  console.log(`Banco semeado em ${caminho}:`, contagem);
}
