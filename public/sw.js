/* Service worker do Afinia.
 *
 * Regras de segurança: somente recursos públicos e estáticos entram no cache. Páginas
 * (navegações), APIs, Server Actions, payloads RSC e exportações NUNCA são armazenados —
 * o Afinia exige conexão para consultar e salvar dados financeiros.
 *
 * Ao publicar uma nova versão que mude este arquivo, altere VERSION.
 */
const VERSION = "2026-09-30.1";
const STATIC_CACHE = `afinia-static-${VERSION}`;
const OFFLINE_URL = "/offline";
const PRECACHE = [
  OFFLINE_URL,
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/maskable-512.png",
  "/icons/apple-touch-icon.png",
  "/icons/favicon-32.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(PRECACHE.map((url) => new Request(url, { cache: "reload" })))),
  );
  // Sem skipWaiting automático: o app avisa "Nova versão disponível" e o usuário decide.
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k.startsWith("afinia-") && k !== STATIC_CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
});

function isStaticAsset(url) {
  return url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/");
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    // Sempre da rede; sem conexão, página offline (pública, sem dados).
    event.respondWith(
      fetch(request, { cache: "no-store" }).catch(async () => (await caches.match(OFFLINE_URL)) || Response.error()),
    );
    return;
  }

  if (isStaticAsset(url)) {
    // Arquivos versionados/imutáveis: cache-first.
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            if (response.ok && response.type === "basic") {
              const copy = response.clone();
              caches.open(STATIC_CACHE).then((cache) => cache.put(request, copy));
            }
            return response;
          }),
      ),
    );
  }
  // Demais requisições (API, RSC, exportação, manifest dinâmico): rede, sem cache.
});
