// Aba Backoffice: edição direta de tudo o que as outras abas não editam.
// Cada tabela declara os campos que podem ser alterados e como cada um é validado.
"use strict";

const { transacao } = require("./db");
const { ErroValidacao, validacao, proximosMeses } = require("./dados");

const { texto, centavos, mes, dataOuNulo, id, exigir, objeto } = validacao;

const DATA_BR = /^(0[1-9]|[12]\d|3[01])\/(0[1-9]|1[0-2])\/\d{4}$/;
const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;
const CHAVE_TEXTO = /^[\w-]{1,40}$/;

const vazio = (v) => v == null || (typeof v === "string" && !v.trim());

// ---------- Tipos de campo ----------
// Cada tipo valida o valor vindo do app e devolve o que vai para o banco.

const tipo = {
  texto: (max) => (v, nome) => texto(v, nome, max),
  textoOpcional: (max) => (v, nome) => (vazio(v) ? null : texto(v, nome, max)),
  // Colunas NOT NULL que aceitam texto vazio.
  textoLivre: (max) => (v, nome) => (vazio(v) ? "" : texto(v, nome, max)),
  centavos: (minimo = 0) => (v, nome) => centavos(v, nome, { minimo }),
  inteiro: (minimo, maximo) => (v, nome) => {
    if (!Number.isInteger(v) || v < minimo || v > maximo) {
      throw new ErroValidacao(`Confira ${nome}: use um número inteiro entre ${minimo} e ${maximo}.`);
    }
    return v;
  },
  inteiroOpcional: (minimo, maximo) => (v, nome) => (vazio(v) ? null : tipo.inteiro(minimo, maximo)(v, nome)),
  mes: () => (v) => mes(v),
  mesOpcional: () => (v) => (vazio(v) ? null : mes(v)),
  dataPagamento: () => (v) => dataOuNulo(vazio(v) ? null : v),
  dataBr: () => (v, nome) => {
    if (typeof v !== "string" || !DATA_BR.test(v)) throw new ErroValidacao(`Confira ${nome}: use DD/MM/AAAA.`);
    return v;
  },
  dataBrOpcional: () => (v, nome) => (vazio(v) ? null : tipo.dataBr()(v, nome)),
  hora: () => (v, nome) => {
    if (vazio(v)) return null;
    if (typeof v !== "string" || !HORA.test(v)) throw new ErroValidacao(`Confira ${nome}: use HH:MM.`);
    return v;
  },
  booleano: () => (v, nome) => {
    if (typeof v !== "boolean") throw new ErroValidacao(`Confira ${nome}.`);
    return v ? 1 : 0;
  },
  opcao: (opcoes) => (v, nome) => {
    if (!opcoes.includes(v)) throw new ErroValidacao(`Confira ${nome}.`);
    return v;
  },
  // Fração por mês: 0.0117 = 1,17% ao mês.
  taxa: () => (v, nome) => {
    if (typeof v !== "number" || !Number.isFinite(v) || v < 0 || v > 0.2) {
      throw new ErroValidacao(`Informe ${nome} entre 0% e 20% ao mês.`);
    }
    return v;
  },
  grupo: () => (v, nome, db) =>
    exigir(db.prepare("SELECT id FROM grupos WHERE id = ?").get(String(v)), "Grupo não encontrado.").id,
  categoria: () => (v, nome, db) =>
    exigir(db.prepare("SELECT id FROM categorias_divida WHERE id = ?").get(String(v)), "Categoria da dívida não encontrada.").id,
  categoriaOpcional: () => (v, nome, db) => (vazio(v) ? null : tipo.categoria()(v, nome, db)),
};

// importado: o importador de boletos também grava esse campo; alterar marca o registro como editado no app.
const campo = (coluna, nome, validar, { importado = false } = {}) => ({ coluna, nome, validar, importado });

const ordem = campo("ordem", "a ordem", tipo.inteiro(0, 9999));

function slugUnico(db, tabela, nome) {
  const base =
    nome
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "item";
  let slug = base;
  for (let i = 2; db.prepare(`SELECT 1 FROM ${tabela} WHERE id = ?`).get(slug); i++) slug = `${base}-${i}`;
  return slug;
}

const mesBr = (m) => `${m.slice(5)}/${m.slice(0, 4)}`;

// ---------- Tabelas ----------

