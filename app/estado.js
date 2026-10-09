// Dados vindos do servidor e tudo o que é calculado a partir deles.
(function () {
  "use strict";

  const App = window.App;

  App.dados = null; // estado completo devolvido pela API
  App.calc = null; // números derivados (saldos, dívida...)

  // ---------- API ----------

  App.api = async (metodo, caminho, corpo) => {
    const opcoes = { method: metodo, headers: {}, credentials: "same-origin" };
    if (corpo instanceof Blob) {
      // Arquivo (folha de pagamento): vai como está, com o nome no cabeçalho.
      opcoes.headers["Content-Type"] = corpo.type || "application/pdf";
      opcoes.headers["X-Nome-Arquivo"] = encodeURIComponent(corpo.name || "");
      opcoes.body = corpo;
    } else if (corpo !== undefined) {
      opcoes.headers["Content-Type"] = "application/json";
      opcoes.body = JSON.stringify(corpo);
    }
    let resposta;
    try {
      resposta = await fetch(caminho, opcoes);
    } catch (e) {
      throw new Error("Sem conexão com o servidor. Tente de novo.");
    }
    if (resposta.status === 401) {
      location.href = "/login";
      throw new Error("Sua sessão expirou.");
    }
    const resultado = await resposta.json().catch(() => ({}));
    if (!resposta.ok) throw new Error(resultado.erro || "Não foi possível salvar.");
    return resultado;
  };

  function definir(dados) {
    App.dados = dados;
    App.calc = calcular(dados);
  }

  App.carregar = async () => definir(await App.api("GET", "/api/estado"));

  // Recalcula depois de uma mudança feita localmente, antes de a resposta do servidor chegar.
  App.recalcular = () => {
    App.calc = calcular(App.dados);
  };

  // Alterações vão uma de cada vez, na ordem em que foram feitas.
  let fila = Promise.resolve();

  App.salvar = (metodo, caminho, corpo, opcoes = {}) => {
    const { renderizar = true, mensagem, desfazer } = opcoes;
    const tarefa = fila.then(async () => {
      try {
        definir(await App.api(metodo, caminho, corpo));
        if (renderizar) App.renderAtual();
        if (mensagem) App.toast(mensagem, desfazer);
        return true;
      } catch (erro) {
        App.toast(erro.message);
        try {
          await App.carregar();
        } catch (e) {
          /* mantém o que estava na tela */
        }
        App.renderAtual();
        return false;
      }
    });
    fila = tarefa;
    return tarefa;
  };

  // ---------- Meses ----------

  function proximoMes(mes) {
    let [a, m] = mes.split("-").map(Number);
    m++;
    if (m > 12) {
      m = 1;
      a++;
    }
    return `${a}-${String(m).padStart(2, "0")}`;
  }
  App.proximoMes = proximoMes;

  function listaMeses(d) {
    let inicio = d.config.planoInicio;
    let fim = d.config.planoFim;
    const usados = [
      ...d.entradas.map((e) => e.mes),
      ...d.extras.map((x) => x.mes),
      ...d.holerites.map((h) => h.mes),
      ...d.despesas.flatMap((x) => Object.keys(x.valores)),
    ];
    usados.forEach((m) => {
      if (m < inicio) inicio = m;
      if (m > fim) fim = m;
    });
    const meses = [inicio];
    while (meses[meses.length - 1] < fim) meses.push(proximoMes(meses[meses.length - 1]));
    return meses;
  }

  // ---------- Cálculos ----------

  function calcular(d) {
    const meses = listaMeses(d);
    const indice = new Map(meses.map((m, i) => [m, i]));
    const porMes = meses.map((mes) => ({
      mes,
      entradas: 0,
      despesas: 0,
      extras: 0,
      pagoPorCredores: 0,
      qtd: 0,
      qtdPagas: 0,
      valorPago: 0,
    }));

    d.entradas.forEach((e) => {
      porMes[indice.get(e.mes)].entradas += e.valor;
    });
    // O líquido de cada folha de pagamento entra no mês em que foi pago.
    d.holerites.forEach((h) => {
      porMes[indice.get(h.mes)].entradas += h.liquido;
    });
    d.despesas.forEach((despesa) =>
      Object.entries(despesa.valores).forEach(([mes, v]) => {
        const p = porMes[indice.get(mes)];
        if (v.pagoPorCredores) {
          p.pagoPorCredores += v.valor;
          return;
        }
        p.despesas += v.valor;
        p.qtd++;
        if (v.pagoEm) {
          p.qtdPagas++;
          p.valorPago += v.valor;
        }
      })
    );
    d.extras.forEach((x) => {
      const p = porMes[indice.get(x.mes)];
      p.extras += x.valor;
      p.qtd++;
      if (x.pagoEm) {
        p.qtdPagas++;
        p.valorPago += x.valor;
      }
    });

    const taxa = d.config.cdbTaxaMensal || 0;
    let acumulado = 0;
    let composto = null;
    porMes.forEach((p) => {
      p.totalDespesas = p.despesas + p.extras;
      p.saldo = p.entradas - p.totalDespesas;
      acumulado += p.saldo;
      p.acumulado = acumulado;
      if (d.config.cdbInicio && p.mes >= d.config.cdbInicio) {
        // Fórmula da planilha: 1 mês de rendimento sobre o saldo acumulado.
        p.cdbSimples = Math.round(acumulado * (1 + taxa));
        // Juros compostos: o rendimento de cada mês também rende nos seguintes.
        composto = composto == null ? acumulado * (1 + taxa) : (composto + p.saldo) * (1 + taxa);
        p.cdbComposto = Math.round(composto);
      } else {
        p.cdbSimples = null;
        p.cdbComposto = null;
      }
    });

    return { meses, indice, porMes, divida: calcularDivida(d), carro: calcularCarro(d) };
  }

  function calcularCarro(d) {
    const itens = [...d.multas, ...d.custosCarro];
    const total = itens.reduce((s, x) => s + x.valor, 0);
    const pagos = itens.filter((x) => x.pagoEm);
    const pago = pagos.reduce((s, x) => s + x.valor, 0);
    return { total, pago, emAberto: total - pago, qtdTotal: itens.length, qtdPagos: pagos.length };
  }

  function calcularDivida(d) {
    const categorias = new Map(
      d.categorias.map((c) => [c.id, { ...c, pagoPorEles: 0, previsto: 0, plano: 0, devolvido: 0 }])
    );
    const somar = (id, campo, valor) => {
      const c = categorias.get(id);
      if (c) c[campo] += valor;
    };

    const categoriaContas = d.config.categoriaContasPagasPorCredores;
    d.despesas.forEach((despesa) =>
      Object.values(despesa.valores).forEach((v) => {
        if (!v.pagoPorCredores) return;
        somar(categoriaContas, "pagoPorEles", v.valor);
        somar(categoriaContas, "previsto", v.valor);
      })
    );
    d.emprestimos.forEach((e) => {
      somar(e.categoriaDivida, "pagoPorEles", e.valor);
      somar(e.categoriaDivida, "previsto", e.valor);
    });
    [...d.multas, ...d.custosCarro].forEach((x) => {
      somar(d.config.categoriaCarro, "previsto", x.valor);
      if (x.pagoEm) somar(d.config.categoriaCarro, "pagoPorEles", x.valor);
    });

    const devolucoes = d.despesas.filter((x) => x.categoriaDivida);
    let qtdParcelas = 0;
    let qtdDevolvidas = 0;
    devolucoes.forEach((despesa) =>
      Object.values(despesa.valores).forEach((v) => {
        somar(despesa.categoriaDivida, "plano", v.valor);
        qtdParcelas++;
        if (v.pagoEm) {
          somar(despesa.categoriaDivida, "devolvido", v.valor);
          qtdDevolvidas++;
        }
      })
    );

    const lista = [...categorias.values()];
    const total = (campo) => lista.reduce((s, c) => s + c[campo], 0);
    const mesesPlano = [...new Set(devolucoes.flatMap((x) => Object.keys(x.valores)))].sort();
    return {
      categorias: lista,
      devolucoes,
      // Pagas direto para eles junto com a devolução, mas fora da dívida.
      contasDiretas: d.despesas.filter((x) => x.pagoAosCredores && !x.categoriaDivida),
      mesesPlano,
      pagoPorEles: total("pagoPorEles"),
      previsto: total("previsto"),
      plano: total("plano"),
      devolvido: total("devolvido"),
      qtdParcelas,
      qtdDevolvidas,
    };
  }

  // ---------- Consultas usadas pelas telas ----------

  App.mesDados = (mes) => App.calc.porMes[App.calc.indice.get(mes)];

  // Sequência de meses seguidos com valor que contém o mês pedido.
  App.parcela = (despesa, mes) => {
    if (!despesa.valores[mes]) return null;
    const { meses, indice } = App.calc;
    const ultimo = meses.length - 1;
    const i = indice.get(mes);
    let inicio = i;
    while (inicio > 0 && despesa.valores[meses[inicio - 1]]) inicio--;
    let fim = i;
    while (fim < ultimo && despesa.valores[meses[fim + 1]]) fim++;
    if (fim === ultimo) return { recorrente: true };
    return { numero: i - inicio + 1, total: fim - inicio + 1, fim: meses[fim] };
  };

  // "Folha Mensal de 08/2026"
  App.nomeFolha = (h) => `${h.tipo} de ${h.competencia.slice(5)}/${h.competencia.slice(0, 4)}`;

  App.nomeCategoria = (id) => {
    const c = App.dados.categorias.find((x) => x.id === id);
    return c ? c.nome : id;
  };
})();
