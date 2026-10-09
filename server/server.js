// Servidor do app: páginas, API JSON e PDFs dos boletos, tudo atrás de login.
//
// Variáveis de ambiente:
//   APP_SENHA      senha de acesso (obrigatória, mínimo 8 caracteres)
//   PORT           porta (padrão 3000)
//   HOST           endereço (padrão 0.0.0.0)
//   DB_PATH        arquivo do banco (padrão data/financas.db)
//   TRUST_PROXY=1  confia em X-Forwarded-For/Proto (quando atrás de um proxy HTTPS)
//   COOKIE_SEGURO=1 força o cookie de sessão como Secure
"use strict";

const http = require("node:http");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const crypto = require("node:crypto");
const { abrir, estaVazio } = require("./db");
const { semear } = require("./seed");
const { importarBoletos } = require("./importar");
const { lerHolerite } = require("./holerite");
const backoffice = require("./backoffice");
const dados = require("./dados");

const RAIZ = path.join(__dirname, "..");
const PORTA = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || "0.0.0.0";
const DB_PATH = process.env.DB_PATH || path.join(RAIZ, "data", "financas.db");
const CONFIAR_PROXY = process.env.TRUST_PROXY === "1";
const SENHA = process.env.APP_SENHA;
const DURACAO_SESSAO = 30 * 24 * 60 * 60; // segundos
const LIMITE_CORPO = 64 * 1024;
const LIMITE_PDF = 5 * 1024 * 1024;

if (!SENHA) {
  console.error("Defina a variável APP_SENHA (veja o README).");
  process.exit(1);
}

try {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  fs.accessSync(path.dirname(DB_PATH), fs.constants.W_OK);
} catch (erro) {
  console.error(
    `Não consigo gravar em ${path.dirname(DB_PATH)}. Monte um volume persistente nesse caminho e confira se ` +
      "o usuário do container pode escrever nele (veja o README)."
  );
  process.exit(1);
}

const db = abrir(DB_PATH);
if (estaVazio(db)) {
  console.log("Banco vazio: semeando com os dados iniciais...", semear(db));
} else {
  // Boletos novos extraídos dos PDFs entram sem apagar nada do que foi lançado no app.
  const { multasNovas, guias } = importarBoletos(db);
  if (multasNovas.length) console.log(`Multas novas importadas: ${multasNovas.join(", ")}`);
  if (guias.length) console.log(`Guias do carro atualizadas: ${guias.join(", ")}`);
}

// ---------- Sessão ----------

function obterSegredo() {
  const linha = db.prepare("SELECT valor FROM segredos WHERE chave = 'sessao'").get();
  if (linha) return linha.valor;
  const novo = crypto.randomBytes(32).toString("hex");
  db.prepare("INSERT INTO segredos (chave, valor) VALUES ('sessao', ?)").run(novo);
  return novo;
}

const segredo = obterSegredo();
const salSenha = crypto.randomBytes(16);
const hashSenha = crypto.scryptSync(SENHA, salSenha, 32);

function senhaConfere(tentativa) {
  if (typeof tentativa !== "string" || !tentativa || tentativa.length > 200) return false;
  return crypto.timingSafeEqual(crypto.scryptSync(tentativa, salSenha, 32), hashSenha);
}

function assinar(texto) {
  return crypto.createHmac("sha256", segredo).update(texto).digest("base64url");
}

function criarSessao() {
  const expira = String(Math.floor(Date.now() / 1000) + DURACAO_SESSAO);
  return `${expira}.${assinar(expira)}`;
}

function sessaoValida(token) {
  if (typeof token !== "string") return false;
  const [expira, assinatura] = token.split(".");
  if (!expira || !assinatura) return false;
  const esperada = Buffer.from(assinar(expira));
  const recebida = Buffer.from(assinatura);
  if (esperada.length !== recebida.length || !crypto.timingSafeEqual(esperada, recebida)) return false;
  return Number(expira) > Date.now() / 1000;
}

function lerCookies(req) {
  const cookies = {};
  (req.headers.cookie || "").split(";").forEach((parte) => {
    const i = parte.indexOf("=");
    if (i > 0) cookies[parte.slice(0, i).trim()] = decodeURIComponent(parte.slice(i + 1).trim());
  });
  return cookies;
}

function autenticado(req) {
  return sessaoValida(lerCookies(req).sessao);
}

function conexaoSegura(req) {
  return (
    process.env.COOKIE_SEGURO === "1" ||
    Boolean(req.socket.encrypted) ||
    (CONFIAR_PROXY && req.headers["x-forwarded-proto"] === "https")
  );
}

function cookieSessao(req, valor, maxAge) {
  const partes = [`sessao=${valor}`, "Path=/", "HttpOnly", "SameSite=Lax", `Max-Age=${maxAge}`];
  if (conexaoSegura(req)) partes.push("Secure");
  return partes.join("; ");
}

