// Leitura do estado completo e todas as alterações feitas pelo app.
"use strict";

const { transacao } = require("./db");

const MES = /^\d{4}-(0[1-9]|1[0-2])$/;
const DATA = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
const MAX_CENTAVOS = 100_000_000_00; // R$ 100 milhões

class ErroValidacao extends Error {
  constructor(mensagem, status = 400) {
    super(mensagem);
    this.status = status;
  }
}

// ---------- Validação ----------

function texto(valor, campo, max = 120) {
  if (typeof valor !== "string" || !valor.trim()) throw new ErroValidacao(`Informe ${campo}.`);
  const limpo = valor.trim().replace(/\s+/g, " ");
  if (limpo.length > max) throw new ErroValidacao(`${campo} pode ter no máximo ${max} caracteres.`);
  return limpo;
}

function centavos(valor, campo, { minimo = 0 } = {}) {
  if (!Number.isInteger(valor) || valor < minimo || valor > MAX_CENTAVOS) {
    throw new ErroValidacao(`Valor inválido em ${campo}.`);
  }
  return valor;
}

function mes(valor) {
  if (typeof valor !== "string" || !MES.test(valor)) throw new ErroValidacao("Mês inválido. Use AAAA-MM.");
  return valor;
}

function dataOuNulo(valor) {
  if (valor === null) return null;
  if (typeof valor !== "string" || !DATA.test(valor)) throw new ErroValidacao("Data inválida. Use AAAA-MM-DD.");
  return valor;
}

function id(valor) {
  const numero = Number(valor);
  if (!Number.isInteger(numero) || numero <= 0) throw new ErroValidacao("Registro não encontrado.", 404);
  return numero;
}

function exigir(linha, mensagem = "Registro não encontrado.") {
  if (!linha) throw new ErroValidacao(mensagem, 404);
  return linha;
}

function objeto(corpo) {
  if (!corpo || typeof corpo !== "object" || Array.isArray(corpo)) throw new ErroValidacao("Corpo da requisição inválido.");
  return corpo;
}

