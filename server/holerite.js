// Lê a folha de pagamento (recibo em PDF) sem dependências: extrai cada texto da página com a
// posição e monta o holerite pelos rótulos ("Folha Mensal de 08/2026", "CNPJ", "Líquido"...)
// e pelas colunas da tabela (Hrs/Qtde, Vencimentos, Descontos).
"use strict";

const zlib = require("node:zlib");
const { ErroValidacao } = require("./dados");

// ---------- Texto do PDF ----------

// WinAnsiEncoding: o que difere do latin1 entre 0x80 e 0x9F.
const WIN_ANSI = {
  0x80: "€", 0x82: "‚", 0x83: "ƒ", 0x84: "„", 0x85: "…", 0x86: "†", 0x87: "‡", 0x88: "ˆ", 0x89: "‰",
  0x8a: "Š", 0x8b: "‹", 0x8c: "Œ", 0x8e: "Ž", 0x91: "‘", 0x92: "’", 0x93: "“", 0x94: "”", 0x95: "•",
  0x96: "–", 0x97: "—", 0x98: "˜", 0x99: "™", 0x9a: "š", 0x9b: "›", 0x9c: "œ", 0x9e: "ž", 0x9f: "Ÿ",
};

const decodificar = (bytes) => bytes.map((b) => WIN_ANSI[b] || String.fromCharCode(b)).join("");

// Objetos "N 0 obj ... endobj" com o dicionário e o conteúdo do stream (já descompactado).
function objetos(pdf) {
  const bruto = pdf.toString("latin1"); // um caractere por byte: os índices valem para o Buffer
  const lista = new Map();
  const re = /(\d+)\s+\d+\s+obj\b/g;
  let m;
  while ((m = re.exec(bruto))) {
    const fim = bruto.indexOf("endobj", re.lastIndex);
    if (fim < 0) break;
    const corpo = bruto.slice(re.lastIndex, fim);
    const inicioStream = corpo.search(/stream\r?\n/);
    let dados = null;
    let dicionario = corpo;
    if (inicioStream >= 0) {
      dicionario = corpo.slice(0, inicioStream);
      const abertura = corpo.slice(inicioStream).match(/^stream\r?\n/)[0].length;
      const ini = re.lastIndex + inicioStream + abertura;
      const fimStream = bruto.lastIndexOf("endstream", fim);
      dados = pdf.subarray(ini, fimStream);
      if (/\/FlateDecode/.test(dicionario)) {
        try {
          dados = zlib.inflateSync(dados);
        } catch (e) {
          dados = null;
        }
      }
    }
    lista.set(Number(m[1]), { dicionario, dados });
    re.lastIndex = fim;
  }
  return lista;
}

// Conteúdo de cada página, na ordem em que aparecem no arquivo.
function conteudosDasPaginas(pdf) {
  const lista = objetos(pdf);
  const paginas = [];
  lista.forEach(({ dicionario }) => {
    if (!/\/Type\s*\/Page(?![a-zA-Z])/.test(dicionario)) return;
    const unico = dicionario.match(/\/Contents\s+(\d+)\s+\d+\s+R/);
    const varios = dicionario.match(/\/Contents\s*\[([^\]]*)\]/);
    const refs = unico ? [unico[1]] : varios ? [...varios[1].matchAll(/(\d+)\s+\d+\s+R/g)].map((r) => r[1]) : [];
    const partes = refs.map((r) => lista.get(Number(r))).filter((o) => o && o.dados);
    paginas.push(Buffer.concat(partes.map((o) => o.dados)));
  });
  return paginas;
}