const ENTIDADES = {
  grupos: {
    tabela: "grupos",
    chave: "id",
    campos: {
      nome: campo("nome", "o nome", tipo.texto(60)),
      descricao: campo("descricao", "a descrição", tipo.textoLivre(200)),
      ordem,
    },
    criar: { campos: ["nome"], chave: (db, corpo) => slugUnico(db, "grupos", corpo.nome) },
    remover(db, chave) {
      const { n } = db.prepare("SELECT COUNT(*) AS n FROM despesas WHERE grupo_id = ?").get(chave);
      if (n) throw new ErroValidacao(`Esse grupo tem ${n} ${n === 1 ? "despesa" : "despesas"}. Mude o grupo delas antes de remover.`);
    },
  },

  "categorias-divida": {
    tabela: "categorias_divida",
    chave: "id",
    campos: {
      nome: campo("nome", "o nome", tipo.texto(60)),
      ordem,
    },
    criar: { campos: ["nome"], chave: (db, corpo) => slugUnico(db, "categorias_divida", corpo.nome) },
    remover(db, chave) {
      const usos = db
        .prepare(
          `SELECT (SELECT COUNT(*) FROM despesas WHERE categoria_divida = ?) +
                  (SELECT COUNT(*) FROM emprestimos WHERE categoria_divida = ?) +
                  (SELECT COUNT(*) FROM config WHERE chave IN ('categoriaCarro', 'categoriaContasPagasPorCredores') AND valor = ?) AS n`
        )
        .get(chave, chave, chave).n;
      if (usos) throw new ErroValidacao("Essa categoria está em uso (despesas, valores pagos por eles ou configurações).");
    },
  },

  despesas: {
    tabela: "despesas",
    chave: "id",
    numerica: true,
    campos: {
      nome: campo("nome", "o nome", tipo.texto(120)),
      nomeCurto: campo("nome_curto", "o nome curto", tipo.textoOpcional(24)),
      grupoId: campo("grupo_id", "o grupo", tipo.grupo()),
      categoriaDivida: campo("categoria_divida", "a categoria da devolução", tipo.categoriaOpcional()),
      pagoAosCredores: campo("pago_aos_credores", "Pago direto a eles", tipo.booleano()),
      ordem,
    },
    criar: { campos: ["nome", "grupoId"], fixos: { criada_pelo_usuario: 1 } },
    remover: true,
  },

  entradas: {
    tabela: "entradas",
    chave: "id",
    numerica: true,
    campos: {
      mes: campo("mes", "o mês", tipo.mes()),
      descricao: campo("descricao", "a descrição", tipo.texto(120)),
      valor: campo("valor", "valor", tipo.centavos()),
    },
    criar: { campos: ["mes", "descricao", "valor"] },
    remover: true,
  },

  extras: {
    tabela: "extras",
    chave: "id",
    numerica: true,
    campos: {
      mes: campo("mes", "o mês", tipo.mes()),
      descricao: campo("descricao", "a descrição", tipo.texto(120)),
      valor: campo("valor", "valor", tipo.centavos(1)),
      pagoEm: campo("pago_em", "a data do pagamento", tipo.dataPagamento()),
    },
    criar: { campos: ["mes", "descricao", "valor"] },
    remover: true,
  },

  emprestimos: {
    tabela: "emprestimos",
    chave: "id",
    numerica: true,
    campos: {
      mes: campo("mes", "o mês", tipo.mesOpcional()),
      descricao: campo("descricao", "a descrição", tipo.texto(120)),
      valor: campo("valor", "valor", tipo.centavos(1)),
      categoriaDivida: campo("categoria_divida", "a parte da dívida", tipo.categoria()),
      origem: campo("origem", "a origem", tipo.texto(60)),
    },
    criar: { campos: ["mes", "descricao", "valor", "categoriaDivida", "origem"] },
    remover: true,
  },

  infracoes: {
    tabela: "infracoes",
    chave: "codigo",
    campos: {
      descricao: campo("descricao", "a descrição", tipo.texto(120), { importado: true }),
      tipo: campo("tipo", "o tipo", tipo.texto(40), { importado: true }),
    },
    criar: {
      campos: ["descricao", "tipo"],
      chave(db, corpo) {
        const codigo = typeof corpo.codigo === "string" ? corpo.codigo.trim() : "";
        if (!CHAVE_TEXTO.test(codigo)) throw new ErroValidacao("Informe o código da infração (só letras, números e hífen).");
        if (db.prepare("SELECT 1 FROM infracoes WHERE codigo = ?").get(codigo)) {
          throw new ErroValidacao("Já existe uma infração com esse código.");
        }
        return codigo;
      },
    },
    remover: true,
  },

  // Multas vêm dos PDFs: o importador traria de volta uma multa removida, então aqui só se edita.
  multas: {
    tabela: "multas",
    chave: "serie",
    campos: {
      situacao: campo("situacao", "a situação", tipo.opcao(["a-vencer", "vencidos"]), { importado: true }),
      valorOriginal: campo("valor_original", "valor original", tipo.centavos(), { importado: true }),
      juros: campo("juros", "juros", tipo.centavos(), { importado: true }),
      valor: campo("valor", "valor", tipo.centavos(), { importado: true }),
      validade: campo("validade", "a validade", tipo.dataBr(), { importado: true }),
      pagoEm: campo("pago_em", "a data do pagamento", tipo.dataPagamento()),
      linhaDigitavel: campo("linha_digitavel", "a linha digitável", tipo.textoOpcional(80), { importado: true }),
      guia: campo("guia", "o número da guia", tipo.textoOpcional(40), { importado: true }),
      expedida: campo("expedida", "a data de expedição", tipo.dataBrOpcional(), { importado: true }),
      codigoInfracao: campo("codigo_infracao", "o código da infração", tipo.texto(12), { importado: true }),
      descricao: campo("descricao", "a descrição", tipo.texto(200), { importado: true }),
      amparo: campo("amparo", "o amparo legal", tipo.textoOpcional(120), { importado: true }),
      pontos: campo("pontos", "os pontos", tipo.inteiroOpcional(0, 99), { importado: true }),
      dataInfracao: campo("data_infracao", "a data da infração", tipo.dataBr(), { importado: true }),
      horaInfracao: campo("hora_infracao", "a hora da infração", tipo.hora(), { importado: true }),
      local: campo("local", "o local", tipo.textoOpcional(200), { importado: true }),
      municipio: campo("municipio", "o município", tipo.textoOpcional(120), { importado: true }),
      autuador: campo("autuador", "o autuador", tipo.textoOpcional(120), { importado: true }),
      infrator: campo("infrator", "o infrator", tipo.textoOpcional(120), { importado: true }),
      placa: campo("placa", "a placa", tipo.textoOpcional(10), { importado: true }),
      origem: campo("origem", "a multa de origem", tipo.textoOpcional(12), { importado: true }),
      velocidadeMedida: campo("velocidade_medida", "a velocidade medida", tipo.inteiroOpcional(0, 400), { importado: true }),
      velocidadeConsiderada: campo("velocidade_considerada", "a velocidade considerada", tipo.inteiroOpcional(0, 400), {
        importado: true,
      }),
      velocidadeLimite: campo("velocidade_limite", "o limite de velocidade", tipo.inteiroOpcional(0, 400), { importado: true }),
    },
  },

  "custos-carro": {
    tabela: "custos_carro",
    chave: "id",
    numerica: true,
    campos: {
      descricao: campo("descricao", "a descrição", tipo.texto(60)),
      detalhe: campo("detalhe", "o detalhe", tipo.textoLivre(200), { importado: true }),
      valor: campo("valor", "valor", tipo.centavos(), { importado: true }),
      validade: campo("validade", "a validade", tipo.dataBrOpcional(), { importado: true }),
      pagoEm: campo("pago_em", "a data do pagamento", tipo.dataPagamento()),
      linhaDigitavel: campo("linha_digitavel", "a linha digitável", tipo.textoOpcional(80), { importado: true }),
      guia: campo("guia", "o número da guia", tipo.textoOpcional(40), { importado: true }),
      ordem,
    },
    criar: { campos: ["descricao", "valor"] },
    remover(db, chave) {
      const custo = db.prepare("SELECT chave FROM custos_carro WHERE id = ?").get(chave);
      if (custo && custo.chave) {
        throw new ErroValidacao("CRLV e pátio voltariam no próximo deploy. Para tirar da conta, zere o valor.");
      }
    },
  },


  // Folhas de pagamento: entram pelo envio do PDF (aba Salário); aqui se corrige o que foi lido.
  holerites: {
    tabela: "holerites",
    chave: "id",
    numerica: true,
    campos: {
      mes: campo("mes", "o mês em que o líquido entra", tipo.mes()),
      liquido: campo("liquido", "líquido", tipo.centavos()),
      pagoEm: campo("pago_em", "a data do pagamento", tipo.dataPagamento()),
      tipo: campo("tipo", "o tipo da folha", tipo.texto(60)),
      competencia: campo("competencia", "a competência", tipo.mes()),
      salarioMensal: campo("salario_mensal", "salário mensal", tipo.centavos()),
      totalVencimentos: campo("total_vencimentos", "total de vencimentos", tipo.centavos()),
      totalDescontos: campo("total_descontos", "total de descontos", tipo.centavos()),
      baseInss: campo("base_inss", "base do INSS", tipo.centavos()),
      baseIrrf: campo("base_irrf", "base do IRRF", tipo.centavos()),
      fgts: campo("fgts", "FGTS", tipo.centavos()),
      empresa: campo("empresa", "a empresa", tipo.textoLivre(120)),
      razaoSocial: campo("razao_social", "a razão social", tipo.textoLivre(120)),
      cnpj: campo("cnpj", "o CNPJ", tipo.textoLivre(20)),
      funcionario: campo("funcionario", "o funcionário", tipo.textoLivre(120)),
      matricula: campo("matricula", "a matrícula", tipo.textoLivre(20)),
      cargo: campo("cargo", "o cargo", tipo.textoLivre(120)),
      banco: campo("banco", "o banco", tipo.textoOpcional(60)),
      agencia: campo("agencia", "a agência", tipo.textoOpcional(20)),
      conta: campo("conta", "a conta", tipo.textoOpcional(30)),
    },
    remover: true,
  },
};

