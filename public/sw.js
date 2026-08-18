const CACHE_NAME = "neuralcast-static-v5";
const STATIC_ASSETS = [
  "/manifest.webmanifest",
  "/neuralcast-logo-160.webp",
  "/icons/neuralcast-icon-192.png",
  "/icons/neuralcast-icon-512.png",
  "/icons/neuralcast-apple-touch-icon.png"
];
const STATIC_ASSET_PATHS = new Set(STATIC_ASSETS);

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
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
  const request = event.request;
  const url = new URL(request.url);

  if (
    request.method !== "GET" ||
    url.origin !== self.location.origin ||
    request.headers.get("RSC") === "1" ||
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/_next/")
  ) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() =>
        new Response("NeuralCast needs a network connection for live radio.", {
          headers: { "Content-Type": "text/plain" }
        })
      )
    );
    return;
  }

  if (!STATIC_ASSET_PATHS.has(url.pathname)) {
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) {
        return cached;
      }

      return fetch(request).then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }

        return response;
      });
    })
  );
});
