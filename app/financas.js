// Abas "Mês", "Greici e André" e "Projeção".
(function () {
  "use strict";

  const App = window.App;
  const { $, esc, reais, plural } = App;

  const estado = {
    mes: null, // mês aberto na aba Mês
    abertos: new Set(), // listas expandidas na aba Greici e André
    editandoPlano: false,
    mesesNovosPlano: [], // meses mostrados durante a edição mesmo sem valor
  };

  const d = () => App.dados;
  const c = () => App.calc;
  const soma = (lista) => lista.reduce((total, v) => total + (v || 0), 0);
  const porId = (lista, id) => lista.find((x) => x.id === Number(id));

  function mesInicial() {
    const { meses, porMes } = c();
    if (meses.includes(App.mesAtual)) return App.mesAtual;
    if (App.mesAtual < meses[0]) {
      const primeiro = porMes.find((p) => p.entradas || p.totalDespesas);
      return primeiro ? primeiro.mes : meses[0];
    }
    return meses[meses.length - 1];
  }

  function textoParcela(despesa, mes) {
    const p = App.parcela(despesa, mes);
    if (!p) return "";
    if (p.recorrente) return "Todo mês";
    if (p.total === 1) return "Parcela única";
    return `Parcela ${p.numero} de ${p.total}`;
  }

  function sinal(valor) {
    if (valor > 0) return `+${reais(valor)}`;
    if (valor < 0) return `−${reais(-valor)}`;
    return "igual";
  }

  function opcoesMeses(selecionado) {
    const anos = [...new Set(c().meses.map((m) => m.slice(0, 4)))];
    return anos
      .map(
        (ano) => `<optgroup label="${ano}">${c()
          .meses.filter((m) => m.startsWith(ano))
          .map((m) => `<option value="${m}"${m === selecionado ? " selected" : ""}>${App.nomeMes(m)}</option>`)
          .join("")}</optgroup>`
      )
      .join("");
  }

  // ---------- Peças de HTML ----------

  function htmlResumo({ rotulo, valor, sub, pct, stats }) {
    const barra =
      pct == null
        ? ""
        : `<div class="progresso" role="progressbar" aria-label="Quanto já foi pago" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}">
             <span style="width:${pct}%"></span>
           </div>`;
    return `<section class="cartao resumo">
      <p class="rotulo">${rotulo}</p>
      <p class="valor-grande">${valor}</p>
      <p class="sub">${sub}</p>
      ${barra}
      <dl class="mini-stats">
        ${stats
          .map(
            (s) =>
              `<div><dt>${s.rotulo}</dt><dd${s.classe ? ` class="${s.classe}"` : ""}>${s.valor}</dd>${s.sub ? `<dd class="sub">${s.sub}</dd>` : ""}</div>`
          )
          .join("")}
      </dl>
    </section>`;
  }

  function htmlAvisos(avisos) {
    return avisos
      .map(
        (a) => `<div class="aviso-cartao aviso-${a.tipo}" role="note">
          ${a.tipo === "info" ? App.ICONES.info : App.ICONES.alerta}
          <div>${a.html}</div>
        </div>`
      )
      .join("");
  }

  function htmlSecao(titulo, descricao, total, legendaTotal, corpo, extraTopo = "") {
    const totalHtml = total
      ? `<div class="secao-total"><strong>${total}</strong><span>${legendaTotal}</span></div>`
      : "";
    return `<section class="secao">
      <header class="secao-topo">
        <div>
          <h2>${titulo}</h2>
          ${descricao ? `<p>${descricao}</p>` : ""}
        </div>
        ${totalHtml}
      </header>
      ${extraTopo}
      ${corpo}
    </section>`;
  }

  function botaoRemover(atributo, rotulo) {
    return `<button type="button" class="botao botao-icone botao-fantasma" ${atributo} aria-label="${esc(rotulo)}" title="${esc(rotulo)}">${App.ICONES.remover}</button>`;
  }

  function htmlFormAdicionar(tipo, placeholder) {
    return `<form class="linha-adicionar" data-form="${tipo}" autocomplete="off">
      <span class="marcador-mais" aria-hidden="true">${App.ICONES.mais}</span>
      <input class="campo" name="descricao" placeholder="${esc(placeholder)}" maxlength="120" aria-label="Descrição" data-foco="novo-${tipo}-descricao">
      <input class="campo campo-valor" name="valor" placeholder="0,00" inputmode="decimal" aria-label="Valor" data-foco="novo-${tipo}-valor">
      <button type="submit" class="botao">Adicionar</button>
    </form>`;
  }

  function htmlLinhaSimples(nome, valor, meta, acao = "") {
    return `<div class="conta paga${acao ? " conta-com-acao" : ""}">
      <label class="check"><input type="checkbox" checked disabled><span class="sr-only">Pago</span></label>
      <div class="conta-info">
        <div class="conta-nome"><span>${esc(nome)}</span></div>
        ${meta ? `<p class="meta">${esc(meta)}</p>` : ""}
      </div>
      <div class="conta-valor">${reais(valor)}</div>
      ${acao}
    </div>`;
  }

  // ---------- Aba "Mês" ----------

  function htmlConta(despesa, mes) {
    const v = despesa.valores[mes];
    const deles = v.pagoPorCredores;
    const paga = deles || Boolean(v.pagoEm);
    const tags = [];
    if (despesa.categoriaDivida || despesa.pagoAosCredores) {
      tags.push(`<a class="tag tag-link" href="#divida">${esc(d().config.credores)}</a>`);
    }
    if (despesa.categoriaDivida && despesa.categoriaDivida === d().config.categoriaCarro) {
      tags.push('<a class="tag tag-link" href="#multas">Carro</a>');
    }
    const meta = deles
      ? "Pago pela Greici e pelo André"
      : [
          textoParcela(despesa, mes),
          despesa.pagoAosCredores && !despesa.categoriaDivida ? "pago direto a eles, fora da devolução" : "",
          v.pagoEm ? `paga em ${App.isoParaBr(v.pagoEm)}` : "",
        ]
          .filter(Boolean)
          .join(" · ");
    const remover = despesa.criadaPeloUsuario
      ? botaoRemover(`data-remover-despesa="${despesa.id}"`, `Remover ${despesa.nome} de todos os meses`)
      : "";

    return `<div class="conta${paga ? " paga" : ""}${remover ? " conta-com-acao" : ""}">
      <label class="check">
        <input type="checkbox" data-pagar-despesa="${despesa.id}" data-mes="${mes}"${paga ? " checked" : ""}${deles ? " disabled" : ""}>
        <span class="sr-only">Marcar ${esc(despesa.nome)} como paga</span>
      </label>
      <div class="conta-info">
        <div class="conta-nome"><span>${esc(despesa.nome)}</span>${tags.join("")}</div>
        <p class="meta">${esc(meta)}</p>
      </div>
      <div class="conta-valor">${reais(v.valor)}</div>
      ${remover}
    </div>`;
  }

  function emprestimosDoMes(mes) {
    return d().emprestimos.filter((e) => e.mes === mes);
  }

  function htmlResumoMes(mes) {
    const p = App.mesDados(mes);
    const nome = App.nomeMes(mes);
    const emprestimos = soma(emprestimosDoMes(mes).map((e) => e.valor));

    if (p.qtd === 0 && (p.pagoPorCredores || emprestimos)) {
      return htmlResumo({
        rotulo: `Pago pela Greici e pelo André em ${nome}`,
        valor: reais(p.pagoPorCredores + emprestimos),
        sub: 'Esse valor entrou na dívida com eles. Veja como devolver na aba <a href="#divida">Greici e André</a>.',
        pct: null,
        stats: [
          { rotulo: "Contas atrasadas", valor: reais(p.pagoPorCredores) },
          { rotulo: "Outras despesas", valor: reais(emprestimos) },
          { rotulo: "Suas entradas", valor: reais(p.entradas) },
        ],
      });
    }

    const falta = p.totalDespesas - p.valorPago;
    return htmlResumo({
      rotulo: mes === App.mesAtual ? "Falta pagar este mês" : `Falta pagar em ${nome}`,
      valor: reais(falta),
      sub:
        p.qtd && p.qtd === p.qtdPagas
          ? `Todas as ${p.qtd} contas pagas`
          : `${p.qtdPagas} de ${plural(p.qtd, "conta paga", "contas pagas")}`,
      pct: p.totalDespesas ? Math.round((p.valorPago / p.totalDespesas) * 100) : 0,
      stats: [
        { rotulo: "Entradas", valor: reais(p.entradas) },
        { rotulo: "Despesas", valor: reais(p.totalDespesas) },
        { rotulo: "Saldo do mês", valor: reais(p.saldo), classe: p.saldo < 0 ? "negativo" : "" },
        { rotulo: "Saldo acumulado", valor: reais(p.acumulado), classe: p.acumulado < 0 ? "negativo" : "" },
      ],
    });
  }

  function avisosMes(mes) {
    const p = App.mesDados(mes);
    const nome = App.nomeMes(mes);
    const avisos = [];
    if (p.qtd === 0) return avisos;

    if (p.entradas === 0) {
      avisos.push({ tipo: "alerta", html: "<strong>Nenhuma entrada lançada neste mês.</strong> Adicione o salário e as notas PJ na seção Entradas." });
    } else if (p.saldo < 0) {
      avisos.push({
        tipo: p.acumulado < 0 ? "perigo" : "alerta",
        html:
          `<strong>As despesas de ${nome} passam as entradas em ${reais(-p.saldo)}.</strong> ` +
          (p.acumulado >= 0
            ? `A sobra dos meses anteriores cobre a diferença: o saldo acumulado fica em ${reais(p.acumulado)}.`
            : `Nem a sobra dos meses anteriores cobre: o saldo acumulado fica em ${reais(p.acumulado)}.`),
      });
    } else if (p.saldo < p.entradas * 0.05) {
      avisos.push({
        tipo: "info",
        html: `<strong>Mês apertado:</strong> depois de pagar tudo, sobram só ${reais(p.saldo)}. Qualquer gasto fora do plano deixa o mês no vermelho.`,
      });
    }

    const abertas = p.qtd - p.qtdPagas;
    if (mes < App.mesAtual && abertas > 0) {
      avisos.push({
        tipo: "alerta",
        html: `Este mês já passou e ${abertas === 1 ? "1 conta ainda não foi marcada como paga" : `${abertas} contas ainda não foram marcadas como pagas`}.`,
      });
    }

    const deles = p.pagoPorCredores + soma(emprestimosDoMes(mes).map((e) => e.valor));
    if (deles) {
      avisos.push({
        tipo: "info",
        html: `Neste mês a Greici e o André pagaram ${reais(deles)} por você. Esse valor está na aba <a href="#divida">Greici e André</a>.`,
      });
    }
    return avisos;
  }

  function htmlEntradas(mes) {
    const entradas = d().entradas.filter((e) => e.mes === mes);
    const linhas = entradas
      .map(
        (e) => `<div class="conta conta-editavel">
          <span class="marcador" aria-hidden="true"></span>
          <input class="campo" data-entrada-descricao="${e.id}" data-foco="entrada-descricao-${e.id}" value="${esc(e.descricao)}" maxlength="120" aria-label="Descrição da entrada">
          <input class="campo campo-valor" data-entrada-valor="${e.id}" data-foco="entrada-valor-${e.id}" value="${App.formatarCampo(e.valor)}" inputmode="decimal" aria-label="Valor de ${esc(e.descricao)}">
          ${botaoRemover(`data-remover-entrada="${e.id}"`, `Remover ${e.descricao}`)}
        </div>`
      )
      .join("");
    return htmlSecao(
      "Entradas",
      "Salário CLT, notas PJ e outros recebimentos. Ajuste os valores quando o mês fechar.",
      `<span id="mes-entradas-total">${reais(App.mesDados(mes).entradas)}</span>`,
      plural(entradas.length, "entrada", "entradas"),
      `<div class="cartao contas">${linhas || '<p class="vazio-linha">Nenhuma entrada lançada.</p>'}${htmlFormAdicionar(
        "entrada",
        "Nova entrada (ex.: Nota PJ)"
      )}</div>`
    );
  }

  function htmlGrupos(mes) {
    const doMes = d().despesas.filter((x) => x.valores[mes]);
    return d()
      .grupos.map((g) => {
        const contas = doMes.filter((x) => x.grupoId === g.id);
        if (!contas.length) return "";
        const proprias = contas.filter((x) => !x.valores[mes].pagoPorCredores);
        const pagas = proprias.filter((x) => x.valores[mes].pagoEm).length;
        const legenda = proprias.length
          ? `${pagas} de ${proprias.length} ${proprias.length === 1 ? "paga" : "pagas"}`
          : "pagas pela Greici e pelo André";
        return htmlSecao(
          esc(g.nome),
          esc(g.descricao),
          reais(soma(contas.map((x) => x.valores[mes].valor))),
          legenda,
          `<div class="cartao contas">${contas.map((x) => htmlConta(x, mes)).join("")}</div>`
        );
      })
      .join("");
  }

  function htmlEmprestimosMes(mes) {
    const lista = emprestimosDoMes(mes);
    if (!lista.length) return "";
    return htmlSecao(
      "Pago pela Greici e pelo André",
      "Despesas que eles pagaram por você neste mês. Entram na dívida com eles.",
      reais(soma(lista.map((e) => e.valor))),
      plural(lista.length, "item", "itens"),
      `<div class="cartao contas">${lista.map((e) => htmlLinhaSimples(e.descricao, e.valor, e.origem)).join("")}</div>`
    );
  }

  function htmlExtras(mes) {
    const extras = d().extras.filter((x) => x.mes === mes);
    const linhas = extras
      .map(
        (x) => `<div class="conta conta-com-acao${x.pagoEm ? " paga" : ""}">
          <label class="check">
            <input type="checkbox" data-pagar-extra="${x.id}"${x.pagoEm ? " checked" : ""}>
            <span class="sr-only">Marcar ${esc(x.descricao)} como pago</span>
          </label>
          <div class="conta-info">
            <div class="conta-nome"><span>${esc(x.descricao)}</span></div>
            <p class="meta">${x.pagoEm ? `pago em ${App.isoParaBr(x.pagoEm)}` : "Gasto avulso"}</p>
          </div>
          <div class="conta-valor">${reais(x.valor)}</div>
          ${botaoRemover(`data-remover-extra="${x.id}"`, `Remover ${x.descricao}`)}
        </div>`
      )
      .join("");
    return htmlSecao(
      "Extras",
      "Gastos avulsos deste mês. Entram no saldo na hora.",
      reais(App.mesDados(mes).extras),
      plural(extras.length, "extra", "extras"),
      `<div class="cartao contas">${linhas || '<p class="vazio-linha">Nenhum extra neste mês.</p>'}${htmlFormAdicionar(
        "extra",
        "Novo extra (ex.: Presente)"
      )}</div>`
    );
  }

  function htmlNovaDespesa(mes) {
    const grupos = d()
      .grupos.map((g) => `<option value="${esc(g.id)}"${g.id === "despesas-fixas" ? " selected" : ""}>${esc(g.nome)}</option>`)
      .join("");
    const categorias = d()
      .categorias.map((cat) => `<option value="devolucao:${esc(cat.id)}">Sim, é devolução: ${esc(cat.nome)}</option>`)
      .join("");
    return `<details class="cartao nova-despesa" id="nova-despesa">
      <summary><span class="marcador-mais" aria-hidden="true">${App.ICONES.mais}</span>Adicionar despesa fixa ou parcelada</summary>
      <form data-form="despesa" class="form-grade" autocomplete="off">
        <label class="campo-rotulo largo">Nome
          <input class="campo" name="nome" maxlength="120" placeholder="Ex.: Celular novo em 10x">
        </label>
        <label class="campo-rotulo">Valor por mês
          <input class="campo campo-valor" name="valor" inputmode="decimal" placeholder="0,00">
        </label>
        <label class="campo-rotulo">Primeiro mês
          <select class="campo" name="mesInicio">${opcoesMeses(mes)}</select>
        </label>
        <label class="campo-rotulo">Parcelas
          <input class="campo" name="parcelas" type="number" min="1" max="120" placeholder="Vazio = todo mês">
        </label>
        <label class="campo-rotulo">Grupo
          <select class="campo" name="grupoId">${grupos}</select>
        </label>
        <label class="campo-rotulo largo">Você paga para a Greici e o André?
          <select class="campo" name="paraCredores">
            <option value="">Não</option>
            <option value="direto">Sim, pago direto a eles (não é devolução)</option>
            ${categorias}
          </select>
        </label>
        <div class="form-acoes"><button type="submit" class="botao botao-primario">Adicionar</button></div>
      </form>
    </details>`;
  }

  function montarMes() {
    const raiz = $("#view-mes");
    raiz.innerHTML = `
      <div class="mes-nav">
        <button type="button" class="botao botao-icone" data-mes-passo="-1" aria-label="Mês anterior">${App.ICONES.anterior}</button>
        <label class="sr-only" for="mes-seletor">Escolher mês</label>
        <select id="mes-seletor" class="seletor-mes"></select>
        <button type="button" class="botao botao-icone" data-mes-passo="1" aria-label="Próximo mês">${App.ICONES.proximo}</button>
        <button type="button" class="botao" data-mes-atual>Ir para o mês atual</button>
      </div>
      <div id="mes-conteudo"></div>`;

    $("#mes-seletor").addEventListener("change", (e) => irParaMes(e.target.value));
    raiz.addEventListener("click", aoClicarMes);
    const conteudo = $("#mes-conteudo");
    conteudo.addEventListener("change", aoMudarMes);
    conteudo.addEventListener("input", aoDigitarMes);
    conteudo.addEventListener("submit", aoEnviar);
    raiz.dataset.pronto = "1";
  }

  function irParaMes(mes) {
    if (!c().indice.has(mes)) return;
    estado.mes = mes;
    history.replaceState(null, "", `#mes/${mes}`);
    renderMes();
    window.scrollTo({ top: 0 });
  }

  function statusMes(mes) {
    const p = App.mesDados(mes);
    const partes = [];
    if (mes === App.mesAtual) partes.push(" (atual)");
    if (p.qtd === 0 && p.pagoPorCredores) partes.push(" · pago pela Greici e André");
    else if (mes <= App.mesAtual && p.qtd) {
      const abertas = p.qtd - p.qtdPagas;
      partes.push(abertas ? ` · ${abertas} em aberto` : " · tudo pago");
    }
    return partes.join("");
  }

  function atualizarNavMes() {
    const { meses } = c();
    const i = meses.indexOf(estado.mes);
    const anos = [...new Set(meses.map((m) => m.slice(0, 4)))];
    $("#mes-seletor").innerHTML = anos
      .map(
        (ano) => `<optgroup label="${ano}">${meses
          .filter((m) => m.startsWith(ano))
          .map((m) => `<option value="${m}"${m === estado.mes ? " selected" : ""}>${App.nomeMes(m)}${statusMes(m)}</option>`)
          .join("")}</optgroup>`
      )
      .join("");
    $('[data-mes-passo="-1"]').disabled = i === 0;
    $('[data-mes-passo="1"]').disabled = i === meses.length - 1;
    $("[data-mes-atual]").hidden = estado.mes === App.mesAtual || !meses.includes(App.mesAtual);
  }

  function renderMes() {
    if (!$("#view-mes").dataset.pronto) montarMes();
    if (!estado.mes || !c().indice.has(estado.mes)) estado.mes = mesInicial();
    atualizarNavMes();
    const mes = estado.mes;
    $("#mes-conteudo").innerHTML = `
      <div class="painel" id="mes-resumo">${htmlResumoMes(mes)}</div>
      <div id="mes-avisos">${htmlAvisos(avisosMes(mes))}</div>
      ${htmlEntradas(mes)}
      ${htmlGrupos(mes)}
      ${htmlEmprestimosMes(mes)}
      ${htmlExtras(mes)}
      ${htmlNovaDespesa(mes)}`;
  }

  // Atualiza só os números (enquanto a pessoa digita uma entrada).
  function atualizarNumerosMes() {
    $("#mes-resumo").innerHTML = htmlResumoMes(estado.mes);
    $("#mes-avisos").innerHTML = htmlAvisos(avisosMes(estado.mes));
    const total = $("#mes-entradas-total");
    if (total) total.textContent = reais(App.mesDados(estado.mes).entradas);
  }

  function definirMes(mes) {
    estado.mes = mes;
  }

  // ---------- Ações da aba "Mês" ----------

  function marcarDespesa(id, mes, marcado) {
    const despesa = porId(d().despesas, id);
    const anterior = despesa.valores[mes].pagoEm;
    const caminho = `/api/despesas/${despesa.id}/meses/${mes}/pago`;
    App.salvar("PUT", caminho, { pagoEm: marcado ? anterior || App.isoHoje() : null }, {
      mensagem: `${despesa.nome} (${App.mesCurto(mes)}) ${marcado ? "marcada como paga" : "voltou para “a pagar”"}`,
      desfazer: () => App.salvar("PUT", caminho, { pagoEm: anterior || null }),
    });
  }

  function marcarExtra(id, marcado) {
    const extra = porId(d().extras, id);
    const anterior = extra.pagoEm;
    App.salvar("PATCH", `/api/extras/${extra.id}`, { pagoEm: marcado ? anterior || App.isoHoje() : null }, {
      mensagem: `${extra.descricao} ${marcado ? "marcado como pago" : "voltou para “a pagar”"}`,
      desfazer: () => App.salvar("PATCH", `/api/extras/${extra.id}`, { pagoEm: anterior || null }),
    });
  }

  function aoDigitarMes(evento) {
    const alvo = evento.target;
    if (!alvo.dataset.entradaValor) return;
    const valor = alvo.value.trim() === "" ? 0 : App.lerReais(alvo.value);
    alvo.classList.toggle("invalido", valor == null);
    if (valor == null) return;
    porId(d().entradas, alvo.dataset.entradaValor).valor = valor;
    App.recalcular();
    atualizarNumerosMes();
  }

  function aoMudarMes(evento) {
    const alvo = evento.target;
    if (alvo.dataset.pagarDespesa) {
      marcarDespesa(alvo.dataset.pagarDespesa, alvo.dataset.mes, alvo.checked);
    } else if (alvo.dataset.pagarExtra) {
      marcarExtra(alvo.dataset.pagarExtra, alvo.checked);
    } else if (alvo.dataset.entradaValor) {
      const entrada = porId(d().entradas, alvo.dataset.entradaValor);
      const valor = alvo.value.trim() === "" ? 0 : App.lerReais(alvo.value);
      if (valor == null) {
        App.toast("Valor inválido. Use, por exemplo, 4.750,00.");
        App.carregar().then(() => App.renderAtual());
        return;
      }
      alvo.value = App.formatarCampo(valor);
      alvo.classList.remove("invalido");
      App.salvar("PATCH", `/api/entradas/${entrada.id}`, { valor }, { renderizar: false });
    } else if (alvo.dataset.entradaDescricao) {
      const entrada = porId(d().entradas, alvo.dataset.entradaDescricao);
      const descricao = alvo.value.trim();
      if (!descricao) {
        alvo.value = entrada.descricao;
        return;
      }
      entrada.descricao = descricao;
      App.salvar("PATCH", `/api/entradas/${entrada.id}`, { descricao }, { renderizar: false });
    }
  }

  function aoClicarMes(evento) {
    const alvo = evento.target;
    const passo = alvo.closest("[data-mes-passo]");
    if (passo) {
      const { meses } = c();
      const i = meses.indexOf(estado.mes) + Number(passo.dataset.mesPasso);
      if (i >= 0 && i < meses.length) irParaMes(meses[i]);
      return;
    }
    if (alvo.closest("[data-mes-atual]")) {
      irParaMes(App.mesAtual);
      return;
    }

    const entrada = alvo.closest("[data-remover-entrada]");
    if (entrada) {
      const e = porId(d().entradas, entrada.dataset.removerEntrada);
      App.salvar("DELETE", `/api/entradas/${e.id}`, undefined, {
        mensagem: `${e.descricao} removida`,
        desfazer: () => App.salvar("POST", "/api/entradas", { mes: e.mes, descricao: e.descricao, valor: e.valor }),
      });
      return;
    }
    const extra = alvo.closest("[data-remover-extra]");
    if (extra) {
      const x = porId(d().extras, extra.dataset.removerExtra);
      App.salvar("DELETE", `/api/extras/${x.id}`, undefined, {
        mensagem: `${x.descricao} removido`,
        desfazer: () => App.salvar("POST", "/api/extras", { mes: x.mes, descricao: x.descricao, valor: x.valor }),
      });
      return;
    }
    const despesa = alvo.closest("[data-remover-despesa]");
    if (despesa) {
      const x = porId(d().despesas, despesa.dataset.removerDespesa);
      const meses = Object.keys(x.valores).length;
      if (window.confirm(`Remover “${x.nome}” de ${plural(meses, "mês", "meses")}?`)) {
        App.salvar("DELETE", `/api/despesas/${x.id}`, undefined, { mensagem: `${x.nome} removida` });
      }
    }
  }

  async function aoEnviar(evento) {
    const form = evento.target.closest("form[data-form]");
    if (!form) return;
    evento.preventDefault();
    const campos = new FormData(form);
    const tipo = form.dataset.form;

    if (tipo === "entrada" || tipo === "extra" || tipo === "emprestimo") {
      const descricao = String(campos.get("descricao") || "").trim();
      const valor = App.lerReais(campos.get("valor"));
      if (!descricao) return App.toast("Informe a descrição.");
      if (valor == null || (tipo !== "entrada" && valor <= 0)) return App.toast("Informe um valor válido, como 150,00.");

      if (tipo === "emprestimo") {
        await App.salvar(
          "POST",
          "/api/emprestimos",
          { mes: campos.get("mes"), descricao, valor, categoriaDivida: campos.get("categoriaDivida") },
          { mensagem: `${descricao} registrado na dívida` }
        );
        return;
      }
      const ok = await App.salvar("POST", tipo === "entrada" ? "/api/entradas" : "/api/extras", { mes: estado.mes, descricao, valor }, {
        renderizar: false,
        mensagem: `${descricao} adicionad${tipo === "entrada" ? "a" : "o"}`,
      });
      if (ok) {
        renderMes();
        const campo = $(`[data-foco="novo-${tipo}-descricao"]`);
        if (campo) campo.focus();
      }
      return;
    }

    if (tipo === "despesa") {
      const nome = String(campos.get("nome") || "").trim();
      const valor = App.lerReais(campos.get("valor"));
      const parcelasTexto = String(campos.get("parcelas") || "").trim();
      if (!nome) return App.toast("Informe o nome da despesa.");
      if (valor == null || valor <= 0) return App.toast("Informe o valor por mês, como 199,90.");
      const parcelas = parcelasTexto ? Number(parcelasTexto) : null;
      if (parcelas != null && (!Number.isInteger(parcelas) || parcelas < 1 || parcelas > 120)) {
        return App.toast("As parcelas devem ser um número entre 1 e 120.");
      }
      const paraCredores = String(campos.get("paraCredores") || "");
      await App.salvar(
        "POST",
        "/api/despesas",
        {
          nome,
          valor,
          parcelas,
          mesInicio: campos.get("mesInicio"),
          grupoId: campos.get("grupoId"),
          categoriaDivida: paraCredores.startsWith("devolucao:") ? paraCredores.slice("devolucao:".length) : null,
          pagoAosCredores: paraCredores === "direto",
        },
        { mensagem: parcelas ? `${nome} adicionada em ${plural(parcelas, "parcela", "parcelas")}` : `${nome} adicionada todo mês` }
      );
    }
  }

  // ---------- Aba "Greici e André" ----------

  // "luz, internet e faxina"
  function nomesContasDiretas() {
    return juntar(c().divida.contasDiretas.map((x) => (x.nomeCurto || x.nome).toLowerCase()));
  }

  function htmlResumoDivida() {
    const dv = c().divida;
    const falta = dv.pagoPorEles - dv.devolvido;
    const ultimoMes = dv.mesesPlano[dv.mesesPlano.length - 1];
    const mes = App.mesAtual;
    const paraEles = soma([...dv.devolucoes, ...dv.contasDiretas].map((x) => x.valores[mes] && x.valores[mes].valor));
    return htmlResumo({
      rotulo: "Falta devolver para a Greici e o André",
      valor: reais(Math.max(0, falta)),
      sub:
        falta <= 0
          ? `Você já devolveu tudo o que eles pagaram até agora${falta < 0 ? ` (e ${reais(-falta)} a mais)` : ""}.`
          : `${reais(dv.devolvido)} devolvidos de ${reais(dv.pagoPorEles)} que eles já pagaram`,
      pct: dv.pagoPorEles ? Math.min(100, Math.round((dv.devolvido / dv.pagoPorEles) * 100)) : 0,
      stats: [
        { rotulo: "Eles já pagaram", valor: reais(dv.pagoPorEles), sub: "contas, cartão e carro" },
        { rotulo: "Você devolveu", valor: reais(dv.devolvido), sub: `${dv.qtdDevolvidas} de ${plural(dv.qtdParcelas, "parcela", "parcelas")}` },
        { rotulo: "Plano termina em", valor: ultimoMes ? App.mesCurto(ultimoMes) : "—", sub: `${reais(dv.plano)} no total` },
        {
          rotulo: `Para eles em ${App.mesCurto(mes)}`,
          valor: reais(paraEles),
          sub: dv.contasDiretas.length ? `devolução + ${esc(nomesContasDiretas())}` : "devolução",
        },
      ],
    });
  }

  function htmlExpansivel(id, titulo, meta, valor, itens) {
    const aberto = estado.abertos.has(id);
    return `<div class="conta conta-expansivel">
      <span class="marcador" aria-hidden="true"></span>
      <div class="conta-info">
        <div class="conta-nome"><span>${titulo}</span></div>
        <p class="meta">${meta}</p>
      </div>
      <div class="conta-valor">${valor}</div>
      <button type="button" class="botao botao-icone" data-expandir="${id}" aria-expanded="${aberto}" aria-controls="${id}" aria-label="Ver itens">${App.ICONES.seta}</button>
      <ul class="sublista" id="${id}"${aberto ? "" : " hidden"}>
        ${itens
          .map(
            (l) =>
              `<li><span>${esc(l.nome)}</span><span>${reais(l.valor)}</span>${
                l.removerId ? botaoRemover(`data-remover-emprestimo="${l.removerId}"`, `Remover ${l.nome}`) : ""
              }</li>`
          )
          .join("")}
      </ul>
    </div>`;
  }

  function htmlPagasPorEles() {
    const dv = c().divida;
    const linhas = [];

    c().porMes
      .filter((p) => p.pagoPorCredores)
      .forEach((p) => {
        const contas = d().despesas.filter((x) => x.valores[p.mes] && x.valores[p.mes].pagoPorCredores);
        linhas.push(
          htmlExpansivel(
            `exp-contas-${p.mes}`,
            `Contas atrasadas quitadas em ${App.nomeMes(p.mes)}`,
            `${plural(contas.length, "conta", "contas")}: condomínio, aluguel, luz e outras`,
            reais(p.pagoPorCredores),
            contas.map((x) => ({ nome: x.nome, valor: x.valores[p.mes].valor }))
          )
        );
      });

    const grupos = new Map();
    d().emprestimos.forEach((e) => {
      const chave = `${e.origem}|${e.mes || ""}`;
      if (!grupos.has(chave)) grupos.set(chave, { origem: e.origem, mes: e.mes, itens: [] });
      grupos.get(chave).itens.push(e);
    });
    grupos.forEach((g) => {
      const quando = g.mes ? ` em ${App.nomeMes(g.mes)}` : "";
      if (g.itens.length === 1) {
        const e = g.itens[0];
        linhas.push(`<div class="conta conta-com-acao">
          <span class="marcador" aria-hidden="true"></span>
          <div class="conta-info">
            <div class="conta-nome"><span>${esc(e.descricao)}</span></div>
            <p class="meta">${esc(`${g.origem}${quando} · ${App.nomeCategoria(e.categoriaDivida)}`)}</p>
          </div>
          <div class="conta-valor">${reais(e.valor)}</div>
          ${botaoRemover(`data-remover-emprestimo="${e.id}"`, `Remover ${e.descricao}`)}
        </div>`);
      } else {
        linhas.push(
          htmlExpansivel(
            `exp-${g.origem}-${g.mes}`.replace(/[^\w-]/g, "-"),
            `${esc(g.origem)}${quando}`,
            plural(g.itens.length, "item", "itens"),
            reais(soma(g.itens.map((e) => e.valor))),
            g.itens.map((e) => ({ nome: e.descricao, valor: e.valor, removerId: e.id }))
          )
        );
      }
    });

    const carro = c().carro;
    linhas.push(`<div class="conta">
      <span class="marcador" aria-hidden="true"></span>
      <div class="conta-info">
        <div class="conta-nome"><span>Carro: multas, CRLV e pátio</span><a class="tag tag-link" href="#multas">Ver</a></div>
        <p class="meta">${carro.qtdPagos} de ${carro.qtdTotal} itens pagos por eles${carro.emAberto ? ` · ainda faltam ${reais(carro.emAberto)}` : ""}</p>
      </div>
      <div class="conta-valor">${reais(carro.pago)}</div>
    </div>`);

    const categorias = d()
      .categorias.map((cat) => `<option value="${esc(cat.id)}">${esc(cat.nome)}</option>`)
      .join("");
    const form = `<details class="adicionar-detalhes">
      <summary><span class="marcador-mais" aria-hidden="true">${App.ICONES.mais}</span>Registrar outro valor que eles pagaram</summary>
      <form data-form="emprestimo" class="form-grade" autocomplete="off">
        <label class="campo-rotulo largo">Descrição<input class="campo" name="descricao" maxlength="120" placeholder="Ex.: Conserto do carro"></label>
        <label class="campo-rotulo">Valor<input class="campo campo-valor" name="valor" inputmode="decimal" placeholder="0,00"></label>
        <label class="campo-rotulo">Mês<select class="campo" name="mes">${opcoesMeses(App.mesAtual)}</select></label>
        <label class="campo-rotulo largo">Parte da dívida<select class="campo" name="categoriaDivida">${categorias}</select></label>
        <div class="form-acoes"><button type="submit" class="botao botao-primario">Registrar</button></div>
      </form>
    </details>`;

    return htmlSecao(
      "O que eles pagaram por você",
      "Contas de agosto, despesas da Greici, compras no cartão e o que for marcado como pago na aba Multas.",
      reais(dv.pagoPorEles),
      "até agora",
      `<div class="cartao contas">${linhas.join("")}${form}</div>`
    );
  }

  function mesesDoPlano() {
    const dv = c().divida;
    const meses = new Set(dv.mesesPlano);
    if (estado.editandoPlano) estado.mesesNovosPlano.forEach((m) => meses.add(m));
    return [...meses].sort();
  }

  function htmlPlano() {
    const dv = c().divida;
    const diretas = dv.contasDiretas;
    const colunas = [...dv.devolucoes, ...diretas];
    const editando = estado.editandoPlano;
    const meses = mesesDoPlano();

    const linhas = meses
      .map((mes) => {
        const atual = mes === App.mesAtual;
        const celulas = colunas
          .map((despesa, k) => {
            const v = despesa.valores[mes];
            const rotulo = `${despesa.nomeCurto || despesa.nome} em ${App.nomeMes(mes)}`;
            const inicioGrupo = diretas.length && k === dv.devolucoes.length ? " inicio-grupo" : "";
            if (editando && despesa.pagoAosCredores && !despesa.categoriaDivida) {
              // Contas fixas: aparecem para conferir o total, mas não são editadas aqui.
              return `<td class="num${inicioGrupo}${v ? "" : " vazio-celula"}">${v ? reais(v.valor) : "—"}</td>`;
            }
            if (editando) {
              return `<td class="num">
                <input class="campo campo-valor campo-tabela" data-plano-despesa="${despesa.id}" data-plano-mes="${mes}"
                  data-foco="plano-${despesa.id}-${mes}" value="${v ? App.formatarCampo(v.valor) : ""}" placeholder="—"
                  inputmode="decimal" aria-label="${esc(rotulo)}">
                ${v && v.pagoEm ? '<span class="tag tag-pago">paga</span>' : ""}
              </td>`;
            }
            if (!v) return `<td class="num vazio-celula${inicioGrupo}">—</td>`;
            const atrasada = !v.pagoEm && mes < App.mesAtual;
            return `<td class="num${inicioGrupo}">
              <label class="check-valor${v.pagoEm ? " paga" : ""}">
                <input type="checkbox" data-pagar-despesa="${despesa.id}" data-mes="${mes}"${v.pagoEm ? " checked" : ""}>
                <span>${reais(v.valor)}</span>
                <span class="sr-only">${esc(rotulo)}</span>
              </label>
              ${atrasada ? '<span class="tag tag-alerta">atrasada</span>' : ""}
            </td>`;
          })
          .join("");
        const total = soma(colunas.map((despesa) => despesa.valores[mes] && despesa.valores[mes].valor));
        return `<tr${atual ? ' class="atual"' : ""}>
          <th scope="row">${App.mesCurto(mes)}${atual ? ' <span class="tag">atual</span>' : ""}</th>
          ${celulas}
          <td class="num total-para-eles">${reais(total)}</td>
        </tr>`;
      })
      .join("");

    // Devolução: total do plano inteiro. Contas diretas: só dos meses mostrados.
    const totalColuna = (despesa) =>
      despesa.categoriaDivida
        ? soma(Object.values(despesa.valores).map((v) => v.valor))
        : soma(meses.map((m) => despesa.valores[m] && despesa.valores[m].valor));
    const totais = colunas
      .map((despesa, k) => {
        const inicioGrupo = diretas.length && k === dv.devolucoes.length ? " inicio-grupo" : "";
        return `<td class="num${inicioGrupo}">${reais(totalColuna(despesa))}</td>`;
      })
      .join("");
    const totalGeral = soma(colunas.map(totalColuna));

    const cabecalhoColuna = (despesa, k) =>
      `<th scope="col" class="num${diretas.length && k === dv.devolucoes.length ? " inicio-grupo" : ""}" title="${esc(despesa.nome)}">${esc(
        despesa.nomeCurto || despesa.nome
      )}</th>`;
    const cabecalho = diretas.length
      ? `<tr class="grupos-colunas">
           <td></td>
           <th scope="colgroup" colspan="${dv.devolucoes.length}" class="num">Devolução</th>
           <th scope="colgroup" colspan="${diretas.length}" class="num inicio-grupo">Pago direto a eles</th>
           <td></td>
         </tr>
         <tr>
           <th scope="col">Mês</th>
           ${colunas.map(cabecalhoColuna).join("")}
           <th scope="col" class="num">Total para eles</th>
         </tr>`
      : `<tr>
           <th scope="col">Mês</th>
           ${colunas.map(cabecalhoColuna).join("")}
           <th scope="col" class="num">Total do mês</th>
         </tr>`;

    const tabela = `<div class="cartao tabela-wrap">
      <table class="tabela tabela-plano">
        <thead>${cabecalho}</thead>
        <tbody>${linhas || `<tr><td colspan="${colunas.length + 2}" class="vazio-celula">Nenhuma parcela no plano.</td></tr>`}</tbody>
        <tfoot><tr><th scope="row">Total</th>${totais}<td class="num">${reais(totalGeral)}</td></tr></tfoot>
      </table>
    </div>`;

    const explicacaoDiretas = diretas.length
      ? ` ${App.titulo(nomesContasDiretas())} não são devolução: você paga direto a eles junto com as parcelas, e por isso entram no “Total para eles” mas não na dívida.`
      : "";
    const barra = `<div class="barra-plano">
      <p class="sub">${
        editando
          ? "Digite os valores combinados da devolução. Deixe vazio para tirar a parcela do mês. Tudo é salvo na hora."
          : `Marque cada pagamento quando fizer. Eles também aparecem na aba Mês.${esc(explicacaoDiretas)}`
      }</p>
      <div class="barra-plano-acoes">
        ${editando ? `<button type="button" class="botao" data-plano-adicionar-mes>${App.ICONES.mais}Adicionar mês</button>` : ""}
        <button type="button" class="botao${editando ? " botao-primario" : ""}" data-editar-plano>${editando ? "Concluir edição" : `${App.ICONES.editar}Editar plano`}</button>
      </div>
    </div>`;

    return htmlSecao("Plano de devolução", "", reais(dv.plano), `${plural(dv.qtdParcelas, "parcela", "parcelas")} de devolução`, tabela, barra);
  }

  function htmlComparacao() {
    const dv = c().divida;
    const linhas = dv.categorias
      .filter((cat) => cat.previsto || cat.plano)
      .map(
        (cat) => `<tr>
          <th scope="row">${esc(cat.nome)}</th>
          <td class="num">${reais(cat.previsto)}</td>
          <td class="num">${reais(cat.plano)}</td>
          <td class="num">${sinal(cat.plano - cat.previsto)}</td>
        </tr>`
      )
      .join("");
    const tabela = `<div class="cartao tabela-wrap">
      <table class="tabela">
        <thead><tr>
          <th scope="col">Parte</th>
          <th scope="col" class="num">Eles pagam</th>
          <th scope="col" class="num">No plano</th>
          <th scope="col" class="num">Diferença</th>
        </tr></thead>
        <tbody>${linhas}</tbody>
        <tfoot><tr>
          <th scope="row">Total</th>
          <td class="num">${reais(dv.previsto)}</td>
          <td class="num">${reais(dv.plano)}</td>
          <td class="num">${sinal(dv.plano - dv.previsto)}</td>
        </tr></tfoot>
      </table>
    </div>`;
    return htmlSecao(
      "Plano × o que eles pagam",
      "“Eles pagam” soma o que já foi pago e o que falta do carro pelos valores de hoje. Diferença positiva: o plano devolve mais do que isso.",
      "",
      "",
      tabela
    );
  }

  function renderDivida() {
    const raiz = $("#view-divida");
    if (!raiz.dataset.pronto) {
      raiz.innerHTML = '<div class="painel" id="div-resumo"></div><div id="div-pagas"></div><div id="div-plano"></div><div id="div-comparacao"></div>';
      raiz.addEventListener("change", aoMudarDivida);
      raiz.addEventListener("click", aoClicarDivida);
      raiz.addEventListener("submit", aoEnviar);
      raiz.dataset.pronto = "1";
    }
    $("#div-resumo").innerHTML = htmlResumoDivida();
    $("#div-pagas").innerHTML = htmlPagasPorEles();
    $("#div-plano").innerHTML = htmlPlano();
    $("#div-comparacao").innerHTML = htmlComparacao();
  }

  function editarCelulaPlano(campo) {
    const despesa = porId(d().despesas, campo.dataset.planoDespesa);
    const mes = campo.dataset.planoMes;
    const atual = despesa.valores[mes];
    const valor = campo.value.trim() === "" ? 0 : App.lerReais(campo.value);
    if (valor == null) {
      App.toast("Valor inválido. Use, por exemplo, 1.500,00.");
      campo.value = atual ? App.formatarCampo(atual.valor) : "";
      return;
    }
    if (valor === (atual ? atual.valor : 0)) {
      campo.value = valor ? App.formatarCampo(valor) : "";
      return;
    }
    if (valor === 0) delete despesa.valores[mes];
    else despesa.valores[mes] = { pagoEm: null, pagoPorCredores: false, ...(atual || {}), valor };
    if (!estado.mesesNovosPlano.includes(mes)) estado.mesesNovosPlano.push(mes);
    App.recalcular();
    App.salvar("PUT", `/api/despesas/${despesa.id}/meses/${mes}`, { valor }, { renderizar: false });
    // Espera o foco ir para o próximo campo antes de redesenhar a tabela.
    setTimeout(() => App.preservarFoco(renderDivida), 0);
  }

  function aoMudarDivida(evento) {
    const alvo = evento.target;
    if (alvo.dataset.planoDespesa) editarCelulaPlano(alvo);
    else if (alvo.dataset.pagarDespesa) marcarDespesa(alvo.dataset.pagarDespesa, alvo.dataset.mes, alvo.checked);
  }

  function aoClicarDivida(evento) {
    const alvo = evento.target;
    const expandir = alvo.closest("[data-expandir]");
    if (expandir) {
      const lista = document.getElementById(expandir.dataset.expandir);
      const abrir = lista.hidden;
      lista.hidden = !abrir;
      expandir.setAttribute("aria-expanded", String(abrir));
      if (abrir) estado.abertos.add(expandir.dataset.expandir);
      else estado.abertos.delete(expandir.dataset.expandir);
      return;
    }
    if (alvo.closest("[data-editar-plano]")) {
      estado.editandoPlano = !estado.editandoPlano;
      estado.mesesNovosPlano = [];
      renderDivida();
      return;
    }
    if (alvo.closest("[data-plano-adicionar-mes]")) {
      const meses = mesesDoPlano();
      const novo = App.proximoMes(meses.length ? meses[meses.length - 1] : App.mesAtual);
      estado.mesesNovosPlano.push(novo);
      renderDivida();
      const campo = document.querySelector(`[data-plano-mes="${novo}"]`);
      if (campo) campo.focus();
      return;
    }
    const remover = alvo.closest("[data-remover-emprestimo]");
    if (remover) {
      const e = porId(d().emprestimos, remover.dataset.removerEmprestimo);
      if (window.confirm(`Tirar “${e.descricao}” (${reais(e.valor)}) da dívida?`)) {
        App.salvar("DELETE", `/api/emprestimos/${e.id}`, undefined, {
          mensagem: `${e.descricao} removido da dívida`,
          desfazer: () =>
            App.salvar("POST", "/api/emprestimos", {
              mes: e.mes,
              descricao: e.descricao,
              valor: e.valor,
              categoriaDivida: e.categoriaDivida,
              origem: e.origem,
            }),
        });
      }
    }
  }

  // ---------- Aba "Projeção" ----------

  function faixas(indices) {
    const grupos = [];
    indices.forEach((i) => {
      const g = grupos[grupos.length - 1];
      if (g && g[1] === i - 1) g[1] = i;
      else grupos.push([i, i]);
    });
    const { meses } = c();
    return grupos.map(([a, b]) => (a === b ? App.mesCurto(meses[a]) : `${App.mesCurto(meses[a])} a ${App.mesCurto(meses[b])}`));
  }

  function juntar(lista) {
    if (lista.length <= 1) return lista.join("");
    return `${lista.slice(0, -1).join(", ")} e ${lista[lista.length - 1]}`;
  }

  function dadosProjecao() {
    const { meses, porMes } = c();
    const ultimo = meses.length - 1;
    const primeiro = Math.max(0, porMes.findIndex((p) => p.entradas || p.totalDespesas));
    let iFim = -1;
    d().despesas.forEach((despesa) => {
      const ultimoMes = Object.keys(despesa.valores).sort().pop();
      const i = c().indice.get(ultimoMes);
      if (i != null && i < ultimo) iFim = Math.max(iFim, i);
    });
    const sobras = porMes.slice(iFim + 1).map((p) => p.saldo);
    return { ultimo, primeiro, iFim, sobras };
  }

  function pontosDeAtencao() {
    const { porMes } = c();
    const pontos = [];
    const indices = porMes.map((_, i) => i);

    const negativos = indices.filter((i) => porMes[i].qtd && porMes[i].saldo < 0);
    if (negativos.length) {
      pontos.push({
        tipo: "alerta",
        html: `<strong>${juntar(faixas(negativos))} ${negativos.length === 1 ? "fecha" : "fecham"} no vermelho</strong> (${negativos
          .map((i) => reais(porMes[i].saldo))
          .join(", ")}). ${porMes[negativos[negativos.length - 1]].acumulado >= 0 ? "A sobra dos meses anteriores cobre, mas não deixa folga." : "O saldo acumulado também fica negativo."}`,
      });
    }

    const apertados = indices.filter((i) => {
      const p = porMes[i];
      return p.qtd && p.entradas && p.saldo >= 0 && p.saldo < p.entradas * 0.05;
    });
    if (apertados.length) {
      const valores = apertados.map((i) => porMes[i].saldo);
      pontos.push({
        tipo: "alerta",
        html: `<strong>Meses apertados: ${juntar(faixas(apertados))}.</strong> Sobram entre ${reais(Math.min(...valores))} e ${reais(
          Math.max(...valores)
        )} por mês. Um gasto inesperado nesse período já desequilibra o plano.`,
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

  function htmlTabelaMeses() {
    const linhas = c()
      .porMes.map((p) => {
        const atual = p.mes === App.mesAtual;
        const celula = (v, classe = "") => `<td class="num${classe}">${v == null ? "—" : reais(v)}</td>`;
        const deles = p.qtd === 0 && p.pagoPorCredores ? ' <span class="tag">Greici e André</span>' : "";
        return `<tr${atual ? ' class="atual"' : ""} data-ir-mes="${p.mes}">
          <th scope="row"><a href="#mes/${p.mes}">${App.mesCurto(p.mes)}</a>${deles}${atual ? ' <span class="tag">atual</span>' : ""}</th>
          ${celula(p.entradas)}
          ${celula(p.totalDespesas)}
          ${celula(p.saldo, p.saldo < 0 ? " negativo" : "")}
          ${celula(p.acumulado, p.acumulado < 0 ? " negativo" : "")}
          ${celula(p.cdbSimples)}
          ${celula(p.cdbComposto)}
        </tr>`;
      })
      .join("");
    return `<div class="cartao tabela-wrap tabela-rolagem">
      <table class="tabela">
        <thead><tr>
          <th scope="col">Mês</th>
          <th scope="col" class="num">Entradas</th>
          <th scope="col" class="num">Despesas</th>
          <th scope="col" class="num">Saldo do mês</th>
          <th scope="col" class="num">Acumulado</th>
          <th scope="col" class="num">CDB sem juros compostos</th>
          <th scope="col" class="num">CDB com juros compostos</th>
        </tr></thead>
        <tbody>${linhas}</tbody>
      </table>
    </div>`;
  }

  function renderProjecao() {
    const raiz = $("#view-projecao");
    const { meses, porMes } = c();
    const proj = dadosProjecao();
    const fim = porMes[proj.ultimo];
    const taxa = d().config.cdbTaxaMensal || 0;
    const taxaTexto = `${(taxa * 100).toLocaleString("pt-BR")}% ao mês`;

    const kpis = [];
    if (proj.iFim >= 0) {
      const faltam = App.diferencaMeses(App.mesAtual, meses[proj.iFim]);
      kpis.push({ rotulo: "Fim das parcelas e devoluções", valor: App.nomeMes(meses[proj.iFim]), sub: faltam > 0 ? `daqui a ${plural(faltam, "mês", "meses")}` : "" });
      if (proj.sobras.length) {
        const min = Math.min(...proj.sobras);
        const max = Math.max(...proj.sobras);
        kpis.push({
          rotulo: "Sobra por mês depois disso",
          valor: min === max ? App.reaisInteiros(min) : `${App.reaisInteiros(min)} a ${App.reaisInteiros(max).replace(/^R\$\s*/, "")}`,
          sub: `a partir de ${App.nomeMes(meses[proj.iFim + 1])}`,
        });
      }
    }
    kpis.push({ rotulo: `Guardado em ${App.mesCurto(fim.mes)}`, valor: reais(fim.acumulado), sub: "somando as sobras, sem rendimento" });
    kpis.push({ rotulo: "CDB com juros compostos", valor: reais(fim.cdbComposto), sub: `${taxaTexto}; o rendimento também rende` });
    kpis.push({ rotulo: "CDB sem juros compostos", valor: reais(fim.cdbSimples), sub: "fórmula da planilha: 1 mês de rendimento" });

    raiz.innerHTML = `
      <div class="kpis">
        ${kpis
          .map((k) => `<div class="cartao stat"><p class="stat-rotulo">${k.rotulo}</p><p class="stat-valor">${k.valor}</p><p class="sub">${k.sub}</p></div>`)
          .join("")}
      </div>
      <section class="cartao grafico-cartao">
        <div class="grafico-topo">
          <div>
            <h2>Quanto você vai ter guardado</h2>
            <p class="sub">Saldo acumulado de ${App.mesCurto(meses[proj.primeiro])} a ${App.mesCurto(fim.mes)}</p>
          </div>
          <ul class="legenda">
            <li><span class="chave-linha serie-1"></span>Saldo acumulado</li>
            <li><span class="chave-linha serie-2"></span>CDB com juros compostos</li>
          </ul>
        </div>
        <div class="grafico" id="grafico-projecao"></div>
      </section>
      ${htmlSecao("Pontos de atenção", "Calculados com as entradas, despesas e extras de hoje.", "", "", htmlAvisos(pontosDeAtencao()) || '<p class="sub">Nada fora do normal.</p>')}
      ${htmlSecao("Mês a mês", "Clique em um mês para ver as contas.", "", "", htmlTabelaMeses())}`;

    App.desenharGrafico($("#grafico-projecao"), {
      meses: meses.slice(proj.primeiro),
      series: [
        { nome: "Saldo acumulado", classe: "serie-1", valores: porMes.slice(proj.primeiro).map((p) => p.acumulado) },
        { nome: "CDB com juros compostos", classe: "serie-2", valores: porMes.slice(proj.primeiro).map((p) => p.cdbComposto) },
      ],
      marco: proj.iFim >= proj.primeiro ? { i: proj.iFim - proj.primeiro, texto: "Fim das devoluções" } : null,
    });

    if (!raiz.dataset.pronto) {
      raiz.addEventListener("click", (e) => {
        const linha = e.target.closest("[data-ir-mes]");
        if (linha && !e.target.closest("a")) location.hash = `#mes/${linha.dataset.irMes}`;
      });
      raiz.dataset.pronto = "1";
    }
  }

  App.financas = { renderMes, renderDivida, renderProjecao, definirMes };
})();