// Valores de uma despesa em cada mês (chave composta: despesa + mês).
const CAMPOS_VALOR_MES = {
  valor: campo("valor", "valor", tipo.centavos(1)),
  pagoEm: campo("pago_em", "a data do pagamento", tipo.dataPagamento()),
  pagoPorCredores: campo("pago_por_credores", "Pago pela Greici e pelo André", tipo.booleano()),
};

const CONFIG = {
  credores: ["o nome dos credores", tipo.texto(60)],
  categoriaContasPagasPorCredores: ["a categoria das contas pagas por eles", tipo.categoria()],
  categoriaCarro: ["a categoria do carro", tipo.categoria()],
  planoInicio: ["o início do plano", tipo.mes()],
  planoFim: ["o fim do plano", tipo.mes()],
  cdbTaxaMensal: ["a taxa do CDB", tipo.taxa()],
  cdbInicio: ["o início do CDB", tipo.mesOpcional()],
  placa: ["a placa", tipo.textoOpcional(10)],
};

// ---------- Operações ----------

function entidade(nome) {
  if (!Object.hasOwn(ENTIDADES, nome)) throw new ErroValidacao("Tabela não encontrada.", 404);
  return ENTIDADES[nome];
}

function chave(e, valor) {
  if (e.numerica) return id(valor);
  if (!CHAVE_TEXTO.test(String(valor))) throw new ErroValidacao("Registro não encontrado.", 404);
  return String(valor);
}

