// Service worker do app instalado (servido em /sw.js para valer no site inteiro).
// Só guarda a página de "sem conexão": contas, folhas e boletos vêm sempre do servidor e nunca ficam em cache.
"use strict";

const CACHE = "financas-v1";
const OFFLINE = "/app/offline.html";
const GUARDADOS = [OFFLINE, "/app/favicon.svg"];

self.addEventListener("install", (evento) => {
  evento.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(GUARDADOS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (evento) => {
  evento.waitUntil(
    caches
      .keys()
      .then((chaves) => Promise.all(chaves.filter((chave) => chave !== CACHE).map((chave) => caches.delete(chave))))
      .then(() => self.clients.claim())
  );
});

// Com rede, tudo vai direto ao servidor. Sem rede, as páginas viram a de sem conexão e os arquivos dela
// (o ícone) saem do cache. O resto, inclusive a API, não passa por aqui.
self.addEventListener("fetch", (evento) => {
  const { request } = evento;
  if (request.mode === "navigate") {
    evento.respondWith(fetch(request).catch(() => caches.match(OFFLINE)));
  } else if (request.method === "GET" && GUARDADOS.includes(new URL(request.url).pathname)) {
    evento.respondWith(fetch(request).catch(() => caches.match(request)));
  }
});
