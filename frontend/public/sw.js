// @ts-check
/// <reference lib="webworker" />

/** @type {ServiceWorkerGlobalScope} */
// @ts-ignore
const sw = self;

const CACHE_NAME = "parquet-cache-v1";

sw.addEventListener("install", (event) => {
  // Activate immediately without waiting for existing clients to close
  event.waitUntil(sw.skipWaiting());
});

sw.addEventListener("activate", (event) => {
  // Take control of all clients immediately
  event.waitUntil(
    (async () => {
      await sw.clients.claim();

      // Clean up old caches if cache version changes
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames
          .filter(
            (name) => name.startsWith("parquet-cache-") && name !== CACHE_NAME,
          )
          .map((name) => caches.delete(name)),
      );
    })(),
  );
});

sw.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  if (!url.pathname.endsWith(".parquet")) {
    return;
  }

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME);

      const cachedResponse = await cache.match(event.request);

      if (cachedResponse) {
        return cachedResponse;
      }

      const networkResponse = await fetch(event.request);

      if (networkResponse.ok) {
        cache.put(event.request, networkResponse.clone());
      }

      return networkResponse;
    })(),
  );
});