// Monta o SET de um UPDATE com os campos enviados.
function alteracoes(db, campos, corpo) {
  const pares = Object.entries(objeto(corpo));
  if (!pares.length) throw new ErroValidacao("Nada para salvar.");
  const sets = [];
  const valores = [];
  let importado = false;
  pares.forEach(([nome, valor]) => {
    if (!Object.hasOwn(campos, nome)) throw new ErroValidacao(`Campo desconhecido: ${nome}.`);
    const def = campos[nome];
    sets.push(`${def.coluna} = ?`);
    valores.push(def.validar(valor, def.nome, db));
    importado = importado || def.importado;
  });
  return { sets, valores, importado };
}

function atualizar(db, nome, valorChave, corpo) {
  const e = entidade(nome);
  const { sets, valores, importado } = alteracoes(db, e.campos, corpo);
  if (importado) sets.push("editado_no_app = 1");
  let changes;
  try {
    ({ changes } = db.prepare(`UPDATE ${e.tabela} SET ${sets.join(", ")} WHERE ${e.chave} = ?`).run(...valores, chave(e, valorChave)));
  } catch (erro) {
    if (/UNIQUE constraint failed/.test(erro.message)) throw new ErroValidacao("Já existe outro registro com esses dados.", 409);
    throw erro;
  }
  if (!changes) throw new ErroValidacao("Registro não encontrado.", 404);
}