function ipCliente(req) {
  if (CONFIAR_PROXY && req.headers["x-forwarded-for"]) return req.headers["x-forwarded-for"].split(",")[0].trim();
  return req.socket.remoteAddress || "";
}

// Até 10 tentativas erradas a cada 15 minutos por IP.
const tentativas = new Map();

function loginBloqueado(ip) {
  const t = tentativas.get(ip);
  return Boolean(t && t.ate > Date.now() && t.falhas >= 10);
}

function registrarFalha(ip) {
  const agora = Date.now();
  const t = tentativas.get(ip);
  if (!t || t.ate < agora) tentativas.set(ip, { falhas: 1, ate: agora + 15 * 60 * 1000 });
  else t.falhas++;
}

// ---------- Respostas ----------

const SEGURANCA = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  "X-Frame-Options": "DENY",
};

const CSP =
  "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; " +
  "object-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'";

function enviarJson(res, status, corpo) {
  const texto = JSON.stringify(corpo);
  res.writeHead(status, {
    ...SEGURANCA,
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Content-Length": Buffer.byteLength(texto),
  });
  res.end(texto);
}

function redirecionar(res, destino) {
  res.writeHead(302, { ...SEGURANCA, Location: destino, "Cache-Control": "no-store" });
  res.end();
}

const TIPOS = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".json": "application/manifest+json; charset=utf-8",
};

function enviarArquivo(res, relativo) {
  fs.readFile(path.join(RAIZ, relativo), (erro, conteudo) => {
    if (erro) {
      enviarJson(res, 404, { erro: "Não encontrado." });
      return;
    }
    res.writeHead(200, {
      ...SEGURANCA,
      "Content-Security-Policy": CSP,
      "Content-Type": TIPOS[path.extname(relativo)] || "application/octet-stream",
      "Cache-Control": "no-cache",
    });
    res.end(conteudo);
  });
}

function lerBytes(req, limite) {
  return new Promise((resolver, rejeitar) => {
    let tamanho = 0;
    const partes = [];
    req.on("data", (parte) => {
      tamanho += parte.length;
      if (tamanho > limite) {
        rejeitar(new dados.ErroValidacao("Requisição grande demais.", 413));
        req.destroy();
        return;
      }
      partes.push(parte);
    });
    req.on("end", () => resolver(Buffer.concat(partes)));
    req.on("error", rejeitar);
  });
}

async function lerCorpo(req) {
  const bytes = await lerBytes(req, LIMITE_CORPO);
  if (!bytes.length) return {};
  try {
    return JSON.parse(bytes.toString("utf8"));
  } catch (e) {
    throw new dados.ErroValidacao("JSON inválido.");
  }
}

// Folha de pagamento: o corpo é o próprio PDF; o nome do arquivo vem no cabeçalho X-Nome-Arquivo.
async function enviarHolerite(req, res) {
  if (!/^application\/pdf/.test(req.headers["content-type"] || "")) {
    enviarJson(res, 415, { erro: "Envie a folha de pagamento em PDF." });
    return;
  }
  const pdf = await lerBytes(req, LIMITE_PDF);
  let arquivo = "folha.pdf";
  try {
    arquivo = path.basename(decodeURIComponent(req.headers["x-nome-arquivo"] || "")).slice(0, 120) || arquivo;
  } catch (e) {
    /* nome inválido: fica o padrão */
  }
  dados.criarHolerite(db, lerHolerite(pdf), arquivo, pdf);
  enviarJson(res, 200, estado());
}

// Bloqueia requisições de outros sites (além do SameSite=Lax do cookie).
function origemPermitida(req) {
  const origem = req.headers.origin;
  if (!origem) return true;
  try {
    const host = (CONFIAR_PROXY && req.headers["x-forwarded-host"]) || req.headers.host;
    return new URL(origem).host === host;
  } catch (e) {
    return false;
  }
}

// ---------- API ----------

const estado = () => dados.lerEstado(db);
const alterar = (fn) => (params, corpo) => {
  fn(params, corpo);
  return estado();
};

