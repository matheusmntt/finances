// Importa os boletos extraídos dos PDFs (multas e guias do carro) sem apagar nada do que
// foi lançado no app: multas novas entram, as existentes têm os dados atualizados e
// continuam com a marcação de pago.
//
//   npm run importar
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { transacao } = require("./db");
const base = require("./seed/base");

const RAIZ = path.join(__dirname, "..");
const PASTA_SEED = path.join(__dirname, "seed");

function lerJsonSeExistir(nome) {
  const caminho = path.join(PASTA_SEED, nome);
  return fs.existsSync(caminho) ? JSON.parse(fs.readFileSync(caminho, "utf8")) : [];
}

function lerPdf(relativo) {
  const caminho = path.join(RAIZ, relativo);
  return fs.existsSync(caminho) ? fs.readFileSync(caminho) : null;
}

function formatarReais(centavos) {
  return (centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// "Remoção R$ 395,27 + 34 diárias R$ 1.378,02 (R$ 40,53 por dia)"
function detalheGuia(guia) {
  return guia.itens
    .map((item) => {
      const nome = item.descricao.split(" ")[0].toLowerCase();
      if (item.quantidade === 1) return `${nome.charAt(0).toUpperCase()}${nome.slice(1)} ${formatarReais(item.valor)}`;
      const unitario = Math.round(item.valor / item.quantidade);
      return `${item.quantidade} ${nome.replace(/a$/, "as")} ${formatarReais(item.valor)} (${formatarReais(unitario)} por dia)`;
    })
    .join(" + ");
}

function importarBoletos(db) {
  const multas = lerJsonSeExistir("extraido-multas.json");
  const guias = lerJsonSeExistir("extraido-guias-carro.json");
  const resultado = { multasNovas: [], multasAtualizadas: 0, guias: [] };

  transacao(db, () => {
    const infracao = db.prepare(
      `INSERT INTO infracoes (codigo, descricao, tipo) VALUES (?, ?, ?)
       ON CONFLICT (codigo) DO UPDATE SET descricao = excluded.descricao, tipo = excluded.tipo`
    );
    base.infracoes.forEach((i) => infracao.run(i.codigo, i.descricao, i.tipo));

    const existe = db.prepare("SELECT 1 FROM multas WHERE serie = ?");
    const multa = db.prepare(`INSERT INTO multas (
        serie, placa, situacao, arquivo, pdf, codigo_infracao, descricao, amparo, pontos, infrator,
        data_infracao, hora_infracao, local, municipio, autuador, origem,
        velocidade_medida, velocidade_considerada, velocidade_limite,
        guia, expedida, validade, valor_original, juros, valor, linha_digitavel
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT (serie) DO UPDATE SET
        placa = excluded.placa, situacao = excluded.situacao, arquivo = excluded.arquivo,
        pdf = COALESCE(excluded.pdf, multas.pdf), codigo_infracao = excluded.codigo_infracao,
        descricao = excluded.descricao, amparo = excluded.amparo, pontos = excluded.pontos,
        infrator = excluded.infrator, data_infracao = excluded.data_infracao, hora_infracao = excluded.hora_infracao,
        local = excluded.local, municipio = excluded.municipio, autuador = excluded.autuador, origem = excluded.origem,
        velocidade_medida = excluded.velocidade_medida, velocidade_considerada = excluded.velocidade_considerada,
        velocidade_limite = excluded.velocidade_limite, guia = excluded.guia, expedida = excluded.expedida,
        validade = excluded.validade, valor_original = excluded.valor_original, juros = excluded.juros,
        valor = excluded.valor, linha_digitavel = excluded.linha_digitavel`);
    multas.forEach((b) => {
      if (existe.get(b.serie)) resultado.multasAtualizadas++;
      else resultado.multasNovas.push(b.serie);
      const v = b.velocidade || {};
      multa.run(
        b.serie, b.placa, b.situacao, path.basename(b.arquivo), lerPdf(b.arquivo), b.codigoInfracao, b.descricao,
        b.amparo, b.pontos ?? null, b.infrator ?? null, b.dataInfracao, b.horaInfracao, b.local, b.municipio,
        b.autuador, b.origem ?? null, v.medida ?? null, v.considerada ?? null, v.limite ?? null,
        b.guia, b.expedida, b.validade, b.valorOriginal, b.juros, b.valor, b.linhaDigitavel
      );
    });

    // Custos do carro de base.js (só entram se ainda não existirem).
    const custo = db.prepare(
      `INSERT INTO custos_carro (chave, descricao, detalhe, valor, ordem) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT (chave) DO NOTHING`
    );
    base.custosCarro.forEach((c) => custo.run(c.chave, c.descricao, c.detalhe, c.valor, c.ordem));

    // Guias extraídas preenchem o custo correspondente com valor e boleto.
    const aplicarGuia = db.prepare(
      `UPDATE custos_carro SET valor = ?, detalhe = ?, guia = ?, validade = ?, linha_digitavel = ?,
         arquivo = ?, pdf = COALESCE(?, pdf)
       WHERE chave = ?`
    );
    guias.forEach((g) => {
      const chave = base.guiasCarro[g.tipo];
      if (!chave) return;
      aplicarGuia.run(
        g.valor, detalheGuia(g), g.guia, g.validade, g.linhaDigitavel, path.basename(g.arquivo), lerPdf(g.arquivo), chave
      );
      resultado.guias.push(`${chave} (guia ${g.guia})`);
    });
  });

  return resultado;
}

module.exports = { importarBoletos };

if (require.main === module) {
  const { abrir } = require("./db");
  const caminho = process.env.DB_PATH || path.join(RAIZ, "data", "financas.db");
  const resultado = importarBoletos(abrir(caminho));
  console.log(`Boletos importados em ${caminho}:`, resultado);
}
