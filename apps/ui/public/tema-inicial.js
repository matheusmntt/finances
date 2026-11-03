// Aplica o tema salvo (botão do topo) antes de a página aparecer. O resto fica em src/stores/tema.ts.
(function () {
  try {
    var tema = localStorage.getItem("tema.v1");
    if (tema === "escuro") document.documentElement.dataset.theme = "dark";
    if (tema === "claro") document.documentElement.dataset.theme = "light";
  } catch (e) {
    /* sem armazenamento: segue o tema do sistema */
  }
})();
