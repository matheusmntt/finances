// Aba "Multas": boletos do Detran, CRLV e pátio, pagos pela Greici e pelo André.
(function () {
  "use strict";

  const App = window.App;
  const { $, $$, esc, reais, plural, semAcento, titulo, data, diasAte } = App;

  const CHAVE_FILTRO = "multas.filtro.v1";
  const FILTROS = ["pendentes", "pagos", "todos"];

  const SECOES = [
    {
      id: "a-vencer",
      titulo: "A vencer",
      nota: "Com 20% de desconto. Depois da validade, o desconto é perdido e a multa volta ao valor cheio com juros.",
    },
    { id: "vencidos", titulo: "Vencidos", nota: "Já com juros de mora." },
  ];

  const filtroSalvo = App.ler(CHAVE_FILTRO, "pendentes");
  const estado = {
    filtro: FILTROS.includes(filtroSalvo) ? filtroSalvo : "pendentes",
    busca: "",
    abertos: new Set(),
  };

  const multas = () => App.dados.multas;
  const porSerie = (serie) => multas().find((m) => m.serie === serie);

  // ---------- Utilidades ----------

  function prazoTexto(dias) {
    if (dias < -1) return `expirou há ${-dias} dias`;
    if (dias === -1) return "expirou ontem";
    if (dias === 0) return "vence hoje";
    if (dias === 1) return "vence amanhã";
    return `em ${dias} dias`;
  }

  function nivel(dias) {
    if (dias < 0) return "expirada";
    if (dias <= 7) return "critico";
    if (dias <= 15) return "alerta";
    return "normal";
  }

  function infracao(b) {
    return App.dados.infracoes[b.codigoInfracao] || null;
  }

  function descricao(b) {
    const i = infracao(b);
    return i ? i.descricao : titulo(b.descricao);
  }

  function tipo(b) {
    const i = infracao(b);
    if (i) return i.tipo;
    return b.velocidade ? "Velocidade" : "Infração";
  }

  function composicao(b) {
    if (b.situacao === "a-vencer") return `${reais(b.valorOriginal)} − 20%`;
    if (b.juros) return `${reais(b.valorOriginal)} + ${reais(b.juros)} juros`;
    return "";
  }

  function geradas(serie) {
    return multas()
      .filter((m) => m.origem === serie)
      .map((m) => m.serie);
  }

  // Boleto bancário: os 10 últimos dígitos são o valor. Guias de arrecadação não precisam disso.
  function valorNoCodigo(linha) {
    const digitos = String(linha || "").replace(/\D/g, "");
    return digitos.length === 47 ? Number(digitos.slice(-10)) : null;
  }

  function linkSerie(serie) {
    if (!porSerie(serie)) return esc(serie);
    return `<a href="#b-${esc(serie)}" data-ir="${esc(serie)}">${esc(serie)}</a>`;
  }

  // ---------- Filtros ----------

  function corresponde(textos) {
    if (!estado.busca) return true;
    const alvo = semAcento(textos.filter(Boolean).join(" "));
    return semAcento(estado.busca)
      .split(/\s+/)
      .filter(Boolean)
      .every((termo) => alvo.includes(termo));
  }

  function passaFiltro(pago) {
    if (estado.filtro === "pendentes" && pago) return false;
    if (estado.filtro === "pagos" && !pago) return false;
    return true;
  }

  function multaVisivel(b) {
    return (
      passaFiltro(Boolean(b.pagoEm)) &&
      corresponde([b.serie, b.descricao, descricao(b), tipo(b), b.local, b.municipio, b.autuador, b.origem, b.guia, b.dataInfracao])
    );
  }

  function custoVisivel(c) {
    return passaFiltro(Boolean(c.pagoEm)) && corresponde([c.descricao, c.detalhe, "carro"]);
  }

  function ordenar(a, b) {
    return (
      data(a.validade) - data(b.validade) ||
      data(b.dataInfracao) - data(a.dataInfracao) ||
      a.serie.localeCompare(b.serie)
    );
  }

  // ---------- Renderização ----------

  function renderResumo() {
    const c = App.calc.carro;
    const multasAbertas = multas().filter((m) => !m.pagoEm).length;
    const custosAbertos = App.dados.custosCarro.filter((x) => !x.pagoEm).length;
    const pct = c.total ? Math.round((c.pago / c.total) * 100) : 0;

    $("#m-falta-valor").textContent = reais(c.emAberto);
    $("#m-falta-qtd").textContent =
      c.emAberto === 0
        ? "Tudo pago"
        : `${plural(multasAbertas, "multa", "multas")} e ${plural(custosAbertos, "outra despesa", "outras despesas")} em aberto`;
    $("#m-pago-valor").textContent = reais(c.pago);
    $("#m-pago-qtd").textContent = `${c.qtdPagos} de ${plural(c.qtdTotal, "item", "itens")}`;
    $("#m-total-valor").textContent = reais(c.total);
    $("#m-total-qtd").textContent = `${plural(multas().length, "multa", "multas")} + ${plural(
      App.dados.custosCarro.length,
      "despesa",
      "despesas"
    )}`;
    $("#m-progresso-texto").textContent = `${pct}%`;
    $("#m-progresso-barra").style.width = `${pct}%`;
    $("#m-progresso").setAttribute("aria-valuenow", String(pct));
    $("#m-placa").textContent = App.dados.config.placa ? `Placa ${App.dados.config.placa}` : "";

    const abertos = c.qtdTotal - c.qtdPagos;
    $('#view-multas [data-filtro="pendentes"] .contagem').textContent = abertos;
    $('#view-multas [data-filtro="pagos"] .contagem').textContent = c.qtdPagos;
    $('#view-multas [data-filtro="todos"] .contagem').textContent = c.qtdTotal;
  }

  function renderVencimentos() {
    const grupos = new Map();
    const abertos = [
      ...multas().map((b) => ({ validade: b.validade, valor: b.valor, nome: b.serie, pagoEm: b.pagoEm })),
      ...App.dados.custosCarro.map((c) => ({ validade: c.validade, valor: c.valor, nome: c.descricao, pagoEm: c.pagoEm })),
    ].filter((x) => x.validade && !x.pagoEm);
    abertos.forEach((x) => {
      if (!grupos.has(x.validade)) grupos.set(x.validade, { validade: x.validade, valor: 0, series: [] });
      const grupo = grupos.get(x.validade);
      grupo.valor += x.valor;
      grupo.series.push(x.nome);
    });

    const lista = [...grupos.values()].sort((a, b) => data(a.validade) - data(b.validade));
    if (!lista.length) {
      $("#m-vencimentos").innerHTML = '<li class="venc-vazio">Nenhuma guia em aberto.</li>';
      return;
    }
    $("#m-vencimentos").innerHTML = lista
      .map((g) => {
        const dias = diasAte(g.validade);
        const quem = g.series.length === 1 ? g.series[0] : plural(g.series.length, "guia", "guias");
        return `<li class="venc nivel-${nivel(dias)}">
          <div class="venc-data"><strong>${esc(g.validade)}</strong><span>${esc(prazoTexto(dias))}</span></div>
          <div class="venc-info"><strong>${reais(g.valor)}</strong><span>${esc(quem)}</span></div>
        </li>`;
      })
      .join("");
  }

  function htmlPrazoPago(pagoEm, atributo, rotulo) {
    return `<span class="prazo-rotulo">Pago em</span>
      <input type="date" class="data-pago" value="${esc(pagoEm)}" ${atributo} aria-label="Data do pagamento de ${esc(rotulo)}">`;
  }

  function cartao(b) {
    const dias = diasAte(b.validade);
    const aberto = estado.abertos.has(b.serie);
    const s = esc(b.serie);

    const meta = [`Infração ${esc(b.dataInfracao)}, ${esc(b.horaInfracao)}`];
    if (b.origem) meta.push(`origem ${linkSerie(b.origem)}`);
    const filhas = geradas(b.serie);
    if (filhas.length) meta.push(`gerou ${filhas.map(linkSerie).join(", ")}`);

    const velocidade = b.velocidade
      ? ` <span class="sub">· ${b.velocidade.considerada} km/h (limite ${b.velocidade.limite})</span>`
      : "";

    const prazo = b.pagoEm
      ? htmlPrazoPago(b.pagoEm, `data-serie="${s}"`, b.serie)
      : `<span class="prazo-rotulo">Válida até</span>
         <strong>${esc(b.validade)}</strong>
         <span class="dias nivel-${nivel(dias)}">${esc(prazoTexto(dias))}</span>`;

    const velocidadeDetalhe = b.velocidade
      ? `<div><dt>Velocidade</dt><dd>medida ${b.velocidade.medida} · considerada ${b.velocidade.considerada} · limite ${b.velocidade.limite} km/h</dd></div>`
      : "";
    const desconto = b.situacao === "a-vencer" && b.valorOriginal > b.valor ? b.valorOriginal - b.valor : 0;
    const valorCodigo = valorNoCodigo(b.linhaDigitavel);
    const avisoCodigo =
      desconto && valorCodigo === b.valorOriginal
        ? `<div class="largo"><dt>Na hora de pagar</dt><dd>O código de barras traz o valor cheio (${reais(b.valorOriginal)}). O desconto de ${reais(
            desconto
          )} vale até ${esc(b.validade)} e aparece no pagamento.</dd></div>`
        : "";

    const verBoleto = b.temPdf
      ? `<a class="botao botao-primario" href="/boletos/${s}.pdf" target="_blank" rel="noopener">${App.ICONES.abrir}Ver boleto</a>`
      : "";

    return `<article class="cartao boleto${b.pagoEm ? " pago" : ""}" id="b-${s}">
      <label class="check">
        <input type="checkbox" data-pagar="${s}"${b.pagoEm ? " checked" : ""}>
        <span class="sr-only">Marcar ${s} como paga pela Greici e pelo André</span>
      </label>
      <div class="info">
        <div class="info-topo">
          <span class="serie">${s}</span>
          <span class="tag">${esc(tipo(b))}</span>
          ${b.pagoEm ? '<span class="tag tag-pago">Paga</span>' : ""}
        </div>
        <p class="descricao">${esc(descricao(b))}${velocidade}</p>
        <p class="meta">${meta.join(" · ")}</p>
      </div>
      <div class="valor">
        <strong>${reais(b.valor)}</strong>
        <span>${esc(composicao(b))}</span>
      </div>
      <div class="prazo">${prazo}</div>
      <div class="acoes">
        ${verBoleto}
        <button type="button" class="botao" data-copiar="${s}" title="Copia a linha digitável para pagar no app do banco">${App.ICONES.copiar}<span class="rotulo-copiar">Copiar<span class="so-largo"> código</span></span></button>
        <button type="button" class="botao botao-icone" data-detalhes="${s}" aria-expanded="${aberto}" aria-controls="d-${s}" aria-label="Detalhes de ${s}">${App.ICONES.seta}</button>
      </div>
      <dl class="detalhes" id="d-${s}"${aberto ? "" : " hidden"}>
        <div class="largo"><dt>Linha digitável</dt><dd class="codigo">${esc(b.linhaDigitavel)}</dd></div>
        <div><dt>Nº da guia</dt><dd class="codigo">${esc(b.guia)}</dd></div>
        <div><dt>Expedida em</dt><dd>${esc(b.expedida)}</dd></div>
        <div><dt>Autuador</dt><dd>${esc(b.autuador)}</dd></div>
        <div><dt>Local</dt><dd>${esc(titulo(b.local))} · ${esc(titulo(b.municipio))}</dd></div>
        <div><dt>Enquadramento</dt><dd>${esc(b.codigoInfracao)} · ${esc(b.amparo)}</dd></div>
        ${b.pontos != null ? `<div><dt>Pontos</dt><dd>${b.pontos}</dd></div>` : ""}
        ${desconto ? `<div><dt>Desconto</dt><dd>${reais(desconto)} até ${esc(b.validade)}</dd></div>` : ""}
        ${velocidadeDetalhe}
        ${avisoCodigo}
        <div><dt>Arquivo original</dt><dd class="codigo">${esc(b.arquivo || "—")}</dd></div>
      </dl>
    </article>`;
  }

  function cartaoCusto(c) {
    const temBoleto = Boolean(c.linhaDigitavel);
    let prazo = "";
    if (c.pagoEm) prazo = htmlPrazoPago(c.pagoEm, `data-custo="${c.id}"`, c.descricao);
    else if (c.validade) {
      const dias = diasAte(c.validade);
      prazo = `<span class="prazo-rotulo">Válida até</span>
        <strong>${esc(c.validade)}</strong>
        <span class="dias nivel-${nivel(dias)}">${esc(prazoTexto(dias))}</span>`;
    }
    const diarias = /por dia/.test(c.detalhe || "");
    const meta = [
      c.guia ? `Guia ${esc(c.guia)}` : "",
      diarias && c.validade ? `depois de ${esc(c.validade)} entram novas diárias` : "",
    ].filter(Boolean);
    const acoes = temBoleto
      ? `${c.temPdf ? `<a class="botao botao-primario" href="/boletos/custo-${c.id}.pdf" target="_blank" rel="noopener">${App.ICONES.abrir}Ver boleto</a>` : ""}
         <button type="button" class="botao" data-copiar-custo="${c.id}" title="Copia a linha digitável para pagar no app do banco">${App.ICONES.copiar}<span class="rotulo-copiar">Copiar<span class="so-largo"> código</span></span></button>`
      : "";

    return `<article class="cartao boleto${c.pagoEm ? " pago" : ""}" id="c-${c.id}">
      <label class="check">
        <input type="checkbox" data-pagar-custo="${c.id}"${c.pagoEm ? " checked" : ""}>
        <span class="sr-only">Marcar ${esc(c.descricao)} como pago pela Greici e pelo André</span>
      </label>
      <div class="info">
        <div class="info-topo">
          <span class="custo-nome">${esc(c.descricao)}</span>
          ${temBoleto ? '<span class="tag">Guia Detran</span>' : ""}
          ${c.pagoEm ? '<span class="tag tag-pago">Pago</span>' : ""}
        </div>
        <p class="descricao">${esc(c.detalhe)}</p>
        ${meta.length ? `<p class="meta">${meta.join(" · ")}</p>` : ""}
      </div>
      <div class="valor"><strong>${reais(c.valor)}</strong></div>
      <div class="prazo">${prazo}</div>
      <div class="acoes">${acoes}</div>
    </article>`;
  }

  function htmlCustos() {
    const custos = App.dados.custosCarro.filter(custoVisivel);
    if (!custos.length) return "";
    const soma = custos.reduce((t, c) => t + c.valor, 0);
    const linhas = custos.map(cartaoCusto).join("");
    return `<section class="secao" aria-labelledby="t-custos-carro">
      <header class="secao-topo">
        <div>
          <h2 id="t-custos-carro">Outras despesas do carro</h2>
          <p>Necessárias para regularizar e retirar o carro. Também pagas pela Greici e pelo André.</p>
        </div>
        <div class="secao-total"><strong>${reais(soma)}</strong><span>${plural(custos.length, "despesa", "despesas")}</span></div>
      </header>
      <div class="boletos">${linhas}</div>
    </section>`;
  }

  function mensagemVazia() {
    if (estado.busca) return "Nada encontrado para essa busca.";
    if (estado.filtro === "pagos") return "Nada marcado como pago ainda.";
    if (estado.filtro === "pendentes") return "Tudo pago. Nada em aberto no carro.";
    return "Nenhuma multa.";
  }

  function renderLista() {
    const secoes = SECOES.map((secao) => {
      const itens = multas()
        .filter((b) => b.situacao === secao.id && multaVisivel(b))
        .sort(ordenar);
      if (!itens.length) return "";
      const soma = itens.reduce((total, b) => total + b.valor, 0);
      return `<section class="secao" aria-labelledby="t-${secao.id}">
        <header class="secao-topo">
          <div>
            <h2 id="t-${secao.id}">${secao.titulo}</h2>
            <p>${secao.nota}</p>
          </div>
          <div class="secao-total">
            <strong>${reais(soma)}</strong>
            <span>${plural(itens.length, "guia", "guias")}</span>
          </div>
        </header>
        <div class="boletos">${itens.map(cartao).join("")}</div>
      </section>`;
    }).join("");

    const conteudo = htmlCustos() + secoes;
    $("#m-lista").innerHTML = conteudo || `<div class="cartao vazio">${mensagemVazia()}</div>`;
  }

  function renderFiltros() {
    $$("#view-multas [data-filtro]").forEach((botao) => {
      botao.setAttribute("aria-pressed", String(botao.dataset.filtro === estado.filtro));
    });
  }

  function render() {
    renderResumo();
    renderVencimentos();
    renderFiltros();
    renderLista();
  }

  // ---------- Ações ----------

  function marcarMulta(serie, pagoEm, anterior) {
    App.salvar("PUT", `/api/multas/${serie}/pago`, { pagoEm }, {
      mensagem: pagoEm && !anterior ? `${serie} paga pela Greici e pelo André` : !pagoEm ? `${serie} voltou para “a pagar”` : null,
      desfazer: pagoEm === anterior ? null : () => marcarMulta(serie, anterior || null, pagoEm),
    });
  }

  function marcarCusto(id, pagoEm, anterior) {
    const custo = App.dados.custosCarro.find((c) => c.id === id);
    App.salvar("PUT", `/api/custos-carro/${id}/pago`, { pagoEm }, {
      mensagem: pagoEm && !anterior ? `${custo.descricao} pago pela Greici e pelo André` : !pagoEm ? `${custo.descricao} voltou para “a pagar”` : null,
      desfazer: pagoEm === anterior ? null : () => marcarCusto(id, anterior || null, pagoEm),
    });
  }

  async function copiarCodigo(botao) {
    const item = botao.dataset.copiar
      ? porSerie(botao.dataset.copiar)
      : App.dados.custosCarro.find((c) => c.id === Number(botao.dataset.copiarCusto));
    const ok = await App.copiarTexto(item.linhaDigitavel.replace(/\D/g, ""));
    if (!ok) {
      App.toast("Não consegui copiar. Abra os detalhes e copie a linha digitável.");
      return;
    }
    const rotulo = botao.querySelector(".rotulo-copiar");
    const original = rotulo.innerHTML;
    botao.classList.add("copiado");
    rotulo.textContent = "Copiado!";
    setTimeout(() => {
      botao.classList.remove("copiado");
      rotulo.innerHTML = original;
    }, 1800);
  }

  function alternarDetalhes(botao) {
    const serie = botao.dataset.detalhes;
    const painel = document.getElementById(`d-${serie}`);
    const abrir = painel.hidden;
    painel.hidden = !abrir;
    botao.setAttribute("aria-expanded", String(abrir));
    if (abrir) estado.abertos.add(serie);
    else estado.abertos.delete(serie);
  }

  function irPara(serie) {
    let alvo = document.getElementById(`b-${serie}`);
    if (!alvo) {
      estado.filtro = "todos";
      estado.busca = "";
      $("#m-busca").value = "";
      App.gravar(CHAVE_FILTRO, estado.filtro);
      render();
      alvo = document.getElementById(`b-${serie}`);
    }
    if (alvo) App.rolarAte(alvo);
  }

  function iniciar() {
    $("#m-lista").addEventListener("change", (evento) => {
      const alvo = evento.target;
      if (alvo.dataset.pagar) {
        const b = porSerie(alvo.dataset.pagar);
        marcarMulta(b.serie, alvo.checked ? b.pagoEm || App.isoHoje() : null, b.pagoEm);
      } else if (alvo.dataset.pagarCusto) {
        const id = Number(alvo.dataset.pagarCusto);
        const custo = App.dados.custosCarro.find((c) => c.id === id);
        marcarCusto(id, alvo.checked ? custo.pagoEm || App.isoHoje() : null, custo.pagoEm);
      } else if (alvo.classList.contains("data-pago")) {
        if (alvo.dataset.serie) {
          const b = porSerie(alvo.dataset.serie);
          if (alvo.value) App.salvar("PUT", `/api/multas/${b.serie}/pago`, { pagoEm: alvo.value });
          else alvo.value = b.pagoEm;
        } else if (alvo.dataset.custo) {
          const id = Number(alvo.dataset.custo);
          const custo = App.dados.custosCarro.find((c) => c.id === id);
          if (alvo.value) App.salvar("PUT", `/api/custos-carro/${id}/pago`, { pagoEm: alvo.value });
          else alvo.value = custo.pagoEm;
        }
      }
    });

    $("#m-lista").addEventListener("click", (evento) => {
      const copiar = evento.target.closest("[data-copiar], [data-copiar-custo]");
      const detalhes = evento.target.closest("[data-detalhes]");
      const ir = evento.target.closest("[data-ir]");
      if (copiar) copiarCodigo(copiar);
      else if (detalhes) alternarDetalhes(detalhes);
      else if (ir) {
        evento.preventDefault();
        irPara(ir.dataset.ir);
      }
    });

    $$("#view-multas [data-filtro]").forEach((botao) => {
      botao.addEventListener("click", () => {
        estado.filtro = botao.dataset.filtro;
        App.gravar(CHAVE_FILTRO, estado.filtro);
        renderFiltros();
        renderLista();
      });
    });

    $("#m-busca").addEventListener("input", (evento) => {
      estado.busca = evento.target.value.trim();
      renderLista();
    });
  }

  App.multas = { iniciar, render };
})();