function criar(db, nome, corpo) {
  const e = entidade(nome);
  if (!e.criar) throw new ErroValidacao("Não dá para adicionar registros nessa tabela.", 405);
  objeto(corpo);
  const colunas = [];
  const valores = [];
  e.criar.campos.forEach((nomeCampo) => {
    const def = e.campos[nomeCampo];
    colunas.push(def.coluna);
    valores.push(def.validar(corpo[nomeCampo], def.nome, db));
  });
  if (e.criar.chave) {
    colunas.push(e.chave);
    valores.push(e.criar.chave(db, corpo));
  }
  if (e.campos.ordem) {
    colunas.push("ordem");
    valores.push(db.prepare(`SELECT COALESCE(MAX(ordem), 0) + 1 AS ordem FROM ${e.tabela}`).get().ordem);
  }
  Object.entries(e.criar.fixos || {}).forEach(([coluna, valor]) => {
    colunas.push(coluna);
    valores.push(valor);
  });
  db.prepare(`INSERT INTO ${e.tabela} (${colunas.join(", ")}) VALUES (${colunas.map(() => "?").join(", ")})`).run(...valores);
}

function remover(db, nome, valorChave) {
  const e = entidade(nome);
  if (!e.remover) throw new ErroValidacao("Não dá para remover registros dessa tabela.", 405);
  const k = chave(e, valorChave);
  if (typeof e.remover === "function") e.remover(db, k);
  const { changes } = db.prepare(`DELETE FROM ${e.tabela} WHERE ${e.chave} = ?`).run(k);
  if (!changes) throw new ErroValidacao("Registro não encontrado.", 404);
}

function despesa(db, despesaId) {
  return exigir(db.prepare("SELECT id FROM despesas WHERE id = ?").get(id(despesaId)), "Despesa não encontrada.");
}

// Acrescenta o mesmo valor em um ou mais meses seguidos.
function criarValoresMes(db, despesaId, corpo) {
  const { id: alvo } = despesa(db, despesaId);
  objeto(corpo);
  const inicio = mes(corpo.mes);
  const valor = centavos(corpo.valor, "valor", { minimo: 1 });
  const quantidade = corpo.meses == null ? 1 : tipo.inteiro(1, 120)(corpo.meses, "a quantidade de meses");
  transacao(db, () => {
    const existe = db.prepare("SELECT 1 FROM despesa_valores WHERE despesa_id = ? AND mes = ?");
    const inserir = db.prepare("INSERT INTO despesa_valores (despesa_id, mes, valor) VALUES (?, ?, ?)");
    proximosMeses(inicio, quantidade).forEach((m) => {
      if (existe.get(alvo, m)) throw new ErroValidacao(`Essa despesa já tem valor em ${mesBr(m)}. Altere direto na tabela.`);
      inserir.run(alvo, m, valor);
    });
  });
}

function atualizarValorMes(db, despesaId, mesValor, corpo) {
  const { id: alvo } = despesa(db, despesaId);
  const { sets, valores } = alteracoes(db, CAMPOS_VALOR_MES, corpo);
  const { changes } = db
    .prepare(`UPDATE despesa_valores SET ${sets.join(", ")} WHERE despesa_id = ? AND mes = ?`)
    .run(...valores, alvo, mes(mesValor));
  if (!changes) throw new ErroValidacao("Essa despesa não tem valor nesse mês.", 404);
}

function removerValorMes(db, despesaId, mesValor) {
  const { id: alvo } = despesa(db, despesaId);
  const { changes } = db.prepare("DELETE FROM despesa_valores WHERE despesa_id = ? AND mes = ?").run(alvo, mes(mesValor));
  if (!changes) throw new ErroValidacao("Essa despesa não tem valor nesse mês.", 404);
}

function atualizarConfig(db, corpo) {
  const pares = Object.entries(objeto(corpo));
  if (!pares.length) throw new ErroValidacao("Nada para salvar.");
  transacao(db, () => {
    const gravar = db.prepare(
      "INSERT INTO config (chave, valor) VALUES (?, ?) ON CONFLICT (chave) DO UPDATE SET valor = excluded.valor"
    );
    pares.forEach(([chaveConfig, valor]) => {
      if (!Object.hasOwn(CONFIG, chaveConfig)) throw new ErroValidacao(`Configuração desconhecida: ${chaveConfig}.`);
      const [nome, validar] = CONFIG[chaveConfig];
      gravar.run(chaveConfig, String(validar(valor, nome, db) ?? ""));
    });
    const linha = (k) => (db.prepare("SELECT valor FROM config WHERE chave = ?").get(k) || {}).valor;
    if (linha("planoInicio") > linha("planoFim")) throw new ErroValidacao("O início do plano precisa ser antes do fim.");
  });
}

module.exports = {
  atualizar,
  criar,
  remover,
  criarValoresMes,
  atualizarValorMes,
  removerValorMes,
  atualizarConfig,
};
