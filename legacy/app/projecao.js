// Aba "Projeção": para onde o plano leva o dinheiro (guardado, dívida e patrimônio), com metas e simulador.
(function () {
  "use strict";

  const App = window.App;
  const { $, $$, esc, reais, plural, htmlAvisos, htmlSecao, juntar } = App;

  const CHAVE_VISAO = "projecao.visao.v1";
  const VISOES = ["12-meses", "tudo"];
  const visaoSalva = App.ler(CHAVE_VISAO, "12-meses");

  const SIM_VAZIA = { renda: 0, rendaInicio: null, gasto: 0, antecipar: 0, taxa: null };

  const estado = {
    visao: VISOES.includes(visaoSalva) ? visaoSalva : "12-meses",
    anosAbertos: new Set([App.mesAtual.slice(0, 4)]),
    sim: { ...SIM_VAZIA }, // simulador: só muda o que a aba mostra, nada é salvo
  };

  const d = () => App.dados;
  const c = () => App.calc;
  const soma = (lista) => lista.reduce((total, v) => total + (v || 0), 0);
  const simulando = () => Boolean(estado.sim.renda || estado.sim.gasto || estado.sim.antecipar || estado.sim.taxa != null);
  const percentual = (fracao) => `${(fracao * 100).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`;

  // ---------- Cálculo ----------

  // IR do CDB pelo tempo aplicado (tabela regressiva): até 180 dias, 22,5%; até 360, 20%; até 720, 17,5%; depois, 15%.
  function aliquota(meses) {
    if (meses <= 6) return 0.225;
    if (meses <= 12) return 0.2;
    if (meses <= 24) return 0.175;
    return 0.15;
  }

  // CDB: antes do início o dinheiro fica parado; depois, o aporte de cada mês vira um lote que rende e paga IR
  // pelo próprio tempo aplicado. Aporte negativo (mês no vermelho) resgata dos lotes mais antigos.
  function investir(meses, aportes, taxa) {
    const inicio = d().config.cdbInicio;
    const lotes = [];
    let parado = 0;
    let descoberto = 0;
    function movimentar(valor) {
      if (valor >= 0) {
        const cobre = Math.min(descoberto, valor);
        descoberto -= cobre;
        if (valor - cobre > 0) lotes.push({ aplicado: valor - cobre, valor: valor - cobre, idade: 0 });
        return;
      }
      let falta = -valor;
      while (falta > 0 && lotes.length) {
        const lote = lotes[0];
        if (lote.valor <= falta) {
          falta -= lote.valor;
          lotes.shift();
        } else {
          lote.aplicado *= 1 - falta / lote.valor;
          lote.valor -= falta;
          falta = 0;
        }
      }
      descoberto += falta;
    }

    return meses.map((mes, i) => {
      if (!inicio || mes < inicio) {
        parado += aportes[i];
        return { guardado: Math.round(parado), rendimento: 0, ir: 0 };
      }
      movimentar(parado + aportes[i]);
      parado = 0;
      lotes.forEach((lote) => {
        lote.valor *= 1 + taxa;
        lote.idade++;
      });
      const bruto = soma(lotes.map((l) => l.valor));
      const ir = soma(lotes.map((l) => Math.max(0, l.valor - l.aplicado) * aliquota(l.idade)));
      return {
        guardado: Math.round(bruto - ir - descoberto),
        rendimento: Math.round(bruto - soma(lotes.map((l) => l.aplicado))),
        ir: Math.round(ir),
      };
    });
  }

  // Salário bruto de cada mês: o da folha mensal daquele mês ou, sem ela, o da folha mensal mais recente.
  function salarioBruto() {
    const folhas = d().holerites.filter((h) => /mensal/i.test(h.tipo) && h.salarioMensal);
    const recente = [...folhas].sort((a, b) => b.competencia.localeCompare(a.competencia) || b.id - a.id)[0];
    const base = recente ? recente.salarioMensal : null;
    const porMes = new Map(folhas.map((h) => [h.mes, h.salarioMensal]));
    return { base, doMes: (mes) => (porMes.has(mes) ? porMes.get(mes) : base) };
  }

  // Livre das dívidas: o mês em que a última parcela zera o que falta devolver (0: já livre; -1: não zera).
  function indiceLivre(linhas) {
    const iUltimaDivida = linhas.reduce((acc, l, i) => (l.faltaDevolver > 0 ? i : acc), -1);
    if (iUltimaDivida === -1) return 0;
    return iUltimaDivida < linhas.length - 1 ? iUltimaDivida + 1 : -1;
  }

  const nomeCenario = () => `Investindo ${d().config.poupancaPercentual}% do bruto`;

  // Mês a mês: o plano (App.calc) com os ajustes do simulador, o CDB já sem IR, a dívida com a Greici e o André
  // e o cenário em que, depois da dívida, só uma parte do salário bruto é guardada.
  function projetar(sim) {
    const config = d().config;
    const { porMes, divida } = c();
    const taxa = sim.taxa != null ? sim.taxa : config.cdbTaxaMensal || 0;
    const inicioRenda = sim.rendaInicio || App.mesAtual;

    // Parcelas de devolução por mês. Nos meses que já passaram, só conta o que foi marcado como pago.
    const devolucao = new Map();
    divida.devolucoes.forEach((despesa) =>
      Object.entries(despesa.valores).forEach(([mes, v]) => {
        if (mes < App.mesAtual && !v.pagoEm) return;
        devolucao.set(mes, (devolucao.get(mes) || 0) + v.valor);
      })
    );

    let faltaDevolver = divida.previsto;
    let acumulado = 0;
    const linhas = porMes.map((p) => {
      const futuro = p.mes >= App.mesAtual;
      const entradas = p.entradas + (futuro && p.mes >= inicioRenda ? sim.renda : 0);
      let despesas = p.totalDespesas + (futuro ? sim.gasto : 0);

      // Antecipar: além da parcela, paga o valor extra até a dívida zerar; depois disso as parcelas somem.
      const planejada = devolucao.get(p.mes) || 0;
      let devolvida = planejada;
      if (sim.antecipar && futuro) {
        devolvida = Math.min(Math.max(0, faltaDevolver), planejada + sim.antecipar);
        despesas += devolvida - planejada;
      }
      faltaDevolver -= devolvida;

      const saldo = entradas - despesas;
      acumulado += saldo;
      return {
        mes: p.mes,
        futuro,
        entradas,
        salarioPrevisto: p.salarioPrevisto,
        despesas,
        saldo,
        acumulado,
        faltaDevolver: Math.max(0, Math.round(faltaDevolver)),
      };
    });

    const meses = linhas.map((l) => l.mes);
    investir(meses, linhas.map((l) => l.saldo), taxa).forEach((v, i) => {
      Object.assign(linhas[i], v, { patrimonio: v.guardado - linhas[i].faltaDevolver });
    });

    // Cenário: até a dívida zerar, igual ao plano. Depois, de hoje em diante, investe no CDB só X% do salário
    // bruto (ou a sobra, se for menor); o resto da sobra fica na conta, sem render. Mês no vermelho tira primeiro
    // da conta e depois do investimento.
    const livre = indiceLivre(linhas);
    const fracao = config.poupancaPercentual / 100;
    const bruto = salarioBruto();
    let conta = 0;
    const aportes = linhas.map((l, i) => {
      const salario = bruto.doMes(l.mes);
      let aporte = l.saldo;
      if (livre >= 0 && i > livre && l.futuro && salario != null) {
        if (l.saldo >= 0) {
          aporte = Math.min(l.saldo, Math.round(fracao * salario));
          conta += l.saldo - aporte;
        } else {
          const daConta = Math.min(conta, -l.saldo);
          conta -= daConta;
          aporte = l.saldo + daConta;
        }
      }
      l.contaCenario = conta;
      return aporte;
    });
    investir(meses, aportes, taxa).forEach((v, i) => {
      const l = linhas[i];
      l.investidoCenario = v.guardado;
      // A reserva de emergência do cenário é só o que está investido; as outras metas contam também a conta.
      l.reservaCenario = v.guardado - l.faltaDevolver;
      l.patrimonioCenario = v.guardado + l.contaCenario - l.faltaDevolver;
    });
    return linhas;
  }

  // Números de resumo de uma projeção.
  function resumir(linhas) {
    const config = d().config;
    const ultimo = linhas.length - 1;
    const iHoje = Math.max(0, linhas.findIndex((l) => l.mes === App.mesAtual));
    const iPrimeiro = Math.max(0, c().porMes.findIndex((p) => p.entradas || p.totalDespesas));
    const livre = indiceLivre(linhas);

    // Fim das parcelas que não são devolução (as de devolução acabam quando a dívida zera).
    let iParcelas = -1;
    d().despesas
      .filter((x) => !x.categoriaDivida)
      .forEach((x) => {
        const i = c().indice.get(Object.keys(x.valores).sort().pop());
        if (i != null && i < ultimo) iParcelas = Math.max(iParcelas, i);
      });
    const iFim = Math.max(iParcelas, livre);
    const sobras = iFim >= 0 && iFim < ultimo ? linhas.slice(iFim + 1).map((l) => l.saldo) : [];

    // Custo de vida: média das despesas depois das parcelas (ou dos próximos 12 meses).
    const baseCusto = sobras.length ? linhas.slice(iFim + 1) : linhas.slice(iHoje, iHoje + 12);
    const custoMensal = baseCusto.length ? Math.round(soma(baseCusto.map((l) => l.despesas)) / baseCusto.length) : 0;

    const bruto = salarioBruto().base;
    const cenario = {
      pct: config.poupancaPercentual,
      bruto,
      aporte: bruto == null ? null : Math.round((bruto * config.poupancaPercentual) / 100),
      disponivel: bruto != null && livre >= 0,
    };

    return { ultimo, iHoje, iPrimeiro, livre, iFim, sobras, custoMensal, cenario, fim: linhas[ultimo], hoje: linhas[iHoje] };
  }

  // Primeiro mês, de hoje em diante, em que o patrimônio (do plano ou do cenário) chega ao valor.
  function quandoAtinge(linhas, iHoje, valor, campo = "patrimonio") {
    const i = linhas.findIndex((l, k) => k >= iHoje && l[campo] >= valor);
    return i === -1 ? null : linhas[i].mes;
  }

  // ---------- Peças ----------

  function faixas(meses) {
    const indice = c().indice;
    const grupos = [];
    meses.forEach((mes) => {
      const i = indice.get(mes);
      const g = grupos[grupos.length - 1];
      if (g && g[1] === i - 1) g[1] = i;
      else grupos.push([i, i]);
    });
    const lista = c().meses;
    return grupos.map(([a, b]) => (a === b ? App.mesCurto(lista[a]) : `${App.mesCurto(lista[a])} a ${App.mesCurto(lista[b])}`));
  }

  const daquiA = (mes) => {
    const n = App.diferencaMeses(App.mesAtual, mes);
    return n > 0 ? `daqui a ${plural(n, "mês", "meses")}` : n === 0 ? "este mês" : "";
  };

  function htmlStat({ rotulo, valor, sub, plano, extras = [], classe }) {
    const notas = [...extras, ...(plano != null ? [`No plano: ${plano}`] : [])];
    return `<div class="cartao stat">
      <p class="stat-rotulo">${rotulo}</p>
      <p class="stat-valor${classe ? ` ${classe}` : ""}">${valor}</p>
      <p class="sub">${sub}</p>
      ${notas.map((nota) => `<p class="sub stat-plano">${nota}</p>`).join("")}
    </div>`;
  }

  function textoLivre(linhas, r) {
    if (r.livre === 0) return { valor: "Já está livre", sub: "nada a devolver" };
    if (r.livre === -1) return { valor: "Não zera", sub: `faltam ${reais(r.fim.faltaDevolver)} em ${App.mesCurto(r.fim.mes)}` };
    const mes = linhas[r.livre].mes;
    return { valor: App.nomeMes(mes), sub: [daquiA(mes), `hoje faltam ${reais(r.hoje.faltaDevolver)}`].filter(Boolean).join(" · ") };
  }

  function textoSobra(linhas, r) {
    if (!r.sobras.length) return { valor: "—", sub: "as parcelas vão até o fim do plano" };
    const min = Math.min(...r.sobras);
    const max = Math.max(...r.sobras);
    return {
      valor: min === max ? App.reaisInteiros(min) : `${App.reaisInteiros(min)} a ${App.reaisInteiros(max).replace(/^R\$\s*/, "")}`,
      sub: `a partir de ${App.nomeMes(linhas[r.iFim + 1].mes)}`,
    };
  }

  function htmlKpis(linhas, r, base, rb) {
    const sim = simulando();
    const livre = textoLivre(linhas, r);
    const sobra = textoSobra(linhas, r);
    const salario = c().salario;
    const rendimentoLiquido = r.fim.rendimento - r.fim.ir;
    const kpis = [
      { rotulo: "Livre das dívidas", ...livre, plano: sim ? textoLivre(base, rb).valor : null },
      { rotulo: "Sobra por mês depois disso", ...sobra, plano: sim ? textoSobra(base, rb).valor : null },
      {
        rotulo: `Guardado no CDB em ${App.mesCurto(r.fim.mes)}`,
        valor: reais(r.fim.guardado),
        sub: d().config.cdbInicio
          ? `${reais(rendimentoLiquido)} de rendimento do CDB, já sem ${reais(r.fim.ir)} de IR`
          : "sem rendimento",
        extras: [
          `Na conta, sem render: ${reais(r.fim.acumulado)}`,
          ...(r.cenario.disponivel
            ? [`${esc(nomeCenario())}: ${reais(r.fim.investidoCenario)} no CDB + ${reais(r.fim.contaCenario)} na conta`]
            : []),
        ],
        plano: sim ? reais(rb.fim.guardado) : null,
      },
      {
        rotulo: "Patrimônio hoje",
        valor: reais(r.hoje.patrimonio),
        classe: r.hoje.patrimonio < 0 ? "negativo" : "",
        sub: "o que está guardado menos o que falta devolver",
      },
      {
        rotulo: "Salário previsto",
        valor: salario ? reais(salario.valor) : "—",
        classe: salario ? "" : "negativo",
        sub: salario
          ? salario.folha
            ? `por mês, o líquido da <a href="#salario">${esc(App.nomeFolha(salario.folha))}</a>`
            : "por mês, definido no Backoffice"
          : 'envie uma folha na aba <a href="#salario">Salário</a>',
      },
    ];
    return kpis.map(htmlStat).join("");
  }

  function htmlAvisoSimulacao() {
    if (!simulando()) return "";
    const s = estado.sim;
    const partes = [];
    if (s.renda) {
      partes.push(`renda ${s.renda > 0 ? "+" : "−"}${reais(Math.abs(s.renda))} por mês a partir de ${App.mesCurto(s.rendaInicio || App.mesAtual)}`);
    }
    if (s.gasto) partes.push(`${s.gasto > 0 ? "gasto extra de" : "economia de"} ${reais(Math.abs(s.gasto))} por mês`);
    if (s.antecipar) partes.push(`${reais(s.antecipar)} a mais por mês na devolução`);
    if (s.taxa != null) partes.push(`CDB a ${percentual(s.taxa)} ao mês`);
    return htmlAvisos([
      {
        tipo: "info",
        html: `<strong>Simulação:</strong> ${esc(juntar(partes))}. Os números abaixo mostram esse cenário; o plano salvo não muda. <button type="button" class="link" data-sim-limpar>Voltar ao plano</button>`,
      },
    ]);
  }

  function htmlGraficos(r) {
    const botao = (id, texto) =>
      `<button type="button" data-visao="${id}" aria-pressed="${estado.visao === id}">${texto}</button>`;
    const { cenario } = r;
    const valores =
      cenario.bruto != null ? ` (${reais(cenario.bruto)}), ou seja, ${reais(cenario.aporte)} por mês,` : "";
    const aviso =
      cenario.bruto == null
        ? " Envie uma folha de pagamento para ver essa linha."
        : r.livre < 0
          ? " A dívida não zera até o fim do plano, então essa linha não se separa do guardado no CDB."
          : "";
    return `<section class="cartao grafico-cartao">
      <div class="grafico-topo">
        <div>
          <h2>Guardado e dívida</h2>
          <p class="sub" id="grafico-periodo"></p>
        </div>
        <div class="segmentado" role="group" aria-label="Período do gráfico">
          ${botao("12-meses", "Próximos 12 meses")}${botao("tudo", "Até o fim do plano")}
        </div>
      </div>
      <ul class="legenda">
        <li><span class="chave-linha serie-1"></span>Guardado no CDB</li>
        <li><span class="chave-linha serie-3"></span>Na conta corrente, sem render</li>
        <li><span class="chave-linha serie-2"></span>Falta devolver</li>
        <li><span class="chave-linha serie-4"></span>${esc(nomeCenario())} no CDB depois da dívida</li>
        <li><span class="chave-linha chave-prevista"></span>Tracejado: previsão</li>
      </ul>
      <label class="sub cenario-ajuste">
        <span class="chave-linha serie-4"></span>
        <span>Cenário: depois que a dívida zera, investir
          <input class="campo" type="number" min="1" max="100" step="1" value="${cenario.pct}" data-poupanca-pct aria-label="Porcentagem do salário bruto investida por mês depois da dívida">
          % do salário bruto${valores} no CDB e deixar o resto da sobra na conta, sem render. A linha mostra só a parte investida.${aviso}</span>
      </label>
      <div class="grafico" id="grafico-patrimonio"></div>
      <div class="grafico-topo grafico-topo-secundario">
        <div>
          <h3>Sobra de cada mês</h3>
          <p class="sub">Entradas menos despesas. Barras mais claras são previsão; vermelhas, meses no vermelho.</p>
        </div>
      </div>
      <div class="grafico" id="grafico-saldo"></div>
    </section>`;
  }

  function desenharGraficos(linhas, r) {
    const de = estado.visao === "12-meses" ? r.iHoje : r.iPrimeiro;
    const ate = estado.visao === "12-meses" ? Math.min(r.ultimo, r.iHoje + 11) : r.ultimo;
    const trecho = linhas.slice(de, ate + 1);
    const meses = trecho.map((l) => l.mes);
    const iHoje = r.iHoje - de;
    const noCenario = (valor) => trecho.map((l, k) => (r.cenario.disponivel && de + k >= r.livre ? valor(l) : null));
    const marcos = [{ i: iHoje, texto: "Hoje" }];
    if (r.livre > 0 && r.livre !== r.iHoje) marcos.push({ i: r.livre - de, texto: "Livre das dívidas" });

    $("#grafico-periodo").textContent = `${App.mesCurto(meses[0])} a ${App.mesCurto(meses[meses.length - 1])}`;
    App.desenharGrafico($("#grafico-patrimonio"), {
      meses,
      iHoje,
      marcos,
      rotulo: "Gráfico do guardado no CDB, do guardado na conta sem render, do que falta devolver e do cenário, mês a mês",
      series: [
        { nome: "Guardado no CDB", classe: "serie-1", valores: trecho.map((l) => l.guardado) },
        { nome: "Na conta, sem render", classe: "serie-3", valores: trecho.map((l) => l.acumulado) },
        { nome: "Falta devolver", classe: "serie-2", valores: trecho.map((l) => l.faltaDevolver) },
        // Sai da linha do guardado no CDB no mês em que a dívida zera.
        { nome: `${nomeCenario()} no CDB`, classe: "serie-4", valores: noCenario((l) => l.investidoCenario) },
        // Só no tooltip: o que o cenário deixa na conta.
        { nome: "Cenário: resto na conta", tipo: "info", valores: noCenario((l) => l.contaCenario) },
      ],
    });
    App.desenharGrafico($("#grafico-saldo"), {
      meses,
      iHoje,
      marcos: [{ i: iHoje, texto: "Hoje" }],
      altura: 190,
      rotulo: "Gráfico da sobra de cada mês",
      series: [{ nome: "Sobra do mês", classe: "serie-1", tipo: "barras", valores: trecho.map((l) => l.saldo) }],
    });
  }

  // Uma meta em cada cenário: investindo toda a sobra e investindo só uma parte do bruto depois da dívida.
  // cenarios: [{ rotulo, alvo, detalhe, quando, noPlano }]
  function htmlMeta({ id, nome, valor, sub, cenarios, r, extra = "" }) {
    const remover =
      id != null
        ? `<button type="button" class="botao botao-icone botao-fantasma" data-remover-meta="${id}" aria-label="Remover a meta ${esc(nome)}" title="Remover meta">${App.ICONES.remover}</button>`
        : "";
    const linhas = cenarios
      .map(({ rotulo, alvo, detalhe, quando, noPlano }) => {
        const pct = Math.min(100, Math.round((Math.max(0, r.hoje.patrimonio) / alvo) * 100));
        let status;
        if (quando === App.mesAtual) status = "Já atingida";
        else if (quando) status = `Chega em ${App.mesCurto(quando)}${daquiA(quando) ? ` · ${daquiA(quando)}` : ""}`;
        else status = `Não chega até ${App.mesCurto(r.fim.mes)}`;
        return `<li class="meta-cenario">
          <div class="meta-cenario-topo">
            <span>${esc(rotulo)}</span>
            ${valor == null ? `<strong>${reais(alvo)}</strong>` : ""}
          </div>
          ${detalhe ? `<p class="sub">${detalhe}</p>` : ""}
          <div class="progresso" role="progressbar" aria-label="Quanto do valor você já tem" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}">
            <span style="width:${pct}%"></span>
          </div>
          <p class="meta-status${quando ? "" : " negativo"}">${status}</p>
          ${noPlano !== quando ? `<p class="sub">No plano: ${noPlano ? App.mesCurto(noPlano) : "não chega"}</p>` : ""}
        </li>`;
      })
      .join("");
    return `<div class="cartao meta-cartao">
      <div class="meta-topo">
        <p class="stat-rotulo">${esc(nome)}</p>
        ${remover}
      </div>
      ${valor != null ? `<p class="stat-valor">${reais(valor)}</p>` : ""}
      <p class="sub">${sub}</p>
      <ul class="meta-cenarios">${linhas}</ul>
      ${extra}
    </div>`;
  }

  function htmlMetas(linhas, r, base, rb) {
    const config = d().config;
    const sim = simulando();
    // campoCenario: o que conta no cenário (só o investido, para a reserva, ou investido mais conta).
    // alvoPlano: o valor sem a simulação, para comparar.
    const cenarios = (alvo, alvoPlano, campoCenario, detalheCenario) => {
      const lista = [{ rotulo: "Investindo toda a sobra", campo: "patrimonio" }];
      if (r.cenario.disponivel) {
        lista.push({ rotulo: `${nomeCenario()} depois da dívida`, campo: campoCenario, detalhe: detalheCenario });
      }
      return lista.map(({ rotulo, campo, detalhe }) => {
        const quando = quandoAtinge(linhas, r.iHoje, alvo, campo);
        // Sem simulação, "no plano" é o próprio resultado.
        return { rotulo, detalhe, alvo, quando, noPlano: sim ? quandoAtinge(base, rb.iHoje, alvoPlano, campo) : quando };
      });
    };

    const meses = config.reservaMeses;
    const campoMeses = `<label class="meta-ajuste">Meses de despesas
      <input class="campo" type="number" min="1" max="36" step="1" value="${meses}" data-reserva-meses aria-label="Meses de despesas da reserva de emergência">
    </label>`;
    const reserva = Math.max(1, meses * r.custoMensal);
    const cartoes = [
      htmlMeta({
        nome: "Reserva de emergência",
        valor: reserva,
        sub: `${plural(meses, "mês", "meses")} de despesas (${reais(r.custoMensal)} por mês depois das parcelas)`,
        cenarios: cenarios(
          reserva,
          Math.max(1, meses * rb.custoMensal),
          "reservaCenario",
          "conta só o que está investido no CDB; o que fica na conta é dinheiro livre"
        ),
        r,
        extra: campoMeses,
      }),
      ...d().metas.map((m) =>
        htmlMeta({
          id: m.id,
          nome: m.nome,
          valor: m.valor,
          sub: "meta sua",
          cenarios: cenarios(m.valor, m.valor, "patrimonioCenario", "investido mais o que fica na conta"),
          r,
        })
      ),
    ].join("");
    const form = `<details class="cartao adicionar-detalhes meta-nova">
      <summary><span class="marcador-mais" aria-hidden="true">${App.ICONES.mais}</span>Adicionar meta</summary>
      <form class="form-grade" data-form-meta autocomplete="off">
        <label class="campo-rotulo largo">Nome<input class="campo" name="nome" maxlength="60" placeholder="Ex.: Entrada do apartamento"></label>
        <label class="campo-rotulo">Valor<input class="campo campo-valor" name="valor" inputmode="decimal" placeholder="0,00"></label>
        <div class="form-acoes"><button type="submit" class="botao botao-primario">Adicionar</button></div>
      </form>
    </details>`;
    return htmlSecao(
      "Metas",
      "Quando o seu patrimônio (o que está guardado menos o que falta devolver) chega em cada valor, investindo toda a sobra e no cenário em que só uma parte do bruto é investida.",
      "",
      "",
      `<div class="metas">${cartoes}</div>${form}`
    );
  }

  function pontosDeAtencao(linhas, r) {
    const pontos = [];
    const daquiPraFrente = linhas.filter((l) => l.futuro);

    if (!c().salario) {
      pontos.push({
        tipo: "perigo",
        html: '<strong>Sem salário previsto.</strong> Os meses daqui para a frente estão sem o salário CLT. Envie uma folha na aba <a href="#salario">Salário</a> ou defina o salário previsto no Backoffice.',
      });
    }

    // Folhas que faltam: meses que já passaram, depois da primeira folha, sem folha mensal.
    const comFolha = new Set(d().holerites.filter((h) => /mensal/i.test(h.tipo)).map((h) => h.mes));
    const primeira = [...comFolha].sort()[0];
    const semFolha = primeira ? c().meses.filter((m) => m > primeira && m < App.mesAtual && !comFolha.has(m)) : [];
    if (semFolha.length) {
      pontos.push({
        tipo: "alerta",
        html: `<strong>Folha de pagamento não enviada: ${juntar(faixas(semFolha))}.</strong> ${semFolha.length === 1 ? "Esse mês está" : "Esses meses estão"} sem o salário. Envie na aba <a href="#salario">Salário</a>.`,
      });
    }

    const negativos = daquiPraFrente.filter((l) => l.saldo < 0);
    if (negativos.length) {
      const ultimo = negativos[negativos.length - 1];
      pontos.push({
        tipo: ultimo.acumulado < 0 ? "perigo" : "alerta",
        html: `<strong>${juntar(faixas(negativos.map((l) => l.mes)))} ${negativos.length === 1 ? "fecha" : "fecham"} no vermelho</strong> (${negativos
          .map((l) => reais(l.saldo))
          .join(", ")}). ${ultimo.guardado >= 0 ? "O que está guardado cobre, mas não deixa folga." : "Nem o que está guardado cobre."}`,
      });
    }

    const apertados = daquiPraFrente.filter((l) => l.saldo >= 0 && l.entradas && l.saldo < l.entradas * 0.05);
    if (apertados.length) {
      const valores = apertados.map((l) => l.saldo);
      const min = Math.min(...valores);
      const max = Math.max(...valores);
      pontos.push({
        tipo: "alerta",
        html: `<strong>Meses apertados: ${juntar(faixas(apertados.map((l) => l.mes)))}.</strong> Sobram ${
          min === max ? `só ${reais(min)}` : `entre ${reais(min)} e ${reais(max)}`
        } por mês. Um gasto inesperado nesse período já desequilibra o plano.`,
      });
    }

    // Devolução atrasada: parcelas de meses que já passaram sem marcar como pagas.
    const atrasadas = [];
    c().divida.devolucoes.forEach((x) =>
      Object.entries(x.valores).forEach(([mes, v]) => {
        if (mes < App.mesAtual && !v.pagoEm) atrasadas.push({ mes, valor: v.valor });
      })
    );
    if (atrasadas.length) {
      const meses = [...new Set(atrasadas.map((a) => a.mes))].sort();
      pontos.push({
        tipo: "alerta",
        html: `<strong>${reais(soma(atrasadas.map((a) => a.valor)))} de devolução atrasada</strong> (${juntar(faixas(meses))}). Enquanto não for paga, a dívida não zera. Marque na aba <a href="#divida">Greici e André</a> quando pagar.`,
      });
    }

    const dv = c().divida;
    if (dv.plano !== dv.previsto) {
      pontos.push({
        tipo: "info",
        html: `<strong>O plano devolve ${reais(Math.abs(dv.plano - dv.previsto))} ${dv.plano > dv.previsto ? "a mais" : "a menos"} do que eles pagam</strong> (${reais(
          dv.plano
        )} × ${reais(dv.previsto)}). Detalhes e edição na aba <a href="#divida">Greici e André</a>.`,
      });
    }
    return pontos;
  }

  function htmlTabela(linhas, r) {
    const visiveis = linhas.slice(r.iPrimeiro);
    const comCenario = r.cenario.disponivel;
    const anos = [...new Set(visiveis.map((l) => l.mes.slice(0, 4)))];
    const celula = (v, negativo = v < 0) => `<td class="num${negativo ? " negativo" : ""}">${reais(v)}</td>`;
    // Patrimônio positivo em destaque: verde e com o sinal de mais.
    const celulaPatrimonio = (v) =>
      v > 0 ? `<td class="num positivo">+${reais(v)}</td>` : celula(v);
    const corpos = anos
      .map((ano) => {
        const doAno = visiveis.filter((l) => l.mes.startsWith(ano));
        const fim = doAno[doAno.length - 1];
        const aberto = estado.anosAbertos.has(ano);
        const meses = doAno
          .map((l) => {
            const atual = l.mes === App.mesAtual;
            return `<tr class="linha-mes${atual ? " atual" : ""}" data-ir-mes="${l.mes}"${aberto ? "" : " hidden"}>
              <th scope="row"><a href="#mes/${l.mes}">${App.mesCurto(l.mes)}</a>${atual ? ' <span class="tag">atual</span>' : ""}</th>
              ${celula(l.entradas, false)}${celula(l.despesas, false)}${celula(l.saldo)}${celula(l.guardado)}${celula(l.acumulado)}${
                comCenario ? celula(l.investidoCenario) : ""
              }${celula(l.faltaDevolver, false)}${celulaPatrimonio(l.patrimonio)}
            </tr>`;
          })
          .join("");
        return `<tbody>
          <tr class="linha-ano">
            <th scope="row">
              <button type="button" class="botao-ano" data-ano="${ano}" aria-expanded="${aberto}">${App.ICONES.seta}${ano}</button>
            </th>
            ${celula(soma(doAno.map((l) => l.entradas)), false)}${celula(soma(doAno.map((l) => l.despesas)), false)}${celula(
              soma(doAno.map((l) => l.saldo))
            )}${celula(fim.guardado)}${celula(fim.acumulado)}${comCenario ? celula(fim.investidoCenario) : ""}${celula(fim.faltaDevolver, false)}${celulaPatrimonio(
              fim.patrimonio
            )}
          </tr>
          ${meses}
        </tbody>`;
      })
      .join("");
    const tabela = `<div class="cartao tabela-wrap">
      <table class="tabela tabela-anos">
        <thead><tr>
          <th scope="col">Mês</th>
          <th scope="col" class="num">Entradas</th>
          <th scope="col" class="num">Despesas</th>
          <th scope="col" class="num">Sobra</th>
          <th scope="col" class="num">No CDB</th>
          <th scope="col" class="num">Na conta</th>
          ${comCenario ? `<th scope="col" class="num">Investindo ${r.cenario.pct}%</th>` : ""}
          <th scope="col" class="num">Falta devolver</th>
          <th scope="col" class="num">Patrimônio</th>
        </tr></thead>
        ${corpos}
      </table>
    </div>`;
    return htmlSecao(
      "Mês a mês",
      `Na linha de cada ano: entradas, despesas e sobra somadas; guardado, dívida e patrimônio no fim do ano. “Na conta” é a soma das sobras sem render; “Investindo ${r.cenario.pct}%” é a parte investida do cenário. Até ${App.mesCurto(
        App.mesAtual
      )} os valores são do que aconteceu; depois, previsão. Clique em um mês para ver as contas.`,
      "",
      "",
      tabela
    );
  }

  // Explicação da página, com os valores do plano (sem a simulação).
  function htmlExplicacao(rb) {
    const config = d().config;
    const salario = c().salario;
    const origemSalario = !salario
      ? "nenhum por enquanto: envie uma folha na aba Salário ou defina o valor no Backoffice"
      : salario.folha
        ? `${reais(salario.valor)} por mês, o líquido da ${esc(App.nomeFolha(salario.folha))} (a última de mês cheio)`
        : `${reais(salario.valor)} por mês, valor definido no Backoffice`;
    const cdb = config.cdbInicio
      ? `Antes de ${App.nomeMes(config.cdbInicio)} o dinheiro fica parado; a partir desse mês, vai para um CDB que rende ${percentual(
          config.cdbTaxaMensal || 0
        )} ao mês.`
      : "Nenhum CDB está configurado, então o dinheiro guardado não rende.";
    const blocos = [
      [
        "Realizado e previsto",
        `Até ${App.nomeMes(App.mesAtual)} os números vêm do que foi lançado no app. Daqui para a frente são previsão, feita com o plano de hoje. Nos gráficos, a previsão aparece tracejada (linhas) ou mais clara (barras).`,
      ],
      [
        "Entradas",
        `O salário CLT é o líquido da folha de pagamento, no mês em que foi pago. Nos meses sem folha, de agora em diante, entra o salário previsto: ${origemSalario}. Notas PJ, 13º, férias e outras rendas só contam quando são lançados na aba Mês.`,
      ],
      [
        "Despesas",
        "Contas fixas, parcelas, devoluções para a Greici e o André e extras de cada mês, como estão nas abas Mês e Greici e André. O que eles pagaram por você não é despesa sua: entra na dívida.",
      ],
      [
        "Sobra do mês",
        "<strong>Sobra = entradas − despesas.</strong> Quando é negativa, o mês fecha no vermelho e o dinheiro sai do que está guardado.",
      ],
      [
        "Guardado: na conta e no CDB",
        `<strong>Na conta corrente</strong> é a soma das sobras de todos os meses, sem render nada. <strong>No CDB</strong> é o mesmo dinheiro aplicado: ${cdb} Cada mês aplicado rende separado e paga Imposto de Renda pelo tempo em que ficou aplicado: 22,5% até 6 meses, 20% até 12, 17,5% até 24 e 15% depois. O valor mostrado é o que você teria se resgatasse tudo naquele mês, já sem o IR. Num mês no vermelho, o dinheiro sai das aplicações mais antigas.`,
      ],
      [
        "Falta devolver",
        `O total que a Greici e o André pagam por você (${reais(
          c().divida.previsto
        )}: contas de agosto, outras despesas, cartão e o carro, inclusive o que ainda falta pagar dele) menos as parcelas de devolução. Nos meses que já passaram, só contam as parcelas marcadas como pagas; nos próximos, as do plano, supondo que serão pagas em dia.`,
      ],
      [
        "Patrimônio e “Livre das dívidas”",
        "<strong>Patrimônio = guardado no CDB − falta devolver:</strong> o que é seu de verdade. Fica negativo enquanto a dívida for maior que o guardado. “Livre das dívidas” é o mês em que o que falta devolver chega a zero.",
      ],
      [
        "Sobra por mês depois disso",
        "A sobra dos meses depois que acabam as parcelas e a dívida, quando quase toda a renda fica livre.",
      ],
      [
        `Cenário: ${esc(nomeCenario().toLowerCase())}`,
        rb.cenario.bruto == null
          ? "Depois que a dívida zera, investe só uma porcentagem do salário bruto e deixa o resto na conta. Precisa de uma folha de pagamento para saber o bruto."
          : `A linha azul supõe que você investe toda a sobra. Nesta, até a dívida zerar tudo é igual; depois, todo mês você investe no CDB ${rb.cenario.pct}% do salário bruto (${reais(
              rb.cenario.bruto
            )}, da última folha mensal): ${reais(
              rb.cenario.aporte
            )}, ou só a sobra se ela for menor. O resto da sobra fica na conta, sem render; num mês no vermelho, sai primeiro da conta. A linha mostra só a parte investida; o tooltip e o card do guardado mostram também o que ficou na conta. A porcentagem fica no próprio gráfico.`,
      ],
      [
        "Metas",
        `A reserva de emergência é ${plural(config.reservaMeses, "mês", "meses")} de despesas depois das parcelas (${reais(
          rb.custoMensal
        )} por mês, a média). Investindo toda a sobra, ela é formada pelo patrimônio; no cenário, só pelo que está investido no CDB, já que o que fica na conta é dinheiro livre. As outras metas contam todo o dinheiro do cenário (investido mais conta). A data de cada meta é o primeiro mês em que o valor é alcançado; a barra mostra quanto o patrimônio de hoje já cobre.`,
      ],
      [
        "Simulador",
        "Muda só o que a página mostra, por cima do plano: renda a mais ou a menos a partir do mês escolhido, gasto extra (negativo é economia), um valor a mais por mês na devolução até a dívida zerar e outra taxa para o CDB. Nada é salvo; os cards mostram também o número do plano para comparar.",
      ],
      [
        "Pontos de atenção",
        "No vermelho: a sobra do mês é negativa. Apertado: sobram menos de 5% das entradas. Também avisa folha de pagamento não enviada, devolução atrasada e quando não há salário previsto.",
      ],
      [
        "O que a previsão não considera",
        "Inflação, reajustes de salário e de contas, 13º, férias e gastos que ainda não foram lançados. A taxa do CDB é a mesma em todos os meses e o IR é uma estimativa. Os números mudam sempre que um lançamento muda.",
      ],
    ];
    return htmlSecao(
      "Como esta página funciona",
      "O que cada número significa e como ele é calculado.",
      "",
      "",
      `<div class="cartao explicacao">${blocos
        .map(([titulo, texto]) => `<div class="explicacao-item"><h3>${titulo}</h3><p>${texto}</p></div>`)
        .join("")}</div>`
    );
  }

  // ---------- Renderização ----------

  function htmlSimulador() {
    const meses = c().meses.filter((m) => m >= App.mesAtual);
    const s = estado.sim;
    const valorCampo = (v) => (v ? `${v < 0 ? "-" : ""}${App.formatarCampo(Math.abs(v))}` : "");
    const taxaPlano = d().config.cdbTaxaMensal || 0;
    return `<details class="cartao simulador"${simulando() ? " open" : ""}>
      <summary><span class="marcador-mais" aria-hidden="true">${App.ICONES.editar}</span>Simular um cenário<span class="sub">nada é salvo</span></summary>
      <form class="form-grade" data-simulador autocomplete="off">
        <label class="campo-rotulo">Renda a mais por mês
          <input class="campo campo-valor" data-sim="renda" inputmode="decimal" placeholder="0,00" value="${valorCampo(s.renda)}">
        </label>
        <label class="campo-rotulo">A partir de
          <select class="campo" data-sim="rendaInicio">${meses
            .map((m) => `<option value="${m}"${m === (s.rendaInicio || App.mesAtual) ? " selected" : ""}>${App.nomeMes(m)}</option>`)
            .join("")}</select>
        </label>
        <label class="campo-rotulo">Gasto extra por mês
          <input class="campo campo-valor" data-sim="gasto" inputmode="decimal" placeholder="0,00" value="${valorCampo(s.gasto)}">
        </label>
        <label class="campo-rotulo">Antecipar a devolução
          <input class="campo campo-valor" data-sim="antecipar" inputmode="decimal" placeholder="0,00" value="${valorCampo(s.antecipar)}">
        </label>
        <label class="campo-rotulo">CDB (% ao mês)
          <input class="campo campo-valor" data-sim="taxa" inputmode="decimal" placeholder="${esc(percentual(taxaPlano).replace("%", ""))}" value="${
            s.taxa == null ? "" : esc(percentual(s.taxa).replace("%", ""))
          }">
        </label>
        <div class="form-acoes"><button type="button" class="botao" data-sim-limpar>Limpar</button></div>
      </form>
      <p class="sub simulador-nota">Use − na frente para renda a menos ou para economia. “Antecipar a devolução” soma esse valor às parcelas de cada mês até a dívida zerar.</p>
    </details>`;
  }

  function renderResultados() {
    const base = projetar(SIM_VAZIA);
    const rb = resumir(base);
    const linhas = simulando() ? projetar(estado.sim) : base;
    const r = simulando() ? resumir(linhas) : rb;

    $("#proj-aviso").innerHTML = htmlAvisoSimulacao();
    $("#proj-kpis").innerHTML = htmlKpis(linhas, r, base, rb);
    $("#proj-corpo").innerHTML = `
      ${htmlGraficos(r)}
      ${htmlMetas(linhas, r, base, rb)}
      ${htmlSecao(
        "Pontos de atenção",
        simulando() ? "Calculados com o cenário simulado." : "Calculados com as entradas, despesas e extras de hoje.",
        "",
        "",
        htmlAvisos(pontosDeAtencao(linhas, r)) || '<p class="sub">Nada fora do normal.</p>'
      )}
      ${htmlTabela(linhas, r)}
      ${htmlExplicacao(rb)}`;
    desenharGraficos(linhas, r);
  }

  function render() {
    const raiz = $("#view-projecao");
    if (!raiz.dataset.pronto) montar(raiz);
    $("#proj-simulador").innerHTML = htmlSimulador();
    renderResultados();
  }

  // ---------- Ações ----------

  // "1.500,00", "-300" ou "−300" -> centavos com sinal; vazio -> 0; inválido -> null.
  function lerComSinal(texto) {
    const limpo = String(texto || "").trim();
    if (!limpo) return 0;
    const negativo = /^[-−]/.test(limpo);
    const valor = App.lerReais(limpo.replace(/^[-−+]\s*/, ""));
    if (valor == null) return null;
    return negativo ? -valor : valor;
  }

  function lerTaxa(texto) {
    const limpo = String(texto || "").trim().replace("%", "");
    if (!limpo) return null;
    const numero = Number(limpo.includes(",") ? limpo.replace(/\./g, "").replace(",", ".") : limpo);
    return Number.isFinite(numero) && numero >= 0 && numero <= 20 ? Number((numero / 100).toFixed(8)) : undefined;
  }

  function aoSimular(evento) {
    const campo = evento.target.closest("[data-sim]");
    if (!campo) return;
    const chave = campo.dataset.sim;
    let valor;
    if (chave === "rendaInicio") valor = campo.value;
    else if (chave === "taxa") valor = lerTaxa(campo.value);
    else valor = lerComSinal(campo.value);
    const invalido = valor === undefined || valor === null || (chave === "antecipar" && valor < 0);
    campo.classList.toggle("invalido", invalido);
    if (invalido) return;
    estado.sim[chave] = valor;
    $("#view-projecao details.simulador").open = true;
    renderResultados();
  }

  function limparSimulacao() {
    estado.sim = { ...SIM_VAZIA };
    $("#proj-simulador").innerHTML = htmlSimulador();
    $("#view-projecao details.simulador").open = true;
    renderResultados();
  }

  function aoClicar(evento) {
    const alvo = evento.target;
    if (alvo.closest("[data-sim-limpar]")) {
      limparSimulacao();
      return;
    }
    const visao = alvo.closest("[data-visao]");
    if (visao) {
      estado.visao = visao.dataset.visao;
      App.gravar(CHAVE_VISAO, estado.visao);
      renderResultados();
      return;
    }
    const ano = alvo.closest("[data-ano]");
    if (ano) {
      const abrir = !estado.anosAbertos.has(ano.dataset.ano);
      if (abrir) estado.anosAbertos.add(ano.dataset.ano);
      else estado.anosAbertos.delete(ano.dataset.ano);
      ano.setAttribute("aria-expanded", String(abrir));
      $$(".linha-mes", ano.closest("tbody")).forEach((linha) => {
        linha.hidden = !abrir;
      });
      return;
    }
    const remover = alvo.closest("[data-remover-meta]");
    if (remover) {
      const meta = d().metas.find((m) => m.id === Number(remover.dataset.removerMeta));
      if (window.confirm(`Remover a meta “${meta.nome}”?`)) {
        App.salvar("DELETE", `/api/backoffice/metas/${meta.id}`, undefined, { mensagem: `Meta “${meta.nome}” removida` });
      }
      return;
    }
    const linha = alvo.closest("[data-ir-mes]");
    if (linha && !alvo.closest("a")) location.hash = `#mes/${linha.dataset.irMes}`;
  }

  function aoMudar(evento) {
    const campo = evento.target;
    if (campo.matches("[data-poupanca-pct]")) {
      const pct = Number(campo.value);
      if (!Number.isInteger(pct) || pct < 1 || pct > 100) {
        App.toast("Use uma porcentagem inteira de 1 a 100.");
        campo.value = d().config.poupancaPercentual;
        return;
      }
      App.salvar("PUT", "/api/backoffice/config", { poupancaPercentual: pct });
      return;
    }
    if (campo.matches("[data-reserva-meses]")) {
      const meses = Number(campo.value);
      if (!Number.isInteger(meses) || meses < 1 || meses > 36) {
        App.toast("Use de 1 a 36 meses.");
        campo.value = d().config.reservaMeses;
        return;
      }
      App.salvar("PUT", "/api/backoffice/config", { reservaMeses: meses });
    }
  }

  async function aoEnviar(evento) {
    const form = evento.target.closest("[data-form-meta]");
    if (!form) return;
    evento.preventDefault();
    const nome = String(form.elements.nome.value || "").trim();
    const valor = App.lerReais(form.elements.valor.value);
    if (!nome) return App.toast("Dê um nome para a meta.");
    if (valor == null || valor <= 0) return App.toast("Informe o valor da meta, como 50.000,00.");
    await App.salvar("POST", "/api/backoffice/metas", { nome, valor }, { mensagem: `Meta “${nome}” adicionada` });
  }

  function montar(raiz) {
    raiz.innerHTML = `
      <div id="proj-aviso"></div>
      <div class="kpis" id="proj-kpis"></div>
      <div id="proj-simulador"></div>
      <div id="proj-corpo"></div>`;
    const simulador = $("#proj-simulador");
    simulador.addEventListener("input", aoSimular);
    simulador.addEventListener("change", aoSimular);
    raiz.addEventListener("click", aoClicar);
    raiz.addEventListener("change", aoMudar);
    raiz.addEventListener("submit", aoEnviar);
    raiz.dataset.pronto = "1";
  }

  App.projecao = { render };
})();