const ROTAS = [
  ["GET", /^\/api\/estado$/, () => estado()],

  ["PUT", /^\/api\/despesas\/(\d+)\/meses\/([\d-]+)$/, alterar((p, c) => dados.definirValorDespesa(db, p[1], p[2], c))],
  ["PUT", /^\/api\/despesas\/(\d+)\/meses\/([\d-]+)\/pago$/, alterar((p, c) => dados.marcarDespesa(db, p[1], p[2], c))],
  ["POST", /^\/api\/despesas$/, alterar((p, c) => dados.criarDespesa(db, c))],
  ["DELETE", /^\/api\/despesas\/(\d+)$/, alterar((p) => dados.removerDespesa(db, p[1]))],

  ["POST", /^\/api\/entradas$/, alterar((p, c) => dados.criarEntrada(db, c))],
  ["PATCH", /^\/api\/entradas\/(\d+)$/, alterar((p, c) => dados.atualizarEntrada(db, p[1], c))],
  ["DELETE", /^\/api\/entradas\/(\d+)$/, alterar((p) => dados.removerEntrada(db, p[1]))],

  ["POST", /^\/api\/extras$/, alterar((p, c) => dados.criarExtra(db, c))],
  ["PATCH", /^\/api\/extras\/(\d+)$/, alterar((p, c) => dados.atualizarExtra(db, p[1], c))],
  ["DELETE", /^\/api\/extras\/(\d+)$/, alterar((p) => dados.removerExtra(db, p[1]))],

  ["PUT", /^\/api\/multas\/([A-Z]\d{9})\/pago$/, alterar((p, c) => dados.marcarMulta(db, p[1], c))],
  ["PUT", /^\/api\/custos-carro\/(\d+)\/pago$/, alterar((p, c) => dados.marcarCustoCarro(db, p[1], c))],

  ["POST", /^\/api\/emprestimos$/, alterar((p, c) => dados.criarEmprestimo(db, c))],
  ["DELETE", /^\/api\/emprestimos\/(\d+)$/, alterar((p) => dados.removerEmprestimo(db, p[1]))],

  ["DELETE", /^\/api\/holerites\/(\d+)$/, alterar((p) => dados.removerHolerite(db, p[1]))],

  ["PUT", /^\/api\/backoffice\/config$/, alterar((p, c) => backoffice.atualizarConfig(db, c))],
  ["POST", /^\/api\/backoffice\/despesas\/(\d+)\/meses$/, alterar((p, c) => backoffice.criarValoresMes(db, p[1], c))],
  ["PATCH", /^\/api\/backoffice\/despesas\/(\d+)\/meses\/([\d-]+)$/, alterar((p, c) => backoffice.atualizarValorMes(db, p[1], p[2], c))],
  ["DELETE", /^\/api\/backoffice\/despesas\/(\d+)\/meses\/([\d-]+)$/, alterar((p) => backoffice.removerValorMes(db, p[1], p[2]))],
  ["POST", /^\/api\/backoffice\/([a-z-]+)$/, alterar((p, c) => backoffice.criar(db, p[1], c))],
  ["PATCH", /^\/api\/backoffice\/([a-z-]+)\/([\w-]+)$/, alterar((p, c) => backoffice.atualizar(db, p[1], p[2], c))],
  ["DELETE", /^\/api\/backoffice\/([a-z-]+)\/([\w-]+)$/, alterar((p) => backoffice.remover(db, p[1], p[2]))],
];

async function login(req, res) {
  const ip = ipCliente(req);
  if (loginBloqueado(ip)) {
    enviarJson(res, 429, { erro: "Muitas tentativas. Espere 15 minutos e tente de novo." });
    return;
  }
  const corpo = await lerCorpo(req);
  if (!senhaConfere(corpo && corpo.senha)) {
    registrarFalha(ip);
    enviarJson(res, 401, { erro: "Senha incorreta." });
    return;
  }
  tentativas.delete(ip);
  res.setHeader("Set-Cookie", cookieSessao(req, criarSessao(), DURACAO_SESSAO));
  enviarJson(res, 200, { ok: true });
}

function backup(res) {
  const temporario = path.join(os.tmpdir(), `financas-backup-${process.pid}-${Date.now()}.db`);
  db.exec(`VACUUM INTO '${temporario.replace(/'/g, "''")}'`);
  const nome = `financas-${new Date().toISOString().slice(0, 10)}.db`;
  res.writeHead(200, {
    ...SEGURANCA,
    "Content-Type": "application/vnd.sqlite3",
    "Content-Disposition": `attachment; filename="${nome}"`,
    "Cache-Control": "no-store",
  });
  fs.createReadStream(temporario)
    .on("close", () => fs.unlink(temporario, () => {}))
    .pipe(res);
}

