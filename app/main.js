// Navegação entre as abas e início do app.
(function () {
  "use strict";

  const App = window.App;
  const { $, $$ } = App;

  const ABAS = {
    mes: { titulo: "Mês", render: () => App.financas.renderMes() },
    salario: { titulo: "Salário", render: () => App.salario.render() },
    divida: { titulo: "Greici e André", render: () => App.financas.renderDivida() },
    projecao: { titulo: "Projeção", render: () => App.projecao.render() },
    multas: { titulo: "Multas", render: () => App.multas.render() },
    backoffice: { titulo: "Backoffice", render: () => App.backoffice.render() },
  };

  let abaAtual = null;

  function rotear() {
    if (!App.dados) return;
    const [aba, argumento] = location.hash.replace(/^#/, "").split("/");
    const destino = ABAS[aba] ? aba : "mes";
    if (destino === "mes" && argumento) App.financas.definirMes(argumento);
    if (destino === "backoffice" && argumento) App.backoffice.definirEntidade(argumento);
    if (destino === "salario" && argumento) App.salario.destacar(argumento);

    Object.keys(ABAS).forEach((id) => {
      $(`#view-${id}`).hidden = id !== destino;
    });
    $$("[data-aba]").forEach((link) => {
      if (link.dataset.aba === destino) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    });

    const mudouDeAba = abaAtual !== destino;
    abaAtual = destino;
    document.title = `${ABAS[destino].titulo} · Minhas finanças`;
    ABAS[destino].render();
    if (mudouDeAba) window.scrollTo({ top: 0 });
  }

  App.renderAtual = () => {
    if (abaAtual && App.dados) ABAS[abaAtual].render();
  };

  async function sair() {
    try {
      await App.api("POST", "/api/logout");
    } finally {
      location.href = "/login";
    }
  }

  async function iniciar() {
    $("#sair").addEventListener("click", sair);

    let timerRedimensionar;
    window.addEventListener("resize", () => {
      clearTimeout(timerRedimensionar);
      timerRedimensionar = setTimeout(() => {
        if (abaAtual === "projecao") App.projecao.render();
      }, 150);
    });

    try {
      await App.carregar();
    } catch (erro) {
      $("#carregando").innerHTML = `${App.esc(erro.message)} <button type="button" class="botao" id="tentar-de-novo">Tentar de novo</button>`;
      $("#tentar-de-novo").addEventListener("click", () => location.reload());
      return;
    }
    $("#carregando").hidden = true;
    App.multas.iniciar();
    window.addEventListener("hashchange", rotear);
    rotear();
  }

  iniciar();
})();
