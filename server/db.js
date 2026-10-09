// Abre o banco SQLite e aplica o esquema.
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");

// Cada item é uma migração. Nunca altere uma que já rodou: acrescente outra no fim.
const MIGRACOES = [
  `
  CREATE TABLE config (
    chave TEXT PRIMARY KEY,
    valor TEXT NOT NULL
  );

  -- Separado de config para o seeder nunca apagar (invalida as sessões).
  CREATE TABLE segredos (
    chave TEXT PRIMARY KEY,
    valor TEXT NOT NULL
  );

  CREATE TABLE grupos (
    id TEXT PRIMARY KEY,
    nome TEXT NOT NULL,
    descricao TEXT NOT NULL DEFAULT '',
    ordem INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE categorias_divida (
    id TEXT PRIMARY KEY,
    nome TEXT NOT NULL,
    ordem INTEGER NOT NULL DEFAULT 0
  );

  -- Contas mensais: fixas, parceladas e devoluções. O valor de cada mês fica em despesa_valores.
  CREATE TABLE despesas (
    id INTEGER PRIMARY KEY,
    slug TEXT UNIQUE,
    grupo_id TEXT NOT NULL REFERENCES grupos(id),
    nome TEXT NOT NULL,
    nome_curto TEXT,
    categoria_divida TEXT REFERENCES categorias_divida(id), -- preenchido = devolução para a Greici e o André
    criada_pelo_usuario INTEGER NOT NULL DEFAULT 0,
    ordem INTEGER NOT NULL DEFAULT 0,
    criado_em TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE despesa_valores (
    despesa_id INTEGER NOT NULL REFERENCES despesas(id) ON DELETE CASCADE,
    mes TEXT NOT NULL,                  -- AAAA-MM
    valor INTEGER NOT NULL,             -- centavos
    pago_em TEXT,                       -- AAAA-MM-DD
    pago_por_credores INTEGER NOT NULL DEFAULT 0, -- 1 = a Greici e o André pagaram (entra na dívida)
    PRIMARY KEY (despesa_id, mes)
  );

  CREATE TABLE entradas (
    id INTEGER PRIMARY KEY,
    mes TEXT NOT NULL,
    descricao TEXT NOT NULL,
    valor INTEGER NOT NULL,
    criado_em TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX entradas_mes ON entradas(mes);

  -- Gastos avulsos de um mês (a antiga linha "Extras informar aqui").
  CREATE TABLE extras (
    id INTEGER PRIMARY KEY,
    mes TEXT NOT NULL,
    descricao TEXT NOT NULL,
    valor INTEGER NOT NULL,
    pago_em TEXT,
    criado_em TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX extras_mes ON extras(mes);

  -- O que a Greici e o André pagaram por você fora das contas mensais.
  CREATE TABLE emprestimos (
    id INTEGER PRIMARY KEY,
    mes TEXT,
    descricao TEXT NOT NULL,
    valor INTEGER NOT NULL,
    categoria_divida TEXT NOT NULL REFERENCES categorias_divida(id),
    origem TEXT NOT NULL,
    criado_em TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE infracoes (
    codigo TEXT PRIMARY KEY,
    descricao TEXT NOT NULL,
    tipo TEXT NOT NULL
  );

  CREATE TABLE multas (
    serie TEXT PRIMARY KEY,
    placa TEXT,
    situacao TEXT NOT NULL CHECK (situacao IN ('a-vencer', 'vencidos')),
    arquivo TEXT,
    pdf BLOB,
    codigo_infracao TEXT NOT NULL,
    descricao TEXT NOT NULL,
    amparo TEXT,
    pontos INTEGER,
    infrator TEXT,
    data_infracao TEXT NOT NULL,        -- DD/MM/AAAA, como no boleto
    hora_infracao TEXT,
    local TEXT,
    municipio TEXT,
    autuador TEXT,
    origem TEXT,
    velocidade_medida INTEGER,
    velocidade_considerada INTEGER,
    velocidade_limite INTEGER,
    guia TEXT,
    expedida TEXT,
    validade TEXT NOT NULL,             -- DD/MM/AAAA
    valor_original INTEGER NOT NULL,
    juros INTEGER NOT NULL DEFAULT 0,
    valor INTEGER NOT NULL,
    linha_digitavel TEXT,
    pago_em TEXT
  );

  CREATE TABLE custos_carro (
    id INTEGER PRIMARY KEY,
    descricao TEXT NOT NULL,
    detalhe TEXT NOT NULL DEFAULT '',
    valor INTEGER NOT NULL,
    pago_em TEXT,
    ordem INTEGER NOT NULL DEFAULT 0
  );
  `,
  `
  -- Contas que você paga direto para a Greici e o André junto com a devolução (não são devolução).
  ALTER TABLE despesas ADD COLUMN pago_aos_credores INTEGER NOT NULL DEFAULT 0;

  -- Combinado em 08/10/2026: luz, internet e faxina são pagas direto ao André.
  UPDATE despesas SET pago_aos_credores = 1, nome_curto = 'Luz' WHERE slug = 'despesas-fixas/luz-participacao';
  UPDATE despesas SET pago_aos_credores = 1, nome_curto = 'Internet' WHERE slug = 'despesas-fixas/internet';
  UPDATE despesas SET pago_aos_credores = 1, nome_curto = 'Faxina' WHERE slug = 'despesas-fixas/faxina-mes';
  `,
  `
  -- Custos do carro podem ter boleto próprio (por exemplo, a guia do depósito).
  ALTER TABLE custos_carro ADD COLUMN chave TEXT;
  ALTER TABLE custos_carro ADD COLUMN guia TEXT;
  ALTER TABLE custos_carro ADD COLUMN validade TEXT;          -- DD/MM/AAAA
  ALTER TABLE custos_carro ADD COLUMN linha_digitavel TEXT;
  ALTER TABLE custos_carro ADD COLUMN arquivo TEXT;
  ALTER TABLE custos_carro ADD COLUMN pdf BLOB;
  UPDATE custos_carro SET chave = 'crlv' WHERE descricao = 'CRLV';
  UPDATE custos_carro SET chave = 'patio' WHERE descricao = 'Pátio do depósito';
  CREATE UNIQUE INDEX custos_carro_chave ON custos_carro(chave);
  `,
];

function abrir(caminho) {
  fs.mkdirSync(path.dirname(caminho), { recursive: true });
  const db = new DatabaseSync(caminho);
  db.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;");
  migrar(db);
  return db;
}

function migrar(db) {
  const { user_version: versao } = db.prepare("PRAGMA user_version").get();
  for (let v = versao; v < MIGRACOES.length; v++) {
    transacao(db, () => {
      db.exec(MIGRACOES[v]);
      db.exec(`PRAGMA user_version = ${v + 1}`);
    });
  }
}

function transacao(db, fn) {
  db.exec("BEGIN");
  try {
    const resultado = fn();
    db.exec("COMMIT");
    return resultado;
  } catch (erro) {
    db.exec("ROLLBACK");
    throw erro;
  }
}

function estaVazio(db) {
  return !db.prepare("SELECT 1 FROM despesas LIMIT 1").get();
}

module.exports = { abrir, transacao, estaVazio };
