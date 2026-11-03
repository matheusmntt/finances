// Aba "Salário": folhas de pagamento enviadas em PDF. O líquido de cada uma entra no mês do pagamento.
(function () {
  "use strict";

  const App = window.App;
  const { $, esc, reais, plural } = App;

  const estado = {
    abertos: new Set(), // folhas com os detalhes abertos
    destacar: null, // folha para mostrar ao abrir a aba (#salario/ID)
  };

  const folhas = () => [...App.dados.holerites].sort((a, b) => b.competencia.localeCompare(a.competencia) || b.id - a.id);
  const dataBr = (iso) => (iso ? App.isoParaBr(iso) : "—");

  function htmlEnviar(primario) {
    return `<label class="botao botao-arquivo${primario ? " botao-primario" : ""}">
      ${App.ICONES.enviar}Enviar folha (PDF)
      <input type="file" accept="application/pdf,.pdf" class="sr-only" data-enviar-folha>
    </label>`;
  }

  // ---------- Renderização ----------

  function htmlResumo(lista) {
    const ultima = lista[0];
    const fgts = lista.reduce((s, h) => s + h.fgts, 0);
    const pctDescontos = ultima.totalVencimentos ? Math.round((ultima.totalDescontos / ultima.totalVencimentos) * 100) : 0;
    return `<section class="cartao resumo">
      <p class="rotulo">Último salário líquido</p>
      <p class="valor-grande">${reais(ultima.liquido)}</p>
      <p class="sub">${esc(App.nomeFolha(ultima))}${ultima.pagoEm ? `, paga em ${App.isoParaBr(ultima.pagoEm)}` : ""}. Entrou em
        <a href="#mes/${ultima.mes}">${App.nomeMes(ultima.mes)}</a>.</p>
      <dl class="mini-stats">
        <div><dt>Salário bruto</dt><dd>${reais(ultima.salarioMensal)}</dd><dd class="sub">${esc(ultima.cargo)}</dd></div>
        <div><dt>Descontos</dt><dd>${reais(ultima.totalDescontos)}</dd><dd class="sub">${pctDescontos}% dos vencimentos</dd></div>
        <div><dt>FGTS depositado</dt><dd>${reais(fgts)}</dd><dd class="sub">em ${plural(lista.length, "folha", "folhas")}</dd></div>
      </dl>
    </section>`;
  }

  function htmlItens(h) {
    const linhas = h.itens
      .map(
        (i) => `<tr>
          <td>${esc(i.codigo)}</td>
          <td>${esc(i.descricao)}${i.referencia ? `<span class="ref-curta"> · ${esc(i.referencia)}</span>` : ""}</td>
          <td class="num col-ref">${esc(i.referencia || "")}</td>
          <td class="num">${i.vencimento ? reais(i.vencimento) : ""}</td>
          <td class="num">${i.desconto ? reais(i.desconto) : ""}</td>
        </tr>`
      )
      .join("");
    return `<div class="tabela-wrap largo">
      <table class="tabela tabela-folha">
        <thead><tr>
          <th scope="col">Cód</th>
          <th scope="col">Descrição</th>
          <th scope="col" class="num col-ref">Hrs/Qtde</th>
          <th scope="col" class="num">Vencimentos</th>
          <th scope="col" class="num">Descontos</th>
        </tr></thead>
        <tbody>${linhas}</tbody>
        <tfoot>
          <tr>
            <th scope="row" colspan="2">Totais</th><td class="col-ref"></td>
            <td class="num">${reais(h.totalVencimentos)}</td><td class="num">${reais(h.totalDescontos)}</td>
          </tr>
          <tr><th scope="row" colspan="2">Líquido</th><td class="col-ref"></td><td class="num" colspan="2">${reais(h.liquido)}</td></tr>
        </tfoot>
      </table>
    </div>`;
  }

  function cartao(h) {
    const aberto = estado.abertos.has(h.id);
    const nome = App.nomeFolha(h);
    const deposito = [h.banco, h.agencia && `agência ${h.agencia}`, h.conta && `conta ${h.conta}`].filter(Boolean).join(" · ");
    return `<article class="cartao boleto folha" id="f-${h.id}">
      <div class="info">
        <div class="info-topo">
          <span class="custo-nome">${esc(nome)}</span>
          ${h.empresa || h.razaoSocial ? `<span class="tag">${esc(h.empresa || h.razaoSocial)}</span>` : ""}
        </div>
        <p class="descricao">${esc(h.cargo)}${h.salarioMensal ? ` · salário de ${reais(h.salarioMensal)}` : ""}</p>
        <p class="meta">Entra nas contas de <a href="#mes/${h.mes}">${App.nomeMes(h.mes)}</a></p>
      </div>
      <div class="valor">
        <strong>${reais(h.liquido)}</strong>
        <span>${reais(h.totalVencimentos)} − ${reais(h.totalDescontos)}</span>
      </div>
      <div class="prazo">
        <span class="prazo-rotulo">Pago em</span>
        <strong>${dataBr(h.pagoEm)}</strong>
      </div>
      <div class="acoes">
        <a class="botao botao-primario" href="/holerites/${h.id}.pdf" target="_blank" rel="noopener">${App.ICONES.abrir}Ver PDF</a>
        <button type="button" class="botao botao-icone" data-detalhes-folha="${h.id}" aria-expanded="${aberto}" aria-controls="df-${h.id}" aria-label="Detalhes da ${esc(nome)}">${App.ICONES.seta}</button>
      </div>
      <div class="detalhes" id="df-${h.id}"${aberto ? "" : " hidden"}>
        ${htmlItens(h)}
        <dl class="largo detalhes-dados">
          <div><dt>Base INSS</dt><dd>${reais(h.baseInss)}</dd></div>
          <div><dt>Base IRRF</dt><dd>${reais(h.baseIrrf)}</dd></div>
          <div><dt>FGTS do mês</dt><dd>${reais(h.fgts)}</dd></div>
          <div><dt>Empresa</dt><dd>${esc(h.razaoSocial || h.empresa || "—")}${h.cnpj ? ` · CNPJ ${esc(h.cnpj)}` : ""}</dd></div>
          <div><dt>Funcionário</dt><dd>${esc(h.funcionario || "—")}${h.matricula ? ` · ${esc(h.matricula)}` : ""}</dd></div>
          <div><dt>Depósito</dt><dd>${esc(deposito || "—")}</dd></div>
          <div><dt>Arquivo original</dt><dd class="codigo">${esc(h.arquivo || "—")}</dd></div>
        </dl>
        <div class="largo acoes-folha">
          <button type="button" class="botao botao-fantasma" data-remover-folha="${h.id}">${App.ICONES.remover}Remover folha</button>
        </div>
      </div>
    </article>`;
  }

  function render() {
    const raiz = $("#view-salario");
    if (!raiz.dataset.pronto) montar(raiz);
    const lista = folhas();

    if (!lista.length) {
      raiz.innerHTML = `<div class="cartao vazio vazio-folhas">
        <p>Nenhuma folha de pagamento enviada ainda.</p>
        <p class="sub">Envie o PDF do recibo: os vencimentos, descontos e o líquido aparecem aqui, e o líquido entra nas entradas do mês em que foi pago.</p>
        ${htmlEnviar(true)}
      </div>`;
      return;
    }

    const total = lista.reduce((s, h) => s + h.liquido, 0);
    raiz.innerHTML = `
      <div class="painel">${htmlResumo(lista)}</div>
      <section class="secao">
        <header class="secao-topo">
          <div>
            <h2>Folhas de pagamento</h2>
            <p>O líquido de cada folha entra nas entradas do mês em que foi pago. Para mudar o mês, use o Backoffice.</p>
          </div>
          <div class="secao-total"><strong>${reais(total)}</strong><span>líquido em ${plural(lista.length, "folha", "folhas")}</span></div>
        </header>
        <div class="barra-plano">
          <p class="sub">O PDF fica guardado no app. Envie uma folha por mês, a mensal e também a de 13º ou férias quando tiver.</p>
          <div class="barra-plano-acoes">${htmlEnviar(true)}</div>
        </div>
        <div class="boletos">${lista.map(cartao).join("")}</div>
      </section>`;

    if (estado.destacar != null) {
      const alvo = document.getElementById(`f-${estado.destacar}`);
      estado.destacar = null;
      if (alvo) App.rolarAte(alvo);
    }
  }

  // ---------- Ações ----------

  async function enviar(arquivo, { irParaMes = false } = {}) {
    if (!arquivo) return;
    const antes = new Set(App.dados.holerites.map((h) => h.id));
    const ok = await App.salvar("POST", "/api/holerites", arquivo, { renderizar: false });
    if (!ok) return;
    const nova = App.dados.holerites.find((h) => !antes.has(h.id));
    App.toast(`${App.nomeFolha(nova)}: ${reais(nova.liquido)} em ${App.nomeMes(nova.mes)}`);
    if (irParaMes && location.hash !== `#mes/${nova.mes}`) {
      location.hash = `#mes/${nova.mes}`;
      return;
    }
    if (!irParaMes) destacar(nova.id);
    App.renderAtual();
  }

  function remover(id) {
    const h = App.dados.holerites.find((x) => x.id === id);
    const nome = App.nomeFolha(h);
    if (!window.confirm(`Remover a ${nome}? O PDF é apagado e ${reais(h.liquido)} saem das entradas de ${App.nomeMes(h.mes)}.`)) return;
    estado.abertos.delete(id);
    App.salvar("DELETE", `/api/holerites/${id}`, undefined, { mensagem: `${nome} removida` });
  }

  function alternarDetalhes(botao) {
    const id = Number(botao.dataset.detalhesFolha);
    const painel = document.getElementById(`df-${id}`);
    const abrir = painel.hidden;
    painel.hidden = !abrir;
    botao.setAttribute("aria-expanded", String(abrir));
    if (abrir) estado.abertos.add(id);
    else estado.abertos.delete(id);
  }

  function montar(raiz) {
    raiz.addEventListener("change", (evento) => {
      if (evento.target.matches("[data-enviar-folha]")) enviar(evento.target.files[0]);
    });
    raiz.addEventListener("click", (evento) => {
      const detalhes = evento.target.closest("[data-detalhes-folha]");
      const remocao = evento.target.closest("[data-remover-folha]");
      if (detalhes) alternarDetalhes(detalhes);
      else if (remocao) remover(Number(remocao.dataset.removerFolha));
    });
    raiz.dataset.pronto = "1";
  }

  // Abre os detalhes da folha e rola até ela no próximo render.
  function destacar(id) {
    estado.destacar = Number(id);
    estado.abertos.add(Number(id));
  }

  App.salario = { render, enviar, destacar };
})();
