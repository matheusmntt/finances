// Gráfico de linhas em SVG com mira, tooltip e navegação pelo teclado.
(function () {
  "use strict";

  const App = window.App;
  const { esc, reais } = App;

  function ticksBonitos(maxCentavos, alvo) {
    const max = Math.max(maxCentavos, 100) / 100;
    const bruto = max / alvo;
    const potencia = Math.pow(10, Math.floor(Math.log10(bruto)));
    const passo = [1, 2, 2.5, 5, 10].map((f) => f * potencia).find((p) => p >= bruto);
    const ticks = [];
    for (let v = 0; v < max + passo; v += passo) ticks.push(Math.round(v * 100));
    return ticks;
  }

  // dados: { meses, series: [{ nome, classe, valores }], marco: { i, texto } | null }
  App.desenharGrafico = (el, dados) => {
    const largura = Math.max(el.clientWidth, 280);
    const altura = 300;
    const estreito = largura < 560;
    const m = { topo: 26, direita: estreito ? 12 : 96, baixo: 30, esquerda: 70 };
    const w = largura - m.esquerda - m.direita;
    const h = altura - m.topo - m.baixo;
    const n = dados.meses.length;
    const todos = dados.series.flatMap((s) => s.valores.filter((v) => v != null));
    const minimo = Math.min(0, ...todos);
    const ticks = ticksBonitos(Math.max(...todos) - minimo, 6).map((t) => t + Math.floor(minimo / 100) * 100);
    const yMin = ticks[0];
    const yMax = ticks[ticks.length - 1];
    const x = (i) => m.esquerda + (n === 1 ? 0 : (i / (n - 1)) * w);
    const y = (v) => m.topo + h - ((v - yMin) / (yMax - yMin || 1)) * h;

    const grade = ticks
      .map(
        (t) => `<line x1="${m.esquerda}" x2="${m.esquerda + w}" y1="${y(t)}" y2="${y(t)}"></line>
          <text x="${m.esquerda - 10}" y="${y(t) + 4}" text-anchor="end">${esc(App.reaisCurto(t))}</text>`
      )
      .join("");

    let ultimoX = -Infinity;
    const rotulosX = dados.meses
      .map((mes, i) => {
        if (i !== 0 && !mes.endsWith("-01")) return "";
        if (x(i) - ultimoX < 48) return "";
        ultimoX = x(i);
        return `<text x="${x(i)}" y="${m.topo + h + 20}" text-anchor="middle">${esc(App.mesCurto(mes))}</text>`;
      })
      .join("");

    const marco = dados.marco
      ? `<g class="marco">
          <line x1="${x(dados.marco.i)}" x2="${x(dados.marco.i)}" y1="${m.topo - 6}" y2="${m.topo + h}"></line>
          <text x="${x(dados.marco.i) + 6}" y="${m.topo - 10}">${esc(dados.marco.texto)} · ${esc(App.mesCurto(dados.meses[dados.marco.i]))}</text>
        </g>`
      : "";

    const fins = [];
    const linhas = dados.series
      .map((s) => {
        let caminho = "";
        let caneta = false;
        s.valores.forEach((v, i) => {
          if (v == null) {
            caneta = false;
            return;
          }
          caminho += `${caneta ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`;
          caneta = true;
        });
        const iUltimo = s.valores.reduce((acc, v, i) => (v != null ? i : acc), -1);
        if (iUltimo >= 0) fins.push({ s, i: iUltimo, v: s.valores[iUltimo] });
        return `<path class="linha ${s.classe}" d="${caminho}"></path>`;
      })
      .join("");

    const pontosFim = fins.map((f) => `<circle class="ponto ${f.s.classe}" cx="${x(f.i)}" cy="${y(f.v)}" r="4"></circle>`).join("");
    const colidem = fins.some((a, ia) => fins.some((b, ib) => ia !== ib && Math.abs(y(a.v) - y(b.v)) < 16));
    const rotulosFim =
      estreito || colidem
        ? ""
        : fins.map((f) => `<text class="rotulo-fim" x="${x(f.i) + 10}" y="${y(f.v) + 4}">${esc(App.reaisCurto(f.v))}</text>`).join("");

    const mira = `<g class="mira" visibility="hidden">
        <line y1="${m.topo}" y2="${m.topo + h}"></line>
        ${dados.series.map((s) => `<circle class="ponto ${s.classe}" r="4"></circle>`).join("")}
      </g>`;

    el.innerHTML = `<svg width="${largura}" height="${altura}" style="width:${largura}px;height:${altura}px" viewBox="0 0 ${largura} ${altura}" tabindex="0" role="img"
        aria-label="Gráfico do saldo acumulado mês a mês. Use as setas para percorrer os meses; os valores também estão na tabela Mês a mês.">
        <g class="grade">${grade}</g>
        <g class="eixo">${rotulosX}</g>
        ${marco}
        ${linhas}
        ${pontosFim}
        ${rotulosFim}
        ${mira}
        <rect class="captura" x="${m.esquerda}" y="${m.topo}" width="${w}" height="${h}"></rect>
      </svg>
      <div class="tooltip-grafico" hidden></div>`;

    const svg = el.querySelector("svg");
    const grupoMira = svg.querySelector(".mira");
    const linhaMira = grupoMira.querySelector("line");
    const pontosMira = [...grupoMira.querySelectorAll("circle")];
    const tooltip = el.querySelector(".tooltip-grafico");
    let atual = null;

    function mostrar(i) {
      atual = Math.max(0, Math.min(n - 1, i));
      const px = x(atual);
      grupoMira.setAttribute("visibility", "visible");
      linhaMira.setAttribute("x1", px);
      linhaMira.setAttribute("x2", px);

      tooltip.replaceChildren();
      const titulo = document.createElement("p");
      titulo.className = "tooltip-titulo";
      titulo.textContent = App.nomeMes(dados.meses[atual]);
      tooltip.appendChild(titulo);

      dados.series.forEach((s, k) => {
        const v = s.valores[atual];
        const ponto = pontosMira[k];
        if (v == null) {
          ponto.setAttribute("visibility", "hidden");
          return;
        }
        ponto.setAttribute("visibility", "visible");
        ponto.setAttribute("cx", px);
        ponto.setAttribute("cy", y(v));

        const linha = document.createElement("p");
        linha.className = "tooltip-linha";
        const chave = document.createElement("span");
        chave.className = `chave-linha ${s.classe}`;
        const valor = document.createElement("strong");
        valor.textContent = reais(v);
        const nome = document.createElement("span");
        nome.textContent = s.nome;
        linha.append(chave, valor, nome);
        tooltip.appendChild(linha);
      });

      tooltip.hidden = false;
      const larguraTooltip = tooltip.offsetWidth;
      const esquerda = px + 14 + larguraTooltip > largura ? px - 14 - larguraTooltip : px + 14;
      tooltip.style.left = `${Math.max(0, esquerda)}px`;
      tooltip.style.top = `${m.topo}px`;
    }

    function esconder() {
      grupoMira.setAttribute("visibility", "hidden");
      tooltip.hidden = true;
    }

    svg.addEventListener("pointermove", (e) => {
      const caixa = svg.getBoundingClientRect();
      const px = ((e.clientX - caixa.left) * largura) / caixa.width;
      if (px < m.esquerda - 8 || px > m.esquerda + w + 8) return esconder();
      mostrar(Math.round(((px - m.esquerda) / w) * (n - 1)));
    });
    svg.addEventListener("pointerleave", esconder);
    svg.addEventListener("focus", () => mostrar(atual == null ? n - 1 : atual));
    svg.addEventListener("blur", esconder);
    svg.addEventListener("keydown", (e) => {
      const passos = { ArrowLeft: -1, ArrowRight: 1, Home: -Infinity, End: Infinity };
      if (!(e.key in passos)) return;
      e.preventDefault();
      const base = atual == null ? n - 1 : atual;
      mostrar(passos[e.key] === -Infinity ? 0 : passos[e.key] === Infinity ? n - 1 : base + passos[e.key]);
    });
  };
})();
