// Service worker mínimo: cache-first para os assets estáticos da PWA em
// si (manifest, ícone, shell), network-first para tudo mais — as telas
// falam com o backend via app/api/**, que precisa estar sempre
// atualizado, então não fazemos cache agressivo de dados.
const CACHE_NAME = "merka-shell-v1";
const APP_SHELL = ["/", "/manifest.json", "/icon.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).catch(() => {
      // Instalação não deve falhar por causa do pré-cache (ex: offline no
      // primeiro load) — o SW ainda assim assume o controle.
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Nunca cachear chamadas de API — precisam sempre ir na rede.
  if (request.url.includes("/api/")) {
    return;
  }

  if (request.method !== "GET") {
    return;
  }

  event.respondWith(
    fetch(request)
      .then((response) => {
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        return response;
      })
      .catch(() => caches.match(request))
  );
});
