// Utilidades compartilhadas pelas abas do app.
(function () {
  "use strict";

  const App = (window.App = window.App || {});

  // ---------- Formatação ----------

  const moeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
  const numero = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });

  App.reais = (centavos) => moeda.format((centavos || 0) / 100);

  const moedaInteira = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
  App.reaisInteiros = (centavos) => moedaInteira.format(Math.round((centavos || 0) / 100));

  // Valores redondos para eixos: "R$ 40 mil", "R$ 500".
  App.reaisCurto = (centavos) => {
    const reais = centavos / 100;
    if (Math.abs(reais) >= 1000) return `R$ ${numero.format(reais / 1000)} mil`;
    return `R$ ${numero.format(reais)}`;
  };

  App.plural = (n, singular, varios) => `${n} ${n === 1 ? singular : varios}`;

  App.esc = (texto) =>
    String(texto).replace(
      /[&<>"']/g,
      (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]
    );

  App.semAcento = (texto) => texto.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

  const PALAVRAS_MINUSCULAS = new Set(["de", "da", "do", "das", "dos", "e", "em"]);
  const SIGLAS = new Set(["br", "rs", "prf", "dnit", "cnh"]);

  App.titulo = (texto) =>
    texto
      .toLowerCase()
      .split(" ")
      .map((palavra, i) => {
        if (/\d/.test(palavra) || SIGLAS.has(palavra.replace(/\W/g, ""))) return palavra.toUpperCase();
        if (i > 0 && PALAVRAS_MINUSCULAS.has(palavra)) return palavra;
        return palavra.replace(/\p{L}/u, (letra) => letra.toUpperCase());
      })
      .join(" ")
      .replace(/-(\p{L}{2})$/u, (_, uf) => "-" + uf.toUpperCase());

  App.$ = (seletor, raiz) => (raiz || document).querySelector(seletor);
  App.$$ = (seletor, raiz) => [...(raiz || document).querySelectorAll(seletor)];

  // ---------- Datas ----------

  const DIA = 86400000;
  App.hoje = new Date();
  App.hoje.setHours(0, 0, 0, 0);

  App.isoHoje = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };

  App.mesAtual = App.isoHoje().slice(0, 7);

  // "23/10/2026" -> Date
  App.data = (ddmmaaaa) => {
    const [d, m, a] = ddmmaaaa.split("/").map(Number);
    return new Date(a, m - 1, d);
  };

  App.diasAte = (ddmmaaaa) => Math.round((App.data(ddmmaaaa) - App.hoje) / DIA);

  App.isoParaBr = (iso) => iso.split("-").reverse().join("/");

  // Meses de "2026-10" até "2027-05" -> 7
  App.diferencaMeses = (de, ate) => {
    const [a1, m1] = de.split("-").map(Number);
    const [a2, m2] = ate.split("-").map(Number);
    return (a2 - a1) * 12 + (m2 - m1);
  };

  const NOMES_MESES = [
    "janeiro", "fevereiro", "março", "abril", "maio", "junho",
    "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
  ];

  // "2026-10" -> "outubro de 2026"
  App.nomeMes = (mes) => {
    const [a, m] = mes.split("-").map(Number);
    return `${NOMES_MESES[m - 1]} de ${a}`;
  };

  // "2026-10" -> "out/26"
  App.mesCurto = (mes) => {
    const [a, m] = mes.split("-").map(Number);
    return `${NOMES_MESES[m - 1].slice(0, 3)}/${String(a).slice(2)}`;
  };

  // ---------- Armazenamento ----------

  App.armazenamentoOk = true;

  App.ler = (chave, padrao) => {
    try {
      const bruto = localStorage.getItem(chave);
      return bruto ? JSON.parse(bruto) : padrao;
    } catch (e) {
      App.armazenamentoOk = false;
      return padrao;
    }
  };

  App.gravar = (chave, valor) => {
    try {
      localStorage.setItem(chave, JSON.stringify(valor));
    } catch (e) {
      App.armazenamentoOk = false;
      const aviso = App.$("#aviso-armazenamento");
      if (aviso) aviso.hidden = false;
    }
  };

  // ---------- Toast ----------

  let timerToast;

  App.toast = (mensagem, desfazer) => {
    const el = App.$("#toast");
    el.innerHTML = `<span>${App.esc(mensagem)}</span>${desfazer ? '<button type="button">Desfazer</button>' : ""}`;
    if (desfazer) {
      el.querySelector("button").addEventListener("click", () => {
        desfazer();
        el.classList.remove("visivel");
      });
    }
    el.classList.add("visivel");
    clearTimeout(timerToast);
    timerToast = setTimeout(() => el.classList.remove("visivel"), desfazer ? 6000 : 2500);
  };

  // ---------- Área de transferência ----------

  App.copiarTexto = async (texto) => {
    try {
      await navigator.clipboard.writeText(texto);
      return true;
    } catch (e) {
      const area = document.createElement("textarea");
      area.value = texto;
      area.setAttribute("readonly", "");
      area.style.position = "fixed";
      area.style.opacity = "0";
      document.body.appendChild(area);
      area.select();
      let ok = false;
      try {
        ok = document.execCommand("copy");
      } catch (erro) {
        ok = false;
      }
      area.remove();
      return ok;
    }
  };

  App.rolarAte = (el) => {
    const suave = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({ behavior: suave ? "smooth" : "auto", block: "center" });
    el.classList.remove("destaque");
    void el.offsetWidth;
    el.classList.add("destaque");
  };

  // ---------- Campos de valor ----------

  const formatoCampo = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // 150000 -> "1.500,00"
  App.formatarCampo = (centavos) => (centavos == null ? "" : formatoCampo.format(centavos / 100));

  // "1.500,00", "1500", "1500,5" ou "1500.50" -> centavos. Devolve null se não for um valor.
  App.lerReais = (texto) => {
    let limpo = String(texto || "").replace(/[R$\s]/g, "");
    if (!limpo) return null;
    if (limpo.includes(",")) {
      limpo = limpo.replace(/\./g, "").replace(",", ".");
    } else if (/\.\d{1,2}$/.test(limpo) && (limpo.match(/\./g) || []).length === 1) {
      // "1500.50": ponto como decimal
    } else {
      limpo = limpo.replace(/\./g, "");
    }
    if (!/^\d+(\.\d{0,2})?$/.test(limpo)) return null;
    return Math.round(Number(limpo) * 100);
  };

  // Redesenha a tela mantendo o foco no campo em que a pessoa está (marcado com data-foco).
  App.preservarFoco = (desenhar) => {
    const ativo = document.activeElement;
    const chave = ativo && ativo.dataset ? ativo.dataset.foco : null;
    const selecao = chave && typeof ativo.selectionStart === "number" ? [ativo.selectionStart, ativo.selectionEnd] : null;
    desenhar();
    if (!chave) return;
    const novo = document.querySelector(`[data-foco="${CSS.escape(chave)}"]`);
    if (!novo) return;
    novo.focus();
    if (selecao && typeof novo.setSelectionRange === "function") novo.setSelectionRange(selecao[0], selecao[1]);
  };

  // ---------- Ícones ----------

  App.ICONES = {
    abrir: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M9 3h4v4m0-4L7.5 8.5M12 9.5V13H3V4h3.5"/></svg>',
    enviar: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 11V3m0 0L5 6m3-3 3 3M3 12.5h10"/></svg>',
    copiar:
      '<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="5.5" y="5.5" width="8" height="8" rx="1.5"/><path d="M10.5 3.5v-.5A1.5 1.5 0 0 0 9 1.5H4A1.5 1.5 0 0 0 2.5 3v5A1.5 1.5 0 0 0 4 9.5h.5"/></svg>',
    seta: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="m4 6 4 4 4-4"/></svg>',
    anterior: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="m10 4-4 4 4 4"/></svg>',
    proximo: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="m6 4 4 4-4 4"/></svg>',
    alerta:
      '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 2.5 14 13H2L8 2.5Z"/><path d="M8 6.5v3M8 11.3v.2"/></svg>',
    info: '<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6"/><path d="M8 7.5v3.5M8 5.2v.2"/></svg>',
    remover: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="m4.5 4.5 7 7m0-7-7 7"/></svg>',
    mais: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 3.5v9M3.5 8h9"/></svg>',
    editar: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M10.5 3 13 5.5 6 12.5H3.5V10L10.5 3Z"/></svg>',
  };
})();
