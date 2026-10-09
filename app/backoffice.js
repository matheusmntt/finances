// Aba "Backoffice": edição direta de todos os dados, inclusive os que as outras abas não editam.
(function () {
  "use strict";

  const App = window.App;
  const { $, esc, reais, plural } = App;

  const estado = {
    entidade: "despesas",
    busca: "",
    despesaId: null, // despesa aberta em "Valores por mês"
    abertos: new Set(), // fichas e formulários "Adicionar" abertos
  };

  const d = () => App.dados;

  const brParaIso = (br) => (br ? br.split("/").reverse().join("-") : "");
  const formatarTaxa = (fracao) => (fracao * 100).toLocaleString("pt-BR", { maximumFractionDigits: 4 });
  const velocidade = (chave) => (m) => (m.velocidade ? m.velocidade[chave] : null);

  function nomeInfracao(m) {
    const i = d().infracoes[m.codigoInfracao];
    return i ? i.descricao : App.titulo(m.descricao);
  }

  function despesaAberta() {
    const lista = d().despesas;
    const despesa = lista.find((x) => x.id === estado.despesaId) || lista[0];
    estado.despesaId = despesa ? despesa.id : null;
    return despesa;
  }

  // ---------- Tabelas ----------
  // Tipos: texto, centavos, inteiro, mes, data (AAAA-MM-DD), dataBr (DD/MM/AAAA), hora, booleano, grupo, categoria,
  // opcao e taxa. "ler" diz de onde vem o valor quando o nome do campo não é o mesmo de App.dados.

  const ENTIDADES = [
    {
      id: "config",
      titulo: "Configurações",
      descricao: "Período do plano, rendimento do CDB e as categorias que recebem o que a Greici e o André pagam.",
      layout: "config",
      caminho: () => "/api/backoffice/config",
      campos: [
        { campo: "planoInicio", rotulo: "Início do plano", tipo: "mes" },
        { campo: "planoFim", rotulo: "Fim do plano", tipo: "mes" },
        { campo: "cdbTaxaMensal", rotulo: "Rendimento do CDB (% ao mês)", tipo: "taxa" },
        { campo: "cdbInicio", rotulo: "CDB começa em", tipo: "mes", opcional: true },
        { campo: "credores", rotulo: "Nome dos credores", tipo: "texto", max: 60 },
        { campo: "placa", rotulo: "Placa do carro", tipo: "texto", max: 10, opcional: true },
        { campo: "categoriaContasPagasPorCredores", rotulo: "Categoria das contas pagas por eles", tipo: "categoria", largo: true },
        { campo: "categoriaCarro", rotulo: "Categoria do carro", tipo: "categoria", largo: true },
      ],
    },
    {
      id: "despesas",
      titulo: "Despesas",
      novo: "Adicionar despesa",
      descricao: "Nome, grupo e destino de cada conta mensal. Os valores de cada mês ficam em “Valores por mês”.",
      registros: () => d().despesas,
      chave: (x) => x.id,
      nome: (x) => x.nome,
      campos: [
        { campo: "nome", rotulo: "Nome", tipo: "texto", max: 120, largo: true },
        { campo: "nomeCurto", rotulo: "Nome curto", tipo: "texto", max: 24, opcional: true },
        { campo: "grupoId", rotulo: "Grupo", tipo: "grupo" },
        { campo: "categoriaDivida", rotulo: "Devolução de", tipo: "categoria", vazio: "Não é devolução" },
        { campo: "pagoAosCredores", rotulo: "Pago direto a eles", tipo: "booleano" },
        { campo: "ordem", rotulo: "Ordem", tipo: "inteiro" },
      ],
      criar: ["nome", "grupoId"],
      confirmar: (x) =>
        `Remover “${x.nome}” e ${plural(Object.keys(x.valores).length, "valor mensal", "valores mensais")}?`,
      acoes: (x) =>
        `<button type="button" class="botao" data-bo-meses="${x.id}" title="Ver e editar o valor de cada mês">Meses</button>`,
    },
    {
      id: "valores",
      titulo: "Valores por mês",
      novo: "Adicionar meses",
      descricao: "Quanto a despesa custa em cada mês, quando foi paga e se foram a Greici e o André que pagaram.",
      registros: () => {
        const despesa = despesaAberta();
        return despesa ? Object.entries(despesa.valores).map(([mes, v]) => ({ mes, ...v })) : [];
      },
      chave: (x) => x.mes,
      nome: (x) => App.nomeMes(x.mes),
      colunaChave: { rotulo: "Mês", texto: (x) => App.mesCurto(x.mes) },
      caminho: (chave) => `/api/backoffice/despesas/${estado.despesaId}/meses${chave == null ? "" : `/${chave}`}`,
      campos: [
        { campo: "valor", rotulo: "Valor", tipo: "centavos" },
        { campo: "pagoEm", rotulo: "Pago em", tipo: "data", opcional: true },
        { campo: "pagoPorCredores", rotulo: "Pago pela Greici e André", tipo: "booleano" },
      ],
      criar: [
        { campo: "mes", rotulo: "Primeiro mês", tipo: "mes" },
        "valor",
        { campo: "meses", rotulo: "Quantos meses seguidos", tipo: "inteiro", padrao: 1 },
      ],
    },
    {
      id: "entradas",
      titulo: "Entradas",
      novo: "Adicionar entrada",
      descricao: "Salário, notas PJ e outros recebimentos de todos os meses.",
      registros: () => d().entradas,
      chave: (x) => x.id,
      nome: (x) => x.descricao,
      campos: [
        { campo: "mes", rotulo: "Mês", tipo: "mes" },
        { campo: "descricao", rotulo: "Descrição", tipo: "texto", max: 120, largo: true },
        { campo: "valor", rotulo: "Valor", tipo: "centavos" },
      ],
      criar: ["mes", "descricao", "valor"],
    },
    {
      id: "extras",
      titulo: "Extras",
      novo: "Adicionar extra",
      descricao: "Gastos avulsos de todos os meses.",
      registros: () => d().extras,
      chave: (x) => x.id,
      nome: (x) => x.descricao,
      campos: [
        { campo: "mes", rotulo: "Mês", tipo: "mes" },
        { campo: "descricao", rotulo: "Descrição", tipo: "texto", max: 120, largo: true },
        { campo: "valor", rotulo: "Valor", tipo: "centavos" },
        { campo: "pagoEm", rotulo: "Pago em", tipo: "data", opcional: true },
      ],
      criar: ["mes", "descricao", "valor"],
    },
    {
      id: "emprestimos",
      titulo: "Pago pela Greici e pelo André",
      novo: "Adicionar valor pago por eles",
      descricao: "O que eles pagaram por você fora das contas mensais. Entra na dívida.",
      registros: () => d().emprestimos,
      chave: (x) => x.id,
      nome: (x) => x.descricao,
      campos: [
        { campo: "mes", rotulo: "Mês", tipo: "mes", opcional: true },
        { campo: "descricao", rotulo: "Descrição", tipo: "texto", max: 120, largo: true },
        { campo: "valor", rotulo: "Valor", tipo: "centavos" },
        { campo: "categoriaDivida", rotulo: "Parte da dívida", tipo: "categoria" },
        { campo: "origem", rotulo: "Origem", tipo: "texto", max: 60 },
      ],
      criar: ["mes", "descricao", "valor", "categoriaDivida", "origem"],
    },
    {
      id: "multas",
      titulo: "Multas",
      descricao:
        "Dados dos boletos. Uma multa alterada aqui não é mais atualizada pelo importador de boletos. Para não pagar uma multa, zere o valor.",
      layout: "fichas",
      registros: () => d().multas,
      chave: (x) => x.serie,
      nome: (x) => x.serie,
      resumo: (x) => `${nomeInfracao(x)} · infração em ${x.dataInfracao}`,
      remover: false,
      campos: [
        { campo: "situacao", rotulo: "Situação", tipo: "opcao", opcoes: [["a-vencer", "A vencer"], ["vencidos", "Vencidos"]] },
        { campo: "valorOriginal", rotulo: "Valor original", tipo: "centavos" },
        { campo: "juros", rotulo: "Juros", tipo: "centavos" },
        { campo: "valor", rotulo: "Valor a pagar", tipo: "centavos" },
        { campo: "validade", rotulo: "Válida até", tipo: "dataBr" },
        { campo: "pagoEm", rotulo: "Paga em", tipo: "data", opcional: true },
        { campo: "linhaDigitavel", rotulo: "Linha digitável", tipo: "texto", max: 80, opcional: true, largo: true },
        { campo: "guia", rotulo: "Nº da guia", tipo: "texto", max: 40, opcional: true },
        { campo: "expedida", rotulo: "Expedida em", tipo: "dataBr", opcional: true },
        { campo: "codigoInfracao", rotulo: "Código da infração", tipo: "texto", max: 12 },
        { campo: "descricao", rotulo: "Descrição no boleto", tipo: "texto", max: 200, largo: true },
        { campo: "amparo", rotulo: "Amparo legal", tipo: "texto", max: 120, opcional: true },
        { campo: "pontos", rotulo: "Pontos", tipo: "inteiro", opcional: true },
        { campo: "dataInfracao", rotulo: "Data da infração", tipo: "dataBr" },
        { campo: "horaInfracao", rotulo: "Hora da infração", tipo: "hora", opcional: true },
        { campo: "local", rotulo: "Local", tipo: "texto", max: 200, opcional: true, largo: true },
        { campo: "municipio", rotulo: "Município", tipo: "texto", max: 120, opcional: true },
        { campo: "autuador", rotulo: "Autuador", tipo: "texto", max: 120, opcional: true },
        { campo: "infrator", rotulo: "Infrator", tipo: "texto", max: 120, opcional: true },
        { campo: "placa", rotulo: "Placa", tipo: "texto", max: 10, opcional: true },
        { campo: "origem", rotulo: "Multa de origem", tipo: "texto", max: 12, opcional: true },
        { campo: "velocidadeMedida", rotulo: "Velocidade medida", tipo: "inteiro", opcional: true, ler: velocidade("medida") },
        {
          campo: "velocidadeConsiderada",
          rotulo: "Velocidade considerada",
          tipo: "inteiro",
          opcional: true,
          ler: velocidade("considerada"),
        },
        { campo: "velocidadeLimite", rotulo: "Limite de velocidade", tipo: "inteiro", opcional: true, ler: velocidade("limite") },
      ],
    },
    {
      id: "custos-carro",
      titulo: "Outras despesas do carro",
      novo: "Adicionar despesa do carro",
      descricao: "CRLV, pátio e outros custos para regularizar o carro. Também pagos pela Greici e pelo André.",
      layout: "fichas",
      registros: () => d().custosCarro,
      chave: (x) => x.id,
      nome: (x) => x.descricao,
      resumo: (x) => x.detalhe,
      // CRLV e pátio voltariam no próximo deploy (vêm de server/seed/base.js).
      podeRemover: (x) => !x.chave,
      campos: [
        { campo: "descricao", rotulo: "Descrição", tipo: "texto", max: 60 },
        { campo: "valor", rotulo: "Valor", tipo: "centavos" },
        { campo: "detalhe", rotulo: "Detalhe", tipo: "texto", max: 200, opcional: true, largo: true },
        { campo: "validade", rotulo: "Válida até", tipo: "dataBr", opcional: true },
        { campo: "pagoEm", rotulo: "Pago em", tipo: "data", opcional: true },
        { campo: "linhaDigitavel", rotulo: "Linha digitável", tipo: "texto", max: 80, opcional: true, largo: true },
        { campo: "guia", rotulo: "Nº da guia", tipo: "texto", max: 40, opcional: true },
        { campo: "ordem", rotulo: "Ordem", tipo: "inteiro" },
      ],
      criar: ["descricao", "valor"],
    },
    {
      id: "infracoes",
      titulo: "Infrações",
      novo: "Adicionar infração",
      descricao: "Descrição e tipo mostrados nas multas, pelo código da infração.",
      registros: () =>
        Object.entries(d().infracoes)
          .map(([codigo, i]) => ({ codigo, ...i }))
          .sort((a, b) => a.codigo.localeCompare(b.codigo)),
      chave: (x) => x.codigo,
      nome: (x) => x.descricao,
      colunaChave: { rotulo: "Código", texto: (x) => x.codigo },
      campos: [
        { campo: "descricao", rotulo: "Descrição", tipo: "texto", max: 120, largo: true },
        { campo: "tipo", rotulo: "Tipo", tipo: "texto", max: 40 },
      ],
      criar: [{ campo: "codigo", rotulo: "Código", tipo: "texto", max: 12 }, "descricao", "tipo"],
    },
    {
      id: "grupos",
      titulo: "Grupos de despesas",
      novo: "Adicionar grupo",
      descricao: "Seções da aba Mês. Só dá para remover um grupo sem despesas.",
      registros: () => d().grupos,
      chave: (x) => x.id,
      nome: (x) => x.nome,
      podeRemover: (x) => !d().despesas.some((despesa) => despesa.grupoId === x.id),
      campos: [
        { campo: "nome", rotulo: "Nome", tipo: "texto", max: 60 },
        { campo: "descricao", rotulo: "Descrição", tipo: "texto", max: 200, opcional: true, largo: true },
        { campo: "ordem", rotulo: "Ordem", tipo: "inteiro" },
      ],
      criar: ["nome"],
    },
    {
      id: "categorias-divida",
      titulo: "Categorias da dívida",
      novo: "Adicionar categoria",
      descricao: "Partes da dívida com a Greici e o André, usadas para comparar o plano com o que eles pagaram.",
      registros: () => d().categorias,
      chave: (x) => x.id,
      nome: (x) => x.nome,
      campos: [
        { campo: "nome", rotulo: "Nome", tipo: "texto", max: 60 },
        { campo: "ordem", rotulo: "Ordem", tipo: "inteiro" },
      ],
      criar: ["nome"],
    },
  ];

  const entidadeAtual = () => ENTIDADES.find((e) => e.id === estado.entidade);

  const caminho = (e, chave) =>
    e.caminho ? e.caminho(chave) : `/api/backoffice/${e.id}${chave == null ? "" : `/${encodeURIComponent(chave)}`}`;

  const podeRemover = (e, x) => e.remover !== false && (!e.podeRemover || e.podeRemover(x));

  const valorDe = (def, registro) => (def.ler ? def.ler(registro) : registro[def.campo]);

  const camposCriar = (e) => e.criar.map((c) => (typeof c === "string" ? e.campos.find((def) => def.campo === c) : c));

  // ---------- Campos ----------

  function opcoes(lista, selecionado, vazio) {
    const primeira = vazio == null ? "" : `<option value="">${esc(vazio)}</option>`;
    return (
      primeira +
      lista
        .map(([valor, rotulo]) => `<option value="${esc(valor)}"${valor === selecionado ? " selected" : ""}>${esc(rotulo)}</option>`)
        .join("")
    );
  }

  function htmlEntrada(def, valor, atributos) {
    switch (def.tipo) {
      case "centavos":
        return `<input class="campo campo-valor" inputmode="decimal" placeholder="0,00" value="${App.formatarCampo(valor)}" ${atributos}>`;
      case "taxa":
        return `<input class="campo campo-valor" inputmode="decimal" value="${valor == null ? "" : esc(formatarTaxa(valor))}" ${atributos}>`;
      case "inteiro":
        return `<input class="campo" type="number" step="1" value="${valor == null ? "" : esc(valor)}" ${atributos}>`;
      case "mes":
        return `<input class="campo" type="month" placeholder="AAAA-MM" value="${esc(valor || "")}" ${atributos}>`;
      case "data":
        return `<input class="campo" type="date" value="${esc(valor || "")}" ${atributos}>`;
      case "dataBr":
        return `<input class="campo" type="date" value="${esc(brParaIso(valor))}" ${atributos}>`;
      case "hora":
        return `<input class="campo" type="time" value="${esc(valor || "")}" ${atributos}>`;
      case "booleano":
        return `<input type="checkbox"${valor ? " checked" : ""} ${atributos}>`;
      case "grupo":
        return `<select class="campo" ${atributos}>${opcoes(d().grupos.map((g) => [g.id, g.nome]), valor)}</select>`;
      case "categoria":
        return `<select class="campo" ${atributos}>${opcoes(
          d().categorias.map((c) => [c.id, c.nome]),
          valor,
          def.vazio || (def.opcional ? "—" : null)
        )}</select>`;
      case "opcao":
        return `<select class="campo" ${atributos}>${opcoes(def.opcoes, valor)}</select>`;
      default:
        return `<input class="campo" maxlength="${def.max || 120}" value="${esc(valor == null ? "" : valor)}" ${atributos}>`;
    }
  }

  function htmlRotulado(def, valor, atributos) {
    const largo = def.largo ? " largo" : "";
    if (def.tipo === "booleano") {
      return `<label class="bo-check${largo}">${htmlEntrada(def, valor, atributos)}<span>${esc(def.rotulo)}</span></label>`;
    }
    return `<label class="campo-rotulo${largo}">${esc(def.rotulo)}${htmlEntrada(def, valor, atributos)}</label>`;
  }

  // Valor que vai para o servidor. undefined = o que foi digitado não dá para entender.
  function lerEntrada(def, el) {
    const texto = el.value.trim();
    switch (def.tipo) {
      case "booleano":
        return el.checked;
      case "centavos":
        return texto === "" ? undefined : App.lerReais(texto) ?? undefined;
      case "taxa": {
        const numero = Number(texto.includes(",") ? texto.replace(/\./g, "").replace(",", ".") : texto);
        return texto === "" || !Number.isFinite(numero) ? undefined : Number((numero / 100).toFixed(8));
      }
      case "inteiro":
        if (texto === "") return def.padrao ?? null;
        return Number.isInteger(Number(texto)) ? Number(texto) : undefined;
      case "dataBr":
        return texto ? App.isoParaBr(texto) : null;
      default:
        return texto === "" ? null : texto;
    }
  }

  function textoBusca(def, valor) {
    if (valor == null || valor === "") return "";
    switch (def.tipo) {
      case "centavos":
        return App.formatarCampo(valor);
      case "mes":
        return `${valor} ${App.nomeMes(valor)}`;
      case "grupo":
        return (d().grupos.find((g) => g.id === valor) || {}).nome || "";
      case "categoria":
        return App.nomeCategoria(valor);
      case "booleano":
        return "";
      default:
        return String(valor);
    }
  }

  function corresponde(e, x) {
    if (!estado.busca) return true;
    const alvo = App.semAcento(
      [e.nome(x), e.colunaChave && e.colunaChave.texto(x), e.resumo && e.resumo(x), ...e.campos.map((c) => textoBusca(c, valorDe(c, x)))]
        .filter(Boolean)
        .join(" ")
    );
    return App.semAcento(estado.busca)
      .split(/\s+/)
      .filter(Boolean)
      .every((termo) => alvo.includes(termo));
  }

  // ---------- Renderização ----------

  function botaoRemover(nome, comTexto) {
    const rotulo = `Remover ${nome}`;
    return comTexto
      ? `<button type="button" class="botao botao-fantasma" data-bo-remover>${App.ICONES.remover}Remover</button>`
      : `<button type="button" class="botao botao-icone botao-fantasma" data-bo-remover aria-label="${esc(rotulo)}" title="${esc(rotulo)}">${App.ICONES.remover}</button>`;
  }

  function valorInicial(def) {
    if (def.tipo === "mes") return App.mesAtual;
    if (def.padrao != null) return def.padrao;
    return null;
  }

  function htmlCriar(e) {
    if (!e.criar) return "";
    const id = `bo-criar-${e.id}`;
    const campos = camposCriar(e)
      .map((def) => htmlRotulado(def, valorInicial(def), `name="${def.campo}"`))
      .join("");
    return `<details class="adicionar-detalhes" data-bo-aberto="${id}"${estado.abertos.has(id) ? " open" : ""}>
      <summary><span class="marcador-mais" aria-hidden="true">${App.ICONES.mais}</span>${esc(e.novo)}</summary>
      <form class="form-grade" data-bo-criar autocomplete="off">
        ${campos}
        <div class="form-acoes"><button type="submit" class="botao botao-primario">Adicionar</button></div>
      </form>
    </details>`;
  }

  const mensagemVazia = () => (estado.busca ? "Nada encontrado para esse filtro." : "Nenhum registro.");

  function htmlTabela(e, lista) {
    const colunas = (e.colunaChave ? 1 : 0) + e.campos.length + 1;
    const cabecalho = `${e.colunaChave ? `<th scope="col">${esc(e.colunaChave.rotulo)}</th>` : ""}${e.campos
      .map((c) => `<th scope="col"${c.tipo === "centavos" ? ' class="num"' : ""}>${esc(c.rotulo)}</th>`)
      .join("")}<th scope="col"><span class="sr-only">Ações</span></th>`;

    const linhas = lista
      .map((x) => {
        const chave = String(e.chave(x));
        const nome = e.nome(x);
        const celulas = e.campos
          .map((c) => {
            const atributos = `data-bo-campo="${c.campo}" data-foco="bo-${e.id}-${esc(chave)}-${c.campo}" aria-label="${esc(`${c.rotulo}: ${nome}`)}"`;
            return `<td class="bo-${c.tipo}${c.largo ? " bo-largo" : ""}">${htmlEntrada(c, valorDe(c, x), atributos)}</td>`;
          })
          .join("");
        return `<tr data-bo-registro="${esc(chave)}">
          ${e.colunaChave ? `<th scope="row">${esc(e.colunaChave.texto(x))}</th>` : ""}
          ${celulas}
          <td class="bo-acoes">${e.acoes ? e.acoes(x) : ""}${podeRemover(e, x) ? botaoRemover(nome) : ""}</td>
        </tr>`;
      })
      .join("");

    return `<div class="cartao">
      <div class="tabela-wrap">
        <table class="tabela tabela-bo">
          <thead><tr>${cabecalho}</tr></thead>
          <tbody>${linhas || `<tr><td colspan="${colunas}" class="vazio-celula">${mensagemVazia()}</td></tr>`}</tbody>
        </table>
      </div>
      ${htmlCriar(e)}
    </div>`;
  }

  function htmlFichas(e, lista) {
    const fichas = lista
      .map((x) => {
        const chave = String(e.chave(x));
        const id = `bo-${e.id}-${chave}`;
        const campos = e.campos
          .map((c) => htmlRotulado(c, valorDe(c, x), `data-bo-campo="${c.campo}" data-foco="${esc(id)}-${c.campo}"`))
          .join("");
        return `<details class="cartao bo-ficha" data-bo-registro="${esc(chave)}" data-bo-aberto="${esc(id)}"${
          estado.abertos.has(id) ? " open" : ""
        }>
          <summary>
            <span class="bo-ficha-info">
              <strong>${esc(e.nome(x))}</strong>
              ${x.pagoEm ? '<span class="tag tag-pago">Pago</span>' : ""}
              <span class="sub">${esc(e.resumo(x) || "")}</span>
            </span>
            <span class="bo-ficha-valor">${reais(x.valor)}</span>
            ${App.ICONES.seta}
          </summary>
          <div class="form-grade bo-grade">${campos}</div>
          ${podeRemover(e, x) ? `<div class="bo-ficha-acoes">${botaoRemover(e.nome(x), true)}</div>` : ""}
        </details>`;
      })
      .join("");
    return `<div class="bo-fichas">${fichas || `<div class="cartao vazio">${mensagemVazia()}</div>`}</div>
      ${e.criar ? `<div class="cartao">${htmlCriar(e)}</div>` : ""}`;
  }

  function htmlSeletorDespesa() {
    const despesa = despesaAberta();
    const grupos = d()
      .grupos.map((g) => {
        const itens = d().despesas.filter((x) => x.grupoId === g.id);
        if (!itens.length) return "";
        return `<optgroup label="${esc(g.nome)}">${itens
          .map((x) => `<option value="${x.id}"${despesa && x.id === despesa.id ? " selected" : ""}>${esc(x.nome)}</option>`)
          .join("")}</optgroup>`;
      })
      .join("");
    return `<label class="campo-rotulo bo-despesa">Despesa<select class="campo" id="bo-despesa">${grupos}</select></label>`;
  }

  function htmlCabecalho(e, lateral = "") {
    return `<header class="secao-topo">
      <div>
        <h2>${esc(e.titulo)}</h2>
        <p>${esc(e.descricao)}</p>
      </div>
      ${lateral}
    </header>`;
  }

  function htmlLista(e) {
    if (e.id === "valores" && !despesaAberta()) {
      return `<section class="secao">${htmlCabecalho(e)}<div class="cartao vazio">Nenhuma despesa cadastrada.</div></section>`;
    }
    const todos = e.registros();
    const lista = todos.filter((x) => corresponde(e, x));
    const contagem =
      lista.length === todos.length
        ? plural(todos.length, "registro", "registros")
        : `${lista.length} de ${plural(todos.length, "registro", "registros")}`;
    const somaValores = e.campos.some((c) => c.campo === "valor" && c.tipo === "centavos");
    const total = `<div class="secao-total">${
      somaValores ? `<strong>${reais(lista.reduce((s, x) => s + x.valor, 0))}</strong>` : ""
    }<span>${contagem}</span></div>`;

    return `<section class="secao">
      ${htmlCabecalho(e, total)}
      ${e.id === "valores" ? htmlSeletorDespesa() : ""}
      ${e.layout === "fichas" ? htmlFichas(e, lista) : htmlTabela(e, lista)}
    </section>`;
  }

  function htmlConfig(e) {
    const config = d().config;
    const campos = e.campos
      .map((def) => htmlRotulado(def, config[def.campo], `data-bo-campo="${def.campo}" data-foco="bo-config-${def.campo}"`))
      .join("");
    return `<section class="secao">
      ${htmlCabecalho(e)}
      <div class="cartao" data-bo-registro="config"><div class="form-grade bo-grade bo-grade-config">${campos}</div></div>
    </section>`;
  }

  function renderConteudo() {
    const e = entidadeAtual();
    $("#bo-conteudo").innerHTML = e.layout === "config" ? htmlConfig(e) : htmlLista(e);
  }

  function render() {
    const raiz = $("#view-backoffice");
    if (!raiz.dataset.pronto) montar(raiz);
    $("#bo-entidade").value = estado.entidade;
    $("#bo-filtro").hidden = entidadeAtual().layout === "config";
    renderConteudo();
  }

  // Redesenha depois de salvar sem perder o foco nem o que já foi digitado no campo seguinte.
  function redesenhar() {
    const ativo = document.activeElement;
    const chave = ativo && ativo.dataset ? ativo.dataset.foco : null;
    const digitado = chave && ativo.type !== "checkbox" && ativo.value !== ativo.defaultValue ? ativo.value : null;
    App.preservarFoco(() => {
      renderConteudo();
      if (digitado == null) return;
      const novo = document.querySelector(`[data-foco="${CSS.escape(chave)}"]`);
      if (novo) novo.value = digitado;
    });
  }

  // ---------- Ações ----------

  function irPara(id) {
    definirEntidade(id);
    history.replaceState(null, "", `#backoffice/${id}`);
    render();
    window.scrollTo({ top: 0 });
  }

  function salvarCampo(el) {
    const e = entidadeAtual();
    const def = e.campos.find((c) => c.campo === el.dataset.boCampo);
    const valor = lerEntrada(def, el);
    if (valor === undefined) {
      App.toast(def.tipo === "centavos" ? "Valor inválido. Use, por exemplo, 1.500,00." : `Confira o campo “${def.rotulo}”.`);
      redesenhar();
      return;
    }
    const config = e.layout === "config";
    const chave = config ? null : el.closest("[data-bo-registro]").dataset.boRegistro;
    App.salvar(config ? "PUT" : "PATCH", caminho(e, chave), { [def.campo]: valor }, { renderizar: false }).then((ok) => {
      if (ok) redesenhar();
    });
  }

  function removerRegistro(botao) {
    const e = entidadeAtual();
    const chave = botao.closest("[data-bo-registro]").dataset.boRegistro;
    const registro = e.registros().find((x) => String(e.chave(x)) === chave);
    const nome = e.nome(registro);
    if (!window.confirm(e.confirmar ? e.confirmar(registro) : `Remover “${nome}”?`)) return;
    App.salvar("DELETE", caminho(e, chave), undefined, { mensagem: `Removido: ${nome}` });
  }

  async function criarRegistro(form) {
    const e = entidadeAtual();
    const corpo = {};
    for (const def of camposCriar(e)) {
      const campo = form.elements[def.campo];
      const valor = lerEntrada(def, campo);
      if (valor === undefined) {
        App.toast(def.tipo === "centavos" ? "Informe um valor válido, como 150,00." : `Confira o campo “${def.rotulo}”.`);
        campo.focus();
        return;
      }
      corpo[def.campo] = valor;
    }
    const nome = corpo.nome || corpo.descricao || (corpo.mes ? App.nomeMes(corpo.mes) : "registro");
    const ok = await App.salvar("POST", caminho(e, null), corpo, { mensagem: `Adicionado: ${nome}` });
    if (ok) {
      const primeiro = $("#bo-conteudo [data-bo-criar] .campo");
      if (primeiro) primeiro.focus();
    }
  }

  function aoMudar(evento) {
    const alvo = evento.target;
    if (alvo.id === "bo-despesa") {
      estado.despesaId = Number(alvo.value);
      renderConteudo();
    } else if (alvo.dataset.boCampo) {
      salvarCampo(alvo);
    }
  }

  function aoClicar(evento) {
    const remover = evento.target.closest("[data-bo-remover]");
    if (remover) {
      removerRegistro(remover);
      return;
    }
    const meses = evento.target.closest("[data-bo-meses]");
    if (meses) {
      estado.despesaId = Number(meses.dataset.boMeses);
      irPara("valores");
    }
  }

  function montar(raiz) {
    raiz.innerHTML = `
      <div class="aviso-cartao aviso-alerta" role="note">
        ${App.ICONES.alerta}
        <div><strong>Edição direta do banco.</strong> Cada campo é salvo quando você sai dele, sem como desfazer. Antes de mudanças grandes, use “Baixar backup”.</div>
      </div>
      <div class="ferramentas">
        <label class="bo-seletor">
          <span class="sr-only">Tabela</span>
          <select id="bo-entidade" class="seletor-mes">${ENTIDADES.map((e) => `<option value="${e.id}">${esc(e.titulo)}</option>`).join("")}</select>
        </label>
        <label class="busca" id="bo-filtro">
          <svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="7" cy="7" r="4.5"/><path d="m10.5 10.5 3 3"/></svg>
          <span class="sr-only">Filtrar</span>
          <input type="search" id="bo-busca" placeholder="Filtrar registros…" autocomplete="off">
        </label>
      </div>
      <div id="bo-conteudo"></div>`;

    $("#bo-entidade").addEventListener("change", (evento) => irPara(evento.target.value));
    $("#bo-busca").addEventListener("input", (evento) => {
      estado.busca = evento.target.value.trim();
      renderConteudo();
    });
    const conteudo = $("#bo-conteudo");
    conteudo.addEventListener("change", aoMudar);
    conteudo.addEventListener("click", aoClicar);
    conteudo.addEventListener("submit", (evento) => {
      const form = evento.target.closest("[data-bo-criar]");
      if (!form) return;
      evento.preventDefault();
      criarRegistro(form);
    });
    // "toggle" não sobe pela árvore: escuta na captura para lembrar o que está aberto.
    conteudo.addEventListener(
      "toggle",
      (evento) => {
        const id = evento.target.dataset && evento.target.dataset.boAberto;
        if (!id) return;
        if (evento.target.open) estado.abertos.add(id);
        else estado.abertos.delete(id);
      },
      true
    );
    raiz.dataset.pronto = "1";
  }

  // Trocar de tabela limpa o filtro.
  function definirEntidade(id) {
    if (id === estado.entidade || !ENTIDADES.some((e) => e.id === id)) return;
    estado.entidade = id;
    estado.busca = "";
    const busca = $("#bo-busca");
    if (busca) busca.value = "";
  }

  App.backoffice = { render, definirEntidade };
})();