// Lê os operadores de texto do conteúdo de uma página (BT/ET, Tm, Td, TD, T*, Tf, Tj, TJ, ' e ").
function textosDaPagina(conteudo, pagina) {
  const c = conteudo.toString("latin1");
  const textos = [];
  const pilha = [];
  let matriz = [1, 0, 0, 1, 0, 0];
  let linha = [1, 0, 0, 1, 0, 0];
  let tamanho = 0;
  let entrelinha = 0;

  const mover = (tx, ty) => {
    linha = [linha[0], linha[1], linha[2], linha[3], linha[4] + tx * linha[0] + ty * linha[2], linha[5] + tx * linha[1] + ty * linha[3]];
    matriz = linha.slice();
  };
  const escrever = (bytes) => {
    const texto = decodificar(bytes);
    if (texto.trim()) textos.push({ pagina, x: matriz[4], y: matriz[5], tamanho: tamanho * Math.abs(matriz[3] || 1), texto: texto.trim() });
  };

  let i = 0;
  while (i < c.length) {
    const ch = c[i];
    if (/\s/.test(ch)) {
      i++;
    } else if (ch === "%") {
      while (i < c.length && c[i] !== "\n" && c[i] !== "\r") i++;
    } else if (ch === "(") {
      // String literal com parênteses balanceados e escapes.
      const bytes = [];
      let nivel = 1;
      i++;
      while (i < c.length && nivel > 0) {
        const atual = c[i];
        if (atual === "\\") {
          const prox = c[i + 1];
          const escapes = { n: 10, r: 13, t: 9, b: 8, f: 12 };
          if (prox in escapes) {
            bytes.push(escapes[prox]);
            i += 2;
          } else if (/[0-7]/.test(prox)) {
            const octal = c.slice(i + 1, i + 4).match(/^[0-7]{1,3}/)[0];
            bytes.push(parseInt(octal, 8) & 0xff);
            i += 1 + octal.length;
          } else if (prox === "\r" || prox === "\n") {
            i += prox === "\r" && c[i + 2] === "\n" ? 3 : 2;
          } else {
            bytes.push(prox.charCodeAt(0));
            i += 2;
          }
          continue;
        }
        if (atual === "(") nivel++;
        if (atual === ")" && --nivel === 0) break;
        bytes.push(atual.charCodeAt(0));
        i++;
      }
      i++;
      pilha.push({ bytes });
    } else if (ch === "<" && c[i + 1] !== "<") {
      const fim = c.indexOf(">", i);
      const hex = c.slice(i + 1, fim).replace(/\s/g, "");
      const bytes = [];
      for (let k = 0; k < hex.length; k += 2) bytes.push(parseInt(hex.slice(k, k + 2).padEnd(2, "0"), 16));
      pilha.push({ bytes });
      i = fim + 1;
    } else if (ch === "[") {
      pilha.push("[");
      i++;
    } else if (ch === "]") {
      const itens = [];
      while (pilha.length && pilha[pilha.length - 1] !== "[") itens.unshift(pilha.pop());
      pilha.pop();
      pilha.push({ lista: itens });
      i++;
    } else if ((ch === "<" || ch === ">") && c[i + 1] === ch) {
      i += 2;
    } else if (ch === "/") {
      const m = c.slice(i).match(/^\/[^\s/[\]()<>{}%]*/)[0];
      pilha.push(m);
      i += m.length;
    } else if (/[\d.+-]/.test(ch)) {
      const m = c.slice(i).match(/^[+-]?(\d+\.?\d*|\.\d+)/);
      if (!m) {
        i++;
        continue;
      }
      pilha.push(Number(m[0]));
      i += m[0].length;
    } else {
      const m = c.slice(i).match(/^[A-Za-z'"*]+/);
      if (!m) {
        i++;
        continue;
      }
      const op = m[0];
      i += op.length;
      const n = (k) => pilha[pilha.length - k];
      switch (op) {
        case "BT":
          matriz = [1, 0, 0, 1, 0, 0];
          linha = matriz.slice();
          break;
        case "Tm":
          matriz = pilha.slice(-6).map(Number);
          linha = matriz.slice();
          break;
        case "Td":
          mover(n(2), n(1));
          break;
        case "TD":
          entrelinha = -n(1);
          mover(n(2), n(1));
          break;
        case "TL":
          entrelinha = n(1);
          break;
        case "T*":
          mover(0, -entrelinha);
          break;
        case "Tf":
          tamanho = n(1);
          break;
        case "Tj":
          if (n(1) && n(1).bytes) escrever(n(1).bytes);
          break;
        case "'":
        case '"':
          mover(0, -entrelinha);
          if (n(1) && n(1).bytes) escrever(n(1).bytes);
          break;
        case "TJ":
          if (n(1) && n(1).lista) escrever(n(1).lista.filter((x) => x && x.bytes).flatMap((x) => x.bytes));
          break;
        case "BI": {
          // Imagem embutida: pula até o fim dos dados.
          const fim = c.indexOf("EI", i);
          i = fim < 0 ? c.length : fim + 2;
          break;
        }
        default:
          break;
      }
      pilha.length = 0;
    }
  }
  return textos;
}

function textosDoPdf(pdf) {
  return conteudosDasPaginas(pdf).flatMap((conteudo, pagina) => textosDaPagina(conteudo, pagina));
}

// ---------- Holerite ----------

// Largura aproximada na Helvetica (em milésimos do tamanho da fonte), para achar o centro de cada texto.
function largura(t) {
  const texto = t.texto;
  let soma = 0;
  for (const ch of texto) {
    if (/[\d]/.test(ch)) soma += 556;
    else if (/[.,:;/ ]/.test(ch)) soma += 278;
    else if (/[A-Z]/.test(ch)) soma += 667;
    else soma += 500;
  }
  return (soma / 1000) * (t.tamanho || 9);
}

const centro = (t) => t.x + largura(t) / 2;

const NUMERO = /^-?\d{1,3}(\.\d{3})*,\d{2}$/;
const centavos = (texto) => Math.round(Number(texto.replace(/\./g, "").replace(",", ".")) * 100);
const semAcento = (texto) => texto.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

// Agrupa os textos em linhas (mesma página e mesma altura), de cima para baixo e da esquerda para a direita.
function linhas(textos) {
  const grupos = [];
  [...textos]
    .sort((a, b) => a.pagina - b.pagina || b.y - a.y || a.x - b.x)
    .forEach((t) => {
      const ultima = grupos[grupos.length - 1];
      if (ultima && ultima.pagina === t.pagina && Math.abs(ultima.y - t.y) <= 3) ultima.itens.push(t);
      else grupos.push({ pagina: t.pagina, y: t.y, itens: [t] });
    });
  grupos.forEach((l) => l.itens.sort((a, b) => a.x - b.x));
  return grupos;
}

// O título de coluna mais perto (pelo centro) de cada texto.
function maisPerto(titulos, t) {
  return titulos.reduce((melhor, titulo) =>
    Math.abs(centro(titulo) - centro(t)) < Math.abs(centro(melhor) - centro(t)) ? titulo : melhor
  );
}

const erro = (detalhe) =>
  new ErroValidacao(`Não consegui ler essa folha de pagamento: ${detalhe} Confira se é o PDF do recibo no modelo de sempre.`);

function lerHolerite(pdf) {
  if (!Buffer.isBuffer(pdf) || pdf.subarray(0, 5).toString("latin1") !== "%PDF-") {
    throw new ErroValidacao("O arquivo não é um PDF.");
  }
  let textos;
  try {
    textos = textosDoPdf(pdf);
  } catch (e) {
    throw erro("o PDF não tem texto que eu consiga extrair.");
  }
  if (!textos.length) throw erro("o PDF não tem texto (pode ser uma imagem escaneada).");

  const todas = linhas(textos);
  const acharTexto = (re) => textos.find((t) => re.test(t.texto));
  const linhaDe = (t) => todas.find((l) => l.itens.includes(t));
  const abaixo = (l) => todas[todas.indexOf(l) + 1];

  // "Folha Mensal de 08/2026"
  const tituloFolha = acharTexto(/^(.+?)\s+de\s+(0[1-9]|1[0-2])\/(\d{4})$/);
  if (!tituloFolha) throw erro("não achei a competência (como “Folha Mensal de 08/2026”).");
  const [, tipo, mesCompetencia, anoCompetencia] = tituloFolha.texto.match(/^(.+?)\s+de\s+(0[1-9]|1[0-2])\/(\d{4})$/);

  // Empresa, razão social e CNPJ na mesma linha; funcionário, matrícula e cargo na linha de baixo.
  const cnpj = acharTexto(/CNPJ/i);
  const linhaEmpresa = cnpj ? linhaDe(cnpj) : null;
  const empresa = linhaEmpresa ? linhaEmpresa.itens.filter((t) => t !== cnpj).map((t) => t.texto) : [];
  const linhaFuncionario = linhaEmpresa ? abaixo(linhaEmpresa) : null;
  const funcionario = linhaFuncionario ? linhaFuncionario.itens.map((t) => t.texto) : [];

  // Tabela de itens: entre o cabeçalho (Cód, Descrição, Hrs/Qtde, Vencimentos, Descontos) e o rodapé de totais.
  const cabecalho = todas.find((l) => {
    const nomes = l.itens.map((t) => semAcento(t.texto));
    return nomes.includes("vencimentos") && nomes.includes("descontos");
  });
  if (!cabecalho) throw erro("não achei a tabela de vencimentos e descontos.");
  const tituloDe = (l, re) => l.itens.find((t) => re.test(semAcento(t.texto)));
  const colunas = {
    referencia: tituloDe(cabecalho, /^(hrs|qtd|ref)/),
    vencimento: tituloDe(cabecalho, /^vencimentos$/),
    desconto: tituloDe(cabecalho, /^descontos$/),
  };
  const titulosColunas = Object.values(colunas).filter(Boolean);
  const colunaDescricao = tituloDe(cabecalho, /^descri/);

  const rodape = todas.find((l) => l.itens.some((t) => /^total venc/.test(semAcento(t.texto))));
  if (!rodape) throw erro("não achei os totais (Total Venctos e Total Descontos).");

  const itens = todas
    .filter((l) => l.pagina === cabecalho.pagina && l.y < cabecalho.y && l.y > rodape.y && /^\d+$/.test(l.itens[0].texto))
    .map((l) => {
      const [codigo, ...resto] = l.itens;
      const item = { codigo: codigo.texto, descricao: "", referencia: null, vencimento: 0, desconto: 0 };
      const descricao = [];
      resto.forEach((t) => {
        const ehValor = NUMERO.test(t.texto) && (!colunaDescricao || t.x > colunaDescricao.x + 120);
        if (!ehValor) {
          descricao.push(t.texto);
          return;
        }
        const coluna = maisPerto(titulosColunas, t);
        if (coluna === colunas.referencia) item.referencia = t.texto;
        else if (coluna === colunas.vencimento) item.vencimento = centavos(t.texto);
        else item.desconto = centavos(t.texto);
      });
      item.descricao = descricao.join(" ");
      return item;
    });
  if (!itens.length) throw erro("a tabela de vencimentos e descontos está vazia.");

  // Totais: cada valor da linha de baixo vai para o título mais perto.
  const linhaTotais = abaixo(rodape);
  const totais = {};
  const chaves = [
    [/^salario/, "salarioMensal"],
    [/^base inss/, "baseInss"],
    [/^base irrf/, "baseIrrf"],
    [/^fgts/, "fgts"],
    [/^total venc/, "totalVencimentos"],
    [/^total desc/, "totalDescontos"],
  ];
  if (linhaTotais) {
    linhaTotais.itens
      .filter((t) => NUMERO.test(t.texto))
      .forEach((t) => {
        const titulo = maisPerto(rodape.itens, t);
        const chave = chaves.find(([re]) => re.test(semAcento(titulo.texto)));
        if (chave) totais[chave[1]] = centavos(t.texto);
      });
  }
  if (totais.totalVencimentos == null || totais.totalDescontos == null) throw erro("não achei os totais.");

  // Líquido: o valor logo abaixo do título "Líquido".
  const tituloLiquido = acharTexto(/^l[ií]quido$/i);
  const linhaLiquido = tituloLiquido ? abaixo(linhaDe(tituloLiquido)) : null;
  const valorLiquido = linhaLiquido && linhaLiquido.itens.filter((t) => NUMERO.test(t.texto));
  if (!valorLiquido || !valorLiquido.length) throw erro("não achei o valor líquido.");
  const liquido = centavos(maisPerto(valorLiquido, tituloLiquido).texto);

  // Conferência: os itens precisam fechar com os totais e o líquido.
  const soma = (campo) => itens.reduce((s, x) => s + x[campo], 0);
  if (soma("vencimento") !== totais.totalVencimentos || soma("desconto") !== totais.totalDescontos) {
    throw erro("a soma dos itens não bate com os totais.");
  }
  if (totais.totalVencimentos - totais.totalDescontos !== liquido) {
    throw erro("vencimentos menos descontos não dá o líquido.");
  }

  // Conta do depósito e data do recibo.
  const conta = acharTexto(/conta\s*:/i);
  const agencia = acharTexto(/ag[eê]ncia\s*:/i);
  const linhaBanco = agencia ? linhaDe(agencia) : null;
  const banco = linhaBanco ? linhaBanco.itens.find((t) => t.x < agencia.x && !NUMERO.test(t.texto)) : null;
  const dataRecibo = textos.filter((t) => /^\d{2}\/\d{2}\/\d{4}$/.test(t.texto)).pop();
  const valorDepois = (t) => (t ? (t.texto.split(":").slice(1).join(":").trim() || null) : null);

  return {
    tipo: tipo.trim(),
    competencia: `${anoCompetencia}-${mesCompetencia}`,
    empresa: empresa[0] || "",
    razaoSocial: empresa[1] || "",
    cnpj: cnpj ? cnpj.texto.replace(/^CNPJ:?\s*/i, "") : "",
    funcionario: funcionario[0] || "",
    matricula: funcionario[1] || "",
    cargo: funcionario[2] || "",
    itens,
    salarioMensal: totais.salarioMensal ?? 0,
    baseInss: totais.baseInss ?? 0,
    baseIrrf: totais.baseIrrf ?? 0,
    fgts: totais.fgts ?? 0,
    totalVencimentos: totais.totalVencimentos,
    totalDescontos: totais.totalDescontos,
    liquido,
    banco: banco ? banco.texto : null,
    agencia: valorDepois(agencia),
    conta: valorDepois(conta),
    pagoEm: dataRecibo ? dataRecibo.texto.split("/").reverse().join("-") : null,
  };
}

module.exports = { lerHolerite, textosDoPdf };
