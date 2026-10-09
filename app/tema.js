// Tema claro/escuro: aplica a escolha salva antes de a página aparecer e liga o botão do topo.
// Sem escolha salva, segue o tema do sistema.
(function () {
  "use strict";

  const CHAVE = "tema.v1";
  const raiz = document.documentElement;
  const sistemaEscuro = window.matchMedia("(prefers-color-scheme: dark)");

  const ICONES = {
    sol: '<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="3"/><path d="M8 1.5V3m0 10v1.5M1.5 8H3m10 0h1.5M3.4 3.4l1.06 1.06m7.08 7.08 1.06 1.06M3.4 12.6l1.06-1.06m7.08-7.08 1.06-1.06"/></svg>',
    lua: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M13.5 9.6A5.6 5.6 0 0 1 6.4 2.5a5.6 5.6 0 1 0 7.1 7.1Z"/></svg>',
  };

  function salvo() {
    try {
      const tema = localStorage.getItem(CHAVE);
      return tema === "claro" || tema === "escuro" ? tema : null;
    } catch (e) {
      return null;
    }
  }

  function aplicar(tema) {
    if (tema) raiz.dataset.theme = tema === "escuro" ? "dark" : "light";
    else delete raiz.dataset.theme;
  }

  const atual = () => (raiz.dataset.theme ? (raiz.dataset.theme === "dark" ? "escuro" : "claro") : sistemaEscuro.matches ? "escuro" : "claro");

  // O botão mostra o tema para o qual ele muda.
  function atualizarBotao(botao) {
    const proximo = atual() === "escuro" ? "claro" : "escuro";
    const rotulo = `Usar o tema ${proximo}`;
    botao.innerHTML = proximo === "escuro" ? ICONES.lua : ICONES.sol;
    botao.setAttribute("aria-label", rotulo);
    botao.title = rotulo;
  }

  aplicar(salvo());

  document.addEventListener("DOMContentLoaded", () => {
    const botao = document.getElementById("tema");
    if (!botao) return;
    atualizarBotao(botao);
    botao.addEventListener("click", () => {
      const novo = atual() === "escuro" ? "claro" : "escuro";
      aplicar(novo);
      try {
        localStorage.setItem(CHAVE, novo);
      } catch (e) {
        /* sem armazenamento: vale só até recarregar */
      }
      atualizarBotao(botao);
    });
    sistemaEscuro.addEventListener("change", () => atualizarBotao(botao));
  });
})();
