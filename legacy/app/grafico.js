// Gráfico em SVG com linhas e barras, mira, tooltip e navegação pelo teclado.
(function () {
  "use strict";

  const App = window.App;
  const { esc, reais } = App;

  // Valores redondos para o eixo, cobrindo de min a max (em centavos).
  function ticksBonitos(min, max, alvo) {
    const faixa = Math.max(max - min, 100) / 100;
    const bruto = faixa / alvo;
    const potencia = Math.pow(10, Math.floor(Math.log10(bruto)));
    const passo = [1, 2, 2.5, 5, 10].map((f) => f * potencia).find((p) => p >= bruto) * 100;
    const ticks = [];
    for (let v = Math.floor(min / passo) * passo; v < max + passo; v += passo) {
      ticks.push(Math.round(v));
      if (v >= max) break;
    }
    return ticks;
  }

  // Barra com a ponta de dados arredondada (4px) e a base reta.
  function caminhoBarra(xc, largura, y0, y1) {
    const xl = xc - largura / 2;
    const xr = xc + largura / 2;
    const r = Math.min(4, Math.abs(y1 - y0), largura / 2);
    const s = y1 < y0 ? 1 : -1; // positiva sobe, negativa desce
    return `M${xl},${y0}V${y1 + s * r}Q${xl},${y1} ${xl + r},${y1}H${xr - r}Q${xr},${y1} ${xr},${y1 + s * r}V${y0}Z`;
  }

  // dados: {
  //   meses,
  //   series: [{ nome, classe, valores, tipo: "linha" | "barras" | "info" }], ("info" só aparece no tooltip)
  //   iHoje: índice do mês atual (linhas tracejadas e barras mais claras depois dele) | null,
  //   marcos: [{ i, texto }],
  //   altura, rotulo
  // }
  App.desenharGrafico = (el, dados) => {
    const largura = Math.max(el.clientWidth, 280);
    const altura = dados.altura || 300;
    const estreito = largura < 560;
    const m = { topo: 26, direita: estreito ? 12 : 96, baixo: 30, esquerda: 70 };
    const w = largura - m.esquerda - m.direita;
    const h = altura - m.topo - m.baixo;
    const n = dados.meses.length;
    const iHoje = dados.iHoje == null ? null : dados.iHoje;
    const desenhadas = dados.series.filter((s) => s.tipo !== "info");
    const todos = desenhadas.flatMap((s) => s.valores.filter((v) => v != null));
    const ticks = ticksBonitos(Math.min(0, ...todos), Math.max(0, ...todos), estreito ? 4 : 5);
    const yMin = ticks[0];
    const yMax = ticks[ticks.length - 1];
    const passo = w / n;
    const x = (i) => m.esquerda + passo * (i + 0.5);
    const y = (v) => m.topo + h - ((v - yMin) / (yMax - yMin || 1)) * h;

    const grade = ticks
      .map(
        (t) => `<line class="${t === 0 ? "zero" : ""}" x1="${m.esquerda}" x2="${m.esquerda + w}" y1="${y(t)}" y2="${y(t)}"></line>
          <text x="${m.esquerda - 10}" y="${y(t) + 4}" text-anchor="end">${esc(App.reaisCurto(t))}</text>`
      )
      .join("");

    // Todos os meses quando cabem; senão, o primeiro e cada janeiro.
    const todosOsMeses = passo >= 46;
    let ultimoX = -Infinity;
    const rotulosX = dados.meses
      .map((mes, i) => {
        if (!todosOsMeses && i !== 0 && !mes.endsWith("-01")) return "";
        if (x(i) - ultimoX < 48) return "";
        ultimoX = x(i);
        return `<text x="${x(i)}" y="${m.topo + h + 20}" text-anchor="middle">${esc(App.mesCurto(mes))}</text>`;
      })
      .join("");

    let ultimoMarco = -Infinity;
    let nivel = 0;
    const marcos = (dados.marcos || [])
      .filter((mc) => mc.i >= 0 && mc.i < n)
      .sort((a, b) => a.i - b.i)
      .map((mc) => {
        const px = x(mc.i);
        nivel = px - ultimoMarco < 150 ? nivel + 1 : 0;
        ultimoMarco = px;
        const ancora = px > m.esquerda + w - 140 ? "end" : "start";
        const dx = ancora === "end" ? -6 : 6;
        return `<g class="marco">
          <line x1="${px}" x2="${px}" y1="${m.topo - 6 + nivel * 14}" y2="${m.topo + h}"></line>
          <text x="${px + dx}" y="${m.topo - 10 + nivel * 14}" text-anchor="${ancora}">${esc(mc.texto)}</text>
        </g>`;
      })
      .join("");

    const caminho = (valores, de, ate) => {
      let d = "";
      let caneta = false;
      for (let i = de; i <= ate; i++) {
        const v = valores[i];
        if (v == null) {
          caneta = false;
          continue;
        }
        d += `${caneta ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`;
        caneta = true;
      }
      return d;
    };

    // A primeira série fica por cima: as séries são desenhadas da última para a primeira.
    const fins = [];
    const desenhos = [...desenhadas]
      .reverse()
      .map((s) => {
        if (s.tipo === "barras") {
          const larguraBarra = Math.max(2, Math.min(24, passo - 4));
          return s.valores
            .map((v, i) => {
              if (!v) return "";
              const classe = `barra ${s.classe} ${v < 0 ? "negativa" : "positiva"}${iHoje != null && i > iHoje ? " prevista" : ""}`;
              return `<path class="${classe}" d="${caminhoBarra(x(i), larguraBarra, y(0), y(v))}"></path>`;
            })
            .join("");
        }
        const iUltimo = s.valores.reduce((acc, v, i) => (v != null ? i : acc), -1);
        if (iUltimo >= 0) fins.push({ s, i: iUltimo, v: s.valores[iUltimo] });
        if (iHoje == null || iHoje >= n - 1) return `<path class="linha ${s.classe}" d="${caminho(s.valores, 0, n - 1)}"></path>`;
        // Até hoje: realizado (contínuo). Depois: previsto (tracejado).
        return `<path class="linha ${s.classe}" d="${caminho(s.valores, 0, Math.max(0, iHoje))}"></path>
          <path class="linha prevista ${s.classe}" d="${caminho(s.valores, Math.max(0, iHoje), n - 1)}"></path>`;
      })
      .join("");

    const pontosFim = fins.map((f) => `<circle class="ponto ${f.s.classe}" cx="${x(f.i)}" cy="${y(f.v)}" r="4"></circle>`).join("");
    const colidem = fins.some((a, ia) => fins.some((b, ib) => ia !== ib && Math.abs(y(a.v) - y(b.v)) < 16));
    const rotulosFim =
      estreito || colidem
        ? ""
        : fins.map((f) => `<text class="rotulo-fim" x="${x(f.i) + 10}" y="${y(f.v) + 4}">${esc(App.reaisCurto(f.v))}</text>`).join("");

    const linhas = desenhadas.filter((s) => s.tipo !== "barras");
    const mira = `<g class="mira" visibility="hidden">
        <line y1="${m.topo}" y2="${m.topo + h}"></line>
        ${linhas.map((s) => `<circle class="ponto ${s.classe}" r="4"></circle>`).join("")}
      </g>`;

    el.innerHTML = `<svg width="${largura}" height="${altura}" style="width:${largura}px;height:${altura}px" viewBox="0 0 ${largura} ${altura}" tabindex="0" role="img"
        aria-label="${esc(dados.rotulo || "Gráfico mês a mês")}. Use as setas para percorrer os meses; os valores também estão na tabela Mês a mês.">
        <g class="grade">${grade}</g>
        <g class="eixo">${rotulosX}</g>
        ${marcos}
        ${desenhos}
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
      const quando = iHoje == null ? "" : atual > iHoje ? " · previsto" : atual === iHoje ? " · mês atual" : "";
      titulo.textContent = `${App.nomeMes(dados.meses[atual])}${quando}`;
      tooltip.appendChild(titulo);

      linhas.forEach((s, k) => {
        const v = s.valores[atual];
        const ponto = pontosMira[k];
        ponto.setAttribute("visibility", v == null ? "hidden" : "visible");
        if (v == null) return;
        ponto.setAttribute("cx", px);
        ponto.setAttribute("cy", y(v));
      });

      dados.series.forEach((s) => {
        const v = s.valores[atual];
        if (v == null) return;
        const linha = document.createElement("p");
        linha.className = "tooltip-linha";
        const chave = document.createElement("span");
        chave.className =
          s.tipo === "info" ? "chave-info" : `${s.tipo === "barras" ? "chave-barra" : "chave-linha"} ${s.classe}${v < 0 ? " negativa" : ""}`;
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
      mostrar(Math.floor((px - m.esquerda) / passo));
    });
    svg.addEventListener("pointerleave", esconder);
    svg.addEventListener("focus", () => mostrar(atual == null ? (iHoje == null ? n - 1 : iHoje) : atual));
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