async function api(req, res, caminho) {
  if (req.method !== "GET" && !origemPermitida(req)) {
    enviarJson(res, 403, { erro: "Origem não permitida." });
    return;
  }
  if (req.method === "POST" && caminho === "/api/login") {
    await login(req, res);
    return;
  }
  if (req.method === "POST" && caminho === "/api/logout") {
    res.setHeader("Set-Cookie", cookieSessao(req, "", 0));
    enviarJson(res, 200, { ok: true });
    return;
  }
  if (!autenticado(req)) {
    enviarJson(res, 401, { erro: "Faça login para continuar." });
    return;
  }
  if (req.method === "GET" && caminho === "/api/backup") {
    backup(res);
    return;
  }
  if (req.method === "POST" && caminho === "/api/holerites") {
    await enviarHolerite(req, res);
    return;
  }

  for (const [metodo, padrao, tratar] of ROTAS) {
    const params = caminho.match(padrao);
    if (!params || metodo !== req.method) continue;
    if (["POST", "PUT", "PATCH"].includes(req.method) && !/^application\/json/.test(req.headers["content-type"] || "")) {
      enviarJson(res, 415, { erro: "Envie JSON." });
      return;
    }
    const corpo = ["POST", "PUT", "PATCH"].includes(req.method) ? await lerCorpo(req) : {};
    enviarJson(res, 200, tratar(params, corpo));
    return;
  }
  enviarJson(res, 404, { erro: "Rota não encontrada." });
}

// ---------- Páginas e arquivos ----------

function paginas(req, res, caminho) {
  if (req.method !== "GET" && req.method !== "HEAD") {
    enviarJson(res, 405, { erro: "Método não permitido." });
    return;
  }

  if (caminho === "/" || caminho === "/index.html") {
    if (!autenticado(req)) return redirecionar(res, "/login");
    return enviarArquivo(res, "index.html");
  }
  if (caminho === "/login") {
    if (autenticado(req)) return redirecionar(res, "/");
    return enviarArquivo(res, "login.html");
  }

  const estatico = caminho.match(/^\/app\/([a-z0-9-]+\.(?:js|css|svg|png|json|html))$/);
  if (estatico) return enviarArquivo(res, path.join("app", estatico[1]));

  // O service worker precisa estar na raiz para valer no site inteiro (app instalado).
  if (caminho === "/sw.js") return enviarArquivo(res, path.join("app", "sw.js"));

  const boleto = caminho.match(/^\/boletos\/(?:([A-Z]\d{9})|custo-(\d+))\.pdf$/);
  if (boleto) {
    if (!autenticado(req)) return redirecionar(res, "/login");
    const linha = boleto[1] ? dados.lerPdf(db, boleto[1]) : dados.lerPdfCusto(db, boleto[2]);
    if (!linha || !linha.pdf) return enviarJson(res, 404, { erro: "Boleto não encontrado." });
    const nome = boleto[1] || `guia-${boleto[2]}`;
    res.writeHead(200, {
      ...SEGURANCA,
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${nome}.pdf"`,
      "Cache-Control": "private, no-store",
    });
    res.end(Buffer.from(linha.pdf));
    return;
  }

  const holerite = caminho.match(/^\/holerites\/(\d+)\.pdf$/);
  if (holerite) {
    if (!autenticado(req)) return redirecionar(res, "/login");
    const linha = dados.lerPdfHolerite(db, holerite[1]);
    if (!linha) return enviarJson(res, 404, { erro: "Folha de pagamento não encontrada." });
    res.writeHead(200, {
      ...SEGURANCA,
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="folha-${linha.competencia}.pdf"`,
      "Cache-Control": "private, no-store",
    });
    res.end(Buffer.from(linha.pdf));
    return;
  }

  // Para o health check da hospedagem: não expõe nenhum dado.
  if (caminho === "/saude") {
    enviarJson(res, 200, { ok: true });
    return;
  }

  if (caminho === "/favicon.ico") {
    res.writeHead(204);
    res.end();
    return;
  }
  enviarJson(res, 404, { erro: "Não encontrado." });
}

const servidor = http.createServer(async (req, res) => {
  const inicio = Date.now();
  let caminho;
  res.on("finish", () => {
    if (process.env.NODE_ENV !== "test") {
      console.log(`${req.method} ${caminho || req.url} ${res.statusCode} ${Date.now() - inicio}ms`);
    }
  });
  try {
    caminho = new URL(req.url, "http://localhost").pathname;
    if (caminho.startsWith("/api/")) await api(req, res, caminho);
    else paginas(req, res, caminho);
  } catch (erro) {
    if (erro instanceof dados.ErroValidacao) {
      enviarJson(res, erro.status, { erro: erro.message });
    } else {
      console.error(erro);
      if (!res.headersSent) enviarJson(res, 500, { erro: "Erro interno. Tente de novo." });
      else res.end();
    }
  }
});

servidor.listen(PORTA, HOST, () => {
  console.log(`Minhas finanças em http://${HOST === "0.0.0.0" ? "localhost" : HOST}:${PORTA} (banco: ${DB_PATH})`);
});

function encerrar() {
  servidor.close(() => {
    db.close();
    process.exit(0);
  });
  setTimeout(() => process.exit(0), 5000).unref();
}

process.on("SIGTERM", encerrar);
process.on("SIGINT", encerrar);
