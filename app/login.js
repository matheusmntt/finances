// Tela de login.
(function () {
  "use strict";

  const form = document.getElementById("login");
  const erro = document.getElementById("login-erro");
  const botao = form.querySelector("button");

  form.addEventListener("submit", async (evento) => {
    evento.preventDefault();
    erro.hidden = true;
    botao.disabled = true;
    try {
      const resposta = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ senha: form.senha.value }),
      });
      if (resposta.ok) {
        location.href = "/";
        return;
      }
      const corpo = await resposta.json().catch(() => ({}));
      erro.textContent = corpo.erro || "Não foi possível entrar.";
    } catch (e) {
      erro.textContent = "Sem conexão com o servidor.";
    }
    erro.hidden = false;
    botao.disabled = false;
    form.senha.select();
  });
})();