function proximosMeses(inicio, quantidade) {
  const [ano, m] = inicio.split("-").map(Number);
  return Array.from({ length: quantidade }, (_, i) => {
    const total = ano * 12 + (m - 1) + i;
    return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}`;
  });
}

function mesesEntre(inicio, fim) {
  const [a1, m1] = inicio.split("-").map(Number);
  const [a2, m2] = fim.split("-").map(Number);
  return (a2 - a1) * 12 + (m2 - m1) + 1;
}

// ---------- Leitura ----------

function lerConfig(db) {
  const config = {};
  db.prepare("SELECT chave, valor FROM config").all().forEach((linha) => {
    config[linha.chave] = linha.valor;
  });
  config.cdbTaxaMensal = Number(config.cdbTaxaMensal || 0);
  // Vazio: o salário previsto vem da última folha de pagamento de mês cheio.
  config.salarioPrevisto = config.salarioPrevisto ? Number(config.salarioPrevisto) : null;
  config.reservaMeses = config.reservaMeses ? Number(config.reservaMeses) : 6;
  // Cenário da Projeção: quanto do salário bruto é guardado depois que a dívida zera.
  config.poupancaPercentual = config.poupancaPercentual ? Number(config.poupancaPercentual) : 20;
  return config;
}

function lerHolerites(db) {
  const itens = new Map();
  db.prepare("SELECT holerite_id, codigo, descricao, referencia, vencimento, desconto FROM holerite_itens ORDER BY holerite_id, ordem")
    .all()
    .forEach((i) => {
      if (!itens.has(i.holerite_id)) itens.set(i.holerite_id, []);
      itens.get(i.holerite_id).push({
        codigo: i.codigo,
        descricao: i.descricao,
        referencia: i.referencia,
        vencimento: i.vencimento,
        desconto: i.desconto,
      });
    });
  return db
    .prepare(
      `SELECT id, mes, tipo, competencia, empresa, razao_social, cnpj, funcionario, matricula, cargo, salario_mensal,
              base_inss, base_irrf, fgts, total_vencimentos, total_descontos, liquido, banco, agencia, conta, pago_em, arquivo
       FROM holerites ORDER BY competencia, id`
    )
    .all()
    .map((h) => ({
      id: h.id,
      mes: h.mes,
      tipo: h.tipo,
      competencia: h.competencia,
      empresa: h.empresa,
      razaoSocial: h.razao_social,
      cnpj: h.cnpj,
      funcionario: h.funcionario,
      matricula: h.matricula,
      cargo: h.cargo,
      salarioMensal: h.salario_mensal,
      baseInss: h.base_inss,
      baseIrrf: h.base_irrf,
      fgts: h.fgts,
      totalVencimentos: h.total_vencimentos,
      totalDescontos: h.total_descontos,
      liquido: h.liquido,
      banco: h.banco,
      agencia: h.agencia,
      conta: h.conta,
      pagoEm: h.pago_em,
      arquivo: h.arquivo,
      itens: itens.get(h.id) || [],
    }));
}

function lerEstado(db) {
  const valores = new Map();
  db.prepare("SELECT despesa_id, mes, valor, pago_em, pago_por_credores FROM despesa_valores ORDER BY mes")
    .all()
    .forEach((v) => {
      if (!valores.has(v.despesa_id)) valores.set(v.despesa_id, {});
      valores.get(v.despesa_id)[v.mes] = {
        valor: v.valor,
        pagoEm: v.pago_em,
        pagoPorCredores: v.pago_por_credores === 1,
      };
    });

  const infracoes = {};
  db.prepare("SELECT codigo, descricao, tipo FROM infracoes").all().forEach((i) => {
    infracoes[i.codigo] = { descricao: i.descricao, tipo: i.tipo };
  });

  return {
    config: lerConfig(db),
    grupos: db.prepare("SELECT id, nome, descricao, ordem FROM grupos ORDER BY ordem").all().map((g) => ({ ...g })),
    categorias: db.prepare("SELECT id, nome, ordem FROM categorias_divida ORDER BY ordem").all().map((c) => ({ ...c })),
    despesas: db
      .prepare(
        `SELECT d.id, d.slug, d.grupo_id, d.nome, d.nome_curto, d.categoria_divida, d.pago_aos_credores, d.criada_pelo_usuario,
                d.ordem
         FROM despesas d JOIN grupos g ON g.id = d.grupo_id
         ORDER BY g.ordem, d.ordem, d.id`
      )
      .all()
      .map((d) => ({
        id: d.id,
        slug: d.slug,
        grupoId: d.grupo_id,
        nome: d.nome,
        nomeCurto: d.nome_curto,
        categoriaDivida: d.categoria_divida,
        pagoAosCredores: d.pago_aos_credores === 1,
        criadaPeloUsuario: d.criada_pelo_usuario === 1,
        ordem: d.ordem,
        valores: valores.get(d.id) || {},
      })),
    entradas: db.prepare("SELECT id, mes, descricao, valor FROM entradas ORDER BY mes, id").all().map((e) => ({ ...e })),
    extras: db
      .prepare("SELECT id, mes, descricao, valor, pago_em FROM extras ORDER BY mes, id")
      .all()
      .map((x) => ({ id: x.id, mes: x.mes, descricao: x.descricao, valor: x.valor, pagoEm: x.pago_em })),
    emprestimos: db
      .prepare("SELECT id, mes, descricao, valor, categoria_divida, origem FROM emprestimos ORDER BY mes, id")
      .all()
      .map((e) => ({
        id: e.id,
        mes: e.mes,
        descricao: e.descricao,
        valor: e.valor,
        categoriaDivida: e.categoria_divida,
        origem: e.origem,
      })),
    infracoes,
    multas: db
      .prepare(
        `SELECT serie, placa, situacao, arquivo, pdf IS NOT NULL AS tem_pdf, codigo_infracao, descricao, amparo, pontos,
                infrator, data_infracao, hora_infracao, local, municipio, autuador, origem, velocidade_medida,
                velocidade_considerada, velocidade_limite, guia, expedida, validade, valor_original, juros, valor,
                linha_digitavel, pago_em
         FROM multas ORDER BY serie`
      )
      .all()
      .map((m) => ({
        serie: m.serie,
        placa: m.placa,
        situacao: m.situacao,
        arquivo: m.arquivo,
        temPdf: m.tem_pdf === 1,
        codigoInfracao: m.codigo_infracao,
        descricao: m.descricao,
        amparo: m.amparo,
        pontos: m.pontos,
        infrator: m.infrator,
        dataInfracao: m.data_infracao,
        horaInfracao: m.hora_infracao,
        local: m.local,
        municipio: m.municipio,
        autuador: m.autuador,
        origem: m.origem,
        velocidade:
          m.velocidade_considerada == null
            ? null
            : { medida: m.velocidade_medida, considerada: m.velocidade_considerada, limite: m.velocidade_limite },
        guia: m.guia,
        expedida: m.expedida,
        validade: m.validade,
        valorOriginal: m.valor_original,
        juros: m.juros,
        valor: m.valor,
        linhaDigitavel: m.linha_digitavel,
        pagoEm: m.pago_em,
      })),
    custosCarro: db
      .prepare(
        `SELECT id, chave, descricao, detalhe, valor, pago_em, guia, validade, linha_digitavel, arquivo,
                pdf IS NOT NULL AS tem_pdf, ordem
         FROM custos_carro ORDER BY ordem, id`
      )
      .all()
      .map((c) => ({
        id: c.id,
        chave: c.chave,
        descricao: c.descricao,
        detalhe: c.detalhe,
        valor: c.valor,
        pagoEm: c.pago_em,
        guia: c.guia,
        validade: c.validade,
        linhaDigitavel: c.linha_digitavel,
        arquivo: c.arquivo,
        temPdf: c.tem_pdf === 1,
        ordem: c.ordem,
      })),
    holerites: lerHolerites(db),
    metas: db.prepare("SELECT id, nome, valor, ordem FROM metas ORDER BY ordem, id").all().map((m) => ({ ...m })),
  };
}

function lerPdf(db, serie) {
  return db.prepare("SELECT arquivo, pdf FROM multas WHERE serie = ?").get(serie);
}

function lerPdfCusto(db, custoId) {
  return db.prepare("SELECT arquivo, pdf FROM custos_carro WHERE id = ?").get(Number(custoId));
}

function lerPdfHolerite(db, holeriteId) {
  return db.prepare("SELECT competencia, pdf FROM holerites WHERE id = ?").get(Number(holeriteId));
}

// ---------- Despesas mensais ----------

function despesaExiste(db, despesaId) {
  return exigir(db.prepare("SELECT id, criada_pelo_usuario FROM despesas WHERE id = ?").get(id(despesaId)));
}

// Define (ou remove, com valor 0) o valor de uma despesa em um mês. Usado ao editar o plano de devolução.
function definirValorDespesa(db, despesaId, mesValor, corpo) {
  const despesa = despesaExiste(db, despesaId);
  const m = mes(mesValor);
  const valor = centavos(objeto(corpo).valor, "valor");
  if (valor === 0) {
    db.prepare("DELETE FROM despesa_valores WHERE despesa_id = ? AND mes = ? AND pago_por_credores = 0").run(despesa.id, m);
    return;
  }
  db.prepare(
    `INSERT INTO despesa_valores (despesa_id, mes, valor) VALUES (?, ?, ?)
     ON CONFLICT (despesa_id, mes) DO UPDATE SET valor = excluded.valor`
  ).run(despesa.id, m, valor);
}

function marcarDespesa(db, despesaId, mesValor, corpo) {
  const despesa = despesaExiste(db, despesaId);
  const pagoEm = dataOuNulo(objeto(corpo).pagoEm);
  const { changes } = db
    .prepare("UPDATE despesa_valores SET pago_em = ? WHERE despesa_id = ? AND mes = ? AND pago_por_credores = 0")
    .run(pagoEm, despesa.id, mes(mesValor));
  if (!changes) throw new ErroValidacao("Essa conta não existe neste mês.", 404);
}

function criarDespesa(db, corpo) {
  objeto(corpo);
  const grupo = exigir(db.prepare("SELECT id FROM grupos WHERE id = ?").get(String(corpo.grupoId)), "Grupo não encontrado.");
  const nome = texto(corpo.nome, "o nome");
  const valor = centavos(corpo.valor, "valor", { minimo: 1 });
  const inicio = mes(corpo.mesInicio);
  let categoria = null;
  if (corpo.categoriaDivida != null && corpo.categoriaDivida !== "") {
    categoria = exigir(
      db.prepare("SELECT id FROM categorias_divida WHERE id = ?").get(String(corpo.categoriaDivida)),
      "Categoria de devolução não encontrada."
    ).id;
  }
  if (corpo.pagoAosCredores != null && typeof corpo.pagoAosCredores !== "boolean") {
    throw new ErroValidacao("pagoAosCredores deve ser verdadeiro ou falso.");
  }
  // Devolução já é paga para eles; a marcação "pago direto" é só para contas que não são devolução.
  const direto = !categoria && corpo.pagoAosCredores === true;

  let quantidade;
  if (corpo.parcelas == null || corpo.parcelas === "") {
    // Todo mês até o fim do plano.
    const { planoFim } = lerConfig(db);
    quantidade = Math.max(1, mesesEntre(inicio, planoFim));
  } else {
    quantidade = Number(corpo.parcelas);
    if (!Number.isInteger(quantidade) || quantidade < 1 || quantidade > 120) {
      throw new ErroValidacao("O número de parcelas deve ser entre 1 e 120.");
    }
  }

  transacao(db, () => {
    const { ordem } = db.prepare("SELECT COALESCE(MAX(ordem), 0) + 1 AS ordem FROM despesas").get();
    const { lastInsertRowid } = db
      .prepare(
        `INSERT INTO despesas (grupo_id, nome, nome_curto, categoria_divida, pago_aos_credores, criada_pelo_usuario, ordem)
         VALUES (?, ?, ?, ?, ?, 1, ?)`
      )
      .run(grupo.id, nome, categoria || direto ? nome.slice(0, 24) : null, categoria, direto ? 1 : 0, ordem);
    const inserir = db.prepare("INSERT INTO despesa_valores (despesa_id, mes, valor) VALUES (?, ?, ?)");
    proximosMeses(inicio, quantidade).forEach((m) => inserir.run(lastInsertRowid, m, valor));
  });
}

function removerDespesa(db, despesaId) {
  const despesa = despesaExiste(db, despesaId);
  if (!despesa.criada_pelo_usuario) {
    throw new ErroValidacao("Só dá para remover despesas criadas pelo app. As da planilha ficam no plano.", 403);
  }
  db.prepare("DELETE FROM despesas WHERE id = ?").run(despesa.id);
}

// ---------- Entradas e extras ----------

function criarEntrada(db, corpo) {
  objeto(corpo);
  db.prepare("INSERT INTO entradas (mes, descricao, valor) VALUES (?, ?, ?)").run(
    mes(corpo.mes),
    texto(corpo.descricao, "a descrição"),
    centavos(corpo.valor, "valor")
  );
}

function atualizarEntrada(db, entradaId, corpo) {
  objeto(corpo);
  const entrada = exigir(db.prepare("SELECT id, descricao, valor FROM entradas WHERE id = ?").get(id(entradaId)));
  const descricao = corpo.descricao === undefined ? entrada.descricao : texto(corpo.descricao, "a descrição");
  const valor = corpo.valor === undefined ? entrada.valor : centavos(corpo.valor, "valor");
  db.prepare("UPDATE entradas SET descricao = ?, valor = ? WHERE id = ?").run(descricao, valor, entrada.id);
}

function removerEntrada(db, entradaId) {
  const { changes } = db.prepare("DELETE FROM entradas WHERE id = ?").run(id(entradaId));
  if (!changes) throw new ErroValidacao("Entrada não encontrada.", 404);
}

function criarExtra(db, corpo) {
  objeto(corpo);
  db.prepare("INSERT INTO extras (mes, descricao, valor) VALUES (?, ?, ?)").run(
    mes(corpo.mes),
    texto(corpo.descricao, "a descrição"),
    centavos(corpo.valor, "valor", { minimo: 1 })
  );
}

function atualizarExtra(db, extraId, corpo) {
  objeto(corpo);
  const extra = exigir(db.prepare("SELECT id, descricao, valor, pago_em FROM extras WHERE id = ?").get(id(extraId)));
  const descricao = corpo.descricao === undefined ? extra.descricao : texto(corpo.descricao, "a descrição");
  const valor = corpo.valor === undefined ? extra.valor : centavos(corpo.valor, "valor", { minimo: 1 });
  const pagoEm = corpo.pagoEm === undefined ? extra.pago_em : dataOuNulo(corpo.pagoEm);
  db.prepare("UPDATE extras SET descricao = ?, valor = ?, pago_em = ? WHERE id = ?").run(descricao, valor, pagoEm, extra.id);
}

function removerExtra(db, extraId) {
  const { changes } = db.prepare("DELETE FROM extras WHERE id = ?").run(id(extraId));
  if (!changes) throw new ErroValidacao("Extra não encontrado.", 404);
}

// ---------- Carro e dívida ----------

function marcarMulta(db, serie, corpo) {
  const pagoEm = dataOuNulo(objeto(corpo).pagoEm);
  const { changes } = db.prepare("UPDATE multas SET pago_em = ? WHERE serie = ?").run(pagoEm, String(serie));
  if (!changes) throw new ErroValidacao("Multa não encontrada.", 404);
}

function marcarCustoCarro(db, custoId, corpo) {
  const pagoEm = dataOuNulo(objeto(corpo).pagoEm);
  const { changes } = db.prepare("UPDATE custos_carro SET pago_em = ? WHERE id = ?").run(pagoEm, id(custoId));
  if (!changes) throw new ErroValidacao("Custo não encontrado.", 404);
}

function criarEmprestimo(db, corpo) {
  objeto(corpo);
  const categoria = exigir(
    db.prepare("SELECT id FROM categorias_divida WHERE id = ?").get(String(corpo.categoriaDivida)),
    "Categoria não encontrada."
  );
  db.prepare("INSERT INTO emprestimos (mes, descricao, valor, categoria_divida, origem) VALUES (?, ?, ?, ?, ?)").run(
    mes(corpo.mes),
    texto(corpo.descricao, "a descrição"),
    centavos(corpo.valor, "valor", { minimo: 1 }),
    categoria.id,
    corpo.origem ? texto(corpo.origem, "a origem", 60) : "Outros valores pagos por eles"
  );
}

function removerEmprestimo(db, emprestimoId) {
  const { changes } = db.prepare("DELETE FROM emprestimos WHERE id = ?").run(id(emprestimoId));
  if (!changes) throw new ErroValidacao("Registro não encontrado.", 404);
}

// ---------- Folhas de pagamento ----------

// Guarda a folha já lida do PDF (server/holerite.js). O líquido entra no mês do pagamento
// (ou no mês seguinte à competência, se o recibo não tiver data).
function criarHolerite(db, folha, arquivo, pdf) {
  const competencia = `${folha.competencia.slice(5)}/${folha.competencia.slice(0, 4)}`;
  if (db.prepare("SELECT 1 FROM holerites WHERE tipo = ? AND competencia = ?").get(folha.tipo, folha.competencia)) {
    throw new ErroValidacao(`Essa folha (${folha.tipo} de ${competencia}) já foi enviada. Remova a que está no app para enviar de novo.`, 409);
  }
  const mesDoPagamento = folha.pagoEm ? folha.pagoEm.slice(0, 7) : proximosMeses(folha.competencia, 2)[1];
  transacao(db, () => {
    const { lastInsertRowid } = db
      .prepare(
        `INSERT INTO holerites (mes, tipo, competencia, empresa, razao_social, cnpj, funcionario, matricula, cargo,
           salario_mensal, base_inss, base_irrf, fgts, total_vencimentos, total_descontos, liquido, banco, agencia, conta,
           pago_em, arquivo, pdf)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        mesDoPagamento, folha.tipo, folha.competencia, folha.empresa, folha.razaoSocial, folha.cnpj, folha.funcionario,
        folha.matricula, folha.cargo, folha.salarioMensal, folha.baseInss, folha.baseIrrf, folha.fgts,
        folha.totalVencimentos, folha.totalDescontos, folha.liquido, folha.banco, folha.agencia, folha.conta,
        folha.pagoEm, arquivo, pdf
      );
    const inserirItem = db.prepare(
      `INSERT INTO holerite_itens (holerite_id, ordem, codigo, descricao, referencia, vencimento, desconto)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    );
    folha.itens.forEach((item, i) =>
      inserirItem.run(lastInsertRowid, i + 1, item.codigo, item.descricao, item.referencia, item.vencimento, item.desconto)
    );
  });
}

function removerHolerite(db, holeriteId) {
  const { changes } = db.prepare("DELETE FROM holerites WHERE id = ?").run(id(holeriteId));
  if (!changes) throw new ErroValidacao("Folha de pagamento não encontrada.", 404);
}

module.exports = {
  ErroValidacao,
  // Usados também pelo backoffice.
  validacao: { texto, centavos, mes, dataOuNulo, id, exigir, objeto },
  proximosMeses,
  lerEstado,
  lerPdf,
  lerPdfCusto,
  lerPdfHolerite,
  definirValorDespesa,
  marcarDespesa,
  criarDespesa,
  removerDespesa,
  criarEntrada,
  atualizarEntrada,
  removerEntrada,
  criarExtra,
  atualizarExtra,
  removerExtra,
  marcarMulta,
  marcarCustoCarro,
  criarEmprestimo,
  removerEmprestimo,
  criarHolerite,
  removerHolerite,
};
